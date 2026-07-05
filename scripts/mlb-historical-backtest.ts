/**
 * MLB Historical Backtest — replay current Bodhi model on past seasons.
 *
 * Each final game is hydrated as-of first pitch (no lookahead), analyzed with
 * today's weights/filters, optionally matched to closed Polymarket markets.
 * Agent memory is disabled (user sometimes faded model picks).
 *
 * Usage:
 *   npx tsx scripts/mlb-historical-backtest.ts --season 2024 --sample 14
 *   npx tsx scripts/mlb-historical-backtest.ts --season 2024 --season 2025
 *   npx tsx scripts/mlb-historical-backtest.ts --from 2024-06-01 --to 2024-06-07
 *   npx tsx scripts/mlb-historical-backtest.ts --season 2025 --fast --concurrency 4 --quiet
 *   FORCE_BACKTEST=1 npx tsx ...   # ignore row cache
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { MLBApi, MLBGame } from '../src/lib/mlb-api';
import { PillarAnalyzer, computeUnifiedAlpha, getSizing } from '../src/lib/pillar-analyzer';
import { loadSlateBook } from '../src/lib/gateway/slate-book';

dotenv.config();

const ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(ROOT, 'data', 'backtest_cache');

interface BacktestRow {
  date: string;
  gamePk: number;
  matchup: string;
  winner: string;
  valueTeam: string | null;
  alpha: number;
  confidence: number;
  polyEV: number | null;
  executionRoute: string;
  recommendedAction: string;
  pickWon: boolean | null;
  polyMatched: boolean;
  flags: string[];
}

interface BacktestSummary {
  label: string;
  games: number;
  picks: number;
  wins: number;
  losses: number;
  winRate: number;
  polyMatched: number;
  polyRoutePicks: number;
  polyRouteWins: number;
  polyRouteWr: number;
  highConviction: { picks: number; wins: number; wr: number };
  byAlphaBand: Record<string, { picks: number; wins: number; wr: number }>;
  byActionPrefix: Record<string, { picks: number; wins: number; wr: number }>;
  simulatedPnl: number;
  simulatedWagered: number;
  simulatedRoi: number;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const seasons: number[] = [];
  let from: string | null = null;
  let to: string | null = null;
  let sample = 0;
  let skipPoly = false;
  let fast = false;
  let concurrency = 1;
  let quiet = false;
  let outPath: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--season' && args[i + 1]) seasons.push(parseInt(args[++i], 10));
    else if (args[i] === '--from' && args[i + 1]) from = args[++i];
    else if (args[i] === '--to' && args[i + 1]) to = args[++i];
    else if (args[i] === '--sample' && args[i + 1]) sample = parseInt(args[++i], 10);
    else if (args[i] === '--skip-poly') skipPoly = true;
    else if (args[i] === '--fast') fast = true;
    else if (args[i] === '--quiet') quiet = true;
    else if (args[i] === '--concurrency' && args[i + 1]) concurrency = Math.max(1, parseInt(args[++i], 10));
    else if (args[i] === '--out' && args[i + 1]) outPath = args[++i];
  }

  return { seasons, from, to, sample, skipPoly, fast, concurrency, quiet, outPath };
}

function seasonDateRange(season: number): { from: string; to: string } {
  return { from: `${season}-03-20`, to: `${season}-11-15` };
}

function enumerateDates(from: string, to: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function cacheFileFor(label: string, skipPoly: boolean, fast: boolean): string {
  const safe = label.replace(/[^a-zA-Z0-9+_-]/g, '_');
  const fastTag = fast ? '_fast' : '';
  return path.join(CACHE_DIR, `rows_${safe}_poly${skipPoly ? '0' : '1'}${fastTag}.json`);
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

function winnerFromGame(game: MLBGame): string | null {
  if (!game.status.includes('Final')) return null;
  const scores = (game.score || '0-0').split('-');
  if (scores.length !== 2) return null;
  const awayScore = parseInt(scores[0], 10);
  const homeScore = parseInt(scores[1], 10);
  if (isNaN(awayScore) || isNaN(homeScore)) return null;
  if (awayScore === homeScore) return null;
  return awayScore > homeScore ? game.awayTeam : game.homeTeam;
}

function teamsMatch(a: string, b: string): boolean {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return al.includes(bl) || bl.includes(al);
}

function pickWon(valueTeam: string | null, winner: string): boolean | null {
  if (!valueTeam) return null;
  return teamsMatch(valueTeam, winner);
}

function extractFlags(advantages: string[] = []): string[] {
  const keys = ['SWEEP', 'CLINCH', 'REVENGE', 'PLAYOFF', 'ELITE', 'HOT', 'PITCH', 'MISMATCH'];
  return advantages.filter((a) => keys.some((k) => a.toUpperCase().includes(k)));
}

function actionBucket(action: string): string {
  if (action.startsWith('HIGH CONVICTION')) return 'HIGH CONVICTION';
  if (action.startsWith('LEAN')) return 'LEAN';
  if (action.startsWith('PRESEASON')) return 'PRESEASON';
  if (action.startsWith('VETO')) return 'VETO';
  if (action.startsWith('PASS')) return 'PASS';
  if (action.startsWith('Value Play')) return 'VALUE PLAY';
  return 'OTHER';
}

function summarize(rows: BacktestRow[], label: string): BacktestSummary {
  const picks = rows.filter((r) => r.valueTeam);
  const wins = picks.filter((r) => r.pickWon === true);
  const polyRoute = picks.filter((r) => r.executionRoute === 'POLY');

  const bands: Record<string, { picks: number; wins: number; wr: number }> = {
    '80+': { picks: 0, wins: 0, wr: 0 },
    '70-79': { picks: 0, wins: 0, wr: 0 },
    '60-69': { picks: 0, wins: 0, wr: 0 },
    '<60': { picks: 0, wins: 0, wr: 0 },
  };

  for (const r of picks) {
    const band = r.alpha >= 8 ? '80+' : r.alpha >= 7 ? '70-79' : r.alpha >= 6 ? '60-69' : '<60';
    bands[band].picks++;
    if (r.pickWon) bands[band].wins++;
  }
  for (const b of Object.values(bands)) {
    b.wr = b.picks ? (b.wins / b.picks) * 100 : 0;
  }

  const byActionPrefix: Record<string, { picks: number; wins: number; wr: number }> = {};
  for (const r of picks) {
    const bucket = actionBucket(r.recommendedAction);
    if (!byActionPrefix[bucket]) byActionPrefix[bucket] = { picks: 0, wins: 0, wr: 0 };
    byActionPrefix[bucket].picks++;
    if (r.pickWon) byActionPrefix[bucket].wins++;
  }
  for (const a of Object.values(byActionPrefix)) {
    a.wr = a.picks ? (a.wins / a.picks) * 100 : 0;
  }

  const hc = picks.filter((r) => r.recommendedAction.startsWith('HIGH CONVICTION'));
  const hcWins = hc.filter((r) => r.pickWon).length;

  const bankroll = 800;
  let simulatedWagered = 0;
  let simulatedPnl = 0;
  for (const r of picks) {
    const stake = getSizing(r.confidence, bankroll).amount;
    if (stake <= 0) continue;
    simulatedWagered += stake;
    simulatedPnl += r.pickWon ? stake * 0.87 : -stake;
  }

  return {
    label,
    games: rows.length,
    picks: picks.length,
    wins: wins.length,
    losses: picks.filter((r) => r.pickWon === false).length,
    winRate: picks.length ? (wins.length / picks.length) * 100 : 0,
    polyMatched: rows.filter((r) => r.polyMatched).length,
    polyRoutePicks: polyRoute.length,
    polyRouteWins: polyRoute.filter((r) => r.pickWon).length,
    polyRouteWr: polyRoute.length
      ? (polyRoute.filter((r) => r.pickWon).length / polyRoute.length) * 100
      : 0,
    highConviction: {
      picks: hc.length,
      wins: hcWins,
      wr: hc.length ? (hcWins / hc.length) * 100 : 0,
    },
    byAlphaBand: bands,
    byActionPrefix,
    simulatedPnl,
    simulatedWagered,
    simulatedRoi: simulatedWagered ? (simulatedPnl / simulatedWagered) * 100 : 0,
  };
}

function formatReport(summary: BacktestSummary, rows: BacktestRow[]): string {
  const lines: string[] = [
    `# MLB Historical Backtest — ${summary.label}`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Model: current pillar-analyzer weights (no agent memory)`,
    ``,
    `## Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Final games | ${summary.games} |`,
    `| Model picks (valueTeam set) | ${summary.picks} |`,
    `| Wins / Losses | ${summary.wins} / ${summary.losses} |`,
    `| **Win rate** | **${summary.winRate.toFixed(1)}%** |`,
    `| Polymarket matched | ${summary.polyMatched} (${summary.games ? ((summary.polyMatched / summary.games) * 100).toFixed(0) : 0}% of games) |`,
    `| POLY execution route | ${summary.polyRoutePicks} picks, ${summary.polyRouteWr.toFixed(1)}% WR |`,
    `| HIGH CONVICTION actions | ${summary.highConviction.picks} picks, ${summary.highConviction.wr.toFixed(1)}% WR |`,
    `| Simulated PnL (sized) | $${summary.simulatedPnl.toFixed(0)} on $${summary.simulatedWagered.toFixed(0)} wagered (${summary.simulatedRoi.toFixed(1)}% ROI) |`,
    ``,
    `## By unified alpha band`,
    ``,
    `| Band | Picks | WR |`,
    `|------|-------|-----|`,
  ];

  for (const [band, s] of Object.entries(summary.byAlphaBand)) {
    if (s.picks > 0) lines.push(`| ${band} | ${s.picks} | ${s.wr.toFixed(1)}% |`);
  }

  lines.push(``, `## By action type`, ``, `| Action | Picks | WR |`, `|--------|-------|-----|`);
  for (const [action, s] of Object.entries(summary.byActionPrefix)) {
    lines.push(`| ${action} | ${s.picks} | ${s.wr.toFixed(1)}% |`);
  }

  const losses = rows.filter((r) => r.valueTeam && r.pickWon === false).slice(0, 20);
  if (losses.length) {
    lines.push(``, `## Sample losses`, ``);
    for (const r of losses) {
      lines.push(
        `- ${r.date} ${r.matchup}: picked **${r.valueTeam}**, won **${r.winner}** (α=${r.alpha.toFixed(2)}, ${r.recommendedAction.slice(0, 60)})`
      );
    }
  }

  return lines.join('\n');
}

function topNDaily(rows: BacktestRow[], n: number): BacktestRow[] {
  const byDate = new Map<string, BacktestRow[]>();
  for (const r of rows) {
    if (!r.valueTeam) continue;
    const bucket = byDate.get(r.date) || [];
    bucket.push(r);
    byDate.set(r.date, bucket);
  }
  const out: BacktestRow[] = [];
  for (const date of [...byDate.keys()].sort()) {
    const day = byDate.get(date)!.sort((a, b) => b.alpha - a.alpha);
    out.push(...day.slice(0, n));
  }
  return out;
}

function formatConcentrationReport(rows: BacktestRow[], label: string): string {
  const lines: string[] = [
    `## Slate concentration (${label})`,
    ``,
    `Per-day ranking by unified alpha — mirrors sovereign report shortlist.`,
    ``,
    `| Slice | Picks | WR |`,
    `|-------|------:|---:|`,
  ];
  for (const n of [1, 3, 5]) {
    const slice = topNDaily(rows, n);
    const picks = slice.length;
    const wins = slice.filter((r) => r.pickWon).length;
    const wr = picks ? (wins / picks) * 100 : 0;
    lines.push(`| Top ${n} / day | ${picks} | ${wr.toFixed(1)}% |`);
  }
  const all = rows.filter((r) => r.valueTeam);
  const allWins = all.filter((r) => r.pickWon).length;
  lines.push(`| All picks | ${all.length} | ${all.length ? ((allWins / all.length) * 100).toFixed(1) : '0.0'}% |`);
  return lines.join('\n');
}

async function processGame(
  mlb: MLBApi,
  analyzer: PillarAnalyzer,
  resolver: ReturnType<typeof loadSlateBook>['resolver'],
  game: MLBGame,
  date: string,
  skipPoly: boolean,
  fast: boolean,
): Promise<BacktestRow | null> {
  const winner = winnerFromGame(game);
  if (!winner) return null;

  let hydrated;
  try {
    hydrated = await mlb.getHydratedAnalysisData(game);
  } catch (e) {
    console.warn(`  hydrate fail ${game.gamePk}:`, e);
    return null;
  }

  let polyMarket = undefined;
  let polyMatched = false;

  if (!skipPoly) {
    try {
      const resolved = await resolver.resolveHistoricalMoneyline(
        game.homeTeam,
        game.awayTeam,
        date,
        game.date,
        { skipKickoff: fast, skipGatewayRefresh: fast },
      );
      if (resolved) {
        polyMarket = resolved;
        polyMatched = true;
      }
    } catch {
      /* poly optional for backtest */
    }
  }

  const analysis = analyzer.analyzeGame(
    game,
    hydrated.details,
    polyMarket,
    [...hydrated.homeHot, ...hydrated.awayHot],
    [],
    hydrated.playerStats,
    800,
    hydrated.rosters,
    undefined,
    hydrated.platoonSplits,
    hydrated.bullpenFatigue,
    hydrated.lineupHandedness,
    hydrated.teamForm,
    game.series ?? hydrated.currentSeries,
    hydrated.seasonSeries,
    hydrated.playoffContext,
  );

  const alpha = computeUnifiedAlpha(analysis.overallConfidence, analysis.polyEV);
  const valueTeam = analysis.valueTeam ?? null;

  return {
    date,
    gamePk: game.gamePk,
    matchup: `${game.awayTeam} @ ${game.homeTeam}`,
    winner,
    valueTeam,
    alpha,
    confidence: analysis.overallConfidence,
    polyEV: analysis.polyEV ?? null,
    executionRoute: analysis.executionRoute ?? 'NONE',
    recommendedAction: analysis.recommendedAction,
    pickWon: pickWon(valueTeam, winner),
    polyMatched,
    flags: extractFlags(analysis.advantages),
  };
}

