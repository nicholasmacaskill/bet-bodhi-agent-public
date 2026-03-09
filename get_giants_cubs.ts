
import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const api = new MLBApi();
    const games = await api.getSchedule('2026-03-08');
    const game = games.find(g => g.homeTeam.includes('Cubs') && g.awayTeam.includes('Giants'));

    if (game) {
        console.log("GAME_PK:", game.gamePk);
        console.log("HOME:", game.homeTeam);
        console.log("AWAY:", game.awayTeam);
        console.log("PITCHERS:", game.probables);
        console.log("LINEUPS_HOME:", game.lineups?.home.length);
        console.log("LINEUPS_AWAY:", game.lineups?.away.length);

        const details = await api.getGameDetails(game.gamePk);
        console.log("PROBABLES_DETAILS:", details?.probables);
    } else {
        console.log("Game not found.");
    }
}

main();
