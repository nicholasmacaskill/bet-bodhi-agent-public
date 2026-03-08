import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    console.log("Deep sweeping Polymarket Gamma API...");

    let offset = 0;
    const maxPages = 50; // Fetch 50,000 events max
    let found = 0;
    const targets = ['phillies', 'twins', 'red sox', 'pirates', 'astros', 'nationals', 'mlb', 'baseball'];

    for (let i = 0; i < maxPages; i++) {
        const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=1000&offset=${offset}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Error: ${response.status}`);
            break;
        }

        const data = await response.json();
        if (!data || !Array.isArray(data) || data.length === 0) break;

        for (const event of data) {
            const t = event.title?.toLowerCase() || '';
            const c = event.category?.toLowerCase() || '';
            const d = event.description?.toLowerCase() || '';

            // Check if any target word is in title, category, or description
            const isMatch = targets.some(target => t.includes(target) || c.includes(target) || d.includes(target));

            if (isMatch) {
                console.log(`\n[FOUND] ${event.title}`);
                console.log(`  Target Match In: Title? ${targets.some(x => t.includes(x))}, Category? ${targets.some(x => c.includes(x))}`);
                if (event.markets && event.markets.length > 0) {
                    console.log(`  Question: ${event.markets[0].question}`);
                    console.log(`  Active: ${event.markets[0].active}`);
                }
                found++;
            }
        }
        offset += 1000;
        process.stdout.write(`\rScanned ${offset} events...`);
    }

    console.log(`\n\nDeep sweep complete. Found ${found} potential matches.`);
}

main().catch(console.error);
