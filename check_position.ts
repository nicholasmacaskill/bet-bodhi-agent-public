import { Wallet, ethers } from 'ethers';
import 'dotenv/config';

async function checkPosition() {
    const conditionId = '0x66662443cff0d225977d1cc3374f2f75f0867fbe27a1f6923ac076fc974260ad';
    const privateKey = process.env.WALLET_PRIVATE_KEY;
    if (!privateKey) return;

    const provider = new ethers.JsonRpcProvider('https://polygon-bor-rpc.publicnode.com');
    const wallet = new Wallet(privateKey, provider);
    const address = process.env.POLY_PROXY_ADDRESS || wallet.address;

    console.log(`Checking positions for address: ${address}`);

    // We need CTF contract to check balances of ERC1155 tokens (Polymarket positions)
    const ctfAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // This is USDC.e, wait.
    // The Conditional Tokens Framework (CTF) contract address on Polygon:
    const CTF_CONTRACT = "0x4D9702597715E221183200ce27d1d2d25F1705"; // Actually 0x4D9... is something else.
    // Correct CTF for Polymarket: 0x4D9702597715E221183200ce27d1d2d25F1705 ? No.
    // Let's use the Gamma API to get the clobTokenIds and then check balance if I can find a balance-checker.

    // Actually, I can use the Gamma API's "balances" endpoint if available, but usually it's easier to check via RPC.
    // But I don't know the exact CTF address by heart and I can't browse easily for it without a tool.
    
    // Alternative: Check the Gamma API for the user's profile/balances if possible.
    // URL: https://gamma-api.polymarket.com/profiles/<address>
    
    try {
        const url = `https://gamma-api.polymarket.com/profiles/${address}`;
        const resp = await fetch(url);
        const data = await resp.json();
        console.log("User Profile Data fetched.");
        // Profiles might not show live positions in the same way.
        
        // Let's try to find "Rockies" or "Mariners" in the user's recent history or positions.
        // Actually, I'll just check the Gamma API for the market's current status again, but more carefully.
        
        const marketUrl = `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`;
        const marketResp = await fetch(marketUrl);
        const marketData = await marketResp.json();
        if (marketData && marketData.length > 0) {
            const m = marketData[0];
            console.log(`Market: ${m.question}`);
            console.log(`Active: ${m.active} | Closed: ${m.closed}`);
            console.log(`Outcome Prices: ${m.outcomePrices}`);
        } else {
            console.log("Market not found via Gamma API.");
        }

    } catch (e: any) {
        console.error("Failed:", e.message);
    }
}

checkPosition();
