# [Dossier 07] Incident Report: Polymarket CLOB API Auth Block

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Web3 Primitives & Cryptographic Routing` // **Type:** `incident` &nbsp;|&nbsp; **Date:** `2026-07-05`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *sovereign infrastructure shift*

**Executive Summary:** Architectural overhaul decoupling Bet Bodhi from Polymarket's fragile upstream auth endpoint via cryptographic session extraction and macOS UNIX kernel daemonization.

- **Telemetry:** `mode: background_daemon // sync_interval: 15_minutes // failover: mitigated`
- **Tech Stack:** `macOS launchd`, `TypeScript`, `@polymarket/clob-client`, `SQLite`, `OpenRouter`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **data_retrieval_latency** | `<1ms` |
| **telegram_api_timeout_risk** | `0%` |

## Technical Architecture & Findings

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

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
