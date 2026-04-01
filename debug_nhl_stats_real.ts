
import { NHLApi } from './src/lib/nhl-api';

async function main() {
    const api = new NHLApi();
    const date = '2026-03-18';
    const games = await api.getSchedule(date);
    const teamStats = await api.getTeamStats();
    
    const game = games.find(g => g.homeTeam.includes('Capitals'));
    if (game) {
        const landing = await api.getGameLanding(game.id);
        const goalies = landing?.matchup?.goalieSeasonStats?.goalies || [];
        const homeGoalie = goalies.find((g: any) => g.teamId === game.homeTeamId);
        const awayGoalie = goalies.find((g: any) => g.teamId === game.awayTeamId);
        
        console.log("Home Goalie (Lindgren):", homeGoalie);
        console.log("Away Goalie (Reimer):", awayGoalie);
        
        const hGFA = teamStats['Washington Capitals'].goalsForPerGame;
        const hGAA = teamStats['Washington Capitals'].goalsAgainstPerGame;
        const aGFA = teamStats['Ottawa Senators'].goalsForPerGame;
        const aGAA = teamStats['Ottawa Senators'].goalsAgainstPerGame;
        
        const homeGAAMetric = homeGoalie?.goalsAgainstAvg || 3.0;
        const awayGAAMetric = awayGoalie?.goalsAgainstAvg || 3.0;

        const homeEdge = (hGFA - aGAA) + (aGAA - homeGAAMetric);
        const awayEdge = (aGFA - hGAA) + (hGAA - awayGAAMetric);
        const diff = homeEdge - awayEdge;
        
        console.log(`hGFA: ${hGFA}, hGAA: ${hGAA}, houseGAA: ${homeGAAMetric}`);
        console.log(`aGFA: ${aGFA}, aGAA: ${aGAA}, awayGAA: ${awayGAAMetric}`);
        console.log(`Home Edge (WSH): ${homeEdge}`);
        console.log(`Away Edge (OTT): ${awayEdge}`);
        console.log(`Diff: ${diff}`);
    }
}

main();
