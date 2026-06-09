import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function profitToday() {
    const api = new PolymarketApi();

    console.log(`\n📡 Fetching all trades from Polymarket...`);
    const allTrades = await api.getTrades();
    console.log(`✅ Total trades fetched: ${allTrades.length}`);

    // May 24 UTC window (unix seconds)
    const MAY24_START = 1779580800; // 2026-05-24T00:00:00Z
    const MAY24_END   = 1779667200; // 2026-05-25T00:00:00Z

    const todayTrades = allTrades.filter((t: any) => {
        const ts = parseInt(t.match_time || t.timestamp || '0', 10);
        return ts >= MAY24_START && ts < MAY24_END;
    });

    console.log(`\n📅 Trades on 2026-05-24: ${todayTrades.length}`);

    if (todayTrades.length === 0) {
        console.log('No trades found.');
        return;
    }

    // Group by asset_id (outcome token)
    const byAsset = new Map<string, { trades: any[], outcome: string, market: string }>();
    for (const t of todayTrades) {
        const key = t.asset_id;
        if (!byAsset.has(key)) {
            byAsset.set(key, { trades: [], outcome: t.outcome || 'Unknown', market: t.market });
        }
        byAsset.get(key)!.trades.push(t);
    }

    // Fetch market info via CLOB token endpoint for each unique asset
    const tokenPrices = new Map<string, { price: number; closed: boolean; question: string }>();
    for (const assetId of byAsset.keys()) {
        try {
            // CLOB endpoint for token price
            const clobRes = await fetch(`https://clob.polymarket.com/markets/${assetId}`);
            if (clobRes.ok) {
                const d = await clobRes.json();
                if (d && d.token_id) {
                    tokenPrices.set(assetId, {
                        price: parseFloat(d.price || d.last_trade_price || '0'),
                        closed: !!d.closed,
                        question: d.question || ''
                    });
                    continue;
                }
            }
        } catch {}

        try {
            // Gamma endpoint: search by clobTokenIds containing this asset
            const gammaRes = await fetch(`https://gamma-api.polymarket.com/markets?clob_token_ids=${assetId}`);
            if (gammaRes.ok) {
                const markets = await gammaRes.json();
                if (Array.isArray(markets) && markets.length > 0) {
                    const m = markets[0];
                    const outcomes = typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes || [];
                    const prices = typeof m.outcomePrices === 'string' ? JSON.parse(m.outcomePrices) : m.outcomePrices || [];
                    const tokenIds = typeof m.clobTokenIds === 'string' ? JSON.parse(m.clobTokenIds) : m.clobTokenIds || [];
                    const idx = tokenIds.indexOf(assetId);
                    const price = idx >= 0 ? parseFloat(prices[idx] || '0') : parseFloat(prices[0] || '0');
                    tokenPrices.set(assetId, {
                        price,
                        closed: !!m.closed,
                        question: m.question || ''
                    });
                }
            }
        } catch {}
    }

    let totalSpent = 0;
    let totalReturned = 0;
    let totalPnl = 0;

    console.log('\n══════════════════════════════════════════════════════════');
    console.log('   MAY 24, 2026 — POLYMARKET TRADE BREAKDOWN');
    console.log('══════════════════════════════════════════════════════════');

    for (const [assetId, { trades, outcome }] of byAsset.entries()) {
        let spent = 0;
        let sharesBought = 0;
        let returned = 0;
        let sharesSold = 0;

        for (const t of trades) {
            const price = parseFloat(t.price || '0');
            const size  = parseFloat(t.size || '0');
            const side  = (t.side || '').toUpperCase();

            if (side === 'BUY') {
                spent        += price * size;
                sharesBought += size;
            } else if (side === 'SELL') {
                returned     += price * size;
                sharesSold   += size;
            }
        }

        const remainingShares = sharesBought - sharesSold;
        const tokenInfo = tokenPrices.get(assetId);
        const currentPrice = tokenInfo?.price ?? 0;
        const isClosed = tokenInfo?.closed ?? false;
        const question = tokenInfo?.question || outcome;

        const unrealizedValue = remainingShares > 0.01 ? remainingShares * currentPrice : 0;
        const netPnl = returned + unrealizedValue - spent;

        let status: string;
        if (isClosed) {
            status = currentPrice >= 0.99 ? '✅ WIN' : currentPrice <= 0.01 ? '❌ LOSS' : '➖ PUSH';
        } else if (remainingShares <= 0.01) {
            // All sold — net returned tells us the outcome
            status = returned > spent ? '✅ SOLD +' : '❌ SOLD -';
        } else {
            status = '⏳ LIVE';
        }

        totalSpent    += spent;
        totalReturned += returned + unrealizedValue;
        totalPnl      += netPnl;

        const timeStr = new Date(parseInt(trades[0].match_time) * 1000).toUTCString();

        console.log(`\n  ${status}  ${outcome}`);
        if (question && question !== outcome) console.log(`        Q: ${question.slice(0, 80)}`);
        console.log(`        Token Price: $${currentPrice.toFixed(3)} | Closed: ${isClosed}`);
        console.log(`        Bought: ${sharesBought.toFixed(2)} shares | Cost: $${spent.toFixed(2)}`);
        if (sharesSold > 0) console.log(`        Sold:   ${sharesSold.toFixed(2)} shares | Returned: $${returned.toFixed(2)}`);
        if (remainingShares > 0.01) console.log(`        Held:   ${remainingShares.toFixed(2)} shares × $${currentPrice.toFixed(3)} = $${unrealizedValue.toFixed(2)}`);
        console.log(`        PnL:    ${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(2)}`);
        console.log(`        Time:   ${timeStr}`);
    }

    console.log('\n══════════════════════════════════════════════════════════');
    console.log(`  TOTAL WAGERED  : $${totalSpent.toFixed(2)}`);
    console.log(`  TOTAL RETURNED : $${totalReturned.toFixed(2)}`);
    console.log(`  NET PROFIT     : ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
    console.log('══════════════════════════════════════════════════════════\n');

    // Print all raw asset IDs for manual verification
    console.log('\n📋 All asset IDs from today:');
    for (const [assetId, { outcome }] of byAsset.entries()) {
        console.log(`  ${outcome}: ${assetId}`);
    }
}

profitToday().catch(console.error);
