import { builder } from '@builder.io/sdk';

async function main() {
    const apiKey = '019ccb84-f334-7709-bae7-c7191f44a63e';
    console.log(`Initializing Builder.io SDK with key: ${apiKey}`);

    // Initialize the builder SDK
    builder.init(apiKey);

    try {
        console.log("Fetching all models/content from Builder.io...");

        // Let's try to query 'sports-market' or 'game' or just 'page' to see what's hosted
        const content = await builder.getAll('page', { limit: 10 });
        console.log(`Found ${content.length} 'page' entries.`);

        content.forEach(c => {
            console.log(`\n--- Page: ${c.name} ---`);
            console.log(JSON.stringify(c.data, null, 2).substring(0, 500));
        });

        // Try getting any model
        const symbol = await builder.getAll('symbol', { limit: 10 });
        console.log(`\nFound ${symbol.length} 'symbol' entries.`);
        symbol.forEach(s => {
            console.log(`\n--- Symbol: ${s.name} ---`);
            console.log(JSON.stringify(s.data, null, 2).substring(0, 500));
        });

    } catch (e: any) {
        console.error("Builder.io SDK Error:", e.message || e);
    }
}

main().catch(console.error);
