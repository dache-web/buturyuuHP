import { fetchTariffData } from "../lib/gasClient";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

async function runTests() {
  console.log("=== 自動テスト開始 ===");
  let hasError = false;

  console.log("\n[1] 正常系テスト");
  try {
    const data = await fetchTariffData();
    console.log("PASS: 正常系データ取得成功");
    console.log(`取得シート数: ${Object.keys(data).length}`);
    
    console.log(`- 01_路線会社: ${data.companies.length}件`);
    console.log(`- 02_タリフ基本: ${data.tariffs.length}件`);
    console.log(`- 03_地域定義: ${data.regions.length}件`);
    console.log(`- 04_条件帯定義: ${data.conditionTiers.length}件`);
    console.log(`- 05_運賃表: ${data.fareTables.length}件`);
    console.log(`- 06_ルール基本: ${data.rules.length}件`);
    console.log(`- 07_ルール条件: ${data.ruleConditions.length}件`);
    console.log(`- 08_ルール処理: ${data.ruleActions.length}件`);
    console.log(`- 09_テスト結果: ${data.testResults.length}件`);
    
  } catch (error: unknown) {
    const e = error instanceof Error ? error : new Error(String(error));
    console.error("FAIL: 正常系エラー", e.message);
    hasError = true;
  }

  console.log("\n[2] 認証失敗テスト");
  try {
    await fetchTariffData("invalid_token_for_test");
    console.error("FAIL: 認証エラーになるべきですが成功しました");
    hasError = true;
  } catch (error: unknown) {
    const e = error instanceof Error ? error : new Error(String(error));
    if (e.message.includes("GASエラー") || e.message.includes("UNAUTHORIZED")) {
      console.log("PASS: 認証失敗を正しく検知");
    } else {
      console.error("FAIL: 予期しないエラー", e.message);
      hasError = true;
    }
  }

  console.log("\n[3] INVALID_ACTIONテスト");
  try {
    await fetchTariffData(undefined, "invalid_action_for_test");
    console.error("FAIL: アクションエラーになるべきですが成功しました");
    hasError = true;
  } catch (error: unknown) {
    const e = error instanceof Error ? error : new Error(String(error));
    if (e.message.includes("GASエラー") || e.message.includes("INVALID_ACTION")) {
      console.log("PASS: INVALID_ACTIONを正しく検知");
    } else {
      console.error("FAIL: 予期しないエラー", e.message);
      hasError = true;
    }
  }

  console.log("\n[4] 通信エラーテスト");
  try {
    await fetchTariffData(undefined, undefined, "https://script.google.com/macros/s/invalid/exec");
    console.error("FAIL: 通信エラーになるべきですが成功しました");
    hasError = true;
  } catch (error: unknown) {
    const e = error instanceof Error ? error : new Error(String(error));
    if (e.message.includes("HTTP通信エラー") || e.message.includes("fetch")) {
      console.log("PASS: 通信エラーを安全に検知", e.message);
    } else {
      console.error("FAIL: 予期しないエラー", e.message);
      hasError = true;
    }
  }

  console.log("\n=== テスト完了 ===");
  if (hasError) {
    console.error(">>> 失敗したテストがあります。");
    process.exit(1);
  } else {
    console.log(">>> すべてのテストがPASSしました。");
    process.exit(0);
  }
}

runTests();
