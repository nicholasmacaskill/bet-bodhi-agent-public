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
import { OddsApi } from '../src/lib/odds-api';
import { PillarAnalyzer, BodhiAnalysis } from '../src/lib/pillar-analyzer';
import { NHLPillarAnalyzer } from '../src/lib/nhl-pillar-analyzer';
import { NBAPillarAnalyzer } from '../src/lib/nba-pillar-analyzer';
import { MMAPillarAnalyzer } from '../src/lib/mma-pillar-analyzer';

// ─── CLI Args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');
const dateArg = args.find((_, i) => args[i - 1] === '--date');
const intervalArg = args.find((_, i) => args[i - 1] === '--interval');
const intervalMinutes = intervalArg ? parseInt(intervalArg, 10) : 15;

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
    homeOdds?: number;
    awayOdds?: number;
    startTime?: string;
    goalieStats?: {
        home?: { name: string; svPct: number; gaa: number };
        away?: { name: string; svPct: number; gaa: number };
    };
}

function renderGame(result: ScanResult): void {
    const { sport, matchup, analysis, homeOdds, awayOdds, startTime } = result;
    const time = startTime ? formatTime(startTime) : '';

    console.log(sectionHeader(sport, matchup, time));

    // Odds row
    if (homeOdds && awayOdds) {
        const homeLabel = `${analysis.homeTeam}`;
        const awayLabel = `${analysis.awayTeam}`;
        console.log(`\n  ${BOLD}ODDS${RESET}   ${CYAN}${awayLabel}${RESET} ${oddsDisplay(awayOdds)}   ${CYAN}${homeLabel}${RESET} ${oddsDisplay(homeOdds)}`);
    }

    // Goalie Matchup (NHL specific)
    if (sport === 'NHL' && result.goalieStats) {
        const { home, away } = result.goalieStats;
        console.log(`\n  ${BOLD}GOALIES${RESET}`);
        if (away) {
            const svPct = away.svPct ? away.svPct.toFixed(3) : '--.---';
            const gaa = away.gaa ? away.gaa.toFixed(2) : '--.--';
            console.log(`  ├─ ${CYAN}${away.name.padEnd(20)}${RESET} ${DIM}SV%: ${svPct}  GAA: ${gaa}${RESET}`);
        }
        if (home) {
            const svPct = home.svPct ? home.svPct.toFixed(3) : '--.---';
            const gaa = home.gaa ? home.gaa.toFixed(2) : '--.--';
            console.log(`  └─ ${CYAN}${home.name.padEnd(20)}${RESET} ${DIM}SV%: ${svPct}  GAA: ${gaa}${RESET}`);
        }
    }

    // Pillars
    console.log(`\n  ${BOLD}PILLARS${RESET}`);
    analysis.pillars.forEach((p, i) => {
        const isLast = i === analysis.pillars.length - 1;
        const prefix = isLast ? '  └─' : '  ├─';
        const contPrefix = isLast ? '     ' : '  │  ';
        const scoreColor = pillarColor(p.score);
        const scoreBar = bar(p.score);
        console.log(`${prefix} ${BOLD}${p.pillar.padEnd(24)}${RESET} ${scoreColor}${scoreBar} ${p.score}/10${RESET}`);
        // Word-wrap the reason at ~60 chars
        const words = p.reason.split(' ');
        let line = '';
        const lines: string[] = [];
        for (const word of words) {
            if ((line + word).length > 60) { lines.push(line.trim()); line = ''; }
            line += word + ' ';
        }
        if (line.trim()) lines.push(line.trim());
        lines.forEach(l => console.log(`${contPrefix}    ${DIM}${l}${RESET}`));
    });

    // Confidence
    console.log(`\n  ${BOLD}CONFIDENCE${RESET}  ${confidenceBar(analysis.overallConfidence)}`);

    // Signal
    console.log(`  ${BOLD}SIGNAL${RESET}      ${signalBadge(analysis.recommendedAction)}`);

    // Stake
    if (analysis.suggestedStake > 0) {
        console.log(`  ${BOLD}STAKE${RESET}       ${MAGENTA}${analysis.recommendedSize}${RESET} ${DIM}→${RESET} ${GREEN}$${analysis.suggestedStake.toFixed(2)}${RESET}`);
    } else {
        console.log(`  ${BOLD}STAKE${RESET}       ${DIM}No stake recommended${RESET}`);
    }

    console.log('');
}

// ─── Summary Table ────────────────────────────────────────────────────────────

