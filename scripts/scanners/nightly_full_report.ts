
import { MLBApi } from '../../src/lib/mlb-api';
import { PillarAnalyzer, computeUnifiedAlpha } from '../../src/lib/pillar-analyzer';
import { PolymarketApi } from '../../src/lib/polymarket-api';
import { loadSlateBook } from '../../src/lib/gateway/slate-book';
import { OddsComparison } from '../../src/lib/gateway/slate-resolver';
import { KBOApi } from '../../src/lib/kbo-api';
import { KBOPillarAnalyzer } from '../../src/lib/kbo-pillar-analyzer';

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { AgentMemory } from '../../src/lib/agent/memory';
import { db } from '../../src/lib/sqlite-client';
import crypto from 'crypto';
dotenv.config();

const ELITE_BATS = [
    "Shohei Ohtani", "Aaron Judge", "Ronald Acuna Jr.", "Mookie Betts", "Freddie Freeman",
    "Juan Soto", "Corey Seager", "Yordan Alvarez", "Matt Olson", "Kyle Tucker",
    "Mike Trout", "Bobby Witt Jr.", "Julio Rodriguez", "Bryce Harper", "Adley Rutschman",
    "Gunnar Henderson", "Corbin Carroll", "Francisco Lindor", "Trea Turner", "José Ramírez"
];

function formatOddsDelta(comparison?: OddsComparison): string {
    if (!comparison?.kickoff) return 'N/A';
    const sign = comparison.evDelta! >= 0 ? '+' : '';
    return `${sign}${(comparison.evDelta! * 100).toFixed(1)}%`;
}

