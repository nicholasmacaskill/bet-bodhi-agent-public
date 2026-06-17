import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'data/bodhi.db');
const db = new Database(dbPath);

console.log("Checking bets table in SQLite for KBO teams...");

const kboTeams = [
    'LG Twins', 'KT Wiz', 'SSG Landers', 'NC Dinos', 'Doosan Bears', 'KIA Tigers', 'Lotte Giants', 
    'Samsung Lions', 'Hanwha Eagles', 'Kiwoom Heroes', 'Samsung', 'Hanwha', 'Kiwoom', 'Doosan', 'Lotte', 'Tigers', 'Twins', 'Wiz'
];

const allBets = db.prepare("SELECT * FROM bets").all();
console.log(`Total bets in database: ${allBets.length}`);

const kboBets = allBets.filter((b: any) => {
    const team = b.team || "";
    const log = b.research_log || "";
    return kboTeams.some(t => team.toLowerCase().includes(t.toLowerCase()) || log.toLowerCase().includes(t.toLowerCase()));
});

console.log(`Found ${kboBets.length} KBO bets:`);
kboBets.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

for (const b of kboBets) {
    console.log(`- [${b.created_at}] Team: ${b.team} | Amount: $${b.amount} | Odds: ${b.odds} | Result: ${b.result} | Platform: ${b.platform} | Log: ${b.research_log}`);
}
