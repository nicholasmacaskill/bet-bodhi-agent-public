async function main() {
    const conditionId = "0x6f461ea5575510656044db7bcb2b2d243ff680bb1";
    const url = `https://gamma-api.polymarket.com/markets?condition_id=${conditionId}`;
    const res = await fetch(url);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);
