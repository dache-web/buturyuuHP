const YAHOO_CLIENT_ID = 'dmVyPTIwMjUwNyZpZD1JMFF4em1VQ3owJmhhc2g9T0RWbE5qTmlNR1F4TlRWbE1qSmtOZw';
const TEST_JAN = '4550556124614';

async function test() {
    console.log(`\n--- Yahoo Test Corrected (${TEST_JAN}) ---`);
    // Change client_id to appid
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
