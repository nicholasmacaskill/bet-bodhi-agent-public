
async function queryKBO() {
    try {
        const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=50&query=KBO`;
        const res = await fetch(url);
        const data = await res.json();
        console.log("KBO Query Result:", JSON.stringify(data, null, 2));
    } catch(e) {
        console.error(e);
    }
}
queryKBO();
