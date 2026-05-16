/**
 * 既存GAS追加実装 Step1
 *
 * 目的:
 * - 既存のLINE予約・カレンダー同期を壊さず、AI秘書用の不足シートだけ追加する
 * - MakeからHTTP POSTで呼ばれた場合だけ、既存LINE Webhook処理とは別ルートで処理する
 *
 * 既存コード側にすでに存在する前提:
 * - const SS_ID
 * - function writeLog(tag, msg)
 *
 * 追加するシート:
 * - ルール管理
 * - 例外ルール
 * - Zoom管理
 * - 提案管理
 *
 * Step2で追加したMake API:
 * - getAvailableSlots: 空き時間候補を取得
 * - getRotatingZoomUrl: Zoom URLを古い順にローテーション取得
 *
 * Step3で追加したMake API:
 * - getScheduleForMake: 今日・明日・1週間の予定確認
 * - addManualSchedule: 手動予定追加
 * - createConfirmedSchedule: 確定予定作成とZoom URL取得
 *
 * Step5で追加した候補確定:
 * - getAvailableSlotsで候補を提案管理へ保存
 * - createConfirmedScheduleでproposalId + candidateNumberから予定確定
 */

function isMakeApiPayload_(json) {
  return json && !json.events && typeof json.action === 'string' && json.action !== '';
}

function handleMakeApiRequest_(payload) {
  try {
    writeLog('【Make API受信】', payload);

    let result;
    switch (payload.action) {
      case 'health':
        result = {
          message: 'GAS API is running.',
          timestamp: new Date().toISOString()
        };
        break;

      case 'setupAiSecretarySheets':
        result = setupAiSecretarySheets();
        break;

      case 'getAvailableSlots':
        result = getAvailableSlotsForMake_(payload);
        break;

      case 'getRotatingZoomUrl':
        result = getRotatingZoomUrlForMake_();
        break;

      case 'getScheduleForMake':
        result = getScheduleForMake_(payload);
        break;

      case 'addManualSchedule':
        result = addManualScheduleForMake_(payload);
        break;

      case 'createConfirmedSchedule':
        result = createConfirmedScheduleForMake_(payload);
        break;

      default:
        throw new Error('未対応のactionです: ' + payload.action);
    }

    return makeJsonOutput_({
      ok: true,
      action: payload.action,
      result: result
    });
  } catch (err) {
    writeLog('【Make APIエラー】', err.stack || err.message);
    return makeJsonOutput_({
      ok: false,
      action: payload ? payload.action : '',
      error: err.message
    });
  }
}

function makeJsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupAiSecretarySheets() {
  const ss = SpreadsheetApp.openById(SS_ID);

  setupRuleManagementSheet_(ss);
  setupExceptionRuleSheet_(ss);
  setupZoomManagementSheet_(ss);
  setupProposalManagementSheet_(ss);

  writeLog('【AI秘書初期設定】', '不足シートの作成・確認が完了しました。');

  return {
    message: 'AI秘書用の不足シートを作成・確認しました。',
    sheets: ['ルール管理', '例外ルール', 'Zoom管理', '提案管理']
  };
}

function setupRuleManagementSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, 'ルール管理');
  setHeaderIfEmpty_(sheet, ['曜日', '営業開始', '営業終了', '有効', 'メモ']);

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, 7, 5).setValues([
      ['月', '09:00', '18:00', true, ''],
      ['火', '09:00', '18:00', true, ''],
      ['水', '09:00', '18:00', true, ''],
      ['木', '09:00', '18:00', true, ''],
      ['金', '09:00', '18:00', true, ''],
      ['土', '', '', false, ''],
      ['日', '', '', false, '']
    ]);
  }
}

function setupExceptionRuleSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, '例外ルール');
  setHeaderIfEmpty_(sheet, ['日付', '開始', '終了', '種別', 'メモ']);

  if (sheet.getLastRow() <= 1) {
    sheet.appendRow(['2026/05/10', '13:00', '15:00', '空き', '記入例: 臨時で空ける時間']);
    sheet.appendRow(['2026/05/11', '10:00', '12:00', 'ブロック', '記入例: 外出など']);
  }
}

function setupZoomManagementSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, 'Zoom管理');
  setHeaderIfEmpty_(sheet, ['Zoom番号', 'Zoom URL', '最終使用日時', '有効', 'メモ']);

  if (sheet.getLastRow() <= 1) {
    sheet.getRange(2, 1, 5, 5).setValues([
      [1, 'YOUR_ZOOM_URL_1', '', true, ''],
      [2, 'YOUR_ZOOM_URL_2', '', true, ''],
      [3, 'YOUR_ZOOM_URL_3', '', true, ''],
      [4, 'YOUR_ZOOM_URL_4', '', true, ''],
      [5, 'YOUR_ZOOM_URL_5', '', true, '']
    ]);
  }
}

function setupProposalManagementSheet_(ss) {
  const sheet = getOrCreateSheet_(ss, '提案管理');
  setHeaderIfEmpty_(sheet, ['提案ID', 'userId', '件名', '候補日時', 'ステータス', 'Zoom URL', '作成日時', '更新日時']);
}

function getOrCreateSheet_(ss, sheetName) {
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function setHeaderIfEmpty_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return;
  }

  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const hasAnyHeader = current.some(function(value) {
    return String(value || '').trim() !== '';
  });

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function test_setupAiSecretarySheets() {
  Logger.log(JSON.stringify(setupAiSecretarySheets(), null, 2));
}

function getAvailableSlotsForMake_(payload) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const calendarId = getCalendarIdFromSettings_(ss);
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error('カレンダーIDが正しくありません。設定シートB1を確認してください。');

  const slotMinutes = toNumber_(payload.slotMinutes, 60);
  const bufferMinutes = toNumber_(payload.bufferMinutes, 30);
  const maxResults = toNumber_(payload.maxResults, 5);
  const lookaheadDays = toNumber_(payload.lookaheadDays, 14);
  const weekOffset = getWeekOffset_(payload);

  const baseDate = payload.baseDate ? parseDateOnly_(payload.baseDate) : startOfDay_(new Date());
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);

  const businessRules = readBusinessRules_(ss);
  const exceptionRules = readExceptionRules_(ss);
  const slots = [];

  for (let i = 0; i < lookaheadDays && slots.length < maxResults; i++) {
    const targetDate = new Date(baseDate.getTime());
    targetDate.setDate(baseDate.getDate() + i);

    const openWindows = getOpenWindowsForDate_(targetDate, businessRules, exceptionRules);
    if (openWindows.length === 0) continue;

    const events = calendar.getEvents(startOfDay_(targetDate), endOfDay_(targetDate));
    const busyRanges = eventsToBusyRanges_(events, bufferMinutes);
    const exceptionBlocks = getExceptionBlocksForDate_(targetDate, exceptionRules);
    const blockedRanges = busyRanges.concat(exceptionBlocks);

    openWindows.forEach(function(window) {
      const candidates = splitWindowIntoSlots_(window.start, window.end, slotMinutes);
      candidates.forEach(function(slot) {
        if (slots.length >= maxResults) return;
        if (slot.start.getTime() < new Date().getTime()) return;
        if (!overlapsAny_(slot.start, slot.end, blockedRanges)) {
          slots.push(formatSlotForMake_(slot.start, slot.end));
        }
      });
    });
  }

  writeLog('【空き時間候補】', {
    count: slots.length,
    weekOffset: weekOffset,
    slotMinutes: slotMinutes,
    bufferMinutes: bufferMinutes
  });

  const proposalId = saveCandidateProposalForMake_(payload, slots, slotMinutes);

  return {
    proposalId: proposalId,
    slots: slots,
    text: buildAvailableSlotsText_(slots, payload.sourceType, proposalId),
    weekOffset: weekOffset,
    slotMinutes: slotMinutes,
    bufferMinutes: bufferMinutes
  };
}

