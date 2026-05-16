// =========================================
// 設定
// =========================================
const SHEET_NAME_SETTINGS = '0. 設定';
const SHEET_NAME_CSV = '1. CSV取込用';
const SHEET_NAME_MAIN = '2. メイン仕訳帳';
const SHEET_NAME_DICT = '3. AI辞書';
const SHEET_NAME_ACCOUNT_MASTER = '4. 勘定科目マスタ';
const SHEET_NAME_ERROR = 'エラーログ';

const SYSTEM_FOLDER_NAME = '【保管専用】AI経費システム_取り込み済みファイル';
const RECEIPT_INPUT_FOLDER_NAME = '【レシート投入用】AI経費システム_レシート画像投入';

const MAIN_HEADERS = ['日付', '内容', '金額', '支払方法', '大カテゴリ', '勘定科目', '説明', '備考', '画像リンク'];
const DICT_HEADERS = ['内容（店名など）', '勘定科目'];

// =========================================
// メニュー
// =========================================
function onOpen() {
  createCustomMenu_();
}

function createCustomMenu_() {
  SpreadsheetApp.getUi()
    .createMenu('経費AIシステム')
    .addItem('PDF・画像をアップロード', 'showDocumentUploadDialog')
    .addItem('CSV専用アップロード', 'showCsvUploadDialog')
    .addItem('レシート投入フォルダから取り込み', 'processImagesWithAI')
    .addSeparator()
    .addItem('0. 初期設定・受け口作成', 'setupAccountingApp')
    .addItem('CSV貼り付けシートから取り込み', 'processCsvWithAI')
    .addItem('9. 勘定科目プルダウンを再設定', 'refreshAccountDropdown')
    .addToUi();
}

function menuSmokeTest() {
  SpreadsheetApp.getUi().alert('メニュー動作確認OKです。');
}

// =========================================
// 初期設定
// =========================================
function setupAccountingApp() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  createCustomMenu_();

  const settingsSheet = getOrCreateSheet_(ss, SHEET_NAME_SETTINGS);
  const csvSheet = getOrCreateSheet_(ss, SHEET_NAME_CSV);
  const mainSheet = getOrCreateSheet_(ss, SHEET_NAME_MAIN);
  const dictSheet = getOrCreateSheet_(ss, SHEET_NAME_DICT);
  const masterSheet = getOrCreateSheet_(ss, SHEET_NAME_ACCOUNT_MASTER);

  setupSettingsSheet_(settingsSheet);
  setupCsvSheet_(csvSheet);
  setupHeaderRow_(mainSheet, MAIN_HEADERS);
  setupHeaderRow_(dictSheet, DICT_HEADERS);
  setupAccountMasterSheet_(masterSheet);
  setupAccountDropdown_(mainSheet, masterSheet);

  SpreadsheetApp.getUi().alert('初期設定を更新しました。\n\nCSVは「CSV専用アップロード」または「1. CSV取込用」。\nPDF・画像は「PDF・画像をアップロード」。\nレシートをフォルダに入れる場合は「レシート投入フォルダから取り込み」です。');
}

function setupSettingsSheet_(sheet) {
  sheet.getRange('A1:B1').setValues([['設定項目', '設定値（ここに貼り付け）']]).setBackground('#d9ead3').setFontWeight('bold');
  if (!String(sheet.getRange('A2').getValue()).trim()) sheet.getRange('A2:B2').setValues([['OpenAI APIキー', '']]);
  if (!String(sheet.getRange('A3').getValue()).trim()) sheet.getRange('A3:B3').setValues([['システム保管フォルダID', '']]);
  if (!String(sheet.getRange('A4').getValue()).trim()) sheet.getRange('A4:B4').setValues([['レシート投入フォルダID', '']]);
  sheet.getRange('C2').setValue('← sk- から始まるキーを貼り付け');
  sheet.getRange('C3').setValue('← 【保管専用】取り込み済みPDF・画像・CSVの保存先。ユーザーが手で入れる場所ではありません');
  sheet.getRange('C4').setValue('← 【レシート投入用】ユーザーがレシート画像を入れる場所です');
  sheet.setColumnWidth(1, 180);
  sheet.setColumnWidth(2, 460);
  sheet.setColumnWidth(3, 620);
  sheet.setFrozenRows(1);
}

function refreshAccountDropdown() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = getOrCreateSheet_(ss, SHEET_NAME_MAIN);
  const masterSheet = getOrCreateSheet_(ss, SHEET_NAME_ACCOUNT_MASTER);
  setupHeaderRow_(mainSheet, MAIN_HEADERS);
  setupAccountMasterSheet_(masterSheet);
  setupAccountDropdown_(mainSheet, masterSheet);
  SpreadsheetApp.getUi().alert('勘定科目プルダウンを再設定しました。');
}

// =========================================
// アップロード画面
// =========================================
function showDocumentUploadDialog() {
  showUploadDialog_('PDF・画像をアップロード', '.pdf,image/*', 'PDF・画像をアップロードしてください。複数ファイルも選べます。', 'document');
}

function showCsvUploadDialog() {
  showUploadDialog_('CSV専用アップロード', '.csv,text/csv,application/vnd.ms-excel', 'CSV専用です。銀行・カード明細はこちらから取り込んでください。', 'csv');
}

function showUploadDialog_(title, accept, leadText, mode) {
  const html = HtmlService.createHtmlOutput(getUploadHtml_(title, accept, leadText, mode))
    .setWidth(720)
    .setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(html, 'ファイル取り込み');
}

