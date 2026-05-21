
import { MLBApi } from '../src/lib/mlb-api';

async function test() {
    const mlb = new MLBApi();
    const date = '2026-05-14';
    const games = await mlb.getSchedule(date);
    const philliesGame = games.find(g => g.homeTeam.includes('Red Sox') || g.awayTeam.includes('Red Sox'));
    console.log(JSON.stringify(philliesGame, null, 2));
}

test();
