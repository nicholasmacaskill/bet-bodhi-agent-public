import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    console.log("Deep sweep entire JSON strings on Polymarket Gamma API for 'Blue Jays'...");

    let offset = 0;
    const maxPages = 50;
    let found = 0;

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
            const stringified = JSON.stringify(event).toLowerCase();
            if (stringified.includes('blue jays') || stringified.includes('orioles')) {
                console.log(`\n[FULL MATCH IN JSON] ${event.title}`);
                if (event.markets && event.markets.length > 0) {
                    console.log(`  Question: ${event.markets[0].question}`);
                    console.log(`  Outcomes: ${event.markets[0].outcomes}`);
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
