import { chromium } from 'playwright';

async function main() {
    console.log("Launching Playwright to emulate real Polymarket Search...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    let foundEvents: any[] = [];

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('api') || url.includes('algolia') || url.includes('search') || url.includes('graphql')) {
            if (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
                try {
                    const status = response.status();
                    if (status === 200) {
                        const contentType = response.headers()['content-type'] || '';
                        if (contentType.includes('application/json')) {
                            const text = await response.text();
                            if (text.toLowerCase().includes('jays') || text.toLowerCase().includes('orioles') || text.toLowerCase().includes('wbc') || text.toLowerCase().includes('baseball')) {
                                console.log(`\n[BINGO] Found keyword in URL response: ${url}`);
                                // just print a small snippet to see the structure
                                console.log(text.substring(0, 500));
                            }
                        }
                    }
                } catch (e) { }
            }
        }
    });

    try {
        await page.goto('https://polymarket.com/sports/baseball/games', { waitUntil: 'load', timeout: 30000 });
        console.log("Page loaded. Waiting 5s for base API calls...");
        await page.waitForTimeout(5000);

        console.log("Dumping all text on the page to see if Blue Jays is visible...");
        const pageText = await page.innerText('body');
        if (pageText.toLowerCase().includes('jays')) {
            console.log("[DOM BINGO] 'Jays' is physically rendered on the page!");
        } else {
            console.log("DOM does not contain 'Jays'.");
        }

    } catch (e) {
        console.log("Error loading page:", e);
    }

    await browser.close();
}

main().catch(console.error);
