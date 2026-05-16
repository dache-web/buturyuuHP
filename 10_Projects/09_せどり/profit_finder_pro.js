const fs = require('fs');

/**
 * 【プロ専用】利益発見ツール Pro (profit_finder_pro.js)
 * リアルタイムで最新価格をチェックする専用ツール
 */
const CONFIG = {
    // 1. 各種IDの設定（いただいた本物の情報を入力）
    RAKUTEN_APP_ID: '2e7e1655-0167-4927-8dc1-86fd8b86c6ac',
    RAKUTEN_ACCESS_KEY: 'pk_51gqSnwdWfYaNN8zdaKAfy21bmjm4WV3knEVogcz6iz',
    RAKUTEN_AFFILIATE_ID: '4f28404c.9909b00a.4f28404d.cd3b6fa4',
    YAHOO_CLIENT_ID: 'dmVyPTIwMjUwNyZpZD1JMFF4em1VQ3owJmhhc2g9T0RWbE5qTmlNR1F4TlRWbE1qSmtOZw',

    // 2. CSVファイルの場所
    FILE_PATH: 'C:\\Users\\gmdac\\Downloads\\all_data_202604121800.csv',
    
    // 3. ポイント還元率
    POINTS: {
        RAKUTEN: 0.10, // 10%
        YAHOO: 0.10    // 10%
    },

    // 4. 除外キーワード（新品だけを抽出）
    EXCLUDE_KEYWORDS: ["中古", "箱潰", "箱破", "開封", "ジャンク", "ワケあり", "展示品"],

    // 5. 設定オプション
    MAX_SEARCH: 500,      // 一度にAPIで調べる件数
    MIN_BUY_PRICE: 5000,  // 買取価格が5,000円以上の商品に絞る
    SIMULATION_MODE: false
};

// CSVの列index定義
const COLS = {
    JAN: 0,
    SHOPS: [
        { name: "アバウテック", price: 2,  title: 1 },
        { name: "けんさく",   price: 6,  title: 5 },
        { name: "商店",       price: 10, title: 9 },
        { name: "森森",       price: 14, title: 13 },
        { name: "一丁目",     price: 18, title: 17 },
        { name: "ウィキ",     price: 23, title: 22 },
        { name: "家電市場",   price: 27, title: 26 },
        { name: "モバイル一番", price: 31, title: 30 },
        { name: "ルデヤ",     price: 35, title: 34 },
        { name: "ホムラ",     price: 39, title: 38 },
        { name: "モバミ",     price: 42, title: 41 }
    ]
};

/**
 * 楽天APIで最安値を取得
 */
async function fetchRakutenPrice(jan) {
    if (CONFIG.SIMULATION_MODE) return Math.floor(Math.random() * 50000 + 10000);
    
    const url = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401?applicationId=${CONFIG.RAKUTEN_APP_ID}&accessKey=${CONFIG.RAKUTEN_ACCESS_KEY}&affiliateId=${CONFIG.RAKUTEN_AFFILIATE_ID}&keyword=${jan}&sort=%2BitemPrice&hits=1`;
    try {
        const res = await fetch(url, {
            headers: {
                "Referer": "https://example.com/",
                "Origin": "https://example.com",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        const data = await res.json();
        if (data.Items && data.Items.length > 0) {
            return data.Items[0].Item.itemPrice;
        }
    } catch (e) { 
        return null; 
    }
    return null;
}

/**
 * YahooショッピングAPIで最安値を取得
 */
async function fetchYahooPrice(jan) {
    if (CONFIG.SIMULATION_MODE) return Math.floor(Math.random() * 50000 + 10000);

    const url = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${CONFIG.YAHOO_CLIENT_ID}&jan_code=${jan}&sort=%2Bprice&results=1`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.hits && data.hits.length > 0) {
            return data.hits[0].price;
        }
    } catch (e) { 
        return null; 
    }
    return null;
}

