/**
 * NHL Analysis Orchestrator for Hockey Underdogs
 */

import 'dotenv/config';
import { NHLApi } from '../src/lib/nhl-api';
import { PolymarketApi } from '../src/lib/polymarket-api';
import { NHLPillarAnalyzer } from '../src/lib/nhl-pillar-analyzer';

async function analyzeNHL() {
    const nhl = new NHLApi();
    const polySvc = new PolymarketApi();
    const analyzer = new NHLPillarAnalyzer();
    const today = '2026-03-03';

    console.log(`\n====================================================`);
    console.log(`   BODHI NHL +EV ENGINE: ANALYZING HOCKEY ${today}  `);
    console.log(`====================================================\n`);

    try {
        console.log("-> Fetching live NHL schedule...");
        const games = await nhl.getSchedule(today);
        console.log(`   Found ${games.length} games.\n`);

        console.log("-> Fetching team stats & goalie leaders...");
        const teamStats = await nhl.getTeamStats();
        const goalieLeaders = await nhl.getGoalieLeaders();

        console.log("-> Fetching Web3 probabilities from Polymarket...");
        const polyMarkets = await polySvc.getActiveSportsMarkets("vs.");
        console.log(`   Synced ${polyMarkets.length} active Polymarket conditions.\n`);

        const results = [];

        for (const game of games) {
            // Extract team mascots (e.g., "Los Angeles Kings" -> "kings")
            const homeMascot = game.homeTeam.split(' ').pop()?.toLowerCase() || "";
            const awayMascot = game.awayTeam.split(' ').pop()?.toLowerCase() || "";

            // Find corresponding Polymarket Condition for this exact NHL game
            const polyCondition = polyMarkets.find(m =>
                (m.question.toLowerCase().includes(homeMascot) || m.description.toLowerCase().includes(homeMascot)) &&
                (m.question.toLowerCase().includes(awayMascot) || m.description.toLowerCase().includes(awayMascot))
            );

            const analysis = analyzer.analyzeGame(game, teamStats, polyCondition, goalieLeaders);
            results.push(analysis);
        }

        // 1. Sort by confidence (Standard output)
        const sortedResults = [...results].sort((a, b) => (b.overallConfidence || 0) - (a.overallConfidence || 0));

        // 2. Identify High-EV Underdogs or Web3 Arbitrage Opportunities
        const valuePlays = results.filter(r => r.valueTeam && r.polyEV !== undefined && r.polyEV > 0);

        console.log("\n====================================================");
        console.log("          TOP NHL +EV OPPORTUNITIES - tonight       ");
        console.log("====================================================\n");

        sortedResults.slice(0, 5).forEach((res, index) => {
            const star = res.overallConfidence >= 80 ? "🔥" : res.overallConfidence >= 70 ? "⭐️" : "  ";
            console.log(`${index + 1}. [Bodhi Score: ${res.overallConfidence}%] ${star} ${res.awayTeam} @ ${res.homeTeam}`);
            console.log(`   Recommendation: ${res.recommendedAction}`);
            console.log(`   Sizing Profile: ${res.recommendedSize} ($450 bankroll: $${(res.suggestedStake).toFixed(2)})`);

            if (res.polyConditionId) {
                console.log(`   Web3 Polymarket Value: ${res.valueTeam ? `Buy ${res.valueTeam.toUpperCase()} Shares at $${res.polySharePrice?.toFixed(2)}` : "No Edge"}`);
                console.log(`   Condition ID: ${res.polyConditionId}`);
            } else {
                console.log(`   Web3 Polymarket Value: No market found for this game.`);
            }

            res.pillars.forEach(p => {
                if (p.score >= 8 || p.pillar === "Technical (Sport)" || p.pillar === "Market Sentiment (Web3)") {
                    console.log(`   💎 ${p.pillar}: ${p.score}/10 - ${p.reason}`);
                }
            });
            console.log("\n----------------------------------------------------\n");
        });

        if (valuePlays.length > 0) {
            console.log("\n🚨 BODHI RADAR: WEB3 ARBITRAGE PLAYS DETECTED 🚨\n");
            valuePlays.forEach(res => {
                console.log(`✔️ Buy ${res.valueTeam?.toUpperCase()} ($${res.polySharePrice?.toFixed(2)} / ${res.awayTeam} @ ${res.homeTeam})`);
                console.log(`   Pillar: Market Sentiment (Web3) - MASSIVE +EV (${((res.polyEV || 0) * 100).toFixed(1)}%)`);
                console.log(`   Stake: $${res.suggestedStake.toFixed(2)} (${res.recommendedSize})`);
                console.log("");
            });
        }

    } catch (error) {
        console.error('NHL analysis failed:', error);
    }
}

analyzeNHL();
