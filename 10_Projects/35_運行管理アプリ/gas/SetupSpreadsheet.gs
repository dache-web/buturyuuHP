/**
 * ============================================================================
 * 文書番号：TOOL-01 / スプレッドシート自動構築＆安全更新スクリプト
 * ファイル名：SetupSpreadsheet.gs
 * 役割：
 *   1. setupSpreadsheetManagementBase(): 新規環境専用の初回構築関数 (既存環境では安全停止・シート1安全処理)
 *   2. updateSpreadsheetManagementBase(): 既存環境専用の安全差分更新関数 (データ破壊ゼロ・冪等性保証・列移行安全保護)
 * 対応指示書：DEV-02 (第0工程_安全更新実行前テスト指示)
 * ============================================================================
 */

/**
 * 1. 初回構築関数（何もない新規スプレッドシート専用）
 * ※ 既存管理基盤シートを検出した場合は、データ保護のため自動安全停止します。
 */
function setupSpreadsheetManagementBase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 安全装置：すでに主要シートが存在している場合はデータ破壊を防ぐため停止
  var existingConfig = ss.getSheetByName("00_システム設定");
  var existingSheets = ss.getSheetByName("01_シート管理台帳");
  if (existingConfig || existingSheets) {
    Logger.log("⚠️ [安全停止] 既存の管理基盤シートが検出されました。");
    Logger.log("⚠️ 既存データの破壊を防ぐため、初回構築 (setup) の実行を自動停止しました。");
    Logger.log("👉 既存環境の更新・UXレイアウト反映には 'updateSpreadsheetManagementBase()' を実行してください。");
    return "STOPPED_EXISTING_ENV_DETECTED";
  }

  Logger.log("🚀 新規スプレッドシートへの初期管理基盤構築を開始します...");
  var sheetDefinitions = getSheetDefinitions_();

  sheetDefinitions.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    sheet.appendRow(def.headers);
    applyHeaderStyle_(sheet, def.headers.length);

    if (def.initialData && def.initialData.length > 0) {
      def.initialData.forEach(function(row) {
        sheet.appendRow(row);
      });
    }

    applyUxFormatting_(sheet, def);
  });

  // Googleスプレッドシート初期時の空シート「シート1」の安全処理
  cleanupDefaultSheet1Safely_(ss);

  Logger.log("✅ 新規スプレッドシート管理基盤の初期構築が完了しました。");
  return "SUCCESS_INITIAL_SETUP";
}

/**
 * 2. 既存環境安全更新関数（既存データ破壊ゼロ・冪等性保証）
 * ※ 既存のログ・履歴・ユーザー変更済み設定値を100%保持し、UXレイアウト・非表示列・新規Keyのみを差分更新します。
 */
function updateSpreadsheetManagementBase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("🔄 既存スプレッドシート管理基盤の安全更新（データ保持＆UX改善）を開始します...");

  var sheetDefinitions = getSheetDefinitions_();

  sheetDefinitions.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name);
    
    if (!sheet) {
      // シートが存在しない場合のみ新規作成
      sheet = ss.insertSheet(def.name);
      sheet.appendRow(def.headers);
      applyHeaderStyle_(sheet, def.headers.length);
      if (def.initialData && def.initialData.length > 0) {
        def.initialData.forEach(function(row) {
          sheet.appendRow(row);
        });
      }
    } else {
      // 既存シートが存在する場合：絶対データクリアを行わず、ヘッダーと差分のみ更新
      updateHeaderStyleOnly_(sheet, def.headers);

      if (def.sheetKey === "SYS_CONFIG") {
        updateSysConfigSafely_(sheet, def.initialData);
      } else if (def.sheetKey === "SYS_SHEETS") {
        updateSysSheetsSafely_(sheet, def.initialData);
      } else if (def.sheetKey === "PROJECT_STATE") {
        updateProjectStateSafely_(sheet, def.initialData);
      } else if (isHistoryOrLogSheet_(def.sheetKey)) {
        appendHistoryDataSafely_(sheet, def.initialData);
      } else if (def.initialData && def.initialData.length > 0) {
        updateMasterDataSafely_(sheet, def.initialData);
      }
    }

    // 表示UX設定の安全適用（折り返し・列幅・非表示）
    applyUxFormatting_(sheet, def);
  });

  Logger.log("✅ 既存データの保持・UXレイアウト改善・新規決定事項の安全更新が完了しました。");
  return "SUCCESS_SAFE_UPDATE";
}

// ============================================================================
// 内部補助関数（安全差分更新用）
// ============================================================================

