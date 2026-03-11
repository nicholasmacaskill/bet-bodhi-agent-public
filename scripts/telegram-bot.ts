import 'dotenv/config';
import { Telegraf, session } from 'telegraf';
import { PolymarketApi } from '../src/lib/polymarket-api';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = process.env.TELEGRAM_ADMIN_ID;

if (!token) {
    console.error("❌ TELEGRAM_BOT_TOKEN is missing in .env");
    process.exit(1);
}

interface BotSession {
    mood?: string;
    calmness?: number;
    sentimentTimestamp?: number;
    state?: 'IDLE' | 'AWAITING_MOOD' | 'AWAITING_CALMNESS';
    pendingCommand?: string;
}

const bot = new Telegraf<any>(token);
bot.use(session());

// Utility: Chunk message for Telegram limit (4096 chars)
async function sendLongMessage(ctx: any, text: string, parseMode: 'Markdown' | 'HTML' = 'Markdown') {
    const CHUNK_LIMIT = 3500;
    if (text.length <= CHUNK_LIMIT) {
        return parseMode === 'Markdown' ? ctx.replyWithMarkdown(text) : ctx.replyWithHTML(text);
    }

    const chunks = [];
    let current = "";
    const lines = text.split('\n');

    for (const line of lines) {
        if ((current + line).length > CHUNK_LIMIT) {
            chunks.push(current);
            current = "";
        }
        current += line + '\n';
    }
    if (current) chunks.push(current);

    for (const chunk of chunks) {
        try {
            if (parseMode === 'Markdown') await ctx.replyWithMarkdown(chunk);
            else await ctx.replyWithHTML(chunk);
            // Throttle slightly to respect Telegram rate limits
            await new Promise(r => setTimeout(r, 450));
        } catch (e: any) {
            console.error(`Chunk delivery failed: ${e.message}`);
            await ctx.reply(chunk); // Fallback to plain text
        }
    }
}

// Middleware: Log everything + Admin check + Session init
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id.toString();
    const text = ctx.message && 'text' in ctx.message ? ctx.message.text : 'non-text';
    console.log(`[${new Date().toISOString()}] User ${userId} sent: ${text}`);

    if (adminId && userId !== adminId) {
        if (ctx.message && 'text' in ctx.message && ctx.message.text === '/start') {
            return next();
        }
        console.log(`[${new Date().toISOString()}] Denied unauthorized access from ${userId}`);
        return ctx.reply("⛔ Unauthorized.");
    }

    if (!ctx.session) ctx.session = { state: 'IDLE' };
    return next();
});

bot.command('ping', (ctx) => {
    console.log(`[${new Date().toISOString()}] Ping received from ${ctx.from.id}`);
    ctx.reply(`🏓 Pong! Admin ID: ${adminId}, Your ID: ${ctx.from.id}`);
});

// Sentiment Flow Logic
async function startSentimentFlow(ctx: any, nextCommand?: string) {
    ctx.session.state = 'AWAITING_MOOD';
    ctx.session.pendingCommand = nextCommand;
    await ctx.reply("🧠 *BODHI SENTIMENT CHECK*\n\nHow are you feeling right now? (e.g. focused, tired, stressed, sharp)", { parse_mode: 'Markdown' });
}

bot.on('text', async (ctx, next) => {
    const state = ctx.session.state;
    const text = ctx.message.text;

    if (state === 'AWAITING_MOOD') {
        ctx.session.mood = text;
        ctx.session.state = 'AWAITING_CALMNESS';
        await ctx.reply("On a scale of 1-10, how *calm* do you feel?", { parse_mode: 'Markdown' });
        return;
    }

    if (state === 'AWAITING_CALMNESS') {
        const val = parseInt(text, 10);
        if (isNaN(val) || val < 1 || val > 10) {
            return ctx.reply("Please provide a number between 1 and 10.");
        }
        ctx.session.calmness = val;
        ctx.session.sentimentTimestamp = Date.now();
        ctx.session.state = 'IDLE';
        await ctx.reply(`✅ *Sentiment Locked:* ${ctx.session.mood} (${ctx.session.calmness}/10)\nRisk parameters adjusted.`, { parse_mode: 'Markdown' });

        if (ctx.session.pendingCommand) {
            ctx.session.pendingCommand = undefined;
            return unifiedScan(ctx);
        }
        return;
    }

    return next();
});

