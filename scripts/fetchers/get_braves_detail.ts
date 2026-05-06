import { MLBApi } from '../../src/lib/mlb-api';
async function main() {
    const mlb = new MLBApi();
    const date = '2026-03-11';
    const games = await mlb.getSchedule(date);
    const braves = games.find(g => g.homeTeam.includes("Braves") || g.awayTeam.includes("Braves"));
    console.log("Braves Game Info:", JSON.stringify(braves, null, 2));
}
main();
