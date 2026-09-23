# [Dossier 04] Multi-Chain Execution Abstraction

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Web3 Primitives & Cryptographic Routing` // **Type:** `technical` &nbsp;|&nbsp; **Date:** `2026-07-17`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *cross-chain liquidity routing & schema normalization*

**Executive Summary:** Abstracts away cross-chain complexity by dynamically routing execution payloads across Polygon, Gnosis, and Solana natively while normalizing fragmented API schemas.

- **Telemetry:** `networks: poly+gno+sol // gas_calc: dynamic // schema: normalized`
- **Tech Stack:** `Polygon`, `Gnosis Chain`, `Solana`, `Ethers.js v6`, `Multi-Chain Routing`, `Schema Normalization`, `RPC Node Failover`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **gas_overhead** | `<$0.01` |
| **manual_bridging** | `eliminated` |

## Technical Architecture & Findings

### 1. The Multi-Chain Execution Agent
Bodhi is not just a multi-DEX aggregator; it is a true Multi-Chain Execution Agent. To avoid the massive gas fees of Ethereum Mainnet, decentralized sportsbooks are spread across various alternative blockchains. SX Bet, Polymarket, and Dexsport execute on Polygon. Azuro operates on Gnosis Chain and Polygon. BetDEX executes entirely on Solana.

Bodhi completely abstracts away this cross-chain complexity. When an execution command is issued, Bodhi dynamically routes the cryptographic payload to the correct RPC node, calculates the fractional-cent gas fees automatically, and signs the transaction using your wallet credentials. The user achieves the best price across multiple blockchains without ever having to manually bridge funds or switch network configurations.

### 2. Universal Schema Normalization
Aggregating decentralized exchanges requires translating disparate data structures: Azuro uses GraphQL subgraphs, SX Bet uses REST APIs and EIP-712 hashes, Dexsport relies on AMM REST pools, and BetDEX uses standard JSON APIs. The \`IDexOddsResult\` interface acts as a universal translator, normalizing these wildly different schemas into a single, clean decimal format for real-time comparative analysis.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
