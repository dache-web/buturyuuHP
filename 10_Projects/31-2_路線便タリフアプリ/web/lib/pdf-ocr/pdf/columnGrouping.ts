import { TextElement } from "@/types/pdf-ocr/pdfAnalysis";

export interface ColumnGroup {
  groupId: string;
  headerText: string;
  headerCenterX: number;
  headerY: number;
  elements: TextElement[];
}

export interface DiagnosticCandidate {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  yDiffFromBest: number;
  isAdoptedAsHeader: boolean;
}

export interface DiagnosticMapping {
  id: string;
  text: string;
  x: number;
  y: number;
  centerX: number;
  centerY: number;
  assignedGroupId: string | null;
  assignedHeaderText: string | null;
  isUnassigned: boolean;
  unassignedReason?: string;
  isHeaderSelf: boolean;
}

export interface DiagnosticHeaderDoubleReg {
  id: string;
  text: string;
  isAdoptedAsHeader: boolean;
  isRegisteredInElements: boolean;
}

export interface ColumnGroupingDiagnostics {
  totalElementCount: number;
  allCandidates: DiagnosticCandidate[];
  adoptedHeaders: { id: string; text: string; centerX: number; y: number }[];
  bestHeaderY: number | null;
  headerToleranceRatio: number;
  boundaries: { index: number; boundaryX: number; leftColText: string; rightColText: string }[];
  leftLimit: number | null;
  rightLimit: number | null;
  elementMappings: DiagnosticMapping[];
  headerDoubleRegChecks: DiagnosticHeaderDoubleReg[];
}

export interface ColumnGroupingResult {
  columnGroups: ColumnGroup[];
  unassignedElements: TextElement[];
  headerY: number | null;
  diagnostics?: ColumnGroupingDiagnostics;
}

/**
 * 選択領域内のTextElement[]を物理X座標に基づいて列グループ(ColumnGroup)に分類する純粋関数
 * POINT C-1: 50km列 + 100km列のX座標自動分離
 * (修正点: 固定中心距離 < 0.03 を廃止し、文字領域[x, x+width]の物理的オーバーラップ判定を導入)
 */
export function groupElementsByColumnHeaders(elements: TextElement[]): ColumnGroupingResult {
  if (!elements || elements.length === 0) {
    return {
      columnGroups: [],
      unassignedElements: [],
      headerY: null,
      diagnostics: {
        totalElementCount: 0,
        allCandidates: [],
        adoptedHeaders: [],
        bestHeaderY: null,
        headerToleranceRatio: 0.04,
        boundaries: [],
        leftLimit: null,
        rightLimit: null,
        elementMappings: [],
        headerDoubleRegChecks: [],
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

  // 見出し候補の判定ロジック:
  // - 距離数値を含む (例: "50", "100", "150", "50km")
  // - "km" 単体、年数 ("昭和60年")、注記 ("×90%")、単位 ("kg")、"行先" 等は除外
  const isHeaderCandidate = (text: string) => {
    const trimmed = text.trim();
    if (/^km$/i.test(trimmed)) return false;
    if (/昭和|平成|令和|年|%|×|行先|kg|見出し/i.test(trimmed)) return false;
    const numMatch = trimmed.match(/\d+/);
    if (!numMatch) return false;
    const val = parseInt(numMatch[0], 10);
    return val > 0 && val <= 3000 && trimmed.length <= 8;
  };

  // 1. 全要素から見出し候補となる要素を抽出
  const candidateEls = elements.filter((el) => isHeaderCandidate(el.text));

  // 見出し候補が1つも見つからない場合はフォールバック
  let headerPool = candidateEls;
  if (headerPool.length === 0) {
    headerPool = elements.filter((el) => /\d+/.test(el.text) && !/年|%|行先|kg/.test(el.text));
  }

  if (headerPool.length === 0) {
    return {
      columnGroups: [],
      unassignedElements: elements,
      headerY: null,
      diagnostics: {
        totalElementCount: elements.length,
        allCandidates: [],
        adoptedHeaders: [],
        bestHeaderY: null,
        headerToleranceRatio: 0.04,
        boundaries: [],
        leftLimit: null,
        rightLimit: null,
        elementMappings: elements.map((el) => {
          const b = getBounds(el);
          return {
            id: el.id,
            text: el.text,
            x: b.x,
            y: b.y,
            centerX: b.centerX,
            centerY: b.centerY,
            assignedGroupId: null,
            assignedHeaderText: null,
            isUnassigned: true,
            unassignedReason: "見出し候補なし",
            isHeaderSelf: false,
          };
        }),
        headerDoubleRegChecks: [],
      },
    };
  }

  // 最上部にある見出し候補のY座標および高さを特定
  const sortedPoolByY = [...headerPool].sort((a, b) => getBounds(a).y - getBounds(b).y);
  const bestHeaderBounds = getBounds(sortedPoolByY[0]);
  const bestHeaderY = bestHeaderBounds.y;

  // 動的Y許容幅の計算:
  // 見出し要素高さの2.0倍、または下限 0.04 (高さのズレを安全に吸収しつつ、下の地域行には達しない最適な帯幅)
  const headerYTolerance = Math.max(bestHeaderBounds.height * 2.0, 0.04);

  // bestHeaderY と同じ行の帯（±headerYTolerance）に存在する見出し要素を取得
  const headerElsOnSameRow = headerPool.filter(
    (el) => Math.abs(getBounds(el).y - bestHeaderY) <= headerYTolerance
  );

  // X座標順にソート
  headerElsOnSameRow.sort((a, b) => getBounds(a).centerX - getBounds(b).centerX);

  // 重複・接近しているヘッダー要素の重複マージ判定
  // 固定距離 < 0.03 を廃止し、文字領域 [x, x + width] の物理的オーバーラップ判定を導入
  const uniqueHeaders: { text: string; centerX: number; y: number; originalEl: TextElement }[] = [];
  for (const hEl of headerElsOnSameRow) {
    const b = getBounds(hEl);
    const existing = uniqueHeaders.find((uh) => {
      const uhBounds = getBounds(uh.originalEl);
      // X軸方向の領域オーバーラップ（交差幅）を計算
      const overlapX = Math.max(
        0,
        Math.min(uhBounds.x + uhBounds.width, b.x + b.width) - Math.max(uhBounds.x, b.x)
      );
      const minWidth = Math.min(uhBounds.width, b.width);
      // 中心距離および交差幅の比較
      const centerDist = Math.abs(uh.centerX - b.centerX);
      const maxOverlapDist = Math.max(minWidth * 0.5, 0.012);
      return overlapX > minWidth * 0.3 || centerDist < maxOverlapDist;
    });

    if (!existing) {
      uniqueHeaders.push({
        text: hEl.text,
        centerX: b.centerX,
        y: b.y,
        originalEl: hEl,
      });
    }
  }

  if (uniqueHeaders.length === 0) {
    return {
      columnGroups: [],
      unassignedElements: elements,
      headerY: null,
      diagnostics: {
        totalElementCount: elements.length,
        allCandidates: headerPool.map((el) => {
          const b = getBounds(el);
          return {
            id: el.id,
            text: el.text,
            x: b.x,
            y: b.y,
            width: b.width,
            height: b.height,
            centerX: b.centerX,
            centerY: b.centerY,
            yDiffFromBest: b.y - bestHeaderY,
            isAdoptedAsHeader: false,
          };
        }),
        adoptedHeaders: [],
        bestHeaderY,
        headerToleranceRatio: headerYTolerance,
        boundaries: [],
        leftLimit: null,
        rightLimit: null,
        elementMappings: [],
        headerDoubleRegChecks: [],
      },
    };
  }

  const headerY = Math.min(...uniqueHeaders.map((h) => h.y));

  // 列グループ初期化
  const columnGroups: ColumnGroup[] = uniqueHeaders.map((h, idx) => ({
    groupId: `col-group-${idx}-${h.text.replace(/\s+/g, "")}`,
    headerText: h.text,
    headerCenterX: h.centerX,
    headerY: h.y,
    elements: [],
  }));

  // 隣接ヘッダー間の中間点境界
  const boundaryInfos: { index: number; boundaryX: number; leftColText: string; rightColText: string }[] = [];
  const boundaries: number[] = [];
  for (let i = 0; i < uniqueHeaders.length - 1; i++) {
    const midX = (uniqueHeaders[i].centerX + uniqueHeaders[i + 1].centerX) / 2;
    boundaries.push(midX);
    boundaryInfos.push({
      index: i,
      boundaryX: midX,
      leftColText: uniqueHeaders[i].text,
      rightColText: uniqueHeaders[i + 1].text,
    });
  }

  // 最左/最右ヘッダー外側の限界点
  const avgColWidth = uniqueHeaders.length > 1
    ? (uniqueHeaders[uniqueHeaders.length - 1].centerX - uniqueHeaders[0].centerX) / (uniqueHeaders.length - 1)
    : 0.1;
  const leftLimit = uniqueHeaders[0].centerX - avgColWidth * 0.4;
  const rightLimit = uniqueHeaders[uniqueHeaders.length - 1].centerX + avgColWidth * 0.4;

  const unassignedElements: TextElement[] = [];
  const elementMappings: DiagnosticMapping[] = [];

  // 各要素の振り分け
  for (const el of elements) {
    const b = getBounds(el);
    const mapping: DiagnosticMapping = {
      id: el.id,
      text: el.text,
      x: b.x,
      y: b.y,
      centerX: b.centerX,
      centerY: b.centerY,
      assignedGroupId: null,
      assignedHeaderText: null,
      isUnassigned: false,
      isHeaderSelf: false,
    };

    // 1. headerY より明確に上にある要素 (例: 昭和60年, ×90%, km等) は除外
    if (b.y < headerY - 0.01) {
      unassignedElements.push(el);
      mapping.isUnassigned = true;
      mapping.unassignedReason = `headerY (${headerY.toFixed(4)}) より上 (y=${b.y.toFixed(4)})`;
      elementMappings.push(mapping);
      continue;
    }

    // 2. ヘッダー自身は地域配下に含めない
    const isHeaderSelf = uniqueHeaders.some((h) => h.originalEl.id === el.id);
    if (isHeaderSelf) {
      mapping.isHeaderSelf = true;
      mapping.isUnassigned = true;
      mapping.unassignedReason = "ヘッダー自身";
      elementMappings.push(mapping);
      continue;
    }

    // 3. ヘッダー行にある単位 "km" 単体、および "行先", "kg" 等を除外
    if (Math.abs(b.y - headerY) <= 0.015 && (/^km$/i.test(el.text.trim()) || /行先|kg|見出し/i.test(el.text.trim()))) {
      unassignedElements.push(el);
      mapping.isUnassigned = true;
      mapping.unassignedReason = "ヘッダー行単位・固定ラベル除外";
      elementMappings.push(mapping);
      continue;
    }

    // 4. 行先・kg などの文字列単体はどこにあっても除外
    if (/^行先$/i.test(el.text.trim()) || /^kg$/i.test(el.text.trim())) {
      unassignedElements.push(el);
      mapping.isUnassigned = true;
      mapping.unassignedReason = "不要固定キーワード除外";
      elementMappings.push(mapping);
      continue;
    }

    // 5. 最左・最右の有効範囲より外側の要素を除外
    if (b.centerX < leftLimit || b.centerX > rightLimit) {
      unassignedElements.push(el);
      mapping.isUnassigned = true;
      mapping.unassignedReason = `列範囲外 (leftLimit:${leftLimit.toFixed(4)}, rightLimit:${rightLimit.toFixed(4)})`;
      elementMappings.push(mapping);
      continue;
    }

    // 6. 境界点との比較でどの列に属するか判定
    let targetGroupIndex = 0;
    for (let i = 0; i < boundaries.length; i++) {
      if (b.centerX > boundaries[i]) {
        targetGroupIndex = i + 1;
      }
    }

    const assignedGrp = columnGroups[targetGroupIndex];
    assignedGrp.elements.push(el);

    mapping.assignedGroupId = assignedGrp.groupId;
    mapping.assignedHeaderText = assignedGrp.headerText;
    elementMappings.push(mapping);
  }

  // Y座標順にソート
  for (const group of columnGroups) {
    group.elements.sort((a, b) => getBounds(a).y - getBounds(b).y);
  }

  // 診断用：全候補の判定情報構築
  const allCandidatesDiagnostic: DiagnosticCandidate[] = headerPool.map((el) => {
    const b = getBounds(el);
    const isAdopted = uniqueHeaders.some((uh) => uh.originalEl.id === el.id);
    return {
      id: el.id,
      text: el.text,
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
      centerX: b.centerX,
      centerY: b.centerY,
      yDiffFromBest: b.y - bestHeaderY,
      isAdoptedAsHeader: isAdopted,
    };
  });

  // 診断用：ヘッダー自身の二重登録チェック
  const headerDoubleRegChecks: DiagnosticHeaderDoubleReg[] = uniqueHeaders.map((uh) => {
    const isRegisteredInElements = columnGroups.some((cg) =>
      cg.elements.some((el) => el.id === uh.originalEl.id)
    );
    return {
      id: uh.originalEl.id,
      text: uh.text,
      isAdoptedAsHeader: true,
      isRegisteredInElements,
    };
  });

  const diagnostics: ColumnGroupingDiagnostics = {
    totalElementCount: elements.length,
    allCandidates: allCandidatesDiagnostic,
    adoptedHeaders: uniqueHeaders.map((uh) => ({
      id: uh.originalEl.id,
      text: uh.text,
      centerX: uh.centerX,
      y: uh.y,
    })),
    bestHeaderY,
    headerToleranceRatio: headerYTolerance,
    boundaries: boundaryInfos,
    leftLimit,
    rightLimit,
    elementMappings,
    headerDoubleRegChecks,
  };

  return {
    columnGroups,
    unassignedElements,
    headerY,
    diagnostics,
  };
}

