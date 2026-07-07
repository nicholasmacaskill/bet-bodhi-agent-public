# Bet Bodhi — Temporal Replay Harness & Slate Concentration

**Engineering dossier** · Flocano Labs / Bet Bodhi  
Generated: 2026-06-30  
Model: current `pillar-analyzer` weights · no agent memory · no lookahead

---

## Strategic intent

Prove the Bet Bodhi stack on **reproducible full-season replay**, not live PnL anecdotes. Separate **signal** (who wins) from **execution** (Polymarket tradability), then measure whether **sovereign slate ranking** (alpha sort) improves concentratable edge.

---

## Methodology

| Rule | Implementation |
|------|----------------|
| No lookahead | `getHydratedAnalysisData()` uses game-date season, standings/form/series as-of first pitch |
| No memory leakage | `AgentMemory` disabled in backtest (live fades not modeled) |
| Grading | `valueTeam` vs actual winner (W/L), not CLV or book ROI |
| Polymarket (2025) | Closed Gamma index by `endDate` + kickoff CLOB prices |
| Polymarket (2024) | None — technical-only season |
| Runner | `scripts/mlb-historical-backtest.ts` |

**What the full backtest grades:** every final game where the model sets `valueTeam` (~88% pick rate on games analyzed), not just report shortlists.

**Concentration slices (post-process):** per calendar day, sort picks by unified alpha `(confidence/10) + (polyEV×10)`, take top 1 / 3 / 5 — mirrors sovereign report slate rankings.

---

## Full-season results

### 2024 — technical only (no Polymarket game markets)

| Slice | Picks | Win rate | Sim. sized ROI* |
|-------|------:|---------:|----------------:|
| All model picks | 2,262 | **59.5%** | 15.0% |
| Top 5 / day | 969 | **64.0%** | 19.7% |
| Top 3 / day | 597 | **64.3%** | 21.0% |
| Top 1 / day | 210 | 57.1% | 7.5% |

Games replayed: **2,556** · Report: `reports/MLB_BACKTEST_2024.md`

### 2025 — full model + Polymarket

| Slice | Picks | Win rate | Sim. sized ROI* | POLY route WR |
|-------|------:|---------:|----------------:|--------------:|
| All model picks | 1,634 | **60.0%** | 8.7% | 59.4% |
| Top 5 / day | 923 | **63.6%** | 17.0% | 64.6% |
| Top 3 / day | 577 | **62.4%** | 13.6% | 63.9% |
| Top 1 / day | 203 | **62.6%** | 9.4% | **66.0%** |
| Top 3 / day (POLY only) | 454 | **63.9%** | 18.6% | 63.9% |
| Top 1 / day (POLY only) | 153 | **66.0%** | **22.6%** | 66.0% |
| Top 3 / day (HIGH CONVICTION) | 452 | **63.9%** | 18.9% | 63.9% |

Games replayed: **2,551** · Poly matched: **98%** · Report: `reports/MLB_BACKTEST_2025.md`

\*Sized ROI uses audit-calibrated `getSizing()` on $800 bankroll, ~-115 win payout — **winner grading only**, not line shopping.

---

## Signal vs execution (2025)

| Layer | Picks | WR | Meaning |
|-------|------:|---:|---------|
| **PASS** (edge, no Poly route) | 287 | **62.7%** | Handicapping without tradable +EV contract |
| **POLY route** (edge + crowd price) | 1,347 | **59.4%** | Bets the live stack would actually route |

**Insight:** Model picks winners well (~60%). Executable Polymarket routes win slightly less — market partially prices the same signals. Validates selective fades on loud HIGH CONVICTION plays.

---

## Concentration curve (+3–4 pts WR is large at this scale)

Moving from all picks → top 5 / day adds **~3.6 pts** WR in 2025 (60.0% → 63.6%). In betting terms that is material: break-even on -110 is ~52.4%; +3 pts on 900+ bets is elite-tier separation.

**Sweet spot:** top 3–5 per day (~62–64% WR). For **one bet per day**, see Top-1 POLY study below.

---

## Top-1 edge study (full 2025) — primary live strategy candidate

Detailed report: `reports/BODHI_TOP1_2025_EDGE_STUDY.md`

| Metric | Top 1 / day (all) | Top 1 / day (POLY only) |
|--------|------------------:|------------------------:|
| Picks | 203 | **153** |
| Win rate | 62.6% | **66.0%** (+3.5 pts) |
| Sized ROI | 9.4% | **22.6%** |
| Mean α | 11.06 | 12.40 |

**Overlap:** On 153 days with a POLY route, the highest-α game **is always** the POLY top-1 (0 ranking conflicts). The other **50 days** the board leader is PASS-only (no executable contract) — excluding those drives the WR lift. Poly EV is ~identical (38.5% vs 38.8%); the edge is **tradability filter**, not a different game.

---

## Backtest optimizations (implemented)

| Optimization | Flag / location | Effect |
|--------------|-----------------|--------|
| Closed-market date index | `polymarket-api.ts` `getClosedSportsMarketsForDate()` | O(day) Poly lookup vs scanning 4k+ markets |
| Fast mode (skip kickoff CLOB) | `--fast` | ~5–10× faster; uses Gamma close prices |
| Parallel games | `--concurrency N` | N games per day in parallel |
| Quiet logs | `--quiet` | Suppresses SWAP_CHECK noise |
| Incremental cache | `data/backtest_cache/rows_*.json` | Resumable by date |
| Parallel kickoff fetch | `slate-resolver.ts` | 2 token histories in parallel |

```bash
# Full fidelity (slow, ~72 min / season with Poly)
npx tsx scripts/mlb-historical-backtest.ts --season 2025

# Fast re-slice / extension
npx tsx scripts/mlb-historical-backtest.ts --season 2025 --from 2025-07-11 --fast --concurrency 4 --quiet
```

---

## Flocano Labs shard copy (paste-ready)

**Bet Bodhi // Quantitative Modeling · technical**

### Temporal Replay Harness & Slate Concentration

*full-season backtest without lookahead bias*

Replays 5,100+ MLB games (2024–2025) with as-of-first-pitch hydration, indexes closed Polymarket moneylines by `endDate`, and grades technical picks separately from POLY execution routes. Slate concentration (top 3–5 by unified alpha) lifts WR ~3.6 pts over the full pick firehose.

`lookahead: none // poly_match: 98.4% // seasons: 2 // top5_wr: 63.6% // signal_vs_exec: split`

TypeScript · MLB API · Polymarket Gamma API · CLOB prices-history · SQLite

---

## Limitations & next experiments

1. **W/L ≠ CLV** — 60% winners does not prove book/Poly line-beating; sportsbook replay needs implied-prob grading.
2. **Top-1 variance** — highest-alpha game/day can be overconfidence (see 2024 top-1 57.1%).
3. **Live fades** — user sometimes bets against model; backtest excludes `AgentMemory`.
4. **Pre-game only** — no in-game score adjustment.
5. **Next:** historical Odds API slice — same top-3/top-5 concentration vs closing lines.

---

## Artifacts

| File | Description |
|------|-------------|
| `scripts/mlb-historical-backtest.ts` | Season replay runner |
| `data/backtest_cache/rows_2024_poly0.json` | 2024 row cache |
| `data/backtest_cache/rows_2025_poly1.json` | 2025 row cache |
| `data/backtest_cache/dossier_stats.json` | Concentration slice stats |
| `reports/MLB_BACKTEST_2024.md` | 2024 summary |
| `reports/MLB_BACKTEST_2025.md` | 2025 summary |