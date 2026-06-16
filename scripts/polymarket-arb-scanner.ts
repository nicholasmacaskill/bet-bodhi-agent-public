import 'dotenv/config';
import { PolymarketApi, PolyMarket } from '../src/lib/polymarket-api';
import { sendTelegramAlert } from '../src/lib/agent/telegram-notify';

// Interface for resolved token mappings
interface MarketTokens {
  yesTokenId: string;
  noTokenId: string;
}

// Memory cache for token ID lookups to avoid hammering Polymarket APIs
const tokenCache = new Map<string, MarketTokens>();

// History to throttle Telegram alerts (one alert per market per 5 minutes)
const alertHistory = new Map<string, number>();
const ALERT_THROTTLE_MS = 5 * 60 * 1000; 

// ANSI Terminal Colors for beautiful logging
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const GRAY = "\x1b[90m";
const CYAN = "\x1b[36m";

// Utility sleep helper
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Extracts token IDs for Yes/No outcomes from the market metadata.
 */
function getOrResolveTokens(market: PolyMarket): MarketTokens | null {
  if (market.clobTokenIds && market.clobTokenIds.length >= 2) {
    return {
      yesTokenId: market.clobTokenIds[0],
      noTokenId: market.clobTokenIds[1]
    };
  }
  return null;
}

/**
 * Fetches the order book for a given token ID and calculates the best bid and ask.
 */
async function getBestPrice(tokenId: string): Promise<{ bid: number; bidSize: number; ask: number; askSize: number } | null> {
  try {
    const url = `https://clob.polymarket.com/book?token_id=${tokenId}`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`\n${YELLOW}⚠️ Rate limited (429) on CLOB book fetch for token ${tokenId}${RESET}`);
      }
      return null;
    }
    const book = await response.json();

    const asks: any[] = book.asks || [];
    const bids: any[] = book.bids || [];

    // Find best ask (lowest price asks)
    let bestAsk = 1.0;
    let askSize = 0;
    if (asks.length > 0) {
      bestAsk = asks.reduce((min, a) => parseFloat(a.price) < min ? parseFloat(a.price) : min, 1.0);
      const bestAskObj = asks.find(a => parseFloat(a.price) === bestAsk);
      askSize = bestAskObj ? parseFloat(bestAskObj.size) : 0;
    }

    // Find best bid (highest price bids)
    let bestBid = 0.0;
    let bidSize = 0;
    if (bids.length > 0) {
      bestBid = bids.reduce((max, b) => parseFloat(b.price) > max ? parseFloat(b.price) : max, 0.0);
      const bestBidObj = bids.find(b => parseFloat(b.price) === bestBid);
      bidSize = bestBidObj ? parseFloat(bestBidObj.size) : 0;
    }

    return { bid: bestBid, bidSize, ask: bestAsk, askSize };
  } catch (err: any) {
    return null;
  }
}

/**
 * Main Arbitrage scanning logic for a single market.
 */
async function scanMarket(market: PolyMarket) {
  const tokens = getOrResolveTokens(market);
  if (!tokens) return;

  // Small delay to avoid aggressive rate limits
  await sleep(150);

  const [yesPrice, noPrice] = await Promise.all([
    getBestPrice(tokens.yesTokenId),
    getBestPrice(tokens.noTokenId)
  ]);

  if (!yesPrice || !noPrice) return;

  // --- CASE A: MERGE ARBITRAGE (Buy CLOB, Merge on-chain) ---
  // We buy YES at YesAsk, NO at NoAsk. Total cost = YesAsk + NoAsk.
  // We merge them on-chain for 1.00 USDC.
  const mergeCost = yesPrice.ask + noPrice.ask;
  const mergeProfit = 1.00 - mergeCost;
  const mergeYield = mergeProfit / mergeCost;
  const maxMergeShares = Math.min(yesPrice.askSize, noPrice.askSize);
  const maxMergeCapital = maxMergeShares * mergeCost;
  const maxMergeProfit = maxMergeShares * mergeProfit;

  // --- CASE B: SPLIT ARBITRAGE (Split on-chain, Sell CLOB) ---
  // We split 1.00 USDC into YES and NO. We sell YES at YesBid, NO at NoBid.
  // Total revenue = YesBid + NoBid.
  const splitRevenue = yesPrice.bid + noPrice.bid;
  const splitProfit = splitRevenue - 1.00;
  const splitYield = splitProfit / 1.00; // Cost is 1.00
  const maxSplitShares = Math.min(yesPrice.bidSize, noPrice.bidSize);
  const maxSplitCapital = maxSplitShares * 1.00;
  const maxSplitProfit = maxSplitShares * splitProfit;

  const minYieldThreshold = 0.005; // 0.5% min yield to output to console
  const telegramAlertThreshold = 0.01; // 1.0% yield to alert via Telegram

  if (mergeProfit > 0 && mergeYield >= minYieldThreshold) {
    console.log(`\n🎉 ${GREEN}${BOLD}[MERGE ARB FIND] ${market.question}${RESET}`);
    console.log(`   └ Target: Buy YES @ $${yesPrice.ask.toFixed(2)} | Buy NO @ $${noPrice.ask.toFixed(2)}`);
    console.log(`   └ Total Cost: $${mergeCost.toFixed(3)} | Profit per share: $${mergeProfit.toFixed(3)}`);
    console.log(`   └ ${BOLD}Yield: ${(mergeYield * 100).toFixed(2)}%${RESET}`);
    console.log(`   └ Max Depth: ${maxMergeShares.toFixed(2)} shares (Cap: $${maxMergeCapital.toFixed(2)} | Max Profit: $${maxMergeProfit.toFixed(2)} USDC)`);
    
    if (mergeYield >= telegramAlertThreshold) {
      await triggerTelegramAlert(market, "MERGE", mergeYield, mergeProfit, maxMergeCapital, maxMergeProfit);
    }
  }

  if (splitProfit > 0 && splitYield >= minYieldThreshold) {
    console.log(`\n🎉 ${GREEN}${BOLD}[SPLIT ARB FIND] ${market.question}${RESET}`);
    console.log(`   └ Target: Sell YES @ $${yesPrice.bid.toFixed(2)} | Sell NO @ $${noPrice.bid.toFixed(2)}`);
    console.log(`   └ Total Rev: $${splitRevenue.toFixed(3)} | Profit per share: $${splitProfit.toFixed(3)}`);
    console.log(`   └ ${BOLD}Yield: ${(splitYield * 100).toFixed(2)}%${RESET}`);
    console.log(`   └ Max Depth: ${maxSplitShares.toFixed(2)} shares (Cap: $${maxSplitCapital.toFixed(2)} | Max Profit: $${maxSplitProfit.toFixed(2)} USDC)`);

    if (splitYield >= telegramAlertThreshold) {
      await triggerTelegramAlert(market, "SPLIT", splitYield, splitProfit, maxSplitCapital, maxSplitProfit);
    }
  }
}

