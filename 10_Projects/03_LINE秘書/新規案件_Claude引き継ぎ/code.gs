/**
 * LINE秘書 新規案件用 GAS
 *
 * 目的:
 * - Make から HTTP POST で呼び出すAPIとして使う
 * - Googleカレンダーの予定確認、空き時間計算、予定追加、Zoom URLローテーションを行う
 *
 * 初回作業:
 * 1. 新しいGoogleスプレッドシートを作成
 * 2. このコードを新しいGASプロジェクトへ貼り付け
 * 3. SS_ID に新しいスプレッドシートIDを入れる
 * 4. setupInitialSheets() を1回実行
 * 5. 設定シートにカレンダーID、必要に応じてLINE_TOKENなどを入力
 * 6. Webアプリとしてデプロイ
 */

// =========================
// 基本設定
// =========================

const SS_ID = 'YOUR_SPREADSHEET_ID';
const DEFAULT_TIMEZONE = 'Asia/Tokyo';
const DEFAULT_SLOT_MINUTES = 60;
const DEFAULT_BUFFER_MINUTES = 30;
const DEFAULT_LOOKAHEAD_DAYS = 14;

const SHEET_NAMES = {
  SETTINGS: '設定',
  RULES: 'ルール管理',
  EXCEPTIONS: '例外ルール',
  ZOOM: 'Zoom管理',
  LOG: 'ログ',
  ERROR_HISTORY: 'エラー履歴',
  USERS: 'ユーザー管理',
  PROPOSALS: '提案管理'
};

// =========================
// Web API
// =========================

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : '';

  if (action === 'health') {
    return jsonOutput({
      ok: true,
      message: 'LINE秘書 GAS API is running.',
      timestamp: new Date().toISOString()
    });
  }

  return jsonOutput({
    ok: true,
    message: 'LINE秘書 GAS APIです。MakeからPOSTで呼び出してください。',
    availableActions: [
      'setupInitialSheets',
      'getAvailableSlots',
      'getRotatingZoomUrl',
      'getSchedule',
      'addManualSchedule',
      'createConfirmedSchedule',
      'getRescheduleCandidates'
    ]
  });
}

function doPost(e) {
  try {
    const payload = parseRequestBody(e);
    const action = payload.action || '';
    writeLog('API受信', JSON.stringify(payload));

    let result;

    switch (action) {
      case 'health':
        result = {
          message: 'LINE秘書 GAS API is running.',
          timestamp: new Date().toISOString()
        };
        break;
      case 'setupInitialSheets':
      case 'setupAiSecretarySheets':
        result = setupInitialSheets();
        break;
      case 'getAvailableSlots':
        result = getAvailableSlots(payload);
        break;
      case 'getRotatingZoomUrl':
        result = getRotatingZoomUrl(payload);
        break;
      case 'getSchedule':
      case 'getScheduleForMake':
        result = getSchedule(payload);
        break;
      case 'addManualSchedule':
        result = addManualSchedule(payload);
        break;
      case 'createConfirmedSchedule':
        result = createConfirmedSchedule(payload);
        break;
      case 'getRescheduleCandidates':
        result = getRescheduleCandidates(payload);
        break;
      default:
        throw new Error('action が指定されていないか、未対応です: ' + action);
    }

    return jsonOutput({
      ok: true,
      action: action,
      result: result
    });
  } catch (err) {
    writeLog('APIエラー', err.stack || err.message);
    writeErrorLog('APIエラー', err.stack || err.message);
    return jsonOutput({
      ok: false,
      error: err.message
    });
  }
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) return {};

  const text = e.postData.contents;
  try {
    return JSON.parse(text);
  } catch (err) {
    const obj = {};
    text.split('&').forEach(function(pair) {
      const parts = pair.split('=');
      if (parts[0]) {
        obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
      }
    });
    return obj;
  }
}

function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

// =========================
// 初期セットアップ
// =========================

