import { EspnOddsApi } from './src/lib/espn-odds-api';
import { PillarAnalyzer } from './src/lib/pillar-analyzer';

async function main() {
    const espn = new EspnOddsApi();
    const analyzer = new PillarAnalyzer();
    
    console.log("Fetching Jays vs Yankees via ESPN...");
    const games = await espn.getOdds('baseball/mlb');
    const game = games.find(g => 
        (g.homeTeam.toLowerCase().includes('yankees') && g.awayTeam.toLowerCase().includes('blue jays')) ||
        (g.awayTeam.toLowerCase().includes('yankees') && g.homeTeam.toLowerCase().includes('blue jays'))
    );

    if (!game) {
        console.log("No Jays @ Yankees game found on ESPN.");
        return;
    }

    console.log(`Found Matchup: ${game.awayTeam} @ ${game.homeTeam}`);
    
    // Run 7-Pillar Analysis
    // Note: PillarAnalyzer usually expects a specific game object format. 
    // We'll mock the minimal required fields for the breakdown.
    const analysis = await analyzer.analyzeGame({
        homeTeam: game.homeTeam,
        awayTeam: game.awayTeam,
        gamePk: 0, // Mocked for calculation
        date: new Date().toISOString(),
        status: 'Scheduled',
        venue: 'Spring Training'
    }, { h2h: { [game.homeTeam]: 1.6, [game.awayTeam]: 2.3 } });

    console.log("Analysis Result:", JSON.stringify(analysis, null, 2));
}

main().catch(console.error);
