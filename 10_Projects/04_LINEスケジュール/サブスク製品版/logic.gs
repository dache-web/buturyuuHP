/**
 * @file logic.gs
 * @description 💳 サブスク担当：ユーザー状態、ステータス、予約カウントの管理
 */

const SS_ID = '1fzyCPgSwPi3ac__FnrUXHxb_tuk_5YkNfA3N-Xj0-cw';

/**
 * ユーザーの会員ランク取得
 */
function getUserPlan(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('サブスク管理') || ss.insertSheet('サブスク管理');
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) {
    // ヘッダー作成
    sheet.appendRow(['userId', 'plan', 'regCount', 'fincodeId', 'expiryDate']);
    return { plan: 'None', regCount: 0 };
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      return { 
        plan: data[i][1] || 'None', 
        regCount: parseInt(data[i][2]) || 0 
      };
    }
  }
  
  // 未登録ユーザー
  sheet.appendRow([userId, 'None', 0]);
  return { plan: 'None', regCount: 0 };
}

/**
 * 予約数のカウントアップ
 */
function incrementUsageCount(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('サブスク管理');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      const currentCount = parseInt(data[i][2]) || 0;
      sheet.getRange(i + 1, 3).setValue(currentCount + 1);
      return;
    }
  }
}

/**
 * 一時保存ステータスの更新
 */
function updateStatus(userId, updates) {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sheet = ss.getSheetByName('一時保存') || ss.insertSheet('一時保存');
  const data = sheet.getDataRange().getValues();
  const headers = data[0].length ? data[0] : ['userId', 'date', 'status', 'isDetailed', 'title', 'meet'];
  if (!data[0].length) sheet.appendRow(headers);
  
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) { rowIndex = i + 1; break; }
  }
  
  if (rowIndex === -1) {
    sheet.appendRow([userId]);
    rowIndex = sheet.getLastRow();
  }
  
  for (let key in updates) { 
    const col = headers.indexOf(key) + 1;
    if (col > 0) sheet.getRange(rowIndex, col).setValue(updates[key]);
  }
}

/**
 * 一時保存ステータスの取得
 */
function getStatus(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('一時保存');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = data[i][idx]; });
      return obj;
    }
  }
  return null;
}

/**
 * ステータス消去
 */
function clearStatus(userId) {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName('一時保存');
  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === userId) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
  }
}