function renderSummary(results: ScanResult[]): void {
    const valuePlays = results
        .filter(r => r.analysis.valueTeam && r.analysis.overallConfidence >= 60)
        .sort((a, b) => b.analysis.overallConfidence - a.analysis.overallConfidence);

    console.log(`\n${divider('━')}`);
    console.log(`${BOLD}${YELLOW}📊 VALUE PLAYS SUMMARY${RESET}  ${DIM}(sorted by confidence, ≥60%)${RESET}`);
    console.log(divider('━'));

    if (valuePlays.length === 0) {
        console.log(`  ${DIM}No value plays detected across today's slate.${RESET}\n`);
        return;
    }

    // Table header
    const col = (s: string, w: number) => s.slice(0, w).padEnd(w);
    console.log(`  ${BOLD}${DIM}#  Sport  Matchup                              Bet        Odds    Conf   Stake${RESET}`);
    console.log(`  ${DIM}${'─'.repeat(78)}${RESET}`);

    valuePlays.forEach((r, i) => {
        const { analysis, sport } = r;
        const matchup = `${analysis.awayTeam} @ ${analysis.homeTeam}`;
        const betSide = analysis.valueTeam === 'home' ? analysis.homeTeam : analysis.awayTeam;
        const odds = analysis.valueOdds ? analysis.valueOdds.toFixed(2) : '—';
        const conf = `${analysis.overallConfidence}%`;
        const stake = analysis.suggestedStake > 0 ? `$${analysis.suggestedStake.toFixed(2)}` : '—';
        const confColor = analysis.overallConfidence >= 80 ? GREEN : analysis.overallConfidence >= 70 ? YELLOW : CYAN;

        console.log(
            `  ${String(i + 1).padStart(2)}  ${col(sport, 5)}  ${col(matchup, 36)} ${col(betSide, 10)} ${col(odds, 7)} ${confColor}${conf.padEnd(6)}${RESET} ${GREEN}${stake}${RESET}`
        );
    });

    console.log('');
}

// ─── Scan all sports ──────────────────────────────────────────────────────────