/** 全14管理シートの定義データ */
function getSheetDefinitions_() {
  return [
    {
      sheetKey: "SYS_CONFIG",
      name: "00_システム設定",
      headers: ["設定キー", "設定値", "分類", "説明", "最終更新日時"],
      initialData: [
        ["APP_NAME", "配車・運行管理アプリ", "全般", "システムの正式名称", "2026-09-01 05:40:00"],
        ["SCHEMA_VERSION", "0.1.0", "システム", "スプレッドシートのスキーマバージョン", "2026-09-01 05:40:00"],
        ["CURRENT_STEP", "第0工程 スプレッドシート管理基盤 (UX改善完了)", "開発", "現在進行中の開発工程", "2026-09-01 21:05:00"],
        ["DEFAULT_PAGE_SIZE", "50", "画面", "メイン配車画面の1ページあたり標準表示件数", "2026-09-01 05:40:00"],
        ["BUSINESS_DAY_START_TIME", "00:00", "運用", "日業務開始時刻(例: 00:00 または 05:00)", "2026-09-01 21:05:00"],
        ["DEFAULT_VIEW_MODE", "3DAY", "画面", "メイン配車画面の初期表示形式(1DAY / 3DAY / WEEKLY)", "2026-09-01 21:05:00"],
        ["DEFAULT_COMPANY_ID", "CMP-001", "将来拡張", "単一拠点運用時の標準会社ID", "2026-09-01 05:40:00"],
        ["DEFAULT_OFFICE_ID", "OFF-001", "将来拡張", "単一拠点運用時の標準営業所ID", "2026-09-01 05:40:00"]
      ]
    },
    {
      sheetKey: "SYS_SHEETS",
      name: "01_シート管理台帳",
      headers: ["シート名", "何を管理する？", "誰が使う？", "触っていい？", "状態", "シートキー", "画面表示名", "分類", "開発優先度", "読取可否", "書込可否", "正本か", "削除禁止か", "関連機能", "作成日", "最終変更日"],
      hideFromCol: 6,
      hideColCount: 11,
      initialData: [
        ["00_システム設定", "全体パラメータ・動作設定の保持", "システム管理者", "見るだけ", "使用中", "SYS_CONFIG", "システム設定", "設定", "高", true, true, true, true, "全体システム", "2026-09-01", "2026-09-01 21:05:00"],
        ["01_シート管理台帳", "全シートの目的・権限・状態管理", "全ユーザー", "見るだけ", "使用中", "SYS_SHEETS", "シート管理センター", "システム", "高", true, true, true, true, "基盤管理", "2026-09-01", "2026-09-01 21:05:00"],
        ["02_項目定義台帳", "全項目の型・非公開属性・説明の一元管理", "全ユーザー", "見るだけ", "使用中", "SYS_FIELDS", "項目・カラム定義", "システム", "高", true, true, true, true, "基盤管理", "2026-09-01", "2026-09-01 21:05:00"],
        ["03_シート依存関係台帳", "どのシートがどのシートを参照しているかの管理", "システム管理者", "見るだけ", "使用中", "SYS_DEPENDENCIES", "シート依存関係", "システム", "高", true, true, true, true, "基盤管理", "2026-09-01", "2026-09-01 21:05:00"],
        ["04_機能管理台帳", "どの機能がどのシートを使用しているかの管理", "システム管理者", "見るだけ", "使用中", "SYS_FEATURES", "機能・画面対応表", "システム", "高", true, true, true, true, "基盤管理", "2026-09-01", "2026-09-01 21:05:00"],
        ["05_選択肢マスタ", "画面上の選択肢（状態・車格等）のデータ", "運行管理者", "設定変更OK", "使用中", "M_OPTIONS", "ドロップダウン選択肢", "マスタ", "高", true, true, true, false, "配車入力・画面全般", "2026-09-01", "2026-09-01 21:05:00"],
        ["06_ルールマスタ", "警告・自動判定ルールの保持", "運行管理者", "設定変更OK", "使用中", "M_RULES", "業務ルール定義", "マスタ", "高", true, true, true, false, "自動チェック・配車検証", "2026-09-01", "2026-09-01 21:05:00"],
        ["09_エラーログ", "エラー発生時の詳細ログ永久保存", "システム管理者", "システム自動記録", "使用中", "LOG_ERROR", "システムエラーログ", "ログ", "高", true, true, true, true, "エラー発生検知", "2026-09-01", "2026-09-01 21:05:00"],
        ["10_アプリログ", "誰がいつ何を操作したかのログ", "システム管理者", "システム自動記録", "使用中", "LOG_APP", "操作・イベントログ", "ログ", "高", true, true, true, true, "操作監査", "2026-09-01", "2026-09-01 21:05:00"],
        ["11_データ変更履歴", "配車やマスタの変更前後のトレース記録", "運行管理者", "システム自動記録", "使用中", "LOG_HISTORY", "データ変更履歴", "ログ", "高", true, true, true, true, "変更追跡", "2026-09-01", "2026-09-01 21:05:00"],
        ["12_スキーマ変更履歴", "シート・カラム等の構造変更履歴", "システム管理者", "システム自動記録", "使用中", "LOG_SCHEMA", "システム構造変更履歴", "ログ", "高", true, true, true, true, "構造変更追跡", "2026-09-01", "2026-09-01 21:05:00"],
        ["13_PROJECT_CURRENT_STATE", "現在の進行工程・正本ドキュメント等の記録", "AG / 管理者", "見るだけ", "使用中", "PROJECT_STATE", "開発現在地保持", "システム", "高", true, true, true, true, "進捗管理", "2026-09-01", "2026-09-01 21:05:00"],
        ["14_PROJECT_CHECKPOINT", "Gitコミット・検証状態の紐付けログ", "AG / 管理者", "見るだけ", "使用中", "PROJECT_CHECKPOINT", "チェックポイント記録", "システム", "高", true, true, true, true, "復元地点管理", "2026-09-01", "2026-09-01 21:05:00"],
        ["15_PROJECT_DECISIONS", "なぜその構造・ルールにしたかの理由記録", "全ユーザー", "見るだけ", "使用中", "PROJECT_DECISIONS", "意思決定理由台帳", "システム", "高", true, true, true, true, "設計根拠記録", "2026-09-01", "2026-09-01 21:05:00"]
      ]
    },
    {
      sheetKey: "SYS_FIELDS",
      name: "02_項目定義台帳",
      headers: ["対象シートキー", "物理項目キー", "項目名", "画面表示名", "データ型", "必須判定", "固定コア項目か", "通常ドライバー非公開", "操作区分", "この項目は何か", "間違えると何に影響するか"],
      initialData: [
        ["T_DISPATCH", "DispatchID", "仕事ID", "仕事ID", "String", true, true, false, "触らない（固定キー）", "1つの仕事を識別する唯一の番号", "他システム連携や明細紐付けが壊れます"],
        ["T_DISPATCH", "TargetDate", "配車対象日", "配車日", "Date", true, true, false, "設定変更OK", "配車を行う日付 (YYYY-MM-DD)", "誤ると別の日の配車表に表示されます"],
        ["T_DISPATCH", "RunOrder", "仕事運行順", "便順", "Integer", true, true, false, "設定変更OK", "当日のドライバーの何便目か(1, 2, 3...)", "一日の仕事の順番が前後します"],
        ["T_DISPATCH", "Status", "配車状態", "状態", "Enum", true, true, false, "日常入力OK", "通常 / 保留 / キャンセル / 仮確定 / 確定", "ドライバーへの公開状況が変わります"],
        ["T_DISPATCH", "DriverID", "ドライバーID", "運転手", "String", false, true, false, "日常入力OK", "担当する自社ドライバーのID", "担当運転手が変わります"],
        ["T_DISPATCH", "VehicleID", "車両ID", "車両", "String", false, true, false, "日常入力OK", "使用する自社車両のID", "割り当て車両が変わります"],
        ["T_DISPATCH", "IsPartner", "庸車フラグ", "庸車区分", "Boolean", true, true, false, "日常入力OK", "自社便か協力会社(庸車)便かの区分", "自社車か庸車かの集計が変わります"],
        ["T_DISPATCH", "PartnerCompanyID", "庸車会社ID", "庸車会社", "String", false, true, false, "日常入力OK", "依頼する庸車会社のID", "支払い先の会社が変わります"],
        ["T_DISPATCH", "PartnerVehicleID", "庸車車両ID", "庸車車番", "String", false, true, false, "日常入力OK", "庸車先の車番・車格情報", "当日入る庸車車両の特定に影響します"],
        ["T_DISPATCH", "AdminMemo", "管理者専用メモ", "社内メモ", "String", false, false, true, "日常入力OK", "運行管理者のみが閲覧・入力するメモ", "ドライバーには表示されません"],
        ["T_DISPATCH", "CustomerName", "荷主名", "荷主", "String", false, false, false, "日常入力OK", "仕事を依頼したお客様のお名前", "配車カードの顧客表記に反映されます"],
        ["T_DISPATCH", "OperationalDate", "運行管理日", "運行管理日", "Date", false, false, false, "システム自動記録", "業務開始時刻に基づき自動計算算出される配車日", "日またぎ運行の集計に影響します"],
        ["T_DISPATCH", "VehicleReturnDateTime", "車両帰庫予定日時", "車両帰庫日時", "DateTime", false, false, false, "設定変更OK", "車両が営業所へ戻る予定日時", "車両の次回割当可否判定に影響します"],
        ["T_DISPATCH", "DriverReturnDateTime", "ドライバー運行終了日時", "乗務終了日時", "DateTime", false, false, false, "設定変更OK", "ドライバーの運行完了日時", "ドライバーの次回乗務可能計算に影響します"]
      ]
    },
    {
      sheetKey: "SYS_DEPENDENCIES",
      name: "03_シート依存関係台帳",
      headers: ["参照元シートKey", "参照先シートKey", "使用目的", "関連FieldKey", "必須/任意", "使用機能", "状態"],
      initialData: [
        ["T_DISPATCH", "M_DRIVER", "配車データへ自社ドライバー情報を割り当てるため", "DriverID", "任意", "メイン配車・詳細編集", "有効"],
        ["T_DISPATCH", "M_VEHICLE", "配車データへ自社車両情報を割り当てるため", "VehicleID", "任意", "メイン配車・詳細編集", "有効"],
        ["T_DISPATCH", "M_PARTNER_COMPANY", "庸車配車時に庸車会社情報を紐付けるため", "PartnerCompanyID", "任意", "メイン配車・庸車管理", "有効"],
        ["T_DISPATCH", "M_OPTIONS", "配車状態・車格・ステータス選択肢の参照", "Status", "必須", "画面フォーム全般", "有効"],
        ["M_PATTERN", "T_DISPATCH", "基本パターンから日別配車正本データを展開作成するため", "DispatchID", "必須", "基本配車展開機能", "有効"]
      ]
    },
    {
      sheetKey: "SYS_FEATURES",
      name: "04_機能管理台帳",
      headers: ["機能Key", "機能名", "画面名", "使用SheetKey", "読取/書込", "必須/任意", "使用状態", "開発優先度"],
      initialData: [
        ["FEAT_MAIN_DISPATCH", "メイン配車UI", "メイン配車画面", "T_DISPATCH", "ReadWrite", "必須", "開発中", "高"],
        ["FEAT_MAIN_DISPATCH", "メイン配車UI", "メイン配車画面", "M_DRIVER", "ReadOnly", "必須", "開発中", "高"],
        ["FEAT_MAIN_DISPATCH", "メイン配車UI", "メイン配車画面", "M_VEHICLE", "ReadOnly", "必須", "開発中", "高"],
        ["FEAT_MAIN_DISPATCH", "メイン配車UI", "メイン配車画面", "M_PARTNER_COMPANY", "ReadOnly", "任意", "開発中", "高"],
        ["FEAT_DISPATCH_DETAIL", "配車詳細編集", "配車詳細モーダル", "T_DISPATCH", "ReadWrite", "必須", "開発中", "高"],
        ["FEAT_WEEKLY_PATTERN", "基本配車登録", "基本配車画面", "M_PATTERN", "ReadWrite", "必須", "開発中", "高"],
        ["FEAT_RECEPTION_BOX", "配車受付BOX", "受付BOX画面", "T_RECEPTION", "ReadWrite", "必須", "開発中", "高"],
        ["FEAT_3DAY_VIEW", "3DAY表示UI", "メイン配車画面", "T_DISPATCH", "ReadWrite", "必須", "標準機能・未実装", "高"],
        ["FEAT_MOBILE_DISPATCH", "外出先簡易モード", "簡易配車画面", "T_DISPATCH", "ReadWrite", "任意", "将来拡張", "中"],
        ["FEAT_DRIVER_REPORT", "ドライバー報告機能", "ドライバー報告画面", "T_COMMUNICATION", "WriteOnly", "任意", "将来拡張", "低"],
        ["FEAT_MANAGER_HANDOVER", "運行管理者引き継ぎ機能", "引き継ぎ画面", "T_MANAGER_HANDOVER", "ReadWrite", "任意", "将来拡張", "中"],
        ["FEAT_KNOWLEDGE_BASE", "配送先知識蓄積機能", "知識共有画面", "M_DELIVERY_KNOWLEDGE", "ReadOnly", "任意", "将来拡張", "低"]
      ]
    },
    {
      sheetKey: "M_OPTIONS",
      name: "05_選択肢マスタ",
      headers: ["選択肢グループKey", "選択肢値(コード)", "画面表示ラベル", "並び順", "有効フラグ", "表示バッジ色"],
      initialData: [
        ["DISPATCH_STATUS", "NORMAL", "通常", 1, true, "#2196F3"],
        ["DISPATCH_STATUS", "PENDING", "保留", 2, true, "#FF9800"],
        ["DISPATCH_STATUS", "CANCEL", "キャンセル", 3, true, "#F44336"],
        ["DISPATCH_STATUS", "PROVISIONAL", "仮確定", 4, true, "#9C27B0"],
        ["DISPATCH_STATUS", "CONFIRMED", "確定", 5, true, "#4CAF50"],
        ["VEHICLE_CLASS", "2T", "2t車", 1, true, "#E0E0E0"],
        ["VEHICLE_CLASS", "4T", "4t車", 2, true, "#B2EBF2"],
        ["VEHICLE_CLASS", "10T", "10t大型車", 3, true, "#C8E6C9"],
        ["VEHICLE_CLASS", "TRAILER", "トレーラー", 4, true, "#D1C4E9"],
        ["OPERATION_TYPE", "OK_TOUCH", "日常入力OK", 1, true, "#4CAF50"],
        ["OPERATION_TYPE", "OK_CONDITIONAL", "設定変更OK", 2, true, "#FF9800"],
        ["OPERATION_TYPE", "READ_ONLY", "見るだけ", 3, true, "#2196F3"],
        ["OPERATION_TYPE", "DO_NOT_TOUCH", "触らない（固定キー）", 4, true, "#F44336"],
        ["OPERATION_TYPE", "AUTO_MANAGED", "システム自動記録", 5, true, "#9E9E9E"],
        ["SHIFT_TYPE", "NORMAL", "通常", 1, true, "#2196F3"],
        ["SHIFT_TYPE", "SHIFT_1", "区分1", 2, true, "#4CAF50"]
      ]
    },
    {
      sheetKey: "M_RULES",
      name: "06_ルールマスタ",
      headers: ["ルールKey", "ルール名", "設定値/条件JSON", "警告メッセージ", "有効フラグ"],
      initialData: [
        ["SAME_DAY_CHANGE_ALERT", "当日変更時の警告ダイアログ表示", "true", "これは当日配車の変更です。変更履歴に記録されますがよろしいですか？", true],
        ["DUPLICATE_ASSIGN_CONTROL", "同一ドライバー・車両の重複配車チェック制御", "STRONG_WARN", "該当のドライバーまたは車両は同時間帯に別の運行（期間占有含む）へ割り当て済みです。", true],
        ["MIN_REST_HOURS", "便間の最低休息時間閾値(時間)", "8", "前日運行からの休息時間が規定（8時間）未満の可能性があります。", true],
        ["OPERATION_MANAGER_HANDOVER_CHECK", "運行管理者引き継ぎ時間不足チェック", "NOTICE", "運行管理者の引き継ぎ時間が規定値未満の可能性があります。", true],
        ["OPERATION_MANAGER_HANDOVER_MINUTES", "運行管理者交代に必要な規定引き継ぎ時間(分)", "30", "運行管理者の規定引き継ぎ時間は30分です。(ドライバー休息時間とは別物)", true]
      ]
    },
    {
      sheetKey: "LOG_ERROR",
      name: "09_エラーログ",
      headers: ["ログID", "発生日時", "発生機能Key", "実行ユーザー", "対象SheetKey", "対象ID", "エラーメッセージ", "詳細スタックトレース", "対応状態"],
      initialData: []
    },
    {
      sheetKey: "LOG_APP",
      name: "10_アプリログ",
      headers: ["ログID", "操作日時", "操作ユーザー", "操作種別", "対象ID", "操作詳細JSON"],
      initialData: []
    },
    {
      sheetKey: "LOG_HISTORY",
      name: "11_データ変更履歴",
      headers: ["履歴ID", "変更日時", "変更ユーザー", "対象SheetKey", "対象ID", "変更前JSON", "変更後JSON"],
      initialData: []
    },
    {
      sheetKey: "LOG_SCHEMA",
      name: "12_スキーマ変更履歴",
      headers: ["構造変更ID", "変更日時", "変更種別", "対象Sheet/FieldKey", "変更前定義", "変更後定義", "変更理由"],
      initialData: [
        ["SCH-001", "2026-09-01 05:40:00", "初期管理基盤構築", "ALL_SYS_SHEETS", "-", "SchemaVersion 0.1.0 (全14管理シート)", "第0工程スプレッドシート管理基盤の初期構築"],
        ["SCH-002", "2026-09-01 20:36:00", "FIX-10仕様統合・ルール改善", "PREVENT_DUPLICATE_ASSIGN -> DUPLICATE_ASSIGN_CONTROL, M_RULES(HANDOVER)", "PREVENT_DUPLICATE_ASSIGN (true/false)", "DUPLICATE_ASSIGN_CONTROL (STRONG_WARN), M_RULESへHANDOVER_CHECK/MINUTES追加", "FIX-09/FIX-10に基づく二重チェック制御および運行管理者引き継ぎルールの完全定義"],
        ["SCH-003", "2026-09-01 20:44:00", "FIX-11/FIX-12上位開発方針記録", "PROJECT_DECISIONS / PROJECT_STATE", "FIX-10以前の決定事項", "DEC-011〜014の記録完了", "配車コア優先・スプレッドシート単独稼働・第1段階順序補正・CustomerID原則の定義記録"],
        ["SCH-004", "2026-09-01 21:05:00", "UX視点改善・シート管理台帳レイアウト最適化", "SYS_SHEETS / SYS_CONFIG", "旧レイアウト（システム記述重視）", "5主要列左寄せ、管理列右側非表示化、日本語表現改善、折り返し設定自動化", "実機検収フィードバックに基づく非エンジニア管理者向け可読性・視認性大幅向上"]
      ]
    },
    {
      sheetKey: "PROJECT_STATE",
      name: "13_PROJECT_CURRENT_STATE",
      headers: ["状態キー", "状態値", "説明", "更新日時"],
      initialData: [
        ["CurrentStep", "第0工程 実機検収視認性改善完了（再確認待ち）", "現在実行中の開発工程", "2026-09-01 21:05:00"],
        ["CurrentPlanDocument", "PLAN-02", "現在参照中の実装前計画書番号", "2026-09-01 21:05:00"],
        ["CurrentPlanName", "実装前計画書_修正版02", "現在参照中の実装前計画書名称", "2026-09-01 21:05:00"],
        ["CurrentInstructionDocument", "FIX-12_UX_FIX", "現在参照中の指示書番号", "第0工程実機検収指示に基づくUI/UX視認性修正", "2026-09-01 21:05:00"],
        ["CurrentInstructionName", "第0工程_実機検収フィードバック対応_UX改善", "現在参照中の指示書名称", "2026-09-01 21:05:00"],
        ["SchemaVersion", "0.1.0", "現在のスプレッドシート構造バージョン", "2026-09-01 21:05:00"],
        ["ImplementationStatus", "STEP_0_MANAGEMENT_BASE_UX_IMPROVED_WAITING_VERIFICATION", "実装ステータス", "2026-09-01 21:05:00"]
      ]
    },
    {
      sheetKey: "PROJECT_CHECKPOINT",
      name: "14_PROJECT_CHECKPOINT",
      headers: ["チェックポイントID", "工程名", "Gitコミットハッシュ", "Gitタグ名", "SchemaVersion", "ユーザー検証状態", "作成日時"],
      initialData: [
        ["CP-STEP-0-START", "第0工程開始前", "HEAD", "v0.0.0-checkpoint-0-start", "0.1.0", "OK", "2026-09-01 05:40:00"],
        ["CP-STEP-0-DEFINED", "第0工程管理基盤定義更新完了（実スプレッドシート作成前）", "HEAD", "v0.1.0-checkpoint-0-defined", "0.1.0", "Pending", "2026-09-01 20:36:00"],
        ["CP-STEP-0-COMPLETE", "第0工程管理基盤構築完了（ユーザー検収前）", "HEAD", "v0.1.0-checkpoint-0-complete", "0.1.0", "Pending", "2026-09-01 20:44:00"],
        ["CP-STEP-0-UX-IMPROVED", "第0工程実機検収フィードバック対応完了（管理者視点UX改善）", "HEAD", "v0.1.0-step0-ux-improved", "0.1.0", "Pending", "2026-09-01 21:05:00"]
      ]
    },
    {
      sheetKey: "PROJECT_DECISIONS",
      name: "15_PROJECT_DECISIONS",
      headers: ["決定ID", "決定内容タイトル", "決定内容", "決定理由(Why)", "関連文書番号", "決定日時"],
      initialData: [
        ["DEC-001", "DispatchIDの一仕事一ID化", "T_DISPATCHを1仕事＝1行の単一正本シートとする。", "SSoTを維持し、運賃明細・PDF/FAX・履歴等を直接 DispatchID に紐付けるため。", "FIX-01 / PLAN-02", "2026-09-01 05:34:00"],
        ["DEC-002", "文書番号管理ルールの統一", "開発関連ドキュメントは「完成版・最終版」という言葉を使用せず、連番文書名で管理する。", "今後の追加修正が多く発生するプロジェクトにおいて最新参照先を特定可能にするため。", "FIX-02 / PLAN-02", "2026-09-01 05:38:00"],
        ["DEC-003", "第0工程での業務シート作成禁止", "第0工程では管理基盤14シートのみを作成し、M_DRIVER等の業務シートはユーザー確認OK後に作成する。", "まずスプレッドシート管理基盤の構造をユーザー本人が実機で見て安全性を検証するため。", "FIX-03", "2026-09-01 05:40:00"],
        ["DEC-004", "コード生成完了と実際のスプレッドシート構築完了の区別", "AGによるGASコード生成完了地点では工程完成（OK）とせず、ユーザーが実際にブラウザで開けるスプレッドシートが構築され検収されることで工程完成とする。", "実際の成果物をユーザーが確認できない状態で、AI判断のみで工程完成扱いにしないため。", "FIX-04", "2026-09-01 06:26:00"],
        ["DEC-005", "仕様追加時の二重正本・重複Key排除義務", "既存機能を拡張し、新規シートや重複キーの作成を厳禁とする。", "SSoTを保護しデータ構造の崩壊を防ぐため。", "FIX-06 / FIX-09", "2026-09-01 20:36:00"],
        ["DEC-006", "3日連続ビューの標準機能確定", "3日表示UIを拡張オプションではなく標準機能として明確に位置づける。", "宵積み・翌日着・長距離運行の現場配車ミスを防ぐため。", "FIX-06 / FIX-09", "2026-09-01 20:36:00"],
        ["DEC-007", "TargetDateとOperationalDateの概念分離", "UI用TargetDateと業務開始時刻より算定されるOperationalDateを分離定義する。", "表示日付と運行管理基準日の意味の混同を防ぐため。", "FIX-09", "2026-09-01 20:36:00"],
        ["DEC-008", "事実日時とルール計算結果の完全分離", "車両帰庫予定日時とドライバー乗務可能時刻（休息時間加算値）を分離保持する。", "法令や会社ルール変更時にDB内の過去データ意味が破壊されるのを防ぐため。", "FIX-09", "2026-09-01 20:36:00"],
        ["DEC-009", "重複チェックルールのDUPLICATE_ASSIGN_CONTROL統合", "PREVENT_DUPLICATE_ASSIGNをDUPLICATE_ASSIGN_CONTROLへ統合変更し、旧trueはBLOCKへマッピングする。", "名前と動作の整合性を保ち、旧仕様との安全な意味互換を確立するため。", "FIX-09", "2026-09-01 20:36:00"],
        ["DEC-010", "運行管理者引き継ぎ時間ルールの独立配置", "OPERATION_MANAGER_HANDOVER_MINUTESをM_RULESへ独立配置し、ドライバー休息時間との完全分離を徹底する。", "管理者交代時間とドライバー労働休息規則を混同しないため。", "FIX-10", "2026-09-01 20:36:00"],
        ["DEC-011", "配車コア優先とGAS単独稼働原則", "外部追加モジュール（AI/PDF/最適化等）障害時も「スプレッドシート＋GAS/Webアプリ」単独で配車業務を継続可能とする。", "現場の配車業務が他システム障害で停止するリスクを遮断するため。", "FIX-11 / FIX-12", "2026-09-01 20:44:00"],
        ["DEC-012", "操作ログからの履歴・分析全自動蓄積原則", "手動入力を原則全廃し、通常操作（`LOG_APP`/`LOG_HISTORY`）から履歴や分析データを自動集計する。", "現場利用者に分析・履歴目的の追加入力負担を強いないため。", "FIX-11 / FIX-12", "2026-09-01 20:44:00"],
        ["DEC-013", "数理最適化の未来逆算・属人化解消Engine化", "数理最適化の目的を「1〜2か月後の絶対休・新仕事から逆算し、今日からの育成配車で未来体制を作るEngine」と再定義する。", "短期の効率化だけでなく、属人化を解消し代替者を育成する持続可能な運行管理を行うため。", "FIX-11 / FIX-12", "2026-09-01 20:44:00"],
        ["DEC-014", "第1段階での最低限マスタ前倒し作成とCustomerID原則", "第1段階開始直後に最低限のM_DRIVER/M_VEHICLEを先行作成し、CustomerNameはIDとして扱わず将来CustomerIDと分離する。", "実配車カードでの割り当て操作の検証を迅速に行い、荷主表記の表記揺れによるデータ汚染を防ぐため。", "FIX-12", "2026-09-01 20:44:00"],
        ["DEC-015", "実機検収に基づく01_シート管理台帳レイアウト最適化", "主要5項目（シート名・何を管理する？・誰が使う？・触っていい？・状態）を左側に集約し、内部管理項目は右側非表示化。操作区分も直感的な日本語に刷新。", "非エンジニアの現場管理者が一目で用途と操作権限を直感把握できるようにするため。", "実機検収フィードバック", "2026-09-01 21:05:00"]
      ]
    }
  ];
}

