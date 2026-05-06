
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';

async function verify() {
    const mlb = new MLBApi();
    const pillar = new PillarAnalyzer();
    
    console.log("--- 🕵️ VERIFYING DUAL-STREAM FIX (70/30) ---");
    
    // Mocking a game with Bryan Woo (SEA) vs Reid Detmers (LAA)
    const mockGame: any = {
        gamePk: 123,
        awayTeam: "Seattle Mariners",
        homeTeam: "Los Angeles Angels",
        homeId: 108, // Angels
        awayId: 136, // Mariners
        probables: {
            away: "Bryan Woo",
            home: "Reid Detmers"
        }
    };

    const data = await mlb.getHydratedAnalysisData(mockGame);
    
    console.log(`\n👤 Bryan Woo (SEA) Composite Check:`);
    const wooStats = data.playerStats.get("Bryan Woo");
    if (wooStats) {
        const reg = parseFloat(wooStats.regular?.era || "4.0");
        const spr = parseFloat(wooStats.spring?.era || "4.0");
        const composite = (reg * 0.7) + (spr * 0.3);
        console.log(`   🔸 Regular (70%): ${reg}`);
        console.log(`   🔸 Spring (30%): ${spr}`);
        console.log(`   🔸 Composite: ${composite.toFixed(2)}`);
    } else {
        console.log("   ❌ Failed to fetch stats for Bryan Woo.");
    }

    console.log(`\n👤 Reid Detmers (LAA) Composite Check:`);
    const detmersStats = data.playerStats.get("Reid Detmers");
    if (detmersStats) {
        const reg = parseFloat(detmersStats.regular?.era || "4.0");
        const spr = parseFloat(detmersStats.spring?.era || "4.0");
        const composite = (reg * 0.7) + (spr * 0.3);
        console.log(`   🔸 Regular (70%): ${reg}`);
        console.log(`   🔸 Spring (30%): ${spr}`);
        console.log(`   🔸 Composite: ${composite.toFixed(2)}`);
    } else {
        console.log("   ❌ Failed to fetch stats for Reid Detmers.");
    }

    // Run the full analysis
    const analysis = pillar.analyzeGame(mockGame, data.details, undefined, data.homeHot.concat(data.awayHot), [], data.playerStats);
    console.log(`\n📢 FINAL ANALYSIS RESULT:`);
    console.log(`   🔸 BODHI-8 Score: ${analysis.overallConfidence.toFixed(1)}%`);
    console.log(`   🔸 Recommended Action: ${analysis.recommendedAction}`);
    
    analysis.advantages?.forEach(a => console.log(`   ├─ ${a}`));
}

verify();
