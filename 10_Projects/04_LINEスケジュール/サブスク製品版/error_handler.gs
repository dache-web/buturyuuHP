/**
 * @file error_handler.gs
 * @description 🚨 エラー担当：ログ記録と例外処理を管理
 */

function writeLog(tag, msg) {
  try {
    const ss = SpreadsheetApp.openById(SS_ID);
    let logSheet = ss.getSheetByName('ログ') || ss.insertSheet('ログ');
    logSheet.appendRow([new Date(), tag, msg]);
  } catch (e) {
    console.error("ログ記録失敗: " + e.message);
  }
}

function handleCriticalError(err) {
  writeLog("【致命的エラー】", err.message + "\n" + err.stack);
  // 必要に応じて管理者（あなた）にLINE通知を飛ばす処理をここに追加
}
