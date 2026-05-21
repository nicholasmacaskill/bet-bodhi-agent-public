
async function queryKBO() {
    try {
        const url = `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100&query=KBO`;
        const res = await fetch(url);
        const data = await res.json();
        if (Array.isArray(data)) {
            console.log(`Found ${data.length} events matching query 'KBO'`);
            data.forEach(e => {
                console.log(`- Title: "${e.title}", slug: "${e.slug}", category: "${e.category}"`);
            });
        } else {
            console.log("Response is not an array:", typeof data);
        }
    } catch(e) {
        console.error(e);
    }
}
queryKBO();
