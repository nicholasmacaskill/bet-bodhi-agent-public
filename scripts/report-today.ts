import 'dotenv/config';
import { BodhiAgent } from '../src/lib/agent/bodhi-agent';
import { MLBApi } from '../src/lib/mlb-api';
import { NHLApi } from '../src/lib/nhl-api';
import { PillarAnalyzer } from '../src/lib/pillar-analyzer';
import { NHLPillarAnalyzer } from '../src/lib/nhl-pillar-analyzer';

async function generateReport() {
    const agent = new BodhiAgent();
    const today = new Date().toISOString().split('T')[0];

    console.log(`\n====================================================`);
    console.log(`   🌅 BET BODHI: DAILY BRIEFING - ${today}   `);
    console.log(`====================================================\n`);

    try {
        // Awaken the agent
        const results = await agent.awaken(today);

        console.log(`\n--- 🛡️  PSYCHOMETRIC GUARDIAN STATUS ---`);
        // The awaken() method logs things to console already, but we can summarize
        console.log(`Goal for Today: "Neutral Execution"`);

        console.log(`\n--- 📊 MARKET SCAN SUMMARY ---`);
        console.log(`MLB Opportunities: ${results.mlb.length}`);
        console.log(`NHL Opportunities: ${results.nhl.length}`);

        if (results.mlb.length > 0) {
            console.log(`\n⚾ TOP MLB SIGNALS:`);
            results.mlb.slice(0, 3).forEach((res: any, idx: number) => {
                console.log(`${idx + 1}. [${res.overallConfidence}%] ${res.awayTeam} @ ${res.homeTeam}`);
                console.log(`   Action: ${res.recommendedAction}`);
                console.log(`   Reason: ${res.pillars[0]?.reason || 'High conviction signal'}`);
            });
        }

        if (results.nhl.length > 0) {
            console.log(`\n🏒 TOP NHL SIGNALS:`);
            results.nhl.slice(0, 3).forEach((res: any, idx: number) => {
                console.log(`${idx + 1}. [${res.overallConfidence}%] ${res.awayTeam} @ ${res.homeTeam}`);
                console.log(`   Action: ${res.recommendedAction}`);
                console.log(`   Reason: ${res.pillars.find((p: any) => p.pillar === 'Technical (Sport)')?.reason || 'Strong technical edge'}`);
            });
        }

        console.log(`\n====================================================`);
        console.log(`   MISSION: Master the slate via AI Guardians.   `);
        console.log(`====================================================\n`);

    } catch (e) {
        console.error("Failed to generate today's report:", e);
    }
}

generateReport();