function setupInitialSheets() {
  const ss = getSpreadsheet();

  setupSettingsSheet(ss);
  setupRulesSheet(ss);
  setupExceptionSheet(ss);
  setupZoomSheet(ss);
  setupLogSheet(ss);
  setupErrorHistorySheet(ss);
  setupUsersSheet(ss);
  setupProposalsSheet(ss);

  writeLog('初期設定', '必要なシートを作成または確認しました。');
  return {
    message: '初期シート作成が完了しました。',
    spreadsheetUrl: ss.getUrl(),
    sheets: Object.keys(SHEET_NAMES).map(function(key) { return SHEET_NAMES[key]; })
  };
}

function setupSettingsSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.SETTINGS);
  setHeaderIfEmpty(sheet, ['項目', '値', '説明']);
  upsertSettingRow(sheet, 'カレンダーID', 'YOUR_CALENDAR_ID', '空欄の場合はデフォルトカレンダーを使います');
  upsertSettingRow(sheet, 'LINE_TOKEN', 'YOUR_LINE_TOKEN', 'MakeでLINE返信する場合は未使用でもOK');
  upsertSettingRow(sheet, 'GAS_WEB_APP_URL', 'YOUR_GAS_WEB_APP_URL', 'デプロイ後に入力');
  upsertSettingRow(sheet, 'MAKE_WEBHOOK_URL', 'YOUR_MAKE_WEBHOOK_URL', 'LINE Webhookに設定するMake URL');
  upsertSettingRow(sheet, '標準予定時間_分', String(DEFAULT_SLOT_MINUTES), '空き時間候補の標準時間');
  upsertSettingRow(sheet, 'バッファ_分', String(DEFAULT_BUFFER_MINUTES), '予定の前後に空ける時間');
  upsertSettingRow(sheet, '候補表示日数', String(DEFAULT_LOOKAHEAD_DAYS), '空き時間を探す最大日数');
}

function setupRulesSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.RULES);
  setHeaderIfEmpty(sheet, ['曜日', '営業開始', '営業終了', '有効', 'メモ']);

  const defaults = [
    ['月', '09:00', '18:00', true, ''],
    ['火', '09:00', '18:00', true, ''],
    ['水', '09:00', '18:00', true, ''],
    ['木', '09:00', '18:00', true, ''],
    ['金', '09:00', '18:00', true, ''],
    ['土', '', '', false, ''],
    ['日', '', '', false, '']
  ];

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, defaults.length, defaults[0].length).setValues(defaults);
  }
}

function setupExceptionSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.EXCEPTIONS);
  setHeaderIfEmpty(sheet, ['日付', '開始', '終了', '種別', 'メモ']);
  if (sheet.getLastRow() <= 1) {
    sheet.appendRow(['2026/05/10', '13:00', '15:00', '空き', '記入例: 臨時で空ける時間']);
    sheet.appendRow(['2026/05/11', '10:00', '12:00', 'ブロック', '記入例: 外出など']);
  }
}

function setupZoomSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.ZOOM);
  setHeaderIfEmpty(sheet, ['Zoom番号', 'Zoom URL', '最終使用日時', '有効', 'メモ']);
  if (sheet.getLastRow() <= 1) {
    const rows = [];
    for (let i = 1; i <= 5; i++) {
      rows.push([i, 'YOUR_ZOOM_URL_' + i, '', true, '']);
    }
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function setupLogSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.LOG);
  setHeaderIfEmpty(sheet, ['日時', '種類', '内容']);
}

function setupErrorHistorySheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.ERROR_HISTORY);
  setHeaderIfEmpty(sheet, ['日時', '区分', '内容']);
}

function setupUsersSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.USERS);
  setHeaderIfEmpty(sheet, ['userId', '表示名', '種別', '最終利用日時', 'メモ']);
}

function setupProposalsSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.PROPOSALS);
  setHeaderIfEmpty(sheet, ['提案ID', 'userId', '件名', '候補日時', 'ステータス', 'Zoom URL', '作成日時', '更新日時']);
}

