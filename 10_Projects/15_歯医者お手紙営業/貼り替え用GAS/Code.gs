const API_KEY = "YOUR_GEMINI_API_KEY";
const GEMINI_MODEL = "gemini-2.5-flash";
const APP_VERSION = "2026-05-03-select-fixed-780-1";
const MAX_HP_TEXT_CHARS = 3500;
const MAX_DOC_SAMPLE_CHARS = 1800;
const MAX_TEMPLATE_CHARS = 1200;
const MAX_CLIENT_SAMPLE_CHARS = 1800;
const MAX_LEARNED_ITEMS = 8;
const MAX_DOC_SAMPLES = 3;

// --- 1. 初期セットアップ関連 ---

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("お手紙AI設定")
    .addItem("初回のみ：全シートを初期設定", "setupAll")
    .addItem("Gemini接続を診断", "showGeminiDiagnosis")
    .addToUi();
}

function setupAll() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert("全シートを初期設定しますか？", "初回セットアップ用です。通常の分析テスト中は実行しないでください。", ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) {
    ui.alert("初期設定をキャンセルしました。");
    return;
  }
  setupManagementSheet();
  setupNotificationSettingsSheet();
  setupLearningDataSheet();
  setupTemplateSheet();
  ui.alert("すべてのシートの初期設定が完了しました！\n（※テンプレートの既存本文は自動でD列に移行されています）");
}

function setupManagementSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("案件管理");
  if (!sheet) { sheet = ss.insertSheet("案件管理"); }
  
  const headers = ["案件ID", "歯科医院名", "ホームページURL", "作成内容URL", "作成内容本文", "依頼者", "依頼日", "締め切り日", "ステータス", "確認アラート", "残り日数", "作成日時", "更新日時", "メモ", "強み", "弱み・課題"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#d9ead3");
  sheet.setFrozenRows(1);
  
  const statusRule = SpreadsheetApp.newDataValidation().requireValueInList(["未完了", "作成中", "確認待ち", "修正中", "完了", "中止"], true).build();
  sheet.getRange("I2:I1000").setDataValidation(statusRule);
  
  for(let i=2; i<=1000; i++) {
    sheet.getRange("K" + i).setFormula(`=IF(ISBLANK(H${i}), "", H${i} - TODAY())`);
    sheet.getRange("J" + i).setFormula(`=IF(I${i}="完了", "完了済み", IF(I${i}="中止", "中止", IF(ISBLANK(H${i}), "締切未設定", IF(K${i}<0, "期限超過", IF(K${i}=0, "本日締切", IF(K${i}=1, "明日締切", IF(K${i}<=3, "3日以内", "余裕あり")))))))`);
  }
  
  sheet.clearConditionalFormatRules();
  const range = sheet.getRange("A2:P1000");
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$J2="期限超過"').setBackground("#cc0000").setFontColor("#ffffff").setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$J2="本日締切"').setBackground("#e69138").setFontColor("#ffffff").setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$J2="明日締切"').setBackground("#f6b26b").setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$J2="3日以内"').setBackground("#fff2cc").setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$J2="完了済み"').setBackground("#efefef").setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$J2="中止"').setBackground("#efefef").setFontColor("#999999").setRanges([range]).build());
  sheet.setConditionalFormatRules(rules);
  
  sheet.setColumnWidth(2, 200); sheet.setColumnWidth(3, 150); sheet.setColumnWidth(4, 150); sheet.setColumnWidth(5, 300);
}

function setupNotificationSettingsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("通知設定");
  if (!sheet) { sheet = ss.insertSheet("通知設定"); }
  
  sheet.clear();
  const data = [
    ["設定項目", "設定値", "説明"],
    ["メール通知", "OFF", "ONにすると、締切が近い案件を毎朝メール通知します"],
    ["通知先メール", Session.getActiveUser().getEmail(), "通知を受け取るメールアドレス。複数の場合はカンマ区切り"],
    ["通知対象日数", 3, "締め切り何日前から通知するか"],
    ["通知時刻", "09:00", "毎日通知する時刻の目安"],
    ["期限超過通知", "ON", "期限超過案件を通知対象に含めるか"],
    ["完了案件を除外", "ON", "ステータスが完了の案件は通知しない"],
    ["中止案件を除外", "ON", "ステータスが中止の案件は通知しない"]
  ];
  sheet.getRange(1, 1, data.length, 3).setValues(data);
  sheet.getRange(1, 1, 1, 3).setFontWeight("bold").setBackground("#cfe2f3");
  
  const onOffRule = SpreadsheetApp.newDataValidation().requireValueInList(["ON", "OFF"], true).build();
  sheet.getRange("B2").setDataValidation(onOffRule); sheet.getRange("B6").setDataValidation(onOffRule);
  sheet.getRange("B7").setDataValidation(onOffRule); sheet.getRange("B8").setDataValidation(onOffRule);
  sheet.setColumnWidth(1, 150); sheet.setColumnWidth(2, 200); sheet.setColumnWidth(3, 350);
}

function setupLearningDataSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("学習データ");
  if (!sheet) { sheet = ss.insertSheet("学習データ"); }
  
  const headers = ["登録日時", "歯科医院名", "HP URL", "AI生成文", "クライアント修正文", "修正ポイント", "採用フレーズ", "避けたい表現", "評価", "メモ", "学習種別", "見本文書URL", "見本文書本文"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#fff2cc");
  sheet.setFrozenRows(1);
  
  const evalRule = SpreadsheetApp.newDataValidation().requireValueInList(["採用", "修正後採用", "不採用", "保留"], true).build();
  sheet.getRange("I2:I1000").setDataValidation(evalRule);
  
  const typeRule = SpreadsheetApp.newDataValidation().requireValueInList(["手動修正", "Googleドキュメント見本", "画像見本OCR", "採用済み本文"], true).build();
  sheet.getRange("K2:K1000").setDataValidation(typeRule);
  
  sheet.setColumnWidth(4, 300); sheet.setColumnWidth(5, 300); sheet.setColumnWidth(6, 200); sheet.setColumnWidth(13, 400);
}

// ▼ 修正：テンプレートの構造変更と既存データの移行
function setupTemplateSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("テンプレート");
  if (!sheet) { sheet = ss.insertSheet("テンプレート"); }
  
  // 既存データ退避（旧C列の本文を、新D列へ移動させる）
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    let updated = false;
    for (let i = 0; i < data.length; i++) {
      if (data[i][2] && !data[i][3]) { 
        data[i][3] = data[i][2]; // Cの値をDへコピー
        data[i][2] = ""; // Cを空にして使用条件欄として開放
        updated = true;
      }
    }
    if (updated) {
      sheet.getRange(2, 1, lastRow - 1, 4).setValues(data);
    }
  }

  // E列追加前の既存シートでは、この処理により既存A-D列を維持したままE列だけ追加する。
  const headers = ["キーワード", "優先度", "使用条件", "テンプレート本文", "紐づけID"];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#fce5cd");
  sheet.setFrozenRows(1);
  
  const priorityRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["1：最優先", "2：かなり優先", "3：通常", "4：低め", "5：参考程度"], true).build();
  sheet.getRange("B2:B1000").setDataValidation(priorityRule);
  const conditionRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["冒頭", "本文", "締め", "全体"], true).build();
  sheet.getRange("C2:C1000").setDataValidation(conditionRule);
  const linkRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"], true).build();
  sheet.getRange("E2:E1000").setDataValidation(linkRule);
  
  sheet.setColumnWidth(1, 150); sheet.setColumnWidth(2, 150); sheet.setColumnWidth(3, 160); sheet.setColumnWidth(4, 400); sheet.setColumnWidth(5, 100);
}

