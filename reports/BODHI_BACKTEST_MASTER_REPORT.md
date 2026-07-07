# Bet Bodhi — MLB Historical Backtest Master Report

**Complete engineering record for dossier extraction**  
Generated: 2026-06-30  
Project: Bet Bodhi / Flocano Labs  
Model: current `pillar-analyzer` weights · no `AgentMemory` · no lookahead  

This document consolidates everything built, fixed, optimized, measured, and concluded during the full 2024–2025 MLB historical backtest program. Feed this entire file to a dossier formatter.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Strategic intent & research questions](#2-strategic-intent--research-questions)
3. [What we built](#3-what-we-built)
4. [Methodology & grading rules](#4-methodology--grading-rules)
5. [Model logic (pillar-analyzer)](#5-model-logic-pillar-analyzer)
6. [Polymarket historical integration — problems & fixes](#6-polymarket-historical-integration--problems--fixes)
7. [Performance optimizations](#7-performance-optimizations)
8. [How to reproduce](#8-how-to-reproduce)
9. [Backtest row schema](#9-backtest-row-schema)
10. [Full results — 2024 season](#10-full-results--2024-season)
11. [Full results — 2025 season](#11-full-results--2025-season)
12. [Signal vs execution decomposition](#12-signal-vs-execution-decomposition)
13. [Slate concentration analysis](#13-slate-concentration-analysis)
14. [Top-1 vs Top-1 POLY edge study](#14-top-1-vs-top-1-poly-edge-study)
15. [ROI & payout models](#15-roi--payout-models)
16. [Calendar & monthly breakdowns](#16-calendar--monthly-breakdowns)
17. [Validation sample runs](#17-validation-sample-runs)
18. [What is novel vs standard](#18-what-is-novel-vs-standard)
19. [Limitations & caveats](#19-limitations--caveats)
20. [Not done / next experiments](#20-not-done--next-experiments)
21. [Complete artifact index](#21-complete-artifact-index)
22. [Raw machine-readable stats](#22-raw-machine-readable-stats)
23. [Dossier extraction hints](#23-dossier-extraction-hints)

---

## 1. Executive summary

We built a **reproducible temporal replay harness** that replays **5,107 final MLB games** (2,556 in 2024 + 2,551 in 2025) through the current Bet Bodhi model with **zero lookahead bias**, optionally matches **closed Polymarket moneylines** (98% match rate in 2025), and grades picks while separating **signal** (who wins) from **execution** (tradable Polymarket +EV routes).

**Headline findings (2025):**

| Finding | Value |
|---------|------:|
| All model picks win rate | **60.0%** (1,634 picks) |
| Top 5 / day win rate | **63.6%** (923 picks) |
| Top 1 POLY / day win rate | **66.0%** (153 executable days) |
| PASS signal win rate (no Poly route) | **62.7%** (287 picks) |
| POLY execution route win rate | **59.4%** (1,347 picks) |
| Polymarket game match rate | **98%** (2,509 / 2,551 games) |
| Ranking conflict (top-1 all vs top-1 POLY) | **0 days** |

**Primary live strategy candidate:** One bet per day on **Top-1 POLY** (highest unified α among Polymarket-routable picks) — 153 bets/year, 66% WR, execution filter not re-ranking.

**Primary dossier thesis:** The unique contribution is not a new ML model — it is **decomposing edge into signal vs execution** and proving that **slate concentration + tradability filtering** extracts operable edge from a 60% pick firehose.

---

## 2. Strategic intent & research questions

### Why we built this

Prove the Bet Bodhi stack on **reproducible full-season replay**, not live PnL anecdotes or cherry-picked weeks.

### Three research questions

1. **Signal:** Does the technical model pick winners at scale? (W/L grading)
2. **Execution:** Does Polymarket routing add or subtract value vs raw signal?
3. **Concentration:** Does sovereign slate ranking (unified α sort, top 1/3/5 per day) improve edge over firing every pick?

### Core architectural separation

- **Signal** = `valueTeam` wins the game (handicapping)
- **Execution** = `executionRoute === 'POLY'` with positive EV vs crowd share price (tradable on Polymarket)

---

## 3. What we built

### 3.1 Primary runner

**File:** `scripts/mlb-historical-backtest.ts`

Pipeline per game:
```
MLB final game
  → getHydratedAnalysisData() [as-of first pitch]
  → PillarAnalyzer.analyzeGame() [current weights]
  → resolveHistoricalMoneyline() [2025 only]
  → grade valueTeam vs winner
  → write BacktestRow to cache
  → end of run: summarize + concentration table
```

### 3.2 Polymarket infrastructure (modified)

| File | Role |
|------|------|
| `src/lib/polymarket-api.ts` | Closed market pagination, date index, moneyline filters |
| `src/lib/gateway/slate-resolver.ts` | `resolveHistoricalMoneyline()`, kickoff CLOB hydration |
| `src/lib/mlb-api.ts` | `getHydratedAnalysisData()` no-lookahead hydration |
| `src/lib/pillar-analyzer.ts` | Model, unified α, sizing, EV thresholds |

### 3.3 Secondary analysis

| File | Role |
|------|------|
| `scratch/top1_poly_edge_2025.ts` | Top-1 POLY study with actual Polymarket payout math |
| `data/backtest_cache/dossier_stats.json` | All concentration slice stats |
| `data/backtest_cache/top1_2025_summary.json` | Top-1 actual-payout summary |

---

## 4. Methodology & grading rules

| Rule | Implementation |
|------|----------------|
| **No lookahead** | `getHydratedAnalysisData()` uses season stats, standings, form, series as-of game date / first pitch |
| **No agent memory** | `AgentMemory` disabled — user sometimes fades live picks; backtest = pure model |
| **Grading metric** | Binary W/L: did `valueTeam` win? Not CLV, not sportsbook closing line |
| **Pick population** | Every final game where model sets `valueTeam` |
| **2024 Polymarket** | Skipped (`--skip-poly`) — no reliable historical per-game MLB moneylines |
| **2025 Polymarket** | Closed Gamma pagination + date index; kickoff CLOB (`prices-history`) in full fidelity |
| **Concentration** | Post-process: per calendar day, sort by unified α, take top 1 / 3 / 5 |

### Unified alpha (same as sovereign daily report)

```
unified_alpha = (confidence / 10) + (polyEV × 10)
```

### Date range per season

March 20 – November 15 for each season.

---

## 5. Model logic (pillar-analyzer)

### Probability & EV

```
bodhiProb = confidence / 100
polyEV = bodhiProb - marketPrice    (crowd share price on value side)
```

### Action thresholds

| Condition | Action |
|-----------|--------|
| `polyEV > 0.10` | HIGH CONVICTION — buy shares |
| `polyEV > edgeThreshold` | LEAN — small EV edge |
| `edgeThreshold` | 3% base; 8% if crowd > 60%; 12% if crowd > 70% ("favorite tax") |
| `polyEV < -0.10` | PASS — negative EV |
| `polyEV` computed | `executionRoute = 'POLY'` |
| No Poly market / no price map | PASS — edge but not executable |

### Veto rules (can nullify valueTeam)

- Elite opposing pitcher when betting other side
- Weak own-side pitcher when betting that side
- Agent memory burn list (disabled in backtest)

### Default backtest sizing (`getSizing`, $800 bankroll)

| Confidence | Stake |
|------------|------:|
| ≥ 80% | 2.0% ($16) |
| ≥ 70% | 3.5% ($28) |
| ≥ 60% | 5.0% ($40) |
| < 60% | 0% |

### Default backtest win payout

Simplified: `stake × 0.87` on wins (not actual Polymarket share math). Full stake lost on losses.

---

## 6. Polymarket historical integration — problems & fixes

### Problem 1: 0% Poly match on 2025

**Cause:** Gamma `query=` search API broken for 2025 closed MLB markets.

**Fix:**
- Paginate closed events: `GET /events?closed=true&limit=100&offset=N&tag_slug=mlb|sports|baseball`
- Bulk load ~4,000+ closed moneylines once at backtest startup
- Build in-memory cache + date index

### Problem 2: False positive matches

**Cause:** Series Winner, playoff props, O/U, spreads matching as moneylines.

**Fix — `isMoneylineMarket()` rejects:**
- Questions with `:` or `?`
- Series Winner, Wild Card, NLDS, ALDS, World Series, Championship
- O/U, Spread, 1st 5 innings, props, Yes/No outcomes
- Requires `Team A vs Team B` format with exactly 2 outcomes

### Problem 3: Slow full-season runs (~72 min)

**Cause:** Per-game full cache scans, sequential CLOB kickoff fetches, gateway refreshes.

**Fix:** See Section 7 (Performance optimizations).

### Lookup path (2025 closed)

```
getClosedSportsMarkets()           → load all once at startup
getClosedSportsMarketsForDate(date) → O(that day's markets)
findMoneylineInMarkets()           → team match + score
resolveHistoricalMoneyline()       → optional kickoff CLOB hydration
```

---

## 7. Performance optimizations

| # | Optimization | Location / flag | Effect |
|---|--------------|-----------------|--------|
| 1 | Bulk closed-market load | `getClosedSportsMarkets()` at startup | One API sweep vs per-game search |
| 2 | Date-indexed lookup | `getClosedSportsMarketsForDate()` | O(day markets) not O(4000+) per game |
| 3 | Moneyline classifier | `isMoneylineMarket()` | Fewer false matches, less wasted analysis |
| 4 | Fast mode | `--fast` | Skip kickoff CLOB + gateway refresh; ~5–10× faster |
| 5 | Parallel games | `--concurrency N` | N final games per day via worker pool |
| 6 | Parallel kickoff CLOB | `hydrateKickoffPrices()` Promise.all | 2 token price histories in parallel |
| 7 | Incremental row cache | `data/backtest_cache/rows_*.json` | Resume by date; instant re-slicing |
| 8 | Quiet logs | `--quiet` / `BACKTEST_QUIET` | Suppress pillar SWAP_CHECK spam |

### Runtime benchmarks

| Mode | Approximate time (2025 full season) |
|------|-------------------------------------|
| Full fidelity (kickoff CLOB) | ~72 minutes |
| Fast (`--fast --concurrency 4`) | ~5–10× faster |

### Fast mode tradeoff

`--fast` sets `skipKickoff: true` and `skipGatewayRefresh: true` — uses Gamma close prices instead of CLOB kickoff prices. Same matching pipeline, slightly less price precision.

---

## 8. How to reproduce

```bash
# 2024 technical only (no Polymarket)
npx tsx scripts/mlb-historical-backtest.ts --season 2024 --skip-poly

# 2025 full fidelity with Polymarket (~72 min)
npx tsx scripts/mlb-historical-backtest.ts --season 2025

# 2025 fast re-slice / extension
npx tsx scripts/mlb-historical-backtest.ts --season 2025 --fast --concurrency 4 --quiet

# Custom date window
npx tsx scripts/mlb-historical-backtest.ts --from 2025-06-16 --to 2025-06-20

# Both seasons
npx tsx scripts/mlb-historical-backtest.ts --season 2024 --season 2025

# Force ignore cache
FORCE_BACKTEST=1 npx tsx scripts/mlb-historical-backtest.ts --season 2025

# Top-1 edge study (reads cache, no API)
npx tsx scratch/top1_poly_edge_2025.ts
```

### CLI flags

| Flag | Purpose |
|------|---------|
| `--season YYYY` | Full season Mar 20 – Nov 15 |
| `--from` / `--to` | Custom date range |
| `--skip-poly` | Technical-only, no Polymarket |
| `--fast` | Skip kickoff CLOB + gateway refresh |
| `--concurrency N` | Parallel games per day |
| `--quiet` | Less log noise |
| `--sample N` | First N sampled days |
| `--out PATH` | Custom report output |
| `FORCE_BACKTEST=1` | Ignore row cache |

---

## 9. Backtest row schema

Each row in `data/backtest_cache/rows_*.json`:

```json
{
  "date": "2025-03-27",
  "gamePk": 778557,
  "matchup": "Milwaukee Brewers @ New York Yankees",
  "winner": "New York Yankees",
  "valueTeam": "Milwaukee Brewers",
  "alpha": 11.2,
  "confidence": 87,
  "polyEV": 0.25,
  "executionRoute": "POLY",
  "recommendedAction": "HIGH CONVICTION - Buy Milwaukee Brewers Shares on Polymarket (+25.0% EV).",
  "pickWon": false,
  "polyMatched": true,
  "flags": ["..."]
}
```

**Note:** `polySharePrice` is NOT stored in cache. Reconstructed as `confidence/100 - polyEV` for payout studies.

---

## 10. Full results — 2024 season

**Mode:** Technical only (`--skip-poly`) — no Polymarket historical markets.

### Summary

| Metric | Value |
|--------|------:|
| Final games replayed | 2,556 |
| Game-days in span | 215 |
| Days with model picks | 210 |
| Model picks (valueTeam set) | 2,262 |
| Wins / Losses | 1,346 / 916 |
| **Win rate** | **59.5%** |
| Polymarket matched | 0% |
| POLY execution route | 0 picks (all PASS — no Poly) |
| HIGH CONVICTION | 0 |
| Sized PnL (all picks) | $8,914 on $59,468 (**15.0% ROI**) |

### All picks by confidence band

| Band | Picks | WR |
|------|------:|---:|
| 80+ | 82 | 54.9% |
| 70–79 | 804 | 65.2% |
| 60–69 | 860 | 59.5% |
| <60 | 516 | 51.4% |

### Concentration slices

| Slice | Picks | WR | Wagered | PnL | ROI |
|-------|------:|---:|--------:|----:|----:|
| All picks | 2,262 | 59.5% | $59,468 | $8,914 | 15.0% |
| Top 5 / day | 969 | **64.0%** | $29,144 | $5,728 | 19.7% |
| Top 3 / day | 597 | **64.3%** | $17,192 | $3,602 | 21.0% |
| Top 1 / day | 210 | 57.1% | $5,852 | $439 | 7.5% |

### 2024 insight

Concentration works (top 3/5 ~64% WR) but **top-1 alone underperforms** (57.1%) — single highest-alpha game/day can be overconfident.

---

## 11. Full results — 2025 season

**Mode:** Full model + Polymarket (full fidelity, kickoff CLOB).

### Summary

| Metric | Value |
|--------|------:|
| Final games replayed | 2,551 |
| Game-days in span | 215 |
| Days with model picks | 203 |
| Days with POLY-routable picks | 153 |
| Model picks (valueTeam set) | 1,634 |
| Wins / Losses | 980 / 654 |
| **Win rate** | **60.0%** |
| Polymarket matched | **98.4%** (2,509 / 2,551 games) |
| POLY execution route | 1,347 picks, **59.4% WR** |
| HIGH CONVICTION | 1,150 picks, **60.3% WR** |
| Sized PnL (all picks) | $3,386 on $38,704 (**8.7% ROI**) |

### All picks by action type

| Action | Picks | WR |
|--------|------:|---:|
| PASS | 287 | **62.7%** |
| HIGH CONVICTION | 1,150 | 60.3% |
| LEAN | 197 | 53.8% |

### All picks by confidence band

| Band | Picks | WR |
|------|------:|---:|
| 80+ | 765 | 60.5% |
| 70–79 | 468 | 55.7% |
| 60–69 | 334 | 59.7% |
| <60 | 67 | 65.1% |

### Complete concentration & route slices

| Slice | Picks | WR | Wagered | PnL | ROI | Notes |
|-------|------:|---:|--------:|----:|----:|-------|
| All picks | 1,634 | 60.0% | $38,704 | $3,386 | 8.7% | Full firehose |
| Top 5 / day | 923 | **63.6%** | $18,520 | $3,142 | 17.0% | POLY route WR 64.6% |
| Top 3 / day | 577 | **62.4%** | $11,468 | $1,555 | 13.6% | POLY route WR 63.9% |
| Top 1 / day (all) | 203 | **62.6%** | $3,940 | $368 | 9.4% | Includes PASS-only days |
| Top 1 / day (POLY only) | 153 | **66.0%** | $2,520 | $569 | **22.6%** | Executable days only |
| Top 3 / day (POLY only) | 454 | 63.9% | $7,828 | $1,455 | 18.6% | |
| Top 3 (HIGH CONVICTION) | 452 | 63.9% | $7,760 | $1,470 | 18.9% | |
| PASS only | 287 | 62.7% | $7,664 | $1,252 | 16.3% | Signal, no route |
| POLY route only | 1,347 | 59.4% | $31,040 | $2,134 | 6.9% | Executable layer |

*ROI in this section uses $800 bankroll, 0.87 win payout, audit sizing.*

---

## 12. Signal vs execution decomposition

### The split (2025)

| Layer | Picks | WR | What it means |
|-------|------:|---:|---------------|
| **PASS** | 287 | **62.7%** | Model sees edge; no tradable +EV Polymarket contract (or negative EV, or no market) |
| **POLY route** | 1,347 | **59.4%** | Edge AND crowd price → live stack would route execution |
| **LEAN** | 197 | 53.8% | Small EV — executable but weaker |
| **HIGH CONVICTION** | 1,150 | 60.3% | Large EV — primary execution tier |

### Key insight

**Raw handicapping (PASS, 62.7%) beats tradable routes (POLY, 59.4%).** The market partially prices the same signals Bodhi sees. This validates selective live fades on loud HIGH CONVICTION plays where crowd has already moved.

### PASS pick sub-categories (from recommendedAction patterns)

- Negative EV — crowd hates the bet
- Edge identified but no Polymarket moneyline found
- Edge identified but Polymarket prices could not map to teams
- Preseason / spring training games without routable contracts

---

## 13. Slate concentration analysis

### Concentration lift (2025)

| Transition | WR change |
|------------|----------:|
| All picks → Top 5 / day | 60.0% → 63.6% (**+3.6 pts**) |
| All picks → Top 3 / day | 60.0% → 62.4% (**+2.4 pts**) |
| Top 1 all → Top 1 POLY | 62.6% → 66.0% (**+3.4 pts**) |

At -110 break-even (~52.4%), +3 pts on 900+ bets is material separation.

### Sweet spots

- **Multi-bet days:** Top 3–5 per day (~62–64% WR)
- **One bet per day:** Top-1 POLY (66% WR, 153 days)

### 2024 vs 2025 concentration comparison

| Slice | 2024 WR | 2025 WR |
|-------|--------:|--------:|
| All picks | 59.5% | 60.0% |
| Top 5 / day | 64.0% | 63.6% |
| Top 3 / day | 64.3% | 62.4% |
| Top 1 / day | 57.1% | 62.6% |
| Top 1 POLY | N/A | 66.0% |

Top-1 alone was weak in 2024 (57.1%); improved in 2025 with Poly execution filter.

---

## 14. Top-1 vs Top-1 POLY edge study

### Calendar breakdown (2025)

| | Days |
|--|-----:|
| Total game-days (Mar 20 – Nov 1) | 215 |
| Days with zero model picks | 12 |
| Days with top-1 pick (any route) | **203** |
| Days with tradable top-1 POLY pick | **153** |
| Days where #1 is PASS-only (no Poly) | **50** |

### Definitions

- **Top 1 / day (all):** Highest unified α among all `valueTeam` picks → 203 days
- **Top 1 / day (POLY):** Highest unified α among `executionRoute === 'POLY'` picks → **153 bets**

### Overlap (critical finding)

| Case | Days |
|------|-----:|
| Top-1 overall = same game as top-1 POLY | **153** |
| Ranking conflict (different game) | **0** |
| Top-1 exists but no Poly route | **50** (52.0% WR if bet anyway) |

**When Polymarket can fire, it is always already the board's #1 alpha.** The WR lift is an execution filter, not re-ranking.

### W/L comparison

| Metric | Top 1 (all) | Top 1 (POLY) | Delta |
|--------|------------:|-------------:|------:|
| Days / picks | 203 | 153 | 50 no-route days |
| Win rate | 62.6% | **66.0%** | +3.4 pts |
| Mean α | 11.06 | 12.40 | POLY days higher conviction |
| Mean polyEV (all-slice diluted) | ~29.6% | 38.8% | PASS days drag all-slice |

### Why 50 PASS-only days exist

- Early March spring training (no Poly moneyline)
- Late September — many top picks flagged edge but no routable contract
- October playoff games — mostly PASS
- Single-game days where top α is PASS (negative EV or no market map)

### Regime notes

- **March:** Top-1 all 27.3% (3-8) vs POLY 60.0% (3-2) — spring PASS days drag aggregate
- **July:** Both slices ~44% WR — soft regime, candidate for filter
- **September:** Top-1 all 69% (20-9) but only **1 POLY day** — illusion of strength; most days not executable
- **May:** Top-1 POLY **80.0%** (24-6) — best month

---

## 15. ROI & payout models

**Critical:** Two separate ROI frameworks were used. They share the same **153 picks** and **66% WR** but differ in payout math, stake size, and bankroll treatment. **Do not conflate 22%, 52%, and 545%.**

### 15.1 Quick reference — which number means what?

| Figure | What it measures | Top-1 POLY value |
|--------|------------------|-----------------:|
| **22.6%** | ROI on wagered — Model A (simplified) | Conservative, matches main backtest |
| **52.5%** | ROI on wagered — Model B (per-bet Poly math) | Realistic share payout economics |
| **545%** | Return on $1k starting bankroll — Model B compounding | Not comparable to 22% or 52% |

### 15.2 Model A — Default backtest sim (→ 22.6%)

| Parameter | Value |
|-----------|-------|
| Bankroll | $800 static (non-compounding) |
| Sizing | `getSizing()` audit tiers (~$16–$28 avg) |
| Win payout | **`stake × 0.87` for every win** (flat -110 approximation) |
| Loss | Full stake |
| Entry price | **Ignored** — all wins pay the same multiple |

**Top-1 POLY (Model A):** +$569 profit on $2,520 wagered → **22.6% ROI on wagered**

### 15.3 Model B — Per-bet Polymarket payout (→ 52.5% / 545%)

| Parameter | Value |
|-----------|-------|
| Bankroll | $1,000 compounding (profits reinvested) |
| Stakes | $40–$80 (4–8%, scaled by confidence 70→92+) |
| Entry price | **Per bet:** `confidence/100 − polyEV` (reconstructed crowd price) |
| Win payout | **Per bet:** `stake × (1 − price) / price` |
| Loss | Full stake |
| Reserve | Min $20 bankroll buffer |

**Top-1 POLY (Model B):**

| Metric | Value |
|--------|------:|
| Bets | 153 |
| Win rate | 66.0% (101W–52L) |
| Total wagered | $10,375 |
| Net PnL | **+$5,446** |
| Ending bankroll | **$6,446** |
| ROI on wagered | **52.5%** |
| ROI on starting bankroll | **+545%** ($1k → $6.4k) |
| Max drawdown | 11.7% |

### 15.4 We are NOT using flat 46¢ for every win

**46.4¢ is the mean entry price across 153 bets — not a single price applied to all wins.**

Each bet computes its own price and its own win payout:

```
entry_price = confidence/100 − polyEV     (unique per game)
win_profit  = stake × (1 − entry_price) / entry_price
loss        = −stake
```

**Entry price distribution (Top-1 POLY, 153 bets):**

| Price bucket | Bets | W-L | WR | Avg entry |
|--------------|-----:|-----|---:|----------:|
| Under 30¢ | 15 | 6-9 | 40.0% | 25¢ |
| 30–40¢ | 25 | 15-10 | 60.0% | 36¢ |
| 40–50¢ | 38 | 23-15 | 60.5% | 47¢ |
| 50–60¢ | 67 | 50-17 | **74.6%** | 53¢ |
| 60¢+ | 8 | 7-1 | 87.5% | 65¢ |

| Stat | Value |
|------|------:|
| Min entry (all bets) | 5¢ |
| Max entry (all bets) | 71¢ |
| Mean entry (all bets) | **46.4¢** |
| Median entry | 50¢ |
| Mean entry (wins only) | 48.1¢ |

**Payout examples (actual per-bet math):**

| Scenario | Entry | Stake | Win profit |
|----------|------:|------:|-----------:|
| Favorite win | 71¢ | $80 | +$33 |
| Mid underdog win | 47¢ | $68 | +$77 |
| Deep underdog win | 27¢ | $67 | +$181 |
| Extreme underdog win | 5¢ | $58 | +$1,091 |

**Sanity check — if we wrongly used flat 46¢ for every win:**

| Method | Total PnL |
|--------|----------:|
| Correct per-bet prices | **+$5,446** |
| Wrong: all wins at flat 46.4¢ | +$4,593 |
| Model A flat 0.87× | +$2,612 |

The 52.5% figure comes from **per-bet pricing**, not a blanket 46¢ assumption.

### 15.5 What changed between 22% and 52% (same picks, same WR)

| Factor | Model A (22%) | Model B (52%) |
|--------|---------------|---------------|
| Win payout | Same `0.87×` every win | **Unique Poly formula per bet** |
| Entry prices used | None | 5¢–71¢ range, mean 46¢ |
| Avg stake | ~$16–$28 | ~$68 |
| Total wagered | $2,520 | $10,375 |
| Bankroll | $800 static | $1,000 compounding |
| Net PnL | +$569 | +$5,446 |

**The WR did not change.** The ROI jump is payout math + larger stakes + compounding — not better picks.

### 15.6 Outlier sensitivity (Model B caveat)

Entry prices are **reconstructed** from cache (`confidence − polyEV`), not stored CLOB kickoff fills. One extreme outlier materially moves Model B PnL:

| Scenario | Date | Pick | Entry | Stake | PnL | Notes |
|----------|------|------|------:|------:|----:|-------|
| **Largest single win** | 2025-07-02 | Philadelphia Phillies | **5¢** | $58 | **+$1,091** | polyEV 75%, conf 80% — verify against CLOB |
| PnL without this day | — | — | — | — | +$4,356 | −20% of total |
| With 10¢ price floor | all 153 | — | min 10¢ | — | +$4,878 | Sanity-capped reconstruction |

**Dossier guidance:**
- Cite **22.6%** for conservative / apples-to-apples with main backtest
- Cite **52.5%** only with disclosure: per-bet reconstructed prices, compounding, $40–$80 stakes
- Flag **July 2 outlier** — single day ≈20% of Model B PnL; store `polySharePrice` in cache for audit-grade certainty
- Do **not** say "all wins at 46¢" — say "mean entry 46¢, per-bet Poly payout"

### 15.7 Model comparison table (Top-1 POLY, 153 bets)

| Payout model | Wagered | Net PnL | ROI (wagered) |
|--------------|--------:|--------:|--------------:|
| Model A — flat 0.87×, small stakes | $2,520 | +$569 | **22.6%** |
| Model B — per-bet Poly, $40–$80 | $10,375 | +$5,446 | **52.5%** |
| Model B minus July 2 outlier | $10,317 | +$4,356 | ~42.2% |
| Model B with 10¢ price floor | $10,375 | +$4,878 | ~47.0% |
| Wrong: flat 46¢ all wins | $10,375 | +$4,593 | ~44.3% |

---

## 16. Calendar & monthly breakdowns

### 2025 monthly — all picks

| Month | W-L | WR |
|-------|-----|---:|
| 2025-03 | 40-39 | 50.6% |
| 2025-04 | 165-111 | 59.8% |
| 2025-05 | 178-104 | 63.1% |
| 2025-06 | 170-112 | 60.3% |
| 2025-07 | 146-115 | 55.9% |
| 2025-08 | 168-108 | 60.9% |
| 2025-09 | 102-55 | 65.0% |
| 2025-10 | 10-10 | 50.0% |
| 2025-11 | 1-0 | 100.0% |

### 2025 monthly — Top 1 (all)

| Month | W-L | WR |
|-------|-----|---:|
| 2025-03 | 3-8 | 27.3% |
| 2025-04 | 20-10 | 66.7% |
| 2025-05 | 24-7 | 77.4% |
| 2025-06 | 18-12 | 60.0% |
| 2025-07 | 12-15 | 44.4% |
| 2025-08 | 23-8 | 74.2% |
| 2025-09 | 20-9 | 69.0% |
| 2025-10 | 6-7 | 46.2% |
| 2025-11 | 1-0 | 100.0% |

### 2025 monthly — Top 1 (POLY only)

| Month | W-L | WR | PnL (actual Poly payout) |
|-------|-----|---:|-------------------------:|
| 2025-03 | 3-2 | 60.0% | +$93 |
| 2025-04 | 20-9 | 69.0% | +$757 |
| 2025-05 | 24-6 | **80.0%** | +$1,182 |
| 2025-06 | 18-12 | 60.0% | +$896 |
| 2025-07 | 12-15 | 44.4% | +$1,009 |
| 2025-08 | 23-8 | 74.2% | +$1,410 |
| 2025-09 | 1-0 | 100.0% | +$100 |

---

## 17. Validation sample runs

### Jun 16–20 2025 (Poly pipeline validation)

| Metric | Value |
|--------|------:|
| Games | 64 |
| Picks | 42 |
| WR | 52.4% |
| Poly match | **100%** |
| POLY route WR | 53.7% |
| Sized ROI | -6.9% |

Confirmed matching pipeline works; that week was genuinely weak. Full season held ~60%.

### Jun 1–3 2024 (early sample)

Report: `reports/MLB_BACKTEST_2024-06-01_2024-06-03.md`

---

## 18. What is novel vs standard

### Genuinely differentiated (dossier-worthy)

1. **Signal vs execution split** — PASS (62.7%) vs POLY (59.4%) decomposition; most backtests grade picks only
2. **Live-aligned ranking** — unified α is production sovereign report logic, not a backtest-only metric
3. **Top-1 POLY execution filter** — 0 ranking conflicts; 50 PASS-only days explain WR gap
4. **Prediction-market-native EV** — `polyEV = modelProb − sharePrice` with favorite tax; not sportsbook CLV
5. **Historical Poly infrastructure** — pagination + date index + moneyline classifier + kickoff CLOB for reproducible 2025 replay
6. **Full reproducible artifact** — 5,107 games, row cache, re-slice without API, 2 seasons

### Solid but not novel (do not oversell)

- No-lookahead replay — standard quant hygiene
- Parallel concurrency, caching, resume — standard engineering
- 60% base WR — not headline alpha alone
- Pillar heuristic model — not new ML
- W/L without CLV — incomplete vs sharp betting ops

### One-paragraph thesis

> Bet Bodhi's temporal replay harness replays 5,100+ MLB games with as-of-first-pitch hydration, indexes closed Polymarket moneylines by date, and grades picks through the same unified-α ranking the live sovereign report uses. The novel contribution is decomposing edge into signal (62.7% PASS WR) vs execution (59.4% POLY WR) and proving that slate concentration + tradability filtering (top-1 POLY, 153 days, 66% WR) extracts operable edge from a 60% pick firehose without re-ranking conflicts.

---

## 19. Limitations & caveats

1. **W/L ≠ CLV** — 60% winners does not prove line-beating; no sportsbook closing line replay yet
2. **Entry prices reconstructed** — payout study uses per-bet `confidence − polyEV`, not stored CLOB fills; mean 46¢ ≠ flat 46¢ on every win
3. **Two ROI models** — 22.6% (flat 0.87×) vs 52.5% (per-bet Poly math); 545% is bankroll compounding, not ROI on wagered; always specify which
4. **July 2 outlier** — 2025-07-02 Phillies at reconstructed 5¢ entry contributes ~$1,091 (~20% of Model B PnL); needs CLOB verification
5. **AgentMemory disabled** — live manual fades not modeled
6. **Pre-game only** — no in-game adjustment
7. **2024 no Poly** — half the program is technical signal only
8. **Top-1 variance** — 57.1% in 2024 vs 66.0% POLY in 2025; year-to-year instability
9. **July softness** — ~44% WR both slices; regime filter unexplored (July 2 also has extreme price outlier)
10. **Spring training noise** — early March PASS-heavy, exhibition matchups in data
11. **Playoff games** — late October mostly PASS (no Poly match)
12. **Git status** — backtest work largely uncommitted in repo at time of report

---

## 20. Not done / next experiments

1. Sportsbook CLV backtest — model prob vs Odds API closing lines
2. Store `polySharePrice` in row cache for audit-grade payout math
3. July regime filter exploration
4. Publish to Flocano case-studies grid
5. AgentMemory overlay — model with/without live fade patterns

---

## 21. Complete artifact index

### Scripts

| File | Description |
|------|-------------|
| `scripts/mlb-historical-backtest.ts` | Main season replay runner |
| `scratch/top1_poly_edge_2025.ts` | Top-1 POLY actual-payout analysis |

### Source (modified for backtest)

| File | Description |
|------|-------------|
| `src/lib/polymarket-api.ts` | Closed market pagination, date index, moneyline filters |
| `src/lib/gateway/slate-resolver.ts` | Historical moneyline resolution, kickoff hydration |
| `src/lib/mlb-api.ts` | No-lookahead game hydration |
| `src/lib/pillar-analyzer.ts` | Model, α, sizing, EV logic |

### Data cache

| File | Description |
|------|-------------|
| `data/backtest_cache/rows_2024_poly0.json` | 2,556 games, 2024, no Poly |
| `data/backtest_cache/rows_2025_poly1.json` | 2,551 games, 2025, with Poly |
| `data/backtest_cache/dossier_stats.json` | All slice stats (machine-readable) |
| `data/backtest_cache/top1_2025_summary.json` | Top-1 actual-payout summary |

### Reports

| File | Description |
|------|-------------|
| `reports/BODHI_BACKTEST_MASTER_REPORT.md` | **This file** |
| `reports/BODHI_TEMPORAL_BACKTEST_DOSSIER.md` | Parent engineering dossier |
| `reports/BODHI_TOP1_2025_EDGE_STUDY.md` | Top-1 edge deep dive |
| `reports/MLB_BACKTEST_2024.md` | 2024 season summary |
| `reports/MLB_BACKTEST_2025.md` | 2025 season summary |
| `reports/MLB_BACKTEST_2025_poly_sample.md` | Jun 16–20 validation |
| `reports/MLB_BACKTEST_2024-06-01_2024-06-03.md` | Early 2024 sample |

---

## 22. Raw machine-readable stats

### dossier_stats.json (complete)

```json
{
  "2024": {
    "all": { "picks": 2262, "wins": 1346, "wr": 59.5, "wagered": 59468, "pnl": 8914.16, "roi": 15.0 },
    "top1": { "picks": 210, "wins": 120, "wr": 57.1, "wagered": 5852, "pnl": 438.68, "roi": 7.5 },
    "top3": { "picks": 597, "wins": 384, "wr": 64.3, "wagered": 17192, "pnl": 3602.40, "roi": 21.0 },
    "top5": { "picks": 969, "wins": 620, "wr": 64.0, "wagered": 29144, "pnl": 5727.76, "roi": 19.7 }
  },
  "2025": {
    "all": { "picks": 1634, "wins": 980, "wr": 60.0, "poly_route": 1347, "poly_route_wr": 59.4, "hc": 1150, "hc_wr": 60.3, "wagered": 38704, "pnl": 3385.96, "roi": 8.7 },
    "top1": { "picks": 203, "wins": 127, "wr": 62.6, "poly_route": 153, "poly_route_wr": 66.0, "wagered": 3940, "pnl": 368.48, "roi": 9.4 },
    "top3": { "picks": 577, "wins": 360, "wr": 62.4, "poly_route": 454, "poly_route_wr": 63.9, "wagered": 11468, "pnl": 1554.68, "roi": 13.6 },
    "top5": { "picks": 923, "wins": 587, "wr": 63.6, "poly_route": 734, "poly_route_wr": 64.6, "wagered": 18520, "pnl": 3142.08, "roi": 17.0 },
    "top1_poly": { "picks": 153, "wins": 101, "wr": 66.0, "wagered": 2520, "pnl": 569.24, "roi": 22.6 },
    "top3_poly": { "picks": 454, "wins": 290, "wr": 63.9, "wagered": 7828, "pnl": 1454.68, "roi": 18.6 },
    "top3_hc": { "picks": 452, "wins": 289, "wr": 63.9, "wagered": 7760, "pnl": 1470.32, "roi": 18.9 },
    "pass": { "picks": 287, "wins": 180, "wr": 62.7, "wagered": 7664, "pnl": 1252.16, "roi": 16.3 },
    "poly": { "picks": 1347, "wins": 800, "wr": 59.4, "hc": 1150, "hc_wr": 60.3, "wagered": 31040, "pnl": 2133.80, "roi": 6.9 }
  }
}
```

### top1_2025_summary.json (actual Poly payout)

```json
{
  "bankroll": 1000,
  "stake_range": [40, 80],
  "payout_model": "polymarket_actual",
  "top1_poly": {
    "bets": 153,
    "wr": 66.0,
    "wagered": 10375,
    "pnl": 5446.31,
    "roi_on_wagered": 52.5,
    "roi_on_bankroll": 544.6,
    "ending_bankroll": 6446.31,
    "max_drawdown_pct": 11.7,
    "avg_entry_price": 0.464
  },
  "overlap_same": 153,
  "overlap_diff": 0,
  "pass_only_days": 50,
  "pass_only_wr": 52.0
}
```

---

## 23. Dossier extraction hints

Suggested shard splits for Flocano case-studies grid:

| Shard # | Title angle | Key telemetry |
|---------|-------------|---------------|
| 1 | Temporal Replay Harness | `games: 5107 // lookahead: none // seasons: 2` |
| 2 | Polymarket Historical Index | `poly_match: 98.4% // markets_indexed: 4000+ // lookup: O(day)` |
| 3 | Signal vs Execution Split | `pass_wr: 62.7% // poly_wr: 59.4% // signal_vs_exec: split` |
| 4 | Slate Concentration | `top5_wr: 63.6% // lift: +3.6pts // alpha_rank: unified` |
| 5 | Top-1 POLY Live Strategy | `bets: 153 // wr: 66.0% // conflicts: 0 // filter: execution` |
| 6 | ROI Model Transparency | `roi_conservative: 22.6% // roi_poly_per_bet: 52.5% // mean_entry: 46c // not_flat_price` |
| 7 | Backtest Performance | `fast_mode: 5-10x // concurrency: parallel // cache: resumable` |

### Suggested discipline tags

- Quantitative Modeling
- Web3 Infrastructure
- Algorithmic Execution
- Data & Analytics

### Stack tags for all shards

TypeScript · MLB API · Polymarket Gamma API · CLOB prices-history · Node.js · SQLite

---

*End of master report. Generated from live repo artifacts 2026-06-30.*