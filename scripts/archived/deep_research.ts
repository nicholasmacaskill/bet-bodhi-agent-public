
import { MLBApi } from '../../src/lib/mlb-api';

async function research() {
    const mlb = new MLBApi();
    const players = [
        "Reynaldo López", "Ryne Nelson", "David Peterson", "Robbie Ray",
        "Matt Olson", "Ronald Acuna Jr.", "Austin Riley", "Ketel Marte", "Corbin Carroll",
        "Francisco Lindor", "Pete Alonso", "Matt Chapman", "Jung Hoo Lee"
    ];

    console.log("--- 🕵️ DEEP RESEARCH: PLAYER STATS & METRICS ---");

    for (const name of players) {
        const id = await mlb.searchPerson(name);
        if (id) {
            const pitching = await mlb.getPlayerStats(id, 'pitching', '2024'); // Using 2024 for more reliable baseline
            const hitting = await mlb.getPlayerStats(id, 'hitting', '2024');
            console.log(`\n👤 ${name}:`);
            if (pitching) console.log(`   ⚾ Pitching: ERA: ${pitching.era}, WHIP: ${pitching.whip}, SO/9: ${pitching.strikeOutsPer9Inn}`);
            if (hitting) console.log(`   🏏 Hitting: AVG: ${hitting.avg}, OPS: ${hitting.ops}, HR: ${hitting.homeRuns}`);
        } else {
            console.log(`\n👤 ${name}: Not found.`);
        }
    }

    // Also check for team-level "Hot Bats" (leaders)
    const teams = [144, 109, 121, 137]; // Braves, D-backs, Mets, Giants (IDs from API or search)
    // Actually I'll just use the IDs from the previous run if I had them.
    // I'll search for team IDs.
}

research();