// --- 2. ユーティリティ系 ---

function getNotificationSettings() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("通知設定");
  if (!sheet) return null;
  const data = sheet.getRange(2, 1, 7, 2).getValues();
  const settings = {};
  data.forEach(row => {
    const key = row[0]; const val = row[1];
    if (key === "メール通知") settings.mailEnabled = (val === "ON");
    if (key === "通知先メール") settings.recipients = val;
    if (key === "通知対象日数") settings.alertDays = parseInt(val) || 3;
    if (key === "期限超過通知") settings.includeOverdue = (val === "ON");
    if (key === "完了案件を除外") settings.excludeCompleted = (val === "ON");
    if (key === "中止案件を除外") settings.excludeCanceled = (val === "ON");
  });
  return settings;
}

function logError(errorMessage) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("エラーログ");
  if (!sheet) { sheet = ss.insertSheet("エラーログ"); sheet.appendRow(["発生日時", "エラー内容"]); }
  const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
  sheet.appendRow([now, errorMessage]);
}

function getGeminiApiKey() {
  const propKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  const key = propKey || API_KEY;
  if (!key || key === "YOUR_GEMINI_API_KEY") {
    throw new Error("Gemini APIキーが未設定です。Code.gsのAPI_KEY、またはスクリプトプロパティ GEMINI_API_KEY に有効なキーを設定してください。");
  }
  return key;
}

function truncateTextForPrompt(text, maxChars) {
  if (!text) return "";
  const normalized = String(text).replace(/\s+/g, " ").trim();
  return normalized.length > maxChars ? normalized.substring(0, maxChars) + "..." : normalized;
}

function normalizeLetterPart(text) {
  return text ? String(text).trim() : "";
}

function getPriorityLabel(priority) {
  if (priority === "highest") return "最優先";
  if (priority === "high") return "優先";
  if (priority === "low") return "低め";
  return "通常";
}

function ensureRequiredText(partText, requiredText, position) {
  let part = normalizeLetterPart(partText);
  const required = normalizeLetterPart(requiredText);
  if (!required) return part;
  if (part.indexOf(required) !== -1) return part;
  return position === "end" ? (part + "\n\n" + required).trim() : (required + "\n\n" + part).trim();
}

function composeThreePartLetter(openingPart, bodyPart, closingPart, requiredOpening, requiredClosing) {
  const opening = ensureRequiredText(openingPart, requiredOpening, "start");
  const body = normalizeLetterPart(bodyPart);
  const closing = ensureRequiredText(closingPart, requiredClosing, "end");
  return [opening, body, closing].filter(part => part && part.trim()).join("\n\n");
}

function getPartLengthPlan(lengthPref) {
  if (lengthPref === "short") {
    return { label: "500〜700文字", min: 500, max: 700, openingMin: 120, openingMax: 160, bodyMin: 260, bodyMax: 380, closingMin: 120, closingMax: 160 };
  }
  if (lengthPref === "long") {
    return { label: "1000〜1300文字", min: 1000, max: 1300, openingMin: 160, openingMax: 220, bodyMin: 680, bodyMax: 860, closingMin: 160, closingMax: 220 };
  }
  return { label: "750〜1000文字", min: 750, max: 1000, openingMin: 140, openingMax: 180, bodyMin: 470, bodyMax: 640, closingMin: 140, closingMax: 180 };
}

function countJapaneseChars(text) {
  return String(text || "").replace(/\s/g, "").length;
}

function trimPartToMax(partText, maxChars) {
  let part = normalizeLetterPart(partText);
  if (countJapaneseChars(part) <= maxChars) return part;

  let visibleCount = 0;
  let cutIndex = part.length;
  for (let i = 0; i < part.length; i++) {
    if (!/\s/.test(part.charAt(i))) visibleCount++;
    if (visibleCount > maxChars) {
      cutIndex = i;
      break;
    }
  }

  let trimmed = part.substring(0, cutIndex);
  const lastPeriod = Math.max(trimmed.lastIndexOf("。"), trimmed.lastIndexOf("\n"));
  if (lastPeriod > 40) trimmed = trimmed.substring(0, lastPeriod + 1);
  return trimmed.trim();
}

function getMandatoryTemplatesByPart(templates, partName) {
  return templates.filter(t => t.priority === 1 && (t.condition === partName || t.condition === "全体"));
}

function forceMandatoryTemplatesIntoPart(partText, mandatoryTemplates) {
  let part = normalizeLetterPart(partText);
  mandatoryTemplates.forEach(t => {
    const body = normalizeLetterPart(t.body);
    if (!body) return;
    const key = normalizeLetterPart(t.keyword);
    if (part.indexOf(body) === -1 && (!key || part.indexOf(key) === -1)) {
      part = body + (part ? "\n\n" + part : "");
    }
  });
  return part;
}

function trimBodyPartToLength(openingPart, bodyPart, closingPart, maxChars) {
  let body = normalizeLetterPart(bodyPart);
  let composed = composeThreePartLetter(openingPart, body, closingPart, "", "");
  let currentCount = countJapaneseChars(composed);
  if (currentCount <= maxChars) return body;

  const over = currentCount - maxChars;
  const targetBodyLength = Math.max(120, countJapaneseChars(body) - over - 50);
  if (countJapaneseChars(body) <= targetBodyLength) return body;

  let trimmed = body.substring(0, targetBodyLength);
  const lastPeriod = Math.max(trimmed.lastIndexOf("。"), trimmed.lastIndexOf("\n"));
  if (lastPeriod > 80) trimmed = trimmed.substring(0, lastPeriod + 1);
  return trimmed.trim();
}

function normalizeGeneratedLetter(text, clinicName) {
  let result = String(text || "").trim();
  const name = normalizeLetterPart(clinicName);
  if (name) {
    result = result.split("○○歯科様").join(name + "様");
    result = result.split("○○歯科").join(name);
    result = result.split("○○院長（理事長）先生").join("院長先生");
    result = result.split("○○院長先生").join("院長先生");
  }
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trim();
}

function buildPartTemplateContext(templates, partName) {
  const targetTemplates = templates.filter(t => t.condition === partName || t.condition === "全体");
  if (targetTemplates.length === 0) return "指定なし";
  return targetTemplates.slice(0, 10).map((t, idx) => {
    const linkText = t.linkId ? ` / 紐づけ${t.linkId}` : "";
    return `【${partName}テンプレート${idx + 1} / 優先度${t.priority}${linkText} / ${t.keyword}】\n${t.body}`;
  }).join("\n\n");
}

