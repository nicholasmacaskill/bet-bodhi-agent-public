import { PolymarketApi } from '../polymarket-api';
import * as fs from 'fs';
import * as path from 'path';

export interface AlphaTrader {
    username: string;
    address: string;
    note: string;
}

export interface MonitoredTrade {
    id: string;
    trader: string;
    address: string;
    market: string;
    outcome: string;
    side: string;
    size: number;
    price: number;
    timestamp: number;
    conditionId: string;
}

export class WalletMonitor {
    private api = new PolymarketApi();
    private statePath = path.join(process.cwd(), 'public', 'monitor-state.json');
    private traders: AlphaTrader[] = [
        { username: 'kch123', address: '0x6a72f61820b26b1fe4d956e17b6dc2a1ea3033ee', note: '#1 ranked sports trader all-time' },
        { username: 'S-Works', address: '0xee00ba338c59557141789b127927a55f5cc5cea1', note: 'Active in NBA/NHL' },
        { username: 'Abeautifulmind', address: '0x53d2d3c78597a78402d4db455a680da7ef560c3f', note: 'NFL specialist' },
        { username: 'Joe-Biden', address: '0x8b5a7da2fdf239b51b9c68a2a1a35bb156d200f2', note: 'Super Bowl specialist' },
        { username: 'Theo4', address: '0x56687bf447db6ffa42ffe2204a05edaa20f55839', note: 'Top overall whale' }
    ];

    constructor() {
        if (!fs.existsSync(path.dirname(this.statePath))) {
            fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
        }
    }

    private loadState(): Record<string, string> {
        if (fs.existsSync(this.statePath)) {
            try {
                return JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
            } catch {
                return {};
            }
        }
        return {};
    }

    private saveState(state: Record<string, string>) {
        fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
    }

    async pollForNewTrades(): Promise<MonitoredTrade[]> {
        const state = this.loadState();
        const allNewTrades: MonitoredTrade[] = [];

        for (const trader of this.traders) {
            console.log(`🔍 Polling ${trader.username} (${trader.address})...`);
            const trades = await this.api.getTradesForAddress(trader.address);
            
            if (!Array.isArray(trades) || trades.length === 0) continue;

            // CLOB API returns trades sorted by time descending (newest first)
            const lastSeenId = state[trader.address];
            const newTradesForTrader: any[] = [];

            for (const trade of trades) {
                if (trade.id === lastSeenId) break;
                newTradesForTrader.push(trade);
            }

            if (newTradesForTrader.length > 0) {
                // Update state with the newest trade ID
                state[trader.address] = newTradesForTrader[0].id;

                for (const trade of newTradesForTrader) {
                    const market = await this.api.getMarketDetails(trade.market);
                    allNewTrades.push({
                        id: trade.id,
                        trader: trader.username,
                        address: trader.address,
                        market: market?.title || "Unknown Market",
                        outcome: trade.outcome || "Unknown",
                        side: trade.side,
                        size: parseFloat(trade.size),
                        price: parseFloat(trade.price),
                        timestamp: trade.timestamp || Date.now(),
                        conditionId: trade.market
                    });
                }
            }
        }

        this.saveState(state);
        return allNewTrades;
    }

    getTraders(): AlphaTrader[] {
        return this.traders;
    }
}
