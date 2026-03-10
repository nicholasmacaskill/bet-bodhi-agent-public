import { PolymarketApi } from '../src/lib/polymarket-api';
import { SxBetApi } from '../src/lib/sx-bet-api';
import { Wallet } from 'ethers';
import 'dotenv/config';

async function research() {
    const poly = new PolymarketApi();
    const sx = new SxBetApi();
    const privateKey = process.env.WALLET_PRIVATE_KEY;

    if (!privateKey || privateKey === 'your_private_key_here') {
        console.log("No valid WALLET_PRIVATE_KEY found.");
        return;
    }

    const wallet = new Wallet(privateKey);
    const address = wallet.address;
    const polyProxy = process.env.POLY_PROXY_ADDRESS || address;

    console.log(`Researching for Address: ${address}`);
    if (polyProxy !== address) console.log(`Poly Proxy Address: ${polyProxy}`);

    console.log("\n--- Researching Polymarket History ---");
    const clobUrl = 'https://clob.polymarket.com';
    
    // Test multiple possible endpoints
    const polyEndpoints = [
        `${clobUrl}/trades?maker=${polyProxy}`,
        `${clobUrl}/orders?maker=${polyProxy}&status=filled`,
        `${clobUrl}/trades?maker=${address}`, // Try EOA too
        `${clobUrl}/orders?maker=${address}&status=filled`
    ];

    for (const url of polyEndpoints) {
        console.log(`Trying: ${url}`);
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                console.log(`Success! Data length: ${Array.isArray(data) ? data.length : 'Object'}`);
                if (Array.isArray(data) && data.length > 0) {
                    console.log("Sample:", JSON.stringify(data[0]).slice(0, 500));
                }
            } else {
                console.log(`Failed: ${res.status} ${res.statusText}`);
            }
        } catch (e: any) {
            console.error(`Error: ${e.message}`);
        }
    }

    console.log("\n--- Researching SxBet History ---");
    const sxUrl = 'https://api.sx.bet';
    const sxEndpoints = [
        `${sxUrl}/orders?maker=${address}&status=filled`,
        `${sxUrl}/trades?maker=${address}`
    ];

    for (const url of sxEndpoints) {
        console.log(`Trying: ${url}`);
        try {
            const res = await fetch(url);
            const data = await res.json();
            console.log(`Response: ${res.status}`);
            console.log("Data:", JSON.stringify(data).slice(0, 500));
        } catch (e: any) {
            console.error(`Error: ${e.message}`);
        }
    }
}

research();
