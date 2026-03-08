import { PolymarketApi } from '../src/lib/polymarket-api';

const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';
const RED = '\x1b[31m';

async function scanPolymarket() {
    console.clear();
    console.log(`${BOLD}${MAGENTA}🌐 BODHI POLYMARKET SCANNER (v3.0)${RESET}`);
    console.log(`  Retrieving live Web3 sports markets...\n`);

    const api = new PolymarketApi();

    // We search for "vs." to locate the deeply hidden daily matchups on Polymarket
    const keywords = ["vs."];
    const allMarkets = [];

    for (const kw of keywords) {
        process.stdout.write(`  ${CYAN}⟳${RESET} Scanning Gamma API for [${kw}]...`);
        const markets = await api.getActiveSportsMarkets(kw);
        allMarkets.push(...markets);
        process.stdout.write(`\r  ${GREEN}✓${RESET} Found ${markets.length} active conditions\n`);
    }

    // Deduplicate markets by conditionId
    const uniqueMarkets = Array.from(new Map(allMarkets.map(m => [m.conditionId, m])).values());
    console.log(`\n${BOLD}Total Unique Markets Found: ${uniqueMarkets.length}${RESET}\n`);

    // Filter down to interesting sports matchups
    const activeMatchups = uniqueMarkets.filter(m =>
        m.volume > 100 && // Must have at least $100 in volume to be tradeable
        (m.question.includes("vs.") || m.description.includes("vs.")) // Strictly daily games
    ).sort((a, b) => b.volume - a.volume);

    if (activeMatchups.length === 0) {
        console.log(`  ${RED}No liquid daily sports markets trading right now.${RESET}`);
        return;
    }

    console.log(`${BOLD}Top Liquid Daily Matchups on Polymarket:${RESET}`);

    for (const m of activeMatchups.slice(0, 10)) {
        console.log(`\n  ${CYAN}Condition ID:${RESET} ${m.conditionId}`);
        console.log(`  ${BOLD}${m.question}${RESET} (Vol: $${m.volume.toLocaleString()})`);

        for (let i = 0; i < m.outcomes.length; i++) {
            const price = parseFloat(m.outcomePrices[i]);
            // Format price as percentage
            const prob = (price * 100).toFixed(1) + '%';

            let color = RESET;
            if (price > 0.6) color = GREEN;
            else if (price < 0.4) color = YELLOW;

            console.log(`    → ${m.outcomes[i]}: ${color}${prob} ($${price.toFixed(2)}/share)${RESET}`);
        }
    }

    console.log(`\n${DIM}Note: Bodhi Engine integration requires mapping specific Polymarket Condition IDs to MLB/NHL Game IDs.${RESET}\n`);
}

const DIM = '\x1b[2m';

scanPolymarket();
