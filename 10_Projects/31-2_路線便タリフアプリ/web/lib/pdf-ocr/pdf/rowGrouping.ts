import { TextElement } from "@/types/pdf-ocr/pdfAnalysis";

export interface RowGroup {
  groupId: string;
  headerText: string;
  headerCenterY: number;
  headerX: number;
  elements: TextElement[];
}

export interface RowHeaderDiagnosticItem {
  id: string;
  rawText: string;
  trimmedText: string;
  candidate: boolean;
  parsedNumber: number | null;
  centerY: number;
  selectedAsRowHeader: boolean;
  reason: string;
}

export interface RowGroupingDiagnostics {
  totalElementCount: number;
  candidateCount: number;
  adoptedHeaderCount: number;
  items: RowHeaderDiagnosticItem[];
}

export interface RowGroupingResult {
  rowGroups: RowGroup[];
  unassignedElements: TextElement[];
  diagnostics?: RowGroupingDiagnostics;
}

/**
 * 選択領域内のTextElement[]を物理Y座標に基づいて行グループ(RowGroup)に分類する純粋関数
 * POINT C-2: 重量行（10kg, 20kg, 30kg, 40kg, 50kg ...）のY座標自動分離
 * (原因診断用 diagnostics 出力を追加)
 */
export function groupElementsByRowHeaders(elements: TextElement[]): RowGroupingResult {
  if (!elements || elements.length === 0) {
    return {
      rowGroups: [],
      unassignedElements: [],
      diagnostics: {
        totalElementCount: 0,
        candidateCount: 0,
        adoptedHeaderCount: 0,
        items: [],
      },
    };
  }

  // 座標算出ヘルパー（normalizedCoordinatesが存在すれば優先、なければoriginalCoordinates）
  const getBounds = (el: TextElement) => {
    const coords = el.normalizedCoordinates || el.originalCoordinates;
    return {
      x: coords.x,
      y: coords.y,
      width: coords.width,
      height: coords.height,
      centerX: coords.x + coords.width / 2,
      centerY: coords.y + coords.height / 2,
    };
  };

  // 重量行見出し候補判定ロジック:
  // 数字単体 (例: "10", "20", "30", "40", "50") または "10kg", "20kg" 等
  // ※修正点: 距離列見出しの "50", "100" 等を誤認防止するため、X位置が左寄り(x <= 0.35)か、または'kg'を含む要素を採択
  const getCandidateDetail = (text: string, el?: TextElement) => {
    if (!text) return { isCandidate: false, parsedNumber: null, reason: "empty-text" };
    const trimmed = text.trim();
    if (/昭和|平成|令和|年|%|×|行先|見出し|km/i.test(trimmed)) {
      return { isCandidate: false, parsedNumber: null, reason: "excluded-keyword" };
    }
    const numMatch = trimmed.match(/^\d+(?:kg)?$/i) || trimmed.match(/^(\d+)$/);
    if (!numMatch) {
      return { isCandidate: false, parsedNumber: null, reason: "regex-no-match" };
    }

    // X座標チェック (距離ヘッダー 50, 100 等の誤認防止)
    if (el) {
      const coords = el.normalizedCoordinates || el.originalCoordinates;
      const isLeftArea = coords.x <= 0.35;
      const hasKg = /kg/i.test(trimmed);
      if (!isLeftArea && !hasKg) {
        return { isCandidate: false, parsedNumber: null, reason: "non-left-position" };
      }
    }

    const val = parseInt(numMatch[1] || numMatch[0], 10);
    if (val > 0 && val <= 10000) {
      return { isCandidate: true, parsedNumber: val, reason: "candidate-ok" };
    }
    return { isCandidate: false, parsedNumber: val, reason: "number-out-of-range" };
  };

  const isRowHeaderCandidate = (el: TextElement) => {
    return getCandidateDetail(el.text, el).isCandidate;
  };

  // 1. 行見出し候補となる要素の抽出
  let candidateEls = elements.filter((el) => isRowHeaderCandidate(el));

  // 候補が見つからない場合は全数字要素からフォールバック
  let isFallbackUsed = false;
  if (candidateEls.length === 0) {
    candidateEls = elements.filter((el) => /^\d+$/.test(el.text.trim()));
    if (candidateEls.length > 0) {
      isFallbackUsed = true;
    }
  }

  // 行見出し候補をY座標昇順（上から下）にソート
  const sortedCandidates = [...candidateEls].sort((a, b) => getBounds(a).centerY - getBounds(b).centerY);

  // Y座標が同一・近接している重複要素を行ごとにまとめる
  const uniqueRowHeaders: { headerText: string; centerY: number; headerX: number; originalEl: TextElement }[] = [];
  const mergedDuplicateElIds = new Set<string>();

  for (const cEl of sortedCandidates) {
    const b = getBounds(cEl);
    const numMatch = cEl.text.trim().match(/\d+/);
    const numVal = numMatch ? numMatch[0] : cEl.text.trim();
    const formattedHeaderText = cEl.text.trim().toLowerCase().endsWith("kg")
      ? cEl.text.trim()
      : `${numVal}kg`;

    // 既存の行ヘッダーとY座標領域が重なるか判定
    const existing = uniqueRowHeaders.find((urh) => {
      const urhBounds = getBounds(urh.originalEl);
      const overlapY = Math.max(
        0,
        Math.min(urhBounds.y + urhBounds.height, b.y + b.height) - Math.max(urhBounds.y, b.y)
      );
      const minHeight = Math.min(urhBounds.height, b.height);
      const centerDistY = Math.abs(urh.centerY - b.centerY);
      const maxOverlapDistY = Math.max(minHeight * 0.5, 0.01);
      return overlapY > minHeight * 0.3 || centerDistY < maxOverlapDistY;
    });

    if (!existing) {
      uniqueRowHeaders.push({
        headerText: formattedHeaderText,
        centerY: b.centerY,
        headerX: b.x,
        originalEl: cEl,
      });
    } else {
      mergedDuplicateElIds.add(cEl.id);
    }
  }

  // Y座標で最終ソート（上から順 10kg → 20kg → 30kg → 40kg → 50kg）
  uniqueRowHeaders.sort((a, b) => a.centerY - b.centerY);

  const adoptedHeaderIdSet = new Set(uniqueRowHeaders.map((rh) => rh.originalEl.id));

  // 2. 各要素を最も近いY行グループへ割り当て
  const rowGroups: RowGroup[] = uniqueRowHeaders.map((rh, index) => ({
    groupId: `row-group-${index}-${rh.headerText}`,
    headerText: rh.headerText,
    headerCenterY: rh.centerY,
    headerX: rh.headerX,
    elements: [],
  }));

  const unassignedElements: TextElement[] = [];

  for (const el of elements) {
    const b = getBounds(el);
    let bestGroup: RowGroup | null = null;
    let minDistY = Infinity;

    for (const group of rowGroups) {
      const distY = Math.abs(b.centerY - group.headerCenterY);
      // 行高さに対する許容範囲 (例: Y差 0.035 以内)
      if (distY < 0.035 && distY < minDistY) {
        minDistY = distY;
        bestGroup = group;
      }
    }

    if (bestGroup) {
      bestGroup.elements.push(el);
    } else {
      unassignedElements.push(el);
    }
  }

  // 各行グループ内の要素をX座標順（左から右）にソート
  for (const group of rowGroups) {
    group.elements.sort((a, b) => getBounds(a).centerX - getBounds(b).centerX);
  }

  // 3. 診断情報の作成（本判定結果を変えずに全要素の状況を記録）
  const diagnosticItems: RowHeaderDiagnosticItem[] = elements.map((el) => {
    const rawText = el.text;
    const trimmedText = el.text.trim();
    const detail = getCandidateDetail(rawText, el);
    const isCand = isRowHeaderCandidate(el) || (isFallbackUsed && /^\d+$/.test(trimmedText));
    const isAdopted = adoptedHeaderIdSet.has(el.id);

    let reasonStr = detail.reason;
    if (isAdopted) {
      reasonStr = "adopted-as-row-header";
    } else if (mergedDuplicateElIds.has(el.id)) {
      reasonStr = "y-duplicate-merged";
    } else if (isFallbackUsed && /^\d+$/.test(trimmedText)) {
      reasonStr = "fallback-digit-match";
    }

    return {
      id: el.id,
      rawText,
      trimmedText,
      candidate: isCand,
      parsedNumber: detail.parsedNumber,
      centerY: getBounds(el).centerY,
      selectedAsRowHeader: isAdopted,
      reason: reasonStr,
    };
  });

  return {
    rowGroups,
    unassignedElements,
    diagnostics: {
      totalElementCount: elements.length,
      candidateCount: candidateEls.length,
      adoptedHeaderCount: uniqueRowHeaders.length,
      items: diagnosticItems,
    },
  };
}

