import { NHLApi } from './src/lib/nhl-api';
import { NHLPillarAnalyzer } from './src/lib/nhl-pillar-analyzer';
import 'dotenv/config';

async function analyzePuckLine() {
    const nhl = new NHLApi();
    const analyzer = new NHLPillarAnalyzer();
    const date = '2026-03-10';

    const [games, nhlStats, goalieLeaders] = await Promise.all([
        nhl.getSchedule(date),
        nhl.getTeamStats(),
        nhl.getGoalieLeaders()
    ]);

    const game = games.find(g => g.homeTeam.includes("Stars") || g.awayTeam.includes("Stars"));
    if (!game) return;

    const landing = await nhl.getGameLanding(game.id);
    const goalieSeasonStats = landing?.matchup?.goalieSeasonStats;

    // Manual Market Injection since string matching can be finicky for puck lines
    const puckLineMarket = {
        conditionId: "0xb5fadcbfc38833d23e7699a5f155539aab08d2daf7e70c9052e7330e18cfc17f",
        outcomes: ["Dallas Stars -1.5", "Vegas Golden Knights +1.5"],
        outcomePrices: ["0.355", "0.645"],
        category: "NHL" // Ensure category matches
    };

    // Force the homePrice since it's Stars -1.5
    const analysis = analyzer.analyzeGame(game, nhlStats, puckLineMarket, goalieLeaders, goalieSeasonStats);
    
    // The analyzer calculates ML prob. For Puck Line, we need to adjust.
    // Stars ML prob was ~60% in Bodhi logic.
    // Stars -1.5 price is 0.355.
    
    console.log("--- STARS -1.5 PUCK LINE ANALYSIS ---");
    console.log(`Action: ${analysis.recommendedAction}`);
    console.log(`Pillars:`);
    analysis.pillars.forEach(p => console.log(`- ${p.pillar}: ${p.score} (${p.reason})`));
}

analyzePuckLine();