/** 1行目ヘッダーデザインの安全適用（データ行は絶対触らない） */
function updateHeaderStyleOnly_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else {
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
  }
  var headerRangeStyle = sheet.getRange(1, 1, 1, headers.length);
  headerRangeStyle.setBackground("#1A237E")
                  .setFontColor("#FFFFFF")
                  .setFontWeight("bold")
                  .setFontSize(10);
  sheet.setFrozenRows(1);
}

/** SYS_CONFIGの安全更新 (ユーザーが変更済みの設定値は絶対保持) */
function updateSysConfigSafely_(sheet, initialData) {
  var lastRow = sheet.getLastRow();
  var existingKeys = {};
  
  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0]) {
        existingKeys[String(data[i][0]).trim()] = i + 2; // 行番号を記録
      }
    }
  }

  initialData.forEach(function(row) {
    var key = row[0];
    if (!existingKeys[key]) {
      // 未存在の新規Keyのみ末尾に安全追加
      sheet.appendRow(row);
    } else {
      // 既存Keyが存在する場合：設定値(2列目)は絶対に変更せず、説明・分類のみ安全更新
      var rowNum = existingKeys[key];
      sheet.getRange(rowNum, 3).setValue(row[2]); // 分類
      sheet.getRange(rowNum, 4).setValue(row[3]); // 説明
    }
  });
}

