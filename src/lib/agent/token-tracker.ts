import { db } from '../sqlite-client';

/**
 * Compresses input context by keeping only sentences or HTML tags containing relevant keywords
 * and truncating the output to a maximum character length.
 */
export function compressContext(
    text: string,
    keywords: string[] = ["drawdown", "rules", "limits", "payouts", "error"],
    maxChars: number = 4000
): string {
    if (!text) return "";

    // Split by newlines, sentence bounds, or HTML tags
    const chunks = text.split(/(?:\r?\n|\. |\<[^\>]+\>)/g)
        .map(c => c.trim())
        .filter(c => c.length > 0);

    const lowercaseKeywords = keywords.map(kw => kw.toLowerCase());
    const filteredChunks = chunks.filter(chunk => {
        const lowerChunk = chunk.toLowerCase();
        return lowercaseKeywords.some(kw => lowerChunk.includes(kw));
    });

    let compressed = filteredChunks.join("\n");

    if (compressed.length > maxChars) {
        compressed = compressed.slice(0, maxChars) + "\n... [TRUNCATED DUE TO LIMIT] ...";
    }

    return compressed || "... [NO RELEVANT KEYWORDS FOUND IN CONTEXT] ...";
}

// Pricing definitions (per token)
const PRICING: Record<string, { input: number; output: number }> = {
    'gemini-pro': { input: 0.50 / 1000000, output: 1.50 / 1000000 },
    'gemini-1.5-flash': { input: 0.075 / 1000000, output: 0.30 / 1000000 },
    'gemini-3.5-flash': { input: 0.075 / 1000000, output: 0.30 / 1000000 },
    'gemini-1.5-pro': { input: 1.25 / 1000000, output: 5.00 / 1000000 },
    'default': { input: 0.075 / 1000000, output: 0.30 / 1000000 }
};

export class TokenTracker {
    private static BUDGET_LIMIT = 2.00; // $2.00 USD/day

    /**
     * Intercepts response metadata, calculates cost, logs to DB, and performs budget check.
     */
    static trackUsage(modelName: string, usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined) {
        if (!usage) {
            console.warn("⚠️ TokenTracker: No usage metadata received.");
            return;
        }

        const promptTokens = usage.promptTokenCount || 0;
        const completionTokens = usage.candidatesTokenCount || 0;
        const totalTokens = promptTokens + completionTokens;

        if (totalTokens === 0) return;

        // Get pricing rates
        const rates = PRICING[modelName] || PRICING['default'];
        const cost = (promptTokens * rates.input) + (completionTokens * rates.output);

        try {
            const id = 'tok_' + Math.random().toString(36).substring(2, 15);
            db.prepare(`
                INSERT INTO token_usage_logs (id, timestamp, prompt_tokens, completion_tokens, total_tokens, cost, model)
                VALUES (?, datetime('now'), ?, ?, ?, ?, ?)
            `).run(id, promptTokens, completionTokens, totalTokens, cost, modelName);

            // Budget ceiling check
            const todayCostRow = db.prepare(`
                SELECT SUM(cost) as total_cost FROM token_usage_logs 
                WHERE date(timestamp) = date('now')
            `).get() as { total_cost: number | null };

            const todayCost = todayCostRow?.total_cost || 0;
            if (todayCost >= this.BUDGET_LIMIT) {
                console.error(
                    `🛑 BUDGET CRITICAL WARNING: Daily token usage cost ($${todayCost.toFixed(4)}) has exceeded the daily ceiling limit of $${this.BUDGET_LIMIT.toFixed(2)}!`
                );
            } else if (todayCost >= this.BUDGET_LIMIT * 0.8) {
                console.warn(
                    `⚠️ BUDGET WARNING: Daily token usage cost ($${todayCost.toFixed(4)}) is at 80%+ of the daily limit ($${this.BUDGET_LIMIT.toFixed(2)}).`
                );
            }
        } catch (error) {
            console.error("❌ TokenTracker failed to log usage to SQLite:", error);
        }
    }
}
