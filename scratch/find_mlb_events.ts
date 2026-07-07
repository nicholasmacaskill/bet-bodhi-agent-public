import fetch from 'node-fetch';

async function main() {
    console.log("Fetching all active events to find MLB/Baseball/KBO...");
    let offset = 0;
    const limit = 100;
    let found = 0;
    
    for (let page = 0; page < 15; page++) {
        const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=${limit}&offset=${offset}`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (!Array.isArray(data) || data.length === 0) {
            break;
        }
        
        for (const event of data) {
            const title = event.title || "";
            const category = event.category || "";
            const tags = (event.tags || []).map((t: any) => t.slug);
            const desc = event.description || "";
            
            if (
                title.toLowerCase().includes('yankees') || 
                title.toLowerCase().includes('red sox') || 
                title.toLowerCase().includes('mlb') || 
                title.toLowerCase().includes('baseball') ||
                title.toLowerCase().includes('kbo') ||
                tags.includes('baseball') || 
                tags.includes('mlb') ||
                tags.includes('kbo') ||
                category.toLowerCase().includes('baseball') ||
                category.toLowerCase().includes('mlb')
            ) {
                found++;
                console.log(`Found Event #${found}:`);
                console.log(`  Title: "${title}"`);
                console.log(`  Slug: "${event.slug}"`);
                console.log(`  Category: "${category}"`);
                console.log(`  Tags: ${JSON.stringify(event.tags)}`);
                if (event.markets) {
                    console.log(`  Markets (${event.markets.length}):`);
                    for (const m of event.markets) {
                        console.log(`    - Question: "${m.question}"`);
                        console.log(`      Outcomes: ${JSON.stringify(m.outcomes)}`);
                        console.log(`      Prices: ${JSON.stringify(m.outcomePrices)}`);
                        console.log(`      ConditionId: ${m.conditionId}`);
                    }
                }
            }
        }
        offset += limit;
    }
    console.log(`Done. Found ${found} baseball-related events.`);
}

main().catch(console.error);
