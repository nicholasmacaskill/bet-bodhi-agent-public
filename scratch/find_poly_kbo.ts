
async function findKBOMarkets() {
    try {
        let offset = 0;
        let found = false;
        for (let page = 0; page < 5; page++) {
            const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100&offset=${offset}`;
            const res = await fetch(url);
            const data = await res.json();
            if (!Array.isArray(data) || data.length === 0) break;
            
            for (const e of data) {
                const title = e.title || "";
                const slug = e.slug || "";
                if (title.toLowerCase().includes("kbo") || slug.toLowerCase().includes("kbo") || title.toLowerCase().includes("korea baseball") || title.toLowerCase().includes("baseball")) {
                    console.log(`Matched: "${title}" (slug: ${slug})`);
                    if (e.markets) {
                        e.markets.forEach((m: any) => {
                            console.log(`  Market Question: "${m.question}"`);
                            console.log(`  Outcomes:`, m.outcomes);
                            console.log(`  Prices:`, m.outcomePrices);
                        });
                    }
                    found = true;
                }
            }
            offset += 100;
        }
        if (!found) {
            console.log("No KBO/Baseball markets found in active events.");
        }
    } catch(e) {
        console.error(e);
    }
}
findKBOMarkets();
