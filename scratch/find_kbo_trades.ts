import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function fetchMarketByConditionId(conditionId: string) {
    try {
        const url = `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`;
        const res = await fetch(url);
        const data = await res.json();
        return data && data.length > 0 ? data[0] : null;
    } catch (e) {
        return null;
    }
}

async function findKbo() {
    const poly = new PolymarketApi();
    const trades = await poly.getTrades();
    console.log(`Fetched ${trades.length} trades.`);

    const kboTeams = [
        'LG Twins', 'KT Wiz', 'SSG Landers', 'NC Dinos', 'Doosan Bears', 'KIA Tigers', 'Lotte Giants', 
        'Samsung Lions', 'Hanwha Eagles', 'Kiwoom Heroes', 'Doosan', 'Lotte', 'Samsung', 'Hanwha', 'Kiwoom', 'Tigers', 'Twins', 'Wiz'
    ];

    const processedMarkets = new Set<string>();

    for (const t of trades) {
        if (!t.market || processedMarkets.has(t.market)) continue;
        processedMarkets.add(t.market);

        const details = await fetchMarketByConditionId(t.market);
        if (!details) continue;

        const question = details.question || details.title || "";
        
        let outcomes: string[] = [];
        if (details.outcomes) {
            if (typeof details.outcomes === 'string') {
                try {
                    outcomes = JSON.parse(details.outcomes);
                } catch {
                    outcomes = [details.outcomes];
                }
            } else if (Array.isArray(details.outcomes)) {
                outcomes = details.outcomes;
            }
        }

        const isKbo = kboTeams.some(team => 
            question.toLowerCase().includes(team.toLowerCase()) || 
            outcomes.some((o: string) => o.toLowerCase().includes(team.toLowerCase()))
        );
        
        if (isKbo) {
            console.log(`[KBO MATCH] Market: "${question}"`);
            console.log(`  Condition ID: ${t.market}`);
            console.log(`  Outcomes: ${JSON.stringify(outcomes)}`);
            console.log(`  Closed: ${details.closed} | Winner: ${details.winningOutcomeIndex}`);
            console.log(`  End Date: ${details.endDate}`);
        }
    }
}

findKbo().catch(console.error);
