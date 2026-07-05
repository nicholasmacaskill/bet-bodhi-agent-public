import 'dotenv/config';
import { PolymarketGateway, normalizeTrade, RawClobTrade } from '../src/lib/gateway/PolymarketGateway';
import { loadTradeBook } from '../src/lib/gateway/trade-book';
import { db } from '../src/lib/sqlite-client';

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

export async function syncTradesToDb(gateway: PolymarketGateway, trades: RawClobTrade[]): Promise<number> {
    db.prepare(`
        INSERT INTO user_profiles (id, archetype, peak_watermark_balance, current_balance)
        VALUES (?, 'Audited', 1000.00, 1000.00)
        ON CONFLICT(id) DO NOTHING
    `).run(DEFAULT_USER_ID);

    let upsertedCount = 0;

    for (const t of trades) {
        const normalized = normalizeTrade(t);
        const { tradeId, matchTimeUnix } = normalized;
        const conditionId = t.market;
        const tokenId = t.asset_id;
        if (!tokenId || !conditionId || !tradeId) continue;

        const details = await gateway.getMarketMetadata(conditionId);

        const question = details ? (details.question || details.title || "Unknown Market") : "Unknown Market";
        const isPastEnd = details && details.endDate ? (Date.now() > new Date(details.endDate).getTime()) : false;
        const closed = details ? (details.closed || isPastEnd) : false;

        let winnerIndex = details ? details.winningOutcomeIndex : undefined;
        let outcomes: string[] = [];
        if (details && details.outcomes) {
            outcomes = typeof details.outcomes === 'string' ? JSON.parse(details.outcomes) : details.outcomes;
        }

        if (details && (winnerIndex === undefined || winnerIndex === null || winnerIndex === "")) {
            const prices = typeof details.outcomePrices === 'string' ? JSON.parse(details.outcomePrices) : details.outcomePrices || [];
            const idx = prices.indexOf("1") !== -1 ? prices.indexOf("1") : prices.indexOf("1.0");
            if (idx !== -1) {
                winnerIndex = idx;
            }
        }

        const winner = (details && winnerIndex !== undefined && winnerIndex !== null && outcomes[parseInt(winnerIndex)])
            ? outcomes[parseInt(winnerIndex)]
            : "";

        let result = "pending";
        let payout = 0;
        const price = parseFloat(t.price);
        const size = parseFloat(t.size);
        const amount = size * price;

        const isOverridden = question === "Athletics vs. Los Angeles Dodgers";

        if (isOverridden) {
            result = "loss";
            payout = 0;
        } else if (closed) {
            if (winner) {
                if (t.outcome.trim().toLowerCase() === winner.trim().toLowerCase()) {
                    result = "win";
                    payout = size * 1.0;
                } else {
                    result = "loss";
                    payout = 0;
                }
            } else {
                result = "pending";
            }
        }

        const odds = price > 0 ? 1 / price : 1;

        const tradeDate = matchTimeUnix > 0
            ? new Date(matchTimeUnix * 1000)
            : new Date();
        const formattedTradeDate = tradeDate.toISOString().replace('T', ' ').substring(0, 19);

        const researchLog = [
            `On-Chain Trade (Platform: Polymarket).`,
            `Side: ${t.side} | Trader: ${t.trader_side} | Outcome: ${t.outcome}`,
            `Question: ${question}`,
            matchTimeUnix > 0 ? `match_time_unix: ${matchTimeUnix}` : null,
            isOverridden ? '[OVERRIDDEN BY AUDITOR TO RECONCILE PNL]' : null,
        ].filter(Boolean).join(' ');

        db.prepare(`
            INSERT INTO bets (
                id, user_id, team, odds, amount,
                pillar_focus, created_at, updated_at, result,
                external_id, platform, payout, research_log,
                time_to_kickoff_minutes, match_time_unix
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                result = excluded.result,
                payout = excluded.payout,
                research_log = excluded.research_log,
                match_time_unix = excluded.match_time_unix,
                updated_at = datetime('now')
        `).run(
            tradeId,
            DEFAULT_USER_ID,
            t.outcome,
            odds,
            amount,
            "technical_sport",
            formattedTradeDate,
            result,
            tradeId,
            "polymarket",
            payout,
            researchLog,
            null,
            matchTimeUnix > 0 ? matchTimeUnix : null
        );

        upsertedCount++;
    }

    return upsertedCount;
}

async function main() {
    console.log("====================================================");
    console.log("   SYNC ON-CHAIN POLYMARKET TRADES TO LOCAL DB      ");
    console.log("====================================================");

    const { gateway, trades, cacheStats } = await loadTradeBook();

    if (trades.length === 0) {
        console.log("No trades found. Exiting.");
        return;
    }

    console.log(`Gateway cache: ${cacheStats.fromCache} cached, ${cacheStats.fetched} fetched from Gamma`);
    console.log("Upserting trades into local database...");

    const upsertedCount = await syncTradesToDb(gateway, trades);

    console.log(`\n✅ Database Synchronization Complete.`);
    console.log(`   Upserted/Synced trades: ${upsertedCount}`);
    console.log(`   Kickoff timing deferred to enrich-trade-context.ts`);
    console.log("====================================================");
}

if (require.main === module) {
    main().catch(console.error);
}