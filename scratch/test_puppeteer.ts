import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function main() {
    console.log("Launching Puppeteer to test box score scraping...");
    const browser = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    // Grab a recent game (e.g. from the test HTML earlier)
    // Looking at the previous HTML, game URL looks like: /games/13527-Hanwha-vs-Doosan-20260602
    const gameUrl = 'https://mykbostats.com/games/13527-Hanwha-vs-Doosan-20260602';
    console.log(`Navigating to ${gameUrl}`);
    
    await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
    const html = await page.content();
    fs.writeFileSync('scratch/boxscore.html', html);
    
    const $ = cheerio.load(html);
    
    // In baseball box scores, pitchers are usually in a table.
    // Let's print out all tables text to see where pitchers are.
    console.log("\nTables found:");
    $('table').each((i, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text.includes('IP') || text.includes('ERA') || text.includes('Pitchers')) {
            console.log(`Table ${i} text: ${text.slice(0, 150)}...`);
        }
    });

    await browser.close();
}

main().catch(console.error);
