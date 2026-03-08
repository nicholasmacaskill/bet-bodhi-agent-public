# Bet Bodhi — Web3 EV Arbitrage Engine

> *The transition from a passive dashboard to a proactive Guardian. From traditional sportsbooks to Web3 Arbitrage.*

Bet Bodhi is an autonomous AI agent designed for high-value Polymarket EV discovery. Unlike traditional SaaS platforms, Bet Bodhi drops reliance on legacy bookmakers, continuously scanning the Web3 Gamma API and returning Arbitrage opportunities directly against Bodhi's internal sports probabilities.

---

## 📋 Table of Contents
- [🆕 The Agentic Pivot](#-the-agentic-pivot)
- [🤖 Agent Capabilities](#-agent-capabilities)
- [⚙️ The Bodhi Toolbox](#️-the-bodhi-toolbox)
- [🧠 Psychometric Guardian](#-psychometric-guardian)
- [✨ Bodhi Prism v3.0 (New!)](#-bodhi-prism-v30-new)
- [🏛️ The Seven Pillars](#️-the-seven-pillars)
- [🚀 Getting Started](#-getting-started)
- [📁 Project Structure](#-project-structure)
- [🛠️ Tech Stack](#️-tech-stack)
- [📜 Scripts Reference](#-scripts-reference)
- [🤝 Contributing](#-contributing)

---

## 🆕 The Polymarket Pivot

In March 2026, Bet Bodhi pivoted heavily into **Web3 Expected Value (EV) Arbitrage**.

**The Bookmaker Model (Old):** Bodhi analyzed lines from DraftKings and FanDuel, fighting massive vig and sharp money.
**The Polymarket Model (New):** Bodhi calculates internal machine-learned confidence scores and explicitly compares them to Web3 crowd probabilities (share prices) on Polymarket. Any delta > 3% is flagged as +EV Arbitrage.

---

## 🤖 Engine Capabilities

### 🌅 Polymarket Gamma Scan
The engine runs a massive search across Polymarket's Gamma API for daily MLB, NHL, NBA, and MMA markets. It cross-refracts Web3 share pricing against Bodhi's internal Pillars to find mispriced opportunities.

### 🛡️ Guardian Interventions
The agent monitors your timing. If it detects a "Pre-Game Rush" (betting < 30 mins before kickoff), it fires an intervention challenge to ensure you aren't acting on impulse.

### 📓 Internal Consciousness
Under the hood, the agent logs its own "stream of consciousness" in Supabase (`agent_internal_logs`). It records its reasoning for every recommendation and intervention, allowing for long-term agentic alignment.

---

## 💎 The Bodhi Prism

The agent's clarity layer. A unified medium for refracting sports data and your history. Software is not a tool; it is glass.

| Prism Function | Capability |
| :--- | :--- |
| **`daily-scanner`** | Master orchestration script. Scrapes all 4 major sports and directly calculates Web3 Arbitrage. |
| **`PolymarketApi`** | High-throughput Gamma API scraper isolating daily games by substring heuristics. |
| **`PillarAnalyzers`** | Mathematical scoring layers that calculate EV = (Bodhi Prob%) - (Polymarket Share%). |

---

## ✨ Bodhi Prism v3.0 (Polymarket Arbitrage)

In March 2026, the Prism was upgraded to v3.0, introducing dynamic EV capabilities:

### 1. Web3 Arbitrage Architecture
Bodhi no longer relies on static vig-adjusted odds. It directly compares its analytical output to Polymarket tokens, identifying when the "crowd" is wildly mispricing an elite offense or a weak pitcher.

### 2. High Conviction Edge Detection
When the Polymarket EV (`Bodhi % - Poly %`) exceeds `10%`, the scanner automatically outputs a `BODHI RADAR: MASSIVE WEB3 ARBITRAGE SIGNAL`.

---

## 🧠 Psychometric Guardian

Bodhi tracks your "Seven Pillar" health in real-time:

### `motivation_tag`
- `bodhi_signal`: Clean engine output.
- `chase_win`: Bias detection after a recent win.
- `gut_feel`: Low-signal narrative impulse.

### The 2-Hour Rule
The agent enforces a strictly monitored "Cooling Off" period. Any bet placed within 120 minutes of kickoff is flagged as high-variance "noise" rather than technical "signal."

---

## 🚀 Getting Started

### Installation
```bash
git clone https://github.com/nicholasmacaskill/bet-bodhi.git
cd bet-bodhi
npm install
```

### Awakening the Agent
```bash
npx tsx -e "import { BodhiAgent } from './src/lib/agent/bodhi-agent'; new BodhiAgent().awaken('2026-03-01')"
```

---

## 📁 Project Structure

```
bet-bodhi/
├── src/lib/agent/
│   ├── bodhi-agent.ts       # Central Agent logic & "Consciousness"
│   └── prism.ts             # Clarity Layer for analysis & refracting logic
├── src/lib/                 # Core domain logic
│   ├── pillar-analyzer.ts   # MLB strength modeling
│   ├── nhl-pillar-analyzer.ts
│   └── bet-logger.ts        # Psychometric tracking
└── scripts/                 # Standalone script commands
```

---

## 📜 Scripts Reference
- `scripts/analyze-march1.ts`: MLB Underdog Hunter
- `scripts/analyze-nhl-march1.ts`: NHL evening slate
- `scripts/bias-report.ts`: Weekly psychometric audit

---

*Creator: [@nicholasmacaskill](https://github.com/nicholasmacaskill) — Moving from gambling to mastery via AI Agents.*
