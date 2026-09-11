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

export default function PdfVerificationViewer() {
  const [pdfFiles, setPdfFiles] = useState<string[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<string>("");
  const [extractionItems, setExtractionItems] = useState<ExtractionItem[]>([]);
  const [verificationResults, setVerificationResults] = useState<
    VerificationItemResult[]
  >([]);
  const [summary, setSummary] = useState<any>(null);
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
          // 最初に見つかった実西濃PDFを選択
          const seinoPdf =
            data.files.find((f: string) => f.includes("西濃")) || data.files[0];
          setSelectedPdf(seinoPdf);
        } else {
          setError("利用可能なPDFファイルが見つかりません。");
        }
      } catch (err) {
        setError("PDF一覧の取得に失敗しました。");
      }
    }
    loadPdfList();
  }, []);

  // 2. 選択された実PDFの抽出データ取得 ＆ 正しさ確認実行
  useEffect(() => {
    if (!selectedPdf) return;

    async function processPdfAnalysis() {
      setLoading(true);
      setError("");
      try {
        // A. PDF解析アプリの抽出結果を取得
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

        // B. 39_正しさ確認エンジンへ送信して判定取得
        const checkRes = await fetch("/api/correctness-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items, fileName: selectedPdf }),
        });
        const checkData = await checkRes.json();

        if (checkData.results) {
          setVerificationResults(checkData.results);
          setSummary(checkData.summary);
        }
      } catch (err) {
        setError("正しさ確認処理中にエラーが発生しました。");
      } finally {
        setLoading(false);
      }
    }

    processPdfAnalysis();
  }, [selectedPdf]);

  const pdfStreamUrl = selectedPdf
    ? `/api/pdf-ocr?name=${encodeURIComponent(selectedPdf)}&stream=true`
    : "";

  return (
    <div className="w-full flex flex-col gap-4 p-4 bg-slate-900 text-slate-100 rounded-xl shadow-2xl border border-slate-800">
      {/* ヘッダーエリア */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
            <span>📄</span> 西濃実PDF表示 ＆ PDF解析連携・正しさ確認ビューアー
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            西濃運輸実タリフPDFとPDF解析アプリ抽出データ・39正しさ確認エンジン照合判定を同時目視確認
          </p>
        </div>

        {/* PDF選択ドロップダウン */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-300 font-medium">対象西濃PDF:</label>
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

      {/* メイングリッドエリア (左: PDFプレビュー, 右: 抽出＆正しさ確認) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[680px]">
        {/* 左側: 西濃実PDF表示パネル (5/12) */}
        <div className="lg:col-span-5 flex flex-col bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
          <div className="bg-slate-800/80 px-4 py-2 text-xs font-semibold text-slate-300 flex justify-between items-center border-b border-slate-700">
            <span>原典: {selectedPdf || "未選択"}</span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
              実資料PDF画面
            </span>
          </div>
          <div className="flex-1 w-full bg-slate-900 min-h-[500px]">
            {pdfStreamUrl ? (
              <iframe
                src={pdfStreamUrl}
                className="w-full h-full min-h-[600px] border-none"
                title="西濃運輸実タリフPDF"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                PDFを読み込み中...
              </div>
            )}
          </div>
        </div>

        {/* 右側: PDF解析結果 ＆ 正しさ確認パネル (7/12) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* 上段: サマリーカード */}
          {summary && (
            <div className="grid grid-cols-4 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 text-center">
                <div className="text-[10px] text-slate-400">総抽出数</div>
                <div className="text-lg font-bold text-slate-200">{summary.totalItems}件</div>
              </div>
              <div className="bg-emerald-950/40 p-2.5 rounded border border-emerald-800/60 text-center">
                <div className="text-[10px] text-emerald-400">問題なし</div>
                <div className="text-lg font-bold text-emerald-300">{summary.verifiedCount}件</div>
              </div>
              <div className="bg-amber-950/40 p-2.5 rounded border border-amber-800/60 text-center">
                <div className="text-[10px] text-amber-400">要確認 / 注記</div>
                <div className="text-lg font-bold text-amber-300">{summary.needsReviewCount}件</div>
              </div>
              <div className="bg-purple-950/40 p-2.5 rounded border border-purple-800/60 text-center">
                <div className="text-[10px] text-purple-400">読取不安</div>
                <div className="text-lg font-bold text-purple-300">{summary.uncertainCount}件</div>
              </div>
            </div>
          )}

          {/* 下段: PDF抽出データ ＆ 正しさ確認照合テーブル */}
          <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 p-4 flex flex-col gap-3 overflow-hidden">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>PDF解析抽出項目 ＆ 39正しさ確認エンジン照合一覧</span>
              <span className="text-[10px] text-slate-500 font-normal">
                クリックで選択表示
              </span>
            </h3>

            <div className="overflow-x-auto overflow-y-auto max-h-[460px] border border-slate-800 rounded">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-slate-400 text-[11px] sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="p-2 font-medium">項目種別</th>
                    <th className="p-2 font-medium">原文 (rawText)</th>
                    <th className="p-2 font-medium">位置 (P/行/列)</th>
                    <th className="p-2 font-medium">意味づけ分析</th>
                    <th className="p-2 font-medium">正しさ確認判定 (39)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {extractionItems.map((item, idx) => {
                    const ver = verificationResults[idx];
                    const isSelected = selectedItem === item;

                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedItem(item)}
                        className={`cursor-pointer transition-colors hover:bg-slate-900/80 ${
                          isSelected ? "bg-emerald-950/40 border-l-4 border-l-emerald-500" : ""
                        }`}
                      >
                        <td className="p-2 font-medium text-slate-200">
                          {item.itemName}
                        </td>
                        <td className="p-2 font-mono text-emerald-400 bg-slate-900/50 rounded px-1.5 py-0.5">
                          "{item.rawText}"
                        </td>
                        <td className="p-2 text-[10px] text-slate-400 whitespace-nowrap">
                          P.{item.page} (行{item.row}, 列{item.column})
                        </td>
                        <td className="p-2 text-slate-300">
                          {item.semanticMeaning}
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {ver ? (
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                ver.status === "VERIFIED"
                                  ? "bg-emerald-950 text-emerald-300 border-emerald-800"
                                  : ver.status === "NEEDS_HUMAN_REVIEW"
                                  ? "bg-amber-950 text-amber-300 border-amber-800"
                                  : "bg-purple-950 text-purple-300 border-purple-800"
                              }`}
                            >
                              {ver.statusLabel}
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">未照合</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 選択項目の詳細プレビュー */}
            {selectedItem && (
              <div className="mt-2 bg-slate-900/90 p-3 rounded border border-slate-800 text-xs flex flex-col gap-1 text-slate-300">
                <div className="font-bold text-emerald-400 flex justify-between">
                  <span>選択項目詳細: {selectedItem.itemName}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    座標: X:{selectedItem.x}, Y:{selectedItem.y}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">原文テキスト: </span>
                  <span className="font-mono text-emerald-300 font-semibold">"{selectedItem.rawText}"</span>
                  <span className="ml-3 text-slate-400">変換値: </span>
                  <span className="font-mono text-slate-200">{String(selectedItem.value)}</span>
                </div>
                <div className="text-slate-400 text-[11px]">
                  意味づけ: <span className="text-slate-200">{selectedItem.semanticMeaning}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
