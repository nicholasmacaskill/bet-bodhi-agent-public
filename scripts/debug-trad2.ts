import { OddsApi } from '../src/lib/odds-api';
import { MLBApi } from '../src/lib/mlb-api';

async function test() {
    const api = new OddsApi();
    const mlb = new MLBApi();
    const odds = await api.getOdds('baseball_mlb_preseason');
    const games = await mlb.getSchedule('2026-03-08');

    for (const game of games) {
        if (game.awayTeam.includes('Detroit Tigers')) {
            const homeMascot = game.homeTeam.split(' ').pop()?.toLowerCase() || "";
            const awayMascot = game.awayTeam.split(' ').pop()?.toLowerCase() || "";
            const tradGame = odds.find((t: any) =>
                (t.home_team.toLowerCase().includes(homeMascot) || homeMascot.includes(t.home_team.toLowerCase().split(' ').pop())) &&
                (t.away_team.toLowerCase().includes(awayMascot) || awayMascot.includes(t.away_team.toLowerCase().split(' ').pop()))
            );
            if (tradGame) {
                const book = tradGame.bookmakers[0];
                const h2h = book.markets.find((m: any) => m.key === 'h2h');
                const spreader = book.markets.find((m: any) => m.key === 'spreads');

                const extOdds = {
                    homeOdds: h2h?.outcomes.find((o: any) => o.name === tradGame.home_team)?.price,
                    awayOdds: h2h?.outcomes.find((o: any) => o.name === tradGame.away_team)?.price,
                    homeSpread: spreader?.outcomes.find((o: any) => o.name === tradGame.home_team)?.point,
                    awaySpread: spreader?.outcomes.find((o: any) => o.name === tradGame.away_team)?.point,
                };
                console.log("EXTODDS:", extOdds);
            } else {
                console.log("NOT FOUND!", { homeMascot, awayMascot });
            }
        }
    }
}
test();
