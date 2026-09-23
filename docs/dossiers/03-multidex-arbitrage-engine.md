# [Dossier 03] Multi-DEX Arbitrage Engine

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Quantitative Engineering & Microstructure` // **Type:** `strategic` &nbsp;|&nbsp; **Date:** `2026-07-17`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *baseline oracle resolution & concurrent execution*

**Executive Summary:** Uses Polymarket as a highly liquid 'fair value' oracle to establish a baseline edge before hunting alternative venues for maximum execution odds using concurrent Promise.all architecture.

- **Telemetry:** `mode: two_step_auth // oracle: polymarket_clob // concurrency: enabled`
- **Tech Stack:** `TypeScript`, `Polymarket CLOB`, `Algorithmic Routing`, `Azuro Protocol`, `SX Bet API`, `Promise.all Concurrency`, `Decimal Odds Normalization`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **alpha_threshold** | `>2.5%` |
| **latency_bottleneck** | `slowest_api_node` |

## Technical Architecture & Findings

### 1. The Two-Step Alpha Engine
The foundational component of this pivot was the creation of the \`MultiDexRouter\`, which transforms Bodhi into a two-step arbitrage engine. 

**Step 1:** Bodhi runs its proprietary technical and psychological analysis to generate a "Bodhi Probability." It compares this internal probability against Polymarket’s highly liquid orderbook—using Polymarket purely as a "fair value" pricing oracle to determine if a baseline edge (Alpha) exists. 

**Step 2:** Once an edge is confirmed against Polymarket, the router fires asynchronous API calls concurrently to four alternative execution venues (SX Bet, Azuro, Dexsport, and BetDEX). It actively compares Polymarket's baseline price against these alternative platforms to find the absolute highest decimal odds available for the matchup, ensuring maximum return on every single trade before execution.

### 2. Parallel Latency Optimization
In algorithmic sniping, execution speed dictates success. Instead of sequential querying, the \`MultiDexRouter\` utilizes \`Promise.all\` to query all platforms concurrently. This parallel architecture maps the entire decentralized liquidity landscape in the time it takes the single slowest API node to respond.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
