import { supabaseAdmin } from '../src/lib/supabase-admin';
import 'dotenv/config';

async function generateReport() {
    console.log("====================================================");
    console.log("   BODHI PERFORMANCE & BIAS REPORT                ");
    console.log("====================================================");

    const { data: bets, error } = await supabaseAdmin
        .from('bets')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("❌ Error fetching bets:", error.message);
        return;
    }

    if (!bets || bets.length === 0) {
        console.log("No betting history found in Supabase.");
        return;
    }

    const totalBets = bets.length;
    const wins = bets.filter(b => b.result === 'win').length;
    const losses = bets.filter(b => b.result === 'loss').length;
    const pending = bets.filter(b => b.result === 'pending').length;
    
    const winRate = totalBets - pending > 0 ? (wins / (totalBets - pending)) * 100 : 0;

    console.log(`\n📊 OVERALL STATS`);
    console.log(`   Total Bets:    ${totalBets}`);
    console.log(`   Wins:          ${wins}`);
    console.log(`   Losses:        ${losses}`);
    console.log(`   Pending:       ${pending}`);
    console.log(`   Win Rate:      ${winRate.toFixed(1)}%`);

    // Pattern: Rush Zone Analysis
    const rushBets = bets.filter(b => b.time_to_kickoff_minutes !== null && b.time_to_kickoff_minutes < 30);
    const rushWins = rushBets.filter(b => b.result === 'win').length;
    const rushRate = rushBets.length > 0 ? (rushWins / rushBets.length) * 100 : 0;

    console.log(`\n⚠️  RUSH ZONE PATTERNS (<30 min before kickoff)`);
    console.log(`   Bets Placed:   ${rushBets.length}`);
    console.log(`   Rush Win Rate: ${rushRate.toFixed(1)}%`);
    if (rushBets.length > 0 && rushRate < winRate) {
        console.log(`   🚨 BIAS DETECTED: Your win rate drops by ${(winRate - rushRate).toFixed(1)}% when rushing.`);
    }

    // Pattern: Motivation Analysis
    console.log(`\n💎 WIN RATE BY MOTIVATION`);
    const motivations = [...new Set(bets.map(b => b.motivation_tag))];
    motivations.forEach(tag => {
        const taggedBets = bets.filter(b => b.motivation_tag === tag && b.result !== 'pending');
        if (taggedBets.length > 0) {
            const tagWins = taggedBets.filter(b => b.result === 'win').length;
            const rate = (tagWins / taggedBets.length) * 100;
            console.log(`   ${(tag || 'none').padEnd(15)}: ${rate.toFixed(1)}% (${taggedBets.length} settled bets)`);
        }
    });

    // Patterns: Emotional/Physiological Correlation
    const highEmotion = bets.filter(b => b.emotional_pulse >= 8 && b.result !== 'pending');
    if (highEmotion.length > 0) {
        const heWins = highEmotion.filter(b => b.result === 'win').length;
        console.log(`\n🧠 EMOTIONAL CORRELATIONS`);
        console.log(`   High Excitement (>=8): ${(heWins / highEmotion.length * 100).toFixed(1)}% WR`);
    }

    console.log("\n====================================================");
}

generateReport();
