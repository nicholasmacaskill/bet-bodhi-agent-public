import 'dotenv/config';
import { Telegraf } from 'telegraf';
import * as fs from 'fs';
import * as path from 'path';

async function pushResults() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminId = process.env.TELEGRAM_ADMIN_ID;

    if (!token || !adminId) {
        console.error("❌ Missing env variables.");
        process.exit(1);
    }

    const bot = new Telegraf(token);
    const resultsPath = path.join(process.cwd(), 'public', 'scan-results.json');

    if (!fs.existsSync(resultsPath)) {
        console.error("❌ No results found.");
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const results = data.results || [];

    const picks = results
        .filter((r: any) => r.analysis && r.analysis.polyEV && r.analysis.polyEV >= 0.02)
        .sort((a: any, b: any) => (b.analysis.polyEV || 0) - (a.analysis.polyEV || 0));

    let msg = `🏛️ **BODHI NOTIFICATION: FRESH SCAN COMPLETE**\n`;
    msg += `📅 ${new Date().toLocaleDateString()} | 🕒 ${new Date().toLocaleTimeString()}\n`;
    msg += `📊 Total scanned: ${results.length} matchups\n\n`;

    if (picks.length > 0) {
        msg += `💎 **ALL VALUE PLAYS DETECTED (PRIORITIZED)**\n`;
        picks.forEach((r: any, i: number) => {
            const emoji = r.sport === 'MLB' ? '⚾' : r.sport === 'NHL' ? '🏒' : r.sport === 'NBA' ? '🏀' : '🥊';
            msg += `${i + 1}. ${emoji} *${r.matchup}* (${(r.analysis.polyEV * 100).toFixed(1)}% EV)\n`;
            msg += `   └ **PICK: ${r.analysis.valueTeam.toUpperCase()}**\n`;
        });
        msg += `\n`;
    } else {
        msg += `✅ No significant values found in this scan.\n`;
    }

    msg += `📑 Use /scan in the bot to see the full technical breakdown.`;

    await bot.telegram.sendMessage(adminId, msg, { parse_mode: 'Markdown' });
    console.log("✅ Results pushed to Telegram admin.");
}

pushResults().catch(console.error);
