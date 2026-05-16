const RAKUTEN_APP_ID = '2e7e1655-0167-4927-8dc1-86fd8b86c6ac';
const RAKUTEN_ACCESS_KEY = 'pk_51gqSnwdWfYaNN8zdaKAfy21bmjm4WV3knEVogcz6iz';
const RAKUTEN_AFFILIATE_ID = '4f28404c.9909b00a.4f28404d.cd3b6fa4';
const YAHOO_CLIENT_ID = 'dmVyPTIwMjUwNyZpZD1JMFF4em1VQ3owJmhhc2g9T0RWbE5qTmlNR1F4TlRWbE1qSmtOZw';
const TEST_JAN = '4550556124614';

async function test() {
    console.log(`--- Rakuten Test V3 (${TEST_JAN}) ---`);
    const rUrl = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260401?applicationId=${RAKUTEN_APP_ID}&accessKey=${RAKUTEN_ACCESS_KEY}&affiliateId=${RAKUTEN_AFFILIATE_ID}&keyword=${TEST_JAN}&sort=%2BitemPrice&hits=1`;
    try {
        const rRes = await fetch(rUrl, {
            headers: {
                "Referer": "https://example.com/",
                "Origin": "https://example.com",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        const rData = await rRes.json();
        console.log("Rakuten Response:", JSON.stringify(rData, null, 2));
    } catch (e) {
        console.log("Rakuten Error:", e.message);
    }

    console.log(`\n--- Yahoo Test (${TEST_JAN}) ---`);
    const yUrl = `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?appid=${YAHOO_CLIENT_ID}&jan_code=${TEST_JAN}&sort=%2Bprice&results=1`;
    try {
        const yRes = await fetch(yUrl);
        const yData = await yRes.json();
        console.log("Yahoo Response:", JSON.stringify(yData, null, 2));
    } catch (e) {
        console.log("Yahoo Error:", e.message);
    }
}

test();
