# [Dossier 01] Autonomous CLOB Mispricing Resolver

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Quantitative Engineering & Microstructure` // **Type:** `technical` &nbsp;|&nbsp; **Date:** `2026-08-16`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *reliever fatigue telemetry & orderbook pricing latency*

**Executive Summary:** Exploits prediction market pricing latency around late-game bullpen exhaustion by synthesizing 72-hour reliever pitch counts, platoon splits, and atmospheric vectors against Polymarket CLOB spreads.

- **Telemetry:** `execution: active_maker_taker // edge_target: polymarket_clob // realized_pnl: +$546 // win_rate_trend: 20.0%->35.4%`
- **Tech Stack:** `TypeScript`, `@polymarket/clob-client`, `EIP-712 Order Matching`, `Polymarket Gamma API`, `MLB Stats API`, `Odds API`, `Node.js`, `SQLite WAL`, `Ethers.js v6`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **Recent Win Rate** | `35.4%` |
| **Realized Profit** | `+$546` |
| **Traded Volume** | `$17,947` |
| **Scored Data Pillars** | `5 Streams` |

## Technical Architecture & Findings

### 1. The Microstructure Inefficiency in Binary Sports Markets
Prediction market orderbooks (such as Polymarket's Central Limit Order Book) are fundamentally retail-driven. While traditional sportsbooks adjust odds dynamically as lineups change, Web3 prediction markets exhibit significant pricing latency—particularly around **in-game degradation variables** like bullpen exhaustion.

Retail traders predominantly price baseball moneylines based on the Starting Pitcher's surface ERA and season win-loss records. However, starters rarely pitch past the 5th inning in modern baseball. When a bullpen has thrown 120+ pitches across the previous 48 hours or high-leverage closers are unavailable, the true win probability of the favorite plummets—yet Polymarket crowd share prices remain anchored to opening lines.

---

### 2. The 5-Pillar Quantitative Synthesis Engine

The **Autonomous CLOB Mispricing Resolver** ingests and synthesizes five real-time telemetry streams before the market can recalibrate:

1. **Reliever Exhaustion Index (72h Pitch Telemetry)**: Continuously tracks pitch counts, back-to-back appearances, and closer availability across the entire bullpen depth chart.
2. **Platoon Matchup Vulnerabilities**: Maps left-handed and right-handed batter splits against the specific pitch mix (slider/sweeper/fastball velocity) of incoming relievers.
3. **Atmospheric & Stadium Vectors**: Ingests live barometric pressure, temperature, and wind velocity vectors (e.g. wind blowing out to right field boosting home run probability at specific launch angles).
4. **Composite Starter ERA**: Applies a weighted blend of spring training baseline, rolling season ERA, and strikeout-to-walk ratios ($K/BB$).
5. **Live Orderbook Spread Matching**: Calculates the exact bid/ask depth on Polymarket's CLOB via EIP-712 token identifiers to ensure trades are filled with minimal slippage.

---

### 3. Empirical Accuracy Scaling (20.0% → 35.4%)

By filtering out noisy prop bets and focusing strictly on high-conviction moneyline mispricings, the system demonstrated a monotonic climb in accuracy across 365 on-chain resolved games:

| Execution Phase | Sample Size | Win Rate |
| :--- | :--- | :--- |
| Early Unfiltered Scans | 50 games | 20.0% |
| Reliever Load Tracking | 150 games | 28.7% |
| 5-Pillar Engine Active | 300 games | 30.0% |
| **Recent Golden Sniper Tier** | **Last 65 games** | **35.4%** |

Because the engine targets asymmetric underdog odds on Polymarket (e.g. purchasing contracts at $0.25–$0.40 that resolve to $1.00), a 35.4% win rate generates substantial positive mathematical expectancy—producing **+$546 in net realized profit** across **$17,947 in traded volume**.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
