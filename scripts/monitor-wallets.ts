/**
 * Bodhi Wallet Monitor v1.0
 * ─────────────────────────
 * Real-time monitoring of high-performing Polymarket traders.
 *
 * Usage:
 *   npx tsx scripts/monitor-wallets.ts                        # run once
 *   npx tsx scripts/monitor-wallets.ts --watch                # re-poll every 60s
 *   npx tsx scripts/monitor-wallets.ts --watch --interval 5   # re-poll every 5 min
 */

import 'dotenv/config';
import { WalletMonitor, MonitoredTrade } from '../src/lib/agent/wallet-monitor';

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');
const intervalArg = args.find((_, i) => args[i - 1] === '--interval');
const intervalMinutes = intervalArg ? parseInt(intervalArg, 10) : 1;

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const MAGENTA = '\x1b[35m';

function header(text: string): string {
    const width = 70;
    const pad = Math.max(0, width - text.length - 2);
    const left = Math.floor(pad / 2);
    const right = pad - left;
    return `${BOLD}${CYAN}╔${'═'.repeat(width - 2)}╗\n║${' '.repeat(left)}${text}${' '.repeat(right)}║\n╚${'═'.repeat(width - 2)}╝${RESET}`;
}

function formatTrade(trade: MonitoredTrade): void {
    const time = new Date(trade.timestamp).toLocaleTimeString();
    const sideColor = trade.side === 'BUY' ? GREEN : YELLOW;
    
    console.log(`\n${BOLD}${MAGENTA}✨ NEW ALPHA TRADE DETECTED${RESET}`);
    console.log(`${DIM}──────────────────────────────────────────────────${RESET}`);
    console.log(`  ${BOLD}Trader:${RESET}    ${trade.trader} (${trade.address})`);
    console.log(`  ${BOLD}Market:${RESET}    ${trade.market}`);
    console.log(`  ${BOLD}Action:${RESET}    ${sideColor}${trade.side} ${trade.outcome}${RESET}`);
    console.log(`  ${BOLD}Size:${RESET}      $${trade.size.toFixed(2)} @ $${trade.price.toFixed(2)}`);
    console.log(`  ${BOLD}Time:${RESET}      ${time}`);
    console.log(`  ${BOLD}Cond ID:${RESET}   ${DIM}${trade.conditionId}${RESET}`);
    console.log(`${DIM}──────────────────────────────────────────────────${RESET}`);
}

async function runMonitor(monitor: WalletMonitor) {
    console.log(`\n${DIM}Syncing Alpha Wallets...${RESET}`);
    const newTrades = await monitor.pollForNewTrades();

    if (newTrades.length > 0) {
        console.log(`${GREEN}✅ Found ${newTrades.length} new trades since last check.${RESET}`);
        // Sort by timestamp ascending for sequential display
        newTrades.sort((a, b) => a.timestamp - b.timestamp);
        newTrades.forEach(formatTrade);
    } else {
        console.log(`${DIM}No new trades found.${RESET}`);
    }
}

async function main() {
    console.log(header('🎯 BODHI POLYMARKET WALLET MONITOR'));
    
    const monitor = new WalletMonitor();
    const traders = monitor.getTraders();
    
    console.log(`\n  ${BOLD}Monitoring Targets:${RESET}`);
    traders.forEach(t => console.log(`  • ${BOLD}${t.username.padEnd(15)}${RESET} ${DIM}${t.note}${RESET}`));
    
    if (watchMode) {
        console.log(`\n${GREEN}${BOLD}Watch mode enabled${RESET} — polling every ${intervalMinutes} minute(s). Press Ctrl+C to stop.\n`);
        await runMonitor(monitor);
        setInterval(async () => {
            await runMonitor(monitor);
        }, intervalMinutes * 60 * 1000);
    } else {
        await runMonitor(monitor);
    }
}

main().catch(err => {
    console.error(`\nFatal error:`, err);
    process.exit(1);
});
