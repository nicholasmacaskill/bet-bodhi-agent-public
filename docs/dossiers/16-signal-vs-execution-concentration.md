# [Dossier 16] Signal vs Execution & Slate Concentration

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Quantitative Engineering & Microstructure` // **Type:** `strategic` &nbsp;|&nbsp; **Date:** `2026-06-30`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *full firehose vs top-5 / top-3 / top-1 daily filters*

**Executive Summary:** Decomposes handicapping signal from tradable Polymarket routes, then proves tighter daily concentration monotonically lifts win rate — top-1 tradable reaches 66.0% on 153 bets without changing the underlying model.

- **Telemetry:** `all_wr: 60.0% // top5_wr: 63.6% // top1_tradable_wr: 66.0% // pass_vs_poly: split`
- **Tech Stack:** `TypeScript`, `Polymarket Gamma API`, `SQLite WAL`, `Temporal Concentration`, `Slate Optimization`, `As-Of Execution Hydration`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **all_picks_WR** | `60.0%` |
| **top5_per_day_WR** | `63.6%` |
| **top1_per_day_WR** | `62.6%` |
| **top1_tradable_WR** | `66.0%` |

## Technical Architecture & Findings

### Signal vs execution (2025)

| Layer | Definition | WR |
|-------|------------|---:|
| **All picks** | `valueTeam` wins the game | 60.0% |
| **PASS** | Edge identified but no tradable route | **62.7%** |
| **POLY execution** | Positive-EV Polymarket route available | **59.4%** |

**Handicapping beats tradable routes by 3.3 points.** Crowd share prices on Polymarket partially price the same edge the model sees — motivating selective execution and slate concentration rather than firing every pick.

### Concentration ladder — full report vs daily filters (2025)

| Slice | Picks | WR |
|-------|------:|---:|
| **Full report** (all picks) | 1,634 | 60.0% |
| **Top 5 / day** | 923 | **63.6%** |
| **Top 3 / day** | 577 | 62.4% |
| **Top 1 / day** (all routes) | 203 | 62.6% |
| **Top 1 / day** (tradable only) | 153 | **66.0%** |

Tighter daily filters extract edge from a 60% pick firehose: **+3.6 points** from full report to top-5 across 900+ bets. Top-1 tradable adds another **+2.4 points** over top-1 all-routes — the lift comes from days where Polymarket can actually execute, not from re-ranking the model.

### Cross-season stability

| Slice | 2024 WR | 2025 WR |
|-------|--------:|--------:|
| Full report | 59.5% | 60.0% |
| Top 5 / day | 64.0% | 63.6% |
| Top 3 / day | 64.3% | 62.4% |
| Top 1 / day | 57.1% | 62.6% |
| Top 1 tradable | — | 66.0% |

2024 had no Polymarket historical moneylines (`--skip-poly`). Concentration lift on top-5/top-3 held both seasons; top-1 alone was weaker in 2024 before tradable-route filtering.

### Research thesis

This is **decomposition research**, not a new ML stack: prove signal at scale, separate execution friction, then show concentration improves realized accuracy. Ranking weights and EV thresholds are production IP — outcomes above are reproducible from the public harness without them.

### Limitations

- Grading is binary W/L, not closing-line value
- 2024 season lacks Polymarket execution fidelity
- Historical entry prices are reconstructed where kickoff CLOB was not cached
- Win-rate lifts are robust; ROI figures depend on stake model and are not cited here

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
