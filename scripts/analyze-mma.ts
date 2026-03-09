import { MMAApi } from '../src/lib/mma-api';
import { MMAPillarAnalyzer } from '../src/lib/mma-pillar-analyzer';
import { OddsApi } from '../src/lib/odds-api';
import * as dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log("====================================================");
    console.log("   BODHI MMA +EV ENGINE: ANALYZING UFC MEXICO      ");
    console.log("====================================================");

    const mma = new MMAApi();
    const analyzer = new MMAPillarAnalyzer();
    const oddsApi = new OddsApi();

    try {
        console.log("\n-> Fetching UFC Event Data...");
        const events = await mma.getUpcomingEvents();
        const event = events[0]; // UFC Mexico City
        console.log(`\n🏟️  ${event.name}`);
        console.log(`📍 ${event.location}`);

        console.log("\n-> Syncing fighter profiles...");
        const fighterStats = await mma.getFighterStats();

        console.log("-> Fetching market odds...");
        const oddsList = await oddsApi.getMMAOdds();
        console.log(`   Synced odds for ${oddsList.length} markets.`);

        const results = [];
        for (const fight of event.mainCard) {
            const analysis = analyzer.analyzeFight(fight, fighterStats, oddsList);
            results.push(analysis);
        }

        // Sort by confidence
        results.sort((a, b) => b.overallConfidence - a.overallConfidence);

        console.log("\n====================================================");
        console.log("          TOP MMA +EV OPPORTUNITIES - tonight       ");
        console.log("====================================================");

        results.forEach((res, index) => {
            const star = res.overallConfidence >= 80 ? "⭐️ " : "   ";
            console.log(`\n${index + 1}. [${res.overallConfidence}%] ${star}${res.awayTeam} vs ${res.homeTeam}`);
            console.log(`   Recommendation: ${res.recommendedAction}`);
            console.log(`   Sizing Profile: ${res.recommendedSize} ($450 bankroll: $${res.suggestedStake.toFixed(2)})`);

            if (res.valueTeam && res.valueOdds) {
                console.log(`   Market Value: ${res.valueTeam} ML @ ${res.valueOdds}`);
            } else {
                console.log(`   Market Value: Fair Market`);
            }

            res.pillars.forEach(p => {
                const icon = p.score >= 8 ? "💎" : "⚪️";
                console.log(`   ${icon} ${p.pillar}: ${p.score}/10 - ${p.reason}`);
            });
            console.log("\n----------------------------------------------------");
        });

        const highConviction = results.filter(r => r.overallConfidence >= 75);
        if (highConviction.length > 0) {
            console.log("\n🚨 BODHI RADAR: MMA VALUE SPOTTED 🚨");
            highConviction.forEach(r => {
                if (r.valueTeam && r.valueOdds) {
                    console.log(`\n✔️  ${r.valueTeam.toUpperCase()} ML @ ${r.valueOdds} (${r.awayTeam} vs ${r.homeTeam})`);
                    const p = r.pillars.find(p => p.pillar.includes("Bookies"));
                    console.log(`   Pillar: ${p?.pillar} ${p?.score}/10 - ${p?.reason}`);
                    console.log(`   Stake: $${r.suggestedStake.toFixed(2)} (${r.recommendedSize})`);
                }
            });
        }

    } catch (error) {
        console.error("Analysis Failed:", error);
    }
}

main();
