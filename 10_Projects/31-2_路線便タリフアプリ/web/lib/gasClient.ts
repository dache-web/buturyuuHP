import {
  companyRowSchema,
  tariffRowSchema,
  regionRowSchema,
  conditionTierRowSchema,
  fareTableRowSchema,
  ruleRowSchema,
  ruleConditionRowSchema,
  ruleActionRowSchema,
  testResultRowSchema,
} from "./schemas";
import type { GasResponse, RawSheetData } from "../types/gas";
import { z } from "zod";

const requiredHeaders = {
  "01_路線会社": ["company_id", "company_name", "status"],
  "02_タリフ基本": ["tariff_id", "company_id", "version", "start_date", "end_date", "default_rounding_rule", "vol_conversion_factor"],
  "03_地域定義": ["region_id", "tariff_id", "prefecture", "city", "area_name", "is_relay"],
  "04_条件帯定義": ["tier_id", "tariff_id", "condition_type", "min_value", "max_value"],
  "05_運賃表": ["record_id", "tariff_id", "region_from_id", "region_to_id", "tier_id", "base_amount"],
  "06_ルール基本": ["rule_id", "tariff_id", "rule_name", "group_logic", "calculation_order", "enabled"],
  "07_ルール条件": ["condition_id", "rule_id", "condition_group_id", "logic_type", "condition_target", "operator", "condition_value", "value_type"],
  "08_ルール処理": ["action_id", "rule_id", "action_type", "action_value", "calculation_target", "threshold_value", "unit_value", "unit_type"],
  "09_テスト結果": ["test_id", "tariff_id", "company_id", "test_type", "input_condition", "expected_amount", "actual_amount", "status", "error_message", "executed_at", "notes"],
} as const;

type SheetName = keyof typeof requiredHeaders;

export function mapAndValidateSheet<T>(
  sheetName: SheetName,
  raw: RawSheetData,
  schema: z.ZodType<T>
): T[] {
  const { headers, rows } = raw;
  
  const headerCount = new Map<string, number>();
  for (const h of headers) {
    headerCount.set(h, (headerCount.get(h) || 0) + 1);
  }
  const duplicates = Array.from(headerCount.entries()).filter(([, count]) => count > 1).map(([h]) => h);
  if (duplicates.length > 0) {
    throw new Error(`[${sheetName}] ヘッダーの重複があります: ${duplicates.join(", ")}`);
  }

  const reqHeaders = requiredHeaders[sheetName];
  const missingHeaders = reqHeaders.filter(h => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(`[${sheetName}] 必須ヘッダーが不足しています: ${missingHeaders.join(", ")}`);
  }

  const unknownHeaders = headers.filter(h => !(reqHeaders as readonly string[]).includes(h));
  if (unknownHeaders.length > 0) {
    console.warn(`[WARNING] [${sheetName}] 未知のヘッダーが追加されています: ${unknownHeaders.join(", ")}`);
  }

  const mapped = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, index) => {
      obj[h] = row[index];
    });
    return obj;
  });

  return mapped.map(item => schema.parse(item));
}

export async function fetchTariffData(testToken?: string, testAction?: string, testUrl?: string) {
  const url = testUrl ?? process.env.GAS_WEB_APP_URL;
  const token = testToken ?? process.env.GAS_SECRET_TOKEN;
  const action = testAction ?? "fetchData";

  if (!url) {
    throw new Error("GAS_WEB_APP_URLが設定されていません");
  }
  if (!token) {
    throw new Error("GAS_SECRET_TOKENが設定されていません");
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, token }),
    });

    if (!res.ok) {
      throw new Error(`HTTP通信エラー: ステータス ${res.status}`);
    }

    const data: GasResponse = await res.json();
    if (data.ok === false) {
      throw new Error(`GASエラー: ${data.error}`);
    }

    const d = data.data;
    const result = {
      companies: mapAndValidateSheet("01_路線会社", d["01_路線会社"], companyRowSchema),
      tariffs: mapAndValidateSheet("02_タリフ基本", d["02_タリフ基本"], tariffRowSchema),
      regions: mapAndValidateSheet("03_地域定義", d["03_地域定義"], regionRowSchema),
      conditionTiers: mapAndValidateSheet("04_条件帯定義", d["04_条件帯定義"], conditionTierRowSchema),
      fareTables: mapAndValidateSheet("05_運賃表", d["05_運賃表"], fareTableRowSchema),
      rules: mapAndValidateSheet("06_ルール基本", d["06_ルール基本"], ruleRowSchema),
      ruleConditions: mapAndValidateSheet("07_ルール条件", d["07_ルール条件"], ruleConditionRowSchema),
      ruleActions: mapAndValidateSheet("08_ルール処理", d["08_ルール処理"], ruleActionRowSchema),
      testResults: mapAndValidateSheet("09_テスト結果", d["09_テスト結果"], testResultRowSchema),
    };

    return result;
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("fetchTariffData でエラーが発生しました", error.message);
    } else {
      console.error("fetchTariffData で予期せぬエラーが発生しました");
    }
    throw error;
  }
}
