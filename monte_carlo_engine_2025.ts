
import * as fs from 'fs';

interface Game {
    id: number;
    homeStarterId: number;
    awayStarterId: number;
    winner: 'home' | 'away';
    homeTeam: string;
    awayTeam: string;
    date: string;
}

interface StrategyResult {
    name: string;
    netProfit: number;
    wins: number;
    losses: number;
    maxDrawdown: number;
    roi: number;
    finalBankroll: number;
}

async function runMonteCarlo() {
    console.log('--- STARTING 2025 MONTE CARLO SIMULATION ---');
    
    const games = JSON.parse(fs.readFileSync('data/2025_hydrated_starters.json', 'utf8'));
    const pitchers = JSON.parse(fs.readFileSync('data/2025_pitchers.json', 'utf8'));
    const teams = JSON.parse(fs.readFileSync('data/2025_teams.json', 'utf8'));
    
    const pitcherMap = new Map(pitchers.map((p: any) => [p.id, p]));
    const teamMap = new Map(teams.map((t: any) => [t.id, t]));

    const iterations = 1000;
    const initialBankroll = 474.0;
    const stake = 15.0;

    const resultsA: StrategyResult[] = [];
    const resultsB: StrategyResult[] = [];
    const resultsC: StrategyResult[] = [];

    for (let iter = 0; iter < iterations; iter++) {
        let bankA = initialBankroll; let winsA = 0; let lossA = 0; let ddA = 0; let peakA = bankA;
        let bankB = initialBankroll; let winsB = 0; let lossB = 0; let ddB = 0; let peakB = bankB;
        let bankC = initialBankroll; let winsC = 0; let lossC = 0; let ddC = 0; let peakC = bankC;

        for (const g of games) {
            const hPitcher = pitcherMap.get(g.homeStarterId);
            const aPitcher = pitcherMap.get(g.awayStarterId);
            if (!hPitcher || !aPitcher) continue;

            // EDGE CALCULATION (Simplified Pillar Analysis)
            const eraDelta = Math.abs(hPitcher.era - aPitcher.era);
            const edge = eraDelta * 2.0; // Basic weight
            
            const target = hPitcher.era < aPitcher.era ? 'home' : 'away';
            const winProb = 0.55 + (edge * 0.015); // Scale probability by edge (capped at 75%)
            const finalProb = Math.min(0.75, winProb);

            const isWinner = Math.random() < finalProb;
            const actualWinner = g.winner === target;

            // STRATEGY A: Baseline (High Edge > 1.5 ERA delta)
            if (eraDelta > 1.5) {
                if (actualWinner) { 
                    bankA += stake * 0.9; winsA++; 
                } else { 
                    bankA -= stake; lossA++; 
                }
                peakA = Math.max(peakA, bankA); ddA = Math.max(ddA, peakA - bankA);
            }

            // STRATEGY B: Underdog (High Edge + Target team is technically "weaker" team ERA)
            const tTarget = teamMap.get(target === 'home' ? g.homeId : g.awayId);
            const tOpp = teamMap.get(target === 'home' ? g.awayId : g.homeId);
            if (eraDelta > 2.0 && tTarget && tOpp && tTarget.era > tOpp.era) {
                if (actualWinner) { 
                    bankB += stake * 1.5; winsB++; 
                } else { 
                    bankB -= stake; lossB++; 
                }
                peakB = Math.max(peakB, bankB); ddB = Math.max(ddB, peakB - bankB);
            }

            // STRATEGY C: Anchor/Mix (High Edge + BODHI-7 Cashout)
            if (eraDelta > 3.0) {
                if (actualWinner) {
                    bankC += stake * 0.9; winsC++;
                } else {
                    // Simulate BODHI-7 Rule: Recapture 25% of the loss if lead was held
                    bankC -= (stake * 0.75); lossC++;
                }
                peakC = Math.max(peakC, bankC); ddC = Math.max(ddC, peakC - bankC);
            }
        }
        
        resultsA.push({ name: 'A', netProfit: bankA - initialBankroll, wins: winsA, losses: lossA, maxDrawdown: ddA, roi: 0, finalBankroll: bankA });
        resultsB.push({ name: 'B', netProfit: bankB - initialBankroll, wins: winsB, losses: lossB, maxDrawdown: ddB, roi: 0, finalBankroll: bankB });
        resultsC.push({ name: 'C', netProfit: bankC - initialBankroll, wins: winsC, losses: lossC, maxDrawdown: ddC, roi: 0, finalBankroll: bankC });
    }

    const avg = (arr: StrategyResult[]) => arr.reduce((a, b) => a + b.netProfit, 0) / arr.length;
    const avgDD = (arr: StrategyResult[]) => arr.reduce((a, b) => a + b.maxDrawdown, 0) / arr.length;
    const winRate = (arr: StrategyResult[]) => (arr.reduce((a, b) => a + (b.wins / (b.wins + b.losses)), 0) / arr.length) * 100;

    console.log(`--- SIMULATION RESULTS (1000 Seasons) ---\n`);
    console.log(`STRATEGY A (Baseline): Mean Profit: $${avg(resultsA).toFixed(2)} | Win Rate: ${winRate(resultsA).toFixed(1)}% | Avg Drawdown: $${avgDD(resultsA).toFixed(2)}`);
    console.log(`STRATEGY B (Underdogs): Mean Profit: $${avg(resultsB).toFixed(2)} | Win Rate: ${winRate(resultsB).toFixed(1)}% | Avg Drawdown: $${avgDD(resultsB).toFixed(2)}`);
    console.log(`STRATEGY C (Anchors+7): Mean Profit: $${avg(resultsC).toFixed(2)} | Win Rate: ${winRate(resultsC).toFixed(1)}% | Avg Drawdown: $${avgDD(resultsC).toFixed(2)}`);

    const report = {
        strategyA: { profit: avg(resultsA), winRate: winRate(resultsA), dd: avgDD(resultsA) },
        strategyB: { profit: avg(resultsB), winRate: winRate(resultsB), dd: avgDD(resultsB) },
        strategyC: { profit: avg(resultsC), winRate: winRate(resultsC), dd: avgDD(resultsC) }
    };
    fs.writeFileSync('monte_carlo_2025_results.json', JSON.stringify(report, null, 2));
}

runMonteCarlo();