bot.command('sentiment', (ctx) => startSentimentFlow(ctx));

async function ensureSentiment(ctx: any, command: string) {
    const lastCheck = ctx.session.sentimentTimestamp || 0;
    const hoursSince = (Date.now() - lastCheck) / (1000 * 60 * 60);

    if (hoursSince > 4) {
        await startSentimentFlow(ctx, command);
        return false;
    }
    return true;
}

// ─── Unified Analysis Flow ──────────────────────────────────────────────────

async function unifiedScan(ctx: any) {
    const statusMsg = await ctx.reply("📄 *BODHI IS ANALYZING THE SLATE*...\nSyncing liquidity and calculating technical pillars...", { parse_mode: 'Markdown' });
    try {
        const mood = ctx.session.mood || "sharp";
        const calmness = ctx.session.calmness || 10;
        await execAsync(`npx tsx scripts/daily-scanner.ts --json --mood "${mood}" --calmness ${calmness}`);

        const resultsPath = path.join(process.cwd(), 'public', 'scan-results.json');
        if (!fs.existsSync(resultsPath)) {
            await bot.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
            return ctx.reply("❌ Analysis engine failed to produce results.");
        }

        const resultsRaw = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
        const results = resultsRaw.results || [];

        if (results.length === 0) {
            await bot.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
            return ctx.reply("✅ Scan Complete. No games found for the current slate.");
        }

        // Identify All Significant Picks (EV >= 2%)
        const allPicks = results
            .filter((r: any) => r.analysis && r.analysis.polyEV && r.analysis.polyEV >= 0.02)
            .sort((a: any, b: any) => (b.analysis.polyEV || 0) - (a.analysis.polyEV || 0));

        // Message 1: Summary & Picks (Markdown)
        let summaryMsg = `🏛️ **BODHI MASTER SCAN SUMMARY**\n`;
        summaryMsg += `📅 Date: ${new Date().toLocaleDateString()} | 🕒 ${new Date().toLocaleTimeString()}\n`;
        summaryMsg += `👤 *Bettor State:* ${mood} (${calmness}/10)\n`;
        summaryMsg += `📊 *Total Scanned:* ${results.length} matchups\n\n`;

        if (allPicks.length > 0) {
            summaryMsg += `💎 **ALL VALUE PLAYS DETECTED**\n`;
            allPicks.forEach((r: any, i: number) => {
                const emoji = r.sport === 'MLB' ? '⚾' : r.sport === 'NHL' ? '🏒' : r.sport === 'NBA' ? '🏀' : '🥊';
                summaryMsg += `${i + 1}. ${emoji} *${r.matchup}* (${(r.analysis.polyEV * 100).toFixed(1)}% EV)\n`;
                summaryMsg += `   └ **PICK: ${r.analysis.valueTeam.toUpperCase()}**\n`;
            });
            summaryMsg += `\n`;
        } else {
            summaryMsg += `💎 *VALUE PLAYS:* No high-EV edges detected.\n\n`;
        }

        summaryMsg += `📑 _Delivering full technical breakdown in follow-up messages..._\n`;

        await bot.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

        // Delivery Sequence
        console.log(`[${new Date().toISOString()}] Delivering summary...`);
        await sendLongMessage(ctx, summaryMsg, 'Markdown');

        console.log(`[${new Date().toISOString()}] Delivering detailed games (${results.length})...`);
        // Send games in smaller batches or individually to avoid massive string issues
        for (let i = 0; i < results.length; i++) {
            const gameMsg = renderGameDetailHTML(results[i], i);
            await sendLongMessage(ctx, gameMsg, 'HTML');
            if (i % 5 === 0) await new Promise(r => setTimeout(r, 500)); // Extra throttle
        }
        console.log(`[${new Date().toISOString()}] Delivery complete.`);

    } catch (error: any) {
        ctx.reply(`❌ Analysis failed: ${error.message}`);
    }
}

