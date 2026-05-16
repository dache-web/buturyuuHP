const fs = require('fs');

/**
 * 利益発見ツール (profit_finder.js)
 * 中学生でもわかる、せどりお宝発見プログラム！
 */
const CONFIG = {
    // 1. 各種IDの設定（ここに自分のIDを入れてね！）
    RAKUTEN_APP_ID: 'YOUR_RAKUTEN_APP_ID',
    RAKUTEN_AFFILIATE_ID: 'YOUR_AFFILIATE_ID',
    YAHOO_CLIENT_ID: 'YOUR_YAHOO_CLIENT_ID',

    // 2. CSVファイルの場所（デスクトップやダウンロードフォルダなど）
    FILE_PATH: 'C:\\Users\\gmdac\\Downloads\\all_data_202604121800.csv',
    
    // 3. ポイント還元率（楽天10%なら0.1、Yahoo5%なら0.05）
    POINTS: {
        RAKUTEN: 0.10,
        YAHOO: 0.10
    },

    // 4. 除外キーワード（中古品や箱潰れを省く）
    EXCLUDE_KEYWORDS: ["中古", "箱潰", "箱破", "開封", "ジャンク", "ワケあり", "展示品"],

    // 5. 設定オプション
    MAX_SEARCH: 20,      // APIで検索する件数（まずは少なめで試してね）
    SIMULATION_MODE: true // trueだと、APIキーがなくても「もしも」の計算をしてくれます
};

// CSVの列の場所（変更しないでね）
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

async function fetchRakutenPrice(jan) {
    if (CONFIG.SIMULATION_MODE) return Math.floor(Math.random() * 50000 + 10000);
    
    const url = `https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601?applicationId=${CONFIG.RAKUTEN_APP_ID}&keyword=${jan}&sort=%2BitemPrice&hits=1`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.Items && data.Items.length > 0) {
            return data.Items[0].Item.itemPrice;
        }
    } catch (e) { return null; }
    return null;
}

async function fetchYahooPrice(jan) {
    if (CONFIG.SIMULATION_MODE) return Math.floor(Math.random() * 50000 + 10000);

    const url = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?client_id=${CONFIG.YAHOO_CLIENT_ID}&jan_code=${jan}&sort=%2Bprice&results=1`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.hits && data.hits.length > 0) {
            return data.hits[0].price;
        }
    } catch (e) { return null; }
    return null;
}

async function main() {
    console.log("==========================================");
    console.log("   利益発見ツール (せどりお宝チェッカー)   ");
    console.log("==========================================");

    if (CONFIG.SIMULATION_MODE) {
        console.log("【注意】現在はシミュレートモードです。APIキーなしで動作を確認できます。\n");
    }

    try {
        const buffer = fs.readFileSync(CONFIG.FILE_PATH);
        const text = new TextDecoder('shift_jis').decode(buffer);
        const lines = text.split('\n');
        
        let products = [];
        console.log(`ステップ1: 全${lines.length - 1}件のデータを読み込み中...`);

        // 読み込みとフィルター
        for (let i = 1; i < lines.length; i++) {
            const row = lines[i].split(',');
            if (row.length < 10) continue;

            const jan = (row[COLS.JAN] || "").trim();
            if (!jan || jan.length < 8) continue;

            let maxBuyPrice = 0;
            let targetShop = "";
            let productName = "";

            for (const shop of COLS.SHOPS) {
                const price = parseInt(row[shop.price]) || 0;
                const title = (row[shop.title] || "").trim();

                if (price > maxBuyPrice) {
                    const isExcluded = CONFIG.EXCLUDE_KEYWORDS.some(k => title.includes(k));
                    if (!isExcluded) {
                        maxBuyPrice = price;
                        targetShop = shop.name;
                        productName = title;
                    }
                }
            }

            if (maxBuyPrice > 0) {
                products.push({ jan, productName, maxBuyPrice, targetShop });
            }
        }

        console.log(`ステップ2: 新品のみ抽出しました（残り: ${products.length}件）`);
        
        // 処理件数を制限（API負荷軽減のため）
        products = products.slice(0, CONFIG.MAX_SEARCH);
        console.log(`ステップ3: 上位${CONFIG.MAX_SEARCH}件の最新価格をネットで調べています...`);

        const results = [];
        for (const p of products) {
            const rPrice = await fetchRakutenPrice(p.jan);
            const yPrice = await fetchYahooPrice(p.jan);

            if (!rPrice && !yPrice) continue;

            // どちらか安い方を選ぶ
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
            const roi = ((profit / realCost) * 100).toFixed(1);

            if (profit > 0) {
                results.push({
                    ...p,
                    supplier: best.shop,
                    listPrice: best.price,
                    realCost,
                    profit,
                    roi: parseFloat(roi)
                });
            }
        }

        // 利益率（ROI）順に並べ替え
        results.sort((a, b) => b.roi - a.roi);

        console.log("\n【発見！ 利益が出る可能性が高い商品リスト】");
        if (results.length === 0) {
            console.log("残念ながら利益が出る商品は見つかりませんでした。別のデータを試してみてください。");
        } else {
            console.table(results.map(r => ({
                "商品名": r.productName.substring(0, 30),
                "最高買取店": r.targetShop,
                "買取価格": `¥${r.maxBuyPrice.toLocaleString()}`,
                "仕入先": r.supplier,
                "実質仕入": `¥${r.realCost.toLocaleString()}`,
                "利益": `¥${r.profit.toLocaleString()}`,
                "利益率": `${r.roi}%`
            })));

            console.log("\n【家電量販店ランキング (ネット購入おすすめ)】");
            results.slice(0, 2).forEach((r, i) => {
                console.log(`${i+1}. ${r.productName}`);
                console.log(`   仕入れ目安: ¥${r.realCost.toLocaleString()} (還元後) / 利益: ¥${r.profit.toLocaleString()}以上！`);
                console.log(`   最寄りの店舗やサイト（ヨドバシ/ビックなど）で在庫をチェック！`);
                console.log(`   [検索リンク] https://www.google.com/search?q=${r.jan}+価格`);
            });
        }

    } catch (err) {
        console.error("エラーが発生しました:", err.message);
    }
}

main();
