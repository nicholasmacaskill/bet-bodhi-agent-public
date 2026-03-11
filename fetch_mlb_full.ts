import { MLBApi } from './src/lib/mlb-api';
async function main() {
    const mlb = new MLBApi();
    const date = '2026-03-11';
    
    for (const sportId of [1, 51]) {
        console.log(`\n--- Sport ID: ${sportId} for ${date} ---`);
        const url = `https://statsapi.mlb.com/api/v1/schedule?sportId=${sportId}&date=${date}&hydrate=team,lineups,probablePitcher,venue`;
        const resp = await fetch(url);
        const data = await resp.json();
        if (data.dates && data.dates.length > 0) {
            data.dates[0].games.forEach((g: any) => console.log(`${g.teams.away.team.name} @ ${g.teams.home.team.name} (${g.status.detailedState})` || "N/A"));
        } else {
            console.log("No games.");
        }
    }
}
main();
