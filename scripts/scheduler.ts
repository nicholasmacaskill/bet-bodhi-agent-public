
import cron from 'node-cron';
import { runReportAndEmail } from './report-and-email';

// Schedule for Noon (12:00) every day
// Format: minute hour dayOfMonth month dayOfWeek
cron.schedule('0 12 * * *', async () => {
    console.log(`[${new Date().toISOString()}] Starting scheduled Noon scan...`);
    try {
        await runReportAndEmail('nicholasmacaskill@proton.me');
        console.log(`[${new Date().toISOString()}] Scheduled scan complete.`);
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Scheduled scan failed:`, error);
    }
}, {
    timezone: "America/New_York"
});

console.log("Bodhi Scheduler: Active and waiting for Noon ET daily.");
