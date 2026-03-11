import { supabaseAdmin } from './src/lib/supabase-admin';
import 'dotenv/config';

async function debugManualPulse() {
    const { data, error } = await supabaseAdmin
        .from('bets')
        .select('id, emotional_pulse, motivation_tag, created_at')
        .neq('motivation_tag', 'external_sync')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Recent Manual/Agent Bets:");
    data.forEach(b => {
        console.log(`Bet ID: ${b.id} | Pulse: ${b.emotional_pulse} | Tag: ${b.motivation_tag}`);
    });
}
debugManualPulse();
