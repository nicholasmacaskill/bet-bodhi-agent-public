
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';
import { OddsApi } from '../../src/lib/odds-api';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const oddsApi = new OddsApi();
    
    const today = '2026-04-04';
    console.log(`\n──────────────────────────────────────────────────────────────────────`);
    console.log(`🛡️  BODHI-8 SOVEREIGN SNIPER: MLB VALUE SCAN — ${today}`);
    console.log(`──────────────────────────────────────────────────────────────────────\n`);

    try {
        console.log("Fetching MLB Schedule & Live Odds...");
        const [games, marketOdds] = await Promise.all([
            mlb.getSchedule(today),
            oddsApi.getMLBOdds()
        ]);

        if (games.length === 0) {
            console.log("No games scheduled for today.");
            return;
        }

        const results: any[] = [];

        for (const game of games) {
            // Only analyze games that haven't started or are still in early innings
            if (game.status.includes('Final') || game.status.includes('Postponed') || game.status.includes('Completed')) continue;

            try {
                process.stdout.write(`Analyzing ${game.awayTeam} @ ${game.homeTeam}... `);
                const hydrated = await mlb.getHydratedAnalysisData(game);
                
                // Find matching market odds
                const polyMatch = marketOdds.find((o: any) => 
                    (o.home_team.includes(game.homeTeam) || game.homeTeam.includes(o.home_team)) &&
                    (o.away_team.includes(game.awayTeam) || game.awayTeam.includes(o.away_team))
                );

                // Convert Odds API format to Pillar format
                let polyMarketData = undefined;
                if (polyMatch) {
                    const h2h = polyMatch.bookmakers[0]?.markets.find((m: any) => m.key === 'h2h');
                    if (h2h) {
                        polyMarketData = {
                            conditionId: polyMatch.id,
                            outcomes: h2h.outcomes.map((oc: any) => oc.name),
                            // Convert decimal odds to implied probability for the analyzer
                            outcomePrices: h2h.outcomes.map((oc: any) => (1 / oc.price).toFixed(3))
                        };
                    }
                }

                const analysis = analyzer.analyzeGame(
                    game,
                    hydrated.details,
                    polyMarketData,
                    [...hydrated.homeHot, ...hydrated.awayHot],
                    [],
                    hydrated.playerStats,
                    464,
                    hydrated.rosters
                );

                results.push(analysis);
                process.stdout.write(`✅ Done\n`);
            } catch (e: any) {
                process.stdout.write(`❌ Failed: ${e.message}\n`);
            }
        }

        // Sort by overall confidence
        results.sort((a, b) => b.overallConfidence - a.overallConfidence);

        const marketCoverage = results.filter(r => r.executionRoute === 'POLY').length;
        console.log(`\nMarket Coverage: ${marketCoverage}/${results.length} games have live odds.`);

        console.log(`\n=============================================================`);
        console.log(`        🎯 BODHI-8 VALUE REPORT: APRIL 4, 2026            `);
        console.log(`=============================================================`);

        const topPicks = results.slice(0, 5);
        
        if (topPicks.length === 0) {
            console.log("\nNo games analyzed.");
        } else {
            topPicks.forEach((r, i) => {
                let badge = "⚪ [LOW CONVICTION]";
                if (r.overallConfidence >= 80) badge = "🔥🔥🔥 [SOVEREIGN SNIPER]";
                else if (r.overallConfidence >= 75) badge = "🔥 [HIGH CONVICTION]";
                else if (r.overallConfidence >= 65) badge = "💎 [VALUE PLAY]";
                else if (r.overallConfidence >= 55) badge = "📈 [TECHNICAL LEAN]";

                console.log(`\n${i + 1}. ${badge}`);
                console.log(`   MATCHUP: ${r.awayTeam} @ ${r.homeTeam}`);
                console.log(`   LEAN:    ${(r.valueTeam || 'NEUTRAL').toUpperCase()} | Confidence: ${r.overallConfidence}%`);
                console.log(`   PITCHERS: ${r.awayPitcher} vs ${r.homePitcher}`);
                console.log(`   ANALYSIS: ${r.recommendedAction}`);
                if (r.valueTeam) {
                    console.log(`   SIZE:    ${r.recommendedSize} ($${r.suggestedStake.toFixed(2)})`);
                }
                if (r.advantages && r.advantages.length > 0) {
                    console.log(`   STRENGTHS:`);
                    r.advantages.slice(0, 2).forEach((adv: string) => console.log(`    - ${adv}`));
                }
            });
        }
        console.log(`\n=============================================================`);
        console.log(`NOTE: If No 'Sovereign Sniper' signals are present, the system `);
        console.log(`recommends FLAT BETTING or PASSING to preserve bankroll.`);
        console.log(`=============================================================`);


    } catch (e) {
        console.error("FATAL CRASH:", e);
    }
}

main();
