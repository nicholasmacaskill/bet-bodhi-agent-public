import { chromium } from 'playwright';

async function main() {
    console.log("Launching headless browser to check the UI...");
    const browser = await chromium.launch({ headless: true });
    // Use a very standard user agent
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    let graphqlData = "";
    page.on('response', async (res) => {
        if (res.url().includes('graphql') || res.url().includes('api')) {
            try {
                const text = await res.text();
                if (text.toLowerCase().includes('jays') || text.toLowerCase().includes('orioles')) {
                    console.log(`[API INTERCEPT] Found data in request to ${res.url()}`);
                    graphqlData = text;
                }
            } catch (e) { }
        }
    });

    try {
        await page.goto('https://polymarket.com/sports/baseball/games', { waitUntil: 'networkidle', timeout: 30000 });
        console.log("Page loaded. Waiting a few seconds for data population...");
        await page.waitForTimeout(5000);

        console.log("Extracting all text from the page to see what rendered...");
        const rawText = await page.evaluate(() => {
            return document.body.innerText;
        });

        console.log("\n--- SNIPPET OF PAGE TEXT ---");
        // Print lines that have baseball terms
        const lines = rawText.split('\n');
        for (const line of lines) {
            const l = line.toLowerCase();
            if (l.includes('jays') || l.includes('orioles') || l.includes('wbc') || l.includes('mlb')) {
                console.log(line);
            }
        }
        console.log("----------------------------");

    } catch (e) {
        console.log("Navigation error:", e);
    }

    await browser.close();
}

main().catch(console.error);