// =========================
// 空き時間計算
// =========================

function getAvailableSlots(payload) {
  const ss = getSpreadsheet();
  const calendar = getCalendar(ss);
  const slotMinutes = toNumber(payload.slotMinutes, getSettingNumber(ss, '標準予定時間_分', DEFAULT_SLOT_MINUTES));
  const bufferMinutes = toNumber(payload.bufferMinutes, getSettingNumber(ss, 'バッファ_分', DEFAULT_BUFFER_MINUTES));
  const maxResults = toNumber(payload.maxResults, 5);
  const lookaheadDays = toNumber(payload.lookaheadDays, getSettingNumber(ss, '候補表示日数', DEFAULT_LOOKAHEAD_DAYS));
  const weekOffset = normalizeWeekOffset(payload);

  const baseDate = payload.baseDate ? parseDateOnly(payload.baseDate) : startOfToday();
  baseDate.setDate(baseDate.getDate() + (weekOffset * 7));

  const rules = readBusinessRules(ss);
  const exceptions = readExceptionRules(ss);
  const slots = [];

  for (let dayOffset = 0; dayOffset < lookaheadDays && slots.length < maxResults; dayOffset++) {
    const targetDate = new Date(baseDate.getTime());
    targetDate.setDate(baseDate.getDate() + dayOffset);

    const windows = getOpenWindowsForDate(targetDate, rules, exceptions);
    if (windows.length === 0) continue;

    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);
    const events = calendar.getEvents(dayStart, dayEnd);
    const busyRanges = eventsToBusyRanges(events, bufferMinutes);
    const exceptionBlocks = getExceptionBlocks(targetDate, exceptions);
    const allBlocks = busyRanges.concat(exceptionBlocks);

    windows.forEach(function(window) {
      const candidates = splitWindowIntoSlots(window.start, window.end, slotMinutes);
      candidates.forEach(function(candidate) {
        if (slots.length >= maxResults) return;
        if (candidate.start.getTime() < new Date().getTime()) return;
        if (!overlapsAny(candidate.start, candidate.end, allBlocks)) {
          slots.push(formatSlot(candidate.start, candidate.end));
        }
      });
    });
  }

  const proposal = saveSlotProposalIfNeeded(payload, slots);

  return {
    proposalId: proposal ? proposal.proposalId : '',
    slots: slots,
    message: slots.length > 0 ? '空き時間候補を取得しました。' : '条件に合う空き時間が見つかりませんでした。',
    text: formatAvailableSlotsForLine(slots, payload.sourceType, proposal ? proposal.proposalId : ''),
    weekOffset: weekOffset,
    slotMinutes: slotMinutes,
    bufferMinutes: bufferMinutes
  };
}

function getRescheduleCandidates(payload) {
  const nextPayload = Object.assign({}, payload);
  if (nextPayload.weekOffset === undefined && String(nextPayload.keyword || '').indexOf('次週') !== -1) {
    nextPayload.weekOffset = 1;
  }
  const result = getAvailableSlots(nextPayload);
  return {
    message: 'リスケ候補を取得しました。',
    slots: result.slots,
    weekOffset: result.weekOffset
  };
}

function readBusinessRules(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.RULES);
  if (!sheet || sheet.getLastRow() <= 1) return {};

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const rules = {};

  values.forEach(function(row) {
    const dayName = String(row[0] || '').trim();
    if (!dayName) return;
    rules[dayName] = {
      start: normalizeTime(row[1]),
      end: normalizeTime(row[2]),
      enabled: normalizeBoolean(row[3])
    };
  });

  return rules;
}

function readExceptionRules(ss) {
  const sheet = ss.getSheetByName(SHEET_NAMES.EXCEPTIONS);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  return values
    .filter(function(row) { return row[0] && row[1] && row[2] && row[3]; })
    .map(function(row) {
      return {
        date: formatDate(row[0], 'yyyy/MM/dd'),
        start: normalizeTime(row[1]),
        end: normalizeTime(row[2]),
        type: String(row[3]).trim(),
        memo: String(row[4] || '')
      };
    });
}

