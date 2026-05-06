
import { NHLApi } from '../../src/lib/nhl-api';

async function main() {
    const nhl = new NHLApi();
    const date = '2026-03-18';
    console.log(`Checking NHL Mismatches for ${date}...\n`);

    const games = await nhl.getSchedule(date);
    if (games.length === 0) {
        console.log("No NHL games found for today.");
        return;
    }

    const teamStats = await nhl.getTeamStats();
    const goalieLeaders = await nhl.getGoalieLeaders();

    const mismatches = [];

    for (const game of games) {
        const homeStats = teamStats[game.homeTeam];
        const awayStats = teamStats[game.awayTeam];

        const landing = await nhl.getGameLanding(game.id);
        const goalies = landing?.matchup?.goalieSeasonStats?.goalies || [];
        
        const homeGoalie = goalies.find((g: any) => g.teamId === game.homeTeamId);
        const awayGoalie = goalies.find((g: any) => g.teamId === game.awayTeamId);

        const hGName = homeGoalie?.name?.default || "TBD";
        const aGName = awayGoalie?.name?.default || "TBD";
        
        const hGSvPct = homeGoalie?.savePctg || 0;
        const aGSvPct = awayGoalie?.savePctg || 0;

        if (awayStats) {
            mismatches.push({
                offense: game.awayTeam,
                offenseGFPG: awayStats.goalsForPerGame,
                defense: game.homeTeam,
                goalie: hGName,
                goalieSvPct: hGSvPct,
                isWeakGoalie: goalieLeaders.weak.includes(hGName) || (hGSvPct < 0.900 && hGSvPct > 0),
                score: awayStats.goalsForPerGame * (1 - hGSvPct) * 10 
            });
        }

        if (homeStats) {
            mismatches.push({
                offense: game.homeTeam,
                offenseGFPG: homeStats.goalsForPerGame,
                defense: game.awayTeam,
                goalie: aGName,
                goalieSvPct: aGSvPct,
                isWeakGoalie: goalieLeaders.weak.includes(aGName) || (aGSvPct < 0.900 && aGSvPct > 0),
                score: homeStats.goalsForPerGame * (1 - hGSvPct) * 10
            });
        }
    }

    mismatches.sort((a, b) => b.offenseGFPG - a.offenseGFPG);

    console.log("=== NHL ANALYSIS TONIGHT ===");
    console.log("--- Top Offenses vs. Goalies ---");
    mismatches.slice(0, 10).forEach(m => {
        let alert = m.isWeakGoalie ? " 🚨 WEAK GOALIE" : "";
        console.log(`${m.offense} (${m.offenseGFPG.toFixed(2)} GF/G) vs ${m.defense} [Goalie: ${m.goalie} (${m.goalieSvPct.toFixed(3)})]${alert}`);
    });

    console.log("\n--- Value Goalies (Hardest to Beat) ---");
    const sortedByGoalieStrong = [...mismatches].filter(m => m.goalieSvPct > 0).sort((a, b) => b.goalieSvPct - a.goalieSvPct);
    sortedByGoalieStrong.slice(0, 5).forEach(m => {
        console.log(`${m.goalie} (${m.goalieSvPct.toFixed(3)}) [${m.defense}] facing ${m.offense} (${m.offenseGFPG.toFixed(2)} GF/G)`);
    });
}

main();
