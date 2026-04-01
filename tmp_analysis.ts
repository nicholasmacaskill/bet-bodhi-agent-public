import { supabaseAdmin } from './src/lib/supabase-admin';
import 'dotenv/config';

async function main() {
    const { data, error } = await supabaseAdmin.from('bets').select('time_to_kickoff_minutes, result, amount, research_log');
    if (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }

    const liveBets = data.filter(b => b.time_to_kickoff_minutes < 0);
    const buckets: Record<string, any[]> = {
        '0 to -30m (Start)': [],
        '-30 to -60m (Early)': [],
        '-60 to -120m (Mid)': [],
        '-120m+ (Late)': []
    };

    liveBets.forEach(b => {
        const t = b.time_to_kickoff_minutes;
        if (t >= -30) buckets['0 to -30m (Start)'].push(b);
        else if (t >= -60) buckets['-30 to -60m (Early)'].push(b);
        else if (t >= -120) buckets['-60 to -120m (Mid)'].push(b);
        else buckets['-120m+ (Late)'].push(b);
    });

    console.log('\n--- LIVE PERFORMANCE BY TIME WINDOW ---');
    Object.entries(buckets).forEach(([name, bets]) => {
        const settled = bets.filter(b => b.result !== 'pending');
        const wins = settled.filter(b => b.result === 'win').length;
        const wr = settled.length > 0 ? (wins / settled.length * 100) : 0;
        
        let profit = 0;
        settled.forEach(b => {
            const match = (b.research_log || '').match(/Payout: \$([0-9.]+)/);
            const payout = match ? parseFloat(match[1]) : (b.result === 'win' ? (b.amount * 2) : 0);
            profit += (payout - b.amount);
        });

        console.log(`${name.padEnd(20)} | Settled: ${settled.length.toString().padEnd(3)} | Win Rate: ${wr.toFixed(1).padStart(5)}% | Profit: $${profit.toFixed(2).padStart(8)}`);
    });
    console.log('\n');
}

main();
