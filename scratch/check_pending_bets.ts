import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data/bodhi.db');
const db = new Database(dbPath);

console.log("Fetching pending bets from SQLite...");
const pendingBets = db.prepare("SELECT * FROM bets WHERE result = 'pending' ORDER BY created_at DESC").all();
console.log(`Found ${pendingBets.length} pending bets:`);
console.log(JSON.stringify(pendingBets, null, 2));

console.log("\nFetching recent 5 bets in database:");
const recentBets = db.prepare("SELECT * FROM bets ORDER BY created_at DESC LIMIT 5").all();
console.log(JSON.stringify(recentBets, null, 2));
