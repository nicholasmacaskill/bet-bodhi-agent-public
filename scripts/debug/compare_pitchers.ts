
import { MLBApi } from '../../src/lib/mlb-api';

async function compare() {
    const mlb = new MLBApi();
    const p1 = "Reid Detmers";
    const p2 = "Bryan Woo";

    console.log("--- 📊 PITCHER COMPARISON: DETMERS vs WOO ---");

    for (const name of [p1, p2]) {
        const id = await mlb.searchPerson(name);
        if (id) {
            const stats = await mlb.getPlayerStats(id, 'pitching', '2024'); // Using 2024 for more reliable baseline
            console.log(`\n👤 ${name}:`);
            if (stats) console.log(`   🔸 ERA: ${stats.era}, WHIP: ${stats.whip}, K/9: ${stats.strikeOutsPer9Inn}`);
        }
    }
}
compare();
