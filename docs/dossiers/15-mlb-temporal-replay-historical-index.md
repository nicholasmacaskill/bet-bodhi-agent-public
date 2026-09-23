# [Dossier 15] MLB Temporal Replay & Polymarket Historical Index

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Quantitative Engineering & Microstructure` // **Type:** `technical` &nbsp;|&nbsp; **Date:** `2026-06-30`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *5,107-game no-lookahead backtest with 98.4% closed-market match rate*

**Executive Summary:** Replays every 2024–2025 final MLB game through production pillar weights with as-of-first-pitch hydration, bulk-loaded closed Gamma moneylines, resumable row cache, and post-run concentration slicing.

- **Telemetry:** `games: 5107 // poly_match: 98.4% // lookahead: none // fast_mode: 5-10x`
- **Tech Stack:** `TypeScript`, `MLB API`, `Node.js`, `SQLite`, `Polymarket Gamma API`, `CLOB prices-history`, `PolymarketGateway`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **games_replayed** | `5,107` |
| **2025_poly_match_rate** | `98.4%` |
| **fast_mode_speedup** | `5–10×` |
| **grading_metric** | `binary W/L` |

## Technical Architecture & Findings

### Temporal replay architecture

**Runner:** `scripts/mlb-historical-backtest.ts`

Each final game replays through the live stack with zero lookahead:

```
MLB final game
  → getHydratedAnalysisData()   [stats as-of first pitch]
  → PillarAnalyzer.analyzeGame() [current production weights]
  → resolveHistoricalMoneyline() [2025 only]
  → grade valueTeam vs winner
  → write BacktestRow to cache
  → summarize + concentration table
```

### Methodology guardrails

| Rule | Implementation |
|------|----------------|
| No lookahead | Season stats, standings, form, and series frozen to game date |
| No agent memory | `AgentMemory` disabled — backtest = pure model, not live fades |
| Pick population | Every final game where `valueTeam` is set |
| Concentration | Post-process: per calendar day, rank and slice top 1 / 3 / 5 |

### Closed Polymarket historical index

**Problem 1 — 0% match on 2025:** Gamma `query=` search broken for closed MLB markets.

**Fix:** Paginate `GET /events?closed=true&tag_slug=mlb|sports|baseball`, bulk-load 4,000+ markets once at startup, build date index → **98.4%** match (2,509 / 2,551 games).

**Problem 2 — False positives:** Series Winner, O/U, spreads matched as moneylines.

**Fix — `isMoneylineMarket()`:** Rejects series/playoff props, non two-outcome contracts, and non `Team A vs Team B` questions.

**2024:** Polymarket historical MLB moneylines unavailable — season run with `--skip-poly` (technical signal only, 59.5% WR).

**2025:** Gamma close prices + optional CLOB `prices-history` at kickoff.

### Runtime & cache

Bulk closed-market load, date-indexed O(day) lookup, parallel game workers (`--concurrency`), and incremental row cache cut full-season 2025 from ~72 min to **5–10× faster** in `--fast` mode. Cached rows enable instant re-slicing without re-hitting APIs.

### Live pipeline validation

Jun 16–20, 2025 forward test: replay harness and daily scanner pipeline operated correctly; that week's model output underperformed — confirms infrastructure works independently of any single soft regime.

### Reproduce

```bash
npx tsx scripts/mlb-historical-backtest.ts --season 2024 --skip-poly
npx tsx scripts/mlb-historical-backtest.ts --season 2025
npx tsx scripts/mlb-historical-backtest.ts --season 2025 --fast --concurrency 4 --quiet
```

**Artifacts:** `data/backtest_cache/rows_2024_poly0.json`, `rows_2025_poly1.json`, `dossier_stats.json`

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
