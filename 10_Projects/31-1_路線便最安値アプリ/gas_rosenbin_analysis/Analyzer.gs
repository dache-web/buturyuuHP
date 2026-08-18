/**
 * Analyzer.gs
 * 分析実行ロジック
 */

const Analyzer = {
  // 分析対象の全必須列 (システム全体で利用する列)
  REQUIRED_COLS: [
    '標準化データID', '原本データID', '対象年月', '出荷日', 
    '路線便会社コード', '路線便会社名', '出荷元コード', '届け先コード', 
    '届け先名称', '実績運賃', '有効フラグ', 'エラー有無'
  ],

  /**
   * メイン分析処理
   * @param {Object} params - UIからのパラメータ
   */
  runAnalysis: function(params) {
    const analysisId = Utils.generateUUID();
    const startTime = new Date();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. 各社のデータ取得と統合
    const integratedData = this.fetchAndIntegrateData(params.selectedCompanies, params.targetMonth, analysisId);
    
    if (integratedData.data.length === 0) {
      throw new Error('指定された条件に一致する有効なデータが1件もありませんでした。');
    }

    // 2. 統合データ（04_分析用データ用）を作成して一時保存
    // 04_分析用データのヘッダー定義
    const integratedHeaders = [
      '分析用データID', '原本データID', '対象年月', '出荷日', 
      '路線便会社コード', '路線便会社名', '出荷元コード', '出荷元名', 
      '届け先コード', '届け先名称', '届け先郵便番号', '届け先住所', 
      '都道府県', '市区町村', '個数', '重量', 'サイズ', '実績運賃', 
      '有効フラグ', 'エラー有無', '管理番号', '特記事項', 
      '更新処理ID', '更新状態', '更新開始日時'
    ];
    
    const outputData04 = [integratedHeaders];
    const validDataForCalc = [];

    integratedData.data.forEach(rowObj => {
      const rowArr = integratedHeaders.map(colName => {
        if (colName === '分析用データID') return Utils.generateUUID();
        if (colName === '更新処理ID') return analysisId;
        if (colName === '更新状態') return '完了';
        if (colName === '更新開始日時') return startTime;
        return rowObj[colName] !== undefined ? rowObj[colName] : '';
      });
      outputData04.push(rowArr);
      validDataForCalc.push(rowObj);
    });

    SheetManager.safeWriteToSheet('04_分析用データ', analysisId, outputData04);

    // 3. 各種分析集計
    // （全体分析、会社別分析、届け先別分析の簡易実装）
    const totalCalc = this.calculateTotal(validDataForCalc, params, analysisId);
    const companyCalc = this.calculateByCompany(validDataForCalc, params, analysisId);
    const destCalc = this.calculateByDestination(validDataForCalc, params, analysisId);

    // ヘッダーを付けて配列化
    const outTotal = [SheetManager.REQUIRED_SHEETS['20_全体分析'][0], totalCalc];
    const outCompany = [SheetManager.REQUIRED_SHEETS['21_路線会社別分析'][0], ...companyCalc];
    const outDest = [SheetManager.REQUIRED_SHEETS['23_届け先別分析'][0], ...destCalc];

    SheetManager.safeWriteToSheet('20_全体分析', analysisId, outTotal);
    SheetManager.safeWriteToSheet('21_路線会社別分析', analysisId, outCompany);
    SheetManager.safeWriteToSheet('23_届け先別分析', analysisId, outDest);

    // 4. 分析実行履歴の記録
    const histId = Utils.generateUUID();
    const endTime = new Date();
    const execTimeStr = Math.floor((endTime - startTime) / 1000) + '秒';
    const currentUser = Session.getActiveUser().getEmail() || '取得不可';
    
    SheetManager.appendRowToSheet('40_分析実行履歴', [
      histId, params.targetMonth, params.compareMonth || '', 
      params.selectedCompanies.length, integratedData.totalRead, 
      validDataForCalc.length, 0, // エラーデータは有効フラグで弾いているためここでは0
      0, 0, 0, 0, // 新規出荷元などは今回は0
      currentUser, startTime, endTime, execTimeStr, '成功'
    ]);

    return { analysisId: analysisId, count: validDataForCalc.length };
  },

  /**
   * 選択された会社のシートからデータを取得し、指定期間でフィルタリングして結合する
   */
  fetchAndIntegrateData: function(selectedCompanies, targetMonth, analysisId) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allCompanies = SheetManager.getActiveRouteCompanies();
    let integrated = [];
    let totalRead = 0;
    const globalIds = new Set(); // 重複チェック用（外部直接参照時のエラー検知用）

    for (const compCode of selectedCompanies) {
      const compInfo = allCompanies.find(c => c.code === compCode);
      if (!compInfo) continue;

      let sheet;
      let isExternal = false;
      if (compInfo.sourceType === '外部シート直接参照') {
        if (!compInfo.ssId || !compInfo.sheetName) {
          throw new Error(`設定不備: ${compInfo.name} の外部シート情報が不足しています。`);
        }
        try {
          const extSs = SpreadsheetApp.openById(compInfo.ssId);
          sheet = extSs.getSheetByName(compInfo.sheetName);
          isExternal = true;
        } catch(e) {
          throw new Error(`権限エラー/ファイル不在: ${compInfo.name} の外部シートを開けませんでした。`);
        }
      } else {
        if (!compInfo.sheetName) {
          throw new Error(`設定不備: ${compInfo.name} の保存先シート名が未設定です。`);
        }
        sheet = ss.getSheetByName(compInfo.sheetName);
      }

      if (!sheet) {
        throw new Error(`シート不在: ${compInfo.name} のデータシートが見つかりません。`);
      }

      // 数値としてそのまま計算に使うためgetValuesを使用
      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) continue;
      const headers = data[0];
      
      // 必須列（12列）の確認
      const missingCols = this.REQUIRED_COLS.filter(c => headers.indexOf(c) === -1);
      if (missingCols.length > 0) {
        throw new Error(`必須列不足: ${compInfo.name} のシートに必須列(${missingCols.join(', ')})が不足しています。`);
      }
      
      const idIdx = headers.indexOf('標準化データID');
      const ymIdx = headers.indexOf('対象年月');
      const codeIdx = headers.indexOf('路線便会社コード');
      const validIdx = headers.indexOf('有効フラグ');
      const errIdx = headers.indexOf('エラー有無');

      const companyIds = new Set();

      for (let r = 1; r < data.length; r++) {
        const row = data[r];
        totalRead++;
        
        // 有効フラグ、エラー、期間の確認
        if (!Utils.isValidFlag(row[validIdx])) continue;
        if (!Utils.isNoErrorFlag(row[errIdx])) continue;
        
        const rowYm = Utils.formatYearMonth(row[ymIdx]);
        const targetYm = Utils.formatYearMonth(targetMonth);
        if (rowYm !== targetYm) continue;

        // 会社コードの整合性確認
        const rowCode = String(row[codeIdx]).trim();
        if (rowCode !== compCode) {
          throw new Error(`会社コード不一致: ${compInfo.name} のシート内に別の会社コード(${rowCode})が混入しています。\n標準化データID: ${row[idIdx]}`);
        }

        // 重複チェック
        const stdId = String(row[idIdx]).trim();
        if (companyIds.has(stdId)) {
          // 外部・内部問わず、シート内に重複があれば分析停止
          throw new Error(`重複エラー: ${compInfo.name} のシート内で標準化データID(${stdId})が重複しています。修正してください。`);
        }
        companyIds.add(stdId);
        
        // 統合用のオブジェクト生成（ヘッダー名ベース）
        const rowObj = {};
        for (let c = 0; c < headers.length; c++) {
          rowObj[headers[c]] = row[c];
        }
        integrated.push(rowObj);
      }
    }

    return {
      data: integrated,
      totalRead: totalRead
    };
  },

  /**
   * 全体集計ロジック
   */
  calculateTotal: function(dataArray, params, analysisId) {
    let unchinCalcCount = 0;
    let unchinMiss = 0;
    let kosuMiss = 0;
    let weightMiss = 0;
    let totalUnchin = 0;
    let totalKosu = 0;
    let totalWeight = 0;

    dataArray.forEach(row => {
      // 数値チェックと欠損カウント
      let u = parseFloat(row['実績運賃']);
      let k = parseFloat(row['個数']);
      let w = parseFloat(row['重量']);

      const hasU = !isNaN(u);
      const hasK = !isNaN(k);
      const hasW = !isNaN(w);

      if (!hasU) unchinMiss++;
      if (!hasK) kosuMiss++;
      if (!hasW) weightMiss++;

      if (hasU) {
        unchinCalcCount++;
        totalUnchin += u;
        if (hasK) totalKosu += k;
        if (hasW) totalWeight += w;
      }
    });

    const avgPerItem = unchinCalcCount > 0 ? totalUnchin / unchinCalcCount : 0;
    const avgPerKosu = totalKosu > 0 ? totalUnchin / totalKosu : 0;
    const avgPerKg = totalWeight > 0 ? totalUnchin / totalWeight : 0;

    return [
      analysisId, params.targetMonth, params.compareMonth || '', params.selectedCompanies.length,
      dataArray.length, // 全取得は統合後ベースでここでは等しいとする
      dataArray.length, // 有効出荷件数
      unchinCalcCount, unchinMiss, kosuMiss, weightMiss, 0,
      totalUnchin, totalKosu, totalWeight, 
      avgPerItem, avgPerKosu, avgPerKg,
      0, 0, 0, 0, 0, 0, new Date() // 比較等は未実装
    ];
  },

  /**
   * 会社別集計ロジック
   */
  calculateByCompany: function(dataArray, params, analysisId) {
    const compMap = {};
    dataArray.forEach(row => {
      const code = row['路線便会社コード'];
      const name = row['路線便会社名'];
      if (!compMap[code]) {
        compMap[code] = {
          name: name,
          count: 0, totalUnchin: 0, totalKosu: 0, totalWeight: 0,
          destSet: new Set()
        };
      }
      const c = compMap[code];
      c.count++;
      c.destSet.add(row['届け先コード']);
      
      let u = parseFloat(row['実績運賃']);
      let k = parseFloat(row['個数']);
      let w = parseFloat(row['重量']);
      if (!isNaN(u)) {
        c.totalUnchin += u;
        if (!isNaN(k)) c.totalKosu += k;
        if (!isNaN(w)) c.totalWeight += w;
      }
    });

    const results = [];
    for (const [code, c] of Object.entries(compMap)) {
      const avgP = c.count > 0 ? c.totalUnchin / c.count : 0;
      const avgK = c.totalKosu > 0 ? c.totalUnchin / c.totalKosu : 0;
      const avgW = c.totalWeight > 0 ? c.totalUnchin / c.totalWeight : 0;
      results.push([
        analysisId, code, c.name, c.totalUnchin, c.count, c.totalKosu, c.totalWeight,
        avgP, avgK, avgW, 0, c.destSet.size
      ]);
    }
    return results;
  },

  /**
   * 届け先別集計ロジック
   */
  calculateByDestination: function(dataArray, params, analysisId) {
    const destMap = {};
    dataArray.forEach(row => {
      const dCode = row['届け先コード'];
      if (!destMap[dCode]) {
        destMap[dCode] = {
          name: row['届け先名称'],
          zip: row['届け先郵便番号'], addr: row['届け先住所'],
          pref: row['都道府県'], city: row['市区町村'],
          count: 0, totalUnchin: 0, totalKosu: 0, totalWeight: 0,
          compSet: new Set()
        };
      }
      const d = destMap[dCode];
      d.count++;
      d.compSet.add(row['路線便会社名']);
      
      let u = parseFloat(row['実績運賃']);
      let k = parseFloat(row['個数']);
      let w = parseFloat(row['重量']);
      if (!isNaN(u)) {
        d.totalUnchin += u;
        if (!isNaN(k)) d.totalKosu += k;
        if (!isNaN(w)) d.totalWeight += w;
      }
    });

    const results = [];
    for (const [code, d] of Object.entries(destMap)) {
      const avgP = d.count > 0 ? d.totalUnchin / d.count : 0;
      const comps = Array.from(d.compSet).join(',');
      // 届け先IDはマスタから引くべきだが今回はコードをそのまま使うか簡易UUID
      results.push([
        analysisId, code, code, d.name, d.zip, d.addr, d.pref, d.city,
        d.totalUnchin, d.count, d.totalKosu, d.totalWeight, avgP,
        d.compSet.size, comps, 0
      ]);
    }
    return results;
  }
};
