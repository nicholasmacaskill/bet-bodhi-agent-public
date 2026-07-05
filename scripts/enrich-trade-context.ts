/**
 * Enriches each CLOB BUY fill with kickoff timing, inning, and deficit-at-entry
 * using PolymarketGateway + ESPN play-by-play wallclocks.
 *
 * Run: npx tsx scripts/enrich-trade-context.ts
 * Re-run safe — upserts into trade_enrichment table.
 */
import 'dotenv/config';
import { PolymarketGateway, normalizeTrade, RawClobTrade } from '../src/lib/gateway/PolymarketGateway';
import { loadTradeBook } from '../src/lib/gateway/trade-book';
import { db } from '../src/lib/sqlite-client';
import { resolveMLBGameState } from '../src/lib/trade-context/GameStateReplayer';

function inferSport(question: string): string {
    if (/^KBO:/i.test(question)) return 'KBO';
    const n = question.toLowerCase();
    const kbo = ['kt wiz', 'nc dinos', 'ssg landers', 'doosan bears', 'kiwoom heroes', 'lotte giants', 'samsung lions', 'hanwha eagles', 'kia tigers'];
    if (kbo.some(k => n.includes(k))) return 'KBO';
    return 'MLB';
}

export async function enrichTradeContext(gateway: PolymarketGateway, trades: RawClobTrade[]): Promise<void> {
    const upsert = db.prepare(`
        INSERT INTO trade_enrichment (
            trade_id, condition_id, question, sport, outcome, side, entry_price, amount,
            match_time, kickoff_time, minutes_to_kickoff, game_phase, inning, inning_half,
            away_score, home_score, bet_team_deficit, replay_source, espn_event_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(trade_id) DO UPDATE SET
            minutes_to_kickoff = excluded.minutes_to_kickoff,
            game_phase = excluded.game_phase,
            inning = excluded.inning,
            inning_half = excluded.inning_half,
            away_score = excluded.away_score,
            home_score = excluded.home_score,
            bet_team_deficit = excluded.bet_team_deficit,
            replay_source = excluded.replay_source,
            espn_event_id = excluded.espn_event_id,
            enriched_at = datetime('now')
    `);

    let processed = 0;
    let replayed = 0;
    let live = 0;

    for (const raw of trades) {
        const t = normalizeTrade(raw);
        if (t.userAction !== 'BUY') continue;
        if (!t.tradeId) continue;

        const md = (await gateway.getMarketMetadata(t.market)) || null;
        const question = md ? (md.question || md.title || '') : '';
        if (!question || question === 'Unknown Market') continue;

        const sport = inferSport(question);
        const tradeDate = t.matchTimeUnix > 0
            ? new Date(t.matchTimeUnix * 1000)
            : new Date();
        const dateStr = tradeDate.toISOString().split('T')[0];
        const price = parseFloat(t.price);
        const amount = price * parseFloat(t.size);

        let state = null;
        if (sport === 'MLB' && t.matchTimeUnix > 0) {
            state = await resolveMLBGameState(question, t.matchTimeUnix, t.outcome, dateStr);
            if (!state) {
                const prev = new Date(tradeDate);
                prev.setDate(prev.getDate() - 1);
                state = await resolveMLBGameState(question, t.matchTimeUnix, t.outcome, prev.toISOString().split('T')[0]);
            }
        }

        if (state?.gamePhase === 'in_game') live++;
        if (state?.replaySource === 'espn_wallclock') replayed++;

        upsert.run(
            t.tradeId,
            t.market,
            question,
            sport,
            t.outcome,
            t.side,
            price,
            amount,
            tradeDate.toISOString(),
            state?.kickoffTime?.toISOString() || null,
            state?.minutesToKickoff ?? null,
            state?.gamePhase || 'unknown',
            state?.inning ?? null,
            state?.inningHalf ?? null,
            state?.awayScore ?? null,
            state?.homeScore ?? null,
            state?.betTeamDeficit ?? null,
            state?.replaySource || 'unmatched',
            state?.espnEventId || null
        );

        processed++;
        if (processed % 25 === 0) console.log(`  Enriched ${processed} BUY fills...`);
    }

    console.log(`\nDone. ${processed} BUY fills enriched.`);
    console.log(`  In-game (live): ${live}`);
    console.log(`  ESPN wallclock replay: ${replayed}`);

    const summary = db.prepare(`
        SELECT game_phase, COUNT(*) as n,
               ROUND(AVG(entry_price)*100,1) as avg_px,
               SUM(CASE WHEN bet_team_deficit > 0 THEN 1 ELSE 0 END) as trailing_entries
        FROM trade_enrichment WHERE sport='MLB'
        GROUP BY game_phase
    `).all();
    console.log('\nMLB phase breakdown:', summary);

    const deficit = db.prepare(`
        SELECT
            CASE
                WHEN bet_team_deficit IS NULL THEN 'unknown'
                WHEN bet_team_deficit <= 0 THEN 'leading_or_tied'
                WHEN bet_team_deficit = 1 THEN 'down_1'
                WHEN bet_team_deficit = 2 THEN 'down_2'
                WHEN bet_team_deficit >= 3 THEN 'down_3+'
            END as deficit_bucket,
            COUNT(*) as n,
            ROUND(AVG(entry_price)*100,1) as avg_px_c
        FROM trade_enrichment
        WHERE sport='MLB' AND game_phase='in_game'
        GROUP BY deficit_bucket
    `).all();
    console.log('\nLive bet deficit buckets:', deficit);

    const innings = db.prepare(`
        SELECT inning, COUNT(*) as n, ROUND(AVG(entry_price)*100,1) as avg_px
        FROM trade_enrichment
        WHERE sport='MLB' AND game_phase='in_game' AND inning IS NOT NULL
        GROUP BY inning ORDER BY inning
    `).all();
    console.log('\nLive bets by inning:', innings);
}

async function main() {
    console.log('====================================================');
    console.log('   TRADE CONTEXT ENRICHMENT (ESPN REPLAY)          ');
    console.log('====================================================');

    const { gateway, trades } = await loadTradeBook();
    await enrichTradeContext(gateway, trades);
}

if (require.main === module) {
    main().catch(console.error);
}