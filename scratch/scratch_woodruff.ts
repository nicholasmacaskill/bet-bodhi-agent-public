import { MLBApi } from './src/lib/mlb-api';

async function getWoodruffStats() {
    const mlb = new MLBApi();
    const name = "Brandon Woodruff";
    
    console.log(`Searching for ${name}...`);
    const id = await mlb.searchPerson(name);
    
    if (!id) {
        console.log("Could not find ID for Brandon Woodruff.");
        return;
    }
    
    console.log(`Found ID: ${id}`);
    
    // Fetch 2026 Spring Training stats (gameType 'S')
    const springStats = await mlb.getPlayerStats(id, 'pitching', '2026', 'S');
    const regStats = await mlb.getPlayerStats(id, 'pitching', '2024', 'R');

    console.log("\n--- BRANDON WOODRUFF DATA ---");
    console.log("2024 REGULAR SEASON:");
    console.log(`ERA: ${regStats?.era || 'N/A'}`);
    console.log(`WHIP: ${regStats?.whip || 'N/A'}`);
    
    console.log("\n2026 SPRING TRAINING (REHAB):");
    console.log(`ERA: ${springStats?.era || 'N/A'}`);
    console.log(`WHIP: ${springStats?.whip || 'N/A'}`);
    console.log(`Innings: ${springStats?.inningsPitched || 'N/A'}`);
    console.log(`Strikeouts: ${springStats?.strikeOuts || 'N/A'}`);
}

getWoodruffStats().catch(console.error);
