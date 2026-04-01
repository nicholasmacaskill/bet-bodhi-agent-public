
import { MLBApi } from './src/lib/mlb-api';

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuña Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodríguez", "Bryce Harper", "Adley Rutschman",
    "Gunnar Henderson", "Corbin Carroll", "Francisco Lindor", "Trea Turner", "José Ramírez"
];

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-31';
    
    try {
        const games = await mlb.getSchedule(today);
        const results = [];

        for (const game of games) {
            const data = await mlb.getHydratedAnalysisData(game);
            const { details, rosters, homeHot, awayHot } = data;

            const analyzeMatchup = async (pitcher: string, lineup: string[], hotBats: string[], battingTeam: string, pitchingTeam: string) => {
                if (!pitcher) return null;
                
                const id = await mlb.searchPerson(pitcher);
                const stats = id ? await mlb.getPlayerStats(id, 'pitching', '2024') : null;
                
                // Weakness Score (Higher is weaker)
                const era = parseFloat(stats?.era || '4.5');
                const whip = parseFloat(stats?.whip || '1.35');
                const weakness = (era / 2) + (whip * 2);

                // Strength Score (Higher is stronger)
                const eliteCount = lineup.filter(p => ELITE_BATS.includes(p)).length;
                const hotCount = hotBats.length;
                const strength = (eliteCount * 3) + (hotCount * 1);

                return {
                    matchup: `${battingTeam} OFFENSE vs ${pitcher} (${pitchingTeam})`,
                    strength,
                    weakness,
                    delta: strength + weakness, // Combining both for "The Edge"
                    elite: lineup.filter(p => ELITE_BATS.includes(p)),
                    hot: hotBats,
                    stats: stats ? { era: stats.era, whip: stats.whip } : null
                };
            };

            const awayEdge = await analyzeMatchup(details.probables?.home, details.lineups?.away, awayHot, game.awayTeam, game.homeTeam);
            const homeEdge = await analyzeMatchup(details.probables?.away, details.lineups?.home, homeHot, game.homeTeam, game.awayTeam);

            if (awayEdge) results.push(awayEdge);
            if (homeEdge) results.push(homeEdge);
        }

        results.sort((a, b) => b.delta - a.delta);

        console.log(`\n--- TOP MLB EDGES (STRENGTH VS WEAKNESS) ---`);
        results.slice(0, 5).forEach((r, i) => {
            console.log(`${i+1}. ${r.matchup} | EDGE SCORE: ${r.delta.toFixed(2)}`);
            console.log(`   Offense: Strength ${r.strength} (${r.elite.length} Elite, ${r.hot.length} Hot)`);
            console.log(`   Pitcher: Weakness ${r.weakness.toFixed(2)} (ERA: ${r.stats?.era || 'N/A'}, WHIP: ${r.stats?.whip || 'N/A'})`);
            console.log("");
        });

    } catch (e) {
        console.error(e);
    }
}

main();
