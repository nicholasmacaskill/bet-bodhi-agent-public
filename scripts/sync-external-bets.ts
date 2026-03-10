import { SyncService } from '../src/lib/agent/sync-service';
import 'dotenv/config';

async function main() {
    console.log("====================================================");
    console.log("   BODHI EXTERNAL SYNC (CLI WRAPPER)              ");
    console.log("====================================================");

    const syncService = new SyncService();
    const count = await syncService.runSync();

    console.log(`🏁 Sync Finished. Added ${count} new bets to Supabase.`);
    console.log("====================================================");
}

main().catch(console.error);
