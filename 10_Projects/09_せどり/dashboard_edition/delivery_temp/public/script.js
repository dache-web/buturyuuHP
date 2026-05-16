let pollInterval;
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('csv-file');

uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return alert('CSVファイルを選択してください');

    const settings = {
        rakutenPoint: document.getElementById('rakutenPoint').value,
        yahooPoint: document.getElementById('yahooPoint').value,
        targetShopFilter: document.getElementById('targetShopFilter').value
    };

    const formData = new FormData();
    formData.append('csv', file); // 'file' -> 'csv' (matching server.js)
    formData.append('settings', JSON.stringify(settings));

    uploadBtn.disabled = true;
    uploadBtn.innerText = 'アップロード中...';
    
    const scanSection = document.getElementById('scan-section');
    const scanStatus = document.getElementById('scan-status');
    const adviceContainer = document.getElementById('advice-container');
    
    scanSection.style.display = 'block';
    adviceContainer.style.display = 'none';
    scanStatus.innerText = 'サーバーへ送信中...';

    try {
        const res = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || `通信エラー: ${res.status}`);
        }
        
        scanStatus.innerText = 'スキャン準備中...';
        adviceContainer.style.display = 'block';
        document.getElementById('purchase-advice').innerText = data.advice;
        
        startPolling();
    } catch (e) {
        console.error('Upload error:', e);
        alert('アップロードに失敗しました: ' + e.message);
        uploadBtn.disabled = false;
        uploadBtn.innerText = 'スキャン開始';
        scanStatus.innerText = 'エラーが発生しました。詳細はサーバーログを確認してください。';
        scanSection.style.display = 'block'; // エラー表示を見えるようにする
    }
});

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        const res = await fetch('/api/status');
        const data = await res.json();
        
        updateUI(data);
        
        if (!data.scanning && data.progress === 100) {
            clearInterval(pollInterval);
            document.getElementById('scan-status').innerText = 'スキャン完了！';
        }
    }, 1000);
}

function updateUI(data) {
    // Update progress bar
    document.getElementById('progress-fill').style.width = data.progress + '%';
    document.getElementById('scan-status').innerText = `スキャン中... ${data.progress}%`;

    if (data.results.length > 0) {
        document.getElementById('results-section').style.display = 'block';
        document.getElementById('result-count').innerText = `${data.results.length}件のお宝が見つかりました`;
        renderTable(data.results);
    }
}

function formatProfitHTML(value) {
    const formattedVal = value.toLocaleString() + '円';
    if (value < 0) {
        return `<span class="profit-negative">${formattedVal}</span>`;
    }
    return `<span>${formattedVal}</span>`;
}

function renderTable(results) {
    const tbody = document.getElementById('results-body');
    tbody.innerHTML = results.map((r, index) => {
        const supplierClass = r.supplier === '楽天' ? 'supplier-rakuten' : 'supplier-yahoo';
        return `
            <tr class="result-row" data-index="${index}">
                <td>
                    <div style="font-weight:600;">${r.productName.substring(0, 45)}...</div>
                    <div style="font-size:12px; color:var(--apple-sub);">JAN: ${r.jan}</div>
                    ${r.warning ? `<span class="warning-badge">⚠️ ${r.warning}</span>` : ''}
                </td>
                <td>
                    <span class="supplier-badge ${supplierClass}">${r.supplier}</span>
                </td>
                <td class="price-box">
                    <div class="price-main">¥${r.maxBuyPrice.toLocaleString()}</div>
                    <div class="price-sub">${r.targetShop}</div>
                </td>
                <td class="price-box">
                    <div class="price-main">¥${r.listPrice.toLocaleString()}</div>
                    <div class="price-sub">通常価格</div>
                </td>
                <td class="price-box">
                    <div class="profit-text">${formatProfitHTML(r.profit)}</div>
                    <div class="roi-text ${r.roi > 10 ? 'roi-badge' : ''}">${r.roi}%</div>
                </td>
            </tr>
        `;
    }).join('');

    // 行クリックイベント
    document.querySelectorAll('.result-row').forEach(row => {
        row.addEventListener('click', () => {
            const index = row.getAttribute('data-index');
            showDetails(results[index]);
        });
    });
}

