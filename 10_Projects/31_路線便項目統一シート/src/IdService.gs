/**
 * ID発番サービス
 */
class IdService {
  /**
   * 指定されたプレフィックスを使用して一意のIDを生成します。
   * 形式: PREFIX-YYYYMMDD-連番4桁 (例: CAR-20260801-0001)
   * @param {string} prefix - 発番するIDの接頭辞（例: 'CAR'）
   * @return {string} 生成されたID
   */
  static generateId(prefix) {
    if (!prefix) return "";
    
    const props = PropertiesService.getScriptProperties();
    // タイムゾーン設定を考慮して今日の日付文字列を取得
    const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Asia/Tokyo", "yyyyMMdd");
    const propKey = `ID_SEQ_${prefix}_${todayStr}`;
    
    // スクリプトプロパティによるシーケンス管理。
    // ※LockServiceを使用して同時実行時の重複を防ぐ
    const lock = LockService.getScriptLock();
    let id = "";
    
    try {
      lock.waitLock(10000); // 最大10秒待機
      let seq = parseInt(props.getProperty(propKey) || "0", 10);
      seq += 1;
      props.setProperty(propKey, seq.toString());
      
      const paddingStr = ("0000" + seq).slice(-4);
      id = `${prefix}-${todayStr}-${paddingStr}`;
      
    } catch (e) {
      console.error("ID発番中にエラーが発生しました: " + e.message);
      throw new Error("ID発番に失敗しました。");
    } finally {
      lock.releaseLock();
    }
    
    return id;
  }
}
