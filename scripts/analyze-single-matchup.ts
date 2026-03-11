import 'dotenv/config';
import { MLBApi } from '../src/lib/mlb-api';
import { OddsApi } from '../src/lib/odds-api';
import { PillarAnalyzer } from '../src/lib/pillar-analyzer';
import { PolymarketApi } from '../src/lib/polymarket-api';

async function analyzeMatchup(teamQuery: string) {
    const mlb = new MLBApi();
    const oddsSvc = new OddsApi();
    const polyApi = new PolymarketApi();
    const analyzer = new PillarAnalyzer();
    const date = new Date().toISOString().split('T')[0];

    console.log(`\n🔍 DEEP DIVE ANALYSIS: ${teamQuery.toUpperCase()} Matchup`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
        const schedule = await mlb.getSchedule(date);
        const game = schedule.find(g => 
            g.homeTeam.toLowerCase().includes(teamQuery.toLowerCase()) || 
            g.awayTeam.toLowerCase().includes(teamQuery.toLowerCase())
        );

        if (!game) {
            console.log(`❌ No game found for "${teamQuery}" on ${date}`);
            return;
        }

        console.log(`📍 Found: ${game.awayTeam} @ ${game.homeTeam}`);

        // 1. Fetch Detailed Rosters & Probables
        const details = await mlb.getGameDetails(game.gamePk);
        const homeRoster = game.homeId ? await mlb.getTeamRoster(game.homeId) : [];
        const awayRoster = game.awayId ? await mlb.getTeamRoster(game.awayId) : [];

        // 2. Fetch Starter Stats
        const homeStarterName = details?.probables?.home || game.probables?.home;
        const awayStarterName = details?.probables?.away || game.probables?.away;

        // Note: For Spring Training, we often need to search person ID by name if not in feed
        // For now, let's stick to the names and basic hydration from the game feed
        const homeStarterInfo = { name: homeStarterName || 'TBD', note: "Spring Rotation: TBD" };
        const awayStarterInfo = { name: awayStarterName || 'TBD', note: "Spring Rotation: TBD" };

        if (details?.gamePk) {
            // Placeholder logic for deepening stats - normally we'd match the name to an ID
            // In a production app, we'd have a mapping layer
        }

        // 3. Fetch Market Data
        const [oddsList, polyMarket] = await Promise.all([
            oddsSvc.getOdds('baseball_mlb_preseason'),
            polyApi.getMarketByTeams(game.homeTeam, game.awayTeam)
        ]);

        // 4. Run Pillar Analysis
        const analysis = analyzer.analyzeGame(
            game, 
            details || { lineups: { home: [], away: [] }, probables: game.probables }, 
            polyMarket || undefined,
            [], 
            [], 
            new Map(),
            1000, 
            "sharp",
            8,
            { home: homeRoster, away: awayRoster }
        );

        // 5. Output Detailed Format
        const deepDive = {
            matchup: `${game.awayTeam} @ ${game.homeTeam}`,
            startTime: game.date,
            starterBattle: {
                home: homeStarterInfo,
                away: awayStarterInfo
            },
            bullpenHealth: {
                home: `Depth: ${homeRoster.length} active. Spring split-squad distribution in effect.`,
                away: `Depth: ${awayRoster.length} active. Travel squad pitching carries fatigue risk.`
            },
            teamBreakdown: {
                home: {
                    name: game.homeTeam,
                    resonance: `Technical Rating: ${analysis.pillars.find(p => p.pillar === "Technical Roster Advantage")?.score}/10.`,
                    advantage: analysis.advantages.find(a => a.includes("Cactus") || a.includes("Grapefruit")) || "Neutral venue advantage."
                },
                away: {
                    name: game.awayTeam,
                    resonance: `Roster Depth: ${awayRoster.length} active players.`,
                    advantage: analysis.advantages.length > 1 ? analysis.advantages[1] : "Standard rotation depth."
                }
            },
            killCriteria: analysis.killCriteria || ["ABORT IF: Starter scratch or bullpen notification."],
            pillarAnalysis: analysis
        };

        console.log("DEEP_DIVE_START");
        console.log(JSON.stringify(deepDive, null, 2));
        console.log("DEEP_DIVE_END");

    } catch (error: any) {
        console.error(`Analysis failed: ${error.message}`);
    }
}

const teamName = process.argv[2];
if (!teamName) {
    console.error("Usage: npx tsx scripts/analyze-single-matchup.ts (team_name)");
    process.exit(1);
}

analyzeMatchup(teamName);
