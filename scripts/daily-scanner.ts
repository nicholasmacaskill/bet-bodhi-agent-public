/**
 * Bodhi Daily Scanner v1.0
 * ─────────────────────────
 * Scans ALL sports (MLB, NHL, NBA, MMA) for today's slate and outputs
 * a rich breakdown of odds, pillar scores, factors, and confidence.
 *
 * Usage:
 *   npx tsx scripts/daily-scanner.ts                        # scan today once
 *   npx tsx scripts/daily-scanner.ts --date 2026-03-03      # specific date
 *   npx tsx scripts/daily-scanner.ts --watch                # re-scan every 15 min
 *   npx tsx scripts/daily-scanner.ts --watch --interval 5   # re-scan every 5 min
 */

import 'dotenv/config';

import { MLBApi } from '../src/lib/mlb-api';
import { NHLApi } from '../src/lib/nhl-api';
import { NBAApi } from '../src/lib/nba-api';
import { MMAApi } from '../src/lib/mma-api';
import { PolymarketApi, PolyMarket } from '../src/lib/polymarket-api';
import { OddsApi } from '../src/lib/odds-api';
import { PillarAnalyzer, BodhiAnalysis } from '../src/lib/pillar-analyzer';
import { NHLPillarAnalyzer } from '../src/lib/nhl-pillar-analyzer';
import { NBAPillarAnalyzer } from '../src/lib/nba-pillar-analyzer';
import { MMAPillarAnalyzer } from '../src/lib/mma-pillar-analyzer';
import { SyncService } from '../src/lib/agent/sync-service';
import { BodhiPrism } from '../src/lib/agent/prism';
import { AgentMemory } from '../src/lib/agent/memory';
import { KBOApi } from '../src/lib/kbo-api';
import { KBOPillarAnalyzer } from '../src/lib/kbo-pillar-analyzer';

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');
const dateArg = args.find((_, i) => args[i - 1] === '--date');
const intervalArg = args.find((_, i) => args[i - 1] === '--interval');
const intervalMinutes = intervalArg ? parseInt(intervalArg, 10) : 15;
const verbose = args.includes('--verbose');
const exportJson = args.includes('--json');
const moodArg = args.find((_, i) => args[i - 1] === '--mood');
const calmnessArg = args.find((_, i) => args[i - 1] === '--calmness');
const userMood = moodArg || undefined;
const userCalmness = calmnessArg ? parseInt(calmnessArg, 10) : undefined;

function getToday(): string {
    if (dateArg) return dateArg;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Formatting Helpers ───────────────────────────────────────────────────────

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const MAGENTA = '\x1b[35m';
const BLUE = '\x1b[34m';

function bar(score: number, max = 10, width = 10): string {
    const filled = Math.round((score / max) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

function confidenceBar(pct: number, width = 20): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    let color = pct >= 80 ? GREEN : pct >= 70 ? YELLOW : pct >= 60 ? CYAN : DIM;
    return `${color}[${'█'.repeat(filled)}${'░'.repeat(empty)}]${RESET} ${BOLD}${pct}%${RESET}`;
}

function toAmerican(decimal: number): string {
    if (decimal >= 2.0) {
        return `+${Math.round((decimal - 1) * 100)}`;
    } else {
        return `-${Math.round(100 / (decimal - 1))}`;
    }
}

function oddsDisplay(decimal: number): string {
    const american = toAmerican(decimal);
    const color = decimal >= 2.0 ? GREEN : WHITE;
    return `${color}${decimal.toFixed(2)}${RESET} ${DIM}(${american})${RESET}`;
}

function pillarColor(score: number): string {
    if (score >= 9) return GREEN;
    if (score >= 7) return YELLOW;
    if (score >= 5) return CYAN;
    return DIM;
}

function signalBadge(action: string): string {
    if (action.includes('HIGH CONVICTION') || action.includes('BODHI LOCK')) return `${GREEN}${BOLD}✅ ${action}${RESET}`;
    if (action.includes('Value Play') || action.includes('Underdog Lean')) return `${YELLOW}${BOLD}⭐ ${action}${RESET}`;
    if (action.includes('Informational') || action.includes('Watch')) return `${CYAN}ℹ️  ${action}${RESET}`;
    return `${DIM}⏭  ${action}${RESET}`;
}

function sportEmoji(sport: string): string {
    switch (sport) {
        case 'MLB': return '⚾';
        case 'NHL': return '🏒';
        case 'NBA': return '🏀';
        case 'MMA': return '🥊';
        default: return '🎯';
    }
}

function divider(char = '─', width = 70): string {
    return DIM + char.repeat(width) + RESET;
}

function header(text: string, width = 70): string {
    const pad = Math.max(0, width - text.length - 2);
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return `${BOLD}${CYAN}╔${'═'.repeat(width - 2)}╗\n║${' '.repeat(left)}${text}${' '.repeat(right)}║\n╚${'═'.repeat(width - 2)}╝${RESET}`;
}

function sectionHeader(sport: string, matchup: string, time: string): string {
    const emoji = sportEmoji(sport);
    return `\n${divider('━')}\n${BOLD}${emoji} ${sport}  ${WHITE}${matchup}${RESET}  ${DIM}${time}${RESET}\n${divider('━')}`;
}

function formatTime(isoString: string): string {
    try {
        const d = new Date(isoString);
        return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: 'America/New_York' });
    } catch {
        return isoString;
    }
}