async function main() {
    const mlb = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const { api: polyApi, resolver } = loadSlateBook();
    const today = process.argv[2] || new Date().toISOString().split('T')[0]; // Auto-detect or use arg

    console.log(`\n──────────────────────────────────────────────────────────────────────`);
    console.log(`🛡️  BODHI-8 NIGHTLY SOVEREIGN SCAN: ${today}`);
    console.log(`──────────────────────────────────────────────────────────────────────\n`);

    try {
        const memory = new AgentMemory();
        await memory.loadMemory();

        const [games, polyMarkets] = await Promise.all([
            mlb.getSchedule(today),
            resolver.loadSportsMarkets()
        ]);
        console.log(`  ✓ Synced ${polyMarkets.length} Polymarket sports markets (via SlateResolver + Gateway)`);

        const results: any[] = [];
        for (const game of games) {
            const done = ['Final', 'Postponed', 'Completed', 'Game Over', 'Cancelled'];
            if (done.some(s => game.status.includes(s))) continue;
            const inProgress = game.status.includes('In Progress') || game.status.includes('Delayed');
            
            const hydrated = await mlb.getHydratedAnalysisData(game);
            const polyMarketData = await resolver.resolveMoneyline(
                game.homeTeam,
                game.awayTeam,
                today,
                game.date
            ) || undefined;

            const analysis = analyzer.analyzeGame(
                game, hydrated.details, polyMarketData,
                [...hydrated.homeHot, ...hydrated.awayHot], [], hydrated.playerStats, 800,
                hydrated.rosters, memory, hydrated.platoonSplits, hydrated.bullpenFatigue,
                hydrated.lineupHandedness, hydrated.teamForm,
                game.series ?? hydrated.currentSeries, hydrated.seasonSeries, hydrated.playoffContext
            );

            const unifiedAlpha = computeUnifiedAlpha(analysis.overallConfidence, analysis.polyEV);

            let oddsComparison: OddsComparison | undefined;
            if (polyMarketData && analysis.valueTeam) {
                oddsComparison = await resolver.compareOdds(
                    polyMarketData,
                    game.homeTeam,
                    game.awayTeam,
                    analysis.valueTeam,
                    analysis.overallConfidence,
                    game.date
                ) || undefined;
            }

            results.push({
                ...analysis,
                time: game.date,
                gameStatus: game.status,
                liveScore: game.score,
                inProgress,
                structuralMismatch: (analysis.overallConfidence / 10).toFixed(1),
                unifiedAlpha,
                oddsComparison
            });
        }

        // --- Daily Underdog Upset Play detection ---
        const underdogPlays: {
            game: any;
            underdogTeam: string;
            underdogOdds: number;
            bodhiProb: number;
            coexistingFactors: string[];
        }[] = [];

        for (const r of results) {
            let underdogTeam = '';
            let underdogOdds = 0;

            // Resolve pre-game/kickoff odds instead of live odds
            let homePreGameOdds = r.homeOdds;
            let awayPreGameOdds = r.awayOdds;

            if (r.oddsComparison?.kickoff) {
                const kickoffPriceForValueTeam = r.oddsComparison.kickoff.price;
                if (r.valueTeam === r.homeTeam) {
                    homePreGameOdds = kickoffPriceForValueTeam;
                    awayPreGameOdds = 1 - kickoffPriceForValueTeam;
                } else if (r.valueTeam === r.awayTeam) {
                    awayPreGameOdds = kickoffPriceForValueTeam;
                    homePreGameOdds = 1 - kickoffPriceForValueTeam;
                }
            }

            if (homePreGameOdds !== undefined && awayPreGameOdds !== undefined) {
                if (homePreGameOdds < 0.50) {
                    underdogTeam = r.homeTeam;
                    underdogOdds = homePreGameOdds;
                } else if (awayPreGameOdds < 0.50) {
                    underdogTeam = r.awayTeam;
                    underdogOdds = awayPreGameOdds;
                }
            }

            if (underdogTeam) {
                let bodhiProb = 0.50;
                if (r.valueTeam === underdogTeam) {
                    bodhiProb = r.overallConfidence / 100;
                } else if (r.valueTeam && r.valueTeam !== 'NEUTRAL') {
                    bodhiProb = 1 - (r.overallConfidence / 100);
                }

                const coexisting: string[] = [];
                const advantagesStr = (r.advantages || []).join(' ').toLowerCase();
                const risksStr = (r.risks || []).join(' ').toLowerCase();
                const notesStr = (r.matchupNotes || '').toLowerCase();

                if (advantagesStr.includes('sweep avoidance')) {
                    coexisting.push('Sweep Avoidance (underdog motivation to avoid sweep)');
                }
                if (advantagesStr.includes('offensive surge') || advantagesStr.includes('heater') || advantagesStr.includes('hot bat')) {
                    coexisting.push('Offensive Surge (underdog lineup contains hot/active hitters)');
                }
                if (risksStr.includes('slumping pitcher') || risksStr.includes('weak pitcher') || notesStr.includes('weak pitcher') || advantagesStr.includes('weak pitcher')) {
                    coexisting.push('Opponent Starter Slumping/Weak');
                }
                if (advantagesStr.includes('memory boost')) {
                    coexisting.push('Agent Memory Boost (underdog team has historical profitability)');
                }

                if (coexisting.length > 0) {
                    underdogPlays.push({
                        game: r,
                        underdogTeam,
                        underdogOdds,
                        bodhiProb,
                        coexistingFactors: coexisting
                    });
                }
            }
        }

        // Sort by bodhiProb descending
        underdogPlays.sort((a, b) => b.bodhiProb - a.bodhiProb);

        // Apply Alpha Boost to top 2
        if (underdogPlays.length > 0) {
            const play1 = underdogPlays[0];
            play1.game.isUnderdogPlayOfTheDay = true;
            play1.game.underdogPlayRank = 1;
            play1.game.underdogTeam = play1.underdogTeam;
            play1.game.underdogCoexistingFactors = play1.coexistingFactors;
            play1.game.underdogProb = play1.bodhiProb;
            play1.game.underdogOdds = play1.underdogOdds;
            play1.game.unifiedAlpha += 1.5;
        }

        if (underdogPlays.length > 1) {
            const play2 = underdogPlays[1];
            play2.game.isUnderdogPlayOfTheDay = true;
            play2.game.underdogPlayRank = 2;
            play2.game.underdogTeam = play2.underdogTeam;
            play2.game.underdogCoexistingFactors = play2.coexistingFactors;
            play2.game.underdogProb = play2.bodhiProb;
            play2.game.underdogOdds = play2.underdogOdds;
            play2.game.unifiedAlpha += 0.75;
        }

        results.sort((a, b) => b.unifiedAlpha - a.unifiedAlpha);

        // Generate the Markdown Report
        const baseReportExists = fs.existsSync(path.join(process.cwd(), 'reports', `BODHI_SOVEREIGN_REPORT_${today}.md`));
        const gamesHaveStarted = results.some((r: any) => r.inProgress || ['Final', 'Completed', 'Game Over', 'Postponed'].some(s => (r.gameStatus || '').includes(s)));

        let reportTitle = `# 🛡️ BODHI-8 SOVEREIGN SCAN REPORT: ${today}\n\n`;
        if (baseReportExists && gamesHaveStarted) {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            reportTitle = `# 🛡️ BODHI-8 SOVEREIGN UPDATE REPORT: ${today} (Scan: ${hh}:${mm} Local)\n\n`;
        }

        let report = reportTitle;
        report += `Generated at: ${new Date().toLocaleString()}\n\n`;

        if (underdogPlays.length > 0) {
            report += `## 🐶 TOP UNDERDOG UPSET PLAYS OF THE DAY\n\n`;
            
            const play1 = underdogPlays[0];
            report += `### 🥇 Primary Underdog Play: ${play1.game.awayTeam} @ ${play1.game.homeTeam}\n`;
            report += `- **Underdog Target**: **${play1.underdogTeam}**\n`;
            report += `- **Polymarket Price**: ${(play1.underdogOdds * 100).toFixed(1)}¢ (Implied: ${(play1.underdogOdds * 100).toFixed(1)}%)\n`;
            report += `- **Bodhi True Prob**: ${(play1.bodhiProb * 100).toFixed(1)}%\n`;
            report += `- **Coexisting Factors**:\n`;
            play1.coexistingFactors.forEach((factor: string) => {
                report += `  - ${factor}\n`;
            });
            report += `*Note: Alpha score boosted by +1.5 due to high upset potential and coexisting factors.*\n\n`;

            if (underdogPlays.length > 1) {
                const play2 = underdogPlays[1];
                report += `### 🥈 Secondary Underdog Play: ${play2.game.awayTeam} @ ${play2.game.homeTeam}\n`;
                report += `- **Underdog Target**: **${play2.underdogTeam}**\n`;
                report += `- **Polymarket Price**: ${(play2.underdogOdds * 100).toFixed(1)}¢ (Implied: ${(play2.underdogOdds * 100).toFixed(1)}%)\n`;
                report += `- **Bodhi True Prob**: ${(play2.bodhiProb * 100).toFixed(1)}%\n`;
                report += `- **Coexisting Factors**:\n`;
                play2.coexistingFactors.forEach((factor: string) => {
                    report += `  - ${factor}\n`;
                });
                report += `*Note: Alpha score boosted by +0.75 due to high upset potential and coexisting factors.*\n\n`;
            }
            report += `---\n\n`;
        }

        report += `## 🌟 SLATE RANKINGS (ALL GAMES)\n\n`;
        const hasKickoffCompare = results.some((r: any) => r.oddsComparison?.kickoff);
        report += hasKickoffCompare
            ? `| Rank | Matchup | Time (UTC) | Alpha | Target | Live EV | EV Δ (since kickoff) | Strength |\n`
            : `| Rank | Matchup | Time (UTC) | Alpha | Target | Market EV | Strength |\n`;
        report += hasKickoffCompare
            ? `| :--- | :--- | :--- | :--- | :--- | :---: | :---: | :---: |\n`
            : `| :--- | :--- | :--- | :--- | :--- | :---: | :---: |\n`;

        results.forEach((r, i) => {
            const startTime = new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            const evStr = r.polyEV !== undefined ? `${(r.polyEV * 100).toFixed(1)}%` : 'N/A';
            let alphaStr = `**${r.unifiedAlpha.toFixed(2)}**`;
            let targetStr = r.valueTeam || 'NEUTRAL';
            if (r.underdogPlayRank === 1) {
                alphaStr = `**${r.unifiedAlpha.toFixed(2)}** (🥇)`;
                targetStr = (!r.valueTeam || r.valueTeam === 'NEUTRAL') ? `${r.underdogTeam} (🥇)` : r.valueTeam;
            } else if (r.underdogPlayRank === 2) {
                alphaStr = `**${r.unifiedAlpha.toFixed(2)}** (🥈)`;
                targetStr = (!r.valueTeam || r.valueTeam === 'NEUTRAL') ? `${r.underdogTeam} (🥈)` : r.valueTeam;
            }
            if (hasKickoffCompare) {
                const evDelta = formatOddsDelta(r.oddsComparison);
                report += `| ${i+1} | ${r.awayTeam} @ ${r.homeTeam} | ${startTime} | ${alphaStr} | ${targetStr} | ${evStr} | ${evDelta} | ${r.structuralMismatch} |\n`;
            } else {
                report += `| ${i+1} | ${r.awayTeam} @ ${r.homeTeam} | ${startTime} | ${alphaStr} | ${targetStr} | ${evStr} | ${r.structuralMismatch} |\n`;
            }
        });

        report += `\n---\n\n## 🎯 DETAILED ANALYSIS\n\n`;

        results.forEach((r, i) => {
            const startTime = new Date(r.time).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
            report += `### ${i+1}. ${r.awayTeam} @ ${r.homeTeam} (${startTime} UTC)\n`;
            if (r.underdogPlayRank === 1) {
                report += `**🥇 PRIMARY UNDERDOG UPSET PLAY OF THE DAY (+1.5 Alpha Boost)**\n`;
            } else if (r.underdogPlayRank === 2) {
                report += `**🥈 SECONDARY UNDERDOG UPSET PLAY OF THE DAY (+0.75 Alpha Boost)**\n`;
            }
            report += `- **Target**: ${r.valueTeam || 'NEUTRAL'} | **Alpha**: ${r.unifiedAlpha.toFixed(2)}\n`;
            if (r.inProgress) {
                report += `- **⚠️ In-Game Scan**: Score ${r.liveScore || 'live'} | Status: ${r.gameStatus}. Technical model is **pre-game only** — EV compares fixed pre-game confidence vs current market price, not live win probability.\n`;
            }
            report += `- **Analysis**: ${r.recommendedAction}\n`;
            
            const confidenceContrib = (r.overallConfidence / 10).toFixed(2);
            report += `- **Alpha Factors Breakdown**:\n`;
            report += `  - **Model Base (Confidence):** ${confidenceContrib} (from ${r.overallConfidence}%)\n`;
            if (r.polyEV !== undefined) {
                const evContrib = (r.polyEV * 10).toFixed(2);
                report += `  - **Market EV Premium:** +${evContrib} (from ${(r.polyEV * 100).toFixed(1)}% discrepancy)\n`;
            }
            if (r.pillars && r.pillars.length > 0) {
                const highPillars = r.pillars.filter((p: any) => p.score >= 7).sort((a: any, b: any) => b.score - a.score);
                if (highPillars.length > 0) {
                    report += `  - **Core Driving Pillars:**\n`;
                    highPillars.forEach((p: any) => {
                        report += `    - *${p.pillar} (${p.score}/10)*: ${p.reason}\n`;
                    });
                }
            }

            const { strengths, risks } = categorizeFactors(r.valueTeam, r.homeTeam, r.awayTeam, r.advantages || [], r.risks || []);
            if (strengths.length > 0) {
                report += `- **Strengths of going with chosen pick (${r.valueTeam || 'NEUTRAL'})**:\n`;
                strengths.forEach((adv: string) => report += `  - ${adv}\n`);
            }
            if (risks.length > 0) {
                report += `- **Risks in our model's projection**:\n`;
                risks.forEach((risk: string) => report += `  - ${risk}\n`);
            }
            
            if (r.matchupNotes) {
                report += `- **Matchup Summary**: ${r.matchupNotes}\n`;
            }

            if (r.oddsComparison?.kickoff) {
                const k = r.oddsComparison.kickoff;
                const l = r.oddsComparison.live;
                report += `- **Market Odds Movement** (Gateway + CLOB kickoff replay):\n`;
                report += `  - **Kickoff**: ${r.valueTeam} ${(k.price * 100).toFixed(1)}¢ → EV ${k.ev !== undefined ? `${(k.ev * 100).toFixed(1)}%` : 'N/A'} (α ${k.alpha?.toFixed(2) ?? 'N/A'})\n`;
                report += `  - **Live Now**: ${r.valueTeam} ${(l.price * 100).toFixed(1)}¢ → EV ${l.ev !== undefined ? `${(l.ev * 100).toFixed(1)}%` : 'N/A'} (α ${l.alpha?.toFixed(2) ?? 'N/A'})\n`;
                if (r.oddsComparison.evDelta !== undefined) {
                    const sign = r.oddsComparison.evDelta >= 0 ? '+' : '';
                    report += `  - **Δ Since Kickoff**: ${sign}${(r.oddsComparison.evDelta * 100).toFixed(1)}% EV`;
                    if (r.oddsComparison.alphaDelta !== undefined) {
                        report += `, ${sign}${r.oddsComparison.alphaDelta.toFixed(2)} alpha`;
                    }
                    report += `\n`;
                }
            }

            if (r.valueTeam && r.suggestedStake !== undefined) {
                report += `- **Execution Strategy**:\n`;
                report += `  - **Recommended Sizing**: ${r.recommendedSize}\n`;
                report += `  - **Suggested Stake**: $${r.suggestedStake.toFixed(2)}\n`;
                report += `  - **Execution Route**: ${r.executionRoute || 'NONE'}\n`;
                if (r.homeOdds && r.awayOdds) {
                    report += `  - **Market Pricing**: ${r.awayTeam} (${(r.awayOdds * 100).toFixed(1)}¢) vs ${r.homeTeam} (${(r.homeOdds * 100).toFixed(1)}¢)\n`;
                }
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
                const unifiedAlpha = computeUnifiedAlpha(analysis.overallConfidence, analysis.polyEV);

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
                    
                    const confidenceContrib = (r.overallConfidence / 10).toFixed(2);
                    report += `- **Alpha Factors Breakdown**:\n`;
                    report += `  - **Model Base (Confidence):** ${confidenceContrib} (from ${r.overallConfidence}%)\n`;
                    if (r.polyEV !== undefined) {
                        const evContrib = (r.polyEV * 10).toFixed(2);
                        report += `  - **Market EV Premium:** +${evContrib} (from ${(r.polyEV * 100).toFixed(1)}% discrepancy)\n`;
                    }
                    if (r.pillars && r.pillars.length > 0) {
                        const highPillars = r.pillars.filter((p: any) => p.score >= 7).sort((a: any, b: any) => b.score - a.score);
                        if (highPillars.length > 0) {
                            report += `  - **Core Driving Pillars:**\n`;
                            highPillars.forEach((p: any) => {
                                report += `    - *${p.pillar} (${p.score}/10)*: ${p.reason}\n`;
                            });
                        }
                    }

                    const { strengths, risks } = categorizeFactors(r.valueTeam, r.homeTeam, r.awayTeam, r.advantages || [], r.risks || []);
                    if (strengths.length > 0) {
                        report += `- **Strengths of going with chosen pick (${r.valueTeam || 'NEUTRAL'})**:\n`;
                        strengths.forEach((adv: string) => report += `  - ${adv}\n`);
                    }
                    if (risks.length > 0) {
                        report += `- **Risks in our model's projection**:\n`;
                        risks.forEach((risk: string) => report += `  - ${risk}\n`);
                    }

                    if (r.matchupNotes) {
                        report += `- **Matchup Summary**: ${r.matchupNotes}\n`;
                    }
        
                    if (r.valueTeam && r.suggestedStake !== undefined) {
                        report += `- **Execution Strategy**:\n`;
                        report += `  - **Recommended Sizing**: ${r.recommendedSize}\n`;
                        report += `  - **Suggested Stake**: $${r.suggestedStake.toFixed(2)}\n`;
                        report += `  - **Execution Route**: ${r.executionRoute || 'NONE'}\n`;
                        if (r.homeOdds && r.awayOdds) {
                            report += `  - **Market Pricing**: ${r.awayTeam} (${(r.awayOdds * 100).toFixed(1)}¢) vs ${r.homeTeam} (${(r.homeOdds * 100).toFixed(1)}¢)\n`;
                        }
                    }
        
                    if (r.killCriteria && r.killCriteria.length > 0) {
                        report += `- **Kill Criteria**:\n`;
                        r.killCriteria.forEach((kill: string) => report += `  - ${kill}\n`);
                    }

                    report += `\n`;
                });
            }
        } catch (kboErr) {
            console.error('KBO scan failed (non-fatal):', kboErr);
        }
        // ─── END KBO SCAN ───────────────────────────────────────────────────────

        let reportPath = path.join(process.cwd(), 'reports', `BODHI_SOVEREIGN_REPORT_${today}.md`);
        if (baseReportExists && gamesHaveStarted) {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            reportPath = path.join(process.cwd(), 'reports', `BODHI_SOVEREIGN_REPORT_${today}_UPDATE_${hh}${mm}.md`);
        }
        fs.writeFileSync(reportPath, report);
        console.log(`✅ Nightly report generated: ${reportPath}`);

        // Save snapshot for Watchdog
        const snapshotPath = path.join(process.cwd(), 'data', 'active_slate.json');
        fs.writeFileSync(snapshotPath, JSON.stringify(results, null, 2));
        console.log(`💾 Slate snapshot saved for Watchdog: ${snapshotPath}`); 

        // --- Persistence to local SQLite database ---
        console.log(`\n💾 Persisting daily predictions to local SQLite database...`);
        const scanType = (baseReportExists && gamesHaveStarted) ? 'LIVE_UPDATE' : 'PRE_GAME';
        const scanTime = new Date().toISOString();

        for (const r of results) {
            try {
                const pillarJson = JSON.stringify(r.pillars);
                const homeOdds = r.homeOdds !== undefined ? r.homeOdds : null;
                const awayOdds = r.awayOdds !== undefined ? r.awayOdds : null;
                const targetTeam = r.valueTeam || 'NEUTRAL';
                const alphaScore = r.unifiedAlpha;
                const underdogRank = r.underdogPlayRank || null;

                // For PRE_GAME, check if a PRE_GAME record exists to overwrite/update it.
                // For LIVE_UPDATE, we insert a new record to preserve history for each in-game scan/report.
                let existing = null;
                if (scanType === 'PRE_GAME') {
                    existing = db.prepare('SELECT id FROM betting_opportunities WHERE game_pk = ? AND game_date = ? AND scan_type = ?').get(r.gamePk, today, 'PRE_GAME') as { id: string } | undefined;
                }

                if (existing) {
                    db.prepare(`
                        UPDATE betting_opportunities
                        SET confidence_score = ?,
                            pillar_breakdown = ?,
                            home_ml_odds = ?,
                            away_ml_odds = ?,
                            detected_value_team = ?,
                            alpha_score = ?,
                            underdog_play_rank = ?,
                            scan_time = ?
                        WHERE id = ?
                    `).run(r.overallConfidence, pillarJson, homeOdds, awayOdds, targetTeam, alphaScore, underdogRank, scanTime, existing.id);
                } else {
                    const oppId = crypto.randomUUID();
                    db.prepare(`
                        INSERT INTO betting_opportunities (
                            id, game_pk, game_date, matchup, confidence_score,
                            pillar_breakdown, home_ml_odds, away_ml_odds,
                            detected_value_team, alpha_score, underdog_play_rank, scan_type, scan_time, status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
                    `).run(
                        oppId, r.gamePk, today, `${r.awayTeam} @ ${r.homeTeam}`, r.overallConfidence,
                        pillarJson, homeOdds, awayOdds, targetTeam, alphaScore, underdogRank, scanType, scanTime
                    );
                }
                console.log(`   ✓ Logged to SQLite [${scanType}]: ${r.awayTeam} @ ${r.homeTeam} | Alpha: ${alphaScore.toFixed(2)} | Target: ${targetTeam}`);
            } catch (err) {
                console.error(`   [!] SQLite opportunity persistence failed for ${r.awayTeam} @ ${r.homeTeam}:`, err);
            }
        }
        
        // --- Telegram Notification ---
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_ID) {
            try {
                const token = process.env.TELEGRAM_BOT_TOKEN;
                const chatId = process.env.TELEGRAM_ADMIN_ID;
                // Create Telegraph page
                const contentNodes = parseMarkdownToTelegraph(report);
                const tResponse = await fetch('https://api.telegra.ph/createPage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: `🛡️ BODHI-8 DAILY SOVEREIGN REPORT: ${today}`,
                        author_name: 'Bet Bodhi',
                        content: contentNodes,
                        return_content: false
                    })
                });
                const tData = await tResponse.json();
                let pageUrl = '';
                if (tData.ok) {
                    pageUrl = tData.result.url;
                } else {
                    console.error('Telegraph page creation failed:', tData);
                }
                // Send Telegram message with the page URL
                const tgResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: chatId,
                        text: `[Daily Sovereign Report](${pageUrl})`,
                        parse_mode: 'Markdown',
                        disable_web_page_preview: false
                    })
                });
                const tgData = await tgResponse.json();
                if (!tgData.ok) {
                    console.error('Telegram sendMessage failed:', tgData);
                } else {
                    console.log(`📡 Telegram report link sent to admin: ${pageUrl}`);
                }
            } catch (err) {
                console.error('❌ Telegram push failed:', err);
            }
        }

    } catch (e) {
        console.error("FATAL CRASH:", e);
    }
}

