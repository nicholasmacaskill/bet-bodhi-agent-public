
import { NHLApi } from '../../src/lib/nhl-api';

async function main() {
    const api = new NHLApi();
    const date = '2026-03-18';
    const games = await api.getSchedule(date);
    const teamStats = await api.getTeamStats();
    
    const game = games.find(g => g.homeTeam.includes('Ducks'));
    if (game) {
        const landing = await api.getGameLanding(game.id);
        const goalies = landing?.matchup?.goalieSeasonStats?.goalies || [];
        const homeGoalie = goalies.find((g: any) => g.teamId === game.homeTeamId);
        const awayGoalie = goalies.find((g: any) => g.teamId === game.awayTeamId);
        
        console.log("Home Goalie (Dostal):", homeGoalie);
        console.log("Away Goalie (Vladar):", awayGoalie);
        
        const hGFA = teamStats['Anaheim Ducks'].goalsForPerGame;
        const hGAA = teamStats['Anaheim Ducks'].goalsAgainstPerGame;
        const aGFA = teamStats['Philadelphia Flyers'].goalsForPerGame;
        const aGAA = teamStats['Philadelphia Flyers'].goalsAgainstPerGame;
        
        const homeGAAMetric = homeGoalie?.goalsAgainstAvg || 3.0;
        const awayGAAMetric = awayGoalie?.goalsAgainstAvg || 3.0;

        const homeEdge = (hGFA - aGAA) + (aGAA - homeGAAMetric);
        const awayEdge = (aGFA - hGAA) + (hGAA - awayGAAMetric);
        const diff = homeEdge - awayEdge;
        
        console.log(`hGFA: ${hGFA}, hGAA: ${hGAA}, homeGAA: ${homeGAAMetric}`);
        console.log(`aGFA: ${aGFA}, aGAA: ${aGAA}, awayGAA: ${awayGAAMetric}`);
        console.log(`Home Edge (Ducks): ${homeEdge}`);
        console.log(`Away Edge (Flyers): ${awayEdge}`);
        console.log(`Diff: ${diff}`);
    }
}

main();
