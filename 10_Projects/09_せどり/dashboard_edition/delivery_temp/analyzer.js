const { log } = require('./logger');
const { EXCLUDE_KEYWORDS } = require('./constants');
const CONFIG = require('./config');

function normalizeText(text) {
    if (!text) return "";
    return text.normalize("NFKC").trim().toUpperCase();
}

/**
 * タイムアウト付きFetch
 */
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

/**
 * 楽天APIで最安値を取得
 */
async function fetchRakutenInfo(jan) {
    const url = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401?applicationId=${CONFIG.RAKUTEN_APP_ID}&accessKey=${CONFIG.RAKUTEN_ACCESS_KEY}&affiliateId=${CONFIG.RAKUTEN_AFFILIATE_ID}&keyword=%22${jan}%22&sort=%2BitemPrice&hits=5`;
    try {
        const res = await fetchWithTimeout(url, {
            headers: {
                "Referer": "https://example.com/",
                "Origin": "https://example.com",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        const data = await res.json();
        
        if (data.Items && data.Items.length > 0) {
            for (const itemData of data.Items) {
                const item = itemData.Item;
                if (item.availability === 0) continue;

                const name = normalizeText(item.itemName);
                const catchCopy = normalizeText(item.catchcopy || "");
                const caption = normalizeText(item.itemCaption || "");

                const STRICT_USED = ["中古", "USED", "展示品", "アウトレット", "訳あり", "ジャンク", "JUNK", "新古品", "ほぼ新品"];
                const usedTrigger = STRICT_USED.find(w => name.includes(w) || catchCopy.includes(w) || caption.includes(w));
                
                if (usedTrigger) {
                    console.log(`[DEBUG] Rakuten Excluded (Used by "${usedTrigger}"): ${item.itemName.slice(0, 30)}`);
                    continue;
                }

                // その他の除外キーワードは商品名のみチェック（誤判定防止）
                const otherExclude = EXCLUDE_KEYWORDS.find(w => name.includes(w.toUpperCase()));
                if (otherExclude) {
                    console.log(`[DEBUG] Rakuten Excluded (Other): [${otherExclude}] ${item.itemName.slice(0, 30)}`);
                    continue;
                }

                return {
                    price: item.itemPrice,
                    url: item.itemUrl,
                    name: item.itemName
                };
            }
        }
    } catch (e) {
        log(`Rakuten API error for JAN ${jan}: ${e.message}`, 'ERROR');
        return null;
    }
    return null;
}

/**
 * YahooショッピングAPIで最安値を取得
 */
async function fetchYahooInfo(jan) {
    // condition=new を付与するが、念のためコード側でもフィルタリングを維持
    const url = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${CONFIG.YAHOO_CLIENT_ID}&jan_code=${jan}&condition=new&sort=%2Bprice&results=5`;
    try {
        const res = await fetchWithTimeout(url);
        const data = await res.json();
        
        if (data.hits && data.hits.length > 0) {
            for (const item of data.hits) {
                if (item.in_stock === false) continue;

                const name = normalizeText(item.name);
                
                // YahooはAPIで新品指定しているので、ここでは通常の除外キーワードのみチェック
                const excludeTrigger = EXCLUDE_KEYWORDS.find(word => name.includes(word.toUpperCase()));
                
                if (excludeTrigger) {
                    console.log(`[DEBUG] Yahoo Excluded: [${excludeTrigger}] ${item.name.slice(0, 30)}`);
                    continue;
                }

                return {
                    price: item.price,
                    url: item.url,
                    name: item.name
                };
            }
        }
    } catch (e) {
        log(`Yahoo API error for JAN ${jan}: ${e.message}`, 'ERROR');
        return null;
    }
    return null;
}

/**
 * 統合分析関数
 */
async function analyzeItem(jan, pName, maxBuyPrice, targetShop, pointRates, targetShops = [], generalRank = []) {
    const rInfo = await fetchRakutenInfo(jan);
    const yInfo = await fetchYahooInfo(jan);

    if (!rInfo && !yInfo) return null;

    let best;
    if (rInfo && yInfo) {
        best = (rInfo.price * (1 - pointRates.rakuten / 100)) < (yInfo.price * (1 - pointRates.yahoo / 100))
            ? { shop: "楽天", ...rInfo, pt: pointRates.rakuten / 100 }
            : { shop: "Yahoo", ...yInfo, pt: pointRates.yahoo / 100 };
    } else {
        best = rInfo ? { shop: "楽天", ...rInfo, pt: pointRates.rakuten / 100 }
                     : { shop: "Yahoo", ...yInfo, pt: pointRates.yahoo / 100 };
    }

    const realCost = Math.floor(best.price * (1 - best.pt));
    
    // 指定店舗の利益
    const profit = (parseInt(maxBuyPrice) || 0) - realCost;
    
    // 市場全体の最高値での利益（ランキング1位の価格を使用、なければ指定値を流用）
    const marketBestPrice = (generalRank && generalRank.length > 0) ? (generalRank[0].buyPrice || 0) : (parseInt(maxBuyPrice) || 0);
    const marketProfit = marketBestPrice - realCost;

    // 数値として成立しない等、異常なデータのみ除外
    if (isNaN(profit)) {
        return null;
    }

    const roi = ((profit / realCost) * 100).toFixed(2);
    if (parseFloat(roi) > 500) return null; // 異常値除外

    return {
        jan,
        productName: pName,
        maxBuyPrice,
        targetShop,
        targetShops,
        generalRank,
        supplier: best.shop,
        listPrice: best.price,
        itemUrl: best.url,
        realCost,
        profit,
        marketProfit,
        roi: parseFloat(roi)
    };
}

module.exports = { analyzeItem };