async function runScan(date: string): Promise<void> {
    const mlbApi = new MLBApi();
    const nhlApi = new NHLApi();
    const nbaApi = new NBAApi();
    const mmaApi = new MMAApi();
    const oddsApi = new OddsApi();

    const mlbAnalyzer = new PillarAnalyzer();
    const nhlAnalyzer = new NHLPillarAnalyzer();
    const nbaAnalyzer = new NBAPillarAnalyzer();
    const mmaAnalyzer = new MMAPillarAnalyzer();

    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    console.clear();
    console.log(header(`🔍 BODHI DAILY SCANNER  —  ${dateLabel}`));
    console.log(`  ${DIM}Scanning date: ${date}  |  Last updated: ${now.toLocaleTimeString()}${RESET}\n`);

    const allResults: ScanResult[] = [];

    // ── MLB ──────────────────────────────────────────────────────────────────
    try {
        process.stdout.write(`  ${CYAN}⟳${RESET} Fetching MLB games...`);
        const [mlbGames, mlbOdds] = await Promise.all([
            mlbApi.getSchedule(date),
            oddsApi.getMLBOdds()
        ]);
        process.stdout.write(`\r  ${GREEN}✓${RESET} MLB: ${mlbGames.length} games found\n`);

        for (const game of mlbGames) {
            // Try to get detailed lineup/pitcher data
            let details: any = { probables: game.probables || {}, lineups: game.lineups || { home: [], away: [] } };
            if ((!details.lineups.home || details.lineups.home.length === 0) && game.gamePk) {
                const fetched = await mlbApi.getGameDetails(game.gamePk);
                if (fetched) details = fetched;
            }

            const analysis = mlbAnalyzer.analyzeGame(game, details, mlbOdds);

            // Extract odds for display
            const market = mlbOdds.find(o =>
                o.home_team.includes(game.homeTeam) || game.homeTeam.includes(o.home_team) ||
                o.away_team.includes(game.awayTeam) || game.awayTeam.includes(o.away_team)
            );
            const h2h = market?.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'h2h');
            const homeOdds = h2h?.outcomes?.find((o: any) => o.name === market?.home_team)?.price;
            const awayOdds = h2h?.outcomes?.find((o: any) => o.name === market?.away_team)?.price;

            allResults.push({
                sport: 'MLB',
                matchup: `${game.awayTeam} @ ${game.homeTeam}`,
                analysis,
                homeOdds,
                awayOdds,
                startTime: game.date
            });
        }
    } catch (e: any) {
        console.log(`  ${RED}✗${RESET} MLB scan failed: ${e.message}`);
    }

    // ── NHL ──────────────────────────────────────────────────────────────────
    try {
        process.stdout.write(`  ${CYAN}⟳${RESET} Fetching NHL games...`);
        const [nhlGames, nhlStats, nhlOdds, goalieLeaders] = await Promise.all([
            nhlApi.getSchedule(date),
            nhlApi.getTeamStats(),
            oddsApi.getNHLOdds(),
            nhlApi.getGoalieLeaders()
        ]);
        process.stdout.write(`\r  ${GREEN}✓${RESET} NHL: ${nhlGames.length} games found\n`);

        for (const game of nhlGames) {
            // Fetch detailed goalie stats for each game
            const landing = await nhlApi.getGameLanding(game.id);
            const goalieSeasonStats = landing?.matchup?.goalieSeasonStats;

            const analysis = nhlAnalyzer.analyzeGame(game, nhlStats, nhlOdds, goalieLeaders, goalieSeasonStats);

            const market = nhlOdds.find(o =>
                o.home_team.includes(game.homeTeam) || game.homeTeam.includes(o.home_team) ||
                o.away_team.includes(game.awayTeam) || game.awayTeam.includes(o.away_team)
            );
            const h2h = market?.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'h2h');
            const homeOdds = h2h?.outcomes?.find((o: any) => o.name === market?.home_team)?.price;
            const awayOdds = h2h?.outcomes?.find((o: any) => o.name === market?.away_team)?.price;

            // Extract goalie info for display
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

            allResults.push({
                sport: 'NHL',
                matchup: `${game.awayTeam} @ ${game.homeTeam}`,
                analysis,
                homeOdds,
                awayOdds,
                startTime: game.startTime,
                goalieStats: resultGoalieStats
            });
        }
    } catch (e: any) {
        console.log(`  ${RED}✗${RESET} NHL scan failed: ${e.message}`);
    }

    // ── NBA ──────────────────────────────────────────────────────────────────
    try {
        // NBA date format: YYYYMMDD
        const nbaDate = date.replace(/-/g, '');
        process.stdout.write(`  ${CYAN}⟳${RESET} Fetching NBA games...`);
        const [nbaGames, nbaStats, nbaOdds] = await Promise.all([
            nbaApi.getSchedule(nbaDate),
            nbaApi.getTeamAdvancedStats(),
            oddsApi.getNBAOdds()
        ]);
        process.stdout.write(`\r  ${GREEN}✓${RESET} NBA: ${nbaGames.length} games found\n`);

        for (const game of nbaGames) {
            const analysis = nbaAnalyzer.analyzeGame(game, nbaStats, nbaOdds);

            const market = nbaOdds.find(o =>
                o.home_team.includes(game.homeTeam) || game.homeTeam.includes(o.home_team) ||
                o.away_team.includes(game.awayTeam) || game.awayTeam.includes(o.away_team)
            );
            const h2h = market?.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'h2h');
            const homeOdds = h2h?.outcomes?.find((o: any) => o.name === market?.home_team)?.price;
            const awayOdds = h2h?.outcomes?.find((o: any) => o.name === market?.away_team)?.price;

            allResults.push({
                sport: 'NBA',
                matchup: `${game.awayTeam} @ ${game.homeTeam}`,
                analysis,
                homeOdds,
                awayOdds,
                startTime: game.startTime
            });
        }
    } catch (e: any) {
        console.log(`  ${RED}✗${RESET} NBA scan failed: ${e.message}`);
    }

    // ── MMA ──────────────────────────────────────────────────────────────────
    try {
        process.stdout.write(`  ${CYAN}⟳${RESET} Fetching MMA events...`);
        const [mmaEvents, fighterStats, mmaOdds] = await Promise.all([
            mmaApi.getUpcomingEvents(),
            mmaApi.getFighterStats(),
            oddsApi.getMMAOdds()
        ]);

        let fightCount = 0;
        for (const event of mmaEvents) {
            for (const fight of (event.mainCard || [])) {
                const analysis = mmaAnalyzer.analyzeFight(fight, fighterStats, mmaOdds);
                fightCount++;

                const market = mmaOdds.find(o =>
                    o.home_team.includes(fight.fighter1) || o.home_team.includes(fight.fighter2) ||
                    o.away_team.includes(fight.fighter1) || o.away_team.includes(fight.fighter2)
                );
                const h2h = market?.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'h2h');
                const f1Odds = h2h?.outcomes?.find((o: any) => o.name.includes(fight.fighter1))?.price;
                const f2Odds = h2h?.outcomes?.find((o: any) => o.name.includes(fight.fighter2))?.price;

                allResults.push({
                    sport: 'MMA',
                    matchup: `${fight.fighter1} vs ${fight.fighter2}`,
                    analysis,
                    homeOdds: f2Odds,   // "home" = fighter2 in MMA analyzer
                    awayOdds: f1Odds,   // "away" = fighter1
                    startTime: event.date
                });
            }
        }
        process.stdout.write(`\r  ${GREEN}✓${RESET} MMA: ${fightCount} fights found\n`);
    } catch (e: any) {
        console.log(`  ${RED}✗${RESET} MMA scan failed: ${e.message}`);
    }

    // ── Render all games ─────────────────────────────────────────────────────
    const totalGames = allResults.length;
    console.log(`\n  ${DIM}Total: ${totalGames} matchups scanned across all sports${RESET}`);

    if (totalGames === 0) {
        console.log(`\n  ${YELLOW}No games found for ${date}. Try a different date with --date YYYY-MM-DD${RESET}\n`);
        return;
    }

    // Group by sport for display
    const sports = ['MLB', 'NHL', 'NBA', 'MMA'];
    for (const sport of sports) {
        const sportResults = allResults.filter(r => r.sport === sport);
        if (sportResults.length === 0) continue;

        // Sort by confidence descending within each sport
        sportResults.sort((a, b) => b.analysis.overallConfidence - a.analysis.overallConfidence);

        for (const result of sportResults) {
            renderGame(result);
        }
    }

    // Summary table
    renderSummary(allResults);

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
