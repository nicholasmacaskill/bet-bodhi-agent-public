import { EspnOddsApi } from '../src/lib/espn-odds-api';

async function run() {
    const api = new EspnOddsApi();
    const odds = await api.getOdds('baseball/mlb');
    console.log("ESPN Returned:", odds.length, "games.");
    if (odds.length > 0) {
        console.log("Sample:", JSON.stringify(odds[0], null, 2));
    } else {
        // Fetch raw to see what's wrong
        const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard');
        const data = await res.json();
        console.log("RAW Events count:", data.events?.length);
        if (data.events?.length > 0) {
            console.log("RAW Event 0 Competitors:", JSON.stringify(data.events[0].competitions[0].competitors.map((c: any) => c.team.displayName), null, 2));
            console.log("RAW Event 0 Odds:", JSON.stringify(data.events[0].competitions[0].odds, null, 2));
        }
    }
}
run();
