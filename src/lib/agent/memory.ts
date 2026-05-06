import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as csv from 'csv-parse/sync';

export interface TeamPerformanceProfile {
    team: string;
    sport: string;
    pnl: number;
    wagered: number;
    roi: number;
    wins: number;
    losses: number;
}

export class AgentMemory {
    private teamProfiles: Map<string, TeamPerformanceProfile> = new Map();
    private sportProfiles: Map<string, any> = new Map();

    constructor() {}

    public async loadMemory(): Promise<void> {
        const downloadsDir = path.join(os.homedir(), 'Downloads');
        let files: string[] = [];
        try {
            files = fs.readdirSync(downloadsDir).filter(f => f.startsWith('Polymarket-History-') && f.endsWith('.csv'));
        } catch (e) {
            console.warn("Could not read Downloads directory for Polymarket history.", e);
            return;
        }

        if (files.length === 0) {
            console.warn("No Polymarket history found. Memory is blank.");
            return;
        }

        // Sort by name (which includes date) to get latest
        files.sort().reverse();
        const latestFile = path.join(downloadsDir, files[0]);

        try {
            const fileContent = fs.readFileSync(latestFile, 'utf8');
            // Remove BOM if present
            const cleanContent = fileContent.replace(/^\uFEFF/, '');
            const records = csv.parse(cleanContent, { columns: true, skip_empty_lines: true });

            const marketData = new Map<string, any>();

            for (const row of records) {
                const action = row['action'];
                if (action === 'Deposit' || action === 'Withdraw') continue;

                const usdc = parseFloat(row['usdcAmount']) || 0.0;
                const market = row['marketName'];
                const team = row['tokenName'];

                const sport = this.inferSport(market);
                if (sport === 'Non-Sports') continue;

                if (!marketData.has(market)) {
                    marketData.set(market, { buy_vol: 0, return: 0, sport, team, status: 'Open' });
                }
                
                const md = marketData.get(market);
                if (action === 'Buy') {
                    md.buy_vol += usdc;
                    md.team = team || md.team;
                } else if (action === 'Sell' || action === 'Redeem') {
                    md.return += usdc;
                    md.status = 'Closed';
                }
            }

            for (const [market, data] of marketData.entries()) {
                if (data.status === 'Closed') {
                    const pnl = data.return - data.buy_vol;
                    const team = data.team;

                    if (!this.teamProfiles.has(team)) {
                        this.teamProfiles.set(team, { team, sport: data.sport, pnl: 0, wagered: 0, roi: 0, wins: 0, losses: 0 });
                    }
                    const tp = this.teamProfiles.get(team)!;
                    tp.pnl += pnl;
                    tp.wagered += data.buy_vol;
                    if (pnl > 0) tp.wins++;
                    else tp.losses++;
                    tp.roi = (tp.pnl / tp.wagered) * 100;
                }
            }

        } catch (e) {
            console.error("Failed to parse Polymarket history for agent memory:", e);
        }
    }

    public getTeamProfile(team: string): TeamPerformanceProfile | undefined {
        // Simple fuzzy match for team names (e.g. "Los Angeles Dodgers" vs "Dodgers")
        const teamLower = team.toLowerCase();
        for (const [key, profile] of this.teamProfiles.entries()) {
            if (teamLower.includes(key.toLowerCase()) || key.toLowerCase().includes(teamLower)) {
                return profile;
            }
        }
        return undefined;
    }

    private inferSport(marketName: string): string {
        const name = marketName.toLowerCase();
        if (name.includes(' mlb ') || name.includes('baseball') || name.includes(' vs. ')) {
            if (name.includes('nhl') || name.includes('hockey') || name.includes('leafs') || name.includes('bruins') || name.includes('rangers')) return 'NHL';
            if (name.includes('nba') || name.includes('basketball') || name.includes('lakers') || name.includes('celtics')) return 'NBA';
            if (name.includes('mma') || name.includes('ufc')) return 'MMA';
            return 'MLB';
        }
        if (name.includes('kbo')) return 'KBO';
        return 'Non-Sports';
    }
}
