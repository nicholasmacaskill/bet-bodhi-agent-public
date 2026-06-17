import { GoogleGenerativeAI } from '@google/generative-ai';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { TelegramContext } from 'telegraf';
import { supabaseAdmin } from '../supabase-admin';
import { BodhiAgent } from './bodhi-agent';

export class QueryHandler {
    private genAI: GoogleGenerativeAI;
    private vectorStore: MemoryVectorStore;
    private agent: BodhiAgent;

    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
        this.vectorStore = new MemoryVectorStore(new OpenAIEmbeddings());
        this.agent = new BodhiAgent();
    }

    async initVectorStore() {
        // Load strategy docs from Supabase
        const { data } = await supabaseAdmin
            .from('strategy_docs')
            .select('content,metadata');

        if (data) {
            await this.vectorStore.addDocuments(data.map(doc => ({
                pageContent: doc.content,
                metadata: doc.metadata
            })));
        }
    }

    async handleQuery(ctx: TelegramContext, query: string) {
        try {
            // 1. Retrieve relevant strategy context
            const relevantDocs = await this.vectorStore.similaritySearch(query, 3);
            const context = relevantDocs.map(d => d.pageContent).join('\n\n');

            // 2. Generate augmented prompt
            const prompt = `Available Strategy Context:\n${context}\n\n` +
                `Current Market State:\n${JSON.stringify(await this.agent.getCurrentState(), null, 2)}\n\n` +
                `User Query: ${query}`;

            // 3. Get Gemini response
            const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            // 4. Format and send response
            await ctx.reply(text, { parse_mode: 'Markdown' });

            // 5. Log interaction
            await this.agent.logInternal('telegram_query', `Handled query: ${query}`, {
                response: text,
                contextUsed: relevantDocs.map(d => d.metadata.source)
            });

        } catch (error) {
            console.error('Query handling failed:', error);
            await ctx.reply('⚠️ Failed to process query. Please try again.');
        }
    }
}
