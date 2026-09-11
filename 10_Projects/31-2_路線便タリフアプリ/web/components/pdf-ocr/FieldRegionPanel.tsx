"use client";

import { FormEvent, useState } from "react";
import styles from "@/app/pdf-verify/page.module.css";
import {
  DocumentRegion,
  DocumentRegionRole,
  DOCUMENT_REGION_ROLE_LABELS,
  COMMON_SEMANTIC_CANDIDATES,
} from "@/types/pdf-ocr/tableSchema";

import { TextElement } from "@/types/pdf-ocr/pdfAnalysis";
import { groupElementsByColumnHeaders } from "@/lib/pdf-ocr/pdf/columnGrouping";
import { groupElementsByRowHeaders } from "@/lib/pdf-ocr/pdf/rowGrouping";
import { convertExtractedData } from "@/lib/dataConversion/client";
import { DataConversionResult } from "@/lib/dataConversion/types";
import { runPdfSelfCheckAdapter, SelfCheckAdapterResult } from "@/lib/selfCheck/adapter";
import { runPdfCorrectnessAdapter, CorrectnessAdapterResult, runSeinoCorrectnessIntegration, runSeinoCorrectnessIntegrationAsync } from "@/lib/correctnessCheck/adapter";
import { ExternalCorrectnessResult } from "@/lib/correctnessCheck/contract";
import { runPdfBusinessRuleAdapter, BusinessRuleAdapterResult } from "@/lib/businessRule/adapter";
import { buildTariffMatrix } from "@/lib/pdf-ocr/pdf/tariffMatrix";
import { parseSeinoTariffStructure } from "@/lib/pdf-ocr/pdf/seinoTariffParser";
import { buildPdfExtractionTransferData } from "@/lib/pdf-ocr/pdf/createTransferData";


interface FieldRegionPanelProps {
  regions: DocumentRegion[];
  activeRegionId: string | null;
  currentPage: number;
  allElements?: TextElement[];
  onAddRegion: (role: DocumentRegionRole, semanticType: string) => void;
  onSelectRegion: (regionId: string | null) => void;
  onDeleteArea: (regionId: string) => void;
  onDeleteRegion: (regionId: string) => void;
  onUpdateSemanticType: (regionId: string, semanticType: string) => void;
  onNudgeRegionBounds?: (regionId: string, deltaXpx: number, deltaYpx: number) => void;
  onReExtractRegion?: (regionId: string) => void;
  onResetRegionBounds?: (regionId: string) => void;
}

