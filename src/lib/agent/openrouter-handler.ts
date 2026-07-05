/**
 * OpenRouter Query Handler
 * Replaces the dead Gemini QueryHandler with OpenRouter inference.
 *
 * Uses Claude Sonnet as default — best reasoning at low cost.
 * Falls back gracefully if the API is unreachable.
 *
 * Context injected per query:
 *   1. Recent betting_opportunities (last 30 days) with results
 *   2. Latest sentiment log
 *   3. User's question
 *
 * This gives the model real data to reason over, making it far more
 * useful than a generic chatbot.
 */

import { db } from '../sqlite-client';
import { supabaseAdmin } from '../supabase-admin';
import * as fs from 'fs';
import * as path from 'path';
import { loadTradeBook } from '../gateway/trade-book';
import { PolymarketPnLReport } from '../gateway/PolymarketGateway';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Model to use — Claude Sonnet 4 is ideal: fast, cheap, excellent reasoning
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5';

// System prompt that grounds the model in Bodhi's context
const SYSTEM_PROMPT = `You are Bodhi, an elite sports betting intelligence assistant.

You have access to a proprietary rule-based pillar scoring engine that evaluates:
- Technical Sport (pitcher/goalie/player matchups)
- Seasonal Sport (park factors, weather, schedule)
- Technical Bookies (Polymarket EV vs true probability)
- Technical Bankroll (Kelly-adjacent sizing)
- Psychological Bettor (trader sentiment)
- Physiological/Spiritual (trader emotional state)

You also have access to the user's live bet history and recent scan results.

Be direct, sharp, and quantitative. Lead with the number. Don't hedge unnecessarily.
When asked about a pick, reference the pillar scores if available.
When asked about performance, cite actual win rates from the data provided.
Never make up data — if you don't have it, say so.`;

interface OpenRouterMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Pulls recent scan results and bet history from SQLite to give
 * the model real context to reason over.
 */
