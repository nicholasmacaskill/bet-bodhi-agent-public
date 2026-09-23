# [Dossier 06] The Telegram Sentinel & Bayesian Risk

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Quantitative Engineering & Microstructure` // **Type:** `strategic` &nbsp;|&nbsp; **Date:** `2026-07-17`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *one-tap execution & risk throttling*

**Executive Summary:** Built a fully interactive Telegram execution terminal that pairs cryptographic payload caching with sentiment-adjusted Kelly risk sizing.

- **Telemetry:** `interface: telegram_bot // payload_state: latest_picks.json // slippage_protection: native`
- **Tech Stack:** `Telegram Bot API`, `Node.js`, `JSON State`, `Bayesian Logic`, `Fractional Kelly Sizing`, `Sentiment Guard`, `One-Tap Execution`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **time_to_execute** | `<1_second` |
| **sentiment_risk_throttle** | `0.5x (stressed)` |

## Technical Architecture & Findings

### 1. Unified On-Chain Execution via Telegram
With all venues wired up, we built a fully interactive Telegram execution pipeline to control them. When a nightly scan completes, Bodhi generates a report that dynamically lists the exact execution price for every available platform, visibly highlighting the absolute best price across the ecosystem with a gold medal (🥇). 

Crucially, the scanner saves the full cryptographic payloads (the raw order hashes and API data) into a local \`latest_picks.json\` state file. The user can simply send the \`/pick best\` command. The moment that command is sent, the bot routes the saved payload through the Multi-DEX Router, and submits the transaction directly to the correct blockchain. Smart contract slippage protection guarantees native security against stale odds.

### 2. Sentiment-Adjusted Kelly Sizing
Bodhi doesn't just tell you where to execute, it calculates exactly how much capital to deploy based on real-time on-chain data. Before generating the report, Bodhi natively checks the live USDC balance. It then uses a Fractional Kelly Criterion formula to calculate a precise stake based on the edge. 

This mathematical sizing is dynamically throttled by a psychological Sentiment Guard built into the Telegram bot. If the user reports feeling "stressed" with a low calmness score, Bodhi's Bayesian engine applies a risk multiplier (e.g., 0.5x), automatically cutting the Kelly-suggested execution stake in half to protect the bankroll from emotional variance.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
