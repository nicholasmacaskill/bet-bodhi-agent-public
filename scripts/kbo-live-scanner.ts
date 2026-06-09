import 'dotenv/config';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { KBOApi } from '../src/lib/kbo-api';
import { sendTelegramAlert } from '../src/lib/agent/telegram-notify';
import { PolymarketApi } from '../src/lib/polymarket-api';

/**
 * Bodhi In-Play Scanner (KBO)
 * -----------------------------
 * 1. Scans live KBO games via Puppeteer.
 * 2. Finds "Trailing Favorites".
 * 3. Deep-dives into the Box Score to check the EXACT active pitcher's ERA.
 */

async function main() {
    console.log("🚀 Starting KBO Live Deep-Scanner...");
    const kboApi = new KBOApi();
    
    console.log("📊 Fetching team baselines...");
    const teamStats = await kboApi.getTeamStats();
    
    console.log("🕸️  Booting Headless Scraper...");
    const browser = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    console.log("🌐 Fetching live schedule...");
    await page.goto('https://mykbostats.com/schedule/today', { waitUntil: 'domcontentloaded' });
    const scheduleHtml = await page.content();
    const $ = cheerio.load(scheduleHtml);
    
    const liveGames: any[] = [];

    $('a.game-line').each((i, el) => {
        const gameUrl = 'https://mykbostats.com' + $(el).attr('href');
        const awayRaw = $(el).find('.away-team').text().replace(/\s+/g, ' ').trim();
        const homeRaw = $(el).find('.home-team').text().replace(/\s+/g, ' ').trim();
        
        const awayScoreStr = $(el).find('.away-score').text().trim();
        const homeScoreStr = $(el).find('.home-score').text().trim();
        const inningRaw = $(el).find('.inning').text().replace(/\s+/g, ' ').trim();

        if (awayRaw && homeRaw) {
            const isLive = inningRaw !== 'Final' && inningRaw !== 'Postponed' && inningRaw !== '' && !inningRaw.includes('pm') && !inningRaw.includes('am');
            
            let currentInning = 0;
            const match = inningRaw.match(/\d+/);
            if (match) currentInning = parseInt(match[0]);

            liveGames.push({
                homeTeam: kboApi.normalizeTeamName(homeRaw),
                awayTeam: kboApi.normalizeTeamName(awayRaw),
                homeRaw: homeRaw,
                awayRaw: awayRaw,
                homeScore: parseInt(homeScoreStr) || 0,
                awayScore: parseInt(awayScoreStr) || 0,
                inning: currentInning,
                statusText: inningRaw,
                isLive: isLive,
                url: gameUrl
            });
        }
    });

    const activeGames = liveGames.filter(g => g.isLive);
    console.log(`\n⚾ Found ${liveGames.length} games today. ${activeGames.length} are currently LIVE.\n`);

    if (activeGames.length === 0) {
        console.log("No active live games right now.");
        await browser.close();
        return;
    }

    let alertMsg = `🚨 *BODHI LIVE ARB (KBO)* 🚨\n`;
    let foundEdge = false;

    for (const game of activeGames) {
        console.log(`Checking: ${game.awayTeam} (${game.awayScore}) @ ${game.homeTeam} (${game.homeScore}) - ${game.statusText}`);
        
        const homeInfo = teamStats[game.homeTeam] || { winPct: 0.5, era: 4.5, fullName: game.homeTeam };
        const awayInfo = teamStats[game.awayTeam] || { winPct: 0.5, era: 4.5, fullName: game.awayTeam };

        let trailingTeam = null;
        let leadingTeam = null;
        let leadingIsHome = false;
        let runDeficit = 0;

        if (game.homeScore < game.awayScore) {
            trailingTeam = homeInfo;
            leadingTeam = awayInfo;
            leadingIsHome = false;
            runDeficit = game.awayScore - game.homeScore;
        } else if (game.awayScore < game.homeScore) {
            trailingTeam = awayInfo;
            leadingTeam = homeInfo;
            leadingIsHome = true;
            runDeficit = game.homeScore - game.awayScore;
        }

        // MACRO FILTER: Just ensure we have a trailing team, it's early enough, and they are down by 2+ runs.
        // We removed the strict >.500 win% check because historical data proves that buying deep dips against bad pitchers is profitable regardless of team standings.
        if (
            trailingTeam && 
            leadingTeam &&
            game.inning >= 2 && game.inning <= 6 && 
            runDeficit >= 2
        ) {
            console.log(`  └ Macro Edge Found! Deep-diving into Box Score for current pitcher...`);
            
            // LAYER 2: Scrape the exact active pitcher
            await page.goto(game.url, { waitUntil: 'domcontentloaded' });
            const boxHtml = await page.content();
            const $box = cheerio.load(boxHtml);
            
            let activePitcherName = "Unknown";
            let activePitcherEra = 0.00;

            // MyKBOStats has multiple tables. Pitching tables have "ERA IP NP" headers.
            // Usually, Away Pitchers is before Home Pitchers in the DOM order.
            const pitcherTables: any[] = [];
            $box('table').each((i, el) => {
                const text = $box(el).text().replace(/\s+/g, ' ');
                if (text.includes('ERA') && text.includes('IP') && text.includes('NP')) {
                    pitcherTables.push(el);
                }
            });

            // If we found the tables, extract the last pitcher in the relevant team's table
            if (pitcherTables.length >= 2) {
                const targetTable = leadingIsHome ? pitcherTables[1] : pitcherTables[0];
                const rows = $box(targetTable).find('tbody tr');
                
                if (rows.length > 0) {
                    // The last row is the active pitcher
                    const lastRow = rows.last();
                    const columns = lastRow.find('td');
                    if (columns.length >= 2) {
                        activePitcherName = $box(columns[0]).text().trim();
                        activePitcherEra = parseFloat($box(columns[1]).text().trim()) || 0.00;
                    }
                }
            }

            console.log(`  └ Active Pitcher for ${leadingTeam.fullName}: ${activePitcherName} (ERA: ${activePitcherEra})`);

            // THE KILL-SHOT LOGIC: Is this specific pitcher bad?
            if (activePitcherEra > 4.50) {
                foundEdge = true;
                console.log(`  ✅ MICRO-EDGE CONFIRMED! Sending Alert.`);
                
                alertMsg += `\n*${trailingTeam.fullName}* are trailing ${leadingTeam.fullName} by ${runDeficit} runs in ${game.statusText}.\n`;
                alertMsg += `└ 📉 *Trailing Team Strength:* ${trailingTeam.winPct.toFixed(3)} Win%\n`;
                alertMsg += `└ 🎯 *MICRO-TARGET IDENTIFIED:*\n`;
                alertMsg += `   The current active pitcher on the mound for the leading team is *${activePitcherName}* with an exact ERA of *${activePitcherEra.toFixed(2)}*.\n`;
                alertMsg += `└ 💵 *Action:* Buy ${trailingTeam.fullName} on Polymarket immediately.\n\n`;
            } else {
                console.log(`  ❌ Abort: Pitcher ${activePitcherName} is too stable (ERA ${activePitcherEra}).`);
            }
        }
    }

    await browser.close();

    if (foundEdge) {
        await sendTelegramAlert(alertMsg, 'Markdown');
    }
}

main().catch(console.error);
