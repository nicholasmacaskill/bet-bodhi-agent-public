
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer } from '../../src/lib/pillar-analyzer';
import { OddsApi } from '../../src/lib/odds-api';
import { KBOApi } from '../../src/lib/kbo-api';
import { KBOPillarAnalyzer } from '../../src/lib/kbo-pillar-analyzer';
import { PolymarketApi } from '../../src/lib/polymarket-api';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AgentMemory } from '../../src/lib/agent/memory';
dotenv.config();

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuna Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodriguez", "Bryce Harper", "Adley Rutschman",
    "Gunnar Henderson", "Corbin Carroll", "Francisco Lindor", "Trea Turner", "José Ramírez"
];

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const oddsApi = new OddsApi();
    const today = process.argv[2] || new Date().toISOString().split('T')[0]; // Auto-detect or use arg

    console.log(`\n──────────────────────────────────────────────────────────────────────`);
    console.log(`🛡️  BODHI-8 NIGHTLY SOVEREIGN SCAN: ${today}`);
    console.log(`──────────────────────────────────────────────────────────────────────\n`);

    try {
        const memory = new AgentMemory();
        await memory.loadMemory();

        const [games, marketOdds] = await Promise.all([
            mlb.getSchedule(today),
            oddsApi.getMLBOdds()
        ]);

        const results: any[] = [];
        for (const game of games) {
            if (game.status.includes('Final') || game.status.includes('Postponed') || game.status.includes('Completed')) continue;
            
            const hydrated = await mlb.getHydratedAnalysisData(game);
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
                        outcomePrices: h2h.outcomes.map((oc: any) => (1 / oc.price).toFixed(3))
                    };
                }
            }

            const analysis = analyzer.analyzeGame(game, hydrated.details, polyMarketData, [...hydrated.homeHot, ...hydrated.awayHot], [], hydrated.playerStats, 800, hydrated.rosters, memory, hydrated.platoonSplits, hydrated.bullpenFatigue, hydrated.lineupHandedness);

            const evFactor = (analysis.polyEV || 0) * 10;
            const unifiedAlpha = (analysis.overallConfidence / 10) + evFactor;

            results.push({
                ...analysis,
                time: game.date,
                structuralMismatch: (analysis.overallConfidence / 10).toFixed(1), // Reuse confidence as strength proxy
                unifiedAlpha
            });
        }

        results.sort((a, b) => b.unifiedAlpha - a.unifiedAlpha);

        // Generate the Markdown Report
        let report = `# 🛡️ BODHI-8 SOVEREIGN SCAN REPORT: ${today}\n\n`;
        report += `Generated at: ${new Date().toLocaleString()}\n\n`;
        report += `## 🌟 SLATE RANKINGS (ALL GAMES)\n\n`;
        report += `| Rank | Matchup | Time (UTC) | Alpha | Target | Market EV | Strength |\n`;
        report += `| :--- | :--- | :--- | :--- | :--- | :---: | :---: |\n`;

        results.forEach((r, i) => {
            const startTime = new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            const evStr = r.polyEV !== undefined ? `${(r.polyEV * 100).toFixed(1)}%` : 'N/A';
            report += `| ${i+1} | ${r.awayTeam} @ ${r.homeTeam} | ${startTime} | **${r.unifiedAlpha.toFixed(2)}** | ${r.valueTeam || 'NEUTRAL'} | ${evStr} | ${r.structuralMismatch} |\n`;
        });

        report += `\n---\n\n## 🎯 DETAILED ANALYSIS\n\n`;

        results.forEach((r, i) => {
            const startTime = new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            report += `### ${i+1}. ${r.awayTeam} @ ${r.homeTeam} (${startTime} UTC)\n`;
            report += `- **Target**: ${r.valueTeam || 'NEUTRAL'} | **Alpha**: ${r.unifiedAlpha.toFixed(2)}\n`;
            report += `- **Analysis**: ${r.recommendedAction}\n`;
            if (r.advantages && r.advantages.length > 0) {
                report += `- **Strengths**:\n`;
                r.advantages.forEach((adv: string) => report += `  - ${adv}\n`);
            }
            if (r.killCriteria && r.killCriteria.length > 0) {
                report += `- **Kill Criteria**:\n`;
                r.killCriteria.forEach((kill: string) => report += `  - ${kill}\n`);
            }
            report += `\n`;
        });

        // ─── KBO SCAN ───────────────────────────────────────────────────────────
        try {
            const kbo = new KBOApi();
            const kboAnalyzer = new KBOPillarAnalyzer();
            const poly = new PolymarketApi();

            const kboGames = await kbo.getSchedule(today);
            const kboTeamStats = await kbo.getTeamStats();
            const kboElite = kbo.getElitePitchers();
            const kboWeak = kbo.getWeakPitchers();

            // Fetch all KBO markets from Polymarket using the correct method
            const allKboMarkets = await poly.getActiveSportsMarkets('KBO');

            const kboResults: any[] = [];
            for (const game of kboGames) {
                // Match game to Polymarket market by looking for both team names in the question
                const polyMatch = allKboMarkets.find((m: any) => {
                    const q = (m.question || '').toLowerCase();
                    const homeWords = game.homeTeam.toLowerCase().split(' ');
                    const awayWords = game.awayTeam.toLowerCase().split(' ');
                    return homeWords.some((w: string) => q.includes(w)) && awayWords.some((w: string) => q.includes(w));
                });

                let polyMarketData = undefined;
                if (polyMatch && polyMatch.outcomes) {
                    polyMarketData = {
                        conditionId: polyMatch.conditionId,
                        outcomes: polyMatch.outcomes,
                        outcomePrices: polyMatch.outcomePrices
                    };
                }

                const analysis = kboAnalyzer.analyzeGame(game, kboTeamStats, polyMarketData, kboElite, kboWeak, 800);
                const evFactor = (analysis.polyEV || 0) * 10;
                const unifiedAlpha = (analysis.overallConfidence / 10) + evFactor;

                kboResults.push({ ...analysis, time: game.startTime, unifiedAlpha });
            }

            kboResults.sort((a: any, b: any) => b.unifiedAlpha - a.unifiedAlpha);

            if (kboResults.length > 0) {
                report += `\n---\n\n## ⚾ KBO SIGNALS (Korea Baseball Organization)\n\n`;
                report += `| Rank | Matchup | Time (UTC) | Alpha | Target | Market EV |\n`;
                report += `| :--- | :--- | :--- | :--- | :--- | :---: |\n`;

                kboResults.forEach((r: any, i: number) => {
                    const startTime = new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                    const evStr = r.polyEV !== undefined ? `${(r.polyEV * 100).toFixed(1)}%` : 'N/A';
                    report += `| ${i+1} | ${r.awayTeam} @ ${r.homeTeam} | ${startTime} | **${r.unifiedAlpha.toFixed(2)}** | ${r.valueTeam || 'NEUTRAL'} | ${evStr} |\n`;
                });

                report += `\n`;
                kboResults.slice(0, 3).forEach((r: any, i: number) => {
                    const startTime = new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                    report += `### KBO ${i+1}. ${r.awayTeam} @ ${r.homeTeam} (${startTime} UTC)\n`;
                    report += `- **Target**: ${r.valueTeam || 'NEUTRAL'} | **Alpha**: ${r.unifiedAlpha.toFixed(2)}\n`;
                    report += `- **Analysis**: ${r.recommendedAction}\n`;
                    if (r.advantages && r.advantages.length > 0) {
                        report += `- **Strengths**:\n`;
                        r.advantages.forEach((adv: string) => report += `  - ${adv}\n`);
                    }
                    report += `\n`;
                });
            }
        } catch (kboErr) {
            console.error('KBO scan failed (non-fatal):', kboErr);
        }
        // ─── END KBO SCAN ───────────────────────────────────────────────────────

        const reportPath = path.join(process.cwd(), 'reports', `BODHI_SOVEREIGN_REPORT_${today}.md`);
        fs.writeFileSync(reportPath, report);
        console.log(`✅ Nightly report generated: ${reportPath}`);

        // --- Telegram Notification ---
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_ID) {
            let tgSummary = `🛡️ *BODHI-8 NIGHTLY SOVEREIGN REPORT: ${today}*\n\n`;
            tgSummary += `🔥 *TOP GOLDEN SNIPERS:*\n`;
            
            results.slice(0, 5).forEach((r, i) => {
                const startTime = new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
                const alpha = r.unifiedAlpha.toFixed(2);
                const ev = r.polyEV !== undefined ? `(+${(r.polyEV * 100).toFixed(1)}% EV)` : '';
                tgSummary += `${i+1}. [${startTime}] *${r.valueTeam || 'Neutral'}* vs ${r.valueTeam === r.homeTeam ? r.awayTeam : r.homeTeam} | Alpha: *${alpha}* ${ev}\n`;
            });

            tgSummary += `\n📄 _Full analysis saved to codebase root._`;

            try {
                const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
                await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: process.env.TELEGRAM_ADMIN_ID,
                        text: tgSummary,
                        parse_mode: 'Markdown'
                    })
                });
                console.log(`📡 Telegram notification sent to admin.`);
            } catch (err) {
                console.error(`❌ Telegram push failed:`, err);
            }
        }

    } catch (e) {
        console.error("FATAL CRASH:", e);
    }
}

function detailsToPitcher(p: any): string {
    if (!p) return "";
    if (typeof p === 'string') return p;
    return p.fullName || p.name || "";
}

main();
