import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

async function main() {
    const browser = await puppeteer.launch({ headless: 'new' as any, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
    
    // Pick a date from ~2 weeks ago
    const targetDate = '2026-06-05';
    console.log(`Fetching schedule for ${targetDate}...`);
    await page.goto(`https://mykbostats.com/schedule/${targetDate}`, { waitUntil: 'domcontentloaded' });
    
    const scheduleHtml = await page.content();
    const $ = cheerio.load(scheduleHtml);
    
    let gameUrl = '';
    $('a').each((i, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/games/')) {
            console.log("Found game link:", href);
            if (!gameUrl) gameUrl = 'https://mykbostats.com' + href;
        }
    });
    
    if (!gameUrl) {
        console.log("No game URLs found.");
        await browser.close();
        return;
    }
    
    console.log(`Fetching box score from: ${gameUrl}`);
    await page.goto(gameUrl, { waitUntil: 'domcontentloaded' });
    
    const boxHtml = await page.content();
    const $box = cheerio.load(boxHtml);
    
    console.log("\n--- TABLE STRUCTURES ---");
    $box('table').each((i, el) => {
        const text = $box(el).text().trim().replace(/\s+/g, ' ');
        // Looking for linescore table. Usually has 'R H E' or '1 2 3'
        if (text.includes('1 2 3') || text.includes('R H E')) {
            console.log(`Table ${i} text snippet:`, text.substring(0, 100));
            // Let's dump the rows of the linescore table
            const rows = $box(el).find('tr');
            rows.each((j, rowEl) => {
                const cols = $box(rowEl).find('td, th').map((k, colEl) => $box(colEl).text().trim()).get();
                console.log(` Row ${j}:`, cols.join(' | '));
            });
        }
    });

    await browser.close();
}

main().catch(console.error);
