import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { sendTelegramAlert } from '../src/lib/agent/telegram-notify';

const execAsync = promisify(exec);

async function main() {
    console.log("🚀 Starting Daily MLB Alpha Push...");
    
    // 1. Run the daily scanner
    console.log("Running daily scanner (this may take a minute)...");
    try {
        await execAsync(`npx tsx scripts/daily-scanner.ts --json`);
    } catch (e: any) {
        console.error("Scanner failed:", e);
        await sendTelegramAlert("❌ Daily Scanner failed to run during automated push.");
        return;
    }

    // 2. Read the results
    const resultsPath = path.join(process.cwd(), 'public', 'scan-results.json');
    if (!fs.existsSync(resultsPath)) {
        console.log("No scan results found.");
        return;
    }

    const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
    const results = data.results || [];

    // 3. Filter for MLB and sort by EV
    const mlbPicks = results
        .filter((r: any) => r.sport === 'MLB' && r.analysis && r.analysis.polyEV && r.analysis.polyEV > 0)
        .sort((a: any, b: any) => b.analysis.polyEV - a.analysis.polyEV)
        .slice(0, 10); // Top 10

    if (mlbPicks.length === 0) {
        await sendTelegramAlert("⚾ *Morning Alpha Report:*\nNo positive EV MLB plays detected on Polymarket today.");
        return;
    }

    // 4. Format the Telegram Message
    let msg = `☀️ *MORNING ALPHA REPORT (MLB)* ⚾\n`;
    msg += `Top ${mlbPicks.length} value plays currently on Polymarket:\n\n`;

    mlbPicks.forEach((pick: any, i: number) => {
        const evStr = `+${(pick.analysis.polyEV * 100).toFixed(1)}%`;
        msg += `*${i + 1}. ${pick.matchup}*\n`;
        msg += `   └ 🎯 Pick: *${pick.analysis.valueTeam}* (${evStr} EV)\n`;
        msg += `   └ 💵 Polymarket Price: ${pick.analysis.polySharePrice?.toFixed(3)}\n`;
        msg += `   └ 🧠 Bodhi Confidence: ${pick.analysis.overallConfidence}%\n\n`;
    });

    msg += `_Run /scan in Bot for full details._`;

    // 5. Send to Telegram
    await sendTelegramAlert(msg, 'Markdown');
    console.log("✅ Daily MLB Alpha push complete!");
}

main().catch(console.error);