// ─── Render a single game analysis ───────────────────────────────────────────

interface ScanResult {
    sport: string;
    matchup: string;
    analysis: BodhiAnalysis;
    polyConditionId?: string;
    polySharePrice?: number;
    polyEV?: number;
    startTime?: string;
    goalieStats?: {
        home?: { name: string; svPct: number; gaa: number };
        away?: { name: string; svPct: number; gaa: number };
    };
    traditionalOdds?: {
        homeOdds?: number;
        awayOdds?: number;
        homeSpread?: number;
        awaySpread?: number;
    };
}

function renderGame(result: ScanResult): void {
    const { sport, matchup, analysis, startTime } = result;
    const time = startTime ? formatTime(startTime) : '';

    // Only use full detail for high confidence or in verbose mode
    const isHighConviction = analysis.recommendedAction.includes('HIGH CONVICTION') || analysis.recommendedAction.includes('LOCK');
    const displayCompact = !verbose && !isHighConviction;

    console.log(sectionHeader(sport, matchup, time));

    // Matchup Info
    console.log(`\n  ${BOLD}MATCHUP INFO${RESET}`);

    // Pitchers (if MLB)
    if (sport === 'MLB') {
        const hPitch = analysis.homePitcher || "TBD / Bullpen";
        const aPitch = analysis.awayPitcher || "TBD / Bullpen";
        console.log(`  ${CYAN}Pitchers:${RESET} ${aPitch} (Away) vs. ${hPitch} (Home)`);
    }

    // Pricing
    if (analysis.polyConditionId) {
        const aPrice = analysis.awayOdds ? `$${analysis.awayOdds.toFixed(2)}` : "N/A";
        const hPrice = analysis.homeOdds ? `$${analysis.homeOdds.toFixed(2)}` : "N/A";
        console.log(`  ${CYAN}Polymarket:${RESET} ${analysis.awayTeam} [${aPrice}] | ${analysis.homeTeam} [${hPrice}]`);
        const actionStr = analysis.recommendedAction.includes("Buy") ? `${GREEN}${analysis.recommendedAction}${RESET}` : `${DIM}${analysis.recommendedAction}${RESET}`;
        console.log(`  ${CYAN}Condition ID:${RESET} ${DIM}${analysis.polyConditionId}${RESET}`);
        console.log(`  ${CYAN}Bodhi Action:${RESET} ${actionStr}`);
    } else {
        console.log(`  ${CYAN}Polymarket:${RESET} ${DIM}No active condition found.${RESET}`);
    }

    // Goalie Matchup (NHL specific)
    if (sport === 'NHL' && result.goalieStats && !displayCompact) {
        const { home, away } = result.goalieStats;
        console.log(`\n  ${BOLD}GOALIES${RESET}`);
        if (away) {
            const svPct = (away.svPct !== undefined && away.svPct !== null) ? away.svPct.toFixed(3) : '--.---';
            const gaa = (away.gaa !== undefined && away.gaa !== null) ? away.gaa.toFixed(2) : '--.--';
            console.log(`  ├─ ${CYAN}${away.name.padEnd(20)}${RESET} ${DIM}SV%: ${svPct}  GAA: ${gaa}${RESET}`);
        }
        if (home) {
            const svPct = (home.svPct !== undefined && home.svPct !== null) ? home.svPct.toFixed(3) : '--.---';
            const gaa = (home.gaa !== undefined && home.gaa !== null) ? home.gaa.toFixed(2) : '--.--';
            console.log(`  └─ ${CYAN}${home.name.padEnd(20)}${RESET} ${DIM}SV%: ${svPct}  GAA: ${gaa}${RESET}`);
        }
    }

    // Pillars (Only show overview if compact)
    console.log(`  ${BOLD}PILLARS${RESET}`);
    analysis.pillars.forEach((p, i) => {
        const isLast = i === analysis.pillars.length - 1;
        const prefix = isLast ? '  └─' : '  ├─';
        const scoreColor = pillarColor(p.score);
        const scoreBar = bar(p.score);

        if (displayCompact) {
            // Very compact for all pillars in one block if needed? No, let's keep 1-line per pillar but no reasons.
            console.log(`${prefix} ${BOLD}${p.pillar.padEnd(20)}${RESET} ${scoreColor}${scoreBar} ${String(p.score).padStart(2)}/10`);
        } else {
            // Full format for Value Plays or Verbose
            console.log(`${prefix} ${BOLD}${p.pillar.padEnd(24)}${RESET} ${scoreColor}${scoreBar} ${p.score}/10${RESET}`);
            const contPrefix = isLast ? '     ' : '  │  ';
            const words = p.reason.split(' ');
            let line = '';
            const lines: string[] = [];
            for (const word of words) {
                if ((line + word).length > 60) { lines.push(line.trim()); line = ''; }
                line += word + ' ';
            }
            if (line.trim()) lines.push(line.trim());
            lines.forEach(l => console.log(`${contPrefix}    ${DIM}${l}${RESET}`));
        }
    });

    if (verbose) {
        if (analysis.advantages && analysis.advantages.length > 0) {
            console.log(`\n  ${BOLD}${GREEN}✅ Key Advantages:${RESET}`);
            analysis.advantages.forEach(adv => console.log(`    ├─ ${adv}`));
        }
        if (analysis.risks && analysis.risks.length > 0) {
            console.log(`\n  ${BOLD}${RED}⚠️ Key Risks:${RESET}`);
            analysis.risks.forEach(risk => console.log(`    ├─ ${risk}`));
        }
    }

    // Confidence / Signal / Stake
    const gap = displayCompact ? "" : "\n";
    console.log(`${gap}  ${BOLD}CONFIDENCE${RESET}  ${confidenceBar(analysis.overallConfidence)}`);
    console.log(`  ${BOLD}SIGNAL${RESET}      ${signalBadge(analysis.recommendedAction)}`);

    // Stake
    if (analysis.suggestedStake > 0) {
        console.log(`  ${BOLD}STAKE [Live]${RESET}  ${MAGENTA}${analysis.recommendedSize}${RESET} ${DIM}→${RESET} ${GREEN}$${analysis.suggestedStake.toFixed(2)}${RESET}`);
    } else {
        console.log(`  ${BOLD}STAKE${RESET}       ${DIM}No stake recommended${RESET}`);
    }

    // Order Command (Terminal Execution)
    if (analysis.valueTeam && analysis.suggestedStake > 0) {
        let cmd = "";
        if (analysis.polyConditionId) {
            const outcomeIndex = analysis.polyOutcomeIndex !== undefined ? analysis.polyOutcomeIndex : ((analysis.valueTeam === analysis.homeTeam || analysis.valueTeam.includes(analysis.homeTeam.split(' ').pop() || '')) ? 0 : 1);
            cmd = `npx tsx scripts/place-bet.ts --market poly --id ${analysis.polyConditionId} --outcome ${outcomeIndex} --amount ${analysis.suggestedStake.toFixed(2)} --price ${analysis.polySharePrice?.toFixed(2)}`;
        }

        if (cmd) {
            console.log(`\n  ${BOLD}${YELLOW}🏹 EXECUTION COMMAND${RESET}`);
            console.log(`  ${DIM}${cmd}${RESET}`);
        }
    }

    console.log('');
}

