import { supabaseAdmin } from './src/lib/supabase-admin';
import 'dotenv/config';

async function checkRecentBets() {
    console.log("Fetching the 5 most recent bets...");
    const { data, error } = await supabaseAdmin
        .from('bets')
        .select('*')
        .order('id', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error fetching bets:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No bets found in the database.");
        return;
    }

    data.forEach((bet, i) => {
        console.log(`\n--- Bet ${i + 1} ---`);
        console.log(`Created: ${new Date(bet.created_at).toLocaleString()}`);
        console.log(`Team: ${bet.team}`);
        console.log(`Sport: ${bet.sport}`);
        console.log(`Amount: $${bet.amount}`);
        console.log(`Odds: ${bet.odds}`);
        console.log(`Platform: ${bet.platform || 'N/A'}`);
        console.log(`External ID: ${bet.external_id || 'N/A'}`);
        console.log(`Game Start: ${bet.game_start_time ? new Date(bet.game_start_time).toLocaleString() : 'N/A'}`);
    });
}

checkRecentBets();
