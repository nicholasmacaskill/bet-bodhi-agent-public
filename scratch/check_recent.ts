
import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function fetchMarketByTokenId(tokenId: string) {
    try {
        const url = `https://gamma-api.polymarket.com/markets?clob_token_ids=${tokenId}`;
        const res = await fetch(url);
        const data = await res.json();
        return data && data.length > 0 ? data[0] : null;
    } catch (e) {
        return null;
    }
}

async function checkRecentActivity() {
    const poly = new PolymarketApi();
    const trades = await poly.getTrades();
    const now = Date.now() / 1000;
    const oneDay = 24 * 60 * 60;

    const recentTrades = trades.filter((t: any) => (now - Number(t.match_time)) < oneDay);
    console.log(`Found ${recentTrades.length} trades in the last 24 hours.`);

    for (const t of recentTrades) {
        // USE ASSET_ID INSTEAD OF MARKET
        const details = await fetchMarketByTokenId(t.asset_id);
        const question = details?.question || "Unknown Market";
        console.log(`[${new Date(Number(t.match_time) * 1000).toLocaleString()}] ${t.side} ${t.size} @ ${t.price} | ${question} | Outcome: ${t.outcome} (Winner: ${details?.winningOutcomeIndex !== undefined ? details.outcomes[parseInt(details.winningOutcomeIndex)] : 'OPEN'})`);
    }
}

checkRecentActivity().catch(console.error);
