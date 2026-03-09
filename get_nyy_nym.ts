
import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const api = new MLBApi();
    const games = await api.getSchedule('2026-03-08');
    const game = games.find(g => g.homeTeam.includes('Mets') && g.awayTeam.includes('Yankees'));

    if (game) {
        console.log("GAME_PK:", game.gamePk);
        console.log("HOME:", game.homeTeam);
        console.log("AWAY:", game.awayTeam);
        console.log("PITCHERS:", game.probables);

        const details = await api.getGameDetails(game.gamePk);
        console.log("PROBABLES_DETAILS:", details?.probables);
    } else {
        console.log("Game not found.");
    }
}

main();
