import { builder } from '@builder.io/sdk';

async function main() {
    const apiKey = '019ccb84-f334-7709-bae7-c7191f44a63e';
    builder.init(apiKey);

    const modelsToTest = ['page', 'symbol', 'section', 'data', 'navigation', 'footer', 'header', 'component', 'polymarket', 'mock', 'games', 'sports', 'wbc', 'mlb_game', 'mlb', 'game'];

    console.log("Fetching content across various Builder.io models...");
    let foundAnything = false;

    for (const model of modelsToTest) {
        try {
            const content = await builder.getAll(model, { limit: 5 });
            if (content.length > 0) {
                console.log(`\nFound ${content.length} entries for model '${model}'.`);
                content.forEach(c => {
                    console.log(`[${model}] Name: ${c.name}`);
                    console.log(JSON.stringify(c.data, null, 2).substring(0, 300));
                });
                foundAnything = true;
            }
        } catch (e: any) {
            // model might not exist, ignore
        }
    }

    if (!foundAnything) {
        console.log("No content found in any tested models.");
    }
}

main().catch(console.error);
