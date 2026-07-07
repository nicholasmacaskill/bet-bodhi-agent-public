import fetch from 'node-fetch';

async function main() {
    // Fetch active events from Polymarket Gamma API
    const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (!Array.isArray(data)) {
        console.log("Response is not an array:", data);
        return;
    }
    
    console.log(`Fetched ${data.length} events.`);
    
    // Set of all unique tags found
    const allTags = new Map<string, string>(); // slug -> label
    
    for (const event of data) {
        if (event.tags) {
            for (const tag of event.tags) {
                allTags.set(tag.slug, tag.label);
            }
        }
        
        // Print some event titles that look like sports
        const title = event.title || "";
        const category = event.category || "";
        if (category.toLowerCase().includes('sport') || title.toLowerCase().includes('vs') || title.toLowerCase().includes('@') || event.slug?.toLowerCase().includes('sport')) {
            console.log(`Sport-like Event: "${title}" | Category: "${category}" | Tags: ${JSON.stringify(event.tags)}`);
        }
    }
    
    console.log("\nAll found tags:");
    for (const [slug, label] of allTags.entries()) {
        console.log(`  - Slug: "${slug}" | Label: "${label}"`);
    }
}

main().catch(console.error);
