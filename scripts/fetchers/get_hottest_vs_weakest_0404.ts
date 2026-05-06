
import { MLBApi } from '../../src/lib/mlb-api';
import * as dotenv from 'dotenv';
dotenv.config();

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuna Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodriguez", "Bryce Harper", "Adley Rutschman",
    "Gunnar Henderson", "Corbin Carroll", "Francisco Lindor", "Trea Turner", "José Ramírez"
];

async function main() {
    const mlb = new MLBApi();
    const today = '2026-04-04';
    
    try {
        const games = await mlb.getSchedule(today);
        const results: any[] = [];

        for (const game of games) {
            const data = await mlb.getHydratedAnalysisData(game);
            const { details, rosters, homeHot, awayHot } = data;

            const analyzeMatchup = async (pitcher: string, lineup: string[], hotBats: string[], battingTeam: string, pitchingTeam: string) => {
                if (!pitcher) return null;
                
                const id = await mlb.searchPerson(pitcher);
                const stats = id ? await mlb.getPlayerStats(id, 'pitching', '2024') : null;
                
                // Weakness Score
                const era = parseFloat(stats?.era || '4.50');
                const whip = parseFloat(stats?.whip || '1.35');
                const weakness = (era / 2) + (whip * 2);

                // Strength Score
                const eliteCount = lineup.filter(p => ELITE_BATS.some(eb => p.includes(eb))).length;
                const hotCount = hotBats.length;
                const strength = (eliteCount * 4) + (hotCount * 2);

                return {
                    matchup: `${battingTeam.toUpperCase()} OFFENSE vs ${pitcher.toUpperCase()} (${pitchingTeam.toUpperCase()})`,
                    strength,
                    weakness,
                    delta: strength + (weakness * 2), // Weighting pitcher weakness heavily for this specific query
                    elite: lineup.filter(p => ELITE_BATS.some(eb => p.includes(eb))),
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

        console.log(`\n=============================================================`);
        console.log(`🔥 THE MISMATCH REPORT: HOT BATS vs WEAK PITCHERS (APR 4)   `);
        console.log(`=============================================================\n`);
        
        results.slice(0, 3).forEach((r, i) => {
            console.log(`${i+1}. 🚨 ${r.matchup}`);
            console.log(`   MISMATCH SCORE: ${r.delta.toFixed(2)}`);
            console.log(`   OFFENSE: Strength ${r.strength} (${r.elite.length} Elite, ${r.hot.length} Hot)`);
            console.log(`   PITCHER: Weakness ${r.weakness.toFixed(2)} (ERA: ${r.stats?.era || 'N/A'}, WHIP: ${r.stats?.whip || 'N/A'})`);
            if (r.elite.length > 0) console.log(`   ELITE BATS: ${r.elite.join(', ')}`);
            if (r.hot.length > 0) console.log(`   HOT STREAK: ${r.hot.join(', ')}`);
            console.log("");
        });

    } catch (e) {
        console.error(e);
    }
}

main();