export default function FieldRegionPanel({
  regions,
  activeRegionId,
  currentPage,
  allElements = [],
  onAddRegion,
  onSelectRegion,
  onDeleteArea,
  onDeleteRegion,
  onUpdateSemanticType,
  onNudgeRegionBounds,
  onReExtractRegion,
  onResetRegionBounds,
}: FieldRegionPanelProps) {
  const [role, setRole] = useState<DocumentRegionRole>("row_header");
  const [semanticType, setSemanticType] = useState("重量");

  // データ変換、自己検収、正しさ確認、および業務ルールエンジンの状態管理
  const [conversionResults, setConversionResults] = useState<Record<string, DataConversionResult>>({});
  const [adapterResults, setAdapterResults] = useState<Record<string, SelfCheckAdapterResult>>({});
  const [correctnessResults, setCorrectnessResults] = useState<Record<string, CorrectnessAdapterResult>>({});
  const [businessRuleResults, setBusinessRuleResults] = useState<Record<string, BusinessRuleAdapterResult>>({});
  const [externalCorrectnessResults, setExternalCorrectnessResults] = useState<Record<string, ExternalCorrectnessResult>>({});
  const [sendingCorrectnessIds, setSendingCorrectnessIds] = useState<Record<string, boolean>>({});
  const [convertingRegionIds, setConvertingRegionIds] = useState<Record<string, boolean>>({});

  const handleSendCorrectnessEngine = async (regionId: string, seinoRes: any) => {
    setSendingCorrectnessIds((prev) => ({ ...prev, [regionId]: true }));
    try {
      const res = await runSeinoCorrectnessIntegrationAsync(seinoRes, currentPage, "西濃運輸運賃タリフ.pdf");
      setExternalCorrectnessResults((prev) => ({ ...prev, [regionId]: res }));
    } catch {
      // エラー時も安全表示
    } finally {
      setSendingCorrectnessIds((prev) => ({ ...prev, [regionId]: false }));
    }
  };

  const handleConvertRegionData = async (regionId: string, regionPage: number, semanticName: string, regionRole: DocumentRegionRole, regionEls: TextElement[]) => {
    setConvertingRegionIds((prev) => ({ ...prev, [regionId]: true }));
    try {
      const payload = {
        pageNumber: regionPage,
        items: regionEls.map((el, idx) => {
          const coords = el.normalizedCoordinates || el.originalCoordinates;
          return {
            id: el.id || `el-${idx}`,
            sourceText: el.text,
            coordinates: coords ? { x: coords.x, y: coords.y, width: coords.width, height: coords.height } : undefined,
            fieldName: semanticName,
            role: regionRole,
            meaning: semanticName,
            value: el.text,
          };
        }),
      };
      const res = await convertExtractedData(payload);
      setConversionResults((prev) => ({ ...prev, [regionId]: res }));
      
      // 完成版自己検収エンジン規格アダプター (COMMON_INTEGRATION_CONTRACT) の実行
      const checkAdapterRes = runPdfSelfCheckAdapter(regionEls.length, res);
      setAdapterResults((prev) => ({ ...prev, [regionId]: checkAdapterRes }));

      // 完成版正しさ確認エンジン規格アダプターの実行
      const correctnessRes = runPdfCorrectnessAdapter(regionEls.length, res);
      setCorrectnessResults((prev) => ({ ...prev, [regionId]: correctnessRes }));

      // 完成版業務ルールエンジン規格アダプターの実行
      const ruleRes = runPdfBusinessRuleAdapter(regionEls.length, res);
      setBusinessRuleResults((prev) => ({ ...prev, [regionId]: ruleRes }));
    } catch {
      // エラー発生時もUIを破壊せず安全に記録
    } finally {
      setConvertingRegionIds((prev) => ({ ...prev, [regionId]: false }));
    }
  };

  const activeRegion = regions.find((r) => r.id === activeRegionId) ?? null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const typeStr = semanticType.trim() || "未設定";
    onAddRegion(role, typeStr);
  };

  return (
    <section className={styles.fieldRegionPanel}>
      <div className={styles.fieldRegionHeader}>
        <h2>読み取り範囲の設定</h2>
        <div className={styles.activeFieldStatus}>
          現在設定中：
          {activeRegion
            ? `${DOCUMENT_REGION_ROLE_LABELS[activeRegion.role]} (${activeRegion.semanticType || "無題"})`
            : "未選択 (下のフォームから追加)"}
        </div>
      </div>

      <form className={styles.fieldRegionForm} onSubmit={handleSubmit}>
        <label className={styles.fieldRegionControl}>
          <span>① 役割</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as DocumentRegionRole)}
          >
            {(Object.keys(DOCUMENT_REGION_ROLE_LABELS) as DocumentRegionRole[]).map((r) => (
              <option key={r} value={r}>
                {DOCUMENT_REGION_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.fieldRegionControl}>
          <span>② 意味（自由入力または候補から選択）</span>
          <input
            type="text"
            list="semantic-candidates"
            value={semanticType}
            onChange={(e) => setSemanticType(e.target.value)}
            placeholder="例：重量、サイズ、地域、金額"
          />
          <datalist id="semantic-candidates">
            {COMMON_SEMANTIC_CANDIDATES.map((candidate) => (
              <option key={candidate} value={candidate} />
            ))}
          </datalist>
        </label>

        <div className={styles.semanticQuickTags}>
          {COMMON_SEMANTIC_CANDIDATES.slice(0, 6).map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={styles.quickTagBtn}
              onClick={() => setSemanticType(candidate)}
            >
              {candidate}
            </button>
          ))}
        </div>

        <button className={`${styles.btn} ${styles.btnPrimary}`} type="submit">
          + 領域設定を追加して範囲指定
        </button>
      </form>

      <div className={styles.fieldRegionList}>
        <h3>登録済み領域一覧</h3>
        {regions.length === 0 ? (
          <p className={styles.fieldRegionEmpty}>
            役割と意味を設定して「領域設定を追加」を押すと、PDF上でドラッグ選択できます。
          </p>
        ) : (
          regions.map((region) => {
            const isActive = region.id === activeRegionId;
            const hasArea = Boolean(region.bounds && (region.bounds.width > 0 || region.bounds.height > 0));
            const isCurrentPage = region.page === currentPage;

            // ズレ量計算
            const orig = region.originalBounds || region.bounds;
            const actual = region.actualBounds || region.bounds;
            const offsetXpx = orig && actual ? Math.round((actual.x - orig.x) * 800) : 0;
            const offsetYpx = orig && actual ? Math.round((actual.y - orig.y) * 1100) : 0;

            // POINT C-1: X座標による列グループ化の計算
            const regionEls = (region.textElementIds || [])
              .map((id) => allElements.find((e) => e.id === id))
              .filter(Boolean) as TextElement[];
            const columnGroupingRes = regionEls.length > 0 ? groupElementsByColumnHeaders(regionEls) : null;
            // POINT C-2: Y座標による行グループ化の計算
            const rowGroupingRes = regionEls.length > 0 ? groupElementsByRowHeaders(regionEls) : null;
            // 西濃タリフ 【重量 × 距離 = 運賃】 最小マッピング構造化の計算
            const tariffMatrixRes = regionEls.length > 0 ? buildTariffMatrix(regionEls) : null;
            // 西濃タリフ 【重量 × 距離 × 複数地域 = 運賃】 構造化データ出力の計算
            const seinoStructRes = regionEls.length > 0 ? parseSeinoTariffStructure(regionEls) : null;

            return (
              <div
                key={region.id}
                className={`${styles.fieldRegionItem} ${isActive ? styles.activeFieldRegionItem : ""}`}
              >
                <button
                  type="button"
                  className={styles.fieldRegionSelect}
                  onClick={() => onSelectRegion(region.id)}
                >
                  <span
                    className={styles.fieldRegionColor}
                    style={{ backgroundColor: region.color }}
                    aria-hidden="true"
                  />
                  <span className={styles.fieldRegionName}>
                    {DOCUMENT_REGION_ROLE_LABELS[region.role]}
                  </span>
                  <span className={styles.fieldRegionType}>
                    【意味】{region.semanticType}
                  </span>
                </button>

                <div className={styles.fieldRegionMeta}>
                  {hasArea ? (
                    <div>
                      <span className={styles.statusBadgeSuccess}>
                        範囲設定済 ({isCurrentPage ? "表示中" : `${region.page}P`})
                      </span>
                      {region.sourceText && (
                        <div className={styles.sourceTextSnippet} style={{ maxHeight: "120px", overflowY: "auto", whiteSpace: "pre-wrap" }}>
                          <strong>取得文字列:</strong> {region.sourceText}
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "4px" }}>
                            文字要素: {region.elementCount ?? region.textElementIds?.length ?? "?"}件 | 文字数: {region.textLength ?? region.sourceText.length}文字
                          </div>
                        </div>
                      )}

                      {/* 【純粋PDF読取出力】 運賃計算・タリフ判定・推測演算を行わない次アプリ引き渡し用データ */}
                      {hasArea && (
                        <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "4px" }}>
                          {/* 📤 【次アプリ引き渡しデータ】 追跡可能フォーマット */}
                          <div style={{ marginBottom: "6px", padding: "6px", backgroundColor: "#ffffff", border: "1px solid #94a3b8", borderRadius: "4px", fontSize: "0.75rem" }}>
                            <div style={{ fontWeight: "bold", color: "#0f172a", marginBottom: "3px", fontSize: "0.78rem" }}>
                              📤 【次アプリ引き渡しデータ】 追跡可能フォーマット
                            </div>
                            <div style={{ color: "#475569", fontSize: "0.72rem", marginBottom: "4px" }}>
                              ※計算・推測演算を行わず、PDFから読み取った文字・座標・位置関係を保持
                            </div>
                            {(() => {
                              const transferData = buildPdfExtractionTransferData("doc-1", "PDFファイル", region.page, [region], allElements);
                              return (
                                <div>
                                  <div style={{ fontSize: "0.72rem", color: "#334155", marginBottom: "4px", backgroundColor: "#f1f5f9", padding: "4px 6px", borderRadius: "3px" }}>
                                    <strong>抽出件数:</strong> {transferData.items.length}件 | <strong>項目名:</strong> {region.semanticType} | <strong>役割:</strong> {DOCUMENT_REGION_ROLE_LABELS[region.role]}
                                  </div>
                                  <details open style={{ marginTop: "4px" }}>
                                    <summary style={{ cursor: "pointer", color: "#0284c7", fontWeight: "bold", fontSize: "0.74rem" }}>
                                      📋 次アプリ渡しの抽出JSON構造項目を表示 ({transferData.items.length}件)
                                    </summary>
                                    <pre style={{ backgroundColor: "#0f172a", color: "#38bdf8", padding: "6px", borderRadius: "4px", fontSize: "0.68rem", maxHeight: "160px", overflowY: "auto", marginTop: "4px", whiteSpace: "pre-wrap" }}>
                                      {JSON.stringify(transferData.items, null, 2)}
                                    </pre>
                                  </details>
                                </div>
                              );
                            })()}
                          </div>

                          {/* 5. 正しさ確認エンジン 評価結果 (「PDFから文字を正しく読めたか」のみを確認する目的で使用) */}
                          {(() => {
                            const realResult = externalCorrectnessResults[region.id];
                            const isSending = sendingCorrectnessIds[region.id];

                            if (!realResult) {
                              return (
                                <div style={{ marginTop: "6px", backgroundColor: "#ffffff", padding: "6px 8px", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.75rem" }}>
                                  <div style={{ fontWeight: "bold", color: "#475569", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>🔍 【正しさ確認】 未実行</span>
                                    <button
                                      type="button"
                                      onClick={() => handleSendCorrectnessEngine(region.id, seinoStructRes || { success: true })}
                                      disabled={isSending}
                                      style={{
                                        padding: "3px 8px",
                                        fontSize: "0.72rem",
                                        backgroundColor: isSending ? "#94a3b8" : "#0284c7",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "3px",
                                        cursor: isSending ? "not-allowed" : "pointer",
                                        fontWeight: "bold",
                                      }}
                                    >
                                      {isSending ? "検証中..." : "🚀 正しさ確認エンジンで読取検証"}
                                    </button>
                                  </div>
                                </div>
                              );
                            }

                            if (!realResult.success) {
                              return (
                                <div style={{ marginTop: "6px", backgroundColor: "#fef2f2", padding: "6px 8px", border: "1px solid #fca5a5", borderRadius: "4px", fontSize: "0.75rem" }}>
                                  <div style={{ fontWeight: "bold", color: "#991b1b", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                    <span>❌ 【正しさ確認】 接続失敗</span>
                                    <button
                                      type="button"
                                      onClick={() => handleSendCorrectnessEngine(region.id, seinoStructRes || { success: true })}
                                      disabled={isSending}
                                      style={{
                                        padding: "2px 8px",
                                        fontSize: "0.72rem",
                                        backgroundColor: isSending ? "#94a3b8" : "#dc2626",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "3px",
                                        cursor: isSending ? "not-allowed" : "pointer",
                                      }}
                                    >
                                      {isSending ? "再送信中..." : "🔄 再接続"}
                                    </button>
                                  </div>
                                  <div style={{ marginTop: "2px", color: "#b91c1c", fontSize: "0.72rem" }}>
                                    {realResult.summaryText}
                                  </div>
                                </div>
                              );
                            }

                            const isPass = realResult.overallStatusLabel === "正常";
                            return (
                              <div style={{ marginTop: "6px", backgroundColor: isPass ? "#f0fdf4" : "#fffbe6", padding: "6px 8px", border: `1px solid ${isPass ? "#86efac" : "#ffe58f"}`, borderRadius: "4px", fontSize: "0.75rem" }}>
                                <div style={{ fontWeight: "bold", color: isPass ? "#166534" : "#d48806", fontSize: "0.78rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                  <span>✅ 【正しさ確認】 {realResult.overallStatusLabel} (文字読取検証済)</span>
                                  <button
                                    type="button"
                                    onClick={() => handleSendCorrectnessEngine(region.id, seinoStructRes || { success: true })}
                                    disabled={isSending}
                                    style={{
                                      padding: "2px 6px",
                                      fontSize: "0.72rem",
                                      backgroundColor: isSending ? "#94a3b8" : "#0284c7",
                                      color: "#ffffff",
                                      border: "none",
                                      borderRadius: "3px",
                                      cursor: isSending ? "not-allowed" : "pointer",
                                    }}
                                  >
                                    {isSending ? "検証中..." : "🔄 再検証"}
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}


                      {/* 🛠️ 開発者ツール (非表示アコーディオン: 共通契約規格自己検収詳細, C-1, C-2 診断情報 ＆ 読取位置調整) */}
                      {hasArea && (
                        <details style={{ marginTop: "10px", border: "1px solid #cbd5e1", borderRadius: "4px", backgroundColor: "#f8fafc", padding: "6px" }}>
                          <summary style={{ cursor: "pointer", fontSize: "0.78rem", fontWeight: "bold", color: "#475569" }}>
                            🛠️ 開発者ツール（共通検収契約規格詳細・C-1/C-2構造診断・位置微調整）
                          </summary>

                          {/* 共通接続規格 (COMMON_INTEGRATION_CONTRACT) の全テスト結果テーブル */}
                          {adapterResults[region.id] && (
                            <div style={{ marginTop: "6px", padding: "6px", backgroundColor: "#ffffff", border: "1px solid #bae6fd", borderRadius: "4px" }}>
                              <div style={{ fontSize: "0.78rem", fontWeight: "bold", color: "#0369a1", marginBottom: "4px" }}>
                                📋 【完成版自己検収規格 (COMMON_INTEGRATION_CONTRACT release-v1.0.0)】
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "#475569", marginBottom: "4px" }}>
                                runId: <code>{adapterResults[region.id].commonResult.runId}</code> | appId: <code>{adapterResults[region.id].commonResult.appId}</code> | overallSuccess: <strong style={{ color: adapterResults[region.id].commonResult.overallSuccess ? "#15803d" : "#b91c1c" }}>{String(adapterResults[region.id].commonResult.overallSuccess)}</strong>
                              </div>
                              <table style={{ width: "100%", fontSize: "0.7rem", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr style={{ backgroundColor: "#f1f5f9", textAlign: "left" }}>
                                    <th style={{ padding: "2px 4px" }}>テストNo</th>
                                    <th style={{ padding: "2px 4px" }}>項目名</th>
                                    <th style={{ padding: "2px 4px" }}>checkType</th>
                                    <th style={{ padding: "2px 4px" }}>actualBiz</th>
                                    <th style={{ padding: "2px 4px" }}>metaStatus</th>
                                    <th style={{ padding: "2px 4px" }}>理由</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {adapterResults[region.id].commonResult.testResults.map((tr) => (
                                    <tr key={tr.testNo} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                      <td style={{ padding: "2px 4px", fontFamily: "monospace" }}>{tr.testNo}</td>
                                      <td style={{ padding: "2px 4px" }}>{tr.testName}</td>
                                      <td style={{ padding: "2px 4px", fontFamily: "monospace", color: "#2563eb" }}>{tr.checkType}</td>
                                      <td style={{ padding: "2px 4px", fontWeight: "bold", color: tr.actualBiz === "PASS" ? "#15803d" : tr.actualBiz === "WARNING" ? "#b45309" : "#b91c1c" }}>{tr.actualBiz}</td>
                                      <td style={{ padding: "2px 4px", fontWeight: "bold", color: tr.metaStatus === "PASS" ? "#15803d" : "#b91c1c" }}>{tr.metaStatus}</td>
                                      <td style={{ padding: "2px 4px", color: "#64748b" }}>{tr.reasonShort}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* POINT C-1: X座標による列グループ結果プレビュー */}
                          {columnGroupingRes && columnGroupingRes.columnGroups.length > 0 && (
                            <div style={{ marginTop: "8px", padding: "6px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "4px" }}>
                              <div style={{ fontSize: "0.78rem", fontWeight: "bold", color: "#0f172a", marginBottom: "4px" }}>
                                【POINT C-1 列グループ確認】
                              </div>
                              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                {columnGroupingRes.columnGroups.map((group) => (
                                  <div key={group.groupId} style={{ flex: "1 1 100px", minWidth: "90px", backgroundColor: "#f8fafc", padding: "4px", border: "1px solid #e2e8f0", borderRadius: "3px" }}>
                                    <div style={{ fontWeight: "bold", fontSize: "0.78rem", color: "#2563eb", borderBottom: "1px solid #e2e8f0", paddingBottom: "2px", marginBottom: "3px" }}>
                                      {group.headerText} ({group.elements.length}件)
                                    </div>
                                    <ul style={{ margin: 0, paddingLeft: "14px", fontSize: "0.75rem", color: "#334155" }}>
                                      {group.elements.map((el) => (
                                        <li key={el.id}>{el.text}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* POINT C-2: Y座標による行グループ結果プレビュー ＆ 原因診断確認 */}
                          {rowGroupingRes && (
                            <div style={{ marginTop: "8px", padding: "6px", backgroundColor: "#ffffff", border: "1px solid #86efac", borderRadius: "4px" }}>
                              <div style={{ fontSize: "0.78rem", fontWeight: "bold", color: "#166534", marginBottom: "4px" }}>
                                【POINT C-2 行グループ確認】 (認識数: {rowGroupingRes.rowGroups.length}行)
                              </div>

                              {rowGroupingRes.rowGroups.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "6px" }}>
                                  {rowGroupingRes.rowGroups.map((group) => (
                                    <div key={group.groupId} style={{ backgroundColor: "#f0fdf4", padding: "3px 6px", border: "1px solid #bbf7d0", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                      <span style={{ fontWeight: "bold", fontSize: "0.78rem", color: "#15803d" }}>
                                        {group.headerText}
                                      </span>
                                      <span style={{ fontSize: "0.72rem", color: "#4b5563" }}>
                                        要素: {group.elements.map((e) => e.text).join(", ")} ({group.elements.length}件)
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* 診断情報テーブル */}
                              {rowGroupingRes.diagnostics && (
                                <div style={{ marginTop: "4px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px", padding: "4px" }}>
                                  <div style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#0f172a", marginBottom: "3px" }}>
                                    🔍 【POINT C-2 判定確認】 （全要素: {rowGroupingRes.diagnostics.totalElementCount} / 候補: {rowGroupingRes.diagnostics.candidateCount} / 採用: {rowGroupingRes.diagnostics.adoptedHeaderCount}）
                                  </div>
                                  <table style={{ width: "100%", fontSize: "0.7rem", borderCollapse: "collapse" }}>
                                    <thead>
                                      <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #cbd5e1", textAlign: "left" }}>
                                        <th style={{ padding: "2px 3px" }}>rawText</th>
                                        <th style={{ padding: "2px 3px" }}>trimmed</th>
                                        <th style={{ padding: "2px 3px" }}>候補</th>
                                        <th style={{ padding: "2px 3px" }}>数値</th>
                                        <th style={{ padding: "2px 3px" }}>centerY</th>
                                        <th style={{ padding: "2px 3px" }}>採用</th>
                                        <th style={{ padding: "2px 3px" }}>理由</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {rowGroupingRes.diagnostics.items.map((item) => (
                                        <tr key={item.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                          <td style={{ padding: "2px 3px", fontFamily: "monospace" }}>{`"${item.rawText}"`}</td>
                                          <td style={{ padding: "2px 3px", fontFamily: "monospace" }}>{`"${item.trimmedText}"`}</td>
                                          <td style={{ padding: "2px 3px", fontWeight: "bold", color: item.candidate ? "#166534" : "#dc2626" }}>
                                            {item.candidate ? "YES" : "NO"}
                                          </td>
                                          <td style={{ padding: "2px 3px" }}>{item.parsedNumber ?? "-"}</td>
                                          <td style={{ padding: "2px 3px" }}>{item.centerY.toFixed(4)}</td>
                                          <td style={{ padding: "2px 3px", fontWeight: "bold", color: item.selectedAsRowHeader ? "#2563eb" : "#64748b" }}>
                                            {item.selectedAsRowHeader ? "YES" : "NO"}
                                          </td>
                                          <td style={{ padding: "2px 3px", color: "#475569" }}>{item.reason}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}

                          {/* POINT B3 読取位置の調整コントロールパネル */}
                          <div style={{ marginTop: "8px", padding: "6px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px" }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: "bold", color: "#334155", marginBottom: "2px" }}>
                              読取位置の調整
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#475569", marginBottom: "4px" }}>
                              横: {offsetXpx >= 0 ? `+${offsetXpx}` : offsetXpx}px &nbsp;|&nbsp; 縦: {offsetYpx >= 0 ? `+${offsetYpx}` : offsetYpx}px
                            </div>

                            <div style={{ display: "flex", gap: "3px", alignItems: "center", marginBottom: "4px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "0.72rem", color: "#64748b", marginRight: "2px" }}>微調整:</span>
                              <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, 0, -2)} style={{ padding: "2px 5px", fontSize: "0.72rem" }}>↑</button>
                              <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, 0, 2)} style={{ padding: "2px 5px", fontSize: "0.72rem" }}>↓</button>
                              <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, -2, 0)} style={{ padding: "2px 5px", fontSize: "0.72rem" }}>←</button>
                              <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, 2, 0)} style={{ padding: "2px 5px", fontSize: "0.72rem" }}>→</button>
                              <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, 0, -10)} style={{ padding: "2px 4px", fontSize: "0.7rem", marginLeft: "3px" }}>↑ 10px</button>
                              <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, 0, 10)} style={{ padding: "2px 4px", fontSize: "0.7rem" }}>↓ 10px</button>
                            </div>

                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "3px" }}>
                              <button
                                type="button"
                                className={`${styles.btn} ${styles.btnPrimary}`}
                                onClick={() => onReExtractRegion?.(region.id)}
                                style={{ padding: "3px 6px", fontSize: "0.75rem" }}
                              >
                                この位置で再読み取り
                              </button>
                              <button
                                type="button"
                                className={styles.btn}
                                onClick={() => onResetRegionBounds?.(region.id)}
                                style={{ padding: "3px 6px", fontSize: "0.75rem" }}
                              >
                                指定位置に戻す
                              </button>
                            </div>
                          </div>
                        </details>
                      )}
                    </div>
                  ) : (
                    <span className={styles.statusBadgePending}>範囲未指定 (PDF上をドラッグしてください)</span>
                  )}
                </div>

                {/* POINT B3 読取位置の調整コントロールパネル */}
                {hasArea && (
                  <div style={{ marginTop: "10px", padding: "8px", backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "4px" }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: "bold", color: "#334155", marginBottom: "3px" }}>
                      読取位置の調整
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "#475569", marginBottom: "6px" }}>
                      横: {offsetXpx >= 0 ? `+${offsetXpx}` : offsetXpx}px &nbsp;|&nbsp; 縦: {offsetYpx >= 0 ? `+${offsetYpx}` : offsetYpx}px
                    </div>

                    <div style={{ display: "flex", gap: "3px", alignItems: "center", marginBottom: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.75rem", color: "#64748b", marginRight: "3px" }}>微調整:</span>
                      <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, 0, -2)} style={{ padding: "2px 6px", fontSize: "0.75rem" }}>↑</button>
                      <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, 0, 2)} style={{ padding: "2px 6px", fontSize: "0.75rem" }}>↓</button>
                      <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, -2, 0)} style={{ padding: "2px 6px", fontSize: "0.75rem" }}>←</button>
                      <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, 2, 0)} style={{ padding: "2px 6px", fontSize: "0.75rem" }}>→</button>
                      <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, 0, -10)} style={{ padding: "2px 5px", fontSize: "0.72rem", marginLeft: "4px" }}>↑ 10px</button>
                      <button type="button" className={styles.btn} onClick={() => onNudgeRegionBounds?.(region.id, 0, 10)} style={{ padding: "2px 5px", fontSize: "0.72rem" }}>↓ 10px</button>
                    </div>

                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={() => onReExtractRegion?.(region.id)}
                        style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                      >
                        この位置で再読み取り
                      </button>
                      <button
                        type="button"
                        className={styles.btn}
                        onClick={() => onResetRegionBounds?.(region.id)}
                        style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                      >
                        指定位置に戻す
                      </button>
                    </div>
                  </div>
                )}

                <div className={styles.fieldRegionControl} style={{ marginTop: "8px" }}>
                  <span>意味の変更:</span>
                  <input
                    type="text"
                    value={region.semanticType}
                    onChange={(e) => onUpdateSemanticType(region.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div className={styles.fieldRegionActions}>
                  <button className={styles.btn} type="button" onClick={() => onSelectRegion(region.id)}>
                    範囲再設定
                  </button>
                  <button
                    className={styles.btn}
                    type="button"
                    onClick={() => onDeleteArea(region.id)}
                    disabled={!hasArea}
                  >
                    範囲削除
                  </button>
                  <button className={styles.btn} type="button" onClick={() => onDeleteRegion(region.id)}>
                    削除
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {activeRegionId && (
        <button className={styles.btn} type="button" onClick={() => onSelectRegion(null)} style={{ marginTop: "12px" }}>
          選択解除
        </button>
      )}
    </section>
  );
}


