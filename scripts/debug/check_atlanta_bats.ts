
import { MLBApi } from '../../src/lib/mlb-api';

async function main() {
    const api = new MLBApi();
    const atlantaId = 144;
    console.log("Fetching Atlanta Braves Hot Bats and Roster...");
    
    const hotBats = await api.getHotBats(atlantaId);
    const roster = await api.getTeamRoster(atlantaId);

    // Fetch leaders for the team if available
    console.log("=== ATLANTA BRAVES REPORT ===");
    console.log("HOT BATS (Last 72h based on OPS leaders):");
    hotBats.forEach(b => console.log(`- ${b}`));

    console.log("\nACTIVE ROSTER / ELITE CHECK:");
    const eliteBats = [
        "Ronald Acuna Jr.", "Matt Olson", "Austin Riley", "Ozzie Albies", 
        "Michael Harris II", "Marcell Ozuna", "Sean Murphy"
    ];
    
    roster.forEach(p => {
        if (eliteBats.some(e => p.includes(e))) {
            console.log(`⭐ ELITE: ${p}`);
        }
    });
}

main();
