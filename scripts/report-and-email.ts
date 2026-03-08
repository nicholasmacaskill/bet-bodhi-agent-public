
import 'dotenv/config';
import { MLBApi } from '../src/lib/mlb-api';
import { NHLApi } from '../src/lib/nhl-api';
import { NBAApi } from '../src/lib/nba-api';
import { MMAApi } from '../src/lib/mma-api';
import { OddsApi } from '../src/lib/odds-api';
import { PillarAnalyzer } from '../src/lib/pillar-analyzer';
import { NHLPillarAnalyzer } from '../src/lib/nhl-pillar-analyzer';
import { NBAPillarAnalyzer } from '../src/lib/nba-pillar-analyzer';
import { MMAPillarAnalyzer } from '../src/lib/mma-pillar-analyzer';
import { sendEmail } from '../src/lib/email';

const GREEN = '#2e7d32';
const RED = '#d32f2f';
const YELLOW = '#f9a825';
const CYAN = '#00838f';
const DIM = '#999';

function getPillarColor(score: number): string {
    if (score >= 9) return GREEN;
    if (score >= 7) return YELLOW;
    if (score >= 5) return CYAN;
    return DIM;
}

function getConfidenceColor(pct: number): string {
    if (pct >= 80) return GREEN;
    if (pct >= 70) return YELLOW;
    if (pct >= 60) return CYAN;
    return DIM;
}

function renderProgressBar(pct: number, color: string): string {
    return `
        <div style="width: 100px; background: #eee; height: 10px; border-radius: 5px; overflow: hidden; display: inline-block; vertical-align: middle; margin-right: 10px;">
            <div style="width: ${pct}%; background: ${color}; height: 100%;"></div>
        </div>
    `;
}