function getOpenWindowsForDate(date, rules, exceptions) {
  const dateKey = formatDate(date, 'yyyy/MM/dd');
  const dayName = getJapaneseDayName(date);
  const windows = [];
  const rule = rules[dayName];

  if (rule && rule.enabled && rule.start && rule.end) {
    windows.push({
      start: combineDateAndTime(date, rule.start),
      end: combineDateAndTime(date, rule.end)
    });
  }

  exceptions.forEach(function(rule) {
    if (rule.date !== dateKey) return;
    if (rule.type === '空き') {
      windows.push({
        start: combineDateAndTime(date, rule.start),
        end: combineDateAndTime(date, rule.end)
      });
    }
  });

  return windows.filter(function(window) {
    return window.end.getTime() > window.start.getTime();
  });
}

function getExceptionBlocks(date, exceptions) {
  const dateKey = formatDate(date, 'yyyy/MM/dd');
  return exceptions
    .filter(function(rule) { return rule.date === dateKey && rule.type === 'ブロック'; })
    .map(function(rule) {
      return {
        start: combineDateAndTime(date, rule.start),
        end: combineDateAndTime(date, rule.end)
      };
    });
}

function eventsToBusyRanges(events, bufferMinutes) {
  return events.map(function(event) {
    return {
      start: new Date(event.getStartTime().getTime() - bufferMinutes * 60000),
      end: new Date(event.getEndTime().getTime() + bufferMinutes * 60000)
    };
  });
}

function splitWindowIntoSlots(start, end, slotMinutes) {
  const slots = [];
  let cursor = new Date(start.getTime());

  while (cursor.getTime() + slotMinutes * 60000 <= end.getTime()) {
    const slotEnd = new Date(cursor.getTime() + slotMinutes * 60000);
    slots.push({
      start: new Date(cursor.getTime()),
      end: slotEnd
    });
    cursor = new Date(cursor.getTime() + slotMinutes * 60000);
  }

  return slots;
}

function overlapsAny(start, end, ranges) {
  return ranges.some(function(range) {
    return start.getTime() < range.end.getTime() && end.getTime() > range.start.getTime();
  });
}

// =========================
// Zoom URLローテーション
// =========================

function getRotatingZoomUrl(payload) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.ZOOM);
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error('Zoom管理シートにZoom URLがありません。');
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const candidates = [];

  values.forEach(function(row, index) {
    const url = String(row[1] || '').trim();
    const enabled = normalizeBoolean(row[3]);
    if (!url || url.indexOf('YOUR_ZOOM_URL') === 0 || !enabled) return;

    candidates.push({
      rowNumber: index + 2,
      zoomNumber: row[0],
      url: url,
      lastUsedAt: row[2] ? new Date(row[2]) : null
    });
  });

  if (candidates.length === 0) {
    throw new Error('有効なZoom URLがありません。Zoom管理シートを確認してください。');
  }

  candidates.sort(function(a, b) {
    const aTime = a.lastUsedAt ? a.lastUsedAt.getTime() : 0;
    const bTime = b.lastUsedAt ? b.lastUsedAt.getTime() : 0;
    return aTime - bTime;
  });

  const selected = candidates[0];
  const now = new Date();
  sheet.getRange(selected.rowNumber, 3).setValue(now);

  writeLog('Zoom取得', 'Zoom番号: ' + selected.zoomNumber + ' を使用しました。');

  return {
    zoomNumber: selected.zoomNumber,
    zoomUrl: selected.url,
    usedAt: now.toISOString()
  };
}

// =========================
// 予定確認・追加・確定
// =========================

