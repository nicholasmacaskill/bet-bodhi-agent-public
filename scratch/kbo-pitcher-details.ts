import 'dotenv/config';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

async function main() {
    console.log("⚾ Fetching detailed KBO live box scores...");
    const browser = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
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
            liveGames.push({
                homeTeam: homeRaw,
                awayTeam: awayRaw,
                homeScore: parseInt(homeScoreStr) || 0,
                awayScore: parseInt(awayScoreStr) || 0,
                statusText: inningRaw,
                isLive: isLive,
                url: gameUrl
            });
        }
    });

    console.log(`Found ${liveGames.length} games today.`);
    
    for (const game of liveGames) {
        console.log(`\n=========================================`);
        console.log(`MATCHUP: ${game.awayTeam} (${game.awayScore}) @ ${game.homeTeam} (${game.homeScore}) - [${game.statusText}]`);
        console.log(`URL: ${game.url}`);
        console.log(`=========================================`);

        try {
            await page.goto(game.url, { waitUntil: 'domcontentloaded' });
            const boxHtml = await page.content();
            const $box = cheerio.load(boxHtml);
            
            const pitcherTables: any[] = [];
            $box('table').each((i, el) => {
                const text = $box(el).text().replace(/\s+/g, ' ');
                if (text.includes('ERA') && text.includes('IP') && text.includes('NP')) {
                    pitcherTables.push({
                        element: el,
                        team: i === 0 || pitcherTables.length === 0 ? game.awayTeam : game.homeTeam // typical order: away then home
                    });
                }
            });

            // Let's refine the team assignment if we can find team headers/labels near the tables
            if (pitcherTables.length >= 2) {
                // Let's just print both tables
                for (let idx = 0; idx < pitcherTables.length; idx++) {
                    const tableObj = pitcherTables[idx];
                    const estimatedTeam = idx === 0 ? game.awayTeam : game.homeTeam;
                    console.log(`\n  Pitching stats for: ${estimatedTeam}`);
                    console.log(`  -------------------------------------------------------------`);
                    console.log(`  %-25s %-5s %-5s %-5s %-5s %-5s %-5s %-5s`.replace(/%/g, '%'), 'Pitcher', 'ERA', 'IP', 'H', 'R', 'ER', 'BB', 'SO');
                    
                    const rows = $box(tableObj.element).find('tbody tr');
                    rows.each((rIdx, row) => {
                        const cols = $(row).find('td');
                        if (cols.length >= 8) {
                            const name = $(cols[0]).text().trim();
                            const era = $(cols[1]).text().trim();
                            const ip = $(cols[2]).text().trim();
                            const h = $(cols[3]).text().trim();
                            const r = $(cols[4]).text().trim();
                            const er = $(cols[5]).text().trim();
                            const bb = $(cols[6]).text().trim();
                            const so = $(cols[7]).text().trim();
                            console.log(`  %-25s %-5s %-5s %-5s %-5s %-5s %-5s %-5s`, name, era, ip, h, r, er, bb, so);
                        }
                    });
                }
            } else {
                console.log("  No detailed pitching stats found yet (game might not have started or data is loading).");
            }
        } catch (err) {
            console.error(`  Error parsing game details: ${err}`);
        }
    }

    await browser.close();
}

main().catch(console.error);
