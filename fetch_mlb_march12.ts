import { MLBApi } from './src/lib/mlb-api';
async function main() {
    const mlb = new MLBApi();
    const date = '2026-03-12';
    console.log(`Fetching schedule for ${date}...`);
    const games = await mlb.getSchedule(date);
    games.forEach(g => console.log(`${g.awayTeam} @ ${g.homeTeam} (${g.status})` || "N/A"));
}
main();
