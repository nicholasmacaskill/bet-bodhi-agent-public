import 'dotenv/config';
import { supabaseAdmin } from '../src/lib/supabase-admin';
import * as fs from 'fs';
import * as path from 'path';

async function syncResults() {
    const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-24.csv';
    if (!fs.existsSync(csvPath)) {
        console.error('❌ CSV not found at:', csvPath);
        return;
    }

    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.split('\n').filter(l => l.trim() !== '');
    const headers = lines[0].replace(/"/g, '').split(',');
    
    interface CSVRow {
        marketName: string;
        action: string;
        usdcAmount: number;
        tokenAmount: number;
        tokenName: string;
        timestamp: number;
        hash: string;
    }

    const rows: CSVRow[] = lines.slice(1).map(line => {
        // Simple CSV parser for quoted fields
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);

        return {
            marketName: values[0],
            action: values[1],
            usdcAmount: parseFloat(values[2] || '0'),
            tokenAmount: parseFloat(values[3] || '0'),
            tokenName: values[4],
            timestamp: parseInt(values[5] || '0'),
            hash: values[6]
        };
    });

    console.log(`📊 Loaded ${rows.length} rows from CSV.`);

    // Fetch pending bets
    const { data: pendingBets, error: fetchError } = await supabaseAdmin
        .from('bets')
        .select('*')
        .eq('result', 'pending');

    if (fetchError) {
        console.error('❌ Error fetching pending bets:', fetchError.message);
        return;
    }

    console.log(`🔎 Found ${pendingBets?.length} pending bets in Supabase.`);

    if (!pendingBets || pendingBets.length === 0) {
        console.log('✅ No pending bets to sync.');
        return;
    }

    let updatedCount = 0;
    let totalWin = 0;
    let totalLoss = 0;

    for (const bet of pendingBets) {
        // Try to match this bet to a "Buy" in the CSV
        // Matching criteria:
        // 1. Amount matches (within $0.05)
        // 2. Timestamp within 24 hours (for safety)
        
        const betTime = new Date(bet.created_at).getTime() / 1000;
        
        const match = rows.find(r => 
            r.action === 'Buy' && 
            Math.abs(r.usdcAmount - bet.amount) < 0.1 &&
            Math.abs(r.timestamp - betTime) < 86400 // 24 hours
        );

        if (match) {
            // Found the Buy. Now look for the outcome (Redeem or Sell)
            const outcome = rows.find(r => 
                (r.action === 'Redeem' || r.action === 'Sell') && 
                r.marketName === match.marketName &&
                r.timestamp > match.timestamp
            );

            if (outcome) {
                let result: 'win' | 'loss' | 'pending' = 'pending';
                let payout = 0;

                if (outcome.action === 'Sell') {
                    payout = outcome.usdcAmount;
                    result = payout > match.usdcAmount ? 'win' : 'loss';
                } else if (outcome.action === 'Redeem') {
                    // If redeem amount > 0, it's usually a win. 
                    // But in this CSV many redeems are 0.
                    // If we redeemed and got > 0, we won.
                    if (outcome.usdcAmount > 0) {
                        payout = outcome.usdcAmount;
                        result = 'win';
                    } else {
                        // If it's a redeem with 0, we need to be careful.
                        // Often it's a loss.
                        payout = 0;
                        result = 'loss';
                    }
                }

                if (result !== 'pending') {
                    console.log(`✅ Match Found: ${match.marketName}`);
                    console.log(`   Bet ID: ${bet.id}`);
                    console.log(`   Result: ${result.toUpperCase()} | Payout: $${payout.toFixed(2)} | Profit: $${(payout - bet.amount).toFixed(2)}`);

                    // Update Supabase
                    const { error: updateError } = await supabaseAdmin
                        .from('bets')
                        .update({ 
                            result: result, 
                            research_log: `${bet.research_log || ''}\nSync Result: ${result.toUpperCase()} | Payout: $${payout.toFixed(2)}`
                        })
                        .eq('id', bet.id);

                    if (updateError) {
                        console.error(`   ❌ Failed to update bet ${bet.id}:`, updateError.message);
                    } else {
                        updatedCount++;
                        if (result === 'win') totalWin += (payout - bet.amount);
                        else totalLoss += bet.amount;

                        // Update Bankroll
                        const { data: profiles } = await supabaseAdmin.from('user_profiles').select('id, current_balance').limit(1);
                        if (profiles && profiles.length > 0) {
                            const newBalance = Number(profiles[0].current_balance) + payout;
                            await supabaseAdmin.from('user_profiles').update({ current_balance: newBalance }).eq('id', profiles[0].id);
                        }
                    }
                }
            } else {
                // Check if the market is very old (> 3 days) and no redeem/sell found.
                // Could be a loss that never got a redeem record? 
                // Or still active. We'll leave it pending for now.
            }
        }
    }

    console.log(`\n====================================================`);
    console.log(`   SYNC COMPLETE`);
    console.log(`====================================================`);
    console.log(`   Bets Updated:  ${updatedCount}`);
    console.log(`   Total Profit:  $${(totalWin - totalLoss).toFixed(2)}`);
    console.log(`====================================================\n`);
}

syncResults().catch(console.error);