function renderGameDetailHTML(r: any, index: number) {
    const { analysis, sport, matchup, startTime } = r;
    if (!analysis) return "";

    const emoji = sport === 'MLB' ? '⚾' : sport === 'NHL' ? '🏒' : sport === 'NBA' ? '🏀' : '🥊';
    const timeStr = startTime ? new Date(startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'LIVE';

    let msg = `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `<b>[ ${index + 1} ] ${emoji} ${matchup}</b> (${timeStr})\n\n`;

    if (sport === 'MLB') {
        const hPitch = analysis.homePitcher || 'TBD';
        const aPitch = analysis.awayPitcher || 'TBD';
        msg += `🏟️ <b>PITCHING:</b> ${aPitch} @ ${hPitch}\n`;
    } else if (sport === 'NHL' && r.goalieStats) {
        msg += `🥅 <b>GOALIES:</b> ${r.goalieStats.away.name} (${(r.goalieStats.away.svPct * 100).toFixed(1)}%) @ ${r.goalieStats.home.name} (${(r.goalieStats.home.svPct * 100).toFixed(1)}%)\n`;
    }

    if (analysis.valueTeam) {
        const ev = (analysis.polyEV * 100).toFixed(1);
        msg += `🎯 <b>PICK: ${analysis.valueTeam.toUpperCase()}</b>\n`;
        msg += `💰 <b>Edge:</b> ${ev}% EV\n`;
    } else {
        msg += `🔘 <b>STATUS:</b> ${analysis.recommendedAction}\n`;
    }

    msg += `📊 <b>BODHI STABILITY SCORE:</b> ${analysis.overallConfidence}%\n`;

    msg += `\n📑 <b>CORE PILLARS:</b>\n`;
    analysis.pillars.forEach((p: any, i: number) => {
        // Tag stripping for HTML stability
        const cleanReason = (p.reason || "").replace(/[<>]/g, "");
        const pillarEmoji = i === 0 ? '💪' : i === 1 ? '📅' : i === 2 ? '👥' : i === 3 ? '🏦' : i === 4 ? '📁' : i === 5 ? '🧠' : '✨';
        msg += `${i + 1}. ${pillarEmoji} <b>${p.pillar.toUpperCase()}</b> (${p.score}/10)\n`;
        msg += `<i>${cleanReason}</i>\n\n`;
    });

    if (analysis.advantages && analysis.advantages.length > 0) {
        msg += `🔥 <b>STRATEGIC ADVANTAGES:</b>\n`;
        analysis.advantages.forEach((adv: string) => {
            msg += `  • ${adv}\n`;
        });
        msg += `\n`;
    }

    if (analysis.killCriteria && analysis.killCriteria.length > 0) {
        msg += `🚨 <b>KILL CRITERIA:</b>\n`;
        analysis.killCriteria.forEach((crit: string) => {
            msg += `  • <i>${crit}</i>\n`;
        });
        msg += `\n`;
    }

    if (analysis.valueTeam) {
        msg += `🏹 <b>BODHI:</b> ${analysis.recommendedAction}\n`;
        msg += `💵 <b>STAKE:</b> ${analysis.recommendedSize} ($${analysis.suggestedStake?.toFixed(2)})\n`;
    } else {
        msg += `🏹 <b>BODHI:</b> Pass market. No edge found.\n`;
    }

    const agentData = {
        matchup_id: analysis.gamePk,
        ev: analysis.polyEV || 0,
        stake: analysis.suggestedStake || 0,
        weather_risk: analysis.pillars?.find((p: any) => p.pillar === "Seasonal (Sport)")?.score || 5
    };
    msg += `<tg-spoiler>RAW_BODHI_DATA: ${JSON.stringify(agentData)}</tg-spoiler>\n`;

    return msg + `\n`;
}

bot.command(['scan', 'picks', 'report'], async (ctx) => {
    if (await ensureSentiment(ctx, '/scan')) unifiedScan(ctx);
});

bot.command('balance', async (ctx) => {
    await ctx.reply("💰 Fetching live bankroll...");
    try {
        const polyApi = new PolymarketApi();
        const p = await polyApi.getUSDCBalance();
        ctx.replyWithMarkdown(`💳 *BODHI BANKROLL*\n\n◈ *Poly:* $${p.toFixed(2)}\n\n🚀 *Total:* $${p.toFixed(2)}`);
    } catch (e: any) { ctx.reply(`❌ Error: ${e.message}`); }
});

bot.start((ctx) => {
    ctx.reply("🏹 Bodhi Command Center Online.\n/scan - Full Slate Analysis & Picks\n/sentiment - Update Mindset\n/balance - Check Bankroll");
});

bot.launch();
console.log("🚀 Bodhi Bot is live.");
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
