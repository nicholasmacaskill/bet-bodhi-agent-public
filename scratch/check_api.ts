import { MLBApi } from '../src/lib/mlb-api';

async function test() {
    const mlb = new MLBApi();
    const date = '2026-05-24';
    console.log(`Fetching schedule for ${date}...`);
    const games = await mlb.getSchedule(date);
    console.log(`Found ${games.length} games.`);
    for (const g of games) {
        console.log(`- ${g.awayTeam} @ ${g.homeTeam}: Status = "${g.status}", Score = "${g.score}", Date = "${g.date}"`);
    }
}

test();
