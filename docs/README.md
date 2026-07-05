# 🧠 Bet Bodhi: Sovereign AI Trading Agent

Welcome to the **Bet Bodhi** project repository. Bodhi has evolved from a passive scanning script into a **Sovereign AI Trading Agent** and **Arbitrage Infrastructure**. 

This documentation covers the decoupled system architecture, the integration with the Polymarket blockchain CLOB (Central Limit Order Book), and the native OS-level execution mechanics.

---

## 📖 Core Architecture

Bodhi is designed to operate autonomously, with high resilience against upstream API changes and network latency. The architecture is split into decoupled background daemons and a front-end intelligence layer.

### 1. [Sovereign Execution Daemons](SCANNER_ARCHITECTURE.md)
Bodhi does not rely on active terminal windows. It is embedded into the OS via native `launchd` background services:
- **`com.betbodhi.arbscanner`**: Continuously monitors the Polymarket CLOB vs. sharp bookies for alpha.
- **`com.betbodhi.telegrambot`**: The decoupled communication layer handling chat commands.
- **`com.betbodhi.pnlsync`**: A self-healing background job that ingests blockchain data into a local JSON cache, eliminating interactive lag.

### 2. [Web3 & Polymarket CLOB Integration](POLYMARKET_INTEGRATION.md)
Polymarket's strict bot-mitigation API checks are bypassed locally. The agent extracts permanent cryptographic L2 keys from authenticated browser storage, allowing it to seamlessly authenticate and fetch order books and limit fills directly from Polygon smart contracts.

### 3. [OpenRouter Intelligence Layer](OPTIMIZATIONS.md)
Bodhi uses **Claude Sonnet** via OpenRouter for advanced reasoning. By decoupling the LLM context generation from synchronous blockchain pulls (via the `latest_pnl.json` data lake), Bodhi provides instantaneous, penny-accurate P&L and market sentiment analysis via the Telegram `/ask` command without risking API timeouts.

### 4. [Mathematical & Model Parameters](PARAMETERS.md)
Detailed breakdown of the Pillar Analysis model, including technical weights, seasonal/environmental adjustments, veto overrides, and Kelly-derived sizing.

### 5. [Macro Regime Shift Blueprint](MACRO_REGIME_SHIFT_BLUEPRINT.md)
Quantitative telemetry and data blueprints to track Strategy Fit Metrics (SFM), volatility indices, and Closing Line Value (CLV) drifts.

### 6. [Engineering Case Studies](ENGINEERING_CASE_STUDIES.md)
Technical summaries of our work on LLM cost optimization, low-latency Web3 integration adapters, and automated safety circuit breakers.

---

## 🚀 Operations & Diagnostics

Because Bodhi runs as a Sovereign OS daemon, operations are handled via `launchctl` rather than standard Node scripts.

**Check Daemon Status:**
```bash
launchctl list | grep betbodhi
```

**Restart the Neural Interface (Telegram Bot):**
```bash
launchctl unload ~/Library/LaunchAgents/com.betbodhi.telegrambot.plist
launchctl load ~/Library/LaunchAgents/com.betbodhi.telegrambot.plist
```

**Manually Sync Blockchain P&L:**
*(Note: The system automatically syncs every 15 minutes in the background)*
```bash
npx tsx scripts/calculate-live-pnl.ts
```