function getSchedule(payload) {
  const ss = getSpreadsheet();
  const calendar = getCalendar(ss);
  const range = payload.range || 'today';
  const period = resolveSchedulePeriod(range, payload);
  const events = calendar.getEvents(period.start, period.end);

  const schedules = events.map(function(event) {
    return {
      title: event.getTitle(),
      start: formatDate(event.getStartTime(), 'yyyy/MM/dd HH:mm'),
      end: formatDate(event.getEndTime(), 'yyyy/MM/dd HH:mm'),
      allDay: event.isAllDayEvent(),
      description: event.getDescription() || ''
    };
  });

  return {
    range: range,
    label: period.label,
    schedules: schedules,
    text: formatScheduleMessage(period.label, schedules)
  };
}

function addManualSchedule(payload) {
  validateSchedulePayload(payload);

  const ss = getSpreadsheet();
  const calendar = getCalendar(ss);
  const start = parseDateTime(payload.start);
  const end = payload.end
    ? parseDateTime(payload.end)
    : new Date(start.getTime() + toNumber(payload.durationMinutes, DEFAULT_SLOT_MINUTES) * 60000);
  const title = String(payload.title).trim();
  const description = String(payload.description || '');

  if (end.getTime() <= start.getTime()) {
    throw new Error('終了日時は開始日時より後にしてください。');
  }

  const event = calendar.createEvent(title, start, end, {
    description: description
  });

  writeLog('予定追加', title + ' / ' + formatDate(start, 'yyyy/MM/dd HH:mm'));

  return {
    eventId: event.getId(),
    title: title,
    start: formatDate(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate(end, 'yyyy/MM/dd HH:mm'),
    text: '予定を登録しました。\n' + formatDate(start, 'yyyy/MM/dd HH:mm') + '\n' + title
  };
}

function createConfirmedSchedule(payload) {
  const resolved = resolveConfirmedSchedulePayload(payload);
  validateSchedulePayload(resolved);

  const ss = getSpreadsheet();
  const calendar = getCalendar(ss);
  const start = parseDateTime(resolved.start);
  const end = resolved.end
    ? parseDateTime(resolved.end)
    : new Date(start.getTime() + toNumber(resolved.durationMinutes, DEFAULT_SLOT_MINUTES) * 60000);
  const title = String(resolved.title).trim();
  let zoomUrl = String(resolved.zoomUrl || '').trim();

  if (!zoomUrl && resolved.useZoom !== false) {
    zoomUrl = getRotatingZoomUrl({}).zoomUrl;
  }

  const descriptionLines = [];
  if (resolved.description) descriptionLines.push(String(resolved.description));
  if (zoomUrl) descriptionLines.push('Zoom: ' + zoomUrl);

  const event = calendar.createEvent(title, start, end, {
    description: descriptionLines.join('\n')
  });

  updateConfirmedProposal(resolved, event.getId(), zoomUrl);
  writeLog('確定予定作成', title + ' / ' + formatDate(start, 'yyyy/MM/dd HH:mm'));

  return {
    eventId: event.getId(),
    title: title,
    start: formatDate(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate(end, 'yyyy/MM/dd HH:mm'),
    zoomUrl: zoomUrl,
    proposalId: resolved.proposalId || '',
    candidateNumber: resolved.candidateNumber || '',
    text: buildConfirmedScheduleMessage(title, start, end, zoomUrl, resolved.sourceType)
  };
}

function validateSchedulePayload(payload) {
  if (!payload.title) throw new Error('title が必要です。');
  if (!payload.start) throw new Error('start が必要です。例: 2026/05/10 13:00');
}

function saveSlotProposalIfNeeded(payload, slots) {
  if (!slots || slots.length === 0) return null;
  if (!payload.userId && !payload.title && !payload.saveProposal) return null;

  const ss = getSpreadsheet();
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.PROPOSALS);
  setHeaderIfEmpty(sheet, ['提案ID', 'userId', '件名', '候補日時', 'ステータス', 'Zoom URL', '作成日時', '更新日時']);

  const now = new Date();
  const proposalId = payload.proposalId || generateProposalId(now);
  const title = String(payload.title || '予定').trim();

  sheet.appendRow([
    proposalId,
    payload.userId || '',
    title,
    JSON.stringify(slots),
    '候補提示',
    '',
    now,
    now
  ]);

  writeLog('候補保存', proposalId + ' / ' + slots.length + '件');
  return {
    proposalId: proposalId,
    title: title
  };
}

function resolveConfirmedSchedulePayload(payload) {
  const resolved = Object.assign({}, payload);
  if (!resolved.proposalId && !resolved.candidateNumber) return resolved;
  if (!resolved.proposalId) {
    throw new Error('直前の候補が見つかりませんでした。もう一度、日程調整からお願いします。');
  }
  if (!resolved.candidateNumber) {
    throw new Error('何番の候補にするか教えてください。例: 1番でお願いします');
  }

  const proposal = findProposalById(resolved.proposalId);
  if (!proposal) {
    throw new Error('直前の候補が見つかりませんでした。もう一度、日程調整からお願いします。');
  }

  const index = toNumber(resolved.candidateNumber, 0) - 1;
  if (index < 0 || index >= proposal.slots.length) {
    throw new Error('候補番号が範囲外です。1〜' + proposal.slots.length + '番から選んでください。');
  }

  const slot = proposal.slots[index];
  resolved.start = slot.start;
  resolved.end = slot.end;
  resolved.title = resolved.title || proposal.title || '予定';
  resolved.userId = resolved.userId || proposal.userId || '';
  resolved.proposalRowNumber = proposal.rowNumber;
  return resolved;
}

function findProposalById(proposalId) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.PROPOSALS);
  if (!sheet || sheet.getLastRow() <= 1) return null;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]).trim() !== String(proposalId).trim()) continue;
    return {
      rowNumber: i + 2,
      proposalId: values[i][0],
      userId: values[i][1],
      title: values[i][2],
      slots: parseProposalSlots(values[i][3]),
      status: values[i][4]
    };
  }

  return null;
}

