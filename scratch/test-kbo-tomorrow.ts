import { KBOApi } from '../src/lib/kbo-api';

async function test() {
    const api = new KBOApi();
    const date = '2026-05-06';
    console.log(`Fetching KBO games for ${date}...`);
    const games = await api.getSchedule(date);
    console.log(`Found ${games.length} games.`);
    for (const game of games) {
        console.log(`Matchup: ${game.awayTeam} @ ${game.homeTeam} (${game.id})`);
        const pitchers = await api.getStartingPitchers(game.id);
        console.log(`Pitchers: ${JSON.stringify(pitchers)}`);
    }
}

test();
