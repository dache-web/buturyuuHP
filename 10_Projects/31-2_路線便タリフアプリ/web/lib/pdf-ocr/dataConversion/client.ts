import { DataConversionInputPayload, DataConversionResult } from "./types";

/**
 * PDF抽出データをデータ変換エンジン（中継API / GASルール適用）へ送信して変換結果を取得するクライアント関数
 */
export async function convertExtractedData(
  payload: DataConversionInputPayload
): Promise<DataConversionResult> {
  const timestamp = new Date().toISOString();

  if (!payload || !payload.items || payload.items.length === 0) {
    return {
      success: true,
      conversionModeLabel: "簡易変換（管理ルール取得失敗）",
      rulesCount: 0,
      fieldsCount: 0,
      settingsLoaded: false,
      inputCount: 0,
      convertedCount: 0,
      items: [],
      timestamp,
    };
  }

  try {
    const response = await fetch("/api/data-conversion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText || "変換APIエラー"}`);
    }

    const data: DataConversionResult = await response.json();
    return data;
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : "データ変換API接続エラー";
    return {
      success: false,
      conversionModeLabel: "簡易変換（管理ルール取得失敗）",
      rulesCount: 0,
      fieldsCount: 0,
      settingsLoaded: false,
      inputCount: payload.items.length,
      convertedCount: payload.items.length,
      items: payload.items.map((item, index) => ({
        id: item.id || `item-${index}`,
        sourceText: item.sourceText,
        convertedValue: item.value || item.sourceText.trim().replace(/,/g, ""),
        fieldName: item.fieldName,
        meaning: item.meaning,
        status: "warning",
        note: `変換API接続エラー: ${errMessage}`,
      })),
      error: errMessage,
      timestamp,
    };
  }
}

