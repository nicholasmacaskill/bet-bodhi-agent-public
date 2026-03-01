# Bet Bodhi — Autonomous AI Betting Agent

> *The transition from a passive dashboard to a proactive Guardian. From gambling to mastery through Agentic Enlightenment.*

Bet Bodhi is an autonomous AI agent designed for sports betting self-mastery. Unlike traditional SaaS platforms, Bet Bodhi doesn't wait for you; it scans the world, monitors your psychological state, and intervenes in real-time to prevent biased decision-making.

---

## 📋 Table of Contents
- [🆕 The Agentic Pivot](#-the-agentic-pivot)
- [🤖 Agent Capabilities](#-agent-capabilities)
- [⚙️ The Bodhi Toolbox](#️-the-bodhi-toolbox)
- [🧠 Psychometric Guardian](#-psychometric-guardian)
- [🏛️ The Seven Pillars](#️-the-seven-pillars)
- [🚀 Getting Started](#-getting-started)
- [📁 Project Structure](#-project-structure)
- [🛠️ Tech Stack](#️-tech-stack)
- [📜 Scripts Reference](#-scripts-reference)
- [🤝 Contributing](#-contributing)

---

## 🆕 The Agentic Pivot

In March 2026, Bet Bodhi pivoted from a static SaaS tool to a **Proactive Agent Architecture**. 

**The SaaS Model (Old):** User logs in, looks at a chart, and wonders why they lost money.
**The Agent Model (New):** Bodhi "awakens" every morning, refracts the slate through its Prism, monitors for "chase_win" or "pre-game-rush" behaviors, and intervenes *before* you place a high-risk bet.

---

## 🤖 Agent Capabilities

### 🌅 Morning Awakening
The agent runs at sunrise to scan MLB, NHL, NBA, and MMA markets. It cross-refracts +EV opportunities with your current bankroll and psychological baseline through its technical Prism.

### 🛡️ Guardian Interventions
The agent monitors your timing. If it detects a "Pre-Game Rush" (betting < 30 mins before kickoff), it fires an intervention challenge to ensure you aren't acting on impulse.

### 📓 Internal Consciousness
Under the hood, the agent logs its own "stream of consciousness" in Supabase (`agent_internal_logs`). It records its reasoning for every recommendation and intervention, allowing for long-term agentic alignment.

---

## 💎 The Bodhi Prism

The agent's clarity layer. A unified medium for refracting sports data and your history. Software is not a tool; it is glass.

| Prism Function | Capability |
| :--- | :--- |
| **`scanMLB()` / `scanNHL()`** | Refracts market data through Pillar Analyzers to find mispriced underdogs. |
| **`recordBet()`** | Logs bets with automatic psychometric timing. |
| **`getUserState()`** | Provides clarity on bankroll and peak watermarks. |
| **`analyzeBiases()`** | Shines a light on recent history for complacency or loss-chasing. |

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