function buildPartPriorityPlan(templates, partName) {
  const targetTemplates = templates
    .filter(t => t.condition === partName || t.condition === "全体")
    .sort((a, b) => a.priority - b.priority);
  if (targetTemplates.length === 0) return "指定なし";

  const required = targetTemplates.filter(t => t.priority === 1);
  const strong = targetTemplates.filter(t => t.priority === 2);
  const normal = targetTemplates.filter(t => t.priority >= 3);
  let text = "";

  if (required.length > 0) {
    text += "【必須】以下の優先度1キーワードは、該当パート内に文字列として必ず入れてください。言い換えだけは禁止です。\n";
    required.forEach(t => {
      const linkText = t.linkId ? ` / 紐づけ${t.linkId}` : "";
      text += `- ${t.keyword}${linkText}: ${t.body}\n`;
    });
  }
  if (strong.length > 0) {
    text += "\n【強く優先】以下の優先度2キーワードは、文字数が許す範囲でできるだけ文字列として入れてください。\n";
    strong.slice(0, 5).forEach(t => {
      const linkText = t.linkId ? ` / 紐づけ${t.linkId}` : "";
      text += `- ${t.keyword}${linkText}: ${t.body}\n`;
    });
  }
  if (normal.length > 0) {
    text += "\n【参考】優先度3以下は自然さを壊さない範囲で参考にしてください。\n";
    normal.slice(0, 5).forEach(t => {
      text += `- ${t.keyword}: ${t.body}\n`;
    });
  }

  return text.trim();
}

function buildFixedBaseText(templates, partName) {
  const targetTemplates = templates
    .filter(t => t.condition === partName || t.condition === "全体")
    .sort((a, b) => a.priority - b.priority);
  if (targetTemplates.length === 0) return "指定なし";

  const selected = targetTemplates.filter(t => t.priority <= 2);
  const fallback = targetTemplates.slice(0, 4);
  const baseItems = (selected.length > 0 ? selected : fallback).slice(0, 8);

  return baseItems.map((t, idx) => {
    const linkText = t.linkId ? ` / 紐づけ${t.linkId}` : "";
    return `【固定原稿${idx + 1} / 優先度${t.priority}${linkText} / ${t.keyword}】\n${t.body}`;
  }).join("\n\n");
}

function buildFixedPartFromTemplates(templates, partName) {
  let targetTemplates = templates
    .filter(t => t.condition === partName)
    .sort((a, b) => a.priority - b.priority || String(a.linkId || "").localeCompare(String(b.linkId || "")) || (a.order || 0) - (b.order || 0));

  if (targetTemplates.length === 0) {
    targetTemplates = templates
      .filter(t => t.condition === "全体")
      .sort((a, b) => a.priority - b.priority || (a.order || 0) - (b.order || 0));
  }

  const selected = targetTemplates.filter(t => t.priority <= 2);
  const fixedItems = (selected.length > 0 ? selected : targetTemplates.slice(0, 3));
  const seen = {};
  const bodies = [];

  fixedItems.forEach(t => {
    const body = normalizeLetterPart(t.body);
    if (!body || seen[body]) return;
    seen[body] = true;
    bodies.push(body);
  });

  return bodies.join("\n\n");
}

function buildSelectedFixedPart(templates, selectedIds, fallbackPartName) {
  const ids = (selectedIds || []).map(id => String(id)).filter(Boolean);
  if (ids.length === 0) return buildFixedPartFromTemplates(templates, fallbackPartName);

  const selected = ids
    .map(id => templates.find(t => String(t.id) === id))
    .filter(Boolean);

  if (selected.length === 0) return buildFixedPartFromTemplates(templates, fallbackPartName);
  return selected.map(t => normalizeLetterPart(t.body)).filter(Boolean).join("\n\n");
}

function getTemplateOptions() {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("テンプレート");
    if (!sheet) return { openingOptions: [], closingOptions: [] };

    const data = sheet.getDataRange().getValues();
    const openingOptions = [];
    const closingOptions = [];

    for (let i = 1; i < data.length; i++) {
      const keyword = data[i][0];
      const rawPriority = data[i][1];
      const condition = data[i][2] || "全体";
      const body = data[i][3];
      if (!body) continue;

      const option = {
        id: String(i + 1),
        label: String(keyword || truncateTextForPrompt(body, 30)) + (rawPriority ? " / " + rawPriority : ""),
        preview: truncateTextForPrompt(body, 80)
      };

      if (condition === "冒頭") openingOptions.push(option);
      if (condition === "締め") closingOptions.push(option);
    }

    return { openingOptions: openingOptions, closingOptions: closingOptions };
  } catch (e) {
    logError("テンプレート候補取得エラー: " + e.toString());
    return { error: e.toString(), openingOptions: [], closingOptions: [] };
  }
}

function getFirstSentences(text, maxSentences, maxChars) {
  const raw = normalizeLetterPart(text);
  if (!raw) return "";
  const sentences = raw.split("。").map(s => s.trim()).filter(Boolean).slice(0, maxSentences).map(s => s + "。");
  const joined = sentences.join("");
  return joined.length > maxChars ? joined.substring(0, maxChars) + "。" : joined;
}

function applyTemplateVariables(text, vars) {
  let result = normalizeLetterPart(text);
  const clinicName = vars.clinicName || "";
  const doctorName = vars.doctorName || "院長先生";
  const hpComment = vars.hpComment || "";
  const strength1 = vars.strength1 || "";
  const strength2 = vars.strength2 || "";

  result = result.split("{{医院名}}").join(clinicName);
  result = result.split("{医院名}").join(clinicName);
  result = result.split("{{医院名様}}").join(clinicName ? clinicName + "様" : "");
  result = result.split("{医院名様}").join(clinicName ? clinicName + "様" : "");
  result = result.split("{{院長名}}").join(doctorName);
  result = result.split("{院長名}").join(doctorName);
  result = result.split("{{HP感想}}").join(hpComment);
  result = result.split("{HP感想}").join(hpComment);
  result = result.split("{{強み1}}").join(strength1);
  result = result.split("{強み1}").join(strength1);
  result = result.split("{{強み2}}").join(strength2);
  result = result.split("{強み2}").join(strength2);

  if (clinicName) {
    result = result.split("○○歯科様").join(clinicName + "様");
    result = result.split("○○歯科").join(clinicName);
  }
  result = result.split("○○院長（理事長）先生").join(doctorName);
  result = result.split("○○院長先生").join(doctorName);
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trim();
}

function findMissingRequiredKeywords(partText, templates, partName) {
  const text = normalizeLetterPart(partText);
  return templates
    .filter(t => t.priority === 1 && (t.condition === partName || t.condition === "全体"))
    .filter(t => t.keyword && text.indexOf(String(t.keyword)) === -1)
    .map(t => t.keyword);
}

function buildMissingKeywordReport(openingPart, bodyPart, closingPart, templates) {
  const openingMissing = findMissingRequiredKeywords(openingPart, templates, "冒頭");
  const bodyMissing = findMissingRequiredKeywords(bodyPart, templates, "本文");
  const closingMissing = findMissingRequiredKeywords(closingPart, templates, "締め");
  const lines = [];
  if (openingMissing.length > 0) lines.push("冒頭: " + openingMissing.join("、"));
  if (bodyMissing.length > 0) lines.push("本文: " + bodyMissing.join("、"));
  if (closingMissing.length > 0) lines.push("締め: " + closingMissing.join("、"));
  return lines.join("\n");
}

function callGeminiJson(apiUrl, apiKey, prompt, temperature) {
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: temperature, responseMimeType: "application/json" }
  };
  const response = UrlFetchApp.fetch(apiUrl, {
    method: "post",
    contentType: "application/json",
    headers: { "x-goog-api-key": apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const body = response.getContentText();
  const resultJson = JSON.parse(body);
  if (status < 200 || status >= 300 || resultJson.error) {
    const apiMessage = resultJson.error && resultJson.error.message ? resultJson.error.message : body;
    throw new Error("Gemini APIエラー HTTP " + status + ": " + apiMessage);
  }
  if (!resultJson.candidates || !resultJson.candidates[0] || !resultJson.candidates[0].content || !resultJson.candidates[0].content.parts || !resultJson.candidates[0].content.parts[0]) {
    throw new Error("Gemini APIの返答形式が想定と違いました: " + body.substring(0, 1000));
  }
  let aiText = resultJson.candidates[0].content.parts[0].text || "";
  aiText = aiText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(aiText);
}

function buildLinkedTemplateContext(templates) {
  const groups = {};
  templates.forEach(t => {
    if (!t.linkId) return;
    if (!groups[t.linkId]) groups[t.linkId] = [];
    groups[t.linkId].push(t);
  });

  const ids = Object.keys(groups).sort();
  if (ids.length === 0) return "指定なし";

  return ids.map(id => {
    const items = groups[id].sort((a, b) => a.priority - b.priority);
    const lines = items.map(t => `- ${t.condition} / 優先度${t.priority} / ${t.keyword}: ${t.body}`).join("\n");
    return `【紐づけグループ${id}】\n同じグループのテンプレートは、別々に扱わず、自然につながる一連の話として組み合わせてください。\n${lines}`;
  }).join("\n\n");
}

function buildMandatoryTemplateContext(templates) {
  const mandatory = templates.filter(t => t.priority === 1);
  if (mandatory.length === 0) return "指定なし";
  return mandatory.map((t, idx) => {
    const linkText = t.linkId ? ` / 紐づけ${t.linkId}` : "";
    return `【必須テンプレート${idx + 1} / ${t.condition}${linkText} / ${t.keyword}】\n${t.body}`;
  }).join("\n\n");
}

function getLearningPriority(row) {
  const evaluation = String(row[8] || "");
  const memo = String(row[9] || "");
  let score = 0;
  if (evaluation === "採用") score += 20;
  if (evaluation === "修正後採用") score += 10;
  if (memo.indexOf("最優先") !== -1) score += 100;
  else if (memo.indexOf("優先") !== -1) score += 50;
  return score;
}

function diagnoseGeminiConnection() {
  try {
    const apiKey = getGeminiApiKey();
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent";
    const payload = {
      contents: [{ parts: [{ text: "接続テストです。OKとだけ返してください。" }] }],
      generationConfig: { temperature: 0 }
    };
    const response = UrlFetchApp.fetch(apiUrl, {
      method: "post",
      contentType: "application/json",
      headers: { "x-goog-api-key": apiKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
    const status = response.getResponseCode();
    const body = response.getContentText();
    logError("Gemini接続診断: HTTP " + status + " / " + body.substring(0, 1000));
    return "Gemini接続診断: HTTP " + status + "\n" + body.substring(0, 1000);
  } catch (e) {
    logError("Gemini接続診断エラー: " + e.toString());
    return "Gemini接続診断エラー: " + e.toString();
  }
}

function showGeminiDiagnosis() {
  const result = diagnoseGeminiConnection();
  SpreadsheetApp.getUi().alert(result);
}

function getAppStatus() {
  try {
    const apiKey = getGeminiApiKey();
    return {
      success: true,
      version: APP_VERSION,
      model: GEMINI_MODEL,
      hasApiKey: !!apiKey,
      apiKeyPreview: apiKey.substring(0, 6) + "..." + apiKey.substring(apiKey.length - 4)
    };
  } catch (e) {
    return {
      success: false,
      version: APP_VERSION,
      model: GEMINI_MODEL,
      error: e.toString()
    };
  }
}

function diagnoseUrlFetch(targetUrl) {
  try {
    if (!targetUrl) return { error: "URLが空です。" };
    const response = UrlFetchApp.fetch(targetUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    const status = response.getResponseCode();
    const text = response.getContentText("UTF-8")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      success: true,
      status: status,
      textLength: text.length,
      preview: text.substring(0, 300)
    };
  } catch (e) {
    logError("URL取得診断エラー: " + e.toString());
    return { error: e.toString() };
  }
}

function generateCaseId() {
  const dateStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyyMMdd");
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("案件管理");
  let count = 1;
  if(sheet) {
    const ids = sheet.getRange("A2:A" + (sheet.getLastRow() || 2)).getValues().flat();
    count = ids.filter(id => String(id).includes(dateStr)).length + 1;
  }
  return `CASE-${dateStr}-${String(count).padStart(3, '0')}`;
}

function saveLearningData(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("学習データ");
    if (!sheet) { setupLearningDataSheet(); sheet = ss.getSheetByName("学習データ"); }
    const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    sheet.appendRow([
      now, data.clinicName || "", data.url || "", data.aiText || "", data.correctedText || "", 
      data.correctionPoints || "", data.adoptedPhrases || "", data.avoidedPhrases || "", 
      data.evaluation || "保留", data.memo || "", "手動修正", "", ""
    ]);
    return { success: true };
  } catch (e) {
    logError("学習データ保存エラー: " + e.toString());
    return { error: e.toString() };
  }
}

function learnFromDoc(docUrl) {
  try {
    const match = docUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return { error: "GoogleドキュメントのURLが正しくありません。" };
    const docId = match[1];
    
    const doc = DocumentApp.openById(docId);
    const text = doc.getBody().getText();
    if (!text || text.trim().length === 0) return { error: "ドキュメントに本文が見つかりませんでした。" };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("学習データ");
    if (!sheet) { setupLearningDataSheet(); sheet = ss.getSheetByName("学習データ"); }
    
    const now = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");
    sheet.appendRow([
      now, "", "", "", "", "", "", "", "採用", "ドキュメントから直接学習", "Googleドキュメント見本", docUrl, text
    ]);
    
    return { success: true };
  } catch (e) {
    logError("ドキュメント学習エラー: " + e.toString());
    return { error: "ドキュメントの読み込みに失敗しました。閲覧権限がない可能性があります。\n" + e.toString() };
  }
}

// --- 3. メイン処理（Webアプリ用） ---

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('歯科医院お手紙自動作成アプリ')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function generateDraft(req) {
  try {
    logError("generateDraft開始: " + JSON.stringify({
      version: APP_VERSION,
      hasUrl: !!(req && req.url),
      manualTextLength: req && req.manualText ? req.manualText.length : 0,
      lengthPref: req && req.lengthPref
    }));
    let textContent = "";

    if (req.manualText && req.manualText.trim().length > 0) {
      textContent = req.manualText.trim();
    } else if (req.url && req.url.trim().length > 0) {
      const response = UrlFetchApp.fetch(req.url, { muteHttpExceptions: true });
      const fetchCode = response.getResponseCode();
      if (fetchCode < 200 || fetchCode >= 300) {
        logError("HP本文取得エラー: HTTP " + fetchCode + " / URL: " + req.url);
        return { error: "ホームページの本文を自動取得できませんでした（HTTP " + fetchCode + "）。ホームページ本文を手動で貼り付けてから再実行してください。" };
      }
      let html = response.getContentText("UTF-8");
      let fetchedText = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const checkText = fetchedText.toLowerCase();
      if (checkText.includes("501 not implemented") || checkText.includes("403 forbidden") || checkText.includes("404 not found")) {
        return { error: "ホームページの本文を自動取得できませんでした。手動で貼り付けてから再実行してください。" };
      }
      textContent = truncateTextForPrompt(fetchedText, MAX_HP_TEXT_CHARS); 
    } else {
      return { error: "URLを入力するか、ホームページの本文を貼り付けてください。" };
    }

    // ▼ 修正：テンプレート読み込み時にC列(条件)とD列(本文)を参照する
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let templateSheet = ss.getSheetByName("テンプレート");
    let availableTemplates = "";
    let partTemplates = [];
    if (templateSheet) {
      const data = templateSheet.getDataRange().getValues();
      let templates = [];
      for (let i = 1; i < data.length; i++) {
        const rawKeyword = data[i][0]; 
        const rawPriority = data[i][1];
        const condition = data[i][2] || "全体"; // C列: 使用条件
        const body = data[i][3];      // D列: テンプレート本文
        const linkId = String(data[i][4] || "").trim().toUpperCase(); // E列: 紐づけID
        
        let priorityScore = 3; // デフォルトは通常
        if (String(rawPriority).indexOf("1") === 0 || rawPriority == 1) priorityScore = 1;
        else if (String(rawPriority).indexOf("2") === 0 || rawPriority == 2) priorityScore = 2;
        else if (String(rawPriority).indexOf("3") === 0 || rawPriority == 3) priorityScore = 3;
        else if (String(rawPriority).indexOf("4") === 0 || rawPriority == 4) priorityScore = 4;
        else if (String(rawPriority).indexOf("5") === 0 || rawPriority == 5) priorityScore = 5;
        
        if (body) {
          const keyword = rawKeyword || truncateTextForPrompt(body, 30);
          templates.push({ id: String(i + 1), keyword: keyword, condition: condition, priority: priorityScore, linkId: linkId, body: truncateTextForPrompt(body, MAX_TEMPLATE_CHARS), order: i });
        }
      }
      
      templates.sort((a, b) => a.priority - b.priority);
      partTemplates = templates;
      const topTemplates = templates.slice(0, 3);
      topTemplates.forEach((t, idx) => {
        availableTemplates += `【文体サンプル${idx + 1}】\nキーワード：${t.keyword}\n優先度：${t.priority}\n使用条件：${t.condition || "特になし"}\n本文（※丸コピー禁止。文体や構成の参考にすること）：\n${t.body}\n\n`;
      });
    }
    const openingTemplateContext = buildPartTemplateContext(partTemplates, "冒頭");
    const bodyTemplateContext = buildPartTemplateContext(partTemplates, "本文");
    const closingTemplateContext = buildPartTemplateContext(partTemplates, "締め");
    const openingPriorityPlan = buildPartPriorityPlan(partTemplates, "冒頭");
    const bodyPriorityPlan = buildPartPriorityPlan(partTemplates, "本文");
    const closingPriorityPlan = buildPartPriorityPlan(partTemplates, "締め");
    const openingFixedBase = buildFixedBaseText(partTemplates, "冒頭");
    const bodyFixedBase = buildFixedBaseText(partTemplates, "本文");
    const closingFixedBase = buildFixedBaseText(partTemplates, "締め");
    const linkedTemplateContext = buildLinkedTemplateContext(partTemplates);
    const mandatoryTemplateContext = buildMandatoryTemplateContext(partTemplates);
    const mandatoryOpeningTemplates = getMandatoryTemplatesByPart(partTemplates, "冒頭");
    const mandatoryBodyTemplates = getMandatoryTemplatesByPart(partTemplates, "本文");
    const mandatoryClosingTemplates = getMandatoryTemplatesByPart(partTemplates, "締め");
    logError("テンプレート読込: total=" + partTemplates.length + ", priority1=" + partTemplates.filter(t => t.priority === 1).length + ", opening=" + partTemplates.filter(t => t.condition === "冒頭").length + ", body=" + partTemplates.filter(t => t.condition === "本文").length + ", closing=" + partTemplates.filter(t => t.condition === "締め").length);

    let learningContext = "";
    let docSampleContext = "";
    let learnSheet = ss.getSheetByName("学習データ");
    if (learnSheet) {
      const lData = learnSheet.getDataRange().getValues();
      let learnedItems = [];
      let docSamples = [];
      let learnedCandidates = [];
      let docCandidates = [];
      for (let i = lData.length - 1; i >= 1; i--) { 
        const evalScore = lData[i][8]; // I列:評価
        const type = lData[i][10]; // K列:学習種別
        const docText = lData[i][12]; // M列:見本文書本文
        const clientText = lData[i][4]; // E列:クライアント修正文

        if (evalScore !== "不採用" && evalScore !== "保留") {
          const priority = getLearningPriority(lData[i]);
          if ((type === "Googleドキュメント見本" || type === "採用済み本文") && docText) {
            docCandidates.push({
              row: i + 1,
              priority: priority,
              clinicName: truncateTextForPrompt(lData[i][1], 120),
              text: truncateTextForPrompt(docText, MAX_DOC_SAMPLE_CHARS)
            });
          } else {
            if (clientText || lData[i][5] || lData[i][6] || lData[i][7]) {
              learnedCandidates.push({
                row: i + 1,
                priority: priority,
                clinicName: truncateTextForPrompt(lData[i][1], 120),
                correctionPoints: truncateTextForPrompt(lData[i][5], 500),
                adoptedPhrases: truncateTextForPrompt(lData[i][6], 300),
                avoidedPhrases: truncateTextForPrompt(lData[i][7], 300),
                clientText: truncateTextForPrompt(clientText, MAX_CLIENT_SAMPLE_CHARS)
              });
            }
            if (clientText) {
              docCandidates.push({
                row: i + 1,
                priority: priority,
                clinicName: truncateTextForPrompt(lData[i][1], 120),
                text: truncateTextForPrompt(clientText, MAX_DOC_SAMPLE_CHARS)
              });
            }
          }
        }
      }

      learnedCandidates.sort((a, b) => b.priority - a.priority || b.row - a.row);
      docCandidates.sort((a, b) => b.priority - a.priority || b.row - a.row);
      learnedItems = learnedCandidates.slice(0, MAX_LEARNED_ITEMS);
      docSamples = docCandidates.slice(0, MAX_DOC_SAMPLES);

      if (learnedItems.length > 0) {
        learningContext = "【最優先命令：必ず反映する学習データ】\n以下は実際にクライアントが修正・採用した文章です。今回の本文は、一般的な営業文ではなく、この学習データの文体に寄せてください。固有名詞だけ今回の医院に置き換え、書き出し、自己紹介、活動理由、段落の順番、やわらかい締め方、温度感、言い回しの癖を最優先で反映してください。\n";
        learnedItems.forEach((item, idx) => {
          learningContext += `<学習データ${idx+1}>\n対象医院: ${item.clinicName}\n修正ポイント: ${item.correctionPoints || "未入力"}\n採用フレーズ: ${item.adoptedPhrases || "未入力"}\n回避表現: ${item.avoidedPhrases || "未入力"}\n実際のクライアント修正文:\n${item.clientText}\n\n`;
        });
      }
      
      if (docSamples.length > 0) {
        docSampleContext = "【最優先命令：完成見本の文体を再現】\n以下の見本は、今回の手紙の文体・構成・温度感の基準です。丸コピーは禁止ですが、医院名などの固有名詞は今回の対象に置き換え、文章の流れ、段落の長さ、自己紹介の入り方、活動理由、相手医院への触れ方、締め方は見本に強く寄せてください。見本と通常ルールが矛盾する場合は、見本を優先してください。\n";
        docSamples.forEach((sample, idx) => {
          docSampleContext += `--- 見本${idx+1}（行${sample.row} / ${sample.clinicName || "医院名なし"}）---\n${sample.text}\n\n`;
        });
      }

      logError("学習データ読込: learnedItems=" + learnedItems.length + ", docSamples=" + docSamples.length + ", totalRows=" + Math.max(lData.length - 1, 0) + ", learnedRows=" + learnedItems.map(item => item.row).join("/") + ", sampleRows=" + docSamples.map(item => item.row).join("/"));
    }

    const targetTotalChars = 780;
    const maxTotalChars = 800;
    const lengthText = "750〜780文字（最大800文字）";
    const lengthPlan = { openingMin: 0, openingMax: 0, bodyMin: 0, bodyMax: 0, closingMin: 0, closingMax: 0 };

    const apiKey = getGeminiApiKey();
    const apiUrl = "https://generativelanguage.googleapis.com/v1beta/models/" + GEMINI_MODEL + ":generateContent";
    
    // ▼ 修正：学習データを通常ルールより先に置き、文体再現を強制する
    const prompt = `あなたは歯科医院向け営業手紙を作成する専門家です。

${learningContext}

${docSampleContext}

【今回の最重要方針】
今回は固定原稿モードです。AIが自由に営業文を作文してはいけません。
下の【固定原稿】の言い回し・順番・温度感を80%以上維持してください。
変更してよいのは、医院名、院長名、HPから読み取った診療内容や強み、違和感のある接続部分だけです。
上に学習データまたは完成見本がある場合でも、固定原稿の構成を最優先してください。
一般的な営業文らしさや、AIが考えた自己紹介・活動説明は追加しないでください。
固有名詞、医院名、院長名、診療内容だけを今回のホームページ本文に合わせて置き換えてください。
文章は必ず「冒頭」「本文」「締め」の3部に分けて作成してください。
出力時も必ず openingPart、bodyPart、closingPart の3つに分けてください。1つの本文にまとめて出力してはいけません。
openingPartには冒頭だけ、bodyPartには本文だけ、closingPartには締めだけを書いてください。各パート間で同じ文章や同じ話題を繰り返してはいけません。
テンプレートシートの「使用条件」が冒頭・本文・締めのものを、それぞれの構成部品として使ってください。
テンプレートの優先度は 1 が最優先、2 がかなり優先、3 が通常、4 が低め、5 が参考程度です。数字が小さいテンプレートほど強く反映してください。
優先度1のテンプレートは「参考」ではなく必須素材です。ただし、テンプレート原文を複数回貼り付けることは禁止です。意味・話題・言い回しの核を、自然な文章として一度だけ反映してください。
テンプレートシートの「紐づけID」が同じものはセットです。たとえば「自身の経験」と「院長先生との話」が同じIDなら、別々の話題ではなく自然につながる一連の流れとして使ってください。

【必須反映テンプレート（優先度1）】
${mandatoryTemplateContext}

【紐づけテンプレートグループ】
${linkedTemplateContext}

【1. 冒頭パート用テンプレート】
役割: 自己紹介。バイクのライダーに関する要素がテンプレートにある場合は最優先で自然に入れる。
${openingPriorityPlan}

【冒頭パート固定原稿】
以下を主原稿として使い、医院名など必要部分だけ差し替えてください。一般的な歯科勤務経験の自己紹介に作り替えないでください。
${openingFixedBase}

【冒頭パート参考本文】
${openingTemplateContext}

【2. 本文パート用テンプレート】
役割: HPから読み取った医院の強み、忙しさ、発信や採用面の課題を短めに自然につなぐ。
${bodyPriorityPlan}

【本文パート固定原稿】
以下を主原稿として使い、HPに合わせて診療内容・院長名・感じた点だけを少し修正してください。新しい営業説明を増やさないでください。
${bodyFixedBase}

【本文パート参考本文】
${bodyTemplateContext}

【3. 締めパート用テンプレート】
役割: 自分の体験、歯科助手時代のこと、院長先生との話などを入れて、柔らかく相談で締める。
${closingPriorityPlan}

【締めパート固定原稿】
以下を主原稿として使い、内容はほぼ変えず、今回の医院に合う最小修正だけ行ってください。
${closingFixedBase}

【締めパート参考本文】
${closingTemplateContext}

すぐに手紙本文を書かず、内部で必ず次の順番で分析してください。

【分析プロセス】
1. HP本文から医院名候補を読み取る（不明なら空欄）
2. HPで強調されている診療内容を読む
3. 文章量が多いページ・繰り返し出る言葉を読む
4. 院長挨拶・理念・コンセプトを読む
5. 患者向けの強みを整理する
6. 採用・情報発信・求人面の弱みや課題を整理する
7. 学習データと文体サンプルから、クライアントらしい構成を確認する
8. そのうえで ${lengthText} 程度の手紙本文を、冒頭・本文・締めの3部で書く

以下の【ホームページ本文】を深く分析し、上記の【学習データ】と【完成見本】から「クライアントの口調・温度感・課題への触れ方・手紙の流れ」を学び、対象医院専用の自然な営業手紙を作成してください。

【必須の3部構成】
以下の3部だけで作成してください。10段構成のような長い営業文にはしないでください。
1. 冒頭: 宛名、自己紹介、手紙を書いたきっかけを短く自然に入れる。
2. 本文: HPから読み取った具体的な感想と、医院の強み・課題への自然な接続を書く。
3. 締め: 自分の体験や院長先生との話を自然に入れ、柔らかく相談で締め、最後は福満で終える。

【パート別文字数】
冒頭パート: ${lengthPlan.openingMin}〜${lengthPlan.openingMax}文字。短く固定。自己紹介ときっかけだけに絞る。
本文パート: ${lengthPlan.bodyMin}〜${lengthPlan.bodyMax}文字。文章量設定に応じてここだけを調整する。
締めパート: ${lengthPlan.closingMin}〜${lengthPlan.closingMax}文字。冒頭パートと同じ程度の短さにする。
全体: ${lengthText}。全体が長くなりそうな場合は本文パートだけを短くする。

【作成の絶対ルール】
1. 学習データや完成見本がある場合は最優先で反映してください。本文をコピーせず、固有名詞は今回の医院に置き換え、文章量、段落構成、温度感、自己紹介、活動理由、医院への具体的な触れ方、締め方を必ず寄せてください。
2. ただの営業文にせず、HPを実際に読んだことが伝わる具体性を入れること。
3. 弱み・課題は決して責めず、忙しさや手が回らなさとして表現すること。
4. 売り込みすぎず、クライアントの人柄や想いが伝わる温度感にすること。
5. 手紙本文は全体で ${lengthText} 程度で、具体的かつ自然な文章にすること。
6. Markdown記号（**など）や箇条書きは絶対に使わないこと。
7. 学習データがある場合、一般的な営業文の型よりも、学習データの文体・段落順・言い回しの癖を優先すること。
8. 学習見本にない硬い営業表現、広告文のような表現、説明的すぎる表現は避けること。
9. 冒頭パートは自己紹介を担当し、冒頭テンプレートを最優先で反映すること。
10. 本文パートはHP分析を担当し、本文テンプレートを使いながら短めに具体性を出すこと。
11. 締めパートは自分の体験や院長先生との話を担当し、締めテンプレートを最優先で反映すること。
12. 3部を単に貼り合わせるのではなく、最終的に自然な一通の手紙になるよう接続を整えること。
13. 優先度1のテンプレートがある場合、その内容が生成本文に自然に反映されていない出力は禁止です。
14. 優先度1のキーワードは、該当パートにその文字列を必ず入れること。例：「バイクのライダー」は「趣味」などに言い換えず、「バイクのライダー」という文字列を入れる。
15. 優先度2のテンプレートは、優先度1を邪魔しない範囲でできるだけ反映すること。
16. 優先度3以下は文章量と自然さを壊さない範囲で参考にすること。
17. 文字数は必ず ${lengthText} に収めること。指定範囲を超えそうな場合は、HP分析部分を短くし、優先度1テンプレートを残すこと。
18. 優先度1テンプレートと文字数が衝突する場合は、優先度1テンプレートを残し、本文パートを短くすること。
19. テンプレート原文や同じ話題を繰り返さないこと。同じ段落や同じ文が2回以上出る出力は禁止です。
20. ○○歯科、○○院長などの仮置き文字は絶対に残さず、今回の医院名または自然な表現に置き換えること。
21. bodyPartに手紙全体を書かないこと。bodyPartは本文パートだけにすること。
22. openingPartとclosingPartは必ず短くし、文字量を同じ程度にそろえること。
23. 文字数調整はbodyPartだけで行うこと。openingPartとclosingPartを長くして調整してはいけません。
24. openingPart、bodyPart、closingPartはそれぞれ独立して読みやすいが、結合したときに一通の自然な手紙になるよう接続すること。
25. 冒頭パートは一般的な歯科勤務経験の自己紹介を優先しないこと。テンプレートの優先度1キーワードを先に入れること。
26. 固定原稿にない新しい活動説明、きれいすぎる営業文、一般論は追加しないこと。
27. HPに合わせた修正は本文パートに1〜3文まで。冒頭と締めは固定原稿をほぼ維持すること。

【出力形式】
必ず以下のJSONフォーマットで出力してください。Markdownのコードブロックは含めず、純粋なJSON文字列のみを出力してください。
{
  "inferredClinicName": "AIが推測した医院名（例：○○歯科クリニック。不明なら空欄）",
  "openingPart": "冒頭パート。自己紹介を中心に作成",
  "bodyPart": "本文パート。医院HPの分析内容を中心に作成",
  "closingPart": "締めパート。自分の体験や院長先生との話を中心に作成",
  "strengths": [
    "分析した強みを箇条書きで1つ目",
    "分析した強みを箇条書きで2つ目"
  ],
  "weaknesses": [
    "分析した弱みや課題を箇条書きで1つ目",
    "分析した弱みや課題を箇条書きで2つ目"
  ]
}

【文体サンプル（書き方の参考用）】
${availableTemplates}

【ホームページ本文】
${textContent}
`;
    const analysisPrompt = `以下の歯科医院ホームページ本文から、手紙テンプレート差し替え用の情報だけを抽出してください。
文章は作成しないでください。営業文も作らないでください。

【出力形式】
純粋なJSONだけを出力してください。
{
  "inferredClinicName": "医院名。不明なら空欄",
  "doctorName": "院長名または理事長名。不明なら院長先生",
  "hpComment": "HPを見た具体的な感想を1〜2文。120文字以内",
  "strengths": [
    "強み1",
    "強み2"
  ],
  "weaknesses": [
    "課題1",
    "課題2"
  ]
}

【ホームページ本文】
${textContent}`;
    let aiOutput = callGeminiJson(apiUrl, apiKey, analysisPrompt, 0.05);
    const inferredClinicName = aiOutput.inferredClinicName || "";
    const doctorName = aiOutput.doctorName || "院長先生";
    const hpComment = getFirstSentences(aiOutput.hpComment || "", 2, 140);
    const strengths = aiOutput.strengths || [];
    const weaknesses = aiOutput.weaknesses || [];
    const templateVars = {
      clinicName: inferredClinicName,
      doctorName: doctorName,
      hpComment: hpComment,
      strength1: strengths[0] || "",
      strength2: strengths[1] || ""
    };

    const selectedOpeningIds = req.openingTemplateId ? [String(req.openingTemplateId)] : [];
    const selectedClosingIds = []
      .concat(req.closingTemplateId1 ? [String(req.closingTemplateId1)] : [])
      .concat(req.closingTemplateId2 ? [String(req.closingTemplateId2)] : []);
    let fixedOpening = buildSelectedFixedPart(partTemplates, selectedOpeningIds, "冒頭");
    let fixedClosing = buildSelectedFixedPart(partTemplates, selectedClosingIds, "締め");

    let finalOpeningPart = applyTemplateVariables(fixedOpening, templateVars);
    let finalClosingPart = applyTemplateVariables(fixedClosing, templateVars);

    if (!finalOpeningPart) finalOpeningPart = normalizeGeneratedLetter(aiOutput.openingPart || "", inferredClinicName);
    if (!finalClosingPart) finalClosingPart = normalizeGeneratedLetter(aiOutput.closingPart || "", inferredClinicName);
    const fixedChars = countJapaneseChars(finalOpeningPart) + countJapaneseChars(finalClosingPart);
    const targetBodyChars = Math.max(80, targetTotalChars - fixedChars);
    const bodyPrompt = `以下の情報をもとに、歯科医院への営業手紙の「本文パートだけ」を作成してください。
冒頭と締めは別で固定済みです。本文パート以外は絶対に書かないでください。

【本文パートの文字数】
${targetBodyChars}文字ぴったりを目標にしてください。超える場合は短く、足りない場合はHPの具体的な感想を1文足してください。

【対象医院】
医院名: ${inferredClinicName || "不明"}
院長名: ${doctorName}

【HP感想】
${hpComment}

【強み】
${strengths.join(" / ")}

【課題】
${weaknesses.join(" / ")}

【ルール】
1. 本文パートだけを書く。
2. 冒頭の自己紹介を書かない。
3. 締めの相談文を書かない。
4. HPを見た具体的な感想を中心にする。
5. 売り込みすぎない。
6. Markdownや箇条書きは禁止。

【出力形式】
純粋なJSONだけを出力してください。
{
  "bodyPart": "本文パート"
}`;
    const bodyOutput = callGeminiJson(apiUrl, apiKey, bodyPrompt, 0.15);
    let finalBodyPart = normalizeGeneratedLetter(bodyOutput.bodyPart || hpComment, inferredClinicName);
    finalBodyPart = trimPartToMax(finalBodyPart, targetBodyChars);

    let finalLetterBody = composeThreePartLetter(
      finalOpeningPart,
      finalBodyPart,
      finalClosingPart,
      "",
      ""
    );
    let finalCharCount = countJapaneseChars(finalLetterBody);
    if ((finalCharCount < 750 || finalCharCount > targetTotalChars) && fixedChars < targetTotalChars) {
      const adjustedBodyTarget = Math.max(80, targetBodyChars + (targetTotalChars - finalCharCount));
      const adjustPrompt = `以下の本文パートだけを調整してください。
冒頭と締めは固定済みなので、本文パート以外は書かないでください。

【目標文字数】
本文パートを${adjustedBodyTarget}文字に近づけてください。

【現在の本文】
${finalBodyPart}

【医院情報】
医院名: ${inferredClinicName || "不明"}
院長名: ${doctorName}
HP感想: ${hpComment}
強み: ${strengths.join(" / ")}

【出力形式】
純粋なJSONだけを出力してください。
{
  "bodyPart": "調整後の本文パート"
}`;
      const adjusted = callGeminiJson(apiUrl, apiKey, adjustPrompt, 0.1);
      finalBodyPart = trimPartToMax(normalizeGeneratedLetter(adjusted.bodyPart || finalBodyPart, inferredClinicName), adjustedBodyTarget);
      finalLetterBody = composeThreePartLetter(finalOpeningPart, finalBodyPart, finalClosingPart, "", "");
      finalCharCount = countJapaneseChars(finalLetterBody);
    }
    if (finalCharCount > maxTotalChars) {
      const maxBodyChars = Math.max(0, maxTotalChars - countJapaneseChars(finalOpeningPart) - countJapaneseChars(finalClosingPart));
      finalBodyPart = trimPartToMax(finalBodyPart, maxBodyChars);
      finalLetterBody = composeThreePartLetter(finalOpeningPart, finalBodyPart, finalClosingPart, "", "");
      finalCharCount = countJapaneseChars(finalLetterBody);
    }
    if (finalCharCount > maxTotalChars) {
      const maxClosingChars = Math.max(0, maxTotalChars - countJapaneseChars(finalOpeningPart) - countJapaneseChars(finalBodyPart));
      finalClosingPart = trimPartToMax(finalClosingPart, maxClosingChars);
      finalLetterBody = composeThreePartLetter(finalOpeningPart, finalBodyPart, finalClosingPart, "", "");
      finalCharCount = countJapaneseChars(finalLetterBody);
    }
    if (finalCharCount > maxTotalChars) {
      const maxOpeningChars = Math.max(0, maxTotalChars - countJapaneseChars(finalBodyPart) - countJapaneseChars(finalClosingPart));
      finalOpeningPart = trimPartToMax(finalOpeningPart, maxOpeningChars);
      finalLetterBody = composeThreePartLetter(finalOpeningPart, finalBodyPart, finalClosingPart, "", "");
      finalCharCount = countJapaneseChars(finalLetterBody);
    }

    logError("文字数確認: total=" + finalCharCount + ", opening=" + countJapaneseChars(finalOpeningPart) + ", body=" + countJapaneseChars(finalBodyPart) + ", closing=" + countJapaneseChars(finalClosingPart) + ", target=750-780, max=800");
    if (finalCharCount > maxTotalChars) {
      logError("最大800文字を超過: " + finalCharCount + "文字。固定文が長すぎます。");
    } else if (finalCharCount < 750 || finalCharCount > targetTotalChars) {
      logError("750〜780文字との差分: " + finalCharCount + "文字。最大800文字以内には収まっています。");
    }

    return { 
      success: true, 
      inferredClinicName: inferredClinicName,
      openingPart: finalOpeningPart,
      bodyPart: finalBodyPart,
      closingPart: finalClosingPart,
      letterBody: finalLetterBody, 
      strengths: strengths, 
      weaknesses: weaknesses 
    };

  } catch (e) {
    logError("システムエラー(generateDraft): " + e.toString()); 
    return { error: "処理中にエラーが発生しました\n" + e.toString() };
  }
}

// ▼ 修正：デバッグログ追加と保存項目の完全一致
function saveCaseAndDoc(data) {
  try {
    // 問題切り分け用デバッグログ
    logError("saveCaseAndDoc呼び出し: " + JSON.stringify({
      clinicName: data.clinicName,
      url: data.url,
      letterBodyLength: data.letterBody ? data.letterBody.length : 0,
      strengthsCount: data.strengths ? data.strengths.length : 0,
      weaknessesCount: data.weaknesses ? data.weaknesses.length : 0
    }));

    if (!data.letterBody || !data.letterBody.trim()) {
      return { error: "保存する本文がありません。生成文または編集済み本文を入力してください。" };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const FIXED_REQUESTER = "福満様";
    const clinicName = data.clinicName && data.clinicName.trim() ? data.clinicName.trim() : "医院名未設定";
    
    const caseId = generateCaseId();
    const docName = `${caseId}_${clinicName}_営業手紙`;
    const doc = DocumentApp.create(docName);
    doc.getBody().setText(data.letterBody);
    const docUrl = doc.getUrl();

    let mngSheet = ss.getSheetByName("案件管理");
    if (!mngSheet) {
      setupManagementSheet();
      mngSheet = ss.getSheetByName("案件管理");
    }

    const now = new Date();
    const reqDate = data.reqDate || Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd");
    
    const strengthText = (data.strengths || []).map(s => "・" + s).join("\n");
    const weaknessText = (data.weaknesses || []).map(w => "・" + w).join("\n");
    
    // O列に強み、P列に弱みを必ず保存。ステータスは「確認待ち」で統一。
    mngSheet.appendRow([
      caseId, clinicName, data.url || "", docUrl, data.letterBody, FIXED_REQUESTER, reqDate, data.deadline || "", "確認待ち", "", "", 
      Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss"), Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss"), data.memo || "", strengthText, weaknessText
    ]);

    const lastRow = mngSheet.getLastRow();
    mngSheet.getRange("K" + lastRow).setFormula(`=IF(ISBLANK(H${lastRow}), "", H${lastRow} - TODAY())`);
    mngSheet.getRange("J" + lastRow).setFormula(`=IF(I${lastRow}="完了", "完了済み", IF(I${lastRow}="中止", "中止", IF(ISBLANK(H${lastRow}), "締切未設定", IF(K${lastRow}<0, "期限超過", IF(K${lastRow}=0, "本日締切", IF(K${lastRow}=1, "明日締切", IF(K${lastRow}<=3, "3日以内", "余裕あり")))))))`);

    return { success: true, docUrl: docUrl };
  } catch (e) {
    logError("保存エラー(saveCaseAndDoc): " + e.toString()); 
    return { error: "保存中にエラーが発生しました。\n" + e.toString() };
  }
}

function checkDeadlineAndSendMail() {
  const settings = getNotificationSettings();
  if (!settings || !settings.mailEnabled || !settings.recipients) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("案件管理");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  let mailBody = "以下の手紙作成案件の締切が近づいています。\n\n";
  let targetCount = 0;
  for (let i = 1; i < data.length; i++) {
    const row = data[i]; const status = row[8]; const alertMsg = row[9]; const remainDays = parseInt(row[10]);
    if (settings.excludeCompleted && status === "完了") continue;
    if (settings.excludeCanceled && status === "中止") continue;
    if (alertMsg === "締切未設定") continue;
    let isTarget = false;
    if (alertMsg === "期限超過") { if (settings.includeOverdue) isTarget = true; } else if (!isNaN(remainDays) && remainDays <= settings.alertDays) { isTarget = true; }
    if (isTarget) {
      targetCount++;
      mailBody += `--------------------------------------\n案件ID：${row[0]}\n歯科医院名：${row[1]}\n依頼者：${row[5]}\n`;
      mailBody += `締切日：${row[7] ? Utilities.formatDate(new Date(row[7]), "Asia/Tokyo", "yyyy/MM/dd") : "未設定"}\n`;
      mailBody += `ステータス：${status}\n確認アラート：${alertMsg}\n作成内容URL：${row[3]}\n\n`;
    }
  }

  if (targetCount > 0) {
    mailBody += "スプレッドシートを開いて詳細を確認してください。\n" + ss.getUrl();
    MailApp.sendEmail({ to: settings.recipients, subject: "【手紙案件アラート】締切が近い案件があります", body: mailBody });
  }
}

function createDeadlineNotificationTrigger() {
  deleteDeadlineNotificationTrigger();
  ScriptApp.newTrigger('checkDeadlineAndSendMail').timeBased().everyDays(1).atHour(9).create();
}

function deleteDeadlineNotificationTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => { if (t.getHandlerFunction() === 'checkDeadlineAndSendMail') ScriptApp.deleteTrigger(t); });
}
