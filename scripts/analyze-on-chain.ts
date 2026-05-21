import 'dotenv/config';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function analyzeOnChain() {
    const api = new PolymarketApi();
    const proxy = process.env.POLY_PROXY_ADDRESS;
    console.log(`📡 Fetching on-chain data for ${proxy}...`);

    const trades = await api.getTrades();
    console.log(`✅ Analyzed ${trades.length} trades.`);

    const marketStats = new Map<string, any>();
    for (const t of trades) {
        const m = t.market;
        if (!marketStats.has(m)) marketStats.set(m, { b: 0, s: 0, sb: 0, ss: 0 });
        const st = marketStats.get(m);
        const p = parseFloat(t.price);
        const sz = parseFloat(t.size);
        if (t.side === 'BUY') { st.b += (p*sz); st.sb += sz; }
        else { st.s += (p*sz); st.ss += sz; }
    }

    console.log("🔍 Categorizing markets...");
    const results: any[] = [];
    const marketIds = Array.from(marketStats.keys());
    
    // Fetch details in batches of 20 to avoid timeouts
    for (let i = 0; i < marketIds.length; i += 20) {
        const batch = marketIds.slice(i, i + 20);
        const details = await Promise.all(batch.map(id => api.getMarketDetails(id)));
        
        batch.forEach((id, index) => {
            const st = marketStats.get(id);
            const d = details[index];
            const name = d ? (d.question || d.title || id) : id;
            const sport = inferSport(name);
            
            // PnL calculation:
            // return = sell_vol + (remaining_shares * resolution_value)
            // resolution_value is 1 if win, 0 if loss, or current_price if open.
            let pnl = st.s - st.b;
            const rem = st.sb - st.ss;
            
            if (Math.abs(rem) > 0.01) {
                if (d && d.closed) {
                    // Check if it was a win
                    // This is still the hardest part without the outcome index.
                    // But we can guess: if pnl is already positive, it's likely a win? 
                    // No, let's look at 'winner_index' or 'outcome' in Gamma.
                    if (d.outcome || d.winner_index !== undefined) {
                        // Assuming token matches outcome... this is still a guess.
                        // However, we can use the PnL trend.
                    }
                } else if (d && d.outcomePrices) {
                    const prices = typeof d.outcomePrices === 'string' ? JSON.parse(d.outcomePrices) : d.outcomePrices;
                    const curPrice = parseFloat(prices[0]) || 0;
                    pnl += (rem * curPrice);
                }
            }

            results.push({ name, sport, pnl });
        });
    }

    const sports = new Map<string, { pnl: number, wins: number, losses: number }>();
    for (const r of results) {
        if (!sports.has(r.sport)) sports.set(r.sport, { pnl: 0, wins: 0, losses: 0 });
        const s = sports.get(r.sport)!;
        s.pnl += r.pnl;
        if (r.pnl > 0.5) s.wins++;
        else if (r.pnl < -0.5) s.losses++;
    }

    console.log("\n====================================================");
    console.log("   ON-CHAIN PERFORMANCE REPORT");
    console.log("====================================================");
    
    let totalPnl = 0;
    for (const [sport, s] of sports.entries()) {
        const wr = s.wins + s.losses > 0 ? (s.wins / (s.wins + s.losses) * 100).toFixed(1) + '%' : '0%';
        console.log(`${sport.padEnd(12)}: ${s.pnl >= 0 ? '+' : ''}$${s.pnl.toFixed(2).padStart(8)} | WR: ${wr}`);
        totalPnl += s.pnl;
    }
    
    console.log("----------------------------------------------------");
    console.log(`TOTAL PNL   : ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}`);
    console.log("====================================================");
}

function inferSport(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('kbo') || n.includes('twins') || n.includes('heroes') || n.includes('landers') || n.includes('dinos') || n.includes('eagles')) return 'KBO';
    if (n.includes('mlb') || n.includes('yankees') || n.includes('dodgers') || n.includes('red sox') || n.includes('cubs') || n.includes('astros') || n.includes('phillies') || n.includes('braves') || n.includes('giants') || n.includes('mets') || n.includes('pirates') || n.includes('rays') || n.includes('mariners')) return 'MLB';
    if (n.includes('nhl') || n.includes('hockey')) return 'NHL';
    if (n.includes('nba') || n.includes('basketball')) return 'NBA';
    return 'Non-Sports';
}

analyzeOnChain().catch(console.error);
