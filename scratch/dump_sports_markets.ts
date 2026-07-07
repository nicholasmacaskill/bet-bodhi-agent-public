import fetch from 'node-fetch';

async function main() {
    const slugs = ['baseball', 'mlb', 'kbo', 'sports'];
    console.log("Fetching markets for slugs:", slugs);
    
    for (const slug of slugs) {
        const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100&tag_slug=${slug}`;
        try {
            const res = await fetch(url);
            if (!res.ok) {
                console.log(`Failed for slug ${slug}: ${res.statusText}`);
                continue;
            }
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) {
                console.log(`No events found for slug ${slug}`);
                continue;
            }
            console.log(`\n--- Slug: ${slug} (Found ${data.length} events) ---`);
            for (const event of data.slice(0, 10)) {
                console.log(`Event Title: ${event.title}`);
                if (event.markets) {
                    for (const m of event.markets) {
                        console.log(`  Market Question: "${m.question}"`);
                        console.log(`  Outcomes: ${JSON.stringify(m.outcomes)}`);
                        console.log(`  Outcome Prices: ${JSON.stringify(m.outcomePrices)}`);
                        console.log(`  Active: ${m.active}, Closed: ${m.closed}`);
                    }
                }
            }
        } catch (e: any) {
            console.error(`Error fetching slug ${slug}:`, e.message);
        }
    }
}

main().catch(console.error);
