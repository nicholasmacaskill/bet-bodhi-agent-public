import { Context } from 'telegraf';

declare module 'telegraf' {
    interface TelegramContext extends Context {
        // Required minimum interface for query handler
        message: {
            text: string;
            chat: {
                id: number;
                type?: string;
                title?: string;
                username?: string;
                first_name?: string;
                last_name?: string;
            };
            from?: {
                id: number;
                is_bot?: boolean;
                first_name?: string;
                last_name?: string;
                username?: string;
                language_code?: string;
            };
        };

        // Standard Context methods we use
        reply: (<T extends string | FmtString<string>>(text: T, extra?: Omit<Partial<Message>, 'text'>) => Promise<Message.TextMessage>) |
        ((text: string) => Promise<void>);

        // Optional context properties and methods
        state?: Record<string, any>;
    }
}