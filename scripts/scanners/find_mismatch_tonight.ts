
import { MLBApi } from '../../src/lib/mlb-api';

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuna Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodriguez", "Bryce Harper", "Adley Rutschman",
    "Jung Hoo Lee", "Jorge Soler", "LaMonte Wade Jr.", "Eloy Jimenez", "Connor Griffin",
    "Jackson Chourio", "Logan O'Hoppe"
];

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-06';

    try {
        const games = await mlb.getSchedule(today);
        const results = [];

        console.log(`Analyzing ${games.length} games for tonight...`);

        for (const game of games) {
            const homeLineup = game.lineups?.home || [];
            const awayLineup = game.lineups?.away || [];

            // If schedule hydration failed, try getDetails
            let homeL = homeLineup;
            let awayL = awayLineup;
            let probables = game.probables;

            if (homeL.length === 0) {
                const details = await mlb.getGameDetails(game.gamePk);
                if (details) {
                    homeL = details.lineups?.home || [];
                    awayL = details.lineups?.away || [];
                    probables = details.probables;
                }
            }

            const homeEliteCount = homeL.filter(p => ELITE_BATS.includes(p)).length;
            const awayEliteCount = awayL.filter(p => ELITE_BATS.includes(p)).length;

            if (probables?.home) {
                results.push({
                    pitcher: probables.home,
                    opposingEliteBats: awayEliteCount,
                    team: game.homeTeam,
                    opponent: game.awayTeam,
                    lineup: awayL
                });
            }

            if (probables?.away) {
                results.push({
                    pitcher: probables.away,
                    opposingEliteBats: homeEliteCount,
                    team: game.awayTeam,
                    opponent: game.homeTeam,
                    lineup: homeL
                });
            }
        }

        // Sort by opposing elite bats descending
        results.sort((a, b) => b.opposingEliteBats - a.opposingEliteBats);

        console.log("\nTop Mismatches (Weakest Pitchers vs Strongest Bats):");
        const topResults = results.filter(r => r.opposingEliteBats > 0);

        if (topResults.length === 0) {
            console.log("No elite bats found in any current lineups. Listing all pitchers by available lineup size as proxy:");
            results.sort((a, b) => b.lineup.length - a.lineup.length).slice(0, 5).forEach((r, i) => {
                console.log(`${i + 1}. ${r.pitcher} (${r.team}) vs ${r.opponent} (${r.lineup.length} players in lineup)`);
            });
        } else {
            topResults.slice(0, 5).forEach((r, i) => {
                console.log(`${i + 1}. ${r.pitcher} (${r.team}) vs ${r.opponent} (${r.opposingEliteBats} Elite Bats)`);
                const eliteList = r.lineup.filter(p => ELITE_BATS.includes(p));
                console.log(`   Elite Bats facing him: ${eliteList.join(', ')}`);
            });
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

main();