async function runReportAndEmail(targetEmail: string) {
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const mlbApi = new MLBApi();
    const nhlApi = new NHLApi();
    const oddsApi = new OddsApi();
    const mlbAnalyzer = new PillarAnalyzer();
    const nhlAnalyzer = new NHLPillarAnalyzer();

    console.log(`Starting full automated scan for ${date}...`);

    const allResults: any[] = [];

    // MLB Scan
    try {
        const [mlbGames, mlbOdds] = await Promise.all([mlbApi.getSchedule(date), oddsApi.getMLBOdds()]);
        for (const game of mlbGames) {
            let details: any = { probables: game.probables || {}, lineups: game.lineups || { home: [], away: [] } };
            if (game.gamePk) {
                const fetched = await mlbApi.getGameDetails(game.gamePk);
                if (fetched) details = fetched;
            }
            const analysis = mlbAnalyzer.analyzeGame(game, details, mlbOdds);

            // Extract odds for display
            const market = mlbOdds.find(o =>
                o.home_team.includes(game.homeTeam) ||
                o.away_team.includes(game.awayTeam)
            );
            const h2h = market?.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'h2h');
            const homeOdds = h2h?.outcomes?.find((o: any) => o.name === market?.home_team)?.price;
            const awayOdds = h2h?.outcomes?.find((o: any) => o.name === market?.away_team)?.price;

            allResults.push({ sport: 'MLB', matchup: `${game.awayTeam} @ ${game.homeTeam}`, analysis, homeOdds, awayOdds, startTime: game.date });
        }
    } catch (e) { console.error('MLB Scan failed', e); }

    // NHL Scan
    try {
        const [nhlGames, nhlStats, nhlOdds, goalieLeaders] = await Promise.all([
            nhlApi.getSchedule(date),
            nhlApi.getTeamStats(),
            oddsApi.getNHLOdds(),
            nhlApi.getGoalieLeaders()
        ]);
        for (const game of nhlGames) {
            const landing = await nhlApi.getGameLanding(game.id);
            const goalieSeasonStats = landing?.matchup?.goalieSeasonStats;
            const analysis = nhlAnalyzer.analyzeGame(game, nhlStats, nhlOdds, goalieLeaders, goalieSeasonStats);

            const market = nhlOdds.find(o =>
                o.home_team.includes(game.homeTeam) ||
                o.away_team.includes(game.awayTeam)
            );
            const h2h = market?.bookmakers?.[0]?.markets?.find((m: any) => m.key === 'h2h');
            const homeOdds = h2h?.outcomes?.find((o: any) => o.name === market?.home_team)?.price;
            const awayOdds = h2h?.outcomes?.find((o: any) => o.name === market?.away_team)?.price;

            allResults.push({ sport: 'NHL', matchup: `${game.awayTeam} @ ${game.homeTeam}`, analysis, homeOdds, awayOdds, startTime: game.startTime });
        }
    } catch (e) { console.error('NHL Scan failed', e); }

    // Sort by confidence
    const sortedValuePlays = allResults
        .filter(r => r.analysis.overallConfidence >= 60 && r.analysis.valueTeam)
        .sort((a, b) => b.analysis.overallConfidence - a.analysis.overallConfidence);

    let htmlReport = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; max-width: 900px; margin: auto; padding: 30px; background: #fff;">
            <div style="text-align: center; border-bottom: 3px solid #008080; padding-bottom: 20px; margin-bottom: 30px;">
                <h1 style="color: #008080; margin: 0; letter-spacing: 2px;">BODHI PRISM</h1>
                <p style="color: #666; margin: 5px 0 0 0; text-transform: uppercase; font-size: 14px;">SPORTS BETTING INTELLIGENCE REPORT | ${dateLabel}</p>
            </div>
    `;

    // 1. VALUE PLAYS SUMMARY TABLE
    if (sortedValuePlays.length > 0) {
        htmlReport += `
            <div style="background: #f4fdfd; border-left: 5px solid #008080; padding: 20px; border-radius: 4px; margin-bottom: 40px;">
                <h2 style="margin: 0 0 15px 0; color: #004d40; font-size: 18px;">📊 HIGH CONVICTION VALUE PLAYS</h2>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="text-align: left; border-bottom: 1px solid #ccc; color: #666; font-size: 12px;">
                            <th style="padding: 8px;">SPORT</th>
                            <th style="padding: 8px;">MATCHUP</th>
                            <th style="padding: 8px;">BET</th>
                            <th style="padding: 8px;">ODDS</th>
                            <th style="padding: 8px;">CONFIDENCE</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        sortedValuePlays.forEach(p => {
            const side = p.analysis.valueTeam === 'home' ? p.analysis.homeTeam : p.analysis.awayTeam;
            const confColor = getConfidenceColor(p.analysis.overallConfidence);
            htmlReport += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 12px 8px; font-weight: bold;">${p.sport}</td>
                    <td style="padding: 12px 8px;">${p.matchup}</td>
                    <td style="padding: 12px 8px; color: #008080; font-weight: bold;">${side}</td>
                    <td style="padding: 12px 8px;">${p.analysis.valueOdds || '—'}</td>
                    <td style="padding: 12px 8px;">
                        <span style="color: ${confColor}; font-weight: bold;">${p.analysis.overallConfidence}%</span>
                    </td>
                </tr>
            `;
        });

        htmlReport += `</tbody></table></div>`;
    }

    // 2. DETAILED GAME BREAKDOWNS
    htmlReport += `<h2 style="border-bottom: 1px solid #eee; padding-bottom: 10px; color: #444;">DIVE DEEP: INDIVIDUAL ANALYSIS</h2>`;

    for (const res of allResults) {
        const { sport, matchup, analysis, homeOdds, awayOdds, startTime } = res;
        const confColor = getConfidenceColor(analysis.overallConfidence);
        const timeStr = startTime ? new Date(startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '';

        htmlReport += `
            <div style="margin-bottom: 50px; border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <!-- Header -->
                <div style="background: #f9f9f9; padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <span style="background: #008080; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 10px;">${sport}</span>
                        <strong style="font-size: 16px;">${matchup}</strong>
                        <span style="color: #999; font-size: 12px; margin-left: 10px;">${timeStr}</span>
                    </div>
                </div>

                <div style="padding: 20px;">
                    <!-- Odds & Strategy -->
                    <div style="display: flex; gap: 40px; margin-bottom: 25px;">
                        <div style="flex: 1;">
                            <p style="margin: 0 0 5px 0; font-size: 11px; color: #999; text-transform: uppercase;">Market Odds</p>
                            <div style="font-size: 14px;">
                                ${analysis.awayTeam}: <strong>${awayOdds || '—'}</strong> &nbsp;&nbsp; 
                                ${analysis.homeTeam}: <strong>${homeOdds || '—'}</strong>
                            </div>
                        </div>
                        <div style="flex: 1;">
                            <p style="margin: 0 0 5px 0; font-size: 11px; color: #999; text-transform: uppercase;">Confidence Score</p>
                            <div>
                                ${renderProgressBar(analysis.overallConfidence, confColor)}
                                <strong style="color: ${confColor}; font-size: 18px;">${analysis.overallConfidence}%</strong>
                            </div>
                        </div>
                        <div style="flex: 1;">
                            <p style="margin: 0 0 5px 0; font-size: 11px; color: #999; text-transform: uppercase;">Recommended Action</p>
                            <div style="font-weight: bold; color: ${analysis.overallConfidence >= 75 ? GREEN : '#333'}">
                                ${analysis.recommendedAction}
                            </div>
                        </div>
                    </div>

                    <!-- Pillars -->
                    <div style="background: #fafafa; padding: 15px; border-radius: 6px;">
                        <p style="margin: 0 0 15px 0; font-size: 12px; font-weight: bold; color: #666; border-bottom: 1px solid #eee; padding-bottom: 5px;">THE FIVE PILLARS</p>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        `;

        analysis.pillars.forEach((p: any) => {
            const pColor = getPillarColor(p.score);
            htmlReport += `
                <div style="margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 13px; font-weight: bold; color: #444;">${p.pillar}</span>
                        <span style="font-size: 13px; font-weight: bold; color: ${pColor};">${p.score}/10</span>
                    </div>
                    <div style="font-size: 12px; color: #777; line-height: 1.4;">
                        ${p.reason}
                    </div>
                </div>
            `;
        });

        htmlReport += `
                        </div>
                    </div>

                    <!-- Sizing -->
                    ${analysis.suggestedStake > 0 ? `
                    <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eee; display: flex; align-items: center;">
                        <span style="font-size: 13px; color: #666; margin-right: 15px;">Target Sizing:</span>
                        <span style="background: #e8f5e9; color: #2e7d32; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 14px;">
                            ${analysis.recommendedSize} ($${analysis.suggestedStake.toFixed(2)})
                        </span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    htmlReport += `
            <div style="text-align: center; margin-top: 60px; padding-top: 20px; border-top: 1px solid #eee; color: #999; font-size: 11px;">
                <p>BODHI PRISM | SPORTS BETTING INTELLIGENCE REPORT</p>
                <p>This report is confidential and generated for internal testing purposes. Signals are informational.</p>
                <p>nicholasmacaskill@proton.me</p>
            </div>
        </div>
    `;

    console.log(`Sending FULL report email to ${targetEmail}...`);
    const res = await sendEmail(targetEmail, `Bodhi Prism: Sports Betting Intelligence Report (${dateLabel})`, htmlReport);

    if (res.success) {
        console.log('Full report email sent successfully!');
    } else {
        console.error('Failed to send email:', res.error);
    }
}

if (require.main === module) {
    const email = process.argv[2] || 'nicholasmacaskill@proton.me';
    runReportAndEmail(email).catch(console.error);
}

export { runReportAndEmail };
