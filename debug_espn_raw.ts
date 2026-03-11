import { EspnOddsApi } from './src/lib/espn-odds-api';

async function main() {
    const espn = new EspnOddsApi();
    const url = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard';
    console.log(`Fetching raw ESPN data from: ${url}`);
    const resp = await fetch(url);
    const data = await resp.json();
    
    if (!data.events) {
        console.log("No events found.");
        return;
    }

    console.log(`Found ${data.events.length} events.`);
    data.events.forEach((e: any) => {
        const comp = e.competitions[0];
        const odds = comp.odds;
        console.log(`- ${e.name} | Odds available: ${!!odds && odds.length > 0}`);
        if (odds) {
            console.log("  Odds Data:", JSON.stringify(odds[0], null, 2));
        }
    });
}

main().catch(console.error);
