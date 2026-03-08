import * as cheerio from 'cheerio';

async function main() {
    console.log("Fetching Polymarket Baseball HTML directly...");
    const htmlResponse = await fetch('https://polymarket.com/sports/baseball/games', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const html = await htmlResponse.text();
    const $ = cheerio.load(html);

    const nextDataScript = $('#__NEXT_DATA__').html();

    if (nextDataScript) {
        console.log("Found __NEXT_DATA__ tag.");
        try {
            const data = JSON.parse(nextDataScript);
            // Polymarket usually dumps market data straight into the page props
            const stringified = JSON.stringify(data).toLowerCase();

            ['twins', 'phillies', 'pirates', 'red sox'].forEach(team => {
                if (stringified.includes(team)) {
                    console.log(`[SSR MATCH] Found references to ${team} within SSR payload.`);
                }
            });

            // Try to extract actual market titles
            const regex = /"question":"([^"]*)"/g;
            let match;
            let count = 0;
            while ((match = regex.exec(stringified)) !== null && count < 20) {
                if (match[1].includes('baseball') || match[1].includes('mlb') || match[1].includes('vs')) {
                    console.log(`Found SSR Question: ${match[1]}`);
                    count++;
                }
            }

        } catch (e) {
            console.error("Failed to parse Next data.", e);
        }
    } else {
        console.log("No __NEXT_DATA__ tag found. They might be using the new Next.js App Router Payload.");
        // App router payloads are in scripts at the bottom of the page usually starting with self.__next_f
        let appContent = "";
        $('script').each((i, el) => {
            const src = $(el).html() || '';
            if (src.includes('twins') || src.includes('phillies')) {
                console.log("[APP ROUTER MATCH] Found keywords in script block!");
            }
        });

        // Also just look at raw text in DOM
        if (html.toLowerCase().includes('twins')) console.log("Text 'twins' found in raw HTML.");
        if (html.toLowerCase().includes('phillies')) console.log("Text 'phillies' found in raw HTML.");
    }
}

main().catch(console.error);
