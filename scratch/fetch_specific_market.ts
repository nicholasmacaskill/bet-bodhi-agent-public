async function main() {
    const conditionId = "0x481c6ee273dd4c78ff904706fd5b9f97e50efa4f85d3fa5d61709b83151fe522";
    const url = `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`;
    try {
        const res = await fetch(url);
        const markets = await res.json();
        const m = markets.find((x: any) => x.conditionId === conditionId);
        if (m) {
            console.log("Found market:");
            console.log(`Question: ${m.question}`);
            console.log(`Slug: ${m.slug}`);
            console.log(`Outcomes: ${m.outcomes}`);
            console.log(`Outcome Prices: ${m.outcomePrices}`);
            console.log(`Description: ${m.description}`);
            console.log(`Closed: ${m.closed}, Active: ${m.active}`);
        } else {
            console.log("Market not found in results.");
        }
    } catch (e: any) {
        console.error("Error:", e.message);
    }
}

main();
