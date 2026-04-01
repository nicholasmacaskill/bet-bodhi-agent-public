
import { MLBApi } from './src/lib/mlb-api';

const gamesToCheck = [
    { gamePk: 824541, matchup: "Red Sox @ Reds" },
    { gamePk: 824200, matchup: "Tigers @ Padres" }, // Re-check gamePk
    { gamePk: 824635, matchup: "Rays @ Cardinals" }
];

async function main() {
    const api = new MLBApi();
    const date = '2026-03-26';

    try {
        const schedule = await api.getSchedule(date);
        
        for (const g of schedule) {
            console.log(`\n--- ${g.matchup || (g.awayTeam + " @ " + g.homeTeam)} (gamePk: ${g.gamePk}) ---`);
            console.log(`Status: ${g.status}`);
            console.log(`Probables: Away: ${g.probables?.away}, Home: ${g.probables?.home}`);
            
            const details = await api.getGameDetails(g.gamePk);
            console.log(`Lineups: Away: ${details?.lineups?.away?.length || 0}, Home: ${details?.lineups?.home?.length || 0}`);
        }

    } catch (e: any) {
        console.error("Failed to check games:", e.message);
    }
}

main();
