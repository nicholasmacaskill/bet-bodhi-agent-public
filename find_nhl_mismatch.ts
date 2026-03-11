import { NHLApi } from './src/lib/nhl-api';
import 'dotenv/config';

async function findMismatch() {
    const nhl = new NHLApi();
    const date = '2026-03-10';
    console.log(`Checking NHL Mismatches for ${date}...\n`);

    const games = await nhl.getSchedule(date);
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

        // Advantage for Away Offense vs Home Goalie
        if (awayStats && homeGoalie) {
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

        // Advantage for Home Offense vs Away Goalie
        if (homeStats && awayGoalie) {
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

    console.log("--- Top Offenses Tonight ---");
    mismatches.slice(0, 5).forEach(m => {
        console.log(`${m.offense} (${m.offenseGFPG.toFixed(2)} GF/G) vs ${m.defense} [Goalie: ${m.goalie} (${m.goalieSvPct.toFixed(3)})]`);
        if (m.isWeakGoalie) console.log(`   🚨 WEAK GOALIE ALERT: ${m.goalie}`);
    });

    console.log("\n--- Weakest Goalies Tonight ---");
    const sortedByGoalie = [...mismatches].filter(m => m.goalieSvPct > 0).sort((a, b) => a.goalieSvPct - b.goalieSvPct);
    sortedByGoalie.slice(0, 5).forEach(m => {
        console.log(`${m.goalie} (${m.goalieSvPct.toFixed(3)}) [${m.defense}] facing ${m.offense} (${m.offenseGFPG.toFixed(2)} GF/G)`);
    });
}

findMismatch();
