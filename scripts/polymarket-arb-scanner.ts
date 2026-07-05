import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PolymarketApi, PolyMarket } from '../src/lib/polymarket-api';
import { sendTelegramAlert } from '../src/lib/agent/telegram-notify';

// ─── Simulation Config ───────────────────────────────────────────────────────
const SIM_UNIT_SIZE_USD   = 50.00;  // Max capital deployed per trade
const GAS_FEE_USD         = 0.05;   // Polygon gas fee estimate per transaction
const LEGGING_FAIL_RATE   = 0.01;   // 1% chance second leg fails
const LEGGING_SLIP_PCT    = 0.02;   // 2% of trade size lost on failed exit
const MIN_YIELD_THRESHOLD = 0.001;  // 0.1% — data collection mode (lowered from 0.5%)
const TELE_ALERT_THRESHOLD= 0.01;   // 1.0% — minimum to send Telegram alert
const MAX_SCAN_MARKETS    = 50;     // Top N markets by volume to scan per loop

// ─── Simulation Log Path ─────────────────────────────────────────────────────
const SIM_LOG_PATH = path.resolve(__dirname, '../data/arb_sim_history.json');

// ─── Sim Trade Record Interface ──────────────────────────────────────────────
export interface SimTrade {
  timestamp: string;
  market: string;
  conditionId: string;
  type: 'MERGE' | 'SPLIT';
  yieldPct: number;
  tradeSize: number;
  grossProfit: number;
  gasFee: number;
  legFailed: boolean;
  legLoss: number;
  netProfit: number;
}

// ─── Interface for resolved token mappings ───────────────────────────────────
interface MarketTokens {
  yesTokenId: string;
  noTokenId: string;
}

// ─── Alert throttle cache (5-min cooldown per market) ───────────────────────
const alertHistory = new Map<string, number>();
const ALERT_THROTTLE_MS = 5 * 60 * 1000;

