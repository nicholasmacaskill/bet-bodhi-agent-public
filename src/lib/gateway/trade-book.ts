import { PolymarketApi } from '../polymarket-api';
import { PolymarketGateway, RawClobTrade } from './PolymarketGateway';

export const DEFAULT_GATEWAY_OVERRIDES: Record<string, number> = {
    'Athletics vs. Los Angeles Dodgers': 0.00,
};

export function createGateway(config: { delayMs?: number } = {}): PolymarketGateway {
    return new PolymarketGateway({
        persistCache: true,
        delayMs: config.delayMs ?? 80,
        overrides: DEFAULT_GATEWAY_OVERRIDES,
    });
}

export interface TradeBook {
    api: PolymarketApi;
    gateway: PolymarketGateway;
    trades: RawClobTrade[];
    cacheStats: { total: number; fromCache: number; fetched: number };
}

/**
 * Single entry point: fetch CLOB trades once, then warm Gateway metadata cache
 * (memory + SQLite) before sync / PnL / enrichment run.
 */
export async function loadTradeBook(
    api = new PolymarketApi(),
    gateway = createGateway()
): Promise<TradeBook> {
    console.log('[trade-book] Fetching on-chain trade history (once)...');
    const trades = await api.getTrades() as RawClobTrade[];
    console.log(`[trade-book] ${trades.length} trades loaded.`);

    const cacheStats = trades.length > 0
        ? await gateway.ensureMarketsCached(trades)
        : { total: 0, fromCache: 0, fetched: 0 };

    return { api, gateway, trades, cacheStats };
}