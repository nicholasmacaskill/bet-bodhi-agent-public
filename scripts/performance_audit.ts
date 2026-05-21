import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { MLBApi } from '../src/lib/mlb-api';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    const mlb = new MLBApi();
    const poly = new PolymarketApi();
    
    console.log("🔄 Syncing live on-chain data from Polymarket...");
    const currentBalance = await poly.getUSDCBalance();
    
    // We only fetch the first few pages of trades to avoid the 11-minute deep sync 
    // for a quick performance audit run.
    console.log(`💰 Live USDC Balance: $${currentBalance.toFixed(2)}`);
    console.log("🔄 Auditing Bodhi recommendations against MLB Schedule...");

    const reportsDir = path.join(process.cwd(), 'reports');
    const reportFiles = fs.readdirSync(reportsDir).filter(f => f.startsWith('BODHI_SOVEREIGN_REPORT_') && f.endsWith('.md'));

    const auditResults: any[] = [];
    let simulatedWagered = 0;
    let simulatedPnl = 0;

    for (const file of reportFiles) {
        const filePath = path.join(reportsDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
        const reportDate = dateMatch ? dateMatch[1] : null;
        if (!reportDate) continue;

        const games = await mlb.getSchedule(reportDate);

        const rows = content.split('\n');
        for (const row of rows) {
            const tableMatch = row.match(/\|\s+\d+\s+\|\s+(.*?)\s+@\s+(.*?)\s+\|\s+.*?\s+\|\s+\*\*(.*?)\*\*\s+\|\s+(.*?)\s+\|/);
            if (tableMatch) {
                const awayTeam = tableMatch[1].trim();
                const homeTeam = tableMatch[2].trim();
                const alpha = parseFloat(tableMatch[3]);
                const targetTeam = tableMatch[4].trim();

                if (targetTeam === 'NEUTRAL') continue;
                if (!games || games.length === 0) continue;

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

                simulatedWagered += 35; // Standard sizing
                if (wasCorrect) {
                    simulatedPnl += 28; // Average profit on a win
                } else {
                    simulatedPnl -= 35; // Loss
                }

                auditResults.push({
                    date: reportDate,
                    matchup: `${awayTeam} @ ${homeTeam}`,
                    alpha,
                    target: targetTeam,
                    result: wasCorrect ? 'WIN' : 'LOSS',
                    score: `${awayScore}-${homeScore}`
                });
            }
        }
    }

    const totalPicks = auditResults.length;
    const wins = auditResults.filter(r => r.result === 'WIN').length;
    const winRate = (wins / totalPicks) * 100;

    const highAlphaPicks = auditResults.filter(r => r.alpha >= 10);
    const highAlphaWins = highAlphaPicks.filter(r => r.result === 'WIN').length;
    const highAlphaWinRate = highAlphaPicks.length > 0 ? (highAlphaWins / highAlphaPicks.length) * 100 : 0;

    let auditMd = `# 📊 BODHI PERFORMANCE AUDIT: ${new Date().toLocaleDateString()}\n\n`;
    auditMd += `## 📈 EXECUTIVE SUMMARY\n`;
    auditMd += `- **Total Recommendations**: ${totalPicks}\n`;
    auditMd += `- **Overall Win Rate**: ${winRate.toFixed(1)}%\n`;
    auditMd += `- **High Alpha (10+) Win Rate**: ${highAlphaWinRate.toFixed(1)}% (${highAlphaWins}/${highAlphaPicks.length})\n\n`;

    auditMd += `## 💰 ON-CHAIN POLYMARKET METRICS\n`;
    auditMd += `- **Live USDC Balance (Proxy Wallet)**: $${currentBalance.toFixed(2)}\n`;
    auditMd += `- **Simulated MLB Model ROI**: ${((simulatedPnl / simulatedWagered) * 100).toFixed(2)}% (Based on flat $35 staking)\n\n`;

    auditMd += `> **Note**: To view exact realized PnL per market, use the Polymarket UI. The historical CSV tracking has been deprecated in favor of live on-chain balances.\n\n`;

    auditMd += `## 🎯 DETAILED LOG (LAST 20 GAMES)\n`;
    auditMd += `| Date | Matchup | Alpha | Target | Result | Score |\n`;
    auditMd += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    auditResults.slice(-20).reverse().forEach(r => {
        auditMd += `| ${r.date} | ${r.matchup} | ${r.alpha.toFixed(2)} | ${r.target} | ${r.result === 'WIN' ? '✅ WIN' : '❌ LOSS'} | ${r.score} |\n`;
    });

    const outputPath = path.join(reportsDir, 'BODHI_PERFORMANCE_AUDIT.md');
    fs.writeFileSync(outputPath, auditMd);
    console.log(`✅ Performance audit generated: ${outputPath}`);
}

main().catch(console.error);

