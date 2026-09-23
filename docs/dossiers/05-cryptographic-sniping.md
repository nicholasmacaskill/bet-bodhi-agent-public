# [Dossier 05] Cryptographic Sniping & Infrastructure Upgrades

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Web3 Primitives & Cryptographic Routing` // **Type:** `technical` &nbsp;|&nbsp; **Date:** `2026-07-17`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *active maker/taker execution*

**Executive Summary:** Overhauled the SX Bet API into an active Taker utilizing EIP-712 signature matching and modernized the Azuro execution module to support V3 subgraphs.

- **Telemetry:** `mode: active_taker // protocol: sbet+azuro // max_risk: 100_USDC`
- **Tech Stack:** `EIP-712`, `@sx-bet/sportx-js`, `GraphQL`, `Azuro Protocol V3`, `Active Taker Sniping`, `Polygon RPC`, `Hardcoded Risk Ceilings`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **cryptographic_standard** | `EIP-712` |
| **native_risk_ceiling** | `$100` |

## Technical Architecture & Findings

### 1. Transforming SX Bet into an Active Sniper (CLOB vs AMM)
Unlike venues such as Azuro or Dexsport which use passive Liquidity Pools (AMMs), SX Bet operates as a peer-to-peer Central Limit Order Book (CLOB). To execute on SX Bet, Bodhi cannot simply interact with a pool contract; it must actively hunt and fill specific cryptographically-signed Maker orders.

Because SX Bet requires this complex Maker/Taker cryptographic handshake, we integrated the official \`@sx-bet/sportx-js\` SDK. We rewrote the orderbook parser to capture the entire raw Maker order—including the counterparty's EIP-712 cryptographic signature. We then built the \`executeSnipe\` function to generate a matching Taker signature, format the payload, and submit both signatures natively to the Polygon blockchain for smart contract verification (with a hardcoded risk ceiling to protect downside).

### 2. Azuro Protocol V3 Infrastructure Upgrade
To ensure Azuro was a viable execution venue, we modernized the \`AzuroApi\`. The protocol recently deprecated its older data structures in favor of a new V3 subgraph architecture. We rewrote the GraphQL queries to accommodate these schema changes—specifically engineering workarounds for the removal of the traditional status field by implementing time-based filtering (\`startsAt\`) and mapping sport-specific slugs. We also secured the connection by integrating a dedicated Azuro Developer API token into the environment, fully authorizing Bodhi to read live orderbooks and submit bets on-chain.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
