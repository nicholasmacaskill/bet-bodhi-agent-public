import { NHLApi } from '../../src/lib/nhl-api';
import 'dotenv/config';

async function check() {
    const nhl = new NHLApi();
    const date = '2026-03-10';
    const games = await nhl.getSchedule(date);
    console.log(`NHL games for ${date}:`);
    games.forEach(g => console.log(`- ${g.awayTeam} @ ${g.homeTeam}`));
}
check();
