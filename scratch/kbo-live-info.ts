import 'dotenv/config';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function main() {
    console.log("⚾ Fetching KBO live game tables with delays...");
    const browser = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

    const liveGames = [
        { name: "Kia @ Hanwha", url: "https://mykbostats.com/games/13567-Kia-vs-Hanwha-20260611" },
        { name: "NC @ Kiwoom", url: "https://mykbostats.com/games/13568-NC-vs-Kiwoom-20260611" },
        { name: "Doosan @ Lotte", url: "https://mykbostats.com/games/13569-Doosan-vs-Lotte-20260611" },
        { name: "SSG @ LG", url: "https://mykbostats.com/games/13570-SSG-vs-LG-20260611" },
        { name: "Samsung @ KT", url: "https://mykbostats.com/games/13571-Samsung-vs-KT-20260611" }
    ];

    for (const game of liveGames) {
        console.log(`\n==================================================================`);
        console.log(`GAME: ${game.name}`);
        console.log(`URL: ${game.url}`);
        console.log(`==================================================================`);

        try {
            await page.goto(game.url, { waitUntil: 'domcontentloaded' });
            // wait a little bit for any async components
            await delay(4000);
            
            const html = await page.content();
            const $ = cheerio.load(html);

            let matchedAny = false;
            $('table').each((i, el) => {
                const headerText = $(el).find('thead').text().replace(/\s+/g, ' ').trim();
                const textSnippet = $(el).text().replace(/\s+/g, ' ').substring(0, 100);
                
                if (headerText.toLowerCase().includes('era') || headerText.toLowerCase().includes('ip') || textSnippet.toLowerCase().includes('pitching')) {
                    matchedAny = true;
                    console.log(`  Table #${i} (Headers: "${headerText}")`);
                    
                    const rows = $(el).find('tbody tr, tr');
                    rows.each((rIdx, row) => {
                        const cols = $(row).find('td, th');
                        const colTexts: string[] = [];
                        cols.each((cIdx, col) => {
                            colTexts.push($(col).text().replace(/\s+/g, ' ').trim());
                        });
                        if (colTexts.length > 0) {
                            console.log(`    Row ${rIdx}: ${colTexts.join(' | ')}`);
                        }
                    });
                }
            });
            
            if (!matchedAny) {
                console.log(`  No pitching tables matched or found on page. Title was: "${await page.title()}"`);
            }
        } catch (err) {
            console.error(`  Error: ${err}`);
        }
        
        await delay(3000); // 3 seconds delay before next game
    }

    await browser.close();
}

main().catch(console.error);
