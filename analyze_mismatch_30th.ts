import { MLBApi } from './src/lib/mlb-api';

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuña Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodríguez", "Bryce Harper", "Adley Rutschman",
    "Gunnar Henderson", "Corbin Carroll", "Francisco Lindor", "Trea Turner", "José Ramírez",
    "CJ Abrams", "Luis García Jr.", "Seiya Suzuki", "Ian Happ", "Soto", "Judge", "Ohtani"
];

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-30';
    console.log(`Analyzing MLB Offensive Mismatches for ${today}...`);

    try {
        const games = await mlb.getSchedule(today);
        const results: any[] = [];

        for (const game of games) {
            const data = await mlb.getHydratedAnalysisData(game);
            const { details, homeHot, awayHot } = data;

            const analyzeLineup = async (lineup: string[], hotBats: string[], oppPitcher: string, oppTeam: string) => {
                const eliteCount = lineup.filter(p => ELITE_BATS.some(e => p.includes(e))).length;
                const hotCount = lineup.filter(p => hotBats.some(h => p.includes(h))).length;
                const offenseScore = (eliteCount * 3) + (hotCount * 2);

                let pitcherStats = null;
                const id = await mlb.searchPerson(oppPitcher);
                if (id) {
                    pitcherStats = await mlb.getPlayerStats(id, 'pitching', '2026');
                    if (!pitcherStats || pitcherStats.era === '-.--') {
                        pitcherStats = await mlb.getPlayerStats(id, 'pitching', '2024');
                    }
                }

                const era = parseFloat(pitcherStats?.era || '5.50');
                const whip = parseFloat(pitcherStats?.whip || '1.60');
                const mismatchScore = offenseScore + (era / 1.5) + (whip * 3);

                return {
                    team: lineup === details.lineups?.home ? game.homeTeam : game.awayTeam,
                    pitcher: oppPitcher,
                    oppTeam,
                    offenseScore,
                    mismatchScore,
                    pitcherStats,
                    elite: lineup.filter(p => ELITE_BATS.some(e => p.includes(e))),
                    hot: lineup.filter(p => hotBats.some(h => p.includes(h)))
                };
            };

            const homeMismatch = await analyzeLineup(details.lineups?.home || [], data.homeHot, details.probables?.away || 'TBD', game.awayTeam);
            const awayMismatch = await analyzeLineup(details.lineups?.away || [], data.awayHot, details.probables?.home || 'TBD', game.homeTeam);

            results.push(homeMismatch, awayMismatch);
        }

        results.sort((a, b) => b.mismatchScore - a.mismatchScore);

        console.log(`\n=============================================================`);
        console.log(`        OFFENSIVE MISMATCH AUDIT - MARCH 30, 2026           `);
        console.log(`=============================================================`);

        results.slice(0, 5).forEach((r, i) => {
            const finalScore = r.mismatchScore.toFixed(2);
            console.log(`\n${i + 1}. ${r.team} OFFENSE vs. ${r.pitcher} (${r.oppTeam})`);
            console.log(`   Mismatch Score: ${finalScore} (Offense Power: ${r.offenseScore})`);
            console.log(`   Pitcher Profile: ERA: ${r.pitcherStats?.era || '4.50+'}, WHIP: ${r.pitcherStats?.whip || '1.40+'}`);
            if (r.elite.length > 0) console.log(`   Elite Bats: ${r.elite.join(', ')}`);
            if (r.hot.length > 0) console.log(`   Hot Hits: ${r.hot.join(', ')}`);
        });

    } catch (e) {
        console.error(e);
    }
}

main();
