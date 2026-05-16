const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const { analyzeItem } = require('./analyzer');
const { log, clearLog } = require('./logger');
const { EXCLUDE_KEYWORDS } = require('./constants');

clearLog(); 
log('Server initializing...', 'INFO');

const app = express();
const port = 3000;
const uploadDir = path.resolve(__dirname, '..', 'temp_uploads');

const MAX_BUY_LIMIT = 500000; 

console.log('--- Server Started ---');
console.log('Upload directory:', uploadDir);
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

app.use(express.static('public'));
app.get('/User_Manual.html', (req, res) => res.sendFile(path.resolve(__dirname, 'User_Manual.html')));
app.get('/Delivery_Guide.html', (req, res) => res.sendFile(path.resolve(__dirname, 'Delivery_Guide.html')));
app.use(express.json());

let scanning = false;
let results = [];
let progress = 0;

// 文字列の正規化（全角→半角）
function normalizeText(text) {
    if (!text) return "";
    return text.normalize("NFKC").trim();
}

// 最適購入日のアドバイス計算
function getPurchaseAdvice() {
    const now = new Date();
    const day = now.getDate();
    const advice = [];
    if (day % 5 === 0) advice.push("今日は楽天『0と5の付く日』！ポイント+2倍でお得です。");
    else if (day === 18) advice.push("今日は楽天『ご愛顧感謝デー』！ポイント最大4倍です。");
    if (day === 5 || day === 15 || day === 25) advice.push("今日はYahoo『5の付く日』！+4%還元の大チャンスです。");
    if (advice.length === 0) {
        const next5 = Math.ceil((day + 1) / 5) * 5;
        advice.push(`現在は通常期間です。次の狙い目は ${next5}日（ポイントアップ日）です。`);
    }
    return advice.join(' ');
}

