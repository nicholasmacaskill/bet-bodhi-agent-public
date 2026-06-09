import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data/bodhi.db');
const db = new Database(dbPath);

console.log("Fetching pending Polymarket bets from May 2026...");
const pendingBets = db.prepare(`
    SELECT * FROM bets 
    WHERE result = 'pending' 
      AND platform = 'polymarket'
      AND created_at LIKE '2026-05-%'
    ORDER BY created_at DESC
`).all();

console.log(`Found ${pendingBets.length} pending Polymarket bets from May 2026:`);
console.log(JSON.stringify(pendingBets, null, 2));
