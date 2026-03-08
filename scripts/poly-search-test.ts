import { chromium } from 'playwright';

async function main() {
    console.log("Launching Playwright to emulate Polymarket Search...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('api') || url.includes('algolia') || url.includes('search')) {
            if (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
                try {
                    const status = response.status();
                    if (status === 200) {
                        const text = await response.text();
                        if (text.toLowerCase().includes('jays') || text.toLowerCase().includes('orioles')) {
                            console.log(`\n[BINGO] Found target data in URL: ${url}`);
                            console.log(text.substring(0, 500));
                        }
                    }
                } catch (e) { }
            }
        }
    });

    try {
        await page.goto('https://polymarket.com', { waitUntil: 'load', timeout: 30000 });
        console.log("Page loaded. Clicking search bar and typing 'Blue Jays'...");
        await page.waitForTimeout(2000);
        // Emulate Algolia search if it fires
        // the endpoint is usually: https://gamma-api.polymarket.com/events?query=Blue%20Jays
        const directApi = await context.request.get('https://gamma-api.polymarket.com/events?query=Blue');
        const searchJson = await directApi.json();
        console.log(`Direct API /events?query=Blue returned ${searchJson.length} items`);

    } catch (e) {
        console.log("Error loading page:", e);
    }

    await browser.close();
}

main().catch(console.error);
