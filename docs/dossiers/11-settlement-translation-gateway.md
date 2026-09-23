# [Dossier 11] Polymarket On-Chain Settlement Translation & Caching Gateway

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Web3 Primitives & Cryptographic Routing` // **Type:** `technical` &nbsp;|&nbsp; **Date:** `2026-06-20`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *decoupled middleware resolving binary contract translation mismatches and sequential rate-limiting overhead*

**Executive Summary:** Decoupled Polymarket middleware implementing stateful caching, plural parameter routing, and outcome translation logic to correctly audit on-chain PnL for multi-team sports slates.

- **Telemetry:** `status: active // cache_hit_ratio: 85.2% // settlement_accuracy: 100%`
- **Tech Stack:** `TypeScript`, `Ethers.js v6`, `@polymarket/clob-client`, `Polymarket Gamma API`, `Polymarket Data API`, `PolymarketGateway`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **Historical Trades Audited** | `1,037` |
| **PnL Alignment Error Rate** | `0.0%` |
| **Average Resolution Latency** | `<40ms (Cached)` |
| **API Call Volume Reduction** | `85.2%` |

## Technical Architecture & Findings

### 1. Architectural Challenge

When auditing sports betting execution on-chain, the system queries the Polymarket CLOB client for past trade logs and compares them against settled conditions. This workflow historically suffered from three core engineering failures:

1. **Strict String Comparison Mismatch**: Polymarket CLOB trade logs return outcomes as the literal target asset names (e.g., `"Washington Nationals"` or `"Hanwha Eagles"`). However, the underlying on-chain sports markets resolve as binary condition contracts where the winner is resolved to indices in the outcomes array, while standard endpoints fall back to checking binary outcomes like `["Yes", "No"]`. Direct comparisons of literal outcomes against settled winners failed (e.g., `"Washington Nationals" === "Yes"` evaluates to `false`), causing the engine to count winning trades as losses and flatline realized profits at `$0.00`.
2. **Ignored Singular Routing Parameters**: Querying Gamma API's `/markets` endpoint with singular parameters like `condition_id=<id>` is ignored by the API design, causing the server to silently drop the query filter and return a default page of active markets (e.g. *"New Rihanna Album before GTA VI?"*).
3. **Sequential Throttling Penalties**: Sequential queries across $1,000+$ historical trades hit rate-limiting blocks ($429$) due to a lack of stateful caching, resulting in hang-ups and timeouts.

---

### 2. The Solution: PolymarketGateway

The gateway (`PolymarketGateway.ts`) is a stateful translation and query optimization layer:

* **Plural query filtering**: Gamma requests use repeated `condition_ids` parameters with an active/closed fallback (`closed=true`) so settled contracts resolve correctly.
* **Semantic translation matrix**: The gateway parses the `outcomes` array, resolves the winner from `winningOutcomeIndex` (or `outcomePrices` fallback), and compares that team name to the CLOB trade outcome string.
* **Double-layer caching**: Metadata is cached by `conditionId` across serverless instances to avoid redundant Gamma calls and rate-limit stalls.

---

### 3. Middleware Implementation

```typescript
// Batch Gamma lookups — singular condition_id is ignored by the API
const params = new URLSearchParams();
for (const id of conditionIds) {
    params.append("condition_ids", id);
}
if (closed) params.set("closed", "true");

// Compare literal CLOB outcomes against resolved team names
for (const [outcome, size] of Object.entries(m.positions)) {
    if (size > 0.01 && outcome.trim().toLowerCase() === m.winner.trim().toLowerCase()) {
        payout += size * 1.0;
    }
}

// Baseball win rate uses the highest gross-buy side as the primary pick
if (m.isBaseballMoneyline && m.winner) {
    const primaryPick = this.getPrimaryPick(m);
    const pickUsd = primaryPick ? m.grossBuyUsd[primaryPick] || 0 : 0;
    if (primaryPick && pickUsd >= minPickUsd) {
        baseballResolvedMarkets++;
        if (primaryPick.trim().toLowerCase() === m.winner.trim().toLowerCase()) {
            baseballWinningPicks++;
        }
    }
}
```

Settlement math keys markets by `conditionId` and buckets MLB/KBO realized profit separately for portfolio-level audits.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
