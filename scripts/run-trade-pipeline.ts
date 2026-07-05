/**
 * Single-process nightly pipeline:
 *   1. Fetch trades once (CLOB)
 *   2. Warm Gateway metadata cache once (SQLite-backed)
 *   3. Sync → PnL → Enrich (all cache hits, no redundant Gamma fetches)
 */
import 'dotenv/config';
import { loadTradeBook } from '../src/lib/gateway/trade-book';
import { syncTradesToDb } from './sync-on-chain-to-db';
import { printLivePnL } from './calculate-live-pnl';
import { enrichTradeContext } from './enrich-trade-context';

async function main() {
    const started = Date.now();
    console.log('====================================================');
    console.log('   BODHI TRADE PIPELINE (single process)           ');
    console.log('====================================================');

    const book = await loadTradeBook();
    const { api, gateway, trades, cacheStats } = book;

    if (trades.length === 0) {
        console.log('No trades found. Exiting.');
        return;
    }

    console.log(`\n[1/3] Syncing ${trades.length} trades to SQLite...`);
    console.log(`      Gateway: ${cacheStats.fromCache} cached, ${cacheStats.fetched} fetched`);
    const synced = await syncTradesToDb(gateway, trades);
    console.log(`      Upserted ${synced} rows.`);

    console.log('\n[2/3] Calculating PnL...');
    await printLivePnL(api, gateway, trades);

    console.log('\n[3/3] Enriching trade context (ESPN)...');
    await enrichTradeContext(gateway, trades);

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`\n✅ Pipeline complete in ${elapsed}s`);
    console.log('====================================================');
}

main().catch(console.error);