function parseProposalSlots(value) {
  try {
    const slots = JSON.parse(String(value || '[]'));
    if (Array.isArray(slots)) return slots;
  } catch (err) {
    throw new Error('候補日時の保存形式が正しくありません。もう一度、日程調整からお願いします。');
  }
  return [];
}

function updateConfirmedProposal(payload, eventId, zoomUrl) {
  const ss = getSpreadsheet();
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.PROPOSALS);
  setHeaderIfEmpty(sheet, ['提案ID', 'userId', '件名', '候補日時', 'ステータス', 'Zoom URL', '作成日時', '更新日時']);

  const now = new Date();
  if (payload.proposalRowNumber) {
    sheet.getRange(payload.proposalRowNumber, 5).setValue('確定');
    sheet.getRange(payload.proposalRowNumber, 6).setValue(zoomUrl || '');
    sheet.getRange(payload.proposalRowNumber, 8).setValue(now);
    return;
  }

  if (!payload.proposalId && !payload.userId) return;
  sheet.appendRow([
    payload.proposalId || eventId,
    payload.userId || '',
    payload.title || '',
    payload.start || '',
    '確定',
    zoomUrl || '',
    now,
    now
  ]);
}

function generateProposalId(date) {
  const base = Utilities.formatDate(date, DEFAULT_TIMEZONE, 'yyyyMMddHHmmss');
  const random = Utilities.getUuid().slice(0, 8);
  return 'P' + base + '-' + random;
}

// =========================
// Make/LINE向けテキスト整形
// =========================

function formatScheduleMessage(label, schedules) {
  if (!schedules || schedules.length === 0) {
    return label + '\n\n予定はありません。';
  }

  const lines = [label, ''];
  schedules.forEach(function(item) {
    lines.push(item.start + ' - ' + item.end);
    lines.push(item.title);
    if (item.description) lines.push(item.description);
    lines.push('');
  });

  return lines.join('\n').trim();
}

