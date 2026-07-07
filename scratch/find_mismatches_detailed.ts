import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchMarketByConditionId(conditionId: string) {
    try {
        await sleep(100);
        const url = `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`;
        const res = await fetch(url);
        const data = await res.json();
        return data && data.length > 0 ? data[0] : null;
    } catch (e) {
        return null;
    }
}

async function main() {
    const poly = new PolymarketApi();
    const trades = await poly.getTrades();
    console.log(`Fetched ${trades.length} trades.`);

    const sampleMarkets = new Map<string, any>();

    for (const t of trades.slice(0, 50)) { // look at first 50 trades
        const conditionId = t.market;
        const tokenId = t.asset_id;
        if (!tokenId || !conditionId) continue;

        if (!sampleMarkets.has(tokenId)) {
            const details = await fetchMarketByConditionId(conditionId);
            if (!details) continue;
            sampleMarkets.set(tokenId, details);
        }

        const details = sampleMarkets.get(tokenId);
        const question = details.question || details.title || "";
        const lowerQuestion = question.toLowerCase();
        
        // Check baseball
        const baseballKeywords = ['kbo', 'mlb', 'baseball', 'korea', 'dodgers', 'yankees', 'red sox', 'cubs', 'braves', 'phillies', 'astros', 'orioles', 'padres', 'nationals', 'rockies', 'rays', 'giants', 'royals', 'twins', 'cardinals', 'mets', 'white sox', 'marlins', 'guardians', 'rangers', 'brewers', 'blue jays', 'angels', 'diamondbacks', 'mariners', 'tigers', 'athletics', 'pirates', 'reds'];
        const isBaseball = baseballKeywords.some(kw => lowerQuestion.includes(kw));

        console.log(`----------------------------------------------------`);
        console.log(`Trade ID: ${t.id}`);
        console.log(`Question: ${question}`);
        console.log(`isBaseball: ${isBaseball}`);
        console.log(`Trade Outcome: "${t.outcome}"`);
        console.log(`Market Outcomes: ${details.outcomes}`);
        console.log(`Winning Index: ${details.winningOutcomeIndex}`);
        const winner = details.winningOutcomeIndex !== undefined ? (JSON.parse(details.outcomes || "[]")[parseInt(details.winningOutcomeIndex)] || "") : "";
        console.log(`Resolved Winner: "${winner}"`);
        console.log(`Closed: ${details.closed}`);
        console.log(`Trade side: ${t.side} | Price: ${t.price} | Size: ${t.size}`);
    }
}

main().catch(console.error);