function getRotatingZoomUrlForMake_() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('Zoom管理');
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error('Zoom管理シートにZoom URLがありません。');
  }

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const candidates = [];

  values.forEach(function(row, index) {
    const zoomNumber = row[0];
    const zoomUrl = String(row[1] || '').trim();
    const lastUsedAt = row[2] ? new Date(row[2]) : null;
    const enabled = normalizeBoolean_(row[3]);

    if (!enabled) return;
    if (!zoomUrl || zoomUrl.indexOf('YOUR_ZOOM_URL') === 0) return;

    candidates.push({
      rowNumber: index + 2,
      zoomNumber: zoomNumber,
      zoomUrl: zoomUrl,
      lastUsedAt: lastUsedAt
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

  writeLog('【Zoom URL取得】', 'Zoom番号 ' + selected.zoomNumber + ' を使用しました。');

  return {
    zoomNumber: selected.zoomNumber,
    zoomUrl: selected.zoomUrl,
    usedAt: Utilities.formatDate(now, 'JST', 'yyyy/MM/dd HH:mm:ss')
  };
}

function getCalendarIdFromSettings_(ss) {
  const sheet = ss.getSheetByName('設定');
  if (!sheet) throw new Error('設定シートが見つかりません。');

  const calendarId = String(sheet.getRange('B1').getValue() || '').trim();
  if (!calendarId) throw new Error('設定シートB1にカレンダーIDを入力してください。');

  return calendarId;
}

function readBusinessRules_(ss) {
  const sheet = ss.getSheetByName('ルール管理');
  if (!sheet || sheet.getLastRow() <= 1) return {};

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const rules = {};

  rows.forEach(function(row) {
    const dayName = String(row[0] || '').trim();
    if (!dayName) return;

    rules[dayName] = {
      start: normalizeTime_(row[1]),
      end: normalizeTime_(row[2]),
      enabled: normalizeBoolean_(row[3])
    };
  });

  return rules;
}

function readExceptionRules_(ss) {
  const sheet = ss.getSheetByName('例外ルール');
  if (!sheet || sheet.getLastRow() <= 1) return [];

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  return rows
    .filter(function(row) {
      return row[0] && row[1] && row[2] && row[3];
    })
    .map(function(row) {
      return {
        date: formatDate_(row[0], 'yyyy/MM/dd'),
        start: normalizeTime_(row[1]),
        end: normalizeTime_(row[2]),
        type: String(row[3] || '').trim(),
        memo: String(row[4] || '')
      };
    });
}

function getOpenWindowsForDate_(date, businessRules, exceptionRules) {
  const dayName = getJapaneseDayName_(date);
  const dateKey = formatDate_(date, 'yyyy/MM/dd');
  const windows = [];
  const rule = businessRules[dayName];

  if (rule && rule.enabled && rule.start && rule.end) {
    windows.push({
      start: combineDateAndTime_(date, rule.start),
      end: combineDateAndTime_(date, rule.end)
    });
  }

  exceptionRules.forEach(function(rule) {
    if (rule.date !== dateKey) return;
    if (rule.type === '空き') {
      windows.push({
        start: combineDateAndTime_(date, rule.start),
        end: combineDateAndTime_(date, rule.end)
      });
    }
  });

  return windows.filter(function(window) {
    return window.end.getTime() > window.start.getTime();
  });
}

function getExceptionBlocksForDate_(date, exceptionRules) {
  const dateKey = formatDate_(date, 'yyyy/MM/dd');
  return exceptionRules
    .filter(function(rule) {
      return rule.date === dateKey && rule.type === 'ブロック';
    })
    .map(function(rule) {
      return {
        start: combineDateAndTime_(date, rule.start),
        end: combineDateAndTime_(date, rule.end)
      };
    });
}

function eventsToBusyRanges_(events, bufferMinutes) {
  return events.map(function(event) {
    return {
      start: new Date(event.getStartTime().getTime() - bufferMinutes * 60000),
      end: new Date(event.getEndTime().getTime() + bufferMinutes * 60000)
    };
  });
}

function splitWindowIntoSlots_(start, end, slotMinutes) {
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

function overlapsAny_(start, end, ranges) {
  return ranges.some(function(range) {
    return start.getTime() < range.end.getTime() && end.getTime() > range.start.getTime();
  });
}

function buildAvailableSlotsText_(slots, sourceType, proposalId) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  if (!slots || slots.length === 0) {
    lines.push('条件に合う空き時間が見つかりませんでした。別の日程で再度確認します。');
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

function formatSlotForMake_(start, end) {
  return {
    start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate_(end, 'yyyy/MM/dd HH:mm'),
    label: formatDate_(start, 'MM/dd') + '(' + getJapaneseDayName_(start) + ') ' + formatDate_(start, 'HH:mm') + ' - ' + formatDate_(end, 'HH:mm')
  };
}

function getWeekOffset_(payload) {
  if (payload.weekOffset !== undefined && payload.weekOffset !== '') {
    return toNumber_(payload.weekOffset, 0);
  }

  const text = String(payload.text || payload.keyword || '');
  return text.indexOf('次週') !== -1 || text.indexOf('来週') !== -1 ? 1 : 0;
}

function parseDateOnly_(value) {
  if (value instanceof Date) return startOfDay_(value);

  const date = new Date(String(value).replace(/-/g, '/') + ' 00:00:00');
  if (isNaN(date.getTime())) throw new Error('日付形式が正しくありません: ' + value);
  return date;
}

function combineDateAndTime_(date, timeText) {
  const parts = normalizeTime_(timeText).split(':');
  const result = startOfDay_(date);
  result.setHours(Number(parts[0]), Number(parts[1]), 0, 0);
  return result;
}

function normalizeTime_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, 'JST', 'HH:mm');
  }

  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return '';

  return ('0' + Number(match[1])).slice(-2) + ':' + match[2];
}

function normalizeBoolean_(value) {
  if (value === true) return true;
  const text = String(value || '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 'yes' || text === '有効';
}

function startOfDay_(date) {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay_(date) {
  const result = new Date(date.getTime());
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatDate_(date, pattern) {
  return Utilities.formatDate(new Date(date), 'JST', pattern);
}

function getJapaneseDayName_(date) {
  return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
}

function toNumber_(value, defaultValue) {
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

function test_getAvailableSlotsForMake() {
  Logger.log(JSON.stringify(getAvailableSlotsForMake_({
    slotMinutes: 60,
    bufferMinutes: 30,
    maxResults: 5,
    weekOffset: 0
  }), null, 2));
}

function test_getRotatingZoomUrlForMake() {
  Logger.log(JSON.stringify(getRotatingZoomUrlForMake_(), null, 2));
}

function getScheduleForMake_(payload) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const calendarId = getCalendarIdFromSettings_(ss);
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error('カレンダーIDが正しくありません。設定シートB1を確認してください。');

  const period = resolveSchedulePeriodForMake_(payload);
  const events = calendar.getEvents(period.start, period.end);
  const schedules = events.map(function(event) {
    return {
      title: event.getTitle(),
      start: formatDate_(event.getStartTime(), 'yyyy/MM/dd HH:mm'),
      end: formatDate_(event.getEndTime(), 'yyyy/MM/dd HH:mm'),
      allDay: event.isAllDayEvent(),
      description: event.getDescription() || ''
    };
  });

  writeLog('【予定確認API】', {
    range: payload.range || 'today',
    count: schedules.length
  });

  return {
    range: payload.range || 'today',
    label: period.label,
    schedules: schedules,
    text: buildScheduleTextForMake_(period.label, schedules, payload.sourceType)
  };
}

function addManualScheduleForMake_(payload) {
  validateSchedulePayloadForMake_(payload);

  const ss = SpreadsheetApp.openById(SS_ID);
  const calendarId = getCalendarIdFromSettings_(ss);
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error('カレンダーIDが正しくありません。設定シートB1を確認してください。');

  const title = String(payload.title || '').trim();
  const start = parseDateTime_(payload.start);
  const end = payload.end
    ? parseDateTime_(payload.end)
    : new Date(start.getTime() + toNumber_(payload.durationMinutes, 60) * 60000);

  if (end.getTime() <= start.getTime()) {
    throw new Error('終了日時は開始日時より後にしてください。');
  }

  const description = String(payload.description || 'Makeから手動追加').trim();
  const event = calendar.createEvent(title, start, end, {
    description: description
  });

  writeLog('【手動予定追加API】', {
    title: title,
    start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate_(end, 'yyyy/MM/dd HH:mm')
  });

  return {
    eventId: event.getId(),
    title: title,
    start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate_(end, 'yyyy/MM/dd HH:mm'),
    text: buildManualAddedTextForMake_(title, start, end, payload.sourceType)
  };
}

function createConfirmedScheduleForMake_(payload) {
  const resolved = resolveConfirmedSchedulePayload_(payload);
  validateSchedulePayloadForMake_(resolved);

  const ss = SpreadsheetApp.openById(SS_ID);
  const calendarId = getCalendarIdFromSettings_(ss);
  const calendar = CalendarApp.getCalendarById(calendarId);
  if (!calendar) throw new Error('カレンダーIDが正しくありません。設定シートB1を確認してください。');

  const title = String(resolved.title || '').trim();
  const start = parseDateTime_(resolved.start);
  const end = resolved.end
    ? parseDateTime_(resolved.end)
    : new Date(start.getTime() + toNumber_(resolved.durationMinutes, 60) * 60000);

  if (end.getTime() <= start.getTime()) {
    throw new Error('終了日時は開始日時より後にしてください。');
  }

  let zoomUrl = String(resolved.zoomUrl || '').trim();
  if (!zoomUrl && resolved.useZoom !== false) {
    zoomUrl = getRotatingZoomUrlForMake_().zoomUrl;
  }

  const descriptionLines = [];
  if (resolved.description) descriptionLines.push(String(resolved.description));
  if (zoomUrl) descriptionLines.push('Zoom: ' + zoomUrl);

  const event = calendar.createEvent(title, start, end, {
    description: descriptionLines.join('\n')
  });

  markProposalConfirmedForMake_(resolved, event.getId(), zoomUrl, start);

  writeLog('【確定予定作成API】', {
    title: title,
    start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate_(end, 'yyyy/MM/dd HH:mm'),
    hasZoom: !!zoomUrl
  });

  return {
    eventId: event.getId(),
    title: title,
    start: formatDate_(start, 'yyyy/MM/dd HH:mm'),
    end: formatDate_(end, 'yyyy/MM/dd HH:mm'),
    zoomUrl: zoomUrl,
    proposalId: resolved.proposalId || '',
    candidateNumber: resolved.candidateNumber || null,
    text: buildConfirmedScheduleTextForMake_(title, start, end, zoomUrl, resolved.sourceType)
  };
}

function resolveSchedulePeriodForMake_(payload) {
  const range = String(payload.range || 'today').trim();
  const now = new Date();

  if (payload.startDate && payload.endDate) {
    const customStart = startOfDay_(parseDateOnly_(payload.startDate));
    const customEnd = endOfDay_(parseDateOnly_(payload.endDate));
    return {
      start: customStart,
      end: customEnd,
      label: formatDate_(customStart, 'yyyy/MM/dd') + ' - ' + formatDate_(customEnd, 'yyyy/MM/dd') + ' の予定'
    };
  }

  if (range === 'tomorrow' || range === '明日') {
    const date = addDays_(now, 1);
    return {
      start: startOfDay_(date),
      end: endOfDay_(date),
      label: '明日の予定'
    };
  }

  if (range === 'week' || range === '1週間' || range === '一週間') {
    return {
      start: startOfDay_(now),
      end: endOfDay_(addDays_(now, 7)),
      label: '1週間の予定'
    };
  }

  return {
    start: startOfDay_(now),
    end: endOfDay_(now),
    label: '今日の予定'
  };
}

function buildScheduleTextForMake_(label, schedules, sourceType) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  lines.push('[' + label + ']');
  lines.push('');

  if (!schedules || schedules.length === 0) {
    lines.push('予定はありません。');
    return lines.join('\n');
  }

  schedules.forEach(function(item) {
    lines.push(item.start + ' - ' + item.end);
    lines.push(item.title);
    if (item.description) lines.push(item.description);
    lines.push('');
  });

  return lines.join('\n').trim();
}

function buildManualAddedTextForMake_(title, start, end, sourceType) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  lines.push('予定を登録しました。');
  lines.push('件名: ' + title);
  lines.push('日時: ' + formatDate_(start, 'yyyy/MM/dd HH:mm') + ' - ' + formatDate_(end, 'HH:mm'));

  return lines.join('\n');
}

function buildConfirmedScheduleTextForMake_(title, start, end, zoomUrl, sourceType) {
  const lines = [];

  if (sourceType === 'user') {
    lines.push('以下のメッセージを転送してお使いください。');
    lines.push('');
  }

  lines.push('日程が確定しました。');
  lines.push('件名: ' + title);
  lines.push('日時: ' + formatDate_(start, 'yyyy/MM/dd HH:mm') + ' - ' + formatDate_(end, 'HH:mm'));
  if (zoomUrl) lines.push('Zoom: ' + zoomUrl);

  return lines.join('\n');
}

function validateSchedulePayloadForMake_(payload) {
  if (!payload.title || String(payload.title).trim() === '') {
    throw new Error('title が必要です。');
  }
  if (!payload.start || String(payload.start).trim() === '') {
    throw new Error('start が必要です。例: 2026/05/10 13:00');
  }
}

function saveCandidateProposalForMake_(payload, slots, slotMinutes) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('提案管理');
  if (!sheet) return '';
  if (!slots || slots.length === 0) return '';

  const proposalId = payload.proposalId || createProposalId_();
  const now = new Date();
  const title = String(payload.title || payload.subject || '日程調整').trim();
  const data = {
    slots: slots,
    title: title,
    durationMinutes: slotMinutes,
    sourceType: payload.sourceType || '',
    userId: payload.userId || '',
    createdAt: now.toISOString()
  };

  sheet.appendRow([
    proposalId,
    payload.userId || '',
    title,
    JSON.stringify(data),
    '候補提示',
    '',
    now,
    now
  ]);

  return proposalId;
}

function resolveConfirmedSchedulePayload_(payload) {
  if (payload.proposalId && payload.candidateNumber) {
    const proposal = findProposalForMake_(payload.proposalId);
    const candidateIndex = toNumber_(payload.candidateNumber, 1) - 1;
    if (candidateIndex < 0 || candidateIndex >= proposal.slots.length) {
      throw new Error('候補番号が範囲外です: ' + payload.candidateNumber);
    }

    const selected = proposal.slots[candidateIndex];
    return {
      proposalId: payload.proposalId,
      candidateNumber: payload.candidateNumber,
      title: payload.title || proposal.title || '日程調整',
      start: selected.start,
      end: selected.end,
      durationMinutes: payload.durationMinutes || proposal.durationMinutes || 60,
      useZoom: payload.useZoom,
      zoomUrl: payload.zoomUrl || '',
      description: payload.description || '提案ID: ' + payload.proposalId,
      sourceType: payload.sourceType || proposal.sourceType || '',
      userId: payload.userId || proposal.userId || ''
    };
  }

  return payload;
}

function findProposalForMake_(proposalId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('提案管理');
  if (!sheet || sheet.getLastRow() <= 1) {
    throw new Error('提案管理シートに候補がありません。');
  }

  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]) !== String(proposalId)) continue;

      const raw = String(rows[i][3] || '');
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error('提案ID ' + proposalId + ' の候補データを読み取れません。');
      }

      return {
        rowNumber: i + 2,
        proposalId: proposalId,
        userId: rows[i][1] || parsed.userId || '',
        title: rows[i][2] || parsed.title || '',
        slots: parsed.slots || [],
        durationMinutes: parsed.durationMinutes || 60,
        sourceType: parsed.sourceType || '',
        status: rows[i][4] || ''
      };
  }

  throw new Error('提案IDが見つかりません: ' + proposalId);
}

