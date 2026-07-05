/**
 * Reconstructs inning + score at a trade timestamp using ESPN play-by-play wallclocks.
 */

export interface GameStateAtTrade {
    kickoffTime: Date;
    tradeTime: Date;
    minutesToKickoff: number;
    gamePhase: 'pre_game' | 'in_game' | 'post_game' | 'unknown';
    inning: number | null;
    inningHalf: string | null;
    awayScore: number | null;
    homeScore: number | null;
    betTeamDeficit: number | null;
    replaySource: 'espn_wallclock' | 'kickoff_only' | 'unmatched';
    espnEventId?: string;
}

export interface ESPNPlay {
    wallclock?: string;
    awayScore?: number;
    homeScore?: number;
    period?: { number?: number; type?: string; displayValue?: string };
}

const teamToken = (name: string): string => {
    const n = name.toLowerCase();
    return n.split(' ').pop() || n;
};

export function teamsMatchMarket(awayName: string, homeName: string, question: string): boolean {
    const q = question.replace(/^KBO:\s*/i, '').toLowerCase();
    const a = teamToken(awayName);
    const h = teamToken(homeName);
    return q.includes(a) && q.includes(h);
}

export function parseQuestionTeams(question: string): [string, string] | null {
    const clean = question.replace(/^KBO:\s*/i, '');
    const parts = clean.split(/\bvs\.?\b/i).map(p => p.trim());
    return parts.length >= 2 ? [parts[0], parts[1]] : null;
}

export function findESPNEvent(events: any[], question: string): any | null {
    const teams = parseQuestionTeams(question);
    if (!teams) {
        return events.find((ev: any) => {
            const comp = ev.competitions?.[0];
            if (!comp) return false;
            const names = comp.competitors?.map((c: any) => c.team?.displayName?.toLowerCase() || '') || [];
            const q = question.toLowerCase();
            return names.some((n: string) => q.includes(teamToken(n)));
        }) || null;
    }
    const [t1, t2] = teams;
    return events.find((ev: any) => {
        const comp = ev.competitions?.[0];
        if (!comp) return false;
        const away = comp.competitors?.find((c: any) => c.homeAway === 'away');
        const home = comp.competitors?.find((c: any) => c.homeAway === 'home');
        if (!away || !home) return false;
        const aName = away.team?.displayName || '';
        const hName = home.team?.displayName || '';
        return (
            (teamMatchLoose(aName, t1) && teamMatchLoose(hName, t2)) ||
            (teamMatchLoose(aName, t2) && teamMatchLoose(hName, t1))
        );
    }) || null;
}

function teamMatchLoose(full: string, fragment: string): boolean {
    const fl = full.toLowerCase();
    const fr = fragment.toLowerCase();
    if (fl.includes(fr) || fr.includes(fl)) return true;
    const mf = teamToken(fragment);
    const mfull = teamToken(full);
    return mf.length > 2 && (fl.includes(mf) || mfull.includes(mf));
}

const scoreboardCache = new Map<string, any>();
const playsCache = new Map<string, ESPNPlay[]>();

export function clearReplayCaches(): void {
    scoreboardCache.clear();
    playsCache.clear();
}

async function fetchESPNScoreboard(gameDateYyyyMmDd: string): Promise<any> {
    const espnDate = gameDateYyyyMmDd.replace(/-/g, '');
    if (scoreboardCache.has(espnDate)) {
        return scoreboardCache.get(espnDate);
    }
    const board = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard?dates=${espnDate}`
    ).then(r => r.json());
    scoreboardCache.set(espnDate, board);
    return board;
}

export async function fetchESPNPlays(eventId: string): Promise<ESPNPlay[]> {
    if (playsCache.has(eventId)) {
        return playsCache.get(eventId)!;
    }
    const url = `https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/summary?event=${eventId}`;
    const res = await fetch(url);
    if (!res.ok) {
        playsCache.set(eventId, []);
        return [];
    }
    const data = await res.json();
    const plays = (data.plays || []).filter((p: ESPNPlay) => p.wallclock);
    playsCache.set(eventId, plays);
    return plays;
}

export function replayStateAtTime(
    plays: ESPNPlay[],
    tradeTime: Date,
    kickoffTime: Date,
    betOutcome: string,
    awayName: string,
    homeName: string
): GameStateAtTrade {
    const minutesToKickoff = Math.round((kickoffTime.getTime() - tradeTime.getTime()) / 60000);

    let gamePhase: GameStateAtTrade['gamePhase'] = 'unknown';
    if (minutesToKickoff > 0) gamePhase = 'pre_game';
    else if (minutesToKickoff >= -270) gamePhase = 'in_game';
    else gamePhase = 'post_game';

    const base: GameStateAtTrade = {
        kickoffTime,
        tradeTime,
        minutesToKickoff,
        gamePhase,
        inning: null,
        inningHalf: null,
        awayScore: null,
        homeScore: null,
        betTeamDeficit: null,
        replaySource: plays.length > 0 ? 'espn_wallclock' : 'kickoff_only'
    };

    if (gamePhase === 'pre_game' || plays.length === 0) {
        return base;
    }

    const tradeMs = tradeTime.getTime();
    let last: ESPNPlay | null = null;
    for (const p of plays) {
        if (!p.wallclock) continue;
        const playMs = new Date(p.wallclock).getTime();
        if (playMs <= tradeMs) last = p;
        else break;
    }

    if (!last) return base;

    const awayScore = last.awayScore ?? 0;
    const homeScore = last.homeScore ?? 0;
    const betOnAway = teamMatchLoose(betOutcome, awayName);
    const betOnHome = teamMatchLoose(betOutcome, homeName);

    let betTeamDeficit: number | null = null;
    if (betOnAway) betTeamDeficit = homeScore - awayScore;
    else if (betOnHome) betTeamDeficit = awayScore - homeScore;

    return {
        ...base,
        inning: last.period?.number ?? null,
        inningHalf: last.period?.type ?? null,
        awayScore,
        homeScore,
        betTeamDeficit,
        replaySource: 'espn_wallclock'
    };
}

export async function resolveMLBGameState(
    question: string,
    tradeTimeUnix: number,
    betOutcome: string,
    gameDateYyyyMmDd: string
): Promise<GameStateAtTrade | null> {
    const board = await fetchESPNScoreboard(gameDateYyyyMmDd);
    const event = findESPNEvent(board.events || [], question);
    if (!event) return null;

    const comp = event.competitions[0];
    const away = comp.competitors.find((c: any) => c.homeAway === 'away');
    const home = comp.competitors.find((c: any) => c.homeAway === 'home');
    const kickoffTime = new Date(event.date);
    const tradeTime = new Date(tradeTimeUnix * 1000);

    const plays = await fetchESPNPlays(event.id);
    const state = replayStateAtTime(
        plays,
        tradeTime,
        kickoffTime,
        betOutcome,
        away.team.displayName,
        home.team.displayName
    );
    state.espnEventId = event.id;
    return state;
}