import 'dotenv/config';

async function main() {
    const conditionId = "0x481c6ee273dd4c78ff904706fd5b9f97e50efa4f85d3fa5d61709b83151fe522";
    const url = `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`;
    try {
        const res = await fetch(url);
        const markets = await res.json();
        console.log("Market Details from Gamma API:");
        console.log(JSON.stringify(markets, null, 2));
    } catch (e: any) {
        console.error("Error fetching market details:", e.message);
    }
}

main().catch(console.error);
