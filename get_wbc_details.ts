import { MLBApi } from './src/lib/mlb-api';

async function getWBCDetails() {
    const mlb = new MLBApi();
    const date = '2026-03-10';
    

    console.log("\n--- MLB API Details (sportId=51) ---");
    const baseUrl = 'https://statsapi.mlb.com/api/v1';
    const url = `${baseUrl}/schedule?sportId=51&date=${date}&hydrate=team,lineups,probablePitcher,venue,weather`;
    const resp = await fetch(url);
    const data = await resp.json();
    
    if (data.dates && data.dates.length > 0) {
        const game = data.dates[0].games.find((g: any) => 
            g.teams.away.team.name.includes("Canada") || g.teams.home.team.name.includes("Canada")
        );
        
        if (game) {
            console.log(`Matchup: ${game.teams.away.team.name} @ ${game.teams.home.team.name}`);
            console.log(`Venue: ${game.venue.name}`);
            console.log(`Status: ${game.status.detailedState}`);
            console.log(`Probable Pitchers:`);
            console.log(`  Away: ${game.teams.away.probablePitcher?.fullName || "TBD"}`);
            console.log(`  Home: ${game.teams.home.probablePitcher?.fullName || "TBD"}`);
            
            if (game.weather) {
                console.log(`Weather: ${game.weather.temp}, ${game.weather.condition}, ${game.weather.wind}`);
            }
        }
    }
}

getWBCDetails();