// ─── Summary Table ────────────────────────────────────────────────────────────

function renderSummary(results: ScanResult[]): void {
    const valuePlays = results
        .filter(r => r.analysis.valueTeam && r.analysis.polyEV && r.analysis.polyEV > 0.03) // Lean or Conviction Arbitrage
        .sort((a, b) => b.analysis.overallConfidence - a.analysis.overallConfidence);

    console.log(`\n${divider('━')}`);
    console.log(`${BOLD}${YELLOW}📊 WEB3 ARBITRAGE SUMMARY${RESET}  ${DIM}(sorted by Bodhi confidence)${RESET}`);
    console.log(divider('━'));

    if (valuePlays.length === 0) {
        console.log(`  ${DIM}No Polymarket value plays detected across today's slate.${RESET}\n`);
        return;
    }

    // Table header
    const col = (s: string, w: number) => s.slice(0, w).padEnd(w);
    console.log(`  ${BOLD}${DIM}#  Sport  Matchup                              Target             Cost   EV      Stake${RESET}`);
    console.log(`  ${DIM}${'─'.repeat(85)}${RESET}`);

    valuePlays.forEach((r, i) => {
        const { analysis, sport } = r;
        const matchup = `${analysis.awayTeam} @ ${analysis.homeTeam}`;
        const betSide = `${analysis.valueTeam?.split(' ').pop()?.toUpperCase()}`;
        const odds = analysis.polySharePrice ? `$${analysis.polySharePrice.toFixed(2)}` : '—';
        const evStr = analysis.polyEV ? `+${(analysis.polyEV * 100).toFixed(1)}%` : '—';
        const stake = analysis.suggestedStake > 0 ? `$${analysis.suggestedStake.toFixed(2)}` : '—';
        const confColor = analysis.overallConfidence >= 80 ? GREEN : analysis.overallConfidence >= 70 ? YELLOW : CYAN;

        console.log(
            `  ${String(i + 1).padStart(2)}  ${col(sport, 5)}  ${col(matchup, 36)} ${col(betSide, 18)} ${col(odds, 6)} ${confColor}${col(evStr, 7)}${RESET} ${GREEN}${stake}${RESET}`
        );
    });

    console.log('');
}