/**
 * Dispatches an alert via Telegram if not throttled.
 */
async function triggerTelegramAlert(
  market: PolyMarket,
  type: "MERGE" | "SPLIT",
  yieldPct: number,
  profitPerShare: number,
  maxCapital: number,
  maxProfit: number
) {
  const cacheKey = `${market.conditionId.substring(0, 10)}:${type}`;
  const now = Date.now();
  const lastAlertTime = alertHistory.get(cacheKey) || 0;

  if (now - lastAlertTime < ALERT_THROTTLE_MS) {
    return; // Throttled
  }

  alertHistory.set(cacheKey, now);

  const alertMessage = `🚨 *BODHI ARB DETECTED (${type})* 🚨\n\n` +
    `*Market:* ${market.question}\n` +
    `*Category:* ${market.category}\n` +
    `*Yield:* \`${(yieldPct * 100).toFixed(2)}%\` ($${profitPerShare.toFixed(3)}/share)\n` +
    `*Max Capacity:* $${maxCapital.toFixed(2)} USDC\n` +
    `*Estimated Profit:* $${maxProfit.toFixed(2)} USDC\n\n` +
    `*Condition ID:* \`${market.conditionId}\`\n`;

  await sendTelegramAlert(alertMessage, 'Markdown');
}

/**
 * Main daemon runner
 */
async function main() {
  console.log(`\n${CYAN}${BOLD}🏹 BODHI SPLIT-MERGE ARBITRAGE SCANNER${RESET}`);
  console.log(`${GRAY}----------------------------------------${RESET}`);
  console.log(`${GRAY}Polling active Polymarket sports lines for risk-free edges...${RESET}\n`);

  const api = new PolymarketApi();
  let loopCount = 1;

  while (true) {
    try {
      console.log(`${GRAY}[${new Date().toLocaleTimeString()}] (Loop #${loopCount}) Fetching active markets...${RESET}`);
      const markets = await api.getActiveSportsMarkets("vs.");

      if (markets.length === 0) {
        console.log(`${YELLOW}No active sports markets found. Sleeping...${RESET}`);
      } else {
        const MAX_SCAN_MARKETS = 20;
        const scanList = markets.slice(0, MAX_SCAN_MARKETS);
        console.log(`${GRAY}Scanning top ${scanList.length} highest-volume markets (out of ${markets.length} total)...${RESET}`);
        let idx = 1;
        for (const market of scanList) {
          process.stdout.write(`${GRAY}\r[${idx}/${scanList.length}] Checking: ${market.question.substring(0, 50)}... (Vol: $${market.volume.toLocaleString()})${RESET}`);
          await scanMarket(market);
          idx++;
          // Wait 300ms between markets to comply with rate limits (100-200 calls/min)
          await sleep(300);
        }
        process.stdout.write(`\r${GREEN}Finished scanning ${scanList.length} markets.${RESET}\n`);
      }
    } catch (e: any) {
      console.error(`${RED}Scan error: ${e.message}${RESET}`);
    }

    console.log(`\n${GRAY}Scan complete. Sleeping for 45 seconds...${RESET}\n`);
    await sleep(45 * 1000);
    loopCount++;
  }
}

main().catch((err) => {
  console.error(`${RED}Fatal error: ${err.message}${RESET}`);
  process.exit(1);
});
