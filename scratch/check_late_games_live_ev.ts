import { MLBApi } from '../src/lib/mlb-api';
import { PillarAnalyzer } from '../src/lib/pillar-analyzer';
import { OddsApi } from '../src/lib/odds-api';
import { PolymarketApi } from '../src/lib/polymarket-api';
import { AgentMemory } from '../src/lib/agent/memory';
import 'dotenv/config';

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const oddsApi = new OddsApi();
    const poly = new PolymarketApi();
    const memory = new AgentMemory();
    await memory.loadMemory();

    const today = '2026-05-19';

    console.log("Checking current wallet balance on-chain...");
    const usdcBalance = await poly.getUSDCBalance();
    console.log(`Live USDC Balance: $${usdcBalance.toFixed(2)}`);

    console.log("\nFetching MLB games schedule and Odds API data...");
    const [games, marketOdds] = await Promise.all([
        mlb.getSchedule(today),
        oddsApi.getMLBOdds()
    ]);

    // Late games starting soon
    const lateMatchups = [
        { away: 'Giants', home: 'Diamondbacks' },
        { away: 'Athletics', home: 'Angels' },
        { away: 'White Sox', home: 'Mariners' },
        { away: 'Dodgers', home: 'Padres' }
    ];

    const lateGames = games.filter(g => {
        const home = g.homeTeam.toLowerCase();
        const away = g.awayTeam.toLowerCase();
        return lateMatchups.some(m => home.includes(m.home.toLowerCase()) && away.includes(m.away.toLowerCase()));
    });

    console.log(`\nFound ${lateGames.length} late games to analyze.`);

    for (const game of lateGames) {
        console.log(`\n--------------------------------------------------`);
        console.log(`⚾ MATCHUP: ${game.awayTeam} @ ${game.homeTeam}`);
        console.log(`   Status: ${game.status}`);
        
        // Match with Odds API bookmaker odds (just like report script does)
        const polyMatch = marketOdds.find((o: any) => 
            (o.home_team.includes(game.homeTeam) || game.homeTeam.includes(o.home_team)) &&
            (o.away_team.includes(game.awayTeam) || game.awayTeam.includes(o.away_team))
        );

        let polyMarketData = undefined;
        if (polyMatch) {
            const h2h = polyMatch.bookmakers[0]?.markets.find((m: any) => m.key === 'h2h');
            if (h2h) {
                polyMarketData = {
                    conditionId: polyMatch.id,
                    outcomes: h2h.outcomes.map((oc: any) => oc.name),
                    // convert decimal odds back to implied probabilities/prices
                    outcomePrices: h2h.outcomes.map((oc: any) => (1 / oc.price).toFixed(3))
                };
                console.log(`   Market Bookmaker Match Found: ${polyMatch.home_team} vs ${polyMatch.away_team}`);
                console.log(`   Outcomes: ${polyMarketData.outcomes.join(' / ')}`);
                console.log(`   Implied Probabilities: ${polyMarketData.outcomePrices.map(p => (parseFloat(p) * 100).toFixed(1) + '%').join(' / ')}`);
            }
        }

        const hydrated = await mlb.getHydratedAnalysisData(game);
        
        // Analyze game
        const analysis = analyzer.analyzeGame(
            game,
            hydrated.details,
            polyMarketData,
            [...hydrated.homeHot, ...hydrated.awayHot],
            [],
            hydrated.playerStats,
            800,
            hydrated.rosters,
            memory,
            hydrated.platoonSplits,
            hydrated.bullpenFatigue,
            hydrated.lineupHandedness
        );

        console.log(`   VALUE TEAM: ${analysis.valueTeam || 'NEUTRAL'}`);
        console.log(`   Overall Confidence:  ${analysis.overallConfidence}%`);
        
        if (polyMarketData && analysis.valueTeam) {
            const targetIndex = polyMarketData.outcomes.findIndex((o: string) => o.toLowerCase().includes(analysis.valueTeam!.toLowerCase()) || analysis.valueTeam!.toLowerCase().includes(o.toLowerCase()));
            const price = targetIndex !== -1 ? parseFloat(polyMarketData.outcomePrices[targetIndex]) : null;
            console.log(`   Market Price:    ${price !== null ? (price * 100).toFixed(1) + '%' : 'N/A'}`);
        } else {
            console.log(`   Market Price:    N/A`);
        }
        console.log(`   Market EV:       ${analysis.polyEV !== undefined ? (analysis.polyEV * 100).toFixed(1) + '%' : 'N/A'}`);
        console.log(`   Recommendation:  ${analysis.recommendedAction}`);
    }
}

main().catch(console.error);
