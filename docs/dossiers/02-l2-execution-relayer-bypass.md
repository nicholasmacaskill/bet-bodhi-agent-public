# [Dossier 02] L2 Execution & Relayer Bypass

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Web3 Primitives & Cryptographic Routing` // **Type:** `technical` &nbsp;|&nbsp; **Date:** `2026-08-08`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *bypassing gasless UX abstractions & EIP-712 alignment*

**Executive Summary:** Corporate L2 platforms hide behind proprietary relayers and 'gasless' UI illusions to capture order flow. We dismantled the UX abstractions across SX Rollup and Polygon to build an unmediated, zero-friction execution pipeline.

- **Telemetry:** `status: resolved // execution: automated // bottlenecks: bypassed`
- **Tech Stack:** `Ethers.js v6`, `SX Rollup`, `Polygon CTF`, `Node.js`, `EIP-712 Permit`, `TokenTransferProxy`, `Arbitrum RPC`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **Execution Latency** | `<150ms` |
| **RPC Infrastructure** | `Dedicated Nodes` |
| **Gas Bypass** | `Proxy Exploitation` |

## Technical Architecture & Findings

### 1. The Gasless UI Trap
Modern Web3 platforms rely on proprietary relayers and 'gasless' UX to capture and lock in retail order flow. When we attempted to programmatically route arbitrage executions to SX Bet's v6 matching engine, the bot hit an immediate wall: \`INSUFFICIENT_FUNDS\`. The native SX token had been deprecated, yet standard smart contract interactions still demanded base fees.

The UI abstracted this reality via EIP-712 \`permit\` signatures. Instead of bending to the proprietary relayer, we reverse-engineered the UI flow, isolating the hidden \`TokenTransferProxy\`. By submitting a single manual transaction to permanently approve the proxy, we entirely bypassed the gas-heavy sequential \`approve\` requirements, achieving zero-friction execution.

### 2. DNS Rot and Hidden RPC Infrastructure
Decentralized execution is a myth if the RPC layer relies on fragile corporate DNS. The default Gelato endpoints for the Arbitrum-based SX Rollup were caught in an unrecoverable retry loop, crashing the Node.js process. Public alternatives aggressively throttled raw \`eth_call\` contract reads.

The solution wasn't to write retry logic—it was to find the ground truth. We scraped the network layer, uncovering a hidden, unthrottled node (\`rpc-rollup.sx.technology\`). By pinning our execution pipeline strictly to this endpoint, we collapsed structural latency and stabilized blockchain reads instantly.

### 3. EIP-712 Cryptographic Strictness
Polymarket's Conditional Token Framework (CTF) Exchange on Polygon relies on off-chain order matching secured by strict EIP-712 domain schemas. The slightest deviation in Chain ID or verifying contract addresses results in silent relayer rejection. We bypassed the fragile public infrastructure, built automated \`USDC.e\` allowance validation at the execution layer, and routed the payload through dedicated RPCs to guarantee our arbitrage logic executed before the public orderbook could react.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
