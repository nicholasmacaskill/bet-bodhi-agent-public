async function testSxBet() {
    console.log("Fetching SX.bet active markets (Batch 1)...");
    try {
        const res = await fetch('https://api.sx.bet/markets/active');
        const data = await res.json();

        if (data.data && data.data.markets) {
            console.log(`Found ${data.data.markets.length} active markets.`);
            const labels = new Set();
            data.data.markets.forEach((m: any) => labels.add(m.sportLabel));
            console.log("Unique Sport Labels found:", Array.from(labels));

            const sportsMarkets = data.data.markets.filter((m: any) =>
                ['Basketball', 'Hockey', 'Baseball', 'American Football', 'Soccer', 'Tennis'].includes(m.sportLabel)
            );

            if (sportsMarkets.length > 0) {
                console.log(`First ${Math.min(3, sportsMarkets.length)} sports markets:`);
                for (let i = 0; i < Math.min(3, sportsMarkets.length); i++) {
                    console.log(JSON.stringify(sportsMarkets[i], null, 2));
                }
            } else {
                console.log("Still no major sports found in the first batch.");
            }
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

testSxBet();