function showDetails(item) {
    console.log('[DEBUG] Sidebar Item:', item);
    const sidebar = document.getElementById('details-sidebar');
    const inner = document.getElementById('sidebar-inner');
    
    // 指定店舗セクションのHTML
    // プロパティ名の揺れ（buybackRanking等）も考慮した超頑丈なチェック
    const shops = item.targetShops || [];
    const ranking = item.generalRank || item.buybackRanking || [];
    
    let targetShopHtml = '';
    if (shops.length > 0) {
        targetShopHtml = shops.map(s => `
            <div class="detail-card-row">
                <span class="shop-label">${s.shopName || s.name || '不明な店舗'}</span>
                <span class="price-value highlight">¥${(s.buyPrice || s.price || 0).toLocaleString()}</span>
            </div>
        `).join('');
    } else {
        targetShopHtml = `
            <div class="empty-state">
                <p>指定された店舗のデータはありません</p>
                <small>（マーケット全体の価格で計算しています）</small>
            </div>
        `;
    }

    let generalRankHtml = '';
    if (ranking.length > 0) {
        generalRankHtml = ranking.map((s, i) => `
            <div class="ranking-item">
                <div class="rank-badge">${i + 1}</div>
                <div class="rank-info">
                    <div class="rank-shop">${s.shopName || s.name || '不明'}</div>
                    <div class="rank-price">¥${(s.buyPrice || s.price || 0).toLocaleString()}</div>
                </div>
            </div>
        `).join('');
    } else {
        generalRankHtml = '<p class="empty-text">市場ランキングデータが見つかりませんでした</p>';
    }

    inner.innerHTML = `
        <div class="detail-header">
            <h3>商品詳細レポート</h3>
            <div class="product-title">${item.productName}</div>
            <div class="product-jan">JAN: ${item.jan}</div>
        </div>

        <div class="detail-section">
            <h4 class="section-title"><span class="icon">📍</span> 指定店舗の買取価格</h4>
            <div class="target-shops-container">
                ${targetShopHtml}
            </div>
        </div>

        <div class="detail-section highlight-section">
            <h4 class="section-title">💰 利益シミュレーション</h4>
            <div class="simulation-card">
                <div class="sim-row">
                    <span>仕入先:</span>
                    <span class="val">${item.supplier} <a href="${item.itemUrl}" target="_blank" class="inline-link">商品ページ↗</a></span>
                </div>
                <div class="sim-row">
                    <span>販売価格:</span>
                    <span class="val">¥${item.listPrice.toLocaleString()}</span>
                </div>
                <div class="sim-row">
                    <span>実質仕入価格:</span>
                    <span class="val">¥${item.realCost.toLocaleString()}</span>
                </div>
                <div class="profit-display-container">
                    <div class="profit-box-item">
                        <div class="label">指定店舗での利益</div>
                        <div class="val">${formatProfitHTML(item.profit)}</div>
                    </div>
                    <div class="profit-box-item highlight">
                        <div class="label">ランキング1位での利益</div>
                        <div class="val">${formatProfitHTML(item.marketProfit)}</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h4 class="section-title"><span class="icon">📊</span> 市場全体ランキング (TOP3)</h4>
            <div class="ranking-container">
                ${generalRankHtml}
            </div>
        </div>

        <div style="margin-top:20px; text-align:center;">
            <a href="${item.itemUrl}" target="_blank" class="order-btn">今すぐ仕入れる</a>
        </div>
    `;
    
    sidebar.style.display = 'block';
}

document.getElementById('close-sidebar').addEventListener('click', () => {
    document.getElementById('details-sidebar').style.display = 'none';
});

// 初期化: localStorageから設定復元 & 日付表示
window.onload = () => {
    // 日付表示
    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const dateElement = document.getElementById('current-date');
    if (dateElement) dateElement.innerText = dateStr;

    document.getElementById('rakutenPoint').value = localStorage.getItem('rakutenPoint') || 1.2;
    document.getElementById('yahooPoint').value = localStorage.getItem('yahooPoint') || 1.2;
    document.getElementById('targetShopFilter').value = localStorage.getItem('targetShopFilter') || '';
};

// 設定保存
document.getElementById('rakutenPoint').addEventListener('change', (e) => localStorage.setItem('rakutenPoint', e.target.value));
document.getElementById('yahooPoint').addEventListener('change', (e) => localStorage.setItem('yahooPoint', e.target.value));
document.getElementById('targetShopFilter').addEventListener('change', (e) => localStorage.setItem('targetShopFilter', e.target.value));
