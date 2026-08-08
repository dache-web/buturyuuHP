"use client";

import { useEffect, useState } from "react";

export default function TestPage() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<Record<string, Record<string, unknown>[]> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/gas")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) {
          setResult(data.data);
        } else {
          setError(data.error);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">読み込み中...</div>;
  if (error) return <div className="p-8 text-red-500">エラー: {error}</div>;
  if (!result) return <div className="p-8">データがありません</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Phase 1 確認画面</h1>
      <div className="bg-green-100 text-green-800 p-4 rounded mb-8">
        接続成功・型変換成功
      </div>

      <h2 className="text-xl font-semibold mb-2">取得件数と代表データ</h2>
      <div className="grid gap-4">
        <SheetSummary title="01_路線会社" items={result.companies} keys={["company_id", "company_name"]} />
        <SheetSummary title="02_タリフ基本" items={result.tariffs} keys={["tariff_id", "company_id", "version"]} />
        <SheetSummary title="03_地域定義" items={result.regions} keys={["region_id", "prefecture", "city"]} />
        <SheetSummary title="04_条件帯定義" items={result.conditionTiers} keys={["tier_id", "condition_type"]} />
        <SheetSummary title="05_運賃表" items={result.fareTables} keys={["record_id", "region_from_id", "region_to_id"]} />
        <SheetSummary title="06_ルール基本" items={result.rules} keys={["rule_id", "rule_name"]} />
        <SheetSummary title="07_ルール条件" items={result.ruleConditions} keys={["condition_id", "condition_target"]} />
        <SheetSummary title="08_ルール処理" items={result.ruleActions} keys={["action_id", "action_type"]} />
        <SheetSummary title="09_テスト結果" items={result.testResults} keys={["test_id", "status"]} />
      </div>
    </div>
  );
}

function SheetSummary({ title, items, keys }: { title: string; items: Record<string, unknown>[]; keys: string[] }) {
  const count = items ? items.length : 0;
  const sample = count > 0 ? items[0] : null;

  const displaySample: Record<string, unknown> = {};
  if (sample) {
    for (const k of keys) {
      if (k in sample) displaySample[k] = sample[k];
    }
  }

  return (
    <div className="border p-4 rounded bg-white shadow-sm">
      <h3 className="font-bold text-lg">{title}: {count}件</h3>
      {sample && (
        <pre className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
          {JSON.stringify(displaySample, null, 2)}
        </pre>
      )}
    </div>
  );
}
