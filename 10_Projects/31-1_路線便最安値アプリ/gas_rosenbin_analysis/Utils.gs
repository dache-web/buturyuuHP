/**
 * Utils.gs
 * 共通で使用するユーティリティ関数をまとめたモジュール
 */

const Utils = {
  /**
   * UUID v4形式のユニークなIDを生成する
   * @returns {string} UUID
   */
  generateUUID: function() {
    return Utilities.getUuid();
  },

  /**
   * 推測困難な登録用トークンを生成する
   * @returns {string} ランダムなトークン文字列
   */
  generateToken: function() {
    return Utilities.getUuid() + '-' + new Date().getTime().toString(36);
  },

  /**
   * 有効フラグを判定する
   * @param {any} val 判定する値
   * @returns {boolean} 有効であればtrue
   */
  isValidFlag: function(val) {
    if (val === true) return true;
    if (typeof val === 'string') {
      const s = val.trim().toLowerCase();
      if (s === 'true' || s === '1' || s === '有効') return true;
    }
    if (typeof val === 'number') {
      return val === 1;
    }
    return false;
  },

  /**
   * エラー有無を判定する (エラーなしであればtrue)
   * @param {any} val 判定する値
   * @returns {boolean} エラーなしであればtrue
   */
  isNoErrorFlag: function(val) {
    if (val === false) return true; // エラーなし
    if (!val && val !== 0) return true; // null, undefined, 空文字などはエラーなしとする場合（要件に合わせて厳格化）
    if (typeof val === 'string') {
      const s = val.trim().toLowerCase();
      // 空文字、false、0、なし、エラーなし の場合はエラーなし(true)
      if (s === '' || s === 'false' || s === '0' || s === 'なし' || s === 'エラーなし') return true;
    }
    if (typeof val === 'number') {
      return val === 0;
    }
    return false;
  },

  /**
   * 日付オブジェクトまたは日付文字列を、yyyy/MM/dd形式の文字列に変換する
   * 日付として無効な場合は空文字を返す
   * @param {any} dateVal 変換する日付データ
   * @returns {string} フォーマット済みの日付文字列
   */
  formatDate: function(dateVal) {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      const yyyy = d.getFullYear();
      const MM = ('0' + (d.getMonth() + 1)).slice(-2);
      const dd = ('0' + d.getDate()).slice(-2);
      return `${yyyy}/${MM}/${dd}`;
    } catch (e) {
      return '';
    }
  },
  
  /**
   * 年月（YYYY/MM または YYYY-MM など）から、YYYY-MMの形式に統一する
   * (画面表示は2026-07などとするため)
   * @param {any} ymVal 変換する対象年月
   * @returns {string} フォーマット済みの年月文字列（例：2026-07）
   */
  formatYearMonth: function(ymVal) {
    if (!ymVal) return '';
    const str = String(ymVal).trim();
    // '2026年07月', '2026-07', '2026/07' などに対応
    const match = str.match(/^(\d{4})[-\/年]?(\d{1,2})月?$/);
    if (match) {
      const y = match[1];
      const m = ('0' + match[2]).slice(-2);
      return `${y}-${m}`;
    }
    return str;
  },

  /**
   * 処理を排他制御(LockService)で実行する
   * @param {Function} callback 実行する処理
   */
  withLock: function(callback) {
    const lock = LockService.getScriptLock();
    try {
      if (lock.tryLock(30000)) {
        return callback();
      } else {
        throw new Error('他の処理が実行中のためロックを取得できませんでした。しばらく待ってから再実行してください。');
      }
    } finally {
      lock.releaseLock();
    }
  },
  
  /**
   * 詳細なエラーログを記録する
   */
  logDetailedError: function(processName, functionName, error, extraInfo) {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('42_エラーログ');
      if (sheet) {
        const errorId = this.generateUUID();
        const now = new Date();
        const stackTrace = error.stack || '';
        const msg = error.message || String(error);
        
        sheet.appendRow([
          errorId, '', processName, functionName, '', 
          'システムエラー', msg, 
          `詳細: ${extraInfo || ''}\nスタック: ${stackTrace}`.substring(0, 1000), 
          now, '未対応', ''
        ]);
      }
    } catch(e) {
      // ログ記録の失敗は無視
      console.error('Error logging failed:', e);
    }
  }
};
