
import { MLBApi } from '../../src/lib/mlb-api';

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuna Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodriguez", "Bryce Harper", "Adley Rutschman",
    "Gunnar Henderson", "Corbin Carroll", "Francisco Lindor", "Trea Turner", "Jose Ramirez"
];

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-23';
    console.log(`Analyzing MLB games for ${today}...`);

    try {
        const games = await mlb.getSchedule(today);
        const results = [];

        console.log(`Processing ${games.length} games...`);

        for (const game of games) {
            // Get hydrated data for the game
            const data = await mlb.getHydratedAnalysisData(game);
            const { details, rosters, homeHot, awayHot } = data;

            const homeLineup = details.lineups?.home || [];
            const awayLineup = details.lineups?.away || [];
            
            // Probable Pitchers
            const homePitcher = details.probables?.home;
            const awayPitcher = details.probables?.away;

            // Offensive Strength (using hot bats and elite bats in lineup)
            const getOffensiveScore = (lineup: string[], hotBats: string[]) => {
                const eliteCount = lineup.filter((p: string) => ELITE_BATS.includes(p)).length;
                const hotCount = lineup.filter((p: string) => hotBats.includes(p)).length;
                return (eliteCount * 2) + hotCount;
            };

            const homeOffenseScore = getOffensiveScore(homeLineup, homeHot);
            const awayOffenseScore = getOffensiveScore(awayLineup, awayHot);

            // Defensive Weakness (this is harder to quantify generically without per-pitcher stats)
            // For now, we'll look for matchups where a strong offense is facing a pitcher NOT in the "elite" category
            // or where we have a historical 'weakness' signal.
            
            // Defensive Weakness: Fetch pitcher stats
            const getPitcherStats = async (name: string) => {
                if (!name) return null;
                const id = await mlb.searchPerson(name);
                if (!id) return null;
                // Try 2026 Spring first, then 2024 Reg
                let stats = await mlb.getPlayerStats(id, 'pitching', '2026');
                if (!stats || !stats.era || stats.era === '-.--') {
                    stats = await mlb.getPlayerStats(id, 'pitching', '2024');
                }
                return stats;
            };

            if (awayPitcher && homeOffenseScore > 0) {
                const stats = await getPitcherStats(awayPitcher);
                results.push({
                    gamePk: game.gamePk,
                    matchup: `${game.awayTeam} @ ${game.homeTeam}`,
                    battingTeam: game.homeTeam,
                    pitcher: awayPitcher,
                    pitchingTeam: game.awayTeam,
                    offenseScore: homeOffenseScore,
                    pitcherStats: stats,
                    eliteBats: homeLineup.filter((p: string) => ELITE_BATS.includes(p)),
                    hotBats: homeLineup.filter((p: string) => homeHot.includes(p)),
                    edgeType: 'Home Offense Edge'
                });
            }

            if (homePitcher && awayOffenseScore > 0) {
                const stats = await getPitcherStats(homePitcher);
                results.push({
                    gamePk: game.gamePk,
                    matchup: `${game.awayTeam} @ ${game.homeTeam}`,
                    battingTeam: game.awayTeam,
                    pitcher: homePitcher,
                    pitchingTeam: game.homeTeam,
                    offenseScore: awayOffenseScore,
                    pitcherStats: stats,
                    eliteBats: awayLineup.filter((p: string) => ELITE_BATS.includes(p)),
                    hotBats: awayLineup.filter((p: string) => awayHot.includes(p)),
                    edgeType: 'Away Offense Edge'
                });
            }
        }

        // Calculate final Edge Score: Offense Score + (ERA / 2) + (WHIP * 2)
        const calculateFinalEdge = (r: any) => {
            let score = r.offenseScore;
            if (r.pitcherStats) {
                const era = parseFloat(r.pitcherStats.era) || 4.5;
                const whip = parseFloat(r.pitcherStats.whip) || 1.3;
                score += (era / 2) + (whip * 1.5);
            } else {
                // If no stats, assume average/minor league pitcher (slight bump)
                score += 3;
            }
            return score;
        };

        results.sort((a, b) => calculateFinalEdge(b) - calculateFinalEdge(a));

        console.log(`\nFound ${results.length} matchups with offensive edges.`);
        console.log("Top 10 MLB Games with Strongest Offensive Edges vs. Weak Defense (Spring Study):\n");

        results.slice(0, 10).forEach((r, i) => {
            const finalScore = calculateFinalEdge(r).toFixed(1);
            console.log(`${i + 1}. ${r.battingTeam} OFFENSE vs ${r.pitcher} (${r.pitchingTeam})`);
            console.log(`   Matchup: ${r.matchup}`);
            console.log(`   Edge Score: ${finalScore} (Offense: ${r.offenseScore})`);
            if (r.pitcherStats) {
                console.log(`   Pitcher Profile: ERA: ${r.pitcherStats.era}, WHIP: ${r.pitcherStats.whip} (${r.pitcherStats.avg ? 'BAA: ' + r.pitcherStats.avg : 'Career/Sess Stats'})`);
            } else {
                console.log(`   Pitcher Profile: Minor League / NR / No Data`);
            }
            if (r.eliteBats.length > 0) console.log(`   Elite Bats in Lineup: ${r.eliteBats.join(', ')}`);
            if (r.hotBats.length > 0) console.log(`   Recent Slaggers: ${r.hotBats.join(', ')}`);
            console.log("");
        });

    } catch (error) {
        console.error("Error running analysis:", error);
    }
}

main();
