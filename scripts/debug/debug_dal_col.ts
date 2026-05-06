
import { NHLApi } from '../../src/lib/nhl-api';

async function main() {
    const api = new NHLApi();
    const teamStats = await api.getTeamStats();
    
    // Colorado = Home, Dallas = Away
    const col = teamStats['Colorado Avalanche'];
    const dal = teamStats['Dallas Stars'];
    
    console.log("COL Stats:", col);
    console.log("DAL Stats:", dal);
    
    const landing = await api.getGameLanding(2025021079); // I assume this IDs DAL@COL based on logs
    // Actually search for it.
    const games = await api.getSchedule('2026-03-18');
    const game = games.find(g => g.homeTeam.includes('Avalanche'));

    if (game) {
        const landing = await api.getGameLanding(game.id);
        const goalies = landing?.matchup?.goalieSeasonStats?.goalies || [];
        const homeGoalie = goalies.find((g: any) => g.teamId === game.homeTeamId);
        const awayGoalie = goalies.find((g: any) => g.teamId === game.awayTeamId);
        
        console.log("Home Goalie (Wedgewood):", homeGoalie);
        console.log("Away Goalie (DeSmith):", awayGoalie);
        
        const hGFA = col.goalsForPerGame;
        const hGAA = col.goalsAgainstPerGame;
        const aGFA = dal.goalsForPerGame;
        const aGAA = dal.goalsAgainstPerGame;
        
        const homeGAAMetric = homeGoalie?.goalsAgainstAvg || 3.0;
        const awayGAAMetric = awayGoalie?.goalsAgainstAvg || 3.0;

        const homeEdge = (hGFA - aGAA) + (aGAA - homeGAAMetric);
        const awayEdge = (aGFA - hGAA) + (hGAA - awayGAAMetric);
        const diff = homeEdge - awayEdge;
        
        console.log(`Diff: ${diff}`);
    }
}

main();
