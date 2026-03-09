import { OddsApi } from '../src/lib/odds-api';
import { MLBApi } from '../src/lib/mlb-api';

async function test() {
    const api = new OddsApi();
    const mlb = new MLBApi();
    const odds = await api.getOdds('baseball_mlb_preseason');
    const games = await mlb.getSchedule('2026-03-08');

    for (const game of games) {
        if (game.awayTeam.includes('Detroit Tigers')) {
            console.log("GAME:", game);
            const homeMascot = game.homeTeam.split(' ').pop()?.toLowerCase() || "";
            const awayMascot = game.awayTeam.split(' ').pop()?.toLowerCase() || "";
            console.log("MASCOTS:", { homeMascot, awayMascot });

            const tradGame = odds.find((t: any) =>
                (t.home_team.toLowerCase().includes(homeMascot) || homeMascot.includes(t.home_team.toLowerCase().split(' ').pop())) &&
                (t.away_team.toLowerCase().includes(awayMascot) || awayMascot.includes(t.away_team.toLowerCase().split(' ').pop()))
            );
            console.log("FOUND TRAD GAME:", tradGame);
        }
    }
}
test();