function getUploadHtml_(title, accept, leadText, mode) {
  return `<!doctype html>
<html>
<head>
  <base target="_top">
  <style>
    body { font-family: Arial, "Hiragino Sans", "Meiryo", sans-serif; margin: 0; color: #202124; }
    .wrap { padding: 30px 40px; }
    h2 { margin: 0 0 18px; font-size: 24px; }
    .drop {
      border: 2px dashed #1a73e8; border-radius: 12px; min-height: 150px;
      display: flex; align-items: center; justify-content: center; text-align: center;
      background: #f8fbff; margin: 16px 0 22px; padding: 18px;
    }
    .drop.drag { background: #e8f0fe; }
    input { max-width: 100%; }
    button {
      width: 100%; border: 0; border-radius: 9px; background: #1a73e8; color: white;
      font-size: 18px; font-weight: 700; padding: 16px; cursor: pointer;
    }
    button:disabled { background: #9aa0a6; cursor: not-allowed; }
    .status { white-space: pre-wrap; margin-top: 16px; line-height: 1.5; font-size: 14px; }
    .small { color: #5f6368; font-size: 13px; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="wrap">
    <h2>${escapeHtml_(title)}</h2>
    <div>${escapeHtml_(leadText)}</div>
    <div id="drop" class="drop">
      <div>
        <div style="font-size:18px;font-weight:700;margin-bottom:14px;">ここにドラッグ&ドロップ、または選択</div>
        <input id="file" type="file" accept="${accept}" multiple>
        <div id="names" class="small">未選択</div>
      </div>
    </div>
    <button id="run" onclick="runImport()">アップロードして取り込み</button>
    <div id="status" class="status"></div>
  </div>
  <script>
    const input = document.getElementById('file');
    const drop = document.getElementById('drop');
    const names = document.getElementById('names');
    const statusEl = document.getElementById('status');
    const runBtn = document.getElementById('run');
    let selectedFiles = [];

    input.addEventListener('change', () => setFiles(input.files));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('drag');
      setFiles(e.dataTransfer.files);
    });

    function setFiles(files) {
      selectedFiles = Array.from(files || []);
      names.textContent = selectedFiles.length ? selectedFiles.map(f => f.name).join('\\n') : '未選択';
    }

    function readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = String(reader.result || '');
          resolve({
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            data: dataUrl.split(',')[1] || ''
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    async function runImport() {
      if (!selectedFiles.length) {
        statusEl.textContent = 'ファイルを選択してください。';
        return;
      }
      runBtn.disabled = true;
      statusEl.textContent = 'アップロード中...';
      try {
        const payloads = await Promise.all(selectedFiles.map(readFile));
        statusEl.textContent = '取り込み中...';
        google.script.run
          .withSuccessHandler(result => {
            alert(result.message || '取り込み完了');
            google.script.host.close();
            setTimeout(() => google.script.host.close(), 300);
            setTimeout(() => google.script.host.close(), 1000);
          })
          .withFailureHandler(err => {
            runBtn.disabled = false;
            statusEl.textContent = 'エラー: ' + (err && err.message ? err.message : err);
          })
          .uploadAndProcessFiles(payloads, '${mode}');
      } catch (e) {
        runBtn.disabled = false;
        statusEl.textContent = 'エラー: ' + e.message;
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// =========================================
// アップロード取り込み
// =========================================
function uploadAndProcessFiles(files, mode) {
  if (!Array.isArray(files) || files.length === 0) throw new Error('ファイルが選択されていません。');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = getOrCreateSheet_(ss, SHEET_NAME_MAIN);
  const masterSheet = getOrCreateSheet_(ss, SHEET_NAME_ACCOUNT_MASTER);
  const dictSheet = getOrCreateSheet_(ss, SHEET_NAME_DICT);
  setupHeaderRow_(mainSheet, MAIN_HEADERS);
  setupAccountMasterSheet_(masterSheet);
  setupHeaderRow_(dictSheet, DICT_HEADERS);
  setupAccountDropdown_(mainSheet, masterSheet);

  const apiKey = getOpenAiApiKey();
  const systemFolder = getOrCreateSystemFolder_();
  const dictionaryText = getDictionaryText_(dictSheet);
  const masterText = getAccountMasterText_(masterSheet);

  let success = 0;
  const errors = [];

  files.forEach(uploaded => {
    try {
      const name = uploaded.name || 'upload';
      const mime = normalizeUploadMime_(uploaded.name || 'upload', uploaded.mimeType || 'application/octet-stream');
      const lower = name.toLowerCase();
      const bytes = Utilities.base64Decode(uploaded.data || '');
      let blob = Utilities.newBlob(bytes, mime, name);

      if (mode === 'csv' && !isCsvFile_(name, mime)) throw new Error('CSV専用アップロードにはCSVファイルを選択してください。');
      if (mode === 'document' && isCsvFile_(name, mime)) throw new Error('CSVは「CSV専用アップロード」から取り込んでください。');

      let storedFile = systemFolder.createFile(blob);
      storedFile.setName('【処理済み】' + name);
      makeFileReadableByLink_(storedFile);

      if (isCsvFile_(name, mime)) {
        const csvText = decodeCsvBlob_(blob);
        const results = analyzeCsvText_(csvText, dictionaryText, name);
        appendResults_(mainSheet, masterSheet, results, storedFile.getUrl());
      } else if (lower.endsWith('.pdf') || mime === MimeType.PDF || mime === 'application/pdf') {
        if (!apiKey) throw new Error('OpenAI APIキーが未設定です。');
        const text = extractTextFromPdfByDriveOcr_(blob, name);
        const results = analyzeDocumentTextWithAI_(apiKey, text, dictionaryText, masterText, name);
        appendResults_(mainSheet, masterSheet, results, storedFile.getUrl());
      } else if (String(mime).indexOf('image/') === 0 || /\.(jpg|jpeg|png|webp|gif)$/i.test(name)) {
        if (!apiKey) throw new Error('OpenAI APIキーが未設定です。');
        const results = analyzeImageWithAI_(apiKey, blob, dictionaryText, masterText, name);
        appendResults_(mainSheet, masterSheet, results, storedFile.getUrl());
      } else {
        throw new Error('対応していないファイル形式です。PDF・画像・CSVを選択してください。');
      }

      success++;
    } catch (e) {
      errors.push((uploaded.name || 'ファイル') + ': ' + e.message);
      writeErrorLog('アップロード取り込みエラー - ' + (uploaded.name || 'ファイル') + ': ' + e.message);
    }
  });

  setupAccountDropdown_(mainSheet, masterSheet);
  return {
    ok: errors.length === 0,
    message: '取り込み完了\n成功: ' + success + '件\nエラー: ' + errors.length + '件' + (errors.length ? '\n\n' + errors.join('\n') : '')
  };
}

function isCsvFile_(name, mime) {
  const lower = String(name || '').toLowerCase();
  return lower.endsWith('.csv') || mime === MimeType.CSV || mime === 'text/csv' || mime === 'application/vnd.ms-excel';
}

function normalizeUploadMime_(name, mime) {
  const lower = String(name || '').toLowerCase();
  const current = String(mime || '').trim();
  if (lower.endsWith('.pdf')) return MimeType.PDF;
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  return current || 'application/octet-stream';
}

function makeFileReadableByLink_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    writeErrorLog('警告: ファイル共有設定を変更できませんでした。詳細: ' + e.message);
  }
}

// =========================================
// CSV取り込み
// =========================================
function processCsvWithAI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const csvSheet = getOrCreateSheet_(ss, SHEET_NAME_CSV);
  const mainSheet = getOrCreateSheet_(ss, SHEET_NAME_MAIN);
  const dictSheet = getOrCreateSheet_(ss, SHEET_NAME_DICT);
  const masterSheet = getOrCreateSheet_(ss, SHEET_NAME_ACCOUNT_MASTER);

  setupHeaderRow_(mainSheet, MAIN_HEADERS);
  setupHeaderRow_(dictSheet, DICT_HEADERS);
  setupAccountMasterSheet_(masterSheet);
  setupAccountDropdown_(mainSheet, masterSheet);

  const csvText = getCsvInputText_(csvSheet);
  if (!csvText) {
    SpreadsheetApp.getUi().alert('処理するCSVデータがありません。「1. CSV取込用」シートにCSVを貼り付けてください。');
    return;
  }

  try {
    const results = analyzeCsvText_(csvText, getDictionaryText_(dictSheet), '貼り付けCSV');
    appendResults_(mainSheet, masterSheet, results, '');
    clearCsvInput_(csvSheet);
    SpreadsheetApp.getUi().alert('CSVの取り込みが完了しました。');
  } catch (e) {
    writeErrorLog('CSV処理エラー: ' + e.message);
    SpreadsheetApp.getUi().alert('CSV処理エラー: ' + e.message);
  }
}

function decodeCsvBlob_(blob) {
  const encodings = ['UTF-8', 'Shift_JIS', 'MS932', 'Windows-31J'];
  let best = '';
  let bestScore = -999999;

  encodings.forEach(enc => {
    try {
      const text = blob.getDataAsString(enc);
      const score = scoreDecodedCsvText_(text);
      if (score > bestScore) {
        bestScore = score;
        best = text;
      }
    } catch (e) {
      // GAS環境で未対応の文字コードは無視する
    }
  });

  if (!best) best = blob.getDataAsString();
  return best.replace(/^\uFEFF/, '');
}

function scoreDecodedCsvText_(text) {
  const s = String(text || '');
  let score = 0;
  const badChars = (s.match(/[�]/g) || []).length;
  const mojibake = (s.match(/[縺繧螟譁荳蜷逕蛹驥髱]/g) || []).length;
  const japanese = (s.match(/[ぁ-んァ-ヶ一-龠]/g) || []).length;
  const delimiters = (s.match(/[,	]/g) || []).length;
  const dates = (s.match(/\d{4}[\/-]?\d{1,2}[\/-]?\d{1,2}/g) || []).length;
  score += japanese * 3 + delimiters + dates * 10;
  score -= badChars * 80 + mojibake * 12;
  return score;
}

function analyzeCsvText_(csvText, dictionaryText, sourceName) {
  const results = parseCsvDeterministically_(csvText, dictionaryText, sourceName);
  if (!results.length) throw new Error('CSVの列を判定できませんでした。日付・金額・内容列を確認してください。');
  return results;
}

function parseCsvDeterministically_(csvText, dictionaryText, sourceName) {
  const rows = parseDelimitedRows_(String(csvText || '').trim());
  if (!rows.length) return [];

  const normalizedRows = rows
    .map(row => row.map(cell => String(cell || '').trim()))
    .filter(row => row.some(cell => cell !== ''));
  if (!normalizedRows.length) return [];

  const headerIndex = detectHeaderRowIndex_(normalizedRows);
  const header = headerIndex >= 0 ? normalizedRows[headerIndex] : [];
  const dataRows = normalizedRows.slice(headerIndex >= 0 ? headerIndex + 1 : 0);
  const columns = detectCsvColumns_(header, dataRows);
  if (columns.date < 0 || columns.amount < 0) return [];

  return dataRows.map(row => csvRowToJournal_(row, columns, dictionaryText, sourceName)).filter(Boolean);
}

function parseDelimitedRows_(text) {
  const cleaned = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];
  try {
    const commaRows = Utilities.parseCsv(cleaned);
    const commaCells = commaRows.reduce((sum, row) => sum + row.length, 0);
    const tabRows = Utilities.parseCsv(cleaned, '\t');
    const tabCells = tabRows.reduce((sum, row) => sum + row.length, 0);
    return tabCells > commaCells ? tabRows : commaRows;
  } catch (e) {
    return cleaned.split(/\r?\n/).map(line => line.split(line.indexOf('\t') >= 0 ? '\t' : ','));
  }
}

function detectHeaderRowIndex_(rows) {
  let bestIndex = -1;
  let bestScore = 0;
  rows.slice(0, Math.min(rows.length, 10)).forEach((row, index) => {
    const joined = row.join(' ');
    let score = 0;
    if (/日付|年月日|取引日|利用日|処理日|発生日/.test(joined)) score += 3;
    if (/金額|入金|出金|支払|利用額|請求額|引落|お支払/.test(joined)) score += 3;
    if (/内容|摘要|取引内容|利用店|加盟店|お取引内容|明細/.test(joined)) score += 3;
    if (/残高|差引残高|取引後残高/.test(joined)) score += 1;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestScore >= 4 ? bestIndex : -1;
}

function detectCsvColumns_(header, dataRows) {
  const colCount = Math.max.apply(null, [header.length].concat(dataRows.map(row => row.length)));
  const normalizedHeader = header.map(h => normalizeHeader_(h));

  let date = findHeaderIndex_(normalizedHeader, ['日付', '年月日', '取引日', '利用日', '処理日', '発生日', '入出金日']);
  let amount = findAmountHeaderIndex_(normalizedHeader);
  let content = findHeaderIndex_(normalizedHeader, ['内容', '摘要', '取引内容', '入出金内容', '利用店名', '加盟店', '店名', '明細', 'お取引内容', '備考']);
  let payment = findHeaderIndex_(normalizedHeader, ['支払方法', '決済方法', 'カード', '口座', '金融機関']);

  if (date < 0) date = scoreColumns_(dataRows, colCount, value => parseDateValue_(value) ? 10 : -2);
  if (amount === date || amount < 0) amount = -1;
  if (amount < 0) {
    amount = scoreColumns_(
      dataRows,
      colCount,
      value => scoreAmountValue_(value),
      index => index !== date && !isBalanceHeader_(normalizedHeader[index]) && !isDateHeader_(normalizedHeader[index])
    );
  }
  if (content < 0) content = scoreColumns_(dataRows, colCount, value => scoreContentValue_(value), index => index !== date && index !== amount && !isBalanceHeader_(normalizedHeader[index]));

  return { date: date, amount: amount, content: content, payment: payment };
}

function normalizeHeader_(value) {
  return String(value || '').replace(/\s/g, '').replace(/[()（）［］\[\]]/g, '').toLowerCase();
}

function findHeaderIndex_(headers, names) {
  for (let i = 0; i < headers.length; i++) {
    for (let j = 0; j < names.length; j++) {
      if (headers[i].indexOf(normalizeHeader_(names[j])) >= 0) return i;
    }
  }
  return -1;
}

function findAmountHeaderIndex_(headers) {
  const preferred = ['入出金額', '取引金額', '利用金額', '利用額', '支払金額', '請求金額', '金額', '出金額', '入金額', 'お支払金額'];
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (isBalanceHeader_(h)) continue;
    if (preferred.some(name => h.indexOf(normalizeHeader_(name)) >= 0)) return i;
  }
  return -1;
}

function isBalanceHeader_(header) {
  return /残高|差引残高|取引後残高|預り残高|利用可能額|現在高/.test(String(header || ''));
}

function isDateHeader_(header) {
  return /日付|年月日|取引日|利用日|処理日|発生日|入出金日/.test(String(header || ''));
}

function scoreColumns_(rows, colCount, scorer, allowed) {
  let bestIndex = -1;
  let bestScore = -999999;
  for (let col = 0; col < colCount; col++) {
    if (allowed && !allowed(col)) continue;
    let score = 0;
    rows.slice(0, 60).forEach(row => score += scorer(row[col]));
    if (score > bestScore) {
      bestScore = score;
      bestIndex = col;
    }
  }
  return bestScore > 0 ? bestIndex : -1;
}

function scoreContentValue_(value) {
  const text = String(value || '').trim();
  if (!text) return -3;
  if (parseDateValue_(text)) return -8;
  if (parseAmountValue_(text) !== null) return -4;
  if (/^\d+$/.test(text)) return -5;
  return Math.min(text.length, 30);
}

function scoreAmountValue_(value) {
  const text = String(value || '').trim();
  if (!text) return -3;
  if (isDateLikeNumericText_(text) || parseDateValue_(text)) return -20;
  const amount = parseAmountValue_(text);
  if (amount === null) return -2;
  let score = 8;
  if (/[+\-−▲△()]/.test(text)) score += 8;
  if (Math.abs(amount) >= 1 && Math.abs(amount) <= 10000000) score += 2;
  return score;
}

function csvRowToJournal_(row, columns, dictionaryText, sourceName) {
  const date = parseDateValue_(row[columns.date]);
  let amount = parseAmountValue_(row[columns.amount]);
  if (isDateLikeNumericText_(row[columns.amount]) || parseDateValue_(row[columns.amount])) {
    amount = null;
  }
  if (amount === null) {
    amount = findAmountInCsvRow_(row, columns);
  }
  if (!date || amount === null) return null;

  const content = buildCsvContent_(row, columns);
  const payment = columns.payment >= 0 ? String(row[columns.payment] || '').trim() : inferPaymentMethod_(row.join(' ') + ' ' + sourceName);
  const classified = classifyAccountLocally_(content, dictionaryText);

  return {
    Date: date,
    Content: content || '不明',
    Amount: Math.abs(amount),
    PaymentMethod: payment || inferPaymentMethod_(row.join(' ') + ' ' + sourceName),
    Category: classified.category,
    Account: classified.account,
    Description: classified.description,
    Notes: classified.notes,
    Confidence: classified.confidence
  };
}

function buildCsvContent_(row, columns) {
  if (columns.content >= 0 && String(row[columns.content] || '').trim()) return String(row[columns.content]).trim();
  const parts = row
    .map((cell, index) => ({ cell: String(cell || '').trim(), index: index }))
    .filter(item => item.cell && item.index !== columns.date && item.index !== columns.amount && item.index !== columns.payment)
    .filter(item => !parseDateValue_(item.cell) && parseAmountValue_(item.cell) === null && !/^\d+$/.test(item.cell))
    .map(item => item.cell);
  return parts.slice(0, 3).join(' ');
}

function parseDateValue_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  let m = text.match(/^(\d{4})[\/\-\.年]?(\d{1,2})[\/\-\.月]?(\d{1,2})日?$/);
  if (!m) m = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return '';
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  return y + '/' + ('0' + mo).slice(-2) + '/' + ('0' + d).slice(-2);
}

function parseAmountValue_(value) {
  let text = String(value || '').trim();
  if (!text) return null;
  if (isDateLikeNumericText_(text) || parseDateValue_(text)) return null;
  let negative = false;
  if (/^\(.*\)$/.test(text) || text.indexOf('−') >= 0 || text.indexOf('-') >= 0) negative = true;
  text = text.replace(/[,\s円￥¥]/g, '').replace(/[▲△−]/g, '-').replace(/[()]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  if (isNaN(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function isDateLikeNumericText_(value) {
  const text = String(value || '').trim().replace(/[,\s]/g, '');
  const m = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return y >= 1900 && y <= 2100 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31;
}

function findAmountInCsvRow_(row, columns) {
  const candidates = [];
  row.forEach((cell, index) => {
    if (index === columns.date || index === columns.content || index === columns.payment) return;
    const raw = String(cell || '').trim();
    if (!raw || isDateLikeNumericText_(raw) || parseDateValue_(raw)) return;
    const amount = parseAmountValue_(raw);
    if (amount === null) return;
    let score = 0;
    if (/[+\-−▲△()]/.test(raw)) score += 100;
    if (Math.abs(amount) > 0) score += 10;
    if (Math.abs(amount) > 10000000) score -= 50;
    candidates.push({ amount: amount, score: score, index: index });
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0].amount;
}

// =========================================
// PDF OCR / 画像AI
// =========================================
function extractTextFromPdfByDriveOcr_(blob, fileName) {
  if (typeof Drive === 'undefined' || !Drive.Files) {
    throw new Error('Drive APIサービスを追加してください。Apps Script左側「サービス」→ Drive API v3 を追加します。');
  }

  const resource = { name: 'OCR_' + fileName, mimeType: MimeType.GOOGLE_DOCS };
  let docFile;
  try {
    if (Drive.Files.create) {
      docFile = Drive.Files.create(resource, blob, { ocr: true, ocrLanguage: 'ja' });
    } else if (Drive.Files.insert) {
      docFile = Drive.Files.insert(resource, blob, { ocr: true, ocrLanguage: 'ja' });
    } else {
      throw new Error('Drive.Files.create が使えません。Drive API v3を追加してください。');
    }
    const doc = DocumentApp.openById(docFile.id);
    return doc.getBody().getText();
  } finally {
    if (docFile && docFile.id) {
      try {
        DriveApp.getFileById(docFile.id).setTrashed(true);
      } catch (e) {}
    }
  }
}

function analyzeDocumentTextWithAI_(apiKey, text, dictionaryText, masterText, sourceName) {
  const prompt = `
あなたは日本の経理担当です。OCRテキストから仕訳候補をJSONで返してください。

重要:
- 見積書・請求書・領収書・レシートは原則1ファイル1行。明細を細かく分解しない。
- 銀行明細・カード明細・通帳のように複数取引が並ぶ場合だけ、取引行ごとに複数行にする。
- Contentは発行元、宛名、件名、店名、摘要などから人が探せる内容にする。「不明」は最後の手段。
- 備考 Notes には必ず「元ファイル: ${sourceName}」を入れ、見積番号・請求番号・発行日などがあれば足す。
- 日付が読めない、または月日が00の場合は空欄にする。
- 勘定科目はマスタから選ぶ。迷う場合は大カテゴリ「確認」、勘定科目「未分類」、Confidence=false。

過去辞書:
${dictionaryText}

勘定科目マスタ:
${masterText}

返す形式:
{"items":[{"Date":"2026/04/29","Content":"株式会社○○ 見積書 アプリ開発","Amount":55000,"PaymentMethod":"","Category":"経費","Account":"外注費","Description":"外部委託・業務委託など","Notes":"元ファイル: sample.pdf / 見積No 1001","Confidence":true}]}

OCR:
${String(text || '').slice(0, 18000)}
`;

  const parsed = callOpenAiJson_(apiKey, prompt, 'PDF/OCR解析');
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!Array.isArray(items) || !items.length) throw new Error(sourceName + ': PDFから仕訳データを抽出できませんでした。');
  return items;
}

function analyzeImageWithAI_(apiKey, blob, dictionaryText, masterText, sourceName) {
  const base64 = Utilities.base64Encode(blob.getBytes());
  const mimeType = blob.getContentType() || 'image/jpeg';
  const prompt = `
領収書・レシート画像から仕訳候補をJSONで返してください。
1画像1行を基本にしてください。
Contentは店名・発行元が分かる名前にしてください。不明は最後の手段。
Notesには「元ファイル: ${sourceName}」とインボイス番号・軽減税率などがあれば入れてください。
勘定科目はマスタから選び、迷う場合は大カテゴリ「確認」、勘定科目「未分類」、Confidence=false。

過去辞書:
${dictionaryText}

勘定科目マスタ:
${masterText}

返す形式:
{"items":[{"Date":"2026/04/04","Content":"FamilyMart","Amount":800,"PaymentMethod":"現金","Category":"経費","Account":"雑費","Description":"他の科目に当てはまらない少額経費","Notes":"元ファイル: receipt.jpg","Confidence":true}]}
`;

  const payload = {
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: 'data:' + mimeType + ';base64,' + base64 } }
      ]
    }],
    temperature: 0.1,
    response_format: { type: 'json_object' }
  };
  const json = callOpenAiPayload_(apiKey, payload, '画像解析');
  const parsed = parseOpenAiJson_(json);
  const items = Array.isArray(parsed) ? parsed : (parsed.items || [parsed]);
  return items;
}

function processImagesWithAI() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mainSheet = getOrCreateSheet_(ss, SHEET_NAME_MAIN);
  const dictSheet = getOrCreateSheet_(ss, SHEET_NAME_DICT);
  const masterSheet = getOrCreateSheet_(ss, SHEET_NAME_ACCOUNT_MASTER);
  setupHeaderRow_(mainSheet, MAIN_HEADERS);
  setupHeaderRow_(dictSheet, DICT_HEADERS);
  setupAccountMasterSheet_(masterSheet);
  setupAccountDropdown_(mainSheet, masterSheet);

  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    SpreadsheetApp.getUi().alert('OpenAI APIキーが未設定です。');
    return;
  }

  const folder = getOrCreateReceiptInputFolder_();
  const files = [];
  const iter = folder.getFiles();
  while (iter.hasNext()) {
    const file = iter.next();
    const name = file.getName();
    const mime = file.getMimeType();
    if (name.indexOf('【処理済み】') === 0) continue;
    if (String(mime).indexOf('image/') === 0 || /\.(jpg|jpeg|png|webp)$/i.test(name)) files.push(file);
  }

  if (!files.length) {
    SpreadsheetApp.getUi().alert('レシート投入フォルダに未処理の画像がありません。\n「0. 設定」B4のフォルダへレシート画像を入れてください。');
    return;
  }

  const dictionaryText = getDictionaryText_(dictSheet);
  const masterText = getAccountMasterText_(masterSheet);
  let success = 0;
  const errors = [];

  files.forEach(file => {
    try {
      const results = analyzeImageWithAI_(apiKey, file.getBlob(), dictionaryText, masterText, file.getName());
      makeFileReadableByLink_(file);
      appendResults_(mainSheet, masterSheet, results, file.getUrl());
      file.setName('【処理済み】' + file.getName());
      success++;
    } catch (e) {
      errors.push(file.getName() + ': ' + e.message);
      writeErrorLog('レシート投入フォルダ取り込みエラー - ' + file.getName() + ': ' + e.message);
    }
  });

  SpreadsheetApp.getUi().alert('レシート取り込み完了\n成功: ' + success + '件\nエラー: ' + errors.length + (errors.length ? '\n\n' + errors.join('\n') : ''));
}

// =========================================
// OpenAI
// =========================================
function callOpenAiJson_(apiKey, prompt, contextLabel) {
  const payload = {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    response_format: { type: 'json_object' }
  };
  const json = callOpenAiPayload_(apiKey, payload, contextLabel);
  return parseOpenAiJson_(json);
}

function callOpenAiPayload_(apiKey, payload, contextLabel) {
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  const body = response.getContentText();
  if (status < 200 || status >= 300) {
    throw new Error(contextLabel + ' API HTTPエラー: ' + status + ' / ' + String(body || '').slice(0, 500));
  }
  return JSON.parse(body);
}

function parseOpenAiJson_(apiResponse) {
  const content = apiResponse && apiResponse.choices && apiResponse.choices[0] && apiResponse.choices[0].message
    ? apiResponse.choices[0].message.content
    : '';
  if (!content) throw new Error('OpenAIから有効な応答が返りませんでした。');
  try {
    return JSON.parse(content);
  } catch (e) {
    const cleaned = String(content).replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(cleaned.substring(start, end + 1));
    throw e;
  }
}

// =========================================
// 書き込み・分類
// =========================================
function appendResults_(mainSheet, masterSheet, results, fileUrl) {
  if (!Array.isArray(results) || !results.length) return;
  const rows = results.map(res => buildJournalRow_(res, fileUrl, masterSheet));
  const startRow = mainSheet.getLastRow() + 1;
  mainSheet.getRange(startRow, 1, rows.length, MAIN_HEADERS.length).setValues(rows);
  paintLowConfidenceRows_(mainSheet, startRow, results);
  setupAccountDropdown_(mainSheet, masterSheet);
}

function buildJournalRow_(res, fileUrl, masterSheet) {
  const master = findMasterByAccount_(masterSheet, cleanAccountName_(res.Account));
  let account = master ? master.account : cleanAccountName_(res.Account);
  let category = master ? master.category : String(res.Category || '').trim();
  let description = master ? master.description : String(res.Description || '').trim();

  if (!account || isInvalidAccount_(account, masterSheet)) {
    account = '未分類';
    category = '確認';
    description = '判断できないもの';
  }
  if (!category) category = findMasterByAccount_(masterSheet, account).category || '確認';
  if (!description) description = findMasterByAccount_(masterSheet, account).description || '';

  const amount = parseAmountValue_(res.Amount);
  const date = parseDateValue_(res.Date) || '';
  const payment = sanitizePaymentMethod_(res.PaymentMethod);
  const notes = String(res.Notes || res.Note || '').trim();

  return [
    date,
    String(res.Content || '').trim() || '不明',
    amount === null ? '' : Math.abs(amount),
    payment,
    category,
    account,
    description,
    notes,
    fileUrl || ''
  ];
}

function paintLowConfidenceRows_(sheet, startRow, results) {
  results.forEach((res, index) => {
    const row = startRow + index;
    const isLow = res.Confidence === false || cleanAccountName_(res.Account) === '未分類' || String(res.Category || '') === '確認';
    sheet.getRange(row, 5, 1, 3).setBackground(isLow ? '#ffff99' : null);
  });
}

function sanitizePaymentMethod_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/消耗品費|旅費交通費|通信費|接待交際費|会議費|新聞図書費|支払手数料|広告宣伝費|水道光熱費|地代家賃|車両費|雑費|外注費|未分類/.test(text)) return '';
  if (/^\d+$/.test(text)) return '';
  return text;
}

function classifyAccountLocally_(content, dictionaryText) {
  const text = String(content || '');
  const dict = String(dictionaryText || '').split(/\r?\n/);
  for (let i = 0; i < dict.length; i++) {
    const parts = dict[i].split(':');
    if (parts.length >= 2 && parts[0] && text.indexOf(parts[0].trim()) >= 0) {
      const account = cleanAccountName_(parts.slice(1).join(':'));
      const master = getDefaultAccountMasterRows_().filter(row => row[1] === account)[0];
      if (master) return { category: master[0], account: master[1], description: master[2], notes: '', confidence: true };
    }
  }

  const rules = [
    [/ファミリーマート|familymart|セブン|ローソン|コンビニ/i, ['経費', '雑費', '他の科目に当てはまらない少額経費']],
    [/電車|バス|タクシー|交通|駅|駐車/i, ['経費', '旅費交通費', '電車・バス・タクシー・駐車場など']],
    [/携帯|通信|インターネット|郵便|切手/i, ['経費', '通信費', '携帯・ネット・郵送など']],
    [/家賃|賃料|地代/i, ['経費', '地代家賃', '事務所・店舗・駐車場・家賃など']],
    [/保険/i, ['経費', '保険料', '事業用保険・損害保険など']],
    [/給与|給料/i, ['給与', '給与', '給与支払い・給与入金など']],
    [/振込手数料|手数料/i, ['経費', '支払手数料', '振込手数料・決済手数料など']],
    [/見積|請求|開発|制作|委託|外注/i, ['経費', '外注費', '外部委託・業務委託など']]
  ];
  for (let j = 0; j < rules.length; j++) {
    if (rules[j][0].test(text)) {
      const r = rules[j][1];
      return { category: r[0], account: r[1], description: r[2], notes: '', confidence: true };
    }
  }
  return { category: '確認', account: '未分類', description: '判断できないもの', notes: '', confidence: false };
}

function inferPaymentMethod_(text) {
  const s = String(text || '');
  if (/クレジット|カード|visa|master|jcb/i.test(s)) return 'クレジットカード';
  if (/現金|cash/i.test(s)) return '現金';
  if (/振込|入出金|普通預金|銀行|口座/i.test(s)) return '普通預金';
  if (/paypay|ペイペイ/i.test(s)) return 'PayPay';
  return '';
}

// =========================================
// マスタ
// =========================================
function setupAccountMasterSheet_(sheet) {
  const defaults = getDefaultAccountMasterRows_();
  sheet.getRange(1, 1, 1, 3).setValues([['大カテゴリー', '勘定科目', '説明']]).setBackground('#d9ead3').setFontWeight('bold');

  const current = sheet.getDataRange().getValues();
  const exists = {};
  current.slice(1).forEach(row => {
    const account = String(row[1] || '').trim();
    if (account) exists[account] = true;
  });

  const rows = defaults.filter(row => !exists[row[1]]);
  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 3).setValues(rows);

  sheet.setColumnWidth(1, 120);
  sheet.setColumnWidth(2, 160);
  sheet.setColumnWidth(3, 420);
  sheet.setFrozenRows(1);
}

function setupAccountDropdown_(mainSheet, masterSheet) {
  normalizeMainHeaders_(mainSheet);
  const lastMasterRow = Math.max(masterSheet.getLastRow(), 2);

  const categoryRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(masterSheet.getRange(2, 1, lastMasterRow - 1, 1), true)
    .setAllowInvalid(true)
    .build();
  const accountRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(masterSheet.getRange(2, 2, lastMasterRow - 1, 1), true)
    .setAllowInvalid(true)
    .build();

  const rows = Math.max(mainSheet.getMaxRows() - 1, 1000);
  mainSheet.getRange(2, 5, rows, 1).setDataValidation(categoryRule);
  mainSheet.getRange(2, 6, rows, 1).setDataValidation(accountRule);
}

function normalizeMainHeaders_(sheet) {
  const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), MAIN_HEADERS.length)).getValues()[0];
  if (current.join('|') !== MAIN_HEADERS.join('|')) {
    sheet.getRange(1, 1, 1, MAIN_HEADERS.length).setValues([MAIN_HEADERS]);
  }
  sheet.setFrozenRows(1);
}

function getDefaultAccountMasterRows_() {
  return [
    ['経費', '消耗品費', '文房具・備品・少額の道具など'],
    ['経費', '事務用品費', 'コピー用紙・文具・事務用品など'],
    ['経費', '旅費交通費', '電車・バス・タクシー・駐車場など'],
    ['経費', '通信費', '携帯・ネット・郵送など'],
    ['経費', '接待交際費', '取引先との飲食・贈答など'],
    ['経費', '会議費', '社内外の会議・打合せ飲食など'],
    ['経費', '新聞図書費', '書籍・新聞・資料など'],
    ['経費', '支払手数料', '振込手数料・決済手数料など'],
    ['経費', '広告宣伝費', '広告・販促・掲載料など'],
    ['経費', '水道光熱費', '電気・ガス・水道など'],
    ['経費', '地代家賃', '事務所・店舗・駐車場・家賃など'],
    ['経費', '賃借料', 'レンタル・リース・会場利用料など'],
    ['経費', '車両費', 'ガソリン・車検・車両関連費など'],
    ['経費', '修繕費', '設備・備品・車両などの修理費'],
    ['経費', '保険料', '事業用保険・損害保険など'],
    ['経費', '研修費', 'セミナー・講座・研修参加費など'],
    ['経費', '福利厚生費', '従業員向け福利厚生・健康診断など'],
    ['経費', '外注費', '外部委託・業務委託など'],
    ['経費', '支払報酬', '税理士・弁護士・専門家報酬など'],
    ['経費', '荷造運賃', '宅配便・発送費・梱包資材など'],
    ['経費', '租税公課', '印紙・事業税・固定資産税など'],
    ['経費', '雑費', '他の科目に当てはまらない少額経費'],
    ['仕入', '仕入高', '商品・材料の仕入'],
    ['収入', '売上高', '売上・報酬・事業収入など'],
    ['収入', '雑収入', '本業以外の収入など'],
    ['資産', '現金', '現金の入出金'],
    ['資産', '普通預金', '銀行口座への入金・出金・残高移動など'],
    ['資産', '預金', '銀行口座への入金・残高移動など'],
    ['資産', '売掛金', '未回収の売上・請求済み入金待ち'],
    ['資産', '前払費用', '翌月以降に対応する支払い済み費用'],
    ['資産', '工具器具備品', '10万円以上の備品・機材など'],
    ['資産', '投資有価証券', '株式・投資信託・証券購入など'],
    ['負債', '買掛金', '仕入や外注費などの未払い'],
    ['負債', '未払金', '経費などの未払い'],
    ['負債', '借入金', '銀行・公庫などからの借入'],
    ['金融', '金融費用', '借入利息・ローン利息など'],
    ['金融', '支払利息', '借入金の利息など'],
    ['投資', '有価証券売却益', '株式・投資信託などの売却益'],
    ['投資', '有価証券売却損', '株式・投資信託などの売却損'],
    ['投資', '受取配当金', '株式・投資信託などの配当金'],
    ['投資', '受取利息', '預金利息・債券利息など'],
    ['給与', '給与', '給与支払い・給与入金など'],
    ['給与', '法定福利費', '社会保険料の会社負担分など'],
    ['税金', '所得税', '所得税・源泉所得税など'],
    ['税金', '住民税', '住民税の支払い'],
    ['税金', '消費税', '消費税の納付・還付など'],
    ['税金', '法人税等', '法人税・地方法人税など'],
    ['個人', '事業主貸', '個人利用・生活費・事業外支出など'],
    ['個人', '事業主借', '個人資金からの入金・事業外収入など'],
    ['確認', '未分類', '判断できないもの']
  ];
}

function findMasterByAccount_(sheet, account) {
  const target = cleanAccountName_(account);
  if (!target) return {};
  const rows = sheet ? sheet.getDataRange().getValues().slice(1) : getDefaultAccountMasterRows_();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][1] || '').trim() === target) {
      return { category: rows[i][0], account: rows[i][1], description: rows[i][2] };
    }
  }
  return {};
}

function isInvalidAccount_(account, masterSheet) {
  const text = cleanAccountName_(account);
  if (!text) return true;
  if (/^-?\d+(\.\d+)?$/.test(text)) return true;
  const master = findMasterByAccount_(masterSheet, text);
  return !master.account;
}

function cleanAccountName_(value) {
  return String(value || '')
    .replace(/\s*\(確認\)\s*$/g, '')
    .replace(/\s*（確認）\s*$/g, '')
    .trim();
}

// =========================================
// onEdit 辞書学習
// =========================================
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAME_MAIN) return;
  if (e.range.getColumn() !== 6 || e.range.getRow() <= 1) return;

  const account = cleanAccountName_(e.value);
  if (!account) return;
  const content = sheet.getRange(e.range.getRow(), 2).getValue();
  if (!content) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dictSheet = getOrCreateSheet_(ss, SHEET_NAME_DICT);
  setupHeaderRow_(dictSheet, DICT_HEADERS);
  dictSheet.appendRow([content, account]);
  e.range.setValue(account).setBackground(null);
}

// =========================================
// 共通
// =========================================
function getOrCreateSheet_(ss, sheetName) {
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

function getSettingValue_(keyName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME_SETTINGS);
  if (!sheet) return '';
  const values = sheet.getDataRange().getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]).trim() === keyName) return String(values[i][1] || '').trim();
  }
  return '';
}

function getOpenAiApiKey() {
  return getSettingValue_('OpenAI APIキー');
}

function getDriveFolderId() {
  return extractDriveFolderId_(getSettingValue_('システム保管フォルダID')) ||
    extractDriveFolderId_(getSettingValue_('画像フォルダID'));
}

function getReceiptInputFolderId() {
  return extractDriveFolderId_(getSettingValue_('レシート投入フォルダID')) ||
    extractDriveFolderId_(getSettingValue_('画像フォルダID'));
}

function extractDriveFolderId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const folderMatch = text.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const fileMatch = text.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  const idMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch) return idMatch[1];
  return text;
}

function getOrCreateSystemFolder_() {
  return getOrCreateFolderFromSetting_('システム保管フォルダID', SYSTEM_FOLDER_NAME, 'C3');
}

function getOrCreateReceiptInputFolder_() {
  return getOrCreateFolderFromSetting_('レシート投入フォルダID', RECEIPT_INPUT_FOLDER_NAME, 'C4');
}

function getOrCreateFolderFromSetting_(settingKey, folderName, noteCell) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const settingsSheet = getOrCreateSheet_(ss, SHEET_NAME_SETTINGS);
  setupSettingsSheet_(settingsSheet);

  let folderId = extractDriveFolderId_(getSettingValue_(settingKey));
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (e) {
      writeErrorLog('警告: ' + settingKey + 'でフォルダを開けませんでした。作り直します。詳細: ' + e.message);
    }
  }

  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  const row = settingKey === 'システム保管フォルダID' ? 3 : 4;
  settingsSheet.getRange(row, 1, 1, 2).setValues([[settingKey, folder.getUrl()]]);
  if (noteCell) settingsSheet.getRange(noteCell).setValue(settingKey === 'システム保管フォルダID'
    ? '← 【保管専用】取り込み済みPDF・画像・CSVの保存先。ユーザーが手で入れる場所ではありません'
    : '← 【レシート投入用】ユーザーがレシート画像を入れる場所です');
  return folder;
}

function setupHeaderRow_(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function setupCsvSheet_(sheet) {
  if (!String(sheet.getRange('A1').getValue()).trim()) sheet.getRange('A1').setValue('ここにCSVをそのまま貼り付け');
  sheet.getRange('A1').setNote('CSVアップロードが使えない時だけここに貼り付けて、メニューから「CSV貼り付けシートから取り込み」を実行してください。');
  sheet.setFrozenRows(1);
}

function getCsvInputText_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  const rows = values
    .filter(row => row.some(cell => String(cell || '').trim() !== ''))
    .filter((row, index) => !(index === 0 && String(row[0] || '').indexOf('ここにCSV') >= 0));
  if (!rows.length) return '';
  if (rows.length === 1 && rows[0].length === 1) return rows[0][0];
  return rows.map(row => row.map(cell => csvEscape_(cell)).join(',')).join('\n');
}

function clearCsvInput_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return;
  sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, 1)).clearContent();
}

function csvEscape_(value) {
  const text = String(value || '');
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function getDictionaryText_(sheet) {
  if (!sheet) return '';
  const values = sheet.getDataRange().getValues();
  return values.slice(1)
    .filter(row => row[0] && row[1])
    .map(row => row[0] + ': ' + row[1])
    .join('\n');
}

function getAccountMasterText_(sheet) {
  if (!sheet) return '';
  const values = sheet.getDataRange().getValues();
  return values.slice(1)
    .filter(row => row[1])
    .map(row => row[0] + ' / ' + row[1] + ' / ' + row[2])
    .join('\n');
}

function writeErrorLog(message) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME_ERROR);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME_ERROR);
    sheet.appendRow(['発生日時', 'エラー内容']);
    sheet.setFrozenRows(1);
    sheet.getRange('A1:B1').setBackground('#f4cccc').setFontWeight('bold');
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 900);
  }
  sheet.appendRow([Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy/MM/dd HH:mm:ss'), message]);
}
