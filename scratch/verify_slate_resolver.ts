import { loadSlateBook } from '../src/lib/gateway/slate-book';

async function main() {
    const { resolver } = loadSlateBook();
    const markets = await resolver.loadSportsMarkets();
    console.log('Markets loaded:', markets.length);

    const pairs: [string, string, string][] = [
        ['Colorado Rockies', 'Miami Marlins', '2026-06-29'],
        ['Chicago Cubs', 'San Diego Padres', '2026-06-29'],
        ['Boston Red Sox', 'New York Yankees', '2026-06-29'],
    ];

    for (const [home, away, date] of pairs) {
        const market = await resolver.resolveMoneyline(home, away, date);
        console.log(`\n${away} @ ${home}`);
        console.log('  Match:', market?.question ?? 'NONE');
        if (market) {
            const cmp = await resolver.compareOdds(market, home, away, away, 70, `${date}T20:00:00Z`);
            if (cmp?.kickoff) {
                console.log('  Kickoff:', (cmp.kickoff.price * 100).toFixed(1) + '¢', 'EV', (cmp.kickoff.ev! * 100).toFixed(1) + '%');
                console.log('  Live:   ', (cmp.live.price * 100).toFixed(1) + '¢', 'EV', (cmp.live.ev! * 100).toFixed(1) + '%');
                console.log('  Δ EV:   ', ((cmp.evDelta || 0) * 100).toFixed(1) + '%');
            } else {
                console.log('  Live:   ', (cmp?.live.price ?? 0) * 100 + '¢ (no kickoff replay)');
            }
        }
    }
}

main().catch(console.error);