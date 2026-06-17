import { Telegraf, Context } from 'telegraf';
import 'dotenv/config';
import { QueryHandler } from './query-handler';

const queryHandler = new QueryHandler();

async function setupQueryHandler() {
    await queryHandler.initVectorStore();
}

setupQueryHandler();

export async function sendTelegramAlert(message: string, parseMode: 'Markdown' | 'HTML' = 'Markdown') {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const adminId = process.env.TELEGRAM_ADMIN_ID;

    if (!token || !adminId) {
        console.warn("⚠️ Telegram credentials missing. Cannot send alert.");
        return;
    }

    const bot = new Telegraf(token);
    try {
        if (parseMode === 'Markdown') {
            await bot.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' });
        } else {
            await bot.telegram.sendMessage(adminId, message, { parse_mode: 'HTML' });
        }
        console.log(`✅ Telegram alert sent to admin: ${adminId}`);
    } catch (e: any) {
        console.error(`❌ Failed to send Telegram alert: ${e.message}`);
    }
}