interface TelegraphNode {
    tag: string;
    attrs?: Record<string, string>;
    children?: (string | TelegraphNode)[];
}

function parseMarkdownToTelegraph(markdown: string): TelegraphNode[] {
    const lines = markdown.split('\n');
    const nodes: TelegraphNode[] = [];
    
    let currentList: TelegraphNode | null = null;
    let currentTable: TelegraphNode | null = null;

    function parseInline(text: string): (string | TelegraphNode)[] {
        const parts: (string | TelegraphNode)[] = [];
        let remaining = text;
        
        while (remaining.length > 0) {
            const match = remaining.match(/(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(`)(.*?)\5/);
            if (!match) {
                parts.push(remaining);
                break;
            }
            
            const index = match.index || 0;
            if (index > 0) {
                parts.push(remaining.substring(0, index));
            }
            
            const isBold = match[1];
            const isItalic = match[3];
            const isCode = match[5];
            
            if (isBold) {
                parts.push({ tag: 'strong', children: parseInline(match[2]) });
            } else if (isItalic) {
                parts.push({ tag: 'em', children: parseInline(match[4]) });
            } else if (isCode) {
                parts.push({ tag: 'code', children: [match[6]] });
            }
            
            remaining = remaining.substring(index + match[0].length);
        }
        
        return parts;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) {
            if (currentList) {
                nodes.push(currentList);
                currentList = null;
            }
            if (currentTable) {
                nodes.push(currentTable);
                currentTable = null;
            }
            continue;
        }

        if (line.startsWith('# ')) {
            if (currentList) { nodes.push(currentList); currentList = null; }
            if (currentTable) { nodes.push(currentTable); currentTable = null; }
            nodes.push({ tag: 'h3', children: parseInline(line.substring(2)) });
            continue;
        }
        if (line.startsWith('## ') || line.startsWith('### ')) {
            if (currentList) { nodes.push(currentList); currentList = null; }
            if (currentTable) { nodes.push(currentTable); currentTable = null; }
            const text = line.startsWith('## ') ? line.substring(3) : line.substring(4);
            nodes.push({ tag: 'h4', children: parseInline(text) });
            continue;
        }

        if (line.startsWith('- ') || line.startsWith('* ')) {
            if (currentTable) { nodes.push(currentTable); currentTable = null; }
            if (!currentList) {
                currentList = { tag: 'ul', children: [] };
            }
            currentList.children!.push({
                tag: 'li',
                children: parseInline(line.substring(2))
            });
            continue;
        }

        if (line.startsWith('|')) {
            if (currentList) { nodes.push(currentList); currentList = null; }
            if (line.includes('---')) continue;
            
            if (!currentTable) {
                currentTable = { tag: 'table', children: [] };
            }
            
            const cols = line.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            const isHeader = currentTable.children!.length === 0;
            
            const rowNode: TelegraphNode = {
                tag: 'tr',
                children: cols.map(col => ({
                    tag: isHeader ? 'th' : 'td',
                    children: parseInline(col)
                }))
            };
            currentTable.children!.push(rowNode);
            continue;
        }

        if (currentList) { nodes.push(currentList); currentList = null; }
        if (currentTable) { nodes.push(currentTable); currentTable = null; }
        
        nodes.push({ tag: 'p', children: parseInline(line) });
    }

    if (currentList) nodes.push(currentList);
    if (currentTable) nodes.push(currentTable);

    return nodes;
}

function categorizeFactors(valueTeam: string | undefined, homeTeam: string, awayTeam: string, advantages: string[], risks: string[]): { strengths: string[], risks: string[] } {
    const strengthsResult: string[] = [];
    const risksResult: string[] = [];

    if (!valueTeam || valueTeam === 'NEUTRAL') {
        return { strengths: advantages, risks: risks };
    }

    const opponentTeam = valueTeam === homeTeam ? awayTeam : homeTeam;

    // Help identify team by splitting and taking the mascot/last word
    const valueWords = valueTeam.toLowerCase().split(/\s+/);
    const valueMascot = valueWords[valueWords.length - 1];
    const oppWords = opponentTeam.toLowerCase().split(/\s+/);
    const oppMascot = oppWords[oppWords.length - 1];

    const isValueTeam = (text: string) => {
        const t = text.toLowerCase();
        return valueWords.some(w => w.length > 3 && t.includes(w)) || t.includes(valueMascot);
    };

    const isOpponentTeam = (text: string) => {
        const t = text.toLowerCase();
        return oppWords.some(w => w.length > 3 && t.includes(w)) || t.includes(oppMascot);
    };

    // Advantages are positive setups/indicators
    for (const adv of advantages) {
        const advLower = adv.toLowerCase();
        // If it explicitly mentions opponent weaknesses, it's a strength for our pick
        const isOpponentWeakness = advLower.includes("target slumping") || 
                                   advLower.includes("vulnerable matchup") || 
                                   advLower.includes("weak pitcher exploit") || 
                                   advLower.includes("bullpen day") || 
                                   advLower.includes("fatigued bullpen") ||
                                   advLower.includes("comeback potential");

        if (isOpponentWeakness) {
            strengthsResult.push(adv);
        } else if (isOpponentTeam(adv) && !isValueTeam(adv)) {
            // It's a strength of the opponent, which is a risk for our pick
            risksResult.push(adv);
        } else {
            // It's either a strength of the valueTeam, or general/neutral.
            strengthsResult.push(adv);
        }
    }

    // Risks are negative setups/indicators
    for (const risk of risks) {
        const riskLower = risk.toLowerCase();
        // If it mentions opponent's vulnerability/weakness, it's a strength for our pick
        const isOpponentWeakness = riskLower.includes("vulnerability") || 
                                   riskLower.includes("slumping") || 
                                   riskLower.includes("struggling") ||
                                   riskLower.includes("fatigued");

        if (isOpponentTeam(risk) && !isValueTeam(risk)) {
            if (isOpponentWeakness || riskLower.includes("fading") || riskLower.includes("letdown")) {
                // Opponent vulnerability or opponent motivation fade is a strength for us!
                strengthsResult.push(risk);
            } else {
                // Otherwise, opponent risk (e.g. opponent late power) is a risk for us
                risksResult.push(risk);
            }
        } else {
            // Mentioning our team's risk, or generic risk
            risksResult.push(risk);
        }
    }

    return { strengths: strengthsResult, risks: risksResult };
}

function detailsToPitcher(p: any): string {
    if (!p) return "";
    if (typeof p === 'string') return p;
    return p.fullName || p.name || "";
}

main();
