import { PolymarketApi } from '../src/lib/polymarket-api';
import 'dotenv/config';

async function main() {
    const poly = new PolymarketApi();
    console.log("Searching all active sports markets...");
    const markets = await poly.getActiveSportsMarkets("vs.");
    console.log(`Found ${markets.length} active markets with 'vs.' in event title.`);

    const keywords = ["dodgers", "padres", "angels", "athletics", "giants", "diamondbacks", "mariners", "white sox"];
    console.log("\nSearching for late MLB team keywords:");
    const matched = markets.filter(m => 
        keywords.some(kw => m.question?.toLowerCase().includes(kw))
    );
    console.log(`Found ${matched.length} matching markets.`);
    matched.forEach(m => {
        console.log(`- Title: "${m.question}" | Outcomes: ${m.outcomes} | Prices: ${m.outcomePrices}`);
    });
}

main().catch(console.error);
