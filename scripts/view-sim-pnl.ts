import fs from 'fs';
import path from 'path';
import { SimTrade } from './polymarket-arb-scanner';

const SIM_LOG_PATH = path.resolve(__dirname, '../data/arb_sim_history.json');
const BANKROLL     = 1000.00;

// ANSI colors
const RESET   = "\x1b[0m";
const BOLD    = "\x1b[1m";
const GREEN   = "\x1b[32m";
const YELLOW  = "\x1b[33m";
const RED     = "\x1b[31m";
const CYAN    = "\x1b[36m";
const GRAY    = "\x1b[90m";
const MAGENTA = "\x1b[35m";

function formatUSD(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}$${n.toFixed(2)}`;
}

function main() {
  if (!fs.existsSync(SIM_LOG_PATH)) {
    console.log(`\n${YELLOW}No simulation history found at ${SIM_LOG_PATH}.${RESET}`);
    console.log(`${GRAY}Start the scanner to begin accumulating simulated trades.${RESET}\n`);
    return;
  }

  const trades: SimTrade[] = JSON.parse(fs.readFileSync(SIM_LOG_PATH, 'utf-8'));

  if (trades.length === 0) {
    console.log(`\n${YELLOW}No trades logged yet.${RESET}\n`);
    return;
  }

  // ── Aggregations ───────────────────────────────────────────────────────────
  const total       = trades.length;
  const successful  = trades.filter(t => !t.legFailed);
  const failed      = trades.filter(t =>  t.legFailed);
  const merges      = trades.filter(t => t.type === 'MERGE');
  const splits      = trades.filter(t => t.type === 'SPLIT');
  const totalVol    = trades.reduce((s, t) => s + t.tradeSize, 0);
  const totalGross  = trades.reduce((s, t) => s + t.grossProfit, 0);
  const totalGas    = trades.reduce((s, t) => s + t.gasFee, 0);
  const totalLoss   = trades.reduce((s, t) => s + t.legLoss, 0);
  const totalNet    = trades.reduce((s, t) => s + t.netProfit, 0);
  const avgYield    = trades.reduce((s, t) => s + t.yieldPct, 0) / total;
  const roiPct      = (totalNet / BANKROLL) * 100;

  // ── Time range ─────────────────────────────────────────────────────────────
  const first = new Date(trades[0].timestamp);
  const last  = new Date(trades[trades.length - 1].timestamp);
  const hours = Math.max(1, (last.getTime() - first.getTime()) / 3_600_000);
  const perDay = (totalNet / hours) * 24;

  // ── Recent Trades (last 10) ────────────────────────────────────────────────
  const recent = trades.slice(-10).reverse();

  // ── Render ─────────────────────────────────────────────────────────────────
  console.log(`\n${CYAN}${BOLD}╔═══════════════════════════════════════════════════╗${RESET}`);
  console.log(`${CYAN}${BOLD}║   BODHI ARB SIMULATION — PnL DASHBOARD            ║${RESET}`);
  console.log(`${CYAN}${BOLD}╚═══════════════════════════════════════════════════╝${RESET}`);
  console.log(`${GRAY}Period: ${first.toLocaleString()} → ${last.toLocaleString()}${RESET}\n`);

  console.log(`${BOLD}📊 TRADE SUMMARY${RESET}`);
  console.log(`  Total Trades  : ${BOLD}${total}${RESET}  (${merges.length} Merge / ${splits.length} Split)`);
  console.log(`  Successful    : ${GREEN}${successful.length}${RESET}`);
  console.log(`  Leg Failures  : ${failed.length > 0 ? RED : GRAY}${failed.length}${RESET}`);
  console.log(`  Total Volume  : $${totalVol.toFixed(2)} USDC\n`);

  console.log(`${BOLD}💰 PnL BREAKDOWN${RESET}`);
  console.log(`  Gross Profit  : ${GREEN}${formatUSD(totalGross)}${RESET}`);
  console.log(`  Gas Fees      : ${RED}-$${totalGas.toFixed(2)}${RESET}`);
  console.log(`  Leg Losses    : ${failed.length > 0 ? RED : GRAY}-$${totalLoss.toFixed(2)}${RESET}`);
  console.log(`  ─────────────────────────────`);
  console.log(`  Net PnL       : ${totalNet >= 0 ? GREEN : RED}${BOLD}${formatUSD(totalNet)} USDC${RESET}`);
  console.log(`  ROI           : ${totalNet >= 0 ? GREEN : RED}${BOLD}${roiPct >= 0 ? '+' : ''}${roiPct.toFixed(3)}% on $${BANKROLL} bankroll${RESET}`);
  console.log(`  Avg Yield/Trade: ${MAGENTA}${avgYield.toFixed(2)}%${RESET}`);
  console.log(`  Projected/Day : ${totalNet >= 0 ? GREEN : RED}${BOLD}${formatUSD(perDay)} USDC${RESET}\n`);

  console.log(`${BOLD}🕐 RECENT TRADES (last 10)${RESET}`);
  console.log(`${'  Time'.padEnd(22)} ${'Type'.padEnd(7)} ${'Yield'.padEnd(9)} ${'Size'.padEnd(8)} ${'Net'.padEnd(10)} ${'Status'}`);
  console.log(`  ${GRAY}${'─'.repeat(72)}${RESET}`);
  for (const t of recent) {
    const time   = new Date(t.timestamp).toLocaleTimeString();
    const type   = t.type.padEnd(7);
    const yld    = `${t.yieldPct.toFixed(2)}%`.padEnd(9);
    const size   = `$${t.tradeSize.toFixed(2)}`.padEnd(8);
    const net    = `${t.netProfit >= 0 ? '+' : ''}$${t.netProfit.toFixed(2)}`.padEnd(10);
    const status = t.legFailed
      ? `${YELLOW}⚠ LEG FAIL${RESET}`
      : (t.netProfit >= 0 ? `${GREEN}✓ WIN${RESET}` : `${RED}✗ LOSS${RESET}`);
    console.log(`  ${time.padEnd(20)} ${type} ${yld} ${size} ${net} ${status}`);
  }
  console.log('');
}

main();
