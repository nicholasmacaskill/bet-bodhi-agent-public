import { chromium } from 'playwright';

async function main() {
    console.log("Extracting DOM context for 'jays'...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });
    const page = await context.newPage();

    let graphqlPayloads: string[] = [];
    page.on('response', async (response) => {
        if (response.url().includes('graphql')) {
            try {
                const text = await response.text();
                // We're capturing graphql just in case
                if (text.toLowerCase().includes('jays')) {
                    graphqlPayloads.push(text);
                }
            } catch (e) { }
        }
    });

    try {
        await page.goto('https://polymarket.com/sports/baseball/games', { waitUntil: 'load', timeout: 30000 });
        await page.waitForTimeout(5000);

        // Find all elements containing 'Jays'
        const locators = page.locator('text=Jays');
        const count = await locators.count();
        console.log(`Found ${count} elements matching 'Jays'`);

        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const text = await locators.nth(i).innerText();
                const html = await locators.nth(i).evaluate(el => el.outerHTML);
                console.log(`\n--- Element ${i} ---`);
                console.log(`Text: ${text}`);
                console.log(`HTML: ${html.substring(0, 300)}`);
            }
        }
    } catch (e) {
        console.log("Error loading page:", e);
    }
    await browser.close();
}

main().catch(console.error);
