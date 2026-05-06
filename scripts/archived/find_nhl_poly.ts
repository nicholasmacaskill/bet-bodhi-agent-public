import { PolymarketApi } from '../../src/lib/polymarket-api';

async function findNHL() {
    const api = new PolymarketApi();
    console.log("Searching for NHL on Polymarket...");
    const markets = await api.getActiveSportsMarkets("NHL");
    console.log(`Found ${markets.length} NHL markets.`);
    markets.forEach(m => {
        if (m.question.includes("Stars") || m.question.includes("Vegas") || m.question.includes("Dallas") || m.question.includes("Golden Knights")) {
            console.log(`- [${m.conditionId}] ${m.question} (${m.outcomePrices.join('/')})`);
        }
    });
}
findNHL();
