import 'dotenv/config';
import { supabaseAdmin } from '../src/lib/supabase-admin';
import * as fs from 'fs';

async function removeCrypto() {
    const csvPath = '/Users/nicholasmacaskill/Downloads/Polymarket-History-2026-03-24.csv';
    if (!fs.existsSync(csvPath)) return;

    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.split('\n').filter(l => l.trim() !== '');
    
    interface CSVRow {
        marketName: string;
        action: string;
        usdcAmount: number;
        timestamp: number;
    }

    const rows: CSVRow[] = lines.slice(1).map(line => {
        const values = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') inQuotes = !inQuotes;
            else if (line[i] === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else current += line[i];
        }
        values.push(current);
        return {
            marketName: values[0],
            action: values[1],
            usdcAmount: parseFloat(values[2] || '0'),
            timestamp: parseInt(values[5] || '0')
        };
    });

    const { data: bets } = await supabaseAdmin.from('bets').select('*');
    if (!bets) return;

    const cryptoKeywords = ['bitcoin', 'solana', 'btc', 'eth', 'up or down', 'crypto', 'price of'];
    const idsToDelete: string[] = [];

    for (const bet of bets) {
        if (bet.team !== 'Polymarket Event') continue;

        const betTime = new Date(bet.created_at).getTime() / 1000;
        const match = rows.find(r => 
            r.action === 'Buy' && 
            Math.abs(r.usdcAmount - bet.amount) < 0.1 &&
            Math.abs(r.timestamp - betTime) < 86400
        );

        if (match) {
            if (cryptoKeywords.some(k => match.marketName.toLowerCase().includes(k))) {
                idsToDelete.push(bet.id);
            }
        }
    }

    console.log(`🗑️ Identified ${idsToDelete.length} crypto bets to remove.`);
    if (idsToDelete.length > 0) {
        const { error } = await supabaseAdmin.from('bets').delete().in('id', idsToDelete);
        if (error) console.error('Delete Error:', error.message);
        else console.log('✅ Successfully removed crypto bets.');
    }
}

removeCrypto().catch(console.error);