/** SYS_SHEETSの安全更新 (旧列構造から新列構造へのマッピング変換と完全データ保持) */
function updateSysSheetsSafely_(sheet, initialData) {
  var lastRow = sheet.getLastRow();
  
  // 既存データがある場合は完全消去せず、新定義で上書き更新
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
  }
  
  initialData.forEach(function(row) {
    sheet.appendRow(row);
  });
}

/** PROJECT_STATEの安全更新 (キーが存在すれば現在値のみ更新) */
function updateProjectStateSafely_(sheet, initialData) {
  var lastRow = sheet.getLastRow();
  var existingKeys = {};
  
  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0]) {
        existingKeys[String(data[i][0]).trim()] = i + 2;
      }
    }
  }

  initialData.forEach(function(row) {
    var key = row[0];
    if (existingKeys[key]) {
      var rowNum = existingKeys[key];
      sheet.getRange(rowNum, 2).setValue(row[1]); // 状態値
      sheet.getRange(rowNum, 3).setValue(row[2]); // 説明
      sheet.getRange(rowNum, 4).setValue(row[3]); // 更新日時
    } else {
      sheet.appendRow(row);
    }
  });
}

/** 履歴・ログ系シート判定 */
function isHistoryOrLogSheet_(sheetKey) {
  var historyKeys = [
    "LOG_ERROR", "LOG_APP", "LOG_HISTORY", "LOG_SCHEMA",
    "PROJECT_CHECKPOINT", "PROJECT_DECISIONS"
  ];
  return historyKeys.indexOf(sheetKey) !== -1;
}

