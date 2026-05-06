
import 'dotenv/config';

async function fetchGammaActivity(address: string) {
    // Try the public profile endpoint
    const url = `https://gamma-api.polymarket.com/history?address=${address.toLowerCase()}&limit=50`;
    console.log(`URL: ${url}`);
    const res = await fetch(url);
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON. Response start:", text.substring(0, 200));
        throw e;
    }
}

async function run() {
    const proxy = process.env.POLY_PROXY_ADDRESS;
    if (!proxy) {
        console.error("Missing POLY_PROXY_ADDRESS");
        return;
    }

    const history = await fetchGammaActivity(proxy);
    console.log(`Found ${history.length} events.`);
    
    // ... rest of the logic ...
}

run().catch(console.error);
