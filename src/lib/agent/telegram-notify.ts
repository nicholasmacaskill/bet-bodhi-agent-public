import { Telegraf, Context } from 'telegraf';
import 'dotenv/config';
import { QueryHandler } from './query-handler';

const queryHandler = new QueryHandler();

async function setupQueryHandler() {
    // Vector store initialization removed - using Gemini directly
}

// Initialize and start Telegram bot
console.log('Attempting to initialize Telegram bot...');
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
    console.error('⚠️ TELEGRAM_BOT_TOKEN is not defined in environment variables');
    process.exit(1);
}
console.log('✅ Found TELEGRAM_BOT_TOKEN in environment variables');
const bot = new Telegraf(token);

// Add debug log for checking environment variables
console.log('Verifying environment variables:', {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? '****' + process.env.TELEGRAM_BOT_TOKEN.slice(-4) : 'undefined',
    TELEGRAM_ADMIN_ID: process.env.TELEGRAM_ADMIN_ID
});

// Add debug log for checking environment variables
console.log('Verifying environment variables:', {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? '****' + process.env.TELEGRAM_BOT_TOKEN.slice(-4) : 'undefined',
    TELEGRAM_ADMIN_ID: process.env.TELEGRAM_ADMIN_ID
});

bot.catch((err) => {
    console.error('⚠️ Telegram bot error:', err);
});

bot.use(async (ctx, next) => {
    console.log('Received Telegram update:', ctx.update);
    return next();
});

// Initialize query handler
setupQueryHandler();

// Setup command handlers
bot.command('start', (ctx) => ctx.reply('Welcome to Bodhi Assistant! Ask me anything.'));
bot.command('help', (ctx) => ctx.reply('Available commands:\n/start - Welcome message\n/help - This help menu\n/stats - Get current betting stats\n/history - View recent performance\n/analyze [team] - Run deep analysis'));
bot.command('stats', (ctx) => queryHandler.handleQuery(ctx, 'Current betting statistics'));
bot.command('history', (ctx) => queryHandler.handleQuery(ctx, 'Recent performance history'));
bot.command('analyze', (ctx) => {
    const team = ctx.message.text.split(' ')[1];
    queryHandler.handleQuery(ctx, `Deep analysis for ${team || 'no team specified'}`);
});
bot.on('text', (ctx) => {
    if ('text' in ctx.message) {
        queryHandler.handleQuery({
            message: {
                text: ctx.message.text,
                chat: ctx.message.chat
            },
            reply: ctx.reply
        }, ctx.message.text);
    }
});

// Launch bot
bot.launch().then(() => {
    console.log('✅ Telegram bot started');

    // Enable conversational context persistence
    let chatContext = new Map();

    // Setup interactive message handlers
    bot.on('message', async (ctx) => {
        try {
            const userId = ctx.from?.id;
            const currentContext = chatContext.get(userId) || [];

            // Maintain conversation history (last 3 messages)
            if (currentContext.length >= 3) {
                currentContext.shift();
            }
            if ('text' in ctx.message) {
                currentContext.push(ctx.message.text);
                chatContext.set(userId, currentContext);

                // Handle message normally
                if (!ctx.message.text.startsWith('/')) {
                    await queryHandler.handleQuery(ctx, currentContext.join('\n'));
                }
            }
        } catch (error) {
            console.error('Interactive chat failed:', error);
            await ctx.reply('⚠️ Chat interaction failed');
        }
    });
});

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
