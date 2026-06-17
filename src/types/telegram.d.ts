import { Context } from 'telegraf';

declare module 'telegraf' {
    interface TelegramContext extends Context {
        // Add custom context properties here if needed
        message: {
            text: string;
            chat: {
                id: number;
            };
            from?: {
                id: number;
            };
        };
    }
}