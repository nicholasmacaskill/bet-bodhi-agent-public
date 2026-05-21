import { supabaseAdmin } from '../src/lib/supabase-admin';
import 'dotenv/config';

async function checkTodayBets() {
    // Current date is 2026-05-19 / 2026-05-20 depending on UTC
    console.log("Querying Supabase for recent bets...");
    const { data: bets, error } = await supabaseAdmin
        .from('bets')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error("❌ Error fetching bets:", error);
        return;
    }
    if (!bets || bets.length === 0) {
        console.log("No bets found.");
        return;
    }

    console.log(`\n--- Recent 30 Bets logged in DB ---`);
    bets.forEach(b => {
        console.log(`[${b.created_at}] ${b.team} | Stake: $${b.amount} | Odds: ${b.odds} | Result: ${b.result} | Platform: ${b.platform} | Motivation: ${b.motivation_tag}`);
    });
}

checkTodayBets().catch(console.error);
