import '../src/lib/sentry';
import cron from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';
import { BodhiWatchdog } from '../src/lib/agent/watchdog';

dotenv.config();
const execAsync = promisify(exec);
const watchdog = new BodhiWatchdog();

async function sendTelegram(text: string) {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_ADMIN_ID) return;
    try {
        const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: process.env.TELEGRAM_ADMIN_ID,
                text,
                parse_mode: 'Markdown'
            })
        });
        console.log(`📡 Telegram alert sent.`);
    } catch (err) {
        console.error(`❌ Telegram push failed:`, err);
    }
}

// 1. SCHEDULE: Nightly Sovereign Scan (2:00 AM)
cron.schedule('0 2 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Starting scheduled 2 AM Sovereign Scan...`);
    try {
        const { stdout, stderr } = await execAsync('npx tsx scripts/scanners/nightly_full_report.ts');
        console.log(stdout);
        if (stderr) console.error(stderr);
        console.log(`[${new Date().toISOString()}] Nightly scan complete.`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Nightly scan failed:`, error);
        await sendTelegram(`❌ *FATAL*: Nightly Sovereign Scan failed. Check server logs.`);
    }
}, {
    timezone: "America/New_York"
});

// 2. SCHEDULE: Watchdog Live Monitor (Every 30 minutes between 10 AM and 11 PM ET)
cron.schedule('*/30 10-23 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running Watchdog check...`);
    try {
        const vetos = await watchdog.checkForChanges();
        for (const veto of vetos) {
            await sendTelegram(veto);
        }
        if (vetos.length > 0) {
            console.log(`📡 Watchdog found ${vetos.length} changes. Alerts sent.`);
        } else {
            console.log(`✅ Watchdog check clean. No structural changes detected.`);
        }
    } catch (error) {
        console.error("Watchdog check failed:", error);
    }
}, {
    timezone: "America/New_York"
});

// 3. SCHEDULE: KBO Live Scanner (Every 10 minutes)
cron.schedule('*/10 * * * *', async () => {
    console.log(`[${new Date().toISOString()}] Running KBO Live Scanner...`);
    try {
        const { stdout, stderr } = await execAsync('npx tsx scripts/kbo-live-scanner.ts');
        if (stdout.includes("MICRO-EDGE CONFIRMED") || stdout.includes("Macro Edge Found")) {
            console.log(stdout); // Only log output if it actually found something interesting
        }
        if (stderr) console.error(stderr);
    } catch (error) {
        console.error("KBO Live Scanner failed:", error);
    }
}, {
    timezone: "America/New_York"
});

console.log("──────────────────────────────────────────────────────────────────────");
console.log("🛡️  BODHI AGENT DAEMON: ACTIVE");
console.log("📡 Mode: Sovereign Scan (2:00 AM) + Watchdog (30m) + KBO Scanner (10m)");
console.log("──────────────────────────────────────────────────────────────────────");
