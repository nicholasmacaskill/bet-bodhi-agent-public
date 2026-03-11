import { PolymarketApi } from '../polymarket-api';
import { logBet } from '../bet-logger';
import { supabaseAdmin } from '../supabase-admin';
import 'dotenv/config';

export class SyncService {
    private poly = new PolymarketApi();

    /**
     * Runs the synchronization logic for both Polymarket and SxBet.
     */
    async runSync() {
        console.log("\n🔄 BODHI AUTO-SYNC: Checking for external trades...");
        
        try {
            // 1. Fetch Existing External IDs to avoid duplicates
            const { data: existingBets } = await supabaseAdmin
                .from('bets')
                .select('external_id')
                .not('external_id', 'is', null);
            
            const syncedIds = new Set((existingBets || []).map(b => b.external_id));
            let syncCount = 0;

            // --- POLYMARKET SYNC ---
            const polyTrades = await this.poly.getTrades();
            for (const trade of polyTrades) {
                const extId = `poly-${trade.id || trade.order_id}`;
                if (syncedIds.has(extId)) continue;

                const market = await this.poly.getMarketDetails(trade.condition_id);
                if (market) {
                    await logBet({
                        team: market.title || "Polymarket Event",
                        sport: market.category || "Sports",
                        odds: 1 / parseFloat(trade.price),
                        amount: parseFloat(trade.size) * parseFloat(trade.price),
                        gameStartTime: market.endDate ? new Date(market.endDate) : new Date(),
                        motivationTag: 'external_sync',
                        platform: 'polymarket',
                        externalId: extId,
                        researchLog: `Auto-synced from Polymarket. Outcome: ${trade.side}`
                    });
                    syncCount++;
                }
            }


            if (syncCount > 0) {
                console.log(`✅ Auto-sync complete. Added ${syncCount} new bets.\n`);
            } else {
                console.log(`✨ No new external trades found.\n`);
            }
            
            return syncCount;
        } catch (error: any) {
            console.error(`❌ Auto-sync failed: ${error.message}`);
            return 0;
        }
    }
}
