# Bet Bodhi

> **classification:** `sovereign_system` &nbsp;|&nbsp; **sys_id:** `FL-BET-` &nbsp;|&nbsp; **status:** `production`  
> **origin:** [Flocano Labs Sovereign R&D Forge](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### *Sovereign Web3 Sports Prediction Arbitrage Engine*

An autonomous quantitative execution engine for Polymarket sports markets — validated across 5,107-game MLB temporal replay (2024–2025) with signal-vs-execution decomposition, closed-market historical indexing, and post-hoc slate concentration proving tighter daily filters lift win rate without changing the underlying model.

---

### 📊 System Telemetry & Empirical HUD

| Metric | Production Ground Truth | Description |
|:---|:---|:---|
| **mlb_games_replayed** | `5,107` | Complete 2024–2025 MLB regular season games replayed with zero lookahead |
| **polymarket_match_rate** | `98.4%` | Historical moneyline contract resolution match rate (2,509 / 2,551 games) |
| **top5_per_day_wr** | `63.6%` | Win rate achieved via daily Top-5 slate concentration filter across 923 bets |
| **top3_per_day_wr** | `62.4%` | Win rate achieved via daily Top-3 slate concentration filter across 577 bets |
| **top1_tradable_wr** | `66.0%` | Win rate achieved on daily Top-1 tradable Polymarket execution route (153 bets) |

---

### 🏛️ Engineering Disciplines
* **Quantitative Engineering & Microstructure**
* **Web3 Primitives & Cryptographic Routing**
* **Cognitive AI & Multi-Agent Swarms**
* **Distributed Systems & High-Throughput State**

### 🛠️ Unified Technology Stack
`@polymarket/clob-client` • `@sx-bet/sportx-js` • `Active Taker Sniping` • `Algorithmic Routing` • `Arbitrum RPC` • `As-Of Execution Hydration` • `Azuro Protocol` • `Azuro Protocol V3` • `Bayesian Logic` • `BodhiPrism` • `CLOB prices-history` • `Context Compression` • `Daily Budget Throttling` • `Decimal Odds Normalization` • `EIP-712` • `EIP-712 Order Matching` • `EIP-712 Permit` • `ESPN API` • `Ethers.js v6` • `Fractional Kelly Sizing` • `Gemini API` • `Gnosis Chain` • `GraphQL` • `Hardcoded Risk Ceilings` • `JSON State` • `KBO API` • `Limit Order Placement` • `MLB API` • `MLB Stats API` • `MMA API` • `Macro Regime Telemetry` • `Multi-Chain Routing` • `NBA API` • `NHL API` • `Node.js` • `Odds API` • `On-Chain Bankroll Verification` • `One-Tap Execution` • `OpenRouter` • `Polygon` • `Polygon CTF` • `Polygon RPC` • `Polymarket CLOB` • `Polymarket Data API` • `Polymarket Gamma API` • `PolymarketGateway` • `Promise.all Concurrency` • `RPC Node` • `RPC Node Failover` • `Rolling Volatility Tracking` • `SQLite` • `SQLite WAL` • `SX Bet API` • `SX Rollup` • `Schema Normalization` • `Sentiment Guard` • `Shallow Paging` • `Slate Optimization` • `Slump Mode Throttling` • `Solana` • `Supabase` • `Telegram Bot API` • `Temporal Concentration` • `Token Telemetry` • `TokenTransferProxy` • `TypeScript` • `USDC.e Approvals` • `USDC.e Contract Reads` • `macOS launchd`

---

## 📑 Complete Engineering Dossiers (Shards 01–16)

### [01] Autonomous CLOB Mispricing Resolver

> **discipline:** `Quantitative Engineering & Microstructure` // **type:** `technical` &nbsp;|&nbsp; **telemetry:** `execution: active_maker_taker` &nbsp;|&nbsp; **dossier_id:** [`bodhi-clob-mispricing-resolver`](https://www.flocanolabs.com/flocanolabs/case-studies)

*reliever fatigue telemetry & orderbook pricing latency*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **Recent Win Rate** | `35.4%` |
| **Realized Profit** | `+$546` |
| **Traded Volume** | `$17,947` |
| **Scored Data Pillars** | `5 Streams` |

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

### [02] L2 Execution & Relayer Bypass

> **discipline:** `Web3 Primitives & Cryptographic Routing` // **type:** `technical` &nbsp;|&nbsp; **telemetry:** `status: resolved` &nbsp;|&nbsp; **dossier_id:** [`bodhi-execution-pipeline`](https://www.flocanolabs.com/flocanolabs/case-studies)

*bypassing gasless UX abstractions & EIP-712 alignment*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **Execution Latency** | `<150ms` |
| **RPC Infrastructure** | `Dedicated Nodes` |
| **Gas Bypass** | `Proxy Exploitation` |

### 1. The Gasless UI Trap
Modern Web3 platforms rely on proprietary relayers and 'gasless' UX to capture and lock in retail order flow. When we attempted to programmatically route arbitrage executions to SX Bet's v6 matching engine, the bot hit an immediate wall: \`INSUFFICIENT_FUNDS\`. The native SX token had been deprecated, yet standard smart contract interactions still demanded base fees.

The UI abstracted this reality via EIP-712 \`permit\` signatures. Instead of bending to the proprietary relayer, we reverse-engineered the UI flow, isolating the hidden \`TokenTransferProxy\`. By submitting a single manual transaction to permanently approve the proxy, we entirely bypassed the gas-heavy sequential \`approve\` requirements, achieving zero-friction execution.

### 2. DNS Rot and Hidden RPC Infrastructure
Decentralized execution is a myth if the RPC layer relies on fragile corporate DNS. The default Gelato endpoints for the Arbitrum-based SX Rollup were caught in an unrecoverable retry loop, crashing the Node.js process. Public alternatives aggressively throttled raw \`eth_call\` contract reads.

The solution wasn't to write retry logic—it was to find the ground truth. We scraped the network layer, uncovering a hidden, unthrottled node (\`rpc-rollup.sx.technology\`). By pinning our execution pipeline strictly to this endpoint, we collapsed structural latency and stabilized blockchain reads instantly.

### 3. EIP-712 Cryptographic Strictness
Polymarket's Conditional Token Framework (CTF) Exchange on Polygon relies on off-chain order matching secured by strict EIP-712 domain schemas. The slightest deviation in Chain ID or verifying contract addresses results in silent relayer rejection. We bypassed the fragile public infrastructure, built automated \`USDC.e\` allowance validation at the execution layer, and routed the payload through dedicated RPCs to guarantee our arbitrage logic executed before the public orderbook could react.

---

### [03] Multi-DEX Arbitrage Engine

> **discipline:** `Quantitative Engineering & Microstructure` // **type:** `strategic` &nbsp;|&nbsp; **telemetry:** `mode: two_step_auth` &nbsp;|&nbsp; **dossier_id:** [`bodhi-multidex-arbitrage`](https://www.flocanolabs.com/flocanolabs/case-studies)

*baseline oracle resolution & concurrent execution*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **alpha_threshold** | `>2.5%` |
| **latency_bottleneck** | `slowest_api_node` |

### 1. The Two-Step Alpha Engine
The foundational component of this pivot was the creation of the \`MultiDexRouter\`, which transforms Bodhi into a two-step arbitrage engine. 

**Step 1:** Bodhi runs its proprietary technical and psychological analysis to generate a "Bodhi Probability." It compares this internal probability against Polymarket’s highly liquid orderbook—using Polymarket purely as a "fair value" pricing oracle to determine if a baseline edge (Alpha) exists. 

**Step 2:** Once an edge is confirmed against Polymarket, the router fires asynchronous API calls concurrently to four alternative execution venues (SX Bet, Azuro, Dexsport, and BetDEX). It actively compares Polymarket's baseline price against these alternative platforms to find the absolute highest decimal odds available for the matchup, ensuring maximum return on every single trade before execution.

### 2. Parallel Latency Optimization
In algorithmic sniping, execution speed dictates success. Instead of sequential querying, the \`MultiDexRouter\` utilizes \`Promise.all\` to query all platforms concurrently. This parallel architecture maps the entire decentralized liquidity landscape in the time it takes the single slowest API node to respond.

---

### [04] Multi-Chain Execution Abstraction

> **discipline:** `Web3 Primitives & Cryptographic Routing` // **type:** `technical` &nbsp;|&nbsp; **telemetry:** `networks: poly+gno+sol` &nbsp;|&nbsp; **dossier_id:** [`bodhi-crosschain-abstraction`](https://www.flocanolabs.com/flocanolabs/case-studies)

*cross-chain liquidity routing & schema normalization*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **gas_overhead** | `<$0.01` |
| **manual_bridging** | `eliminated` |

### 1. The Multi-Chain Execution Agent
Bodhi is not just a multi-DEX aggregator; it is a true Multi-Chain Execution Agent. To avoid the massive gas fees of Ethereum Mainnet, decentralized sportsbooks are spread across various alternative blockchains. SX Bet, Polymarket, and Dexsport execute on Polygon. Azuro operates on Gnosis Chain and Polygon. BetDEX executes entirely on Solana.

Bodhi completely abstracts away this cross-chain complexity. When an execution command is issued, Bodhi dynamically routes the cryptographic payload to the correct RPC node, calculates the fractional-cent gas fees automatically, and signs the transaction using your wallet credentials. The user achieves the best price across multiple blockchains without ever having to manually bridge funds or switch network configurations.

### 2. Universal Schema Normalization
Aggregating decentralized exchanges requires translating disparate data structures: Azuro uses GraphQL subgraphs, SX Bet uses REST APIs and EIP-712 hashes, Dexsport relies on AMM REST pools, and BetDEX uses standard JSON APIs. The \`IDexOddsResult\` interface acts as a universal translator, normalizing these wildly different schemas into a single, clean decimal format for real-time comparative analysis.

---

### [05] Cryptographic Sniping & Infrastructure Upgrades

> **discipline:** `Web3 Primitives & Cryptographic Routing` // **type:** `technical` &nbsp;|&nbsp; **telemetry:** `mode: active_taker` &nbsp;|&nbsp; **dossier_id:** [`bodhi-cryptographic-sniping`](https://www.flocanolabs.com/flocanolabs/case-studies)

*active maker/taker execution*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **cryptographic_standard** | `EIP-712` |
| **native_risk_ceiling** | `$100` |

### 1. Transforming SX Bet into an Active Sniper (CLOB vs AMM)
Unlike venues such as Azuro or Dexsport which use passive Liquidity Pools (AMMs), SX Bet operates as a peer-to-peer Central Limit Order Book (CLOB). To execute on SX Bet, Bodhi cannot simply interact with a pool contract; it must actively hunt and fill specific cryptographically-signed Maker orders.

Because SX Bet requires this complex Maker/Taker cryptographic handshake, we integrated the official \`@sx-bet/sportx-js\` SDK. We rewrote the orderbook parser to capture the entire raw Maker order—including the counterparty's EIP-712 cryptographic signature. We then built the \`executeSnipe\` function to generate a matching Taker signature, format the payload, and submit both signatures natively to the Polygon blockchain for smart contract verification (with a hardcoded risk ceiling to protect downside).

### 2. Azuro Protocol V3 Infrastructure Upgrade
To ensure Azuro was a viable execution venue, we modernized the \`AzuroApi\`. The protocol recently deprecated its older data structures in favor of a new V3 subgraph architecture. We rewrote the GraphQL queries to accommodate these schema changes—specifically engineering workarounds for the removal of the traditional status field by implementing time-based filtering (\`startsAt\`) and mapping sport-specific slugs. We also secured the connection by integrating a dedicated Azuro Developer API token into the environment, fully authorizing Bodhi to read live orderbooks and submit bets on-chain.

---

### [06] The Telegram Sentinel & Bayesian Risk

> **discipline:** `Quantitative Engineering & Microstructure` // **type:** `strategic` &nbsp;|&nbsp; **telemetry:** `interface: telegram_bot` &nbsp;|&nbsp; **dossier_id:** [`bodhi-telegram-sentinel`](https://www.flocanolabs.com/flocanolabs/case-studies)

*one-tap execution & risk throttling*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **time_to_execute** | `<1_second` |
| **sentiment_risk_throttle** | `0.5x (stressed)` |

### 1. Unified On-Chain Execution via Telegram
With all venues wired up, we built a fully interactive Telegram execution pipeline to control them. When a nightly scan completes, Bodhi generates a report that dynamically lists the exact execution price for every available platform, visibly highlighting the absolute best price across the ecosystem with a gold medal (🥇). 

Crucially, the scanner saves the full cryptographic payloads (the raw order hashes and API data) into a local \`latest_picks.json\` state file. The user can simply send the \`/pick best\` command. The moment that command is sent, the bot routes the saved payload through the Multi-DEX Router, and submits the transaction directly to the correct blockchain. Smart contract slippage protection guarantees native security against stale odds.

### 2. Sentiment-Adjusted Kelly Sizing
Bodhi doesn't just tell you where to execute, it calculates exactly how much capital to deploy based on real-time on-chain data. Before generating the report, Bodhi natively checks the live USDC balance. It then uses a Fractional Kelly Criterion formula to calculate a precise stake based on the edge. 

This mathematical sizing is dynamically throttled by a psychological Sentiment Guard built into the Telegram bot. If the user reports feeling "stressed" with a low calmness score, Bodhi's Bayesian engine applies a risk multiplier (e.g., 0.5x), automatically cutting the Kelly-suggested execution stake in half to protect the bankroll from emotional variance.

---

### [07] Incident Report: Polymarket CLOB API Auth Block

> **discipline:** `Web3 Primitives & Cryptographic Routing` // **type:** `incident` &nbsp;|&nbsp; **telemetry:** `mode: background_daemon` &nbsp;|&nbsp; **dossier_id:** [`polymarket-clob-auth-block`](https://www.flocanolabs.com/flocanolabs/case-studies)

*sovereign infrastructure shift*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **data_retrieval_latency** | `<1ms` |
| **telegram_api_timeout_risk** | `0%` |

### 1. The Catalyst (Upstream API Change)
**Previous State:** Polymarket’s \`@polymarket/clob-client\` SDK allowed programmatic automated derivation of L2 cryptographic API keys. The system could pass the user's \`WALLET_PRIVATE_KEY\` to \`client.createOrDeriveApiKey()\`, which would sign a message and receive temporary API credentials from the \`/auth/api-key\` endpoint.

**The Break:** Polymarket enforced strict bot-mitigation on the \`/auth/api-key\` endpoint, returning 409 Conflict or 400 Bad Request. API keys can now only be generated via a manual, browser-based wallet signature (enforcing manual Terms of Service acceptance and Cloudflare checks).

**Impact on Bodhi:** The automated P&L sync script began failing the authentication handshake. Because the Telegram bot’s \`/ask\` command was executing this sync synchronously via \`loadTradeBook()\`, the OpenRouter handler hung. It hit the 90-second Telegram timeout threshold and crashed, failing over to a corrupted local SQLite database approximation.

### 2. The Architectural Adaptation (Sovereign Infrastructure Shift)
To resolve the dependency on the fragile upstream auth endpoint, we deployed a two-part architectural overhaul, shifting Bodhi from a synchronous script to an asynchronous, self-healing sovereign application.

#### Phase A: Cryptographic Session Extraction (The Bypass)
- We bypassed the automated \`/auth/api-key\` endpoint entirely by extracting the permanent L2 credentials (key, secret, passphrase) directly from the Local Storage (\`clob-api-credentials\`) of a manually authenticated browser session.
- We hardcoded these immutable L2 keys into the local \`.env\`.
**Result:** Bodhi now authenticates instantly and natively, bypassing all upstream bot-mitigation checks.

#### Phase B: Decoupling via macOS UNIX Kernel (The Daemonization)
**Previous Architecture:** Telegram \`/ask\` -> Synchronous fetch of 5,000+ trades -> 3-minute execution -> Telegram Timeout Error.
**New Architecture:** We decoupled the blockchain sync from the Telegram interface.
- We updated \`calculate-live-pnl.ts\` to execute the heavy data ingestion, calculate the precise on-chain P&L math, and output a lightweight state file (\`data/latest_pnl.json\`).
- We authored a native macOS launchd daemon (\`com.betbodhi.pnlsync.plist\`) to execute this script silently in the background OS kernel every 15 minutes.
- We refactored the \`openrouter-handler.ts\` context builder to read the \`latest_pnl.json\` cache locally.

**Result:** The \`/ask\` command now retrieves perfectly accurate on-chain data in <1 millisecond, with 0% risk of Telegram API timeouts, operating completely independently of user input.

---

### [08] Pillar Evaluation & Probability Calibration

> **discipline:** `Quantitative Engineering & Microstructure` // **type:** `strategic` &nbsp;|&nbsp; **telemetry:** `mode: active` &nbsp;|&nbsp; **dossier_id:** [`pillar-analysis`](https://www.flocanolabs.com/flocanolabs/case-studies)

*matchup probability weighting*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **confidence_weight_limit** | `85% (nhl/nba)` |
| **base_stake_multiplier** | `0.5 (slump_mode)` |

### Pillar Scoring Framework

The system evaluates matchups by combining sport-specific parameters into an objective confidence score ($C$). The scoring model evaluates three core pillars, each scaling from $0$ to $10$:

1. **Technical Sport ($P_1$)**: Evaluates pitching metrics (composite ERA calculated via a 70/30 blend of last year's regular season and spring training, or active season ERA after a 15-inning sample size), lineup quality (Elite/Hot bats), bullpen fatigue logs, and platoon splits.
2. **Seasonal/Environmental ($P_2$)**: Integrates venue metrics (e.g. Coors Field hitter boost of `+2.5`, Petco Park pitcher boost of `+1.5`), weather parameters (wind speeds and directions), and ramping factors.
3. **Technical Bookies ($P_3$)**: Tracks implied pricing from traditional bookmakers compared to Polymarket crowd prices to resolve Expected Value (EV):

$$\text{EV} = \frac{C}{100} - \text{Polymarket Share Price}$$

### Sizing and Risk Mitigation

```typescript
export function getSizing(confidence: number, bankroll: number): { label: string, amount: number } {
    if (confidence >= 80) return { label: "Aggressive (7.5%)", amount: bankroll * 0.075 };
    if (confidence >= 70) return { label: "Standard (4.0%)", amount: bankroll * 0.04 };
    if (confidence >= 60) return { label: "Caution (2.0%)", amount: bankroll * 0.02 };
    return { label: "Zero (0%)", amount: 0 };
}
```

If the system detects a performance drawdown (e.g. 3 consecutive losses or 4 of the last 5 settled as losses in Supabase), it enters `Slump Mode`, automatically reducing the suggested stake sizes by 50% ($0.5\times$ multiplier) to preserve capital during high-variance periods.

---

### [09] Web3 Liquidity Resolution & CLOB Order Routing

> **discipline:** `Web3 Primitives & Cryptographic Routing` // **type:** `technical` &nbsp;|&nbsp; **telemetry:** `chain_id: 137` &nbsp;|&nbsp; **dossier_id:** [`polymarket-clob-pipeline`](https://www.flocanolabs.com/flocanolabs/case-studies)

*on-chain order execution*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **max_execution_slippage** | `$0.05` |
| **safety_stake_limit** | `$35.00` |

### Ethers.js v6 Signer Adapter

The `@polymarket/clob-client` SDK expects an Ethers v5 signer. A custom signature adapter bridges v6 wallet declarations without duplicating dependency weight and handles the `SignatureType.POLY_PROXY` execution structure for proxy wallets:

```typescript
const signerAdapter: any = {
    getAddress: async () => wallet.address,
    signMessage: async (message: string | Uint8Array) => wallet.signMessage(
        typeof message === 'string' ? message : ethers.hexlify(message)
    ),
    _signTypedData: async (domain: any, types: any, value: any) => {
        const { EIP712Domain, ...restTypes } = types;
        return await wallet.signTypedData(domain, restTypes, value);
    },
    connect: () => signerAdapter
};
```

### Execution Flow

Orders are placed as bounded limit orders using resolved contract tokens. To protect against slippage, execution limits are bounded dynamically:

$$\text{Execution Price} = \min(\text{Target Price} + 0.05, 0.99)$$

If `POLY_PROXY_ADDRESS` is specified in the environment, the client routes transactions through the proxy, verifying USDC.e on-chain balances on the Polygon network prior to order submission.

---

### [10] Context Compression & SQLite Token Telemetry

> **discipline:** `Cognitive AI & Multi-Agent Swarms` // **type:** `feedback` &nbsp;|&nbsp; **telemetry:** `budget_limit: $2.00/day` &nbsp;|&nbsp; **dossier_id:** [`llm-finops-optimization`](https://www.flocanolabs.com/flocanolabs/case-studies)

*prompt cost reduction*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **context_compression_rate** | `80%` |
| **max_context_chars** | `4000` |

### Context Compression Algorithm

To optimize LLM prompt structures and mitigate high token usage costs, the `compressContext` engine parses incoming scraping inputs and retains only blocks carrying specific domain keywords. It then slices the output context to a maximum character size:

```typescript
export function compressContext(text: string, query: string = "", maxChars: number = 4000): string {
    if (!text) return "";
    const defaultKeywords = ["drawdown", "rules", "limits", "payouts", "error", "stats", "kelly", "stake", "edge"];
    const queryKeywords = query ? query.toLowerCase().split(/[^a-z0-9]+/gi).filter(w => w.length > 3) : [];
    const keywords = Array.from(new Set([...defaultKeywords, ...queryKeywords]));
    
    const chunks = text.split(/(?:\r?\n|\. |\<[^\>]+\>)/g).map(c => c.trim()).filter(c => c.length > 0);
    const filtered = chunks.filter(chunk => {
        const lower = chunk.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
    });
    
    let compressed = filtered.join("\n") || text;
    return compressed.length > maxChars ? compressed.slice(0, maxChars) + "\n... [TRUNCATED] ..." : compressed;
}
```

### Budget Circuit Breakers

The `TokenTracker` intercepts response usage metadata, estimates real-time API fees based on the model's rate structures (e.g. $0.075/$0.30 per million tokens for Gemini 2.0 Flash), and records logs to SQLite. If daily spending hits 80% ($1.60) or 100% ($2.00) of the budget threshold, the tracker triggers an asynchronous warning message via the Telegram Bot API.

---

### [11] Polymarket On-Chain Settlement Translation & Caching Gateway

> **discipline:** `Web3 Primitives & Cryptographic Routing` // **type:** `technical` &nbsp;|&nbsp; **telemetry:** `status: active` &nbsp;|&nbsp; **dossier_id:** [`bet-bodhi-polymarket-middleware`](https://www.flocanolabs.com/flocanolabs/case-studies)

*decoupled middleware resolving binary contract translation mismatches and sequential rate-limiting overhead*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **Historical Trades Audited** | `1,037` |
| **PnL Alignment Error Rate** | `0.0%` |
| **Average Resolution Latency** | `<40ms (Cached)` |
| **API Call Volume Reduction** | `85.2%` |

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

### [12] Shallow On-Chain State Sync & Bankroll Verification

> **discipline:** `Web3 Primitives & Cryptographic Routing` // **type:** `technical` &nbsp;|&nbsp; **telemetry:** `sync_mode: shallow` &nbsp;|&nbsp; **dossier_id:** [`bodhi-shallow-on-chain-sync`](https://www.flocanolabs.com/flocanolabs/case-studies)

*replacing brittle csv logs with bounded polygon queries*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **full_sync_duration** | `~11 min` |
| **shallow_sync_duration** | `< 5s` |
| **latency_reduction** | `99.2%` |
| **trade_resolution_accuracy** | `100%` |

### The Problem: Static CSV Settlement Logs

Pending bet settlement was originally tracked in local static CSV files. The workflow was brittle — prone to corruption, required manual reconciliation, and could not keep pace with live scanner cycles. Full historical syncs walked entire Supabase and CLOB trees on every diagnostic run, producing **~11 minute** state checks that blocked daily execution.

### Shallow Sync Architecture

Diagnostic and scanner entrypoints now default to **shallow syncs**: only the last 100 settled entries or 2 pages of active CLOB trade history are pulled before bankroll verification runs. This bounds network I/O while preserving enough context for same-day decisioning.

The sync pipeline pairs shallow trade paging with direct on-chain USDC.e balance reads on Polygon (`0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`):

```typescript
async getUSDCBalance(): Promise<number> {
    // 1. Try Polymarket CLOB collateral balance (fast path)
    const clobBalance = await client.getBalanceAllowance({ asset_type: AssetType.COLLATERAL });
    if (clobBalance?.balance) {
        return parseFloat(clobBalance.balance) / 1_000_000;
    }

    // 2. Fallback: raw on-chain USDC.e wallet balance
    const usdcEAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    const contract = new ethers.Contract(usdcEAddress, ["function balanceOf(address) view returns (uint256)"], provider);
    const balance = await contract.balanceOf(targetAddress);
    return parseFloat(ethers.formatUnits(balance, 6));
}
```

### Impact

* **Data integrity**: 100% automated trade resolution — local CSV intermediaries removed.
* **Latency floor**: State checks reduced from **11 minutes** to **under 5 seconds**, a **99.2%** reduction.
* **Scanner coupling**: `daily-scanner.ts` invokes `SyncService` at scan start so bankroll and pending-bet state are fresh before pillar evaluation runs.

---

### [13] Macro Regime Telemetry & Psychometric Circuit Breakers

> **discipline:** `Quantitative Engineering & Microstructure` // **type:** `strategic` &nbsp;|&nbsp; **telemetry:** `daemon: macro-regime-daemon.ts` &nbsp;|&nbsp; **dossier_id:** [`bodhi-macro-regime-daemon`](https://www.flocanolabs.com/flocanolabs/case-studies)

*league volatility index and slump mode stake throttling*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **rolling_window** | `3 days` |
| **regime_alert_threshold** | `< 0.5 lead changes` |
| **slump_stake_reduction** | `50%` |
| **baseline_volatility** | `~1.8 / slate` |

### Regime-Aware Capital Safeguards

Quantitative sports strategies decay during flatlined volatility regimes — mid-season dips when weather variance spikes or fatigued bullpens generate unpredictable late-inning flips. Operating at full unit size through these periods risks severe drawdowns. Bodhi implements two automated circuit breakers: a **macro telemetry daemon** for league-wide volatility and a **psychometric slump detector** for personal losing streaks.

### Macro Regime Daemon

`macro-regime-daemon.ts` ingests completed MLB box scores via the ESPN scoreboard API, counts **7th-inning-or-later lead changes** per slate, and maintains a rolling 3-day history in `macro_regime_state.json`. When the rolling average drops below `0.5` (baseline healthy state: ~1.8), the daemon fires a `REGIME_FLATLINED` Telegram alert advising percentage-based risk reduction:

```typescript
const ALERT_THRESHOLD = 0.5;

// Count lead changes in innings 7+
if (newLeader !== currentLeader && currentLeader !== 'TIE' && newLeader !== 'TIE') {
    if (i >= 6) lateInningLeadChanges++;
}

if (state.history.length === 3 && rollingAvg < ALERT_THRESHOLD) {
    await sendTelegramAlert(
        `🚨 *REGIME_FLATLINED* 🚨\n3-Day Rolling Avg: *${rollingAvg.toFixed(2)}*\nReduce unit sizing. Avoid trailing-favorite angles.`,
        'Markdown'
    );
}
```

### Psychometric Slump Mode

`BodhiPrism.checkSlump()` evaluates the last 5 settled bets in Supabase. If the trader has **3 consecutive losses** or **4 losses in the last 5**, the system enters Slump Mode and throttles all model-suggested stakes by **50%** (`multiplier: 0.5`):

```typescript
const last3Losses = recentBets.slice(0, 3).every(b => b.result === 'loss');
const last5Slump = recentBets.length === 5 && lossCount >= 4;

if (last3Losses || last5Slump) {
    return { isSlump: true, multiplier: 0.5, reason: "SLUMP DETECTED: Stakes throttled by 50%." };
}
```

The macro daemon catches **environmental** regime shifts before they eat the bankroll; slump mode catches **personal** variance clusters — together they remove discretionary tilt from sizing decisions.

---

### [14] Multi-Sport Scanner Pipeline & Bodhi Prism Agent Facade

> **discipline:** `Cognitive AI & Multi-Agent Swarms` // **type:** `technical` &nbsp;|&nbsp; **telemetry:** `sports_engines: 5` &nbsp;|&nbsp; **dossier_id:** [`bodhi-scanner-prism`](https://www.flocanolabs.com/flocanolabs/case-studies)

*five-league ingestion through a unified agent interface*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **concurrent_sport_engines** | `5` |
| **pillar_analyzers** | `5 sport-specific` |
| **scan_output** | `scan-results.json` |
| **ev_confidence_floor** | `60%` |

### Bodhi Scanner Execution Pipeline

The **Bodhi Scanner** (`daily-scanner.ts`) is the automated entrypoint for discovering and evaluating +EV opportunities across Polymarket sports markets. Each invocation runs a deterministic sequence:

```
Start Scan → Sync Live Bets & Bankroll → Fetch Sports Slate
→ Fetch Traditional Odds & CLOB Markets → Resolve Matchups to Conditions
→ Run Pillar Analyzer per Game → Check Circuit Breaker → Export scan-results.json
```

### Multi-Sport Data Ingestion

The scanner fetches schedule, lineup, and roster data concurrently across five sport-specific engines:

| Engine | Data Ingested |
| :--- | :--- |
| **MLB** | Pitching matchups, daily lineups, platoon splits, bullpen fatigue, hot hitter lists |
| **NHL** | Goalie SV%/GAA matchups, team standings |
| **NBA** | Team form, rosters, schedules |
| **MMA** | Card lineups, location, fighter metrics |
| **KBO** | Starting pitchers, team stats, linescores |

### Market Resolution & Pillar Routing

For each retrieved matchup, the scanner queries active sports markets from the Polymarket Gamma API. Mascot-based fuzzy matching resolves team names in market question text (e.g. "Marlins" vs "Angels"), with a `getMarketByTeams` fallback. Matched games route to the corresponding sport-specific `PillarAnalyzer` for three-pillar confidence scoring.

### Bodhi Prism: Unified Agent Facade

`BodhiPrism` collapses isolated scripts and analyzer classes into a single clarity layer for autonomous AI agents:

```typescript
export class BodhiPrism {
    async scanMLB(date: string, bankroll: number = 464) { /* schedule → pillar → filter ≥60% */ }
    async scanNHL(date: string, bankroll: number = 464) { /* goalie stats → pillar → filter ≥60% */ }
    async getUserState() { /* bankroll + performance from Supabase */ }
    async analyzeBiases() { /* chase-win / overconfidence detection */ }
    async checkSlump() { /* 50% stake throttle on losing streaks */ }
    async recordBet(entry: BetLogEntry) { /* psychometric logging to Supabase */ }
}
```

Agents call Prism methods instead of invoking scripts directly — scanning, bankroll state, bias analysis, circuit breakers, and bet logging share one interface.

---

### [15] MLB Temporal Replay & Polymarket Historical Index

> **discipline:** `Quantitative Engineering & Microstructure` // **type:** `technical` &nbsp;|&nbsp; **telemetry:** `games: 5107` &nbsp;|&nbsp; **dossier_id:** [`bodhi-mlb-temporal-replay`](https://www.flocanolabs.com/flocanolabs/case-studies)

*5,107-game no-lookahead backtest with 98.4% closed-market match rate*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **games_replayed** | `5,107` |
| **2025_poly_match_rate** | `98.4%` |
| **fast_mode_speedup** | `5–10×` |
| **grading_metric** | `binary W/L` |

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

### [16] Signal vs Execution & Slate Concentration

> **discipline:** `Quantitative Engineering & Microstructure` // **type:** `strategic` &nbsp;|&nbsp; **telemetry:** `all_wr: 60.0%` &nbsp;|&nbsp; **dossier_id:** [`bodhi-signal-concentration`](https://www.flocanolabs.com/flocanolabs/case-studies)

*full firehose vs top-5 / top-3 / top-1 daily filters*

| Telemetry Metric | Empirical Value |
|:---|:---|
| **all_picks_WR** | `60.0%` |
| **top5_per_day_WR** | `63.6%` |
| **top1_per_day_WR** | `62.6%` |
| **top1_tradable_WR** | `66.0%` |

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

## 🏛️ Sovereign Attribution & Portfolio

Bet Bodhi is an autonomous quantitative trading infrastructure designed, engineered, and deployed by **Nicholas MacAskill** under **Flocano Labs**.

* **Executive Portfolio & Engineering Practice:**  
  👉 [https://nicholasmacaskill.com](https://nicholasmacaskill.com)

* **Flocano Labs Applied R&D Forge:**  
  👉 [https://flocanolabs.com](https://flocanolabs.com)

* **Flocano Labs Dossiers & Whitepapers:**  
  👉 [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies)

---

*© 2026 Nicholas MacAskill. All rights reserved. Bet Bodhi is a sovereign quantitative research system.*
