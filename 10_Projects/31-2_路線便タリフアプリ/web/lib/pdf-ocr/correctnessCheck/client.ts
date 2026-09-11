import { PdfConnectorPayload, ExternalCorrectnessResult } from "./contract";

export async function sendToExternalCorrectnessEngine(
  payload: PdfConnectorPayload
): Promise<ExternalCorrectnessResult> {
  try {
    const res = await fetch("/api/correctness-check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload }),
    });

    if (!res.ok) {
      return {
        success: false,
        overallStatusLabel: "エラー",
        summaryText: `サーバー通信エラー (HTTP ${res.status})`,
        importedCount: 0,
        errorCount: payload.records.length,
        details: [],
      };
    }

    const data = await res.json();

    if (!data.success) {
      return {
        success: false,
        overallStatusLabel: "エラー",
        summaryText: data.error || "正しさ確認エンジンへの接続を確認できませんでした。",
        importedCount: 0,
        errorCount: payload.records.length,
        details: [],
      };
    }

    // 本物の GAS レスポンス data.data ({ importResult, batchResult }) の受取・解析
    const gasData = data.data || {};
    const importRes = gasData.importResult || {};
    const batchRes = gasData.batchResult || {};

    const imported = importRes.imported ?? payload.records.length;
    const errors = importRes.errors ?? 0;
    const isSuccess = errors === 0;

    return {
      success: true,
      overallStatusLabel: isSuccess ? "正常" : "確認が必要",
      summaryText: `【正式確認完了】登録: ${imported}件 | エラー: ${errors}件 | バッチ実行: ${batchRes.runId || "完了"}`,
      importedCount: imported,
      errorCount: errors,
      details: payload.records.map((r) => ({
        itemName: r.itemName,
        valueType: r.valueType,
        rawText: r.rawText,
        extractedValue: r.extractedValue,
        status: (r.conditionsComplete !== false && !r.readingUncertain) ? "正常" : "確認が必要",
        message: (r.conditionsComplete !== false && !r.readingUncertain)
          ? "正しさ確認エンジンにて確認済み"
          : "確認必要項目が検出されました。",
        page: r.page,
      })),
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "通信エラーが発生しました。";
    return {
      success: false,
      overallStatusLabel: "エラー",
      summaryText: `【通信失敗】${errMsg}`,
      importedCount: 0,
      errorCount: payload.records.length,
      details: [],
    };
  }
}

