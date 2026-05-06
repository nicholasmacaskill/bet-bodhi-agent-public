
import 'dotenv/config';
import { PolymarketApi } from './src/lib/polymarket-api';

async function testFetchHistory() {
    const poly = new PolymarketApi();
    const proxy = process.env.POLY_PROXY_ADDRESS;
    const eoa = '0xb1Aa8Ff8CEeB5506044DB7BcB2B2D243Ff680BB1'; // Derived previously

    console.log(`--- Fetching for Proxy: ${proxy} ---`);
    const proxyTrades = await poly.getTradesForAddress(proxy || "");
    console.log(`Found ${proxyTrades.length} trades for proxy.`);
    if (proxyTrades.length > 0) {
        console.log("Latest Proxy Trade:", JSON.stringify(proxyTrades[0], null, 2));
    }

    console.log(`\n--- Fetching for EOA: ${eoa} ---`);
    const eoaTrades = await poly.getTradesForAddress(eoa);
    console.log(`Found ${eoaTrades.length} trades for EOA.`);
    if (eoaTrades.length > 0) {
        console.log("Latest EOA Trade:", JSON.stringify(eoaTrades[0], null, 2));
    }
}

testFetchHistory().catch(console.error);