function markProposalConfirmedForMake_(payload, eventId, zoomUrl, start) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('提案管理');
  if (!sheet) return;

  const now = new Date();

  if (payload.proposalId) {
    try {
      const proposal = findProposalForMake_(payload.proposalId);
      sheet.getRange(proposal.rowNumber, 5).setValue('確定');
      sheet.getRange(proposal.rowNumber, 6).setValue(zoomUrl || '');
      sheet.getRange(proposal.rowNumber, 8).setValue(now);
      return;
    } catch (err) {
      writeLog('【提案管理更新エラー】', err.message);
    }
  }

  sheet.appendRow([
    payload.proposalId || eventId,
    payload.userId || '',
    payload.title || '',
    formatDate_(start, 'yyyy/MM/dd HH:mm'),
    '確定',
    zoomUrl || '',
    now,
    now
  ]);
}

function createProposalId_() {
  return 'P' + Utilities.formatDate(new Date(), 'JST', 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 8);
}

function parseDateTime_(value) {
  if (value instanceof Date) return value;

  const date = new Date(String(value).replace(/-/g, '/').replace('T', ' '));
  if (isNaN(date.getTime())) throw new Error('日時形式が正しくありません: ' + value);
  return date;
}

function addDays_(date, days) {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function test_getScheduleForMake() {
  Logger.log(JSON.stringify(getScheduleForMake_({
    range: 'today',
    sourceType: 'group'
  }), null, 2));
}

function test_addManualScheduleForMake() {
  Logger.log(JSON.stringify(addManualScheduleForMake_({
    title: 'テスト予定',
    start: formatDate_(addDays_(new Date(), 1), 'yyyy/MM/dd') + ' 13:00',
    durationMinutes: 30,
    sourceType: 'group'
  }), null, 2));
}
