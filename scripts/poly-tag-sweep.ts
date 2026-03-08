import { PolymarketApi } from '../src/lib/polymarket-api';

async function main() {
    console.log("Searching by Tags...");

    // Testing specific known tags / slugs
    const tagsToTest = ['mlb', 'baseball', 'spring-training', 'spring training'];

    for (const tag of tagsToTest) {
        console.log(`\n--- Fetching Tag: ${tag} ---`);
        const url = `https://gamma-api.polymarket.com/events?tags=${tag}&active=true&closed=false&limit=100`;
        const response = await fetch(url);

        if (!response.ok) continue;

        const data = await response.json();
        if (Array.isArray(data)) {
            data.forEach(event => {
                console.log(`[${tag}] ${event.title} (Volume: $${event.volume})`);
            });
        }
    }
}

main().catch(console.error);
