import 'dotenv/config';
import { Telegraf, session } from 'telegraf';
import { PolymarketApi } from '../src/lib/polymarket-api';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { supabaseAdmin } from '../src/lib/supabase-admin';
import { SQLiteQueryBuilder } from '../src/lib/sqlite-client';

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

        // Log sentiment entry to remote Supabase and local SQLite databases
        try {
            const logEntry = {
                action_type: 'user_sentiment',
                content: `User sentiment update: mood="${ctx.session.mood}", calmness=${ctx.session.calmness}`,
                metadata: {
                    mood: ctx.session.mood,
                    calmness: ctx.session.calmness,
                    source: 'telegram_bot'
                }
            };
            await supabaseAdmin.from('agent_internal_logs').insert(logEntry);
            await new SQLiteQueryBuilder('agent_internal_logs').insert(logEntry);
            console.log(`[sentiment] Logged user sentiment: mood=${ctx.session.mood}, calmness=${ctx.session.calmness}`);
        } catch (dbErr: any) {
            console.error("Failed to log user sentiment to database:", dbErr.message);
        }

        await ctx.reply(`✅ *Sentiment Locked:* ${ctx.session.mood} (${ctx.session.calmness}/10)\nRisk parameters adjusted.`, { parse_mode: 'Markdown' });

        if (ctx.session.pendingCommand) {
            return handlePendingCommand(ctx);
        }
        return;
    }

    // Command override: If a user sends a command starting with '/', break the sentiment flow
    if (text.startsWith('/')) {
        console.log(`[${new Date().toISOString()}] Command override: ${text} detected while state was ${state}. Resetting state.`);
        ctx.session.state = 'IDLE';
        ctx.session.pendingCommand = undefined;
        return next();
    }

    return next();
});

async function handlePendingCommand(ctx: any) {
    const cmd = ctx.session.pendingCommand;
    ctx.session.pendingCommand = undefined;

    if (!cmd) return;

    if (cmd.startsWith('/analyze')) {
        const team = cmd.replace('/analyze', '').trim();
        return runDeepDive(ctx, team);
    } else {
        // Default to unified scan for /scan or legacy pending commands
        return unifiedScan(ctx);
    }
}

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
    const statusMsg = await ctx.reply("🛡️ *BODHI IS GENERATING SOVEREIGN SCAN REPORT*...\nRunning core pillars and loading slate...", { parse_mode: 'Markdown' });
    try {
        console.log(`[${new Date().toISOString()}] Starting nightly_full_report scan for user ${ctx.from?.id}...`);
        
        const { stdout, stderr } = await execAsync(`npx tsx scripts/scanners/nightly_full_report.ts`);
        console.log(stdout);
        if (stderr) console.error(stderr);

        // Find Telegraph URL in stdout
        const match = stdout.match(/📡 Telegram report link sent to admin:\s*(https:\/\/telegra\.ph\/[^\s]+)/);
        const telegraphUrl = match ? match[1] : null;

        await bot.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});

        if (telegraphUrl) {
            await ctx.reply(`🛡️ *BODHI DAILY SOVEREIGN SCAN COMPLETE*\n\n👉 [Open Daily Sovereign Report](${telegraphUrl})`, {
                parse_mode: 'Markdown',
                disable_web_page_preview: false
            });
        } else {
            await ctx.reply("❌ Report generation completed, but Telegraph link could not be resolved. Please check the logs.");
        }

    } catch (error: any) {
        console.error(`[${new Date().toISOString()}] Sovereign scan failed:`, error);
        await bot.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        ctx.reply(`❌ Analysis failed: ${error.message}`);
    }
}

function renderGameDetailHTML(r: any, index: number) {
    const { analysis, sport, matchup, startTime } = r;
    if (!analysis) return "";

    const emoji = sport === 'MLB' ? '⚾' : sport === 'NHL' ? '🏒' : sport === 'NBA' ? '🏀' : '🥊';
    const timeStr = startTime ? new Date(startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'LIVE';

    let msg = `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `<b>[ ${index + 1} ] ${emoji} ${matchup}</b> (${timeStr})\n`;

    if (analysis.dataIntegrity === 'incomplete') {
        const reasons = (analysis.incompleteReasons || []).join(' | ');
        msg += `⚠️ <b>DATA INCOMPLETE:</b> <i>${reasons}</i>\n`;
    }
    msg += `\n`;

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
    msg += `<i>(Objective: Technical + Seasonal + Bookies)</i>\n`;

    msg += `\n📑 <b>CORE PILLARS:</b>\n`;
    analysis.pillars.forEach((p: any, i: number) => {
        const cleanReason = (p.reason || "").replace(/[<>]/g, "");
        const pillarEmoji = i === 0 ? '💪' : i === 1 ? '📅' : i === 2 ? '📁' : i === 3 ? '🏦' : i === 4 ? '👥' : i === 5 ? '🧠' : '✨';
        if (i === 3) msg += `<i>── soft pillars (context only) ──</i>\n`;
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

bot.command('analyze', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        return ctx.reply("❌ Usage: /analyze [team_name]");
    }
    const team = args.slice(1).join(' ');
    
    if (await ensureSentiment(ctx, `/analyze ${team}`)) {
        return runDeepDive(ctx, team);
    }
});

async function runDeepDive(ctx: any, team: string) {
    if (!team) return ctx.reply("❌ No team specified for technical breakdown.");
    
    const statusMsg = await ctx.reply(`🔍 *BODHI DEEP DIVE:* Analyzing ${team.toUpperCase()}...`, { parse_mode: 'Markdown' });
    
    try {
        const mood = ctx.session.mood || "sharp";
        const calmness = ctx.session.calmness || 10;
        
        const { stdout } = await execAsync(`npx tsx scripts/analyze-single-matchup.ts "${team}"`);
        
        const jsonMatch = stdout.match(/DEEP_DIVE_START\n([\s\S]*?)\nDEEP_DIVE_END/);
        if (!jsonMatch) {
            await bot.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
            return ctx.reply(`❌ Could not find a deep-dive for "${team}" today.`);
        }

        const data = JSON.parse(jsonMatch[1]);
        const html = renderDeepDiveHTML(data);
        
        await bot.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
        await sendLongMessage(ctx, html, 'HTML');

    } catch (error: any) {
        await ctx.reply(`❌ Deep Analysis failed: ${error.message}`);
    }
}

function renderDeepDiveHTML(data: any) {
    const { matchup, startTime, venue, weather, starterBattle, bullpenHealth, teamBreakdown, killCriteria, pillarAnalysis } = data;
    
    let msg = `🏛️ <b>BODHI DEEP DIVE ANALYSIS</b>\n`;
    msg += `⚾ <b>${matchup}</b>\n`;
    msg += `📍 <b>Venue:</b> ${venue || 'Unknown'}\n`;
    msg += `☁️ <b>Weather:</b> ${weather || 'N/A'}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    msg += `🤺 <b>STARTER BATTLE</b>\n`;
    msg += `• <b>AWAY:</b> ${starterBattle.away.name}\n`;
    msg += `  <i>${starterBattle.away.note}</i>\n`;
    msg += `• <b>HOME:</b> ${starterBattle.home.name}\n`;
    msg += `  <i>${starterBattle.home.note}</i>\n\n`;

    msg += `🏥 <b>BULLPEN HEALTH</b>\n`;
    msg += `• <b>AWAY:</b> ${bullpenHealth.away}\n`;
    msg += `• <b>HOME:</b> ${bullpenHealth.home}\n\n`;

    msg += `🔥 <b>TEAM BREAKDOWN: AWAY (${teamBreakdown.away.name})</b>\n`;
    msg += `• <b>Resonance:</b> <i>${teamBreakdown.away.resonance}</i>\n`;
    msg += `• <b>Advantage:</b> <i>${teamBreakdown.away.advantage}</i>\n\n`;

    msg += `🔥 <b>TEAM BREAKDOWN: HOME (${teamBreakdown.home.name})</b>\n`;
    msg += `• <b>Resonance:</b> <i>${teamBreakdown.home.resonance}</i>\n`;
    msg += `• <b>Advantage:</b> <i>${teamBreakdown.home.advantage}</i>\n\n`;

    msg += `📑 <b>CORE PILLAR READ (STABILITY)</b>\n`;
    pillarAnalysis.pillars.forEach((p: any, i: number) => {
        const pillarEmoji = i === 0 ? '💪' : i === 1 ? '📅' : i === 2 ? '👥' : i === 3 ? '🏦' : i === 4 ? '📁' : i === 5 ? '🧠' : '✨';
        msg += `${pillarEmoji} <b>${p.pillar.toUpperCase()}</b>: ${p.score}/10\n`;
        msg += `<i>${p.reason.replace(/[<>]/g, "")}</i>\n\n`;
    });

    if (killCriteria && killCriteria.length > 0) {
        msg += `🚨 <b>KILL CRITERIA (ABORT)</b>\n`;
        killCriteria.forEach((crit: string) => {
            msg += `  • <i>${crit}</i>\n`;
        });
        msg += `\n`;
    }

    msg += `🏹 <b>BODHI VERDICT:</b> ${pillarAnalysis.recommendedAction}\n`;
    msg += `💵 <b>STAKE:</b> ${pillarAnalysis.recommendedSize} ($${pillarAnalysis.suggestedStake?.toFixed(2)})\n`;

    return msg;
}

bot.command('reset', (ctx) => {
    ctx.session.state = 'IDLE';
    ctx.session.pendingCommand = undefined;
    ctx.reply("♻️ Bot state reset to IDLE.");
});

bot.start((ctx) => {
    ctx.reply("🏹 Bodhi Command Center Online.\n/scan - Full Slate Analysis & Picks\n/analyze [team] - Deep Matchup Dive\n/sentiment - Update Mindset\n/balance - Check Bankroll\n/reset - Reset bot state if stuck");
});

bot.launch();
console.log("🚀 Bodhi Bot is live.");
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
