import 'dotenv/config';

async function main() {
    const conditionId = "0x7d8526b35a02aaad53aa897523a736f8921c97a96fa90e541f8098db7cca2ea3";
    const url = `https://gamma-api.polymarket.com/markets?condition_ids=${conditionId}&closed=true`;

    const res = await fetch(url);
    const data = await res.json();
    if (data && data.length > 0) {
        console.log(JSON.stringify(data[0], null, 2));
    }
}

main().catch(console.error);