// ─── Scan all sports ──────────────────────────────────────────────────────────

async function runScan(date: string): Promise<void> {
    if (!process.argv.includes('--skip-sync')) {
        const syncService = new SyncService();
        await syncService.runSync();
    }

    const polyApi = new PolymarketApi();
    console.log(`${BOLD}${CYAN}🔄 Syncing Live Bankroll from Polygon...${RESET}`);
    let liveBalance = await polyApi.getUSDCBalance();

    if (liveBalance > 0) {
        console.log(`${GREEN}✅ Linked to Live Bankroll: $${liveBalance.toFixed(2)} USDC.e${RESET}`);
        if (process.env.POLY_PROXY_ADDRESS) {
            console.log(`${DIM}   Using Proxy Wallet: ${process.env.POLY_PROXY_ADDRESS}${RESET}`);
        }
    } else {
        console.log(`${YELLOW}⚠️  Balance Sync Failed (or 0 funds). Falling back to manual sizing.$464 CAD.${RESET}`);
    }

    const mlbApi = new MLBApi();
    const nhlApi = new NHLApi();
    const nbaApi = new NBAApi();
    const mmaApi = new MMAApi();
    const polySvc = new PolymarketApi();
    const oddsApi = new OddsApi();

    const mlbAnalyzer = new PillarAnalyzer();
    const nhlAnalyzer = new NHLPillarAnalyzer();
    const nbaAnalyzer = new NBAPillarAnalyzer();
    const mmaAnalyzer = new MMAPillarAnalyzer();

    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    console.log(header(`🔍 BODHI DAILY SCANNER  —  ${dateLabel}`));
    console.log(`  ${DIM}Scanning date: ${date}  |  Last updated: ${now.toLocaleTimeString()}${RESET}\n`);

    const allResults: ScanResult[] = [];

    // ── Pre-Fetch Global Web3 Polymarket Conditions & Balance ────────────────
    console.log(`  ${CYAN}⟳${RESET} Fetching Global Web3 Sports Markets & Balance...`);
    let polyMarkets: PolyMarket[] = [];
    [polyMarkets, liveBalance] = await Promise.all([
        polyApi.getActiveSportsMarkets("vs."),
        polyApi.getUSDCBalance()
    ]);

    // Fallback to user-provided balance if live balance is zero (wallet not funded or API error)
    const bankroll = liveBalance > 0 ? liveBalance : 464.00;

    console.log(`  ${GREEN}✓${RESET} Synced ${polyMarkets.length} active conditions`);
    if (liveBalance > 0) {
        console.log(`  ${GREEN}✓${RESET} Live Bankroll: ${BOLD}$${liveBalance.toFixed(2)}${RESET}\n`);
    } else {
        console.log(`  ${YELLOW}⚠️${RESET} Using Manual Bankroll: ${BOLD}$${bankroll.toFixed(2)}${RESET} ${DIM}(Live balance failed or $0)${RESET}\n`);
    }

    // ── Check Slump / Psychological State ────────────────────────────────────
    const prism = new BodhiPrism();
    const slumpStatus = await prism.checkSlump();
    if (slumpStatus.isSlump) {
        console.log(`  ${YELLOW}⚠️  ${slumpStatus.reason}${RESET}\n`);
    }

    // ── Load Memory ──────────────────────────────────────────────────────────
    const memory = new AgentMemory();
    await memory.loadMemory();

    // ── MLB ──────────────────────────────────────────────────────────────────
    try {
        process.stdout.write(`  ${CYAN}⟳${RESET} Fetching MLB games & Traditional Odds...`);
        const [mlbGames, traditionalOdds] = await Promise.all([
            mlbApi.getSchedule(date),
            oddsApi.getOdds('baseball_mlb_preseason')
        ]);
        process.stdout.write(`\r  ${GREEN}✓${RESET} MLB: ${mlbGames.length} games found\n`);

        const mockPlayerStats = new Map<string, any>();

        for (const game of mlbGames) {
            let details: any = { probables: game.probables || {}, lineups: game.lineups || { home: [], away: [] } };
            let rosters: { home: string[], away: string[] } | undefined = undefined;
            let combinedHot: string[] = [];
            let platoonSplits: Map<string, any> | undefined = undefined;
            let bullpenFatigue: { home: number, away: number } | undefined = undefined;
            let lineupHandedness: { home: { L: number, R: number, S: number }, away: { L: number, R: number, S: number } } | undefined = undefined;
            let teamForm: { home: { streak: string, l10: string, l10Wins: number }, away: { streak: string, l10: string, l10Wins: number } } | undefined = undefined;

            if (game.gamePk) {
                const hydrated = await mlbApi.getHydratedAnalysisData(game);
                details = hydrated.details || details;
                rosters = hydrated.rosters;
                combinedHot = [...hydrated.homeHot, ...hydrated.awayHot];
                platoonSplits = hydrated.platoonSplits;
                bullpenFatigue = hydrated.bullpenFatigue;
                lineupHandedness = hydrated.lineupHandedness;
                teamForm = hydrated.teamForm;
            }

            const homeMascot = game.homeTeam.split(' ').pop()?.toLowerCase() || "";
            const awayMascot = game.awayTeam.split(' ').pop()?.toLowerCase() || "";
            let condition = polyMarkets.find(m =>
                (m.question.toLowerCase().includes(homeMascot) || m.description.toLowerCase().includes(homeMascot)) &&
                (m.question.toLowerCase().includes(awayMascot) || m.description.toLowerCase().includes(awayMascot))
            );

            // Fallback: Direct Targeted Search if generic sync missed it
            if (!condition) {
                condition = await polyApi.getMarketByTeams(game.homeTeam, game.awayTeam) || undefined;
            }

            // Analysis (Now with technical signals and agent memory!)
            const analysis = mlbAnalyzer.analyzeGame(
                game,
                details,
                condition,
                combinedHot,
                [],
                mockPlayerStats,
                bankroll,
                rosters,
                memory,
                platoonSplits,
                bullpenFatigue,
                lineupHandedness,
                teamForm
            );

            const tradGame = traditionalOdds.find((t: any) =>
                (t.home_team.toLowerCase().includes(homeMascot) || homeMascot.includes(t.home_team.toLowerCase().split(' ').pop())) &&
                (t.away_team.toLowerCase().includes(awayMascot) || awayMascot.includes(t.away_team.toLowerCase().split(' ').pop()))
            );

            let extOdds = undefined;
            if (tradGame && tradGame.bookmakers && tradGame.bookmakers.length > 0) {
                const book = tradGame.bookmakers.find((b: any) => b.key === 'draftkings') || tradGame.bookmakers[0];
                const h2h = book.markets.find((m: any) => m.key === 'h2h');
                const spreader = book.markets.find((m: any) => m.key === 'spreads');

                extOdds = {
                    homeOdds: h2h?.outcomes.find((o: any) => o.name === tradGame.home_team)?.price,
                    awayOdds: h2h?.outcomes.find((o: any) => o.name === tradGame.away_team)?.price,
                    homeSpread: spreader?.outcomes.find((o: any) => o.name === tradGame.home_team)?.point,
                    awaySpread: spreader?.outcomes.find((o: any) => o.name === tradGame.away_team)?.point,
                };
            } else if (!tradGame && condition && condition.outcomePrices && condition.outcomePrices.length >= 2) {
                // Use Polymarket's own prices as the 'traditional' odds if bookies are missing
                extOdds = {
                    homeOdds: 1 / parseFloat(condition.outcomePrices[0]), // Simple reciprocal for decimal odds
                    awayOdds: 1 / parseFloat(condition.outcomePrices[1]),
                    homeSpread: -1.5,
                    awaySpread: 1.5,
                };
            } else if (!tradGame) {
                // UI Fallback: Ensures formatting is visible for Spring Training
                extOdds = {
                    homeOdds: 1.88,
                    awayOdds: 1.95,
                    homeSpread: -1.5,
                    awaySpread: 1.5,
                };
            }

            allResults.push({
                sport: 'MLB',
                matchup: `${game.awayTeam} @ ${game.homeTeam}`,
                analysis,
                polyConditionId: analysis.polyConditionId,
                polySharePrice: analysis.polySharePrice,
                polyEV: analysis.polyEV,
                startTime: game.date,
                traditionalOdds: extOdds
            });
        }
    } catch (e: any) {
        console.log(`  ${RED}✗${RESET} MLB scan failed: ${e.message}`);
    }

    // ── NHL ──────────────────────────────────────────────────────────────────
    try {
        process.stdout.write(`  ${CYAN}⟳${RESET} Fetching NHL games...`);
        const [nhlGames, hydrated] = await Promise.all([
            nhlApi.getSchedule(date),
            nhlApi.getHydratedAnalysisData()
        ]);
        const { teamStats: nhlStats, goalieLeaders } = hydrated;
        process.stdout.write(`\r  ${GREEN}✓${RESET} NHL: ${nhlGames.length} games found\n`);

        for (const game of nhlGames) {
            const landing = await nhlApi.getGameLanding(game.id);
            const goalieSeasonStats = landing?.matchup?.goalieSeasonStats;

            const homeMascot = game.homeTeam.split(' ').pop()?.toLowerCase() || "";
            const awayMascot = game.awayTeam.split(' ').pop()?.toLowerCase() || "";
            const condition = polyMarkets.find(m =>
                (m.question.toLowerCase().includes(homeMascot) || m.description.toLowerCase().includes(homeMascot)) &&
                (m.question.toLowerCase().includes(awayMascot) || m.description.toLowerCase().includes(awayMascot))
            );

            const analysis = nhlAnalyzer.analyzeGame(game, nhlStats, condition, goalieLeaders, goalieSeasonStats, bankroll, userMood, userCalmness, slumpStatus.multiplier);

            let resultGoalieStats: any = undefined;
            if (goalieSeasonStats?.goalies) {
                const hG = goalieSeasonStats.goalies.find((g: any) => g.teamId === game.homeTeamId);
                const aG = goalieSeasonStats.goalies.find((g: any) => g.teamId === game.awayTeamId);
                if (hG || aG) {
                    resultGoalieStats = {
                        home: hG ? { name: hG.name.default, svPct: hG.savePctg, gaa: hG.goalsAgainstAvg } : undefined,
                        away: aG ? { name: aG.name.default, svPct: aG.savePctg, gaa: aG.goalsAgainstAvg } : undefined
                    };
                }
            }

            if (analysis.overallConfidence < 85) {
                analysis.recommendedAction = `PASS - Filtered (Strict Threshold: requires 85% confidence for NHL)`;
                analysis.valueTeam = undefined;
                analysis.suggestedStake = 0;
            }

            allResults.push({
                sport: 'NHL',
                matchup: `${game.awayTeam} @ ${game.homeTeam}`,
                analysis,
                polyConditionId: analysis.polyConditionId,
                polySharePrice: analysis.polySharePrice,
                polyEV: analysis.polyEV,
                startTime: game.startTime,
                goalieStats: resultGoalieStats
            });
        }
    } catch (e: any) {
        console.log(`  ${RED}✗${RESET} NHL scan failed: ${e.message}`);
    }

    // ── NBA ──────────────────────────────────────────────────────────────────
    try {
        const nbaDate = date.replace(/-/g, '');
        process.stdout.write(`  ${CYAN}⟳${RESET} Fetching NBA games...`);
        const [nbaGames, hydrated] = await Promise.all([
            nbaApi.getSchedule(nbaDate),
            nbaApi.getHydratedAnalysisData()
        ]);
        const { nbaStats } = hydrated;
        process.stdout.write(`\r  ${GREEN}✓${RESET} NBA: ${nbaGames.length} games found\n`);

        for (const game of nbaGames) {
            const homeMascot = game.homeTeam.split(' ').pop()?.toLowerCase() || "";
            const awayMascot = game.awayTeam.split(' ').pop()?.toLowerCase() || "";
            const condition = polyMarkets.find(m =>
                (m.question.toLowerCase().includes(homeMascot) || m.description.toLowerCase().includes(homeMascot)) &&
                (m.question.toLowerCase().includes(awayMascot) || m.description.toLowerCase().includes(awayMascot))
            );

            const analysis = nbaAnalyzer.analyzeGame(game, nbaStats, condition, bankroll, userMood, userCalmness, slumpStatus.multiplier);

            if (analysis.overallConfidence < 85) {
                analysis.recommendedAction = `PASS - Filtered (Strict Threshold: requires 85% confidence for NBA)`;
                analysis.valueTeam = undefined;
                analysis.suggestedStake = 0;
            }

            allResults.push({
                sport: 'NBA',
                matchup: `${game.awayTeam} @ ${game.homeTeam}`,
                analysis,
                polyConditionId: analysis.polyConditionId,
                polySharePrice: analysis.polySharePrice,
                polyEV: analysis.polyEV,
                startTime: game.startTime
            });
        }
    } catch (e: any) {
        console.log(`  ${RED}✗${RESET} NBA scan failed: ${e.message}`);
    }

    // ── MMA ──────────────────────────────────────────────────────────────────
    try {
        process.stdout.write(`  ${CYAN}⟳${RESET} Fetching MMA events...`);
        const [mmaEvents, fighterStats] = await Promise.all([
            mmaApi.getUpcomingEvents(),
            mmaApi.getFighterStats()
        ]);

        let fightCount = 0;
        for (const event of mmaEvents) {
            for (const fight of (event.mainCard || [])) {
                fightCount++;

                const condition = polyMarkets.find(m =>
                    (m.question.toLowerCase().includes(fight.fighter1.toLowerCase()) || m.description.toLowerCase().includes(fight.fighter1.toLowerCase())) &&
                    (m.question.toLowerCase().includes(fight.fighter2.toLowerCase()) || m.description.toLowerCase().includes(fight.fighter2.toLowerCase()))
                );

                const analysis = mmaAnalyzer.analyzeFight(fight, fighterStats, condition, bankroll, userMood, userCalmness, slumpStatus.multiplier, event.location);

                allResults.push({
                    sport: 'MMA',
                    matchup: `${fight.fighter1} vs ${fight.fighter2}`,
                    analysis,
                    polyConditionId: analysis.polyConditionId,
                    polySharePrice: analysis.polySharePrice,
                    polyEV: analysis.polyEV,
                    startTime: event.date
                });
            }
        }
        process.stdout.write(`\r  ${GREEN}✓${RESET} MMA: ${fightCount} fights found\n`);
    } catch (e: any) {
        console.log(`  ${RED}✗${RESET} MMA scan failed: ${e.message}`);
    }

    // ── KBO ──────────────────────────────────────────────────────────────────
    try {
        process.stdout.write(`  ${CYAN}⟳${RESET} Fetching KBO games...`);
        const kboApi = new KBOApi();
        const kboAnalyzer = new KBOPillarAnalyzer();
        const [kboGames, kboStats] = await Promise.all([
            kboApi.getSchedule(date),
            kboApi.getTeamStats()
        ]);
        const kboElite = kboApi.getElitePitchers();
        const kboWeak = kboApi.getWeakPitchers();
        process.stdout.write(`\r  ${GREEN}✓${RESET} KBO: ${kboGames.length} games found\n`);

        for (const game of kboGames) {
            const homeMascot = game.homeTeam.split(' ').pop()?.toLowerCase() || "";
            const awayMascot = game.awayTeam.split(' ').pop()?.toLowerCase() || "";
            const condition = polyMarkets.find(m =>
                (m.question.toLowerCase().includes(homeMascot) || m.description.toLowerCase().includes(homeMascot)) &&
                (m.question.toLowerCase().includes(awayMascot) || m.description.toLowerCase().includes(awayMascot))
            );

            // NEW: Fetch starting pitchers for high-fidelity analysis
            const pitchers = await kboApi.getStartingPitchers(game.id);
            const extendedGame = { ...game, pitchers };

            const analysis = kboAnalyzer.analyzeGame(extendedGame, kboStats, condition, kboElite, kboWeak, bankroll);

            allResults.push({
                sport: 'KBO',
                matchup: `${game.awayTeam} @ ${game.homeTeam}`,
                analysis: analysis as any,
                polyConditionId: analysis.polyConditionId,
                polySharePrice: analysis.polySharePrice,
                polyEV: analysis.polyEV,
                startTime: game.startTime,
                pitchers // Keep reference for the report
            });
        }

    } catch (e: any) {
        console.log(`  ${RED}✗${RESET} KBO scan failed: ${e.message}`);
    }

    // ── Render all games ─────────────────────────────────────────────────────
    const totalGames = allResults.length;
    console.log(`\n  ${DIM}Total: ${totalGames} matchups scanned across all sports${RESET}`);

    if (totalGames === 0) {
        console.log(`\n  ${YELLOW}No games found for ${date}. Try a different date with --date YYYY-MM-DD${RESET}\n`);
        return;
    }

    // Group by sport for display
    const sports = ['MLB', 'NHL', 'NBA', 'MMA', 'KBO'];
    for (const sport of sports) {
        const sportResults = allResults.filter(r => r.sport === sport);
        if (sportResults.length === 0) continue;

        // Sort by time ascending (earlier games first) within each sport
        sportResults.sort((a, b) => {
            const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
            const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
            return timeA - timeB;
        });

        for (const result of sportResults) {
            renderGame(result);
        }
    }

    // Summary table (Move to bottom for visibility)
    renderSummary(allResults);

    // Export to JSON for Dashboard
    if (exportJson) {
        try {
            const publicDir = path.join(process.cwd(), 'public');
            if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
            }
            const outputPath = path.join(publicDir, 'scan-results.json');
            fs.writeFileSync(outputPath, JSON.stringify({
                lastUpdated: new Date().toISOString(),
                date,
                results: allResults
            }, null, 2));
            console.log(`  ${GREEN}📊 Results exported to public/scan-results.json${RESET}\n`);
        } catch (error) {
            console.error(`  ${RED}❌ Failed to export JSON:${RESET}`, error);
        }
    }

    // Watch mode footer
    if (watchMode) {
        console.log(`${DIM}${'─'.repeat(70)}${RESET}`);
        console.log(`  ${CYAN}⏱  Next scan in ${intervalMinutes} min. Press ${BOLD}Ctrl+C${RESET}${CYAN} to exit.${RESET}\n`);
    }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
    const date = getToday();

    if (watchMode) {
        console.log(`\n  ${GREEN}${BOLD}Watch mode enabled${RESET} — scanning every ${intervalMinutes} minute(s). Press Ctrl+C to stop.\n`);
        // Run immediately, then on interval
        await runScan(date);
        setInterval(async () => {
            await runScan(getToday()); // re-evaluate date each tick in case midnight passes
        }, intervalMinutes * 60 * 1000);
    } else {
        await runScan(date);
    }
}

main().catch(err => {
    console.error(`\n${RED}Fatal error:${RESET}`, err);
    process.exit(1);
});
