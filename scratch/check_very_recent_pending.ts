import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data/bodhi.db');
const db = new Database(dbPath);

console.log("Fetching pending Polymarket bets since 2026-05-23...");
const pendingBets = db.prepare(`
    SELECT * FROM bets 
    WHERE result = 'pending' 
      AND created_at >= '2026-05-23'
    ORDER BY created_at DESC
`).all();

console.log(`Found ${pendingBets.length} pending bets since 2026-05-23:`);
console.log(JSON.stringify(pendingBets, null, 2));
