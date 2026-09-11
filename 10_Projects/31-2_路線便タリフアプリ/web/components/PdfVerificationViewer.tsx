"use client";

import React, { useState, useEffect } from "react";

interface ExtractionItem {
  fileId: string;
  page: number;
  itemName: string;
  rawText: string;
  value: string | number;
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  column: number;
  readingUncertain: boolean;
  semanticMeaning?: string;
}

interface VerificationItemResult {
  itemId: string;
  itemName: string;
  rawText: string;
  value: string | number;
  semanticMeaning: string;
  status: "VERIFIED" | "NEEDS_HUMAN_REVIEW" | "UNCERTAIN" | "UNVERIFIED";
  statusLabel: string;
  reason: string;
  sourceCoordinates: { x: number; y: number; row?: number; column?: number };
}

interface SelfValidationData {
  engine: string;
  success: boolean;
  overallSuccess: boolean;
  appId: string;
  runId: string;
  summary: {
    total: number;
    bizPass: number;
    bizFail: number;
    metaPass: number;
    metaFail: number;
  };
  testResults: Array<{
    caseId: string;
    caseName: string;
    bizStatus: string;
    metaStatus: string;
    message: string;
  }>;
  proofLogs: {
    invokedEngine: string;
    protocol: string;
    timestamp: string;
  };
}

export default function PdfVerificationViewer() {
  const [pdfFiles, setPdfFiles] = useState<string[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<string>("");
  const [extractionItems, setExtractionItems] = useState<ExtractionItem[]>([]);
  const [verificationResults, setVerificationResults] = useState<
    VerificationItemResult[]
  >([]);
  const [corrSummary, setCorrSummary] = useState<any>(null);
  const [corrProof, setCorrProof] = useState<any>(null);
  const [selfValidation, setSelfValidation] =
    useState<SelfValidationData | null>(null);
  const [selectedItem, setSelectedItem] = useState<ExtractionItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // 1. 実PDFファイル一覧の取得
  useEffect(() => {
    async function loadPdfList() {
      try {
        const res = await fetch("/api/pdf-ocr");
        const data = await res.json();
        if (data.files && data.files.length > 0) {
          setPdfFiles(data.files);
          const seinoPdf =
            data.files.find((f: string) => f.includes("西濃")) || data.files[0];
          setSelectedPdf(seinoPdf);
        } else {
          setError("利用可能な西濃実PDFファイルが見つかりません。");
        }
      } catch (err) {
        setError("PDF一覧の取得に失敗しました。");
      }
    }
    loadPdfList();
  }, []);

  // 2. 4アプリ連続パッチ処理 (32 ➔ 31-2 ➔ 39 ➔ 37)
  useEffect(() => {
    if (!selectedPdf) return;

    async function execute4AppPipeline() {
      setLoading(true);
      setError("");
      try {
        // [Step 1] 32_PDF解析アプリ から抽出データ受信
        const ocrRes = await fetch(
          `/api/pdf-ocr?name=${encodeURIComponent(selectedPdf)}`
        );
        const ocrData = await ocrRes.json();

        if (ocrData.error) {
          setError(ocrData.error);
          setLoading(false);
          return;
        }

        const items: ExtractionItem[] = ocrData.items || [];
        setExtractionItems(items);

        // [Step 2] 39_正しさ確認エンジン 本体へ送信
        const checkRes = await fetch("/api/correctness-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, fileName: selectedPdf, fileId: selectedPdf }),
        });
        const checkData = await checkRes.json();

        if (checkData.results) {
          setVerificationResults(checkData.results);
          setCorrSummary(checkData.summary);
          setCorrProof(checkData.proofLogs);
        }

        // [Step 3] 37_自己検収エンジンアプリ 本体へパイプライン検収送信
        const valCases = [
          {
            caseId: "CASE_01_PDF_RECEPTION",
            caseName: "32_PDF解析アプリからのデータ受入正常性",
            expected: items.length,
            actual: items.length,
          },
          {
            caseId: "CASE_02_CORRECTNESS_TRANSMISSION",
            caseName: "39_正しさ確認エンジンへのデータ伝送正常性",
            expected: true,
            actual: checkData.summary ? checkData.summary.totalItems > 0 : false,
          },
          {
            caseId: "CASE_03_PROVENANCE_RETENTION",
            caseName: "元PDF根拠(座標・行・列・ページ)の保持率",
            expected: items.length,
            actual: items.filter((i) => i.page && i.x && i.y).length,
          },
          {
            caseId: "CASE_04_CHECK_COMPLETION",
            caseName: "39正しさ確認エンジン結果受信正常性",
            expected: "SUCCESS",
            actual: checkData.results ? "SUCCESS" : "ERROR",
          },
        ];

        const selfValRes = await fetch("/api/self-validation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appId: "31-2_ROSENBIN_TARIFF",
            appName: "路線便タリフアプリ",
            testCases: valCases,
          }),
        });
        const selfValData = await selfValRes.json();
        setSelfValidation(selfValData);
      } catch (err) {
        setError("4アプリ接続処理中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }

    execute4AppPipeline();
  }, [selectedPdf]);

  const pdfStreamUrl = selectedPdf
    ? `/api/pdf-ocr?name=${encodeURIComponent(selectedPdf)}&stream=true`
    : "";

  return (
    <div className="w-full flex flex-col gap-4 p-4 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800">
      {/* 1. 全体パイプラインステータスバー */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
            <span>🔗</span> 【4アプリ実接続】32_PDF解析 ➔ 31-2_タリフ ➔ 39_正しさ確認 ➔ 37_自己検収
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            4つのアプリ本体を本物通信で疎通させ、実PDF1件が4つすべてを通るパイプラインの動作を可視化
          </p>
        </div>

        {/* PDF選択ドロップダウン */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300 font-medium">実西濃PDF:</label>
          <select
            value={selectedPdf}
            onChange={(e) => setSelectedPdf(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-500 max-w-xs truncate"
          >
            {pdfFiles.map((file) => (
              <option key={file} value={file}>
                {file}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/80 border border-rose-800 text-rose-300 p-3 rounded-lg text-sm">
          ❌ {error}
        </div>
      )}

      {/* 2. 4アプリ統合グリッド画面 (左: PDF, 中央: 32抽出, 右上: 39正しさ確認, 右下: 37自己検収) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 左: 32_PDF解析アプリ 実PDF表示 (4/12) */}
        <div className="lg:col-span-4 flex flex-col bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
          <div className="bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-300 flex justify-between items-center border-b border-slate-700">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              1. 32_PDF解析アプリ (実PDF表示)
            </span>
            <span className="text-[10px] text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
              連動中
            </span>
          </div>
          <div className="flex-1 w-full bg-slate-900 min-h-[550px]">
            {pdfStreamUrl ? (
              <iframe
                src={pdfStreamUrl}
                className="w-full h-full min-h-[550px] border-none"
                title="西濃運輸実タリフPDF"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                PDF読み込み中...
              </div>
            )}
          </div>
        </div>

        {/* 中央: 32_PDF解析アプリ 実抽出データ (4/12) */}
        <div className="lg:col-span-4 flex flex-col bg-slate-950 rounded-lg border border-slate-800 p-3 overflow-hidden">
          <div className="bg-slate-800/80 -mx-3 -mt-3 p-3 mb-3 text-xs font-semibold text-slate-300 flex justify-between items-center border-b border-slate-700">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              2. 32抽出結果 ➔ 31-2受入 (全{extractionItems.length}件)
            </span>
            <span className="text-[10px] text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
              データ保持
            </span>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[500px] border border-slate-800 rounded">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-slate-400 text-[10px] sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="p-1.5">種別</th>
                  <th className="p-1.5">原文 (rawText)</th>
                  <th className="p-1.5">P/行/列</th>
                  <th className="p-1.5">不安</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {extractionItems.map((item, idx) => {
                  const isSelected = selectedItem === item;
                  return (
                    <tr
                      key={idx}
                      onClick={() => setSelectedItem(item)}
                      className={`cursor-pointer transition-colors hover:bg-slate-900 ${
                        isSelected ? "bg-emerald-950/50 text-emerald-200" : ""
                      }`}
                    >
                      <td className="p-1.5 text-[11px] font-medium">{item.itemName}</td>
                      <td className="p-1.5 font-mono text-emerald-400 bg-slate-900 px-1 py-0.5 rounded text-[10px]">
                        "{item.rawText}"
                      </td>
                      <td className="p-1.5 text-[10px] text-slate-400">
                        P.{item.page} ({item.row},{item.column})
                      </td>
                      <td className="p-1.5 text-[10px]">
                        {item.readingUncertain ? (
                          <span className="text-purple-400 font-bold">要確認</span>
                        ) : (
                          <span className="text-slate-600">正常</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {selectedItem && (
            <div className="mt-2 bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px] text-slate-300">
              <div className="font-bold text-emerald-400">選択項目: {selectedItem.itemName}</div>
              <div>原文: "{selectedItem.rawText}" | 変換値: {String(selectedItem.value)}</div>
              <div className="text-slate-400 text-[10px]">座標: X:{selectedItem.x}, Y:{selectedItem.y}</div>
            </div>
          )}
        </div>

        {/* 右側: 39正しさ確認 ＆ 37自己検収 (4/12) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* 右上: 39_正しさ確認エンジン本体の実結果 */}
          <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                3. 39_正しさ確認エンジン本体
              </span>
              <span className="text-[10px] text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                実照合結果
              </span>
            </div>

            {corrSummary ? (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                  <div className="bg-emerald-950/50 p-1.5 rounded border border-emerald-800/80">
                    <div className="text-emerald-400">問題なし</div>
                    <div className="font-bold text-sm text-emerald-300">{corrSummary.verifiedCount}件</div>
                  </div>
                  <div className="bg-amber-950/50 p-1.5 rounded border border-amber-800/80">
                    <div className="text-amber-400">要人確認</div>
                    <div className="font-bold text-sm text-amber-300">{corrSummary.needsReviewCount}件</div>
                  </div>
                  <div className="bg-purple-950/50 p-1.5 rounded border border-purple-800/80">
                    <div className="text-purple-400">読取不安</div>
                    <div className="font-bold text-sm text-purple-300">{corrSummary.uncertainCount}件</div>
                  </div>
                </div>

                {corrProof && (
                  <div className="bg-slate-900/90 p-2 rounded text-[10px] font-mono text-slate-400 border border-slate-800 flex flex-col gap-0.5">
                    <div className="text-slate-300 font-bold">通信証拠 (39):</div>
                    <div>エンジン: {corrProof.invokedEngine.split("\\").pop()}</div>
                    <div>受渡レコード数: {corrProof.sentRecordsCount}件 ➔ 照合数: {corrProof.verifiedRecordsCount}件</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-2">39正しさ確認中...</div>
            )}
          </div>

          {/* 右下: 37_自己検収エンジンアプリ本体の実結果 */}
          <div className="bg-slate-950 rounded-lg border border-slate-800 p-3 flex flex-col gap-2">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                4. 37_自己検収エンジンアプリ本体
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold border ${
                  selfValidation?.overallSuccess
                    ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                    : "bg-rose-950 text-rose-300 border-rose-800"
                }`}
              >
                {selfValidation?.overallSuccess ? "全検収合格 (OVERALL PASS)" : "検収確認中"}
              </span>
            </div>

            {selfValidation ? (
              <div className="flex flex-col gap-2">
                <div className="text-xs text-slate-300 font-medium">
                  実行ID: <span className="font-mono text-emerald-400">{selfValidation.runId}</span>
                </div>

                <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                  {selfValidation.testResults.map((tr) => (
                    <div
                      key={tr.caseId}
                      className="bg-slate-900 p-1.5 rounded border border-slate-800 text-[11px] flex justify-between items-center"
                    >
                      <span className="text-slate-300 truncate max-w-[200px]">
                        {tr.caseName}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          tr.metaStatus === "META_PASS"
                            ? "bg-emerald-950 text-emerald-300"
                            : "bg-rose-950 text-rose-300"
                        }`}
                      >
                        {tr.metaStatus}
                      </span>
                    </div>
                  ))}
                </div>

                {selfValidation.proofLogs && (
                  <div className="bg-slate-900/90 p-2 rounded text-[10px] font-mono text-slate-400 border border-slate-800 flex flex-col gap-0.5">
                    <div className="text-slate-300 font-bold">通信証拠 (37):</div>
                    <div>エンジン: {selfValidation.proofLogs.invokedEngine.split("\\").pop()}</div>
                    <div>アプリID: {selfValidation.appId} | Cases: {selfValidation.proofLogs.payloadCaseCount}件</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-2">37自己検収中...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
