import React, { useState, useEffect } from "react";
import { ExtractionRule, ExtractionField, OutputSetting } from "@/lib/gas/types";
import { getSettings, getRules, getFields, getOutputSettings } from "@/lib/gas/client";

interface Props {
  onRuleChange?: (ruleId: string) => void;
  onFieldsFetched?: (fields: ExtractionField[]) => void;
}

export default function RuleConnectionPanel({ onRuleChange, onFieldsFetched }: Props = {}) {
  const [status, setStatus] = useState<"checking" | "connected" | "error">("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  // settings is fetched to determine default rule, but currently not displayed directly
  // const [settings, setSettings] = useState<AppSettings | null>(null);
  const [rules, setRules] = useState<ExtractionRule[]>([]);
  const [activeRuleId, setActiveRuleId] = useState<string>("");

  const [fields, setFields] = useState<ExtractionField[]>([]);
  const [outputSetting, setOutputSetting] = useState<OutputSetting | null>(null);

  const [isRuleLoading, setIsRuleLoading] = useState(false);

  const fetchInitialData = async () => {
    setStatus("checking");
    setErrorMessage(null);
    setErrorCode(null);

    try {
      const [fetchedSettings, fetchedRules] = await Promise.all([
        getSettings(),
        getRules()
      ]);

      // setSettings(fetchedSettings);
      setRules(fetchedRules);

      if (fetchedRules.length === 0) {
        throw new Error("[NO_RULES] 有効なルールが1件もありません。");
      }

      let initialRuleId = fetchedSettings.defaultRuleId;
      if (!fetchedRules.find(r => r.ruleId === initialRuleId)) {
        console.warn(`デフォルトルール ${initialRuleId} が見つからないか無効です。先頭のルールを使用します。`);
        initialRuleId = fetchedRules[0].ruleId;
      }

      setActiveRuleId(initialRuleId);
      if (onRuleChange) onRuleChange(initialRuleId);
      setStatus("connected");
    } catch (error) {
      console.error("初期データの取得に失敗しました:", error);
      setStatus("error");
      
      const errStr = (error as Error).message;
      const match = errStr.match(/^\[(.*?)\] (.*)$/);
      if (match) {
        setErrorCode(match[1]);
        setErrorMessage(match[2]);
      } else {
        setErrorCode("FETCH_ERROR");
        setErrorMessage(errStr);
      }
    }
  };

  const fetchRuleDetails = async (ruleId: string) => {
    if (!ruleId) return;
    setIsRuleLoading(true);
    try {
      const [fetchedFields, fetchedOutput] = await Promise.all([
        getFields(ruleId),
        getOutputSettings(ruleId)
      ]);
      setFields(fetchedFields);
      setOutputSetting(fetchedOutput);
      if (onFieldsFetched) onFieldsFetched(fetchedFields);
    } catch (error) {
      console.error(`ルール ${ruleId} の詳細取得に失敗しました:`, error);
      // ルール詳細の取得に失敗しても全体をエラー状態にはせず、メッセージを出す程度にするか検討
      // 今回はコンソールと簡単なalertで済ますか、ステータスを維持
      alert(`ルール詳細の取得に失敗しました:\n${(error as Error).message}`);
      setFields([]);
      setOutputSetting(null);
    } finally {
      setIsRuleLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeRuleId && status === "connected") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchRuleDetails(activeRuleId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRuleId, status]);

  if (status === "error") {
    return (
      <div style={{ padding: "1rem", backgroundColor: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", marginBottom: "1rem" }}>
        <h3 style={{ color: "#b91c1c", marginTop: 0 }}>ルール接続エラー</h3>
        <p>管理スプレッドシートからルールを取得できませんでした。接続設定を確認してください。</p>
        {errorCode && <p style={{ fontSize: "0.85rem", color: "#7f1d1d" }}>エラーコード: {errorCode}</p>}
        {errorMessage && <p style={{ fontSize: "0.85rem", color: "#7f1d1d" }}>詳細: {errorMessage}</p>}
        <button 
          onClick={fetchInitialData}
          style={{ marginTop: "0.5rem", padding: "0.5rem 1rem", backgroundColor: "white", border: "1px solid #fca5a5", borderRadius: "4px", cursor: "pointer" }}
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "1rem", backgroundColor: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h3 style={{ margin: 0, fontSize: "1.1rem" }}>ルール接続確認</h3>
        <span style={{ fontSize: "0.85rem", fontWeight: "bold", padding: "0.25rem 0.5rem", borderRadius: "4px", backgroundColor: status === "connected" ? "#dcfce7" : "#fef3c7", color: status === "connected" ? "#166534" : "#92400e" }}>
          {status === "checking" ? "接続確認中..." : "接続済み"}
        </span>
      </div>

      {status === "connected" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "0.25rem" }}>抽出ルール</label>
            <select 
              value={activeRuleId}
              onChange={(e) => {
                setActiveRuleId(e.target.value);
                if (onRuleChange) onRuleChange(e.target.value);
              }}
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
            >
              {rules.map(rule => (
                <option key={rule.ruleId} value={rule.ruleId}>
                  {rule.ruleName} ({rule.usage})
                </option>
              ))}
            </select>
          </div>

          {isRuleLoading ? (
            <p style={{ fontSize: "0.9rem", color: "#64748b" }}>項目・設定を読み込み中...</p>
          ) : (
            <>
              {/* 出力設定（開発用確認） */}
              {outputSetting && (
                <div style={{ backgroundColor: "#e2e8f0", padding: "0.5rem", borderRadius: "4px", fontSize: "0.85rem" }}>
                  <strong>出力設定 (開発用確認):</strong> 
                  シート名: {outputSetting.sheetName}, 方式: {outputSetting.outputMethod}, ファイル名出力: {outputSetting.outputFileName ? "有" : "無"}, ページ番号出力: {outputSetting.outputPageNumber ? "有" : "無"}
                </div>
              )}

              {/* 項目一覧 */}
              <div>
                <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", marginBottom: "0.25rem" }}>項目一覧</label>
                {fields.length === 0 ? (
                  <p style={{ fontSize: "0.85rem", color: "#64748b" }}>項目がありません。</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {fields.map(field => (
                      <li key={field.fieldId} style={{ backgroundColor: "white", padding: "0.75rem", border: "1px solid #cbd5e1", borderRadius: "4px", fontSize: "0.9rem" }}>
                        <div style={{ fontWeight: "bold", marginBottom: "0.25rem", color: "#334155" }}>{field.fieldName} {field.isRequired && <span style={{ color: "#ef4444", fontSize: "0.8rem" }}>*必須</span>}</div>
                        <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{field.description}</div>
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                          <span style={{ backgroundColor: "#f1f5f9", padding: "0.1rem 0.4rem", borderRadius: "2px", fontSize: "0.75rem" }}>選択: {field.selectionMethod}</span>
                          <span style={{ backgroundColor: "#f1f5f9", padding: "0.1rem 0.4rem", borderRadius: "2px", fontSize: "0.75rem" }}>単位: {field.extractionUnit}</span>
                          <span style={{ backgroundColor: "#f1f5f9", padding: "0.1rem 0.4rem", borderRadius: "2px", fontSize: "0.75rem" }}>型: {field.dataType}</span>
                          {field.allowMultiple && <span style={{ backgroundColor: "#dbeafe", color: "#1e40af", padding: "0.1rem 0.4rem", borderRadius: "2px", fontSize: "0.75rem" }}>複数選択可 ({field.joinMethod})</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
