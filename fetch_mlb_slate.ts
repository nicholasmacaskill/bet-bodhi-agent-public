import { MLBApi } from './src/lib/mlb-api';
async function main() {
    const mlb = new MLBApi();
    const date = '2026-03-11';
    console.log(`Fetching schedule for ${date}...`);
    const games = await mlb.getSchedule(date);
    if (games.length === 0) {
        console.log("No games found for this date.");
    } else {
        games.forEach(g => console.log(`${g.awayTeam} @ ${g.homeTeam} (${g.status})`));
    }
}
main();
