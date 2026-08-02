import {
  AppSettings,
  ExtractionRule,
  ExtractionField,
  OutputSetting,
  ChoiceItem,
  GasApiResponse
} from "./types";
import {
  getSettingsUrl,
  getRulesUrl,
  getFieldsUrl,
  getOutputSettingsUrl,
  getChoicesUrl
} from "./endpoints";


function toBoolean(value: unknown): boolean {
  return (
    value === true ||
    value === "TRUE" ||
    value === "true" ||
    value === 1 ||
    value === "1"
  );
}

/**
 * GAS APIからデータを取得し、エラーハンドリングを行う共通関数
 */
async function fetchGasApi<T>(url: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // GASのCORS制約とリダイレクトに対応するためのモード
      mode: 'cors',
    });
  } catch (error) {
    throw new Error(`ネットワークエラー: ${(error as Error).message}`);
  }

  if (!response.ok) {
    throw new Error(`HTTPエラー: ${response.status}`);
  }

  let json: GasApiResponse<Record<string, unknown>>;
  try {
    json = await response.json();
  } catch {
    throw new Error("APIレスポンスのJSONパースに失敗しました。");
  }

  if (!json.success) {
    const code = json.error?.code || "UNKNOWN_ERROR";
    const msg = json.error?.message || "不明なエラー";
    throw new Error(`[${code}] ${msg}`);
  }

  return json.data as T;
}

/**
 * 基本設定を取得する
 */
export async function getSettings(): Promise<AppSettings> {
  const data = await fetchGasApi<Record<string, unknown>>(getSettingsUrl());
  return {
    appName: data["APP_NAME"] as string,
    fullTextExtraction: data["FULL_TEXT_EXTRACTION"] as boolean,
    defaultRuleId: data["DEFAULT_RULE_ID"] as string,
    outputMode: data["OUTPUT_MODE"] as string,
    ocrEnabled: data["OCR_ENABLED"] as boolean,
    schemaVersion: Number(data["SCHEMA_VERSION"])
  };
}

/**
 * ルールマスタを取得する
 */
export async function getRules(): Promise<ExtractionRule[]> {
  const data = await fetchGasApi<Record<string, unknown>[]>(getRulesUrl());
  return data.map(item => ({
    ruleId: item["ルールID"] as string,
    ruleName: item["ルール名"] as string,
    ruleCategory: item["ルール分類"] as string,
    usage: item["用途"] as string,
    outputMethod: item["出力方式"] as string,
    outputId: item["出力ID"] as string,
    isActive: toBoolean(item["有効"]),
    displayOrder: Number(item["表示順"])
  }));
}

/**
 * 指定したルールIDの項目マスタを取得する
 */
export async function getFields(ruleId: string): Promise<ExtractionField[]> {
  const data = await fetchGasApi<Record<string, unknown>[]>(getFieldsUrl(ruleId));
  return data.map(item => ({
    fieldId: item["項目ID"] as string,
    ruleId: item["ルールID"] as string,
    fieldName: item["項目名"] as string,
    description: item["項目説明"] as string,
    selectionMethod: item["選択方法"] as string,
    extractionUnit: item["抽出単位"] as string,
    allowMultiple: toBoolean(item["複数選択"]),
    joinMethod: item["結合方法"] as string,
    dataType: item["データ型"] as string,
    isRequired: toBoolean(item["必須"]),
    outputColumnName: item["出力列名"] as string,
    displayOrder: Number(item["表示順"]),
    isActive: toBoolean(item["有効"])
  }));
}

/**
 * 指定したルールIDの出力先設定を取得する
 */
export async function getOutputSettings(ruleId: string): Promise<OutputSetting> {
  const data = await fetchGasApi<Record<string, unknown>>(getOutputSettingsUrl(ruleId));
  return {
    outputId: data["出力ID"] as string,
    ruleId: data["ルールID"] as string,
    spreadsheetId: data["出力先スプレッドシートID"] as string,
    sheetName: data["出力先シート名"] as string,
    outputMethod: data["出力方式"] as string,
    headerRow: Number(data["ヘッダー行"]),
    startColumn: data["開始列"] as string,
    outputFileName: toBoolean(data["ファイル名出力"]),
    outputImportDate: toBoolean(data["取込日時出力"]),
    outputPageNumber: toBoolean(data["ページ数出力"]),
    allowOverwrite: toBoolean(data["上書き許可"]),
    isActive: toBoolean(data["有効"])
  };
}

/**
 * 選択肢マスタを取得する
 */
export async function getChoices(type: string): Promise<ChoiceItem[]> {
  const data = await fetchGasApi<Record<string, unknown>[]>(getChoicesUrl(type));
  return data.map(item => ({
    type: item["選択肢種別"] as string,
    value: item["値"] as string,
    label: item["表示名"] as string,
    displayOrder: Number(item["表示順"]),
    isActive: toBoolean(item["有効"])
  }));
}
