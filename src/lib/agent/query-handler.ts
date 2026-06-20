import { GoogleGenerativeAI } from '@google/generative-ai';
import { TelegramContext } from 'telegraf';
import { supabaseAdmin } from '../supabase-admin';
import { BodhiAgent } from './bodhi-agent';
import { compressContext, TokenTracker } from './token-tracker';

export class QueryHandler {
    private genAI: GoogleGenerativeAI;
    private agent: BodhiAgent;

    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        this.agent = new BodhiAgent();
    }

    async getStrategyContext() {
        // Load strategy docs from Supabase
        const { data } = await supabaseAdmin
            .from('strategy_docs')
            .select('content,metadata');

        return data?.map((doc: { content: string }) => doc.content).join('\n\n') || '';
    }

    async handleQuery(
        ctx: any,
        query: string
    ) {
        try {
            // 1. Get all strategy context (no longer filtering by similarity)
            const rawContext = await this.getStrategyContext();
            
            // Apply zero-overhead input context compression
            const context = compressContext(rawContext, query);

            // 2. Generate augmented prompt
            const prompt = `Available Strategy Context:\n${context}\n\n` +
                `Current Market State:\n${JSON.stringify(await this.agent.getCurrentState(), null, 2)}\n\n` +
                `User Query: ${query}`;

            // 3. Get Gemini response with gated max_output_tokens
            const modelName = "gemini-pro";
            const model = this.genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: {
                    maxOutputTokens: 800 // Restricted token limit for JSON/standard responses
                }
            });
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            // Track usage using the SQLite token tracker
            TokenTracker.trackUsage(modelName, response.usageMetadata);

            // 4. Format and send response
            await ctx.reply(text, { parse_mode: 'Markdown' });

            // 5. Log interaction
            await this.agent.logInternal('telegram_query', `Handled query: ${query}`, {
                response: text,
                contextUsed: 'Full strategy context'
            });

        } catch (error) {
            console.error('Query handling failed:', error);
            await ctx.reply('⚠️ Failed to process query. Please try again.');
        }
    }
}
