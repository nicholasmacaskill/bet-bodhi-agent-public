
import { MLBApi } from './src/lib/mlb-api';

async function main() {
    const api = new MLBApi();
    const date = '2026-03-26';
    const gamePk = 824704; // Nationals @ Cubs

    try {
        const details = await api.getGameDetails(gamePk);
        console.log(`Game Status: ${details?.status || 'Unknown'}`);
        console.log(`Probable Pitchers:`);
        console.log(`  Away (Nationals): ${details?.probables?.away || 'TBD'}`);
        console.log(`  Home (Cubs): ${details?.probables?.home || 'TBD'}`);
        
        // Also check if there's any 'confirmed' flag in the player data if possible
        // But usually the presence in getGameDetails probables is the current source of truth.
        
        const schedule = await api.getSchedule(date);
        const game = schedule.find(g => g.gamePk === gamePk);
        if (game) {
            console.log(`Schedule Status: ${game.status}`);
            console.log(`Schedule Probables: Away: ${game.probables?.away}, Home: ${game.probables?.home}`);
        }

    } catch (e: any) {
        console.error("Verification failed:", e.message);
    }
}

main();