// ─── ANSI Terminal Colors ────────────────────────────────────────────────────
const RESET  = "\x1b[0m";
const BOLD   = "\x1b[1m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const GRAY   = "\x1b[90m";
const CYAN   = "\x1b[36m";
const MAGENTA= "\x1b[35m";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ─── Simulation Logger ───────────────────────────────────────────────────────
function logSimTrade(trade: SimTrade) {
  let history: SimTrade[] = [];
  if (fs.existsSync(SIM_LOG_PATH)) {
    try {
      history = JSON.parse(fs.readFileSync(SIM_LOG_PATH, 'utf-8'));
    } catch { history = []; }
  }
  history.push(trade);
  fs.writeFileSync(SIM_LOG_PATH, JSON.stringify(history, null, 2));
}

// ─── Execute a simulated trade ───────────────────────────────────────────────
function simulateTrade(
  market: PolyMarket,
  type: 'MERGE' | 'SPLIT',
  yieldPct: number,
  maxCapital: number
): SimTrade {
  // Respect depth limit and unit size cap
  const tradeSize = Math.min(SIM_UNIT_SIZE_USD, maxCapital);

  // 1% chance of legging failure (second leg not filled)
  const legFailed = Math.random() < LEGGING_FAIL_RATE;
  const legLoss   = legFailed ? parseFloat((tradeSize * LEGGING_SLIP_PCT).toFixed(4)) : 0;
  const grossProfit = legFailed ? 0 : parseFloat((tradeSize * yieldPct).toFixed(4));
  const netProfit   = parseFloat((grossProfit - GAS_FEE_USD - legLoss).toFixed(4));

  return {
    timestamp:   new Date().toISOString(),
    market:      market.question,
    conditionId: market.conditionId,
    type,
    yieldPct:    parseFloat((yieldPct * 100).toFixed(3)),
    tradeSize,
    grossProfit,
    gasFee:      GAS_FEE_USD,
    legFailed,
    legLoss,
    netProfit,
  };
}

// ─── Token ID Resolution ─────────────────────────────────────────────────────
function getOrResolveTokens(market: PolyMarket): MarketTokens | null {
  if (market.clobTokenIds && market.clobTokenIds.length >= 2) {
    return {
      yesTokenId: market.clobTokenIds[0],
      noTokenId:  market.clobTokenIds[1]
    };
  }
  return null;
}

// ─── Order Book Fetch ────────────────────────────────────────────────────────
async function getBestPrice(tokenId: string): Promise<{ bid: number; bidSize: number; ask: number; askSize: number } | null> {
  try {
    const url = `https://clob.polymarket.com/book?token_id=${tokenId}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`\n${YELLOW}⚠️  Rate limited (429) on CLOB book fetch${RESET}`);
      }
      return null;
    }
    const book = await response.json();

    const asks: any[] = book.asks || [];
    const bids: any[] = book.bids || [];

    let bestAsk = 1.0, askSize = 0;
    if (asks.length > 0) {
      bestAsk = asks.reduce((min, a) => parseFloat(a.price) < min ? parseFloat(a.price) : min, 1.0);
      const obj = asks.find(a => parseFloat(a.price) === bestAsk);
      askSize = obj ? parseFloat(obj.size) : 0;
    }

    let bestBid = 0.0, bidSize = 0;
    if (bids.length > 0) {
      bestBid = bids.reduce((max, b) => parseFloat(b.price) > max ? parseFloat(b.price) : max, 0.0);
      const obj = bids.find(b => parseFloat(b.price) === bestBid);
      bidSize = obj ? parseFloat(obj.size) : 0;
    }

    return { bid: bestBid, bidSize, ask: bestAsk, askSize };
  } catch {
    return null;
  }
}

// ─── Market Scanner ───────────────────────────────────────────────────────────
async function scanMarket(market: PolyMarket) {
  const tokens = getOrResolveTokens(market);
  if (!tokens) return;

  await sleep(150);

  const [yesPrice, noPrice] = await Promise.all([
    getBestPrice(tokens.yesTokenId),
    getBestPrice(tokens.noTokenId)
  ]);
  if (!yesPrice || !noPrice) return;

  // ── CASE A: MERGE ARBITRAGE ──────────────────────────────────────────────
  const mergeCost    = yesPrice.ask + noPrice.ask;
  const mergeProfit  = 1.00 - mergeCost;
  const mergeYield   = mergeProfit / mergeCost;
  const maxMergeCap  = Math.min(yesPrice.askSize, noPrice.askSize) * mergeCost;

  if (mergeProfit > 0 && mergeYield >= MIN_YIELD_THRESHOLD) {
    console.log(`\n🎉 ${GREEN}${BOLD}[MERGE ARB] ${market.question}${RESET}`);
    console.log(`   └ YES ask: $${yesPrice.ask.toFixed(3)} | NO ask: $${noPrice.ask.toFixed(3)} | Sum: $${mergeCost.toFixed(3)}`);
    console.log(`   └ ${BOLD}Yield: ${(mergeYield * 100).toFixed(2)}% | Max Depth Cap: $${maxMergeCap.toFixed(2)}${RESET}`);

    const trade = simulateTrade(market, 'MERGE', mergeYield, maxMergeCap);
    logSimTrade(trade);

    if (trade.legFailed) {
      console.log(`   └ ${YELLOW}[SIM] ⚠️  Leg failure simulated! Loss: -$${trade.legLoss.toFixed(2)} | Net: -$${Math.abs(trade.netProfit).toFixed(2)}${RESET}`);
    } else {
      console.log(`   └ ${MAGENTA}[SIM] ✅ Trade $${trade.tradeSize.toFixed(2)} | Gross: +$${trade.grossProfit.toFixed(2)} | Gas: -$${trade.gasFee} | Net: ${trade.netProfit >= 0 ? '+' : ''}$${trade.netProfit.toFixed(2)} USDC${RESET}`);
    }

    if (mergeYield >= TELE_ALERT_THRESHOLD) {
      await triggerTelegramAlert(market, 'MERGE', mergeYield, trade);
    }
  }

  // ── CASE B: SPLIT ARBITRAGE ──────────────────────────────────────────────
  const splitRevenue = yesPrice.bid + noPrice.bid;
  const splitProfit  = splitRevenue - 1.00;
  const splitYield   = splitProfit / 1.00;
  const maxSplitCap  = Math.min(yesPrice.bidSize, noPrice.bidSize) * 1.00;

  if (splitProfit > 0 && splitYield >= MIN_YIELD_THRESHOLD) {
    console.log(`\n🎉 ${GREEN}${BOLD}[SPLIT ARB] ${market.question}${RESET}`);
    console.log(`   └ YES bid: $${yesPrice.bid.toFixed(3)} | NO bid: $${noPrice.bid.toFixed(3)} | Sum: $${splitRevenue.toFixed(3)}`);
    console.log(`   └ ${BOLD}Yield: ${(splitYield * 100).toFixed(2)}% | Max Depth Cap: $${maxSplitCap.toFixed(2)}${RESET}`);

    const trade = simulateTrade(market, 'SPLIT', splitYield, maxSplitCap);
    logSimTrade(trade);

    if (trade.legFailed) {
      console.log(`   └ ${YELLOW}[SIM] ⚠️  Leg failure simulated! Loss: -$${trade.legLoss.toFixed(2)} | Net: -$${Math.abs(trade.netProfit).toFixed(2)}${RESET}`);
    } else {
      console.log(`   └ ${MAGENTA}[SIM] ✅ Trade $${trade.tradeSize.toFixed(2)} | Gross: +$${trade.grossProfit.toFixed(2)} | Gas: -$${trade.gasFee} | Net: ${trade.netProfit >= 0 ? '+' : ''}$${trade.netProfit.toFixed(2)} USDC${RESET}`);
    }

    if (splitYield >= TELE_ALERT_THRESHOLD) {
      await triggerTelegramAlert(market, 'SPLIT', splitYield, trade);
    }
  }
}

// ─── Telegram Alert ──────────────────────────────────────────────────────────
async function triggerTelegramAlert(
  market: PolyMarket,
  type: 'MERGE' | 'SPLIT',
  yieldPct: number,
  trade: SimTrade
) {
  const cacheKey = `${market.conditionId.substring(0, 10)}:${type}`;
  const now = Date.now();
  if ((now - (alertHistory.get(cacheKey) || 0)) < ALERT_THROTTLE_MS) return;
  alertHistory.set(cacheKey, now);

  const msg =
    `🚨 *BODHI ARB [${type}] DETECTED* 🚨\n\n` +
    `*Market:* ${market.question}\n` +
    `*Yield:* \`${(yieldPct * 100).toFixed(2)}%\`\n` +
    `*[SIM] Trade Size:* $${trade.tradeSize.toFixed(2)}\n` +
    `*[SIM] Net Profit:* $${trade.netProfit.toFixed(2)} USDC\n\n` +
    `*Condition ID:* \`${market.conditionId}\``;

  await sendTelegramAlert(msg, 'Markdown');
}

// ─── Main Daemon ─────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n${CYAN}${BOLD}🏹 BODHI SPLIT-MERGE ARBITRAGE SCANNER${RESET}`);
  console.log(`${GRAY}────────────────────────────────────────────${RESET}`);
  console.log(`${GRAY}Mode: SIMULATION | Unit Size: $${SIM_UNIT_SIZE_USD} | Markets/Loop: ${MAX_SCAN_MARKETS}${RESET}`);
  console.log(`${GRAY}Log: ${SIM_LOG_PATH}${RESET}\n`);

  // Ensure data/ directory exists
  const dataDir = path.resolve(__dirname, '../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const api = new PolymarketApi();
  let loopCount = 1;

  while (true) {
    try {
      console.log(`${GRAY}[${new Date().toLocaleTimeString()}] (Loop #${loopCount}) Fetching markets...${RESET}`);
      const markets = await api.getAllActiveSportsMarkets();

      if (markets.length === 0) {
        console.log(`${YELLOW}No active sports markets found. Sleeping...${RESET}`);
      } else {
        // Prioritize match-up specific markets (e.g., contains 'vs' or '@') and exclude static season-long futures
        const matchupMarkets = markets.filter(m => {
          const q = m.question.toLowerCase();
          if (q.includes('2025') || q.includes('2026') || q.includes('2027')) return false;
          if (q.includes("drivers' champion") || q.includes("championship") || q.includes("winner of the") || q.includes("super bowl") || q.includes("stanley cup") || q.includes("world cup")) return false;
          return q.includes(' vs ') || q.includes(' vs. ') || q.includes(' @ ');
        });

        const finalMarketsList = matchupMarkets.length > 0 ? matchupMarkets : markets;
        const scanList = finalMarketsList.slice(0, MAX_SCAN_MARKETS);
        console.log(`${GRAY}Scanning top ${scanList.length} matchup markets (filtered from ${markets.length} sports markets)...${RESET}`);

        let idx = 1;
        for (const market of scanList) {
          process.stdout.write(`${GRAY}\r[${idx}/${scanList.length}] ${market.question.substring(0, 55)}...${RESET}`);
          await scanMarket(market);
          idx++;
          await sleep(300);
        }
        process.stdout.write(`\r${GREEN}✓ Scan complete — ${scanList.length} markets checked.${RESET}\n`);
      }
    } catch (e: any) {
      console.error(`${RED}Scan error: ${e.message}${RESET}`);
    }

    console.log(`\n${GRAY}Sleeping 45s before next loop...${RESET}\n`);
    await sleep(45 * 1000);
    loopCount++;
  }
}

main().catch((err) => {
  console.error(`${RED}Fatal: ${err.message}${RESET}`);
  process.exit(1);
});
