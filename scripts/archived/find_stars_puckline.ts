import { PolymarketApi } from '../../src/lib/polymarket-api';

async function findPuckLine() {
    const poly = new PolymarketApi();
    console.log("--- Searching Polymarket for Stars/Vegas Puck Line ---");
    const polyMarkets = await poly.getActiveSportsMarkets("Stars");
    polyMarkets.filter(m => m.question.includes("vs.") || m.question.toLowerCase().includes("puck line") || m.question.includes("-1.5") || m.question.includes("+1.5"))
               .forEach(m => console.log(`- [${m.conditionId}] ${m.question} (${m.outcomePrices.join('/')}) vol: ${m.volume}`));

    const polyVegas = await poly.getActiveSportsMarkets("Golden Knights");
    polyVegas.filter(m => m.question.includes("vs.") || m.question.toLowerCase().includes("puck line") || m.question.includes("-1.5") || m.question.includes("+1.5"))
               .forEach(m => console.log(`- [${m.conditionId}] ${m.question} (${m.outcomePrices.join('/')}) vol: ${m.volume}`));

}

findPuckLine();
