import { chromium } from 'playwright';

async function main() {
    console.log("Launching Playwright to intercept Polymarket network requests...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('api') || url.includes('graphql') || url.includes('events') || url.includes('markets')) {
            if (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
                try {
                    const status = response.status();
                    if (status === 200) {
                        const headers = response.headers();
                        const contentType = headers['content-type'] || '';
                        if (contentType.includes('application/json')) {
                            const text = await response.text();
                            if (text.toLowerCase().includes('twins') || text.toLowerCase().includes('phillies') || text.toLowerCase().includes('red sox')) {
                                console.log(`\n[BINGO] Found target data in URL: ${url}`);
                            } else if (url.includes('gamma') || url.includes('clob')) {
                                console.log(`[API CALL] ${url} (No target match)`);
                            }
                        }
                    }
                } catch (e) { }
            }
        }
    });

    try {
        await page.goto('https://polymarket.com/sports/baseball/games', { waitUntil: 'load', timeout: 30000 });
        console.log("Page loaded. Waiting a few seconds for data to populate...");
        await page.waitForTimeout(5000);
    } catch (e) {
        console.log("Error loading page:", e);
    }

    await browser.close();
}

main().catch(console.error);
