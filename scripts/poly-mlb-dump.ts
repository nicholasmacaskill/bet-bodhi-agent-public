import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    console.log("Fetching Polymarket conditions...");

    let offset = 0;
    const maxPages = 15; // Go deep
    let found = 0;

    for (let i = 0; i < maxPages; i++) {
        // Querying explicitly by category or keyword might help. We'll just dump titles for now
        const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=1000&offset=${offset}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.error(`Polymarket API Error: ${response.status} ${response.statusText}`);
            break;
        }

        const data = await response.json();
        if (!data || !Array.isArray(data) || data.length === 0) break;

        for (const event of data) {
            // Log any event title that mentions 'vs' or teams from the user's screenshot like 'Red Sox', 'Twins', 'Pirates'
            const t = event.title?.toLowerCase() || '';
            if (t.includes('baseball') || t.includes('mlb') || t.includes('twins') || t.includes('pirates') || t.includes('red sox') || t.includes('phillies')) {
                console.log(`[FOUND] ${event.title}`);
                console.log(`        Category: ${event.category}`);
                if (event.markets && event.markets.length > 0) {
                    console.log(`        Condition: ${event.markets[0].question}`);
                }
                found++;
            }
        }
        offset += 1000;
    }

    console.log(`\nFound ${found} matching events.`);
}

main().catch(console.error);