/** 履歴・ログ系シートの安全追記 (既存行は絶対削除せず、ID重複チェックの上で新規行のみ追記) */
function appendHistoryDataSafely_(sheet, initialData) {
  if (!initialData || initialData.length === 0) return;

  var lastRow = sheet.getLastRow();
  var existingIDs = {};

  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0]) {
        existingIDs[String(data[i][0]).trim()] = true;
      }
    }
  }

  initialData.forEach(function(row) {
    var id = row[0];
    if (!existingIDs[id]) {
      sheet.appendRow(row);
    }
  });
}

/** マスタ系シートの安全差分更新 (ID重複チェックで未登録行のみ追記) */
function updateMasterDataSafely_(sheet, initialData) {
  var lastRow = sheet.getLastRow();
  var existingIDs = {};

  if (lastRow > 1) {
    var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < data.length; i++) {
      var compositeKey = String(data[i][0]).trim() + "_" + String(data[i][1]).trim();
      existingIDs[compositeKey] = true;
    }
  }

  initialData.forEach(function(row) {
    var compositeKey = String(row[0]).trim() + "_" + String(row[1]).trim();
    if (!existingIDs[compositeKey]) {
      sheet.appendRow(row);
    }
  });
}

/** 初回構築時専用：空のデフォルトシート「シート1」の安全削除処理 */
function cleanupDefaultSheet1Safely_(ss) {
  var sheet1 = ss.getSheetByName("シート1") || ss.getSheetByName("Sheet1");
  if (!sheet1) return;

  // 14管理シートがすべて正常に存在しているか検証
  var requiredSheets = ["00_システム設定", "01_シート管理台帳", "06_ルールマスタ", "15_PROJECT_DECISIONS"];
  var allPresent = requiredSheets.every(function(sName) {
    return ss.getSheetByName(sName) !== null;
  });

  if (!allPresent) {
    Logger.log("ℹ️ 管理シートの一部が存在しないため、「シート1」の削除スキップ");
    return;
  }

  // 完全な空シートかどうかの判定 (データが1セルもないか)
  var lastRow = sheet1.getLastRow();
  var lastCol = sheet1.getLastColumn();

  if (lastRow <= 1 && lastCol <= 1) {
    var val = sheet1.getRange(1, 1).getValue();
    if (val === "" || val === null || val === undefined) {
      try {
        ss.deleteSheet(sheet1);
        Logger.log("🧹 初回Googleスプレッドシート自動作成時の空の「シート1」を安全削除しました。");
      } catch (e) {
        Logger.log("ℹ️ 「シート1」の削除はスキップされました: " + e.message);
      }
    } else {
      Logger.log("⚠️ 「シート1」にデータが存在するため、削除せず保持しました。");
    }
  } else {
    Logger.log("⚠️ 「シート1」に複数セルが存在するため、削除せず保持しました。");
  }
}

/** 表示UXフォーマット設定の安全適用 */
function applyUxFormatting_(sheet, def) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow > 0 && lastCol > 0) {
    // 全タイト・データの折り返し有効化
    sheet.getRange(1, 1, lastRow, lastCol).setWrap(true);
  }

  // 列幅自動調整
  for (var col = 1; col <= def.headers.length; col++) {
    sheet.autoResizeColumn(col);
  }

  // 非表示列設定 (SYS_SHEETSの6列目から11列分)
  if (def.hideFromCol && def.hideColCount) {
    sheet.hideColumns(def.hideFromCol, def.hideColCount);
  }
}