async function main() {
    console.log("==========================================");
    console.log("   利益発見ツール Pro (リアルタイム版)   ");
    console.log("==========================================");

    try {
        // CSV読み込み
        const buffer = fs.readFileSync(CONFIG.FILE_PATH);
        const text = new TextDecoder('shift_jis').decode(buffer);
        const lines = text.split('\n');
        
        let products = [];
        console.log(`ステップ1: データのスキャンを開始します（全${lines.length - 1}件）`);

        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',');
            if (row.length < 10) continue;

            const jan = (row[COLS.JAN] || "").trim();
            if (!jan || (jan.length !== 13 && jan.length !== 8)) continue;

            let maxBuyPrice = 0;
            let targetShop = "";
            let productName = "";

            for (const shop of COLS.SHOPS) {
                const buyPrice = parseInt(row[shop.price]) || 0;
                
                // 5,000円未満の商品は効率化のため除外
                if (buyPrice < CONFIG.MIN_BUY_PRICE) continue;

                const title = (row[shop.title] || "").trim();

                if (buyPrice > maxBuyPrice) {
                    const isExcluded = CONFIG.EXCLUDE_KEYWORDS.some(k => title.includes(k));
                    if (!isExcluded) {
                        maxBuyPrice = buyPrice;
                        targetShop = shop.name;
                        productName = title;
                    }
                }
            }

            if (maxBuyPrice > 0) {
                products.push({ jan, productName, maxBuyPrice, targetShop });
            }
        }

        console.log(`ステップ2: 5,000円以上の新品を抽出完了（残り: ${products.length}件）`);
        
        // 買取価格が高い順に並べて上位500件を選ぶ
        products.sort((a, b) => b.maxBuyPrice - a.maxBuyPrice);
        products = products.slice(0, CONFIG.MAX_SEARCH);

        console.log(`ステップ3: 上位${CONFIG.MAX_SEARCH}件のネット価格をリサーチ中...`);
        console.log("（APIを大切に使うため、1件ごとに0.5秒お休みしながら進みます。完了まで約10〜15分です）");

        const results = [];
        for (const [idx, p] of products.entries()) {
            const percent = ((idx + 1) / CONFIG.MAX_SEARCH * 100).toFixed(0);
            process.stdout.write(`リサーチ中 [${idx + 1}/${CONFIG.MAX_SEARCH}] ${percent.padStart(3)}% : JAN ${p.jan}\r`);
            
            // API負荷軽減のため待機
            await new Promise(resolve => setTimeout(resolve, 500));

            const rPrice = await fetchRakutenPrice(p.jan);
            const yPrice = await fetchYahooPrice(p.jan);

            if (!rPrice && !yPrice) continue;

            let best;
            if (rPrice && yPrice) {
                best = rPrice < yPrice ? { shop: "楽天", price: rPrice, pt: CONFIG.POINTS.RAKUTEN } 
                                     : { shop: "Yahoo", price: yPrice, pt: CONFIG.POINTS.YAHOO };
            } else {
                best = rPrice ? { shop: "楽天", price: rPrice, pt: CONFIG.POINTS.RAKUTEN } 
                              : { shop: "Yahoo", price: yPrice, pt: CONFIG.POINTS.YAHOO };
            }

            const realCost = Math.floor(best.price * (1 - best.pt));
            const profit = p.maxBuyPrice - realCost;
            const roi = ((profit / realCost) * 100).toFixed(2);

            results.push({
                ...p,
                supplier: best.shop,
                listPrice: best.price,
                realCost,
                profit,
                roi: parseFloat(roi)
            });
        }
        console.log("\nリサーチがすべて完了しました！\n");

        results.sort((a, b) => b.roi - a.roi);
        const top10 = results.slice(0, 10);

        if (top10.length === 0) {
            console.log("残念ながら、価格情報が見つかりませんでした。別の商品を試してみてください。");
        } else {
            console.log("【発表！ お宝候補ランキング（利益に近い順）】");
            console.table(top10.map(r => {
                const profitStatus = r.profit > 0 ? "★利益アリ！" : "▲あと少し";
                return {
                    "判定": profitStatus,
                    "商品名": r.productName.substring(0, 30),
                    "最高買取額": `¥${r.maxBuyPrice.toLocaleString()}(${r.targetShop})`,
                    "実質仕入": `¥${r.realCost.toLocaleString()}(${r.supplier})`,
                    "利益額": `¥${r.profit.toLocaleString()}`,
                    "ROI(利益率)": `${r.roi}%`
                };
            }));

            const luckyHits = results.filter(r => r.profit > 0);
            if (luckyHits.length > 0) {
                console.log(`\n✨ おめでとうございます！ ${luckyHits.length}件の利益確定商品が見つかりました！`);
            } else {
                console.log("\n💡 アドバイス：");
                console.log("今回は完璧な利益商品は見つかりませんでしたが、上のリストは「最も損が少なく、利益に近い」商品です。");
                console.log("ポイント倍率が上がったときや、セール時にすぐ「お宝」に変わる可能性があります。");
            }

            console.log("\n【家電量販店で見つけたら即チェック！ TOP3】");
            results.slice(0, 3).forEach((r, i) => {
                console.log(`${i+1}. ${r.productName}`);
                console.log(`   [現在価格をチェック] https://www.google.com/search?q=${r.jan}+価格`);
            });
        }

    } catch (err) {
        console.error("エラーが発生しました:", err.message);
    }
}

main();
