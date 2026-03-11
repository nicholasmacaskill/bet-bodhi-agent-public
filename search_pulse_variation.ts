import { supabaseAdmin } from './src/lib/supabase-admin';
import 'dotenv/config';

async function searchPulse() {
    const { data, error } = await supabaseAdmin
        .from('bets')
        .select('id, emotional_pulse, created_at, motivation_tag')
        .neq('emotional_pulse', 5);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No bets found with pulse != 5.");
    } else {
        console.log(`Found ${data.length} bets with pulse != 5.`);
        data.forEach(b => {
             console.log(`ID: ${b.id} | Pulse: ${b.emotional_pulse} | Tag: ${b.motivation_tag}`);
        });
    }
}
searchPulse();
