// Test ESPN API variations for KBO
async function main() {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    const endpoints = [
        `https://site.api.espn.com/apis/site/v2/sports/baseball/kbo/scoreboard`,
        `https://site.api.espn.com/apis/site/v2/sports/baseball/kbo/scoreboard?dates=${today}`,
        `https://site.web.api.espn.com/apis/site/v2/sports/baseball/kbo/scoreboard`,
        `https://site.api.espn.com/apis/site/v2/sports/baseball/kbo/scoreboard?lang=en&region=us&limit=99`,
    ];
    
    for (const url of endpoints) {
        try {
            console.log(`\nTrying: ${url}`);
            const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } });
            console.log(`Status: ${r.status}`);
            if (r.status === 200) {
                const data = await r.json();
                console.log("Events:", data?.events?.length ?? 0);
                if (data?.events?.length > 0) {
                    const e = data.events[0];
                    const comp = e.competitions?.[0];
                    const home = comp?.competitors?.find((c: any) => c.homeAway === 'home');
                    const away = comp?.competitors?.find((c: any) => c.homeAway === 'away');
                    console.log(`  Sample: ${away?.team?.displayName} @ ${home?.team?.displayName} | ${comp?.status?.type?.description}`);
                }
            }
        } catch(e: any) {
            console.error("Error:", e.message);
        }
    }
}

main().catch(console.error);
