import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { MLBApi } from '../src/lib/mlb-api';

async function main() {
    const mlb = new MLBApi();
    const reportsDir = path.join(process.cwd(), 'reports');
    const reportFiles = fs.readdirSync(reportsDir).filter(f => f.startsWith('BODHI_SOVEREIGN_REPORT_') && f.endsWith('.md'));

    const monthlyStats: Record<string, { total: number; wins: number; highAlphaTotal: number; highAlphaWins: number; wagered: number; pnl: number }> = {};

    console.log("Analyzing reports monthly trends...");

    for (const file of reportFiles) {
        const filePath = path.join(reportsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        const dateMatch = file.match(/(\d{4})-(\d{2})-\d{2}/);
        if (!dateMatch) continue;
        const reportDate = dateMatch[0];
        const monthKey = `${dateMatch[1]}-${dateMatch[2]}`; // e.g. "2026-04"

        if (!monthlyStats[monthKey]) {
            monthlyStats[monthKey] = { total: 0, wins: 0, highAlphaTotal: 0, highAlphaWins: 0, wagered: 0, pnl: 0 };
        }

        const games = await mlb.getSchedule(reportDate);
        if (!games || games.length === 0) continue;

        const rows = content.split('\n');
        for (const row of rows) {
            const tableMatch = row.match(/\|\s+\d+\s+\|\s+(.*?)\s+@\s+(.*?)\s+\|\s+.*?\s+\|\s+\*\*(.*?)\*\*\s+\|\s+(.*?)\s+\|/);
            if (tableMatch) {
                const awayTeam = tableMatch[1].trim();
                const homeTeam = tableMatch[2].trim();
                const alpha = parseFloat(tableMatch[3]);
                const targetTeam = tableMatch[4].trim();

                if (targetTeam === 'NEUTRAL') continue;

                const game = games.find((g: any) => 
                    (g.awayTeam.toLowerCase().includes(awayTeam.toLowerCase()) || awayTeam.toLowerCase().includes(g.awayTeam.toLowerCase())) &&
                    (g.homeTeam.toLowerCase().includes(homeTeam.toLowerCase()) || homeTeam.toLowerCase().includes(g.homeTeam.toLowerCase()))
                );

                if (!game || game.status !== 'Final') continue;

                const scores = (game.score || "0-0").split('-');
                const awayScore = parseInt(scores[0]);
                const homeScore = parseInt(scores[1]);
                const winner = awayScore > homeScore ? game.awayTeam : game.homeTeam;
                const wasCorrect = winner.toLowerCase().includes(targetTeam.toLowerCase()) || targetTeam.toLowerCase().includes(winner.toLowerCase());

                const stats = monthlyStats[monthKey];
                stats.total++;
                stats.wagered += 35;

                if (wasCorrect) {
                    stats.wins++;
                    stats.pnl += 28;
                } else {
                    stats.pnl -= 35;
                }

                if (alpha >= 10) {
                    stats.highAlphaTotal++;
                    if (wasCorrect) stats.highAlphaWins++;
                }
            }
        }
    }

    console.log("\n=== MONTHLY PERFORMANCE TRENDS ===");
    for (const [month, stats] of Object.entries(monthlyStats).sort()) {
        const winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;
        const highAlphaWinRate = stats.highAlphaTotal > 0 ? (stats.highAlphaWins / stats.highAlphaTotal) * 100 : 0;
        const roi = stats.wagered > 0 ? (stats.pnl / stats.wagered) * 100 : 0;

        console.log(`\nMonth: ${month}`);
        console.log(`  - Total Picks: ${stats.total} (Win Rate: ${winRate.toFixed(1)}%)`);
        console.log(`  - High Alpha (10+): ${stats.highAlphaWins}/${stats.highAlphaTotal} (Win Rate: ${highAlphaWinRate.toFixed(1)}%)`);
        console.log(`  - Simulated ROI: ${roi.toFixed(2)}% (Wagered: $${stats.wagered}, PnL: $${stats.pnl})`);
    }
}

main().catch(console.error);
