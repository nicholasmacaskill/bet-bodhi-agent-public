import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Initialize the database connection
const dbPath = path.resolve(process.cwd(), 'data/bodhi.db');

// Ensure the data directory exists
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

// Schema initialization helper
export function initDb() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_profiles (
            id TEXT PRIMARY KEY,
            archetype TEXT DEFAULT 'Complacent',
            peak_watermark_balance REAL DEFAULT 0.00,
            current_balance REAL DEFAULT 0.00,
            updated_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS bets (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            team TEXT NOT NULL,
            odds REAL NOT NULL,
            amount REAL NOT NULL,
            emotional_pulse INTEGER,
            physiological_score INTEGER,
            research_log TEXT,
            pillar_focus TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            result TEXT DEFAULT 'pending',
            external_id TEXT UNIQUE,
            platform TEXT DEFAULT 'manual',
            time_to_kickoff_minutes INTEGER,
            motivation_tag TEXT,
            payout REAL DEFAULT NULL,
            FOREIGN KEY(user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS betting_opportunities (
            id TEXT PRIMARY KEY,
            game_pk INTEGER NOT NULL,
            game_date TEXT NOT NULL,
            matchup TEXT NOT NULL,
            confidence_score INTEGER,
            pillar_breakdown TEXT, -- Store JSON as text string
            home_ml_odds REAL,
            away_ml_odds REAL,
            detected_value_team TEXT,
            status TEXT DEFAULT 'pending',
            actual_bet_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(actual_bet_id) REFERENCES bets(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS agent_internal_logs (
            id TEXT PRIMARY KEY,
            created_at TEXT DEFAULT (datetime('now')),
            action_type TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT -- Store JSON as text string
        );

        CREATE TABLE IF NOT EXISTS odds_history (
            id TEXT PRIMARY KEY,
            game_id TEXT NOT NULL,
            sport TEXT NOT NULL,
            home_team TEXT NOT NULL,
            away_team TEXT NOT NULL,
            home_odds REAL,
            away_odds REAL,
            home_run_line REAL,
            home_run_line_odds REAL,
            away_run_line REAL,
            away_run_line_odds REAL,
            recorded_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS token_usage_logs (
            id TEXT PRIMARY KEY,
            timestamp TEXT DEFAULT (datetime('now')),
            prompt_tokens INTEGER NOT NULL,
            completion_tokens INTEGER NOT NULL,
            total_tokens INTEGER NOT NULL,
            cost REAL NOT NULL,
            model TEXT NOT NULL
        );
    `);
}

// Call schema creation on startup
initDb();

export class SQLiteQueryBuilder {
    private table: string;
    private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private selectCols: string = '*';
    private insertRows: any[] = [];
    private updateValues: any = null;
    private conditions: { col: string; op: string; val: any }[] = [];
    private orderByCol: string = '';
    private orderAsc: boolean = true;
    private limitCount: number = -1;
    private isSingle: boolean = false;

    constructor(table: string) {
        this.table = table;
    }

    select(cols: string = '*') {
        this.operation = 'select';
        this.selectCols = cols;
        return this;
    }

    insert(rows: any | any[]) {
        this.operation = 'insert';
        this.insertRows = Array.isArray(rows) ? rows : [rows];
        return this;
    }

    update(values: any) {
        this.operation = 'update';
        this.updateValues = values;
        return this;
    }

    eq(col: string, val: any) {
        this.conditions.push({ col, op: '=', val });
        return this;
    }

    not(col: string, op: string, val: any) {
        if (op === 'is' && val === null) {
            this.conditions.push({ col, op: 'IS NOT', val: null });
        } else if (op === 'eq') {
            this.conditions.push({ col, op: '!=', val });
        } else {
            this.conditions.push({ col, op: `NOT ${op}`, val });
        }
        return this;
    }

    order(col: string, options?: { ascending?: boolean }) {
        this.orderByCol = col;
        this.orderAsc = options?.ascending !== false;
        return this;
    }

    limit(count: number) {
        this.limitCount = count;
        return this;
    }

    single() {
        this.isSingle = true;
        return this;
    }

    // A thenable object must implement then() so it can be awaited directly
    async then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
        try {
            const result = this.execute();
            if (onfulfilled) {
                return onfulfilled(result);
            }
            return result;
        } catch (error) {
            if (onrejected) {
                return onrejected(error);
            }
            return { data: null, error };
        }
    }

    private execute() {
        const params: any[] = [];

        if (this.operation === 'select') {
            let sql = `SELECT ${this.selectCols} FROM ${this.table}`;
            if (this.conditions.length > 0) {
                const parts = this.conditions.map(c => {
                    if (c.op === 'IS NOT' && c.val === null) {
                        return `${c.col} IS NOT NULL`;
                    }
                    params.push(c.val);
                    return `${c.col} ${c.op} ?`;
                });
                sql += ` WHERE ${parts.join(' AND ')}`;
            }
            if (this.orderByCol) {
                sql += ` ORDER BY ${this.orderByCol} ${this.orderAsc ? 'ASC' : 'DESC'}`;
            }
            if (this.limitCount >= 0) {
                sql += ` LIMIT ${this.limitCount}`;
            }

            const stmt = db.prepare(sql);
            const rows = stmt.all(...params);

            // Parse metadata/JSON fields for tables if select * is called
            const parsedRows = rows.map(r => this.parseRow(this.table, r));

            if (this.isSingle) {
                return { data: parsedRows.length > 0 ? parsedRows[0] : null, error: null };
            }
            return { data: parsedRows, error: null };

        } else if (this.operation === 'insert') {
            const insertedRows: any[] = [];
            
            // Start a transaction for bulk insert
            const insertTx = db.transaction((rowsToInsert: any[]) => {
                for (const row of rowsToInsert) {
                    const rowCopy = { ...row };
                    if (!rowCopy.id) {
                        // Generate a UUID if none is provided (common in sqlite)
                        rowCopy.id = this.uuid();
                    }
                    // Stringify JSON/metadata columns
                    this.stringifyRow(this.table, rowCopy);

                    const keys = Object.keys(rowCopy);
                    const placeholders = keys.map(() => '?').join(', ');
                    const sql = `INSERT INTO ${this.table} (${keys.join(', ')}) VALUES (${placeholders})`;
                    
                    const stmt = db.prepare(sql);
                    const runParams = keys.map(k => rowCopy[k]);
                    stmt.run(...runParams);

                    // Re-fetch to return full object (including defaults)
                    const selectStmt = db.prepare(`SELECT * FROM ${this.table} WHERE id = ?`);
                    const inserted = selectStmt.get(rowCopy.id);
                    insertedRows.push(this.parseRow(this.table, inserted));
                }
            });

            insertTx(this.insertRows);

            return { data: insertedRows, error: null };

        } else if (this.operation === 'update') {
            let sql = `UPDATE ${this.table} SET `;
            const setParts: string[] = [];
            const updateCopy = { ...this.updateValues };
            this.stringifyRow(this.table, updateCopy);

            for (const key of Object.keys(updateCopy)) {
                setParts.push(`${key} = ?`);
                params.push(updateCopy[key]);
            }
            sql += setParts.join(', ');

            if (this.conditions.length > 0) {
                const parts = this.conditions.map(c => {
                    if (c.op === 'IS NOT' && c.val === null) {
                        return `${c.col} IS NOT NULL`;
                    }
                    params.push(c.val);
                    return `${c.col} ${c.op} ?`;
                });
                sql += ` WHERE ${parts.join(' AND ')}`;
            }

            const stmt = db.prepare(sql);
            stmt.run(...params);

            return { data: null, error: null };
        }

        return { data: null, error: new Error('Unsupported operation') };
    }

    private uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private parseRow(table: string, row: any) {
        if (!row) return row;
        const copy = { ...row };
        // Parse metadata/JSON fields
        if (table === 'agent_internal_logs' && typeof copy.metadata === 'string') {
            try { copy.metadata = JSON.parse(copy.metadata); } catch {}
        }
        if (table === 'betting_opportunities' && typeof copy.pillar_breakdown === 'string') {
            try { copy.pillar_breakdown = JSON.parse(copy.pillar_breakdown); } catch {}
        }
        return copy;
    }

    private stringifyRow(table: string, row: any) {
        if (!row) return;
        // Stringify metadata/JSON fields
        if (table === 'agent_internal_logs' && row.metadata !== undefined && typeof row.metadata !== 'string') {
            row.metadata = JSON.stringify(row.metadata);
        }
        if (table === 'betting_opportunities' && row.pillar_breakdown !== undefined && typeof row.pillar_breakdown !== 'string') {
            row.pillar_breakdown = JSON.stringify(row.pillar_breakdown);
        }
    }
}