function buildConfirmedScheduleMessage(title, start, end, zoomUrl, sourceType) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  lines.push('日程が確定しました。');
  lines.push('件名: ' + title);
  lines.push('日時: ' + formatDate(start, 'yyyy/MM/dd HH:mm') + ' - ' + formatDate(end, 'HH:mm'));
  if (zoomUrl) lines.push('Zoom: ' + zoomUrl);

  return lines.join('\n');
}

function formatAvailableSlotsForLine(slots, sourceType, proposalId) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  if (!slots || slots.length === 0) {
    lines.push('現在、条件に合う候補が見つかりませんでした。別の日程で再度確認します。');
    return lines.join('\n');
  }

  lines.push('候補日時はこちらです。');
  if (proposalId) lines.push('提案ID: ' + proposalId);
  slots.forEach(function(slot, index) {
    lines.push((index + 1) + '. ' + slot.label);
  });
  lines.push('');
  lines.push('ご都合のよい番号をお知らせください。');

  return lines.join('\n');
}

// =========================
// 設定・共通処理
// =========================

function getSpreadsheet() {
  if (!SS_ID || SS_ID === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('SS_ID に新しいスプレッドシートIDを設定してください。');
  }
  return SpreadsheetApp.openById(SS_ID);
}

function getCalendar(ss) {
  const calendarId = getSettingValue(ss, 'カレンダーID');
  if (calendarId && calendarId !== 'YOUR_CALENDAR_ID') {
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) throw new Error('カレンダーIDが正しくありません: ' + calendarId);
    return calendar;
  }
  return CalendarApp.getDefaultCalendar();
}

function getSettingValue(ss, key) {
  const sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet || sheet.getLastRow() <= 1) return '';

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === key) return String(values[i][1] || '').trim();
  }
  return '';
}

function getSettingNumber(ss, key, defaultValue) {
  const value = Number(getSettingValue(ss, key));
  return isNaN(value) ? defaultValue : value;
}

function getOrCreateSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function setHeaderIfEmpty(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return;
  }

  const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasHeader = firstRow.some(function(value) { return String(value || '').trim() !== ''; });
  if (!hasHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function upsertSettingRow(sheet, key, value, description) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]).trim() === key) return;
    }
  }
  sheet.appendRow([key, value, description]);
}

function writeLog(type, message) {
  try {
    const ss = getSpreadsheet();
    const sheet = getOrCreateSheet(ss, SHEET_NAMES.LOG);
    setHeaderIfEmpty(sheet, ['日時', '種類', '内容']);
    sheet.appendRow([new Date(), type, message]);
  } catch (err) {
    console.error('ログ記録失敗: ' + err.message);
  }
}

function writeErrorLog(type, message) {
  try {
    const ss = getSpreadsheet();
    const sheet = getOrCreateSheet(ss, SHEET_NAMES.ERROR_HISTORY);
    setHeaderIfEmpty(sheet, ['日時', '区分', '内容']);
    sheet.appendRow([new Date(), type, message]);
  } catch (err) {
    console.error('エラー履歴記録失敗: ' + err.message);
  }
}

// =========================
// 日時ユーティリティ
// =========================

function resolveSchedulePeriod(range, payload) {
  const now = new Date();
  let start;
  let end;
  let label;

  if (range === 'tomorrow' || range === '明日') {
    start = startOfDay(addDays(now, 1));
    end = endOfDay(addDays(now, 1));
    label = '明日の予定';
  } else if (range === 'week' || range === '1週間' || range === '一週間') {
    start = startOfDay(now);
    end = endOfDay(addDays(now, 7));
    label = '1週間の予定';
  } else if (payload && payload.startDate && payload.endDate) {
    start = startOfDay(parseDateOnly(payload.startDate));
    end = endOfDay(parseDateOnly(payload.endDate));
    label = formatDate(start, 'yyyy/MM/dd') + ' - ' + formatDate(end, 'yyyy/MM/dd') + ' の予定';
  } else {
    start = startOfDay(now);
    end = endOfDay(now);
    label = '今日の予定';
  }

  return { start: start, end: end, label: label };
}

function normalizeWeekOffset(payload) {
  if (payload.weekOffset !== undefined && payload.weekOffset !== '') {
    return toNumber(payload.weekOffset, 0);
  }
  const keyword = String(payload.keyword || payload.text || '');
  return keyword.indexOf('次週') !== -1 || keyword.indexOf('来週') !== -1 ? 1 : 0;
}

function parseDateTime(value) {
  if (value instanceof Date) return value;
  const normalized = String(value).replace(/-/g, '/').replace('T', ' ');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) throw new Error('日時形式が正しくありません: ' + value);
  return date;
}

function parseDateOnly(value) {
  if (value instanceof Date) return startOfDay(value);
  const normalized = String(value).replace(/-/g, '/');
  const date = new Date(normalized + ' 00:00:00');
  if (isNaN(date.getTime())) throw new Error('日付形式が正しくありません: ' + value);
  return date;
}

function combineDateAndTime(date, time) {
  const parts = normalizeTime(time).split(':');
  const result = startOfDay(date);
  result.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
  return result;
}

function normalizeTime(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, DEFAULT_TIMEZONE, 'HH:mm');
  }
  const text = String(value || '').trim();
  if (!text) return '';
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';
  return ('0' + Number(match[1])).slice(-2) + ':' + match[2];
}

function normalizeBoolean(value) {
  if (value === true) return true;
  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === '有効';
}

function toNumber(value, defaultValue) {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

function startOfToday() {
  return startOfDay(new Date());
}

function startOfDay(date) {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date) {
  const result = new Date(date.getTime());
  result.setHours(23, 59, 59, 999);
  return result;
}

function addDays(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date, pattern) {
  return Utilities.formatDate(new Date(date), DEFAULT_TIMEZONE, pattern);
}

function getJapaneseDayName(date) {
  return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
}

function formatSlot(start, end) {
  return {
    start: formatDate(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate(end, 'yyyy/MM/dd HH:mm'),
    label: formatDate(start, 'MM/dd') + '(' + getJapaneseDayName(start) + ') ' + formatDate(start, 'HH:mm') + ' - ' + formatDate(end, 'HH:mm')
  };
}

// =========================
// 手動テスト用
// =========================

function test_setupInitialSheets() {
  Logger.log(JSON.stringify(setupInitialSheets(), null, 2));
}

function test_setupAiSecretarySheets() {
  test_setupInitialSheets();
}

function test_getAvailableSlots() {
  const result = getAvailableSlots({
    title: 'テスト商談',
    userId: 'TEST_USER',
    slotMinutes: 60,
    bufferMinutes: 30,
    maxResults: 5,
    weekOffset: 0
  });
  Logger.log(JSON.stringify(result, null, 2));
}

function test_getAvailableSlotsForMake() {
  test_getAvailableSlots();
}

function test_getScheduleToday() {
  const result = getSchedule({ range: 'today' });
  Logger.log(JSON.stringify(result, null, 2));
}

function test_getScheduleForMake() {
  test_getScheduleToday();
}

function test_getRotatingZoomUrlForMake() {
  const result = getRotatingZoomUrl({});
  Logger.log(JSON.stringify(result, null, 2));
}

function test_addManualScheduleForMake() {
  const tomorrow = addDays(new Date(), 1);
  tomorrow.setHours(13, 0, 0, 0);
  const result = addManualSchedule({
    title: 'テスト予定',
    start: formatDate(tomorrow, 'yyyy/MM/dd HH:mm'),
    durationMinutes: 60,
    description: 'GAS手動テスト'
  });
  Logger.log(JSON.stringify(result, null, 2));
}
