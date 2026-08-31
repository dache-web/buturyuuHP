/**
 * ============================================================================
 * 文書番号：TOOL-01 / スプレッドシート自動構築スクリプト
 * ファイル名：SetupSpreadsheet.gs
 * 役割：第0工程 スプレッドシート管理基盤（全14シート）の自動初期化・書式・初期データセットアップ
 * ============================================================================
 */

function setupSpreadsheetManagementBase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 14個の管理シート定義
  var sheetDefinitions = [
    {
      name: "00_システム設定",
      headers: ["設定キー", "設定値", "分類", "説明", "最終更新日時"],
      initialData: [
        ["APP_NAME", "配車・運行管理アプリ", "全般", "システムの正式名称", "2026-09-01 05:40:00"],
        ["SCHEMA_VERSION", "0.1.0", "システム", "スプレッドシートのスキーマバージョン", "2026-09-01 05:40:00"],
        ["CURRENT_STEP", "第0工程 スプレッドシート管理基盤", "開発", "現在進行中の開発工程", "2026-09-01 05:40:00"],
        ["DEFAULT_PAGE_SIZE", "50", "画面", "メイン配車画面の1ページあたり標準表示件数", "2026-09-01 05:40:00"],
        ["DEFAULT_COMPANY_ID", "CMP-001", "将来拡張", "単一拠点運用時の標準会社ID", "2026-09-01 05:40:00"],
        ["DEFAULT_OFFICE_ID", "OFF-001", "将来拡張", "単一拠点運用時の標準営業所ID", "2026-09-01 05:40:00"]
      ]
    },
    {
      name: "01_シート管理台帳",
      headers: ["シートキー", "実シート名", "画面表示名", "分類", "何のシートか", "誰が使うか", "使用状態", "開発優先度", "操作区分", "読取可否", "書込可否", "正本か", "削除禁止か", "関連機能", "作成日", "最終変更日"],
      initialData: [
        ["SYS_CONFIG", "00_システム設定", "システム設定", "設定", "全体パラメータ・動作設定の保持", "システム管理者", "使用中", "高", "見るだけ", true, true, true, true, "全体システム", "2026-09-01", "2026-09-01 05:40:00"],
        ["SYS_SHEETS", "01_シート管理台帳", "シート管理センター", "システム", "全シートの目的・権限・状態管理", "全ユーザー", "使用中", "高", "見るだけ", true, true, true, true, "基盤管理", "2026-09-01", "2026-09-01 05:40:00"],
        ["SYS_FIELDS", "02_項目定義台帳", "項目・カラム定義", "システム", "全項目の型・非公開属性・説明の一元管理", "全ユーザー", "使用中", "高", "見るだけ", true, true, true, true, "基盤管理", "2026-09-01", "2026-09-01 05:40:00"],
        ["SYS_DEPENDENCIES", "03_シート依存関係台帳", "シート依存関係", "システム", "どのシートがどのシートを参照しているかの管理", "システム管理者", "使用中", "高", "見るだけ", true, true, true, true, "基盤管理", "2026-09-01", "2026-09-01 05:40:00"],
        ["SYS_FEATURES", "04_機能管理台帳", "機能・画面対応表", "システム", "どの機能がどのシートを使用しているかの管理", "システム管理者", "使用中", "高", "見るだけ", true, true, true, true, "基盤管理", "2026-09-01", "2026-09-01 05:40:00"],
        ["M_OPTIONS", "05_選択肢マスタ", "ドロップダウン選択肢", "マスタ", "画面上の選択肢（状態・車格等）のデータ", "運行管理者", "使用中", "高", "条件付きでOK", true, true, true, false, "配車入力・画面全般", "2026-09-01", "2026-09-01 05:40:00"],
        ["M_RULES", "06_ルールマスタ", "業務ルール定義", "マスタ", "警告・自動判定ルールの保持", "運行管理者", "使用中", "高", "条件付きでOK", true, true, true, false, "自動チェック・配車検証", "2026-09-01", "2026-09-01 05:40:00"],
        ["LOG_ERROR", "09_エラーログ", "システムエラーログ", "ログ", "エラー発生時の詳細ログ永久保存", "システム管理者", "使用中", "高", "自動管理", true, true, true, true, "エラー発生検知", "2026-09-01", "2026-09-01 05:40:00"],
        ["LOG_APP", "10_アプリログ", "操作・イベントログ", "ログ", "誰がいつ何の操作を行ったかのログ", "システム管理者", "使用中", "高", "自動管理", true, true, true, true, "操作監査", "2026-09-01", "2026-09-01 05:40:00"],
        ["LOG_HISTORY", "11_データ変更履歴", "データ変更履歴", "ログ", "配車やマスタの変更前後のトレース記録", "運行管理者", "使用中", "高", "自動管理", true, true, true, true, "変更追跡", "2026-09-01", "2026-09-01 05:40:00"],
        ["LOG_SCHEMA", "12_スキーマ変更履歴", "システム構造変更履歴", "ログ", "シート・カラム等の構造変更履歴", "システム管理者", "使用中", "高", "自動管理", true, true, true, true, "構造変更追跡", "2026-09-01", "2026-09-01 05:40:00"],
        ["PROJECT_STATE", "13_PROJECT_CURRENT_STATE", "開発現在地保持", "システム", "現在の進行工程・正本ドキュメント等の記録", "AG / 管理者", "使用中", "高", "見るだけ", true, true, true, true, "進捗管理", "2026-09-01", "2026-09-01 05:40:00"],
        ["PROJECT_CHECKPOINT", "14_PROJECT_CHECKPOINT", "チェックポイント記録", "システム", "Gitコミット・検証状態の紐付けログ", "AG / 管理者", "使用中", "高", "見るだけ", true, true, true, true, "復元地点管理", "2026-09-01", "2026-09-01 05:40:00"],
        ["PROJECT_DECISIONS", "15_PROJECT_DECISIONS", "意思決定理由台帳", "システム", "なぜその構造・ルールにしたかの理由記録", "全ユーザー", "使用中", "高", "見るだけ", true, true, true, true, "設計根拠記録", "2026-09-01", "2026-09-01 05:40:00"]
      ]
    },
    {
      name: "02_項目定義台帳",
      headers: ["対象シートキー", "物理項目キー", "項目名", "画面表示名", "データ型", "必須判定", "固定コア項目か", "通常ドライバー非公開", "操作区分", "この項目は何か", "間違えると何に影響するか"],
      initialData: [
        ["T_DISPATCH", "DispatchID", "仕事ID", "仕事ID", "String", true, true, false, "触らない", "1つの仕事を識別する唯一の番号", "他システム連携や明細紐付けが壊れます"],
        ["T_DISPATCH", "TargetDate", "配車対象日", "配車日", "Date", true, true, false, "条件付きでOK", "配車を行う日付 (YYYY-MM-DD)", "誤ると別の日の配車表に表示されます"],
        ["T_DISPATCH", "RunOrder", "仕事運行順", "便順", "Integer", true, true, false, "条件付きでOK", "当日のドライバーの何便目か(1, 2, 3...)", "一日の仕事の順番が前後します"],
        ["T_DISPATCH", "Status", "配車状態", "状態", "Enum", true, true, false, "触ってOK", "通常 / 保留 / キャンセル / 仮確定 / 確定", "ドライバーへの公開状況が変わります"],
        ["T_DISPATCH", "DriverID", "ドライバーID", "運転手", "String", false, true, false, "触ってOK", "担当する自社ドライバーのID", "担当運転手が変わります"],
        ["T_DISPATCH", "VehicleID", "車両ID", "車両", "String", false, true, false, "触ってOK", "使用する自社車両のID", "割り当て車両が変わります"],
        ["T_DISPATCH", "IsPartner", "庸車フラグ", "庸車区分", "Boolean", true, true, false, "触ってOK", "自社便か協力会社(庸車)便かの区分", "自社車か庸車かの集計が変わります"],
        ["T_DISPATCH", "PartnerCompanyID", "庸車会社ID", "庸車会社", "String", false, true, false, "触ってOK", "依頼する庸車会社のID", "支払い先の会社が変わります"],
        ["T_DISPATCH", "PartnerVehicleID", "庸車車両ID", "庸車車番", "String", false, true, false, "触ってOK", "庸車先の車番・車格情報", "当日入る庸車車両の特定に影響します"],
        ["T_DISPATCH", "AdminMemo", "管理者専用メモ", "社内メモ", "String", false, false, true, "触ってOK", "運行管理者のみが閲覧・入力するメモ", "ドライバーには表示されません"],
        ["T_DISPATCH", "CustomerName", "荷主名", "荷主", "String", false, false, false, "触ってOK", "仕事を依頼したお客様のお名前", "配車カードの顧客表記に反映されます"]
      ]
    },
    {
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
      name: "04_機能管理台帳",
      headers: ["機能Key", "機能名", "画面名", "使用SheetKey", "読取/書込", "必須/任意", "使用状態", "開発優先度"],
      initialData: [
        ["FEAT_MAIN_DISPATCH", "メイン配車UI", "メイン配車画面", "T_DISPATCH", "ReadWrite", "必須", "開発中", "高"],
        ["FEAT_MAIN_DISPATCH", "メイン配車UI", "メイン配車画面", "M_DRIVER", "ReadOnly", "必須", "開発中", "高"],
        ["FEAT_MAIN_DISPATCH", "メイン配車UI", "メイン配車画面", "M_VEHICLE", "ReadOnly", "必須", "開発中", "高"],
        ["FEAT_MAIN_DISPATCH", "メイン配車UI", "メイン配車画面", "M_PARTNER_COMPANY", "ReadOnly", "任意", "開発中", "高"],
        ["FEAT_DISPATCH_DETAIL", "配車詳細編集", "配車詳細モーダル", "T_DISPATCH", "ReadWrite", "必須", "開発中", "高"],
        ["FEAT_WEEKLY_PATTERN", "基本配車登録", "基本配車画面", "M_PATTERN", "ReadWrite", "必須", "開発中", "高"],
        ["FEAT_RECEPTION_BOX", "配車受付BOX", "受付BOX画面", "T_RECEPTION", "ReadWrite", "必須", "開発中", "高"]
      ]
    },
    {
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
        ["OPERATION_TYPE", "OK_TOUCH", "触ってOK", 1, true, "#4CAF50"],
        ["OPERATION_TYPE", "OK_CONDITIONAL", "条件付きでOK", 2, true, "#FF9800"],
        ["OPERATION_TYPE", "READ_ONLY", "見るだけ", 3, true, "#2196F3"],
        ["OPERATION_TYPE", "DO_NOT_TOUCH", "触らない", 4, true, "#F44336"],
        ["OPERATION_TYPE", "AUTO_MANAGED", "自動管理", 5, true, "#9E9E9E"]
      ]
    },
    {
      name: "06_ルールマスタ",
      headers: ["ルールKey", "ルール名", "設定値/条件JSON", "警告メッセージ", "有効フラグ"],
      initialData: [
        ["SAME_DAY_CHANGE_ALERT", "当日変更時の警告ダイアログ表示", "true", "これは当日配車の変更です。変更履歴に記録されますがよろしいですか？", true],
        ["PREVENT_DUPLICATE_ASSIGN", "同一ドライバー・車両の重複配車禁止", "true", "該当のドライバーまたは車両は同時間帯に別の運行（期間占有含む）へ割り当て済みです。", true],
        ["MIN_REST_HOURS", "便間の最低休息時間閾値(時間)", "8", "前日運行からの休息時間が規定（8時間）未満の可能性があります。", true]
      ]
    },
    {
      name: "09_エラーログ",
      headers: ["ログID", "発生日時", "発生機能Key", "実行ユーザー", "対象SheetKey", "対象ID", "エラーメッセージ", "詳細スタックトレース", "対応状態"],
      initialData: []
    },
    {
      name: "10_アプリログ",
      headers: ["ログID", "操作日時", "操作ユーザー", "操作種別", "対象ID", "操作詳細JSON"],
      initialData: []
    },
    {
      name: "11_データ変更履歴",
      headers: ["履歴ID", "変更日時", "変更ユーザー", "対象SheetKey", "対象ID", "変更前JSON", "変更後JSON"],
      initialData: []
    },
    {
      name: "12_スキーマ変更履歴",
      headers: ["構造変更ID", "変更日時", "変更種別", "対象Sheet/FieldKey", "変更前定義", "変更後定義", "変更理由"],
      initialData: [
        ["SCH-001", "2026-09-01 05:40:00", "初期管理基盤構築", "ALL_SYS_SHEETS", "-", "SchemaVersion 0.1.0 (全14管理シート)", "第0工程スプレッドシート管理基盤の初期構築"]
      ]
    },
    {
      name: "13_PROJECT_CURRENT_STATE",
      headers: ["状態キー", "状態値", "説明", "更新日時"],
      initialData: [
        ["CurrentStep", "第0工程 実装途中（ユーザー実機検収待ち）", "現在実行中の開発工程", "2026-09-01 06:26:00"],
        ["CurrentPlanDocument", "PLAN-02", "現在参照中の実装前計画書番号", "2026-09-01 06:26:00"],
        ["CurrentPlanName", "実装前計画書_修正版02", "現在参照中の実装前計画書名称", "2026-09-01 06:26:00"],
        ["CurrentInstructionDocument", "FIX-04", "現在参照中の指示書番号", "2026-09-01 06:26:00"],
        ["CurrentInstructionName", "第0工程_実機検収前確認指示_04", "現在参照中の指示書名称", "2026-09-01 06:26:00"],
        ["SchemaVersion", "0.1.0", "現在のスプレッドシート構造バージョン", "2026-09-01 06:26:00"],
        ["ImplementationStatus", "STEP_0_IN_PROGRESS_WAITING_USER_VERIFICATION", "実装ステータス", "2026-09-01 06:26:00"]
      ]
    },
    {
      name: "14_PROJECT_CHECKPOINT",
      headers: ["チェックポイントID", "工程名", "Gitコミットハッシュ", "Gitタグ名", "SchemaVersion", "ユーザー検証状態", "作成日時"],
      initialData: [
        ["CP-STEP-0-START", "第0工程開始前", "HEAD", "v0.0.0-checkpoint-0-start", "0.1.0", "OK", "2026-09-01 05:40:00"],
        ["CP-STEP-0-COMPLETE", "第0工程管理基盤実装途中（ユーザー検収前）", "HEAD", "v0.1.0-checkpoint-0-complete", "0.1.0", "Pending", "2026-09-01 06:26:00"]
      ]
    },
    {
      name: "15_PROJECT_DECISIONS",
      headers: ["決定ID", "決定内容タイトル", "決定内容", "決定理由(Why)", "関連文書番号", "決定日時"],
      initialData: [
        ["DEC-001", "DispatchIDの一仕事一ID化", "T_DISPATCHを1仕事＝1行の単一正本シートとする。", "SSoTを維持し、運賃明細・PDF/FAX・履歴等を直接 DispatchID に紐付けるため。", "FIX-01 / PLAN-02", "2026-09-01 05:34:00"],
        ["DEC-002", "文書番号管理ルールの統一", "開発関連ドキュメントは「完成版・最終版」という言葉を使用せず、連番文書名で管理する。", "今後の追加修正が多く発生するプロジェクトにおいて最新参照先を特定可能にするため。", "FIX-02 / PLAN-02", "2026-09-01 05:38:00"],
        ["DEC-003", "第0工程での業務シート作成禁止", "第0工程では管理基盤14シートのみを作成し、M_DRIVER等の業務シートはユーザー確認OK後に作成する。", "まずスプレッドシート管理基盤の構造をユーザー本人が実機で見て安全性を検証するため。", "FIX-03", "2026-09-01 05:40:00"],
        ["DEC-004", "コード生成完了と実際のスプレッドシート構築完了の区別", "AGによるGASコード生成完了地点では工程完成（OK）とせず、ユーザーが実際にブラウザで開けるスプレッドシートが構築され検収されることで工程完成とする。", "実際の成果物をユーザーが確認できない状態で、AI判断のみで工程完成扱いにしないため。", "FIX-04", "2026-09-01 06:26:00"]
      ]
    }
  ];

  sheetDefinitions.forEach(function(def) {
    var sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    } else {
      sheet.clear();
    }
    
    // ヘッダー追加
    sheet.appendRow(def.headers);
    var headerRange = sheet.getRange(1, 1, 1, def.headers.length);
    headerRange.setBackground("#1A237E")
               .setFontColor("#FFFFFF")
               .setFontWeight("bold")
               .setFontSize(10);
    sheet.setFrozenRows(1);

    // 初期データ追加
    if (def.initialData && def.initialData.length > 0) {
      def.initialData.forEach(function(row) {
        sheet.appendRow(row);
      });
    }

    // 列幅自動調整
    for (var col = 1; col <= def.headers.length; col++) {
      sheet.autoResizeColumn(col);
    }
  });

  SpreadsheetApp.getUi().alert("第0工程 スプレッドシート管理基盤（全14シート）の自動構築が完了しました！");
}
