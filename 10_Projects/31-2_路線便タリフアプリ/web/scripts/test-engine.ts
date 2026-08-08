import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
import { fetchTariffData } from '../lib/gasClient';
import { calculateTariff, CalculationInput } from '../lib/engine';
import { TariffData } from "../types/gas";

async function runTests() {
  console.log("=== エンジンテスト開始 ===");
  let rawData: TariffData | undefined;
  try {
    rawData = await fetchTariffData();
  } catch (e) {
    console.error("データの取得に失敗しました", e);
    process.exit(1);
  }

  function cloneData(): TariffData {
    return JSON.parse(JSON.stringify(rawData));
  }

  function assert(condition: boolean, message: string, errorObj?: unknown) {
    if (!condition) {
      console.error(`❌ FAIL: ${message}`, errorObj ? errorObj : '');
      throw new Error(`Test failed: ${message}`);
    }
    console.log(`✅ PASS: ${message}`);
  }

  function createInput(overrides: Partial<CalculationInput>): CalculationInput {
    return {
      company_id: 'C_A',
      tariff_id: 'T_A_2026',
      region_from: { prefecture: '東京都', city: '千代田区' },
      region_to: { prefecture: '大阪府', city: '大阪市' },
      actual_weight: 10,
      piece_count: 1,
      ...overrides
    };
  }

  // --- A路線テスト ---
  console.log("\n--- A路線 (T_A_2026) ---");
  const dataA = cloneData();
  
  let res = calculateTariff(createInput({}), dataA);
  assert(res.ok === true, "A路線: 通常基本運賃計算", res.error);
  assert(res.steps.some(s => s.step_type === 'BASE_FARE'), "基本運賃ステップが存在");

  res = calculateTariff(createInput({ region_from: { prefecture: '東京都', city: '千代田区' }, actual_weight: 25 }), dataA);
  assert(res.ok === true, "A路線: 東京+25kg加算ルール適用", res.error);
  assert(res.steps.some(s => s.description === '特定条件加算'), "特定条件加算ステップが存在");

  res = calculateTariff(createInput({ region_to: { prefecture: '沖縄県', city: '那覇市' } }), dataA);
  assert(res.ok === false && res.error === '計算対象外地域です', "A路線: 沖縄excludeでエラーになること", res.error);

  res = calculateTariff(createInput({ actual_weight: 10 }), dataA);
  assert(res.ok === true && res.tier_id === 'TIER_A_2026_10', "A路線: 10kg境界値 (TIER_A_2026_10)", res.error);
  res = calculateTariff(createInput({ actual_weight: 10.001 }), dataA);
  assert(res.ok === true && res.tier_id === 'TIER_A_2026_20', "A路線: 10.001kg境界超 (TIER_A_2026_20)", res.error);
  res = calculateTariff(createInput({ actual_weight: 20 }), dataA);
  assert(res.ok === true && res.tier_id === 'TIER_A_2026_20', "A路線: 20kg境界値 (TIER_A_2026_20)", res.error);
  res = calculateTariff(createInput({ actual_weight: 20.001 }), dataA);
  assert(res.ok === true && res.tier_id === 'TIER_A_2026_30', "A路線: 20.001kg境界超 (TIER_A_2026_30)", res.error);

  // --- B路線テスト ---
  console.log("\n--- B路線 (T_B_2026) ---");
  const dataB = cloneData();
  
  res = calculateTariff(createInput({ company_id: 'C_B', tariff_id: 'T_B_2026', region_to: { prefecture: '福岡県', city: '福岡市' } }), dataB);
  assert(res.ok === false && (res.error?.includes("Invalid volume_m3") ?? false), "B路線: volume_m3不足でエラー", res.error);

  res = calculateTariff(createInput({ company_id: 'C_B', tariff_id: 'T_B_2026', region_to: { prefecture: '福岡県', city: '福岡市' }, actual_weight: 10, volume_m3: 0.1 }), dataB);
  assert(res.ok === true, "B路線: 容積重量適用", res.error);

  res = calculateTariff(createInput({ company_id: 'C_B', tariff_id: 'T_B_2026', region_to: { prefecture: '福岡県', city: '福岡市' }, actual_weight: 30, volume_m3: 0.1 }), dataB);
  assert(res.ok === true, "B路線: 実重量がmaxで適用", res.error);

  res = calculateTariff(createInput({ company_id: 'C_B', tariff_id: 'T_B_2026', region_to: { prefecture: '福岡県', city: '福岡市' }, actual_weight: 10, volume_m3: 0.1, piece_count: 2 }), dataB);
  assert(res.ok === true, "B路線: piece_count乗算", res.error);
  assert(res.steps.some(s => s.description === '個数加算' && s.amount_change === 800), "個数加算800円が適用");

  // --- C路線テスト ---
  console.log("\n--- C路線 (T_C_2026) ---");
  const dataC = cloneData();
  
  res = calculateTariff(createInput({ company_id: 'C_C', tariff_id: 'T_C_2026', actual_weight: 10 }), dataC);
  assert(res.ok === true, "C路線: 基本運賃取得", res.error);
  assert(res.total_amount === 3500, "C路線: min_fare(3500)が適用されている");

  res = calculateTariff(createInput({ company_id: 'C_C', tariff_id: 'T_C_2026', actual_weight: 60 }), dataC);
  assert(res.ok === true, "C路線: 超過重量加算", res.error);
  assert(res.total_amount === 3500, "C路線: 60kg超過加算(10kg * 50円 = 500円) + 基本運賃3000円 = 3500円");
  assert(res.steps.some(s => s.description === '超過加算(50kg超)' && s.amount_change === 500), "超過加算500円が適用");

  res = calculateTariff(createInput({ company_id: 'C_C', tariff_id: 'T_C_2026', actual_weight: 9999 }), dataC);
  assert(res.ok === true, "C路線: 無制限上限条件帯", res.error);

  // --- D路線テスト ---
  console.log("\n--- D路線 (T_D_2026) ---");
  const dataD = cloneData();
  dataD.fareTables.push({
    record_id: 'MOCK_D_TKY_TKY',
    tariff_id: 'T_D_2026',
    region_from_id: 'REG_D_2026_TKY',
    region_to_id: 'REG_D_2026_TKY',
    tier_id: 'TIER_D_2026_100',
    base_amount: 3000
  });

  res = calculateTariff(createInput({ company_id: 'C_D', tariff_id: 'T_D_2026', region_to: { prefecture: '東京都', city: '千代田区' } }), dataD);
  assert(res.ok === true && !res.steps.some(s => s.description === '中継料加算'), "D路線: 通常地域は中継料なし", res.error);

  res = calculateTariff(createInput({ company_id: 'C_D', tariff_id: 'T_D_2026', region_to: { prefecture: '北海道', city: '札幌市' } }), dataD);
  assert(res.ok === true && res.steps.some(s => s.description === '中継料加算'), "D路線: 北海道は中継料加算あり", res.error);

  const isFloorRounded = res.total_amount % 10 === 0;
  assert(isFloorRounded, "D路線: floorで10円単位に丸められている");

  res = calculateTariff(createInput({ company_id: 'C_D', tariff_id: 'T_D_2026', region_to: { prefecture: '東京都', city: '千代田区' }, actual_weight: 100 }), dataD);
  assert(res.ok === true, "D路線: 100kgは計算可能", res.error);
  res = calculateTariff(createInput({ company_id: 'C_D', tariff_id: 'T_D_2026', region_to: { prefecture: '東京都', city: '千代田区' }, actual_weight: 101 }), dataD);
  assert(res.ok === false && (res.error?.includes("条件帯が見つかりません") ?? false), "D路線: 101kgは計算範囲外でエラー", res.error);

  // --- 異常系テスト ---
  console.log("\n--- 異常系テスト ---");
  let errData = cloneData();
  
  res = calculateTariff(createInput({ tariff_id: 'UNKNOWN_TARIFF' }), errData);
  assert(res.ok === false && (res.error?.includes('Tariff not found') ?? false), "異常系: タリフ0件", res.error);

  errData = cloneData();
  errData.tariffs.push(errData.tariffs[0]);
  res = calculateTariff(createInput({}), errData);
  assert(res.ok === false && (res.error?.includes('Multiple tariffs found') ?? false), "異常系: タリフ重複", res.error);

  errData = cloneData();
  res = calculateTariff(createInput({ company_id: 'WRONG_COMPANY' }), errData);
  assert(res.ok === false && (res.error?.includes('Company ID mismatch') ?? false), "異常系: company_id不一致", res.error);

  errData = cloneData();
  res = calculateTariff(createInput({ region_from: { prefecture: '海外', city: 'ハワイ' } }), errData);
  assert(res.ok === false && (res.error?.includes('対象地域外です') ?? false), "異常系: 地域0件", res.error);

  errData = cloneData();
  const tokyoRow = errData.regions.find((r) => r.tariff_id === 'T_A_2026' && r.prefecture === '東京都');
  if (tokyoRow) errData.regions.push(tokyoRow);
  res = calculateTariff(createInput({}), errData);
  assert(res.ok === false && (res.error?.includes('地域定義が重複') ?? false), "異常系: 地域重複", res.error);

  errData = cloneData();
  errData.conditionTiers = errData.conditionTiers.filter((r) => r.tariff_id !== 'T_A_2026');
  res = calculateTariff(createInput({}), errData);
  assert(res.ok === false && (res.error?.includes('条件帯が見つかりません') ?? false), "異常系: 条件帯0件", res.error);

  errData = cloneData();
  const tierRow = errData.conditionTiers.find((r) => r.tariff_id === 'T_A_2026');
  if (tierRow) errData.conditionTiers.push(tierRow);
  res = calculateTariff(createInput({}), errData);
  assert(res.ok === false && (res.error?.includes('マスタ異常: 条件帯が重複しています') ?? false), "異常系: 条件帯重複", res.error);

  errData = cloneData();
  errData.fareTables = errData.fareTables.filter((r) => r.tariff_id !== 'T_A_2026');
  res = calculateTariff(createInput({}), errData);
  assert(res.ok === false && (res.error?.includes('運賃表に該当レコードがありません') ?? false), "異常系: 基本運賃0件", res.error);

  errData = cloneData();
  const fareRow = errData.fareTables.find((r) => r.tariff_id === 'T_A_2026');
  if (fareRow) errData.fareTables.push(fareRow);
  res = calculateTariff(createInput({}), errData);
  assert(res.ok === false && (res.error?.includes('基本運賃レコードが複数存在します') ?? false), "異常系: 基本運賃重複", res.error);

  errData = cloneData();
  const condRow = errData.ruleConditions.find((r) => r.rule_id === 'RULE_A_2026_01');
  if (condRow) condRow.condition_target = 'UNKNOWN_TARGET';
  res = calculateTariff(createInput({ actual_weight: 20 }), errData); 
  assert(res.ok === false && (res.error?.includes('未対応のcondition_target') ?? false), "異常系: 未知condition_target", res.error);

  errData = cloneData();
  const condRow2 = errData.ruleConditions.find((r) => r.rule_id === 'RULE_A_2026_01');
  if (condRow2) condRow2.operator = '!=';
  res = calculateTariff(createInput({ actual_weight: 20 }), errData);
  assert(res.ok === false && (res.error?.includes('未対応のoperator') ?? false), "異常系: 未知operator", res.error);

  errData = cloneData();
  const actRow = errData.ruleActions.find((r) => r.rule_id === 'RULE_A_2026_01');
  if (actRow) actRow.action_type = 'magic_add';
  res = calculateTariff(createInput({ actual_weight: 20 }), errData);
  assert(res.ok === false && (res.error?.includes('未対応のaction_type') ?? false), "異常系: 未知action_type", res.error);

  errData = cloneData();
  const tariffRow = errData.tariffs.find((r) => r.tariff_id === 'T_A_2026');
  if (tariffRow) (tariffRow as Record<string, unknown>).rounding_unit = -10;
  res = calculateTariff(createInput({}), errData);
  assert(res.ok === false && (res.error?.includes('rounding_unitが不正') ?? false), "異常系: 異常rounding_unit", res.error);

  errData = cloneData();
  res = calculateTariff(createInput({ actual_weight: NaN }), errData);
  assert(res.ok === false && (res.error?.includes('Invalid actual_weight') ?? false), "異常系: 必須入力不足", res.error);

  console.log("\n=== テスト完了 ===");
  console.log("すべてのテストが成功しました。");
}

runTests();
