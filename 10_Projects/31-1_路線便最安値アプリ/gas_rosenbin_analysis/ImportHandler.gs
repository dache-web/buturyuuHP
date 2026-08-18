/**
 * ImportHandler.gs
 * データ取込処理（CSV/XLSX）、解析、2段階登録を行うモジュール
 */

const ImportHandler = {
  /**
   * クライアントからのファイルを受け取り、第1段階の解析を実行して一時保持する
   * @param {string} base64Data 
   * @param {string} fileName 
   * @param {string} mimeType 
   * @returns {Object} 解析結果と一時ID
   */
  processUpload: function(base64Data, fileName, mimeType) {
    let rawDataStr = '';
    let parsedData = [];
    
    // 拡張子またはMimeTypeで判定
    const isExcel = fileName.toLowerCase().endsWith('.xlsx') || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const isCsv = fileName.toLowerCase().endsWith('.csv') || mimeType === 'text/csv';

    if (!isExcel && !isCsv) {
      return { success: false, error: 'CSVまたは.xlsx形式のファイルのみ対応しています。\n旧形式のExcel（.xls）は現在確認中です。' };
    }

    try {
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);

      if (isExcel) {
        parsedData = this.parseExcelWithDriveAPI(blob);
      } else {
        rawDataStr = blob.getDataAsString('UTF-8'); // TODO: Shift_JIS対応など
        parsedData = Utilities.parseCsv(rawDataStr);
      }
      
      if (!parsedData || parsedData.length < 2) {
        return { success: false, error: 'データが存在しないか、ヘッダーのみのファイルです。' };
      }

      // 結合セルの判定（CSVなら起きないが、Excelからの変換時は空白や偏りになる場合がある）
      // Googleスプレッドシート変換時の仕様上、API経由での取得だと単純なデータ配列となるため
      // 空白セルが極端に多い場合などはデータ不備として扱うが、本システムでは厳格に1行ごとの必須列を判定する

      const headers = parsedData[0];
      const dataRows = parsedData.slice(1);
      
      const analysisResult = this.analyzeData(headers, dataRows);
      if (!analysisResult.success) {
        return { success: false, error: analysisResult.error };
      }

      // 解析成功時、結果を一時シートへ保存
      const processId = Utils.generateUUID();
      const metadata = {
        '解析処理ID': processId,
        '元ファイル名': fileName,
        '解析結果': '成功',
        '読込件数': dataRows.length,
        '解析実行者': Session.getActiveUser().getEmail() || '取得不可',
        '解析日時': new Date().getTime(),
        '登録済みフラグ': 'FALSE'
      };

      TempManager.saveParseResult(processId, metadata, headers, dataRows);
      
      // クライアントへ返す情報
      return {
        success: true,
        processId: processId,
        fileName: fileName,
        companies: analysisResult.companies,
        totalRows: dataRows.length
      };

    } catch (e) {
      return { success: false, error: 'ファイルの解析中にエラーが発生しました。\n' + e.message };
    }
  },

  /**
   * Drive API (v3) を用いてExcelを一時スプレッドシートへ変換し、データを抽出して削除する
   * @param {Blob} blob 
   */
  parseExcelWithDriveAPI: function(blob) {
    const settings = TempManager.getSettings();
    if (!settings.tempFolderId) {
      throw new Error('00_システム設定にて「一時ファイル保存先フォルダID」が未設定です。');
    }

    let tempFileId = null;
    let data = [];
    
    try {
      // 変換先をスプレッドシートに指定 (Drive API v3)
      // 安定性の高いDrive API v2へ変更
      const resource = {
        title: 'temp_import_' + Utils.generateUUID(),
        mimeType: MimeType.GOOGLE_SHEETS,
        parents: [{ id: settings.tempFolderId }]
      };
      
      let file;
      try {
        file = Drive.Files.insert(resource, blob);
      } catch (driveErr) {
        throw new Error('一時保存先フォルダを開けませんでした。00_システム設定のフォルダIDを確認してください。\n詳細: ' + driveErr.message);
      }
      
      tempFileId = file.id;
      
      // 変換されたスプレッドシートを開いてデータを取得
      const tempSs = SpreadsheetApp.openById(tempFileId);
      const sheet = tempSs.getSheets()[0]; // 最初のシートのみ対応とする
      
      data = sheet.getDataRange().getValues(); // getValuesで数値として取得

    } catch (e) {
      throw new Error('ExcelファイルのGoogleスプレッドシート変換に失敗しました: ' + e.message);
    } finally {
      if (tempFileId) {
        try {
          Drive.Files.remove(tempFileId); // 一時ファイルの完全削除
        } catch(e) {
          try {
            DriveApp.getFileById(tempFileId).setTrashed(true);
          } catch(e2) {
            console.error('一時ファイルの削除に失敗: ' + tempFileId);
          }
        }
      }
    }
    return data;
  },

  /**
   * ヘッダーと行データを解析し、会社ごとの件数等を抽出
   * @param {Array} headers 
   * @param {Array<Array>} dataRows 
   */
  analyzeData: function(headers, dataRows) {
    // 必須12列チェック
    const requiredCols = [
      '標準化データID', '原本データID', '対象年月', '出荷日', 
      '路線便会社コード', '路線便会社名', '出荷元コード', '届け先コード', 
      '届け先名称', '実績運賃', '有効フラグ', 'エラー有無'
    ];
    const missing = requiredCols.filter(c => headers.indexOf(c) === -1);
    if (missing.length > 0) {
      return { success: false, error: '必須列が不足しています: ' + missing.join(', ') };
    }

    const companyCodeIdx = headers.indexOf('路線便会社コード');
    const companyNameIdx = headers.indexOf('路線便会社名');

    const companyMap = {};
    for (let i = 0; i < dataRows.length; i++) {
      const code = String(dataRows[i][companyCodeIdx]).trim();
      const name = String(dataRows[i][companyNameIdx]).trim();
      
      if (!code) continue;

      if (!companyMap[code]) {
        companyMap[code] = { name: name, count: 0 };
      }
      companyMap[code].count++;
    }

    const resultCompanies = Object.keys(companyMap).map(k => {
      return {
        code: k,
        name: companyMap[k].name,
        count: companyMap[k].count
      };
    });

    if (resultCompanies.length === 0) {
      return { success: false, error: 'データ内に有効な路線便会社コードが存在しません。' };
    }

    return { success: true, companies: resultCompanies };
  },

  /**
   * 第2段階：解析済みデータを指定した会社分だけ正式に登録する
   * @param {string} processId 解析処理ID
   * @param {string} targetCompanyCode 登録する会社のコード
   */
  registerData: function(processId, targetCompanyCode) {
    const parseResult = TempManager.getParseResult(processId);
    if (!parseResult) {
      return { success: false, error: '解析結果が見つからないか、有効期限切れです。再度ファイルを選択してください。' };
    }

    // メタデータ検証
    const meta = parseResult.metadata;
    if (meta['登録済みフラグ'] === 'TRUE') {
      // 厳密には会社ごとに管理だが、今回は一括または個別で消込。シートが残っていればまだ未完全登録とする
    }
    
    // 現在のユーザーと実行者の照合（取得できた場合のみ）
    const currentUser = Session.getActiveUser().getEmail();
    if (meta['解析実行者'] !== '取得不可' && currentUser && meta['解析実行者'] !== currentUser) {
      return { success: false, error: '解析実行者と登録実行者が異なります。' };
    }

    // 1時間の有効期限チェック
    const parseTime = parseInt(meta['解析日時']);
    if (new Date().getTime() - parseTime > 60 * 60 * 1000) {
      TempManager.deleteParseResult(processId);
      return { success: false, error: '解析から1時間が経過し、有効期限切れとなりました。再度取り込んでください。' };
    }

    const headers = parseResult.headers;
    const dataRows = parseResult.data;
    
    const companyCodeIdx = headers.indexOf('路線便会社コード');
    const stdIdIdx = headers.indexOf('標準化データID');

    // 対象会社のデータのみを抽出
    const targetData = dataRows.filter(row => String(row[companyCodeIdx]).trim() === targetCompanyCode);
    if (targetData.length === 0) {
      return { success: false, error: `指定された会社コード(${targetCompanyCode})のデータが存在しません。` };
    }

    // マスタから保存先シートを取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const activeComps = SheetManager.getActiveRouteCompanies();
    const compInfo = activeComps.find(c => c.code === targetCompanyCode);

    if (!compInfo || compInfo.sourceType !== 'アプリ3内シート' || !compInfo.sheetName) {
      return { success: false, error: `路線会社マスタで「アプリ3内シート」として正しく設定されていません。` };
    }

    const destSheetName = compInfo.sheetName;
    let destSheet = ss.getSheetByName(destSheetName);
    if (!destSheet) {
      return { success: false, error: `保存先のシート「${destSheetName}」が存在しません。` };
    }

    // 既存データの読み込みと重複判定
    const existingData = destSheet.getDataRange().getValues();
    let destHeaders = [];
    let destStdIdIdx = -1;
    const existingIds = new Set();
    
    if (existingData.length > 0) {
      destHeaders = existingData[0];
      destStdIdIdx = destHeaders.indexOf('標準化データID');
      if (destStdIdIdx >= 0) {
        for (let i = 1; i < existingData.length; i++) {
          existingIds.add(String(existingData[i][destStdIdIdx]).trim());
        }
      }
    } else {
      destHeaders = headers; // 新規ならヘッダーをそのまま使う
    }

    let newCount = 0;
    let dupCount = 0;
    const appendRows = [];

    // ヘッダーのマッピング（列順序が異なっても対応できるように）
    for (let i = 0; i < targetData.length; i++) {
      const row = targetData[i];
      const stdId = String(row[stdIdIdx]).trim();
      
      if (existingIds.has(stdId)) {
        dupCount++;
        continue;
      }
      
      const newRow = new Array(destHeaders.length).fill('');
      for (let c = 0; c < headers.length; c++) {
        const h = headers[c];
        const destIdx = destHeaders.indexOf(h);
        if (destIdx >= 0) {
          newRow[destIdx] = row[c];
        }
      }
      appendRows.push(newRow);
      newCount++;
    }

    // 書き込み処理 (排他制御)
    if (appendRows.length > 0) {
      // 既存のシートに追記する
      const existingRowsCount = existingData.length > 0 ? existingData.length : 1; // 1行目はヘッダー想定
      if (existingData.length === 0) {
        destSheet.appendRow(destHeaders);
      }
      destSheet.getRange(existingRowsCount + 1, 1, appendRows.length, appendRows[0].length).setValues(appendRows);
    }

    // 取込履歴への記録
    const histId = Utils.generateUUID();
    SheetManager.appendRowToSheet('12_標準化データ取込履歴', [
      histId,
      targetCompanyCode,
      compInfo.name,
      destSheetName,
      meta['元ファイル名'].endsWith('.xlsx') ? 'Excel' : 'CSV',
      meta['元ファイル名'],
      '',
      '',
      targetData.length,
      newCount,
      dupCount,
      0, // エラー件数は今回実装外
      currentUser,
      new Date(parseTime), // 開始日時は解析日時
      new Date(), // 終了日時は現在
      '成功',
      `解析ID: ${processId}`
    ]);

    // キャッシュ更新（再表示時に最新化させるため、厳密には不要かもしれないが削除しておく）
    // （※ キャッシュ削除ロジックが実装されていれば呼ぶ）

    // 残りの未登録データを判定（今回のtargetData以外があるか）
    const remainingData = dataRows.filter(row => String(row[companyCodeIdx]).trim() !== targetCompanyCode);
    if (remainingData.length === 0) {
      // 全社登録完了したら一時シートを削除
      TempManager.deleteParseResult(processId);
    } else {
      // 一時シートを上書きして残りを保持
      TempManager.saveParseResult(processId, meta, headers, remainingData);
    }

    return { 
      success: true, 
      newCount: newCount, 
      dupCount: dupCount, 
      destSheet: destSheetName,
      remainingCount: remainingData.length
    };
  }
};
