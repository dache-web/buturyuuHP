/**
 * 項目紐づけの自動予測、フォーマット署名などを管理するクラス
 */
class MappingPredictor {

  /**
   * ヘッダー配列からフォーマット署名（一意のハッシュまたは結合文字列）を生成します。
   * 前後空白の削除、全角/半角スペースの除去、改行削除を行います。
   */
  static generateSignature(headers) {
    if (!headers || headers.length === 0) return "";
    
    const normalizedHeaders = headers.map(h => {
      if (h === null || h === undefined) return "";
      return String(h)
        .replace(/[\s　\n\r]/g, "") // 全角半角スペース、改行を削除
        .trim();
    });

    // 簡単な署名として「項目数_項目1,項目2...」の形式とする（GASの制限等考慮しハッシュ計算の代わりに文字列化）
    return normalizedHeaders.length + "_" + normalizedHeaders.join(",");
  }

  /**
   * ヘッダーの配列に対して、優先順位に従って共通項目を予測します。
   * 第1優先：同じ会社・同じフォーマットでの前回設定
   * 第2優先：高度な辞書（除外語含む）
   * 第3優先：他社での過去設定（今回は省略するか、シンプルに実装）
   * 第4優先：単純なキーワード予測
   */
  static predictMapping(companyCode, headers, formatSignature) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const formatSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.FORMAT_SETTING);
    const roleSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.ROLE_MASTER);
    
    let previousMappings = {};
    let isExactMatch = false;
    let formatId = "";
    let calcMethod = "直接取得";
    let calcRule = "";
    let contractProfiles = [];
    let defaultProfileId = "";
    let defaultSurchargeHandling = "UNCONFIRMED";
    
    // 1. フォーマット署名が一致するか確認し、一致すれば前回設定を取得
    if (formatSheet && roleSheet) {
      const fData = formatSheet.getDataRange().getValues();
      for (let i = 1; i < fData.length; i++) {
        // "フォーマットID", "路線便会社コード", "路線便会社名", "フォーマット名", "ヘッダー行", "ヘッダー構成", "フォーマット署名", "初回登録日", "最終使用日", "有効フラグ", "実績運賃計算方式", "実績運賃計算ルール"
        if (fData[i][1] === companyCode && fData[i][6] === formatSignature && fData[i][9] === true) {
          isExactMatch = true;
          formatId = fData[i][0];
          calcMethod = fData[i][10] || "直接取得";
          calcRule = fData[i][11] || "";
          break;
        }
      }
      
      if (formatId) {
        // マッピングの取得
        const rData = roleSheet.getDataRange().getValues();
        for (let i = 1; i < rData.length; i++) {
          if (rData[i][1] === formatId && rData[i][8] === "確定済み") {
            const originalName = rData[i][3];
            const commonName = rData[i][5];
            previousMappings[originalName] = {
              commonField: commonName,
              confidence: "前回確定",
              source: "前回設定",
              joinGroupId: rData[i][9],
              joinOrder: rData[i][10],
              joinMethod: rData[i][11]
            };
          }
        }
        
        // 契約プロファイルの取得
        const profileSheet = ss.getSheetByName(CONFIG.SHEET_NAMES.CONTRACT_PROFILE);
        if (profileSheet && profileSheet.getLastRow() > 0) {
          const pData = profileSheet.getDataRange().getValues();
          let lastUsedProfile = null;
          let latestDate = 0;
          
          for (let i = 1; i < pData.length; i++) {
            // "契約プロファイルID(0)", "契約プロファイル名(1)", "路線便会社コード(2)", "路線便会社名(3)", "フォーマットID(4)", "荷主・契約識別情報(5)", "サーチャージ取扱区分(6)", "最終使用日時(7)", "有効フラグ(8)", "備考(9)"
            if (pData[i][4] === formatId && pData[i][8] === true) {
               const p = {
                 id: pData[i][0],
                 name: pData[i][1] || pData[i][5],
                 identifier: pData[i][5],
                 surchargeHandling: pData[i][6] || "UNCONFIRMED",
                 lastUsedDate: new Date(pData[i][7]).getTime() || 0
               };
               contractProfiles.push(p);
               if (p.lastUsedDate >= latestDate) {
                 latestDate = p.lastUsedDate;
                 lastUsedProfile = p;
               }
            }
          }
          
          if (contractProfiles.length === 1) {
             defaultProfileId = contractProfiles[0].id;
             defaultSurchargeHandling = contractProfiles[0].surchargeHandling;
          } else if (contractProfiles.length > 1 && lastUsedProfile) {
             defaultProfileId = "";
             defaultSurchargeHandling = "UNCONFIRMED";
          }
        }
      }
    }

    // 2. ヘッダーごとに予測を実行
    const predictions = headers.map((header, index) => {
      if (header === null || header === undefined || header.toString().trim() === "") {
        return { originalName: `列${index + 1}`, commonField: "使用しない", confidence: "未設定", source: "空白列" };
      }
      
      const normalizedHeader = header.toString().trim();
      
      // 第1優先：前回設定
      if (previousMappings[normalizedHeader]) {
        return {
          originalName: normalizedHeader,
          commonField: previousMappings[normalizedHeader].commonField,
          confidence: previousMappings[normalizedHeader].confidence,
          source: previousMappings[normalizedHeader].source,
          joinGroupId: previousMappings[normalizedHeader].joinGroupId,
          joinOrder: previousMappings[normalizedHeader].joinOrder,
          joinMethod: previousMappings[normalizedHeader].joinMethod
        };
      }
      
      // 第2優先：高度な辞書
      const dictMatch = this._predictFromDictionary(normalizedHeader);
      if (dictMatch) {
        return {
          originalName: normalizedHeader,
          commonField: dictMatch.commonField,
          confidence: "高",
          source: "辞書予測"
        };
      }
      
      // それ以外は未設定
      return {
        originalName: normalizedHeader,
        commonField: "使用しない", // もしくは未設定
        confidence: "未設定",
        source: "予測不可"
      };
    });

    return {
      isExactMatch: isExactMatch,
      predictions: predictions,
      formatSignature: formatSignature,
      calcMethod: calcMethod,
      calcRule: calcRule,
      formatId: formatId,
      contractProfiles: contractProfiles,
      defaultProfileId: defaultProfileId,
      defaultSurchargeHandling: defaultSurchargeHandling
    };
  }

  static _predictFromDictionary(header) {
    const rules = CONFIG.ADVANCED_DICTIONARY;
    for (const rule of rules) {
      // 除外語チェック
      let isExcluded = false;
      for (const excludeWord of rule.excludes) {
        if (header.includes(excludeWord)) {
          isExcluded = true;
          break;
        }
      }
      if (isExcluded) continue;
      
      // 包含語チェック
      for (const includeWord of rule.includes) {
        if (header.includes(includeWord)) {
          return { commonField: rule.commonField };
        }
      }
    }
    return null; // 一致なし
  }
}