async function main() {
  const { seasons, from, to, sample, skipPoly, fast, concurrency, quiet, outPath } = parseArgs();
  if (quiet) process.env.BACKTEST_QUIET = '1';

  let dateList: string[] = [];
  if (from && to) {
    dateList = enumerateDates(from, to);
  } else if (seasons.length) {
    for (const s of seasons) {
      const range = seasonDateRange(s);
      dateList.push(...enumerateDates(range.from, range.to));
    }
  } else {
    console.error('Provide --season YYYY and/or --from / --to');
    process.exit(1);
  }

  if (sample > 0) {
    const step = Math.max(1, Math.floor(dateList.length / sample));
    dateList = dateList.filter((_, i) => i % step === 0).slice(0, sample);
  }

  const label = seasons.length ? seasons.join('+') : `${from}_${to}`;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const cachePath = cacheFileFor(label, skipPoly, fast);

  const mlb = new MLBApi();
  const analyzer = new PillarAnalyzer();
  const { api: polyApi, resolver } = loadSlateBook();

  if (!skipPoly) {
    process.stdout.write('Loading closed Polymarket sports markets... ');
    const closed = await polyApi.getClosedSportsMarkets();
    console.log(`${closed.length} cached`);
  }

  let rows: BacktestRow[] = [];
  const processedDates = new Set<string>();

  if (fs.existsSync(cachePath) && !process.env.FORCE_BACKTEST) {
    rows = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    for (const r of rows) processedDates.add(r.date);
    console.log(`Resuming: ${rows.length} cached rows (${processedDates.size} dates)`);
  }

  console.log(`Backtest ${label}: ${dateList.length} dates, poly=${!skipPoly}, fast=${fast}, concurrency=${concurrency}`);

  for (let di = 0; di < dateList.length; di++) {
    const date = dateList[di];
    if (processedDates.has(date) && !process.env.FORCE_BACKTEST) continue;

    process.stdout.write(`[${di + 1}/${dateList.length}] ${date} `);

    let games: MLBGame[];
    try {
      games = await mlb.getSchedule(date);
    } catch (e) {
      console.log(`schedule error`);
      continue;
    }

    const finals = games.filter((g) => g.status.includes('Final'));
    let dayRows = 0;

    const dayResults = await mapPool(finals, concurrency, (game) =>
      processGame(mlb, analyzer, resolver, game, date, skipPoly, fast),
    );
    for (const row of dayResults) {
      if (row) {
        rows.push(row);
        dayRows++;
      }
    }

    fs.writeFileSync(cachePath, JSON.stringify(rows, null, 2));
    console.log(`→ ${dayRows} games (${rows.length} total)`);
  }

  const summary = summarize(rows, label);
  const report = [formatReport(summary, rows), '', formatConcentrationReport(rows, label)].join('\n');

  const reportPath =
    outPath ?? path.join(ROOT, 'reports', `MLB_BACKTEST_${label.replace(/\+/g, '_')}.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report);

  console.log('\n' + report);
  console.log(`\nCache: ${cachePath}`);
  console.log(`Report: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});