async function buildContext(): Promise<string> {
    const sections: string[] = [];

    // 1. Recent betting opportunities (last 30 days)
    try {
        const opps = db.prepare(`
            SELECT matchup, game_date, confidence_score, detected_value_team,
                   alpha_score, status, pillar_breakdown
            FROM betting_opportunities
            WHERE game_date >= date('now', '-30 days')
            ORDER BY game_date DESC, alpha_score DESC
            LIMIT 20
        `).all() as any[];

        if (opps.length > 0) {
            sections.push(`## Recent Scan Results (last 30 days, top 20 by alpha)\n` +
                opps.map(o => {
                    const pillars = (() => { try { return JSON.parse(o.pillar_breakdown || '[]'); } catch { return []; } })();
                    const topPillar = pillars.sort((a: any, b: any) => b.score - a.score)[0];
                    return `- ${o.game_date} | ${o.matchup} | Target: ${o.detected_value_team || 'NEUTRAL'} | Confidence: ${o.confidence_score}% | Alpha: ${(o.alpha_score || 0).toFixed(2)} | Status: ${o.status}${topPillar ? ` | Top Pillar: ${topPillar.pillar} (${topPillar.score}/10)` : ''}`;
                }).join('\n')
            );
        }
    } catch (e) { /* SQLite not available in this context */ }

    // 2. Bet results — Read from cached PolymarketGateway report, fallback to SQLite
    try {
        let pmReport: any = null;
        try {
            const dataPath = path.join(process.cwd(), 'data', 'latest_pnl.json');
            if (fs.existsSync(dataPath)) {
                pmReport = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            }
        } catch (gatewayErr: any) {
            console.warn("[askBodhi] Failed to read latest_pnl.json:", gatewayErr.message);
        }

        if (pmReport) {
            sections.push(
                `## Performance Summary (Polymarket On-Chain)\n` +
                `- KBO Profit: $${pmReport.kboProfit.toFixed(2)}\n` +
                `- MLB Profit: $${pmReport.mlbProfit.toFixed(2)}\n` +
                `- Other Markets: $${pmReport.otherProfit.toFixed(2)}\n` +
                `- Total Realized P&L: $${pmReport.totalRealizedProfit.toFixed(2)}\n` +
                `- Open Value (Pending): ~$${pmReport.totalOpenValue.toFixed(2)}\n` +
                `- NOTE: This is the exact on-chain Polymarket realized P&L.`
            );
        } else {
            const results = db.prepare(`
                SELECT
                    COUNT(*)                                                          AS total,
                    COUNT(CASE WHEN result = 'win'     THEN 1 END)                   AS wins,
                    COUNT(CASE WHEN result = 'loss'    THEN 1 END)                   AS losses,
                    COUNT(CASE WHEN result = 'pending' THEN 1 END)                   AS pending,
                    ROUND(AVG(amount), 2)                                             AS avg_stake,
                    ROUND(SUM(CASE WHEN result = 'win' THEN (amount * odds) - amount ELSE 0 END), 2) AS gross_profit,
                    ROUND(SUM(CASE WHEN result = 'loss' THEN amount ELSE 0 END), 2)  AS gross_loss,
                    ROUND(
                        SUM(CASE WHEN result = 'win' THEN (amount * odds) - amount
                                 WHEN result = 'loss' THEN -amount
                                 ELSE 0 END)
                    , 2)                                                              AS net_pnl,
                    ROUND(AVG(CASE WHEN result = 'win' THEN odds END), 3)            AS avg_win_odds,
                    ROUND(AVG(CASE WHEN result = 'loss' THEN odds END), 3)           AS avg_loss_odds
                FROM bets
            `).get() as any;

            if (results && results.total > 0) {
                const settled  = results.wins + results.losses;
                const winRate  = settled > 0 ? ((results.wins / settled) * 100).toFixed(1) : '0.0';
                const roi      = results.gross_loss > 0
                    ? (((results.gross_profit - results.gross_loss) / results.gross_loss) * 100).toFixed(1)
                    : '0.0';

                sections.push(
                    `## Performance Summary (Local DB Fallback)\n` +
                    `- Record: ${results.wins}W / ${results.losses}L / ${results.pending} pending (${settled} settled total)\n` +
                    `- Win Rate: ${winRate}%\n` +
                    `- Avg Stake: $${results.avg_stake}\n` +
                    `- Avg Win Odds: ${results.avg_win_odds}x | Avg Loss Odds: ${results.avg_loss_odds}x\n` +
                    `- Net P&L: $${results.net_pnl} (ROI: ${roi}%)\n` +
                    `- NOTE: This uses local DB estimated payouts (amount * odds). On-chain sync is currently unavailable.`
                );
            }
        }
    } catch (e) { /* no bets table data */ }

    // 3. Latest sentiment
    try {
        const sentiment = db.prepare(`
            SELECT mood, calmness, risk_multiplier, created_at
            FROM user_sentiment
            ORDER BY created_at DESC
            LIMIT 1
        `).get() as any;

        if (sentiment) {
            sections.push(`## Latest Trader Sentiment\n` +
                `- Mood: ${sentiment.mood} | Calmness: ${sentiment.calmness}/10 | Risk Multiplier: ${sentiment.risk_multiplier}x\n` +
                `- Recorded: ${sentiment.created_at}`
            );
        }
    } catch (e) { /* no sentiment yet */ }

    return sections.length > 0
        ? sections.join('\n\n')
        : 'No historical data available yet.';
}

/**
 * Sends a query to OpenRouter and returns the response text.
 */
export async function askBodhi(query: string): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        return '❌ OPENROUTER_API_KEY not set in .env';
    }

    const context = await buildContext();

    const messages: OpenRouterMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'user',
            content: `Here is the current data context:\n\n${context}\n\n---\n\nUser question: ${query}`
        }
    ];

    const response = await fetch(OPENROUTER_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://betbodhi.io',
            'X-Title': 'Bet Bodhi Intelligence'
        },
        body: JSON.stringify({
            model: DEFAULT_MODEL,
            messages,
            max_tokens: 1000,
            temperature: 0.3  // Low temp — we want precise, factual answers
        })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenRouter API error ${response.status}: ${err}`);
    }

    const data = await response.json() as any;
    const text = data.choices?.[0]?.message?.content;

    if (!text) throw new Error('Empty response from OpenRouter');

    // Log token usage to SQLite for cost tracking
    if (data.usage) {
        try {
            const { prompt_tokens, completion_tokens, total_tokens } = data.usage;
            // Rough cost: Claude Sonnet ~$3/M input, $15/M output
            const cost = (prompt_tokens * 0.000003) + (completion_tokens * 0.000015);
            db.prepare(`
                INSERT INTO token_usage_logs (id, prompt_tokens, completion_tokens, total_tokens, cost, model)
                VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)
            `).run(prompt_tokens, completion_tokens, total_tokens, cost, DEFAULT_MODEL);
        } catch (e) { /* non-fatal */ }
    }

    return text;
}
