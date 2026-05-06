import { PolymarketApi } from '../../src/lib/polymarket-api';
import 'dotenv/config';

async function findActiveMlb() {
    const api = new PolymarketApi();
    console.log("Searching for active Mariners/Rockies/Padres markets...");

    try {
        const m1 = await api.getMarketByTeams("Seattle Mariners", "Colorado Rockies");
        const m2 = await api.getMarketByTeams("San Diego Padres", "Seattle Mariners");

        console.log("\n--- Market 1 (Mariners vs Rockies) ---");
        if (m1) {
            console.log(JSON.stringify(m1, null, 2));
        } else {
            console.log("Not found.");
        }

        console.log("\n--- Market 2 (Padres vs Mariners) ---");
        if (m2) {
            console.log(JSON.stringify(m2, null, 2));
        } else {
            console.log("Not found.");
        }

    } catch (e: any) {
        console.error("Search failed:", e.message);
    }
}

findActiveMlb();
