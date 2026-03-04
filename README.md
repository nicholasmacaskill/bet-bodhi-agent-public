# Bet Bodhi — Autonomous AI Betting Agent

> *The transition from a passive dashboard to a proactive Guardian. From gambling to mastery through Agentic Enlightenment.*

Bet Bodhi is an autonomous AI agent designed for sports betting self-mastery. Unlike traditional SaaS platforms, Bet Bodhi doesn't wait for you; it scans the world, monitors your psychological state, and intervenes in real-time to prevent biased decision-making.

---

## 📋 Table of Contents
- [🆕 The Agentic Pivot](#-the-agentic-pivot)
- [🤖 Agent Capabilities](#-agent-capabilities)
- [💎 The Bodhi Prism](#-the-bodhi-prism)
- [🧠 Psychometric Guardian](#-psychometric-guardian)
- [🏛️ The Eight Pillars](#-the-eight-pillars)
- [🚀 Recent Work Completed](#-recent-work-completed)
- [🚀 Getting Started](#-getting-started)
- [📁 Project Structure](#-project-structure)
- [ Scripts Reference](#-scripts-reference)

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

Bodhi tracks your "**Eight Pillar**" health in real-time:

### `motivation_tag`
- `bodhi_signal`: Clean engine output.
- `chase_win`: Bias detection after a recent win.
- `gut_feel`: Low-signal narrative impulse.

### The 2-Hour Rule
The agent enforces a strictly monitored "Cooling Off" period. Any bet placed within 120 minutes of kickoff is flagged as high-variance "noise" rather than technical "signal."

---

## 🏛️ The Eight Pillars

Bet Bodhi evaluates every matchup through a unified **Eight Pillar Framework** to ensure a +EV edge and psychological stability:

1.  **Technical (Sport/Performance):** Deep-dive efficiency metrics, roster strength, and statistical mismatches (e.g., Strike Rate in MMA or SV% in NHL).
2.  **Seasonal (Trend):** Analyzing mid-season fatigue, rest advantages, and historical trend lines.
3.  **Technical (Bookies):** Identifying market mispricings where the "Real Probability" deviates from the sportsbook odds.
4.  **Psychological (Motivation):** Factoring in roster battles (Spring Training), revenge narratives, and "must-win" scenarios for the players.
5.  **Seasonal (Environment):** Venue-specific factors such as altitude in Mexico City (MMA) or dry air in the Cactus League (MLB).
6.  **Technical (Bankroll/Prism):** Mathematical sizing based on Kelly Criterion principles to ensure long-term sustainability.
7.  **Psychometric (Guardian):** The anti-bias layer that monitors the human bettor for tilt, FOMO, or chase-winning behaviors.
8.  **Physiological (Biometric/Tilt):** Real-time monitoring of HRV (Heart Rate Variability) and Resting Heart Rate (RHR) to detect physiological stress and prevent emotional "tilt" decision-making.

---

## 🚀 Recent Work Completed (March 2026)

-   **Multi-Sport "Pillar" Engines:** Full integration of NBA, NHL, and MMA analytical models into the main scanner.
-   **NHL Goalie Precision:** Implemented a dedicated goalie matchup engine that cross-references SV% and GAA against opponent offensive volume.
-   **Optimized CLI Experience:** Created the `./run` shortcut for "Signal-First" scanning, allowing for instant +EV detection without scrolling.
-   **MMA Altitude Modeling:** Added environmental performance degradation factors for high-altitude cards (UFC Mexico City).
-   **Bug Fixes & Stability:** Resolved rendering crashes in the goalie display and improved data hydration for MLB Spring Training lineups.

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
# Full Today's Scan
./run

# Watch Mode (updates every 15 min)
./run --watch

# Check a Specific Date
./run --date 2026-03-05
```

---

## 📁 Project Structure

```
bet-bodhi/
├── run                      # CLI Shortcut
├── src/lib/agent/
│   ├── bodhi-agent.ts       # Central Agent logic & "Consciousness"
│   └── prism.ts             # Clarity Layer for analysis & refracting logic
├── src/lib/                 # Core domain logic
│   ├── pillar-analyzer.ts   # Base MLB modeling
│   ├── nhl-pillar-analyzer.ts
│   ├── mma-pillar-analyzer.ts
│   ├── nba-pillar-analyzer.ts
│   └── bet-logger.ts        # Psychometric tracking
└── scripts/                 # Standalone script commands
    └── daily-scanner.ts     # The main Bodhi engine
```

---

## 📜 Scripts Reference
- `./run`: The primary interface for current market analysis.
- `scripts/bias-report.ts`: Weekly psychometric audit of your betting behavior.
- `scripts/underdog-report.ts`: Deep dive into high-value ML underdogs.

---

*Creator: [@nicholasmacaskill](https://github.com/nicholasmacaskill) — Moving from gambling to mastery via AI Agents.*
