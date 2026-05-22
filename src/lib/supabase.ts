import 'dotenv/config';
import { SQLiteQueryBuilder } from './sqlite-client';

// Mock client that matches the Supabase query API but routes queries to local SQLite under the hood.
export const supabase = {
    from: (table: string) => {
        return new SQLiteQueryBuilder(table);
    }
} as any;
