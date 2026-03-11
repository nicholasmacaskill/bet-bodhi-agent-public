import { supabaseAdmin } from './src/lib/supabase-admin';
import 'dotenv/config';

async function debugPulse() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    console.log("Checking bets since:", oneWeekAgo.toISOString());

    const { data, error } = await supabaseAdmin
        .from('bets')
        .select('id, emotional_pulse, created_at')
        .gte('created_at', oneWeekAgo.toISOString())
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        console.log("No bets found in the last 7 days.");
        return;
    }

    console.log(`Found ${data.length} bets in the last 7 days.`);
    data.forEach(b => {
        console.log(`Bet ID: ${b.id} | Pulse: ${b.emotional_pulse} | Date: ${b.created_at}`);
    });

    const pulses = data.filter(b => b.emotional_pulse != null).map(b => Number(b.emotional_pulse));
    if (pulses.length > 0) {
        console.log("Min Pulse:", Math.min(...pulses));
        console.log("Max Pulse:", Math.max(...pulses));
    } else {
        console.log("No non-null pulses found.");
    }
}

debugPulse();
