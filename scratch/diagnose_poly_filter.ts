import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    const api = new PolymarketApi();
    const markets = await api.getAllActiveSportsMarkets();
    console.log('Total sports markets fetched:', markets.length);

    const twoOutcome = markets.filter(m => m.outcomes?.length === 2);
    const passesCurrent = twoOutcome.filter(m => PolymarketApi.isMoneylineMarket(m));

    const rejectedByQWithVs = twoOutcome.filter(m => {
        const q = (m.question || '').trim();
        if (/O\/U|Spread|1st 5/i.test(q)) return false;
        if (m.outcomes!.some(o => /^(Over|Under|Yes|No)$/i.test(o))) return false;
        return /\?/.test(q) && /^.+\s+vs\.?\s+.+$/i.test(q);
    });

    const rejectedByVsOnly = twoOutcome.filter(m => {
        const q = (m.question || '').trim();
        if (!q) return false;
        if (/[:?]/.test(q)) return false;
        if (/O\/U|Spread|1st 5/i.test(q)) return false;
        if (m.outcomes!.some(o => /^(Over|Under|Yes|No)$/i.test(o))) return false;
        return !/^.+\s+vs\.?\s+.+$/i.test(q);
    });

    console.log('2-outcome markets:', twoOutcome.length);
    console.log('Pass isMoneylineMarket (current):', passesCurrent.length);
    console.log('Blocked by ? veto (has vs format):', rejectedByQWithVs.length);
    console.log('Blocked by vs-only regex:', rejectedByVsOnly.length);

    console.log('\nBlocked by ? samples:');
    rejectedByQWithVs.slice(0, 8).forEach(m => console.log(' ', m.question?.slice(0, 100)));

    console.log('\nBlocked by vs-only samples:');
    rejectedByVsOnly.slice(0, 8).forEach(m => console.log(' ', m.question?.slice(0, 100)));

    const testPairs: [string, string][] = [
        ['Colorado Rockies', 'Miami Marlins'],
        ['Chicago Cubs', 'San Diego Padres'],
        ['Boston Red Sox', 'New York Yankees'],
    ];
    for (const [home, away] of testPairs) {
        const match = api.findMoneylineInMarkets(markets, home, away, '2026-06-29');
        console.log(`\n${away} @ ${home} => ${match ? match.question : 'NO MATCH'}`);
    }
}

main();