
import { MLBApi } from '../../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-31';
    
    try {
        const games = await mlb.getSchedule(today);
        const disparities = [];

        for (const game of games) {
            const hP = game.probables?.home;
            const aP = game.probables?.away;
            if (!hP || !aP) continue;

            const getStats = async (name: string) => {
                const id = await mlb.searchPerson(name);
                return id ? await mlb.getPlayerStats(id, 'pitching', '2024') : null;
            };

            const [hStats, aStats] = await Promise.all([getStats(hP), getStats(aP)]);
            
            const hEra = parseFloat(hStats?.era || '4.5');
            const aEra = parseFloat(aStats?.era || '4.5');
            const hWhip = parseFloat(hStats?.whip || '1.35');
            const aWhip = parseFloat(aStats?.whip || '1.35');

            // Disparity Score = |(ERA A - ERA B)| + |(WHIP A - WHIP B) * 10|
            const eraDiff = Math.abs(hEra - aEra);
            const whipDiff = Math.abs(hWhip - aWhip);
            const disparity = eraDiff + (whipDiff * 5); // Weighting WHIP x5

            disparities.push({
                matchup: `${game.awayTeam} (${aP}) @ ${game.homeTeam} (${hP})`,
                disparity,
                hStats: { era: hEra, whip: hWhip },
                aStats: { era: aEra, whip: aWhip }
            });
        }

        disparities.sort((a, b) => b.disparity - a.disparity);

        console.log(`\n--- BIGGEST PITCHING DISPARITIES ---`);
        disparities.slice(0, 5).forEach((d, i) => {
            console.log(`${i+1}. ${d.matchup} | DISPARITY: ${d.disparity.toFixed(2)}`);
            console.log(`   ${d.aStats.era}/${d.aStats.whip} vs ${d.hStats.era}/${d.hStats.whip}`);
            console.log("");
        });

    } catch (e) {
        console.error(e);
    }
}

main();
