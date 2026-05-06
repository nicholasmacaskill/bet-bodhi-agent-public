/**
 * KBO (Korea Baseball Organization) API Wrapper
 * Data source: TheSportsDB (free tier) + hardcoded 2026 season context
 * KBO League ID on TheSportsDB: 4480
 */

export interface KBOGame {
    id: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string; // UTC ISO string
    venue?: string;
    status?: string;
}

import { PolymarketApi } from './polymarket-api';
import * as cheerio from 'cheerio';

export interface KBOTeamStats {
    fullName: string;
    wins: number;
    losses: number;
    winPct: number;
    runsPerGame: number;  // Offensive proxy
    era: number;          // Pitching proxy (team ERA)
}

// KBO team name normalization — Polymarket uses English names
const KBO_TEAMS: Record<string, string[]> = {
    'LG Twins':       ['lg twins', 'lg', 'twins'],
    'Doosan Bears':   ['doosan bears', 'doosan', 'bears'],
    'KT Wiz':         ['kt wiz', 'kt'],
    'SSG Landers':    ['ssg landers', 'ssg'],
    'NC Dinos':       ['nc dinos', 'nc'],
    'Samsung Lions':  ['samsung lions', 'samsung'],
    'Hanwha Eagles':  ['hanwha eagles', 'hanwha'],
    'Kiwoom Heroes':  ['kiwoom heroes', 'kiwoom'],
    'Lotte Giants':   ['lotte giants', 'lotte'],
    'Kia Tigers':     ['kia tigers', 'kia tigers', 'kia'],
};

// 2026 season baseline ERA & run scoring data (updated periodically)
// Source: https://www.baseball-reference.com/register/league.cgi?id=KOR.KBO
const KBO_BASELINE_STATS: Record<string, KBOTeamStats> = {
    'LG Twins':      { fullName: 'LG Twins',      wins: 12, losses: 6, winPct: 0.667, runsPerGame: 5.8, era: 3.42 },
    'KT Wiz':        { fullName: 'KT Wiz',         wins: 11, losses: 7, winPct: 0.611, runsPerGame: 5.5, era: 3.80 },
    'SSG Landers':   { fullName: 'SSG Landers',    wins: 10, losses: 8, winPct: 0.556, runsPerGame: 4.9, era: 3.95 },
    'Doosan Bears':  { fullName: 'Doosan Bears',   wins: 10, losses: 8, winPct: 0.556, runsPerGame: 5.1, era: 4.10 },
    'Kia Tigers':    { fullName: 'Kia Tigers',     wins: 9,  losses: 9, winPct: 0.500, runsPerGame: 5.0, era: 4.25 },
    'Samsung Lions': { fullName: 'Samsung Lions',  wins: 9,  losses: 9, winPct: 0.500, runsPerGame: 4.7, era: 4.40 },
    'Lotte Giants':  { fullName: 'Lotte Giants',   wins: 8,  losses: 10, winPct: 0.444, runsPerGame: 4.5, era: 4.60 },
    'Kiwoom Heroes': { fullName: 'Kiwoom Heroes',  wins: 8,  losses: 10, winPct: 0.444, runsPerGame: 4.8, era: 4.55 },
    'NC Dinos':      { fullName: 'NC Dinos',        wins: 7,  losses: 11, winPct: 0.389, runsPerGame: 4.2, era: 4.90 },
    'Hanwha Eagles': { fullName: 'Hanwha Eagles',  wins: 6,  losses: 12, winPct: 0.333, runsPerGame: 4.0, era: 5.20 },
};

// KBO ace pitcher pool — top ERA performers early 2026
const KBO_ELITE_PITCHERS = [
    'Casey Kelly', 'Graham Ashcraft', 'An Woo-jin', 'Go Young-pyo',
    'Park Se-woong', 'Kim Kwang-hyun', 'Ariel Miranda', 'Raul Alcantara'
];

// KBO vulnerable pitchers (ERA > 5.50 in KBO context)
const KBO_WEAK_PITCHERS = [
    'Jang Min-je', 'Noe Ramirez', 'Jake Brigham', 'Wes Benjamin'
];

export class KBOApi {
    private baseUrl = 'https://www.koreabaseball.com/ws';

    async getSchedule(date: string): Promise<KBOGame[]> {
        const year = date.split('-')[0];
        const month = date.split('-')[1];
        
        try {
            const response = await fetch(`${this.baseUrl}/Schedule.asmx/GetScheduleList`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leId: 1,
                    srIdList: "1,3,4,5,7",
                    seasonId: year,
                    gameMonth: month,
                    teamId: ""
                })
            });

            const data = await response.json();
            const list = data.d || [];
            
            // Filter for the specific date provided
            const dayStr = date.replace(/-/g, '');
            const games = list.filter((g: any) => g.G_ID.startsWith(dayStr));

            return games.map((g: any) => ({
                id: g.G_ID,
                homeTeam: this.normalizeTeamName(g.HOME_NM),
                awayTeam: this.normalizeTeamName(g.AWAY_NM),
                startTime: `${date}T${g.G_TIME}:00Z`, // KST is UTC+9, but we keep format for consistency
                venue: g.S_NM,
                status: g.GAME_STATUS || 'Scheduled'
            }));
        } catch (e) {
            console.error('KBO internal schedule fetch failed:', e);
            return [];
        }
    }

    async getStartingPitchers(gameId: string): Promise<{ home: string; away: string } | null> {
        try {
            const response = await fetch(`${this.baseUrl}/GameCenter.asmx/GetGameCenterPreview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leId: 1, srId: 1, gameId })
            });

            const data = await response.json();
            const preview = data.d || {};
            
            return {
                home: preview.HOME_P_NM || "TBD",
                away: preview.AWAY_P_NM || "TBD"
            };
        } catch (e) {
            return null;
        }
    }

    async getTeamStats(): Promise<Record<string, KBOTeamStats>> {
        const stats = { ...KBO_BASELINE_STATS };
        try {
            // Fetch live standings from the internal main score endpoint
            const response = await fetch(`${this.baseUrl}/Main.asmx/GetMainScore?leId=1&seasonId=2026`);
            const data = await response.json();
            const list = data.d || [];

            list.forEach((t: any) => {
                const officialName = this.normalizeTeamName(t.TEAM_NM);
                if (officialName && stats[officialName]) {
                    stats[officialName] = {
                        ...stats[officialName],
                        wins: parseInt(t.W_CNT) || stats[officialName].wins,
                        losses: parseInt(t.L_CNT) || stats[officialName].losses,
                        winPct: parseFloat(t.W_RATE) || stats[officialName].winPct,
                    };
                }
            });
            console.log("✅ Successfully fetched live KBO standings via Internal API.");
        } catch (e) {
            console.error("⚠️ Failed to fetch live KBO stats via Internal API:", e);
        }
        return stats;
    }

    getElitePitchers(): string[] {
        return KBO_ELITE_PITCHERS;
    }

    getWeakPitchers(): string[] {
        return KBO_WEAK_PITCHERS;
    }

    normalizeTeamName(rawName: string): string {
        if (!rawName) return '';
        const lower = rawName.toLowerCase().trim();
        
        for (const [official, aliases] of Object.entries(KBO_TEAMS)) {
            if (aliases.some(a => lower.includes(a))) {
                return official;
            }
        }
        return rawName;
    }
}

