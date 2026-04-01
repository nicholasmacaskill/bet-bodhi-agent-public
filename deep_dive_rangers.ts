
import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const today = '2026-03-31';
    
    try {
        const schedule = await mlb.getSchedule(today);
        const game = schedule.find(g => g.awayTeam.includes("Rangers") && g.homeTeam.includes("Orioles"));
        
        if (!game) {
            console.log("Could not find Rangers vs Orioles game.");
            return;
        }

        console.log(`\n--- DEEP DIVE: ${game.awayTeam} @ ${game.homeTeam} ---`);
        const data = await mlb.getHydratedAnalysisData(game);
        const { details, rosters, homeHot, awayHot } = data;
        
        console.log(`Weather: ${details.weather?.condition || 'N/A'}, Temp: ${details.weather?.temp || 'N/A'}, Wind: ${details.weather?.wind || 'N/A'}`);
        
        // Pitcher Matchup
        const awayP = details.probables?.away; // deGrom
        const homeP = details.probables?.home; // Eflin

        const getStats = async (name: string) => {
            const id = await mlb.searchPerson(name);
            if (!id) return null;
            return await mlb.getPlayerStats(id, 'pitching', '2024');
        };

        const awayStats = awayP ? await getStats(awayP) : null;
        const homeStats = homeP ? await getStats(homeP) : null;

        console.log(`\n[PITCHING]`);
        console.log(`Away: ${awayP || 'TBD'} | 2024 ERA: ${awayStats?.era || 'N/A'} | WHIP: ${awayStats?.whip || 'N/A'}`);
        console.log(`Home: ${homeP || 'TBD'} | 2024 ERA: ${homeStats?.era || 'N/A'} | WHIP: ${homeStats?.whip || 'N/A'}`);

        // Bullpen Check (basic)
        console.log(`\n[ROSTERS]`);
        console.log(`Home Roster Size: ${rosters.home.length}`);
        console.log(`Away Roster Size: ${rosters.away.length}`);

        // Offense vs Pitcher Type (if handedness available)
        const awayHand = awayP ? (await mlb.getPersonDetails(await mlb.searchPerson(awayP) || 0))?.pitchHand?.code : 'R';
        const homeHand = homeP ? (await mlb.getPersonDetails(await mlb.searchPerson(homeP) || 0))?.pitchHand?.code : 'R';

        console.log(`\n[ANALYSIS]`);
        console.log(`1. Run Line (-1.5): Texas needs to win by 2+.`);
        console.log(`2. Mismatch: Eflin's 8.49 ERA (Spring/Recent) vs deGrom is the biggest technical delta of the day.`);
        console.log(`3. Plus Money: Usually implies market uncertainty about deGrom's duration or Orioles' high-octane offense.`);
        console.log(`4. Verdict: If deGrom is cleared for 75+ pitches, -1.5 is an 'Aggressive' conviction signal.`);

    } catch (e) {
        console.error(e);
    }
}

main();