app.post('/api/upload', upload.any(), (req, res) => {
    const file = req.files && req.files[0];
    if (!file) return res.status(400).json({ error: 'ファイルが選択されていません' });
    
    const settings = JSON.parse(req.body.settings || '{}');
    const pointRates = {
        rakuten: parseFloat(settings.rakutenPoint) || 1.2,
        yahoo: parseFloat(settings.yahooPoint) || 1.2
    };
    
    // 指定店舗フィルタの正規化
    const rawFilter = (settings.targetShopFilter || "").trim();
    // スペース、カンマ、読点などで区切るように拡張
    const filterList = rawFilter.split(/[\s,，、]+/).map(s => normalizeText(s).toUpperCase()).filter(s => s);
    log(`Filter Keywords: [${filterList.join(', ')}]`, 'INFO');
    
    const products = [];
    fs.createReadStream(file.path)
        .pipe(iconv.decodeStream('shift_jis'))
        .on('error', (err) => log(`Decoding error: ${err.message}`, 'ERROR'))
        .pipe(csv())
        .on('error', (err) => {
            log(`CSV parsing error: ${err.message}`, 'ERROR');
            if (!res.headersSent) res.status(500).json({ error: 'CSVの解析に失敗しました' });
        })
        .on('data', (row) => {
            try {
                const keys = Object.keys(row);
                if (keys.length === 0) return;

                const jan = (row[keys[0]] || "").trim();
                if (!jan || (jan.length !== 13 && jan.length !== 8)) return;

                let allValidShops = [];
                keys.forEach((k, idx) => {
                    const normalizedK = normalizeText(k);
                    const val = parseInt(row[k]) || 0;
                    
                    // 「買取価格」を優先し、「販売価格」は除外する
                    const isBuyback = normalizedK.includes('買取');
                    const isSales = normalizedK.includes('販売') || normalizedK.includes('定価') || normalizedK.includes('希望');
                    
                    if (val > 1000 && val < MAX_BUY_LIMIT && isBuyback && !isSales) {
                        // ショッププレフィックスを取得（例: "家電市場_買取価格" -> "家電市場"）
                        const shopPrefix = k.split('_')[0] || "";
                        
                        // 同じショップの「商品名」列を探す。なければidx-1を試す。
                        let candidateName = "";
                        const nameKey = keys.find(key => normalizeText(key).includes(shopPrefix) && normalizeText(key).includes('商品名'));
                        if (nameKey) {
                            candidateName = normalizeText(row[nameKey] || "");
                        } else {
                            // フォールバック: 左隣の列。ただし数値なら無視。
                            const leftVal = row[keys[idx-1]] || "";
                            if (isNaN(parseInt(leftVal))) {
                                candidateName = normalizeText(leftVal);
                            }
                        }

                        if (!candidateName) return;

                        const shopName = normalizeText(shopPrefix || k.replace(/価格|買取|単価/g, '').replace(/[_\-]/g, ''));
                        const shopNameUpper = shopName.toUpperCase();

                        // 除外キーワードチェック
                        const isExcluded = EXCLUDE_KEYWORDS.some(word => 
                            candidateName.toUpperCase().includes(word.toUpperCase()) || 
                            shopNameUpper.includes(word.toUpperCase())
                        );
                        
                        if (!isExcluded) {
                            allValidShops.push({ 
                                shopName, 
                                buyPrice: val, 
                                productName: candidateName,
                                originalKey: k
                            });
                        }
                    }
                });

                if (allValidShops.length > 0) {
                    // 全店舗ランキング（価格順）
                    allValidShops.sort((a, b) => b.buyPrice - a.buyPrice);

                    // 指定店舗に該当するものを抽出
                    let targetShops = [];
                    if (filterList.length > 0) {
                        targetShops = allValidShops.filter(s => {
                            const nameUpper = s.shopName.toUpperCase();
                            const rawUpper = s.originalKey.toUpperCase();
                            // クリーン後の店名 または 元のカラム名 のいずれかにキーワードが含まれていれば一致とみなす
                            return filterList.some(f => nameUpper.includes(f) || rawUpper.includes(f));
                        });
                    }

                    // 採用価格の決定：指定店があればその最高値。なければ全体の最高値。
                    const primaryShop = targetShops.length > 0 ? targetShops[0] : allValidShops[0];

                    products.push({ 
                        jan, 
                        name: primaryShop.productName, 
                        maxBuy: primaryShop.buyPrice, 
                        shop: primaryShop.shopName,
                        targetShops: targetShops,
                        generalRank: allValidShops.slice(0, 5)
                    });
                }
            } catch (err) {
                log(`Row processing error: ${err.message}`, 'ERROR');
            }
        })
        .on('end', async () => {
            log(`CSV Parsing finished. Items after filtering: ${products.length}`, 'INFO');
            
            if (products.length === 0) {
                log('No valid products found after applying shop and keyword filters.', 'WARNING');
                return res.status(400).json({ error: 'フィルタ条件に合う商品が見つかりませんでした。' });
            }

            const uniqueMap = new Map();
            for (const p of products) {
                if (!uniqueMap.has(p.jan)) uniqueMap.set(p.jan, p);
            }
            
            const unique = Array.from(uniqueMap.values())
                .sort((a, b) => b.maxBuy - a.maxBuy)
                .slice(0, 500);
            
            log(`Deduplication finished. Scanning: ${unique.length}`, 'INFO');
            res.json({ count: unique.length, advice: getPurchaseAdvice() });
            startScan(unique, pointRates);
        });
});

async function startScan(productList, pointRates) {
    scanning = true;
    results = [];
    progress = 0;
    
    for (let i = 0; i < productList.length; i++) {
        if (!scanning) break;
        
        const p = productList[i];
        process.stdout.write(`Scanning [${i + 1}/${productList.length}]: JAN ${p.jan} ...\r`);
        
        try {
            const res = await analyzeItem(p.jan, p.name, p.maxBuy, p.shop, pointRates, p.targetShops, p.generalRank);
            if (res) {
                console.log(`[DEBUG] JAN ${p.jan}: Targets=${res.targetShops?.length}, Rank=${res.generalRank?.length}`);
                results.push(res);
            }
        } catch (err) {
            console.error(`\nError analyzing JAN ${p.jan}:`, err.message);
        }
        
        progress = Math.round(((i + 1) / productList.length) * 100);
        await new Promise(r => setTimeout(r, 500)); // Rate limit safety
    }
    console.log(`\nScan Complete: ${results.length} items found.`);
    scanning = false;
}

app.get('/api/status', (req, res) => {
    res.json({ progress, results: results.sort((a, b) => b.roi - a.roi), scanning });
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).json({ error: err.message || '予期しないエラーが発生しました' });
});

app.listen(port, () => {
    console.log(`Profit Finder Pro - Dashboard running at http://localhost:${port}`);
    // 自動でブラウザを開く
    const { exec } = require('child_process');
    exec(`start http://localhost:${port}`);
});
