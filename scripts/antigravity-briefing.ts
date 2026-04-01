
import 'dotenv/config';
import { BodhiAgent } from '../src/lib/agent/bodhi-agent';

async function morningBriefing() {
    const agent = new BodhiAgent();
    // Using current date from system context
    const today = '2026-03-17';

    try {
        const results = await agent.awaken(today);
        console.log(`\n=====================================================`);
        console.log(`   🎯 BODHI CONVICTION LOG: ${today}   `);
        console.log(`=====================================================\n`);

        const allPlays = [...results.mlb, ...results.nhl].sort((a, b) => b.overallConfidence - a.overallConfidence);

        if (allPlays.length === 0) {
            console.log("No high-confidence plays identified for today's slate.");
        } else {
            allPlays.forEach((play, i) => {
                const sportIcon = play.sport === 'MLB' ? '⚾' : '🏒';
                console.log(`${i+1}. [${play.overallConfidence}%] ${sportIcon} ${play.awayTeam} @ ${play.homeTeam}`);
                console.log(`   Rec: ${play.recommendedAction}`);
                console.log(`   Model Detail: ${play.pillars[0]?.reason || 'Edge detected'}`);
                console.log(`-----------------------------------------------------`);
            });
        }
    } catch (e) {
        console.error("Briefing failed:", e);
    }
}

morningBriefing();
