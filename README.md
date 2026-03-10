# Bet Bodhi — Web3 EV Arbitrage Engine v4.0

> *The transition from a passive dashboard to a proactive Guardian. From traditional sportsbooks to Web3 Arbitrage.*

Bet Bodhi is an autonomous AI agent designed for high-value **Web3 EV Discovery**. By dropping reliance on legacy bookmakers, it continuously scans the Polymarket Gamma API and SX Bet liquidity, returning Arbitrage opportunities directly against the **Seven Pillars** internal probabilities.

---

## 📋 Table of Contents
- [� The v4.0 Pivot](#-the-v40-pivot)
- [�🏛️ The Seven Pillars](#️-the-seven-pillars)
- [🧠 Psychometric Guardian](#-psychometric-guardian)
- [📈 Evolution & Optimizations](#-evolution--optimizations)
- [🛠️ Technical Challenges](#️-technical-challenges)
- [🤖 The Bodhi Toolbox](#-the-bodhi-toolbox)
- [🚀 Getting Started](#-getting-started)
- [📁 Project Structure](#-project-structure)
- [📜 Scripts Reference](#-scripts-reference)

---

## 🆕 The v4.0 Web3 Pivot

In March 2026, Bet Bodhi shifted heavily into **Web3 Expected Value (EV) Arbitrage**.

*   **The Legacy Model**: Analyzing DraftKings/FanDuel lines (fighting high vig and market efficiency).
*   **The Polymarket Model**: Calculating internal machine-learned confidence scores and explicitly comparing them to Web3 crowd probabilities (share prices). Any delta > 3% is flagged as **+EV Arbitrage**.

---

## 🏛️ The Seven Pillars (v4.0)

Every game is passed through the `BodhiAnalyzer` which scores seven specific dimensions from 0 to 10:

| Pillar | Focus Area | dimension |
| :--- | :--- | :--- |
| **1. Technical (Sport)** | Statistical | GFA, GAA, SV%, xERA, and Pitcher Archetypes. |
| **2. Seasonal (Sport)** | Environmental | Cactus/Grapefruit logic, real-time wind/humidity validation. |
| **3. Psych (Players)** | Situational | Road Warrior streaks, Momentum Surges, Roster Battles. |
| **4. Tech (Bookies)** | **The EDGE** | Bodhi True Prob% vs. Web3 Crowd Pricing. |
| **5. Tech (Bankroll)** | Safety | Circuit breaker that throttles stakes if balance is low. |
| **6. Psych (Bettor)** | **Sentiment** | Detection of Tilt, Complacency, or Overconfidence. |
| **7. Physiological** | Clarity | Resonance of the decision signal and ritual focus. |

---

## 🧠 Psychometric Guardian (Sentiment Tracking)

Bet Bodhi treats the bettor as a component of the system. We've implemented a **Sentiment Tracker** to mitigate human bias.

### `motivation_tag` — The *Why* Behind the Bet
| Tag | Meaning | Flag |
| :--- | :--- | :--- |
| `bodhi_signal` | Engine-generated, pre-committed pick | ✅ Clean |
| `analysis` | Researched 2+ hours before game | ✅ Clean |
| `line_value` | Spotted a specific market pricing error | ✅ Clean |
| `gut_feel` | Instinct / narrative / "feels right" | ⚠️ Tracked |
| `chase_win` | Placed after a recent win (Momentum Bias) | ⚠️ Monitored |

### The Bodhi 2-Hour Rule
> Bets placed within 120 minutes of kickoff fire a live ⚠️ warning. The agent enforces a "Cooling Off" period to ensure research-backed committing rather than gameday impulse.

---

## 📈 Evolution & Optimizations

### 1. From Legacy to Web3
We moved away from traditional sportsbooks to **Polymarket and SX Bet**. The decentralization of liquidity creates massive "pockets" of inefficiency that the scanner exploits.

### 2. Live On-Chain Sync
We replaced static balances with **Live Wallet Sync**. By querying the Polygon network directly for USDC.e balances, the `Bankroll Pillar` always works with 100% accuracy (currently synced at ~$412).

### 3. Execution Route Waterfall
The engine now automatically calculates the **Waterfall Arb**, choosing between Polymarket and SX Bet for the highest available EV route.

---

## 🛠️ Technical Challenges Overcome

### 🛡️ The "Hallucination" Gate
The model would occasionally recommendation a play based on an "Elite Pitcher" who was actually on the IL. We built a **Hard-Validation layer** that cross-references probable starters against the official active roster (`mlbApi.getTeamRoster`) before ingestion.

### 🏜️ High-Altitude Scoring Noise
Spring Training games in Arizona were throwing off seasonal scoring. We integrated real-time wind speed and humidity overrides to "veto" signals if weather conditions neutralized the statistical edge.

### 🏹 Execution Slippage
We built a CLI-based bridge in `place-bet.ts` that calculates slippage-adjusted limit orders, acting like a market order but with strict price protection.

---

## 🤖 The Bodhi Toolbox

| Layer | Component | Purpose |
| :--- | :--- | :--- |
| **Ingestion** | `MLBApi`, `NHLApi`, `SXBetApi` | Real-time state collection. |
| **Logic** | `NHLPillarAnalyzer` | The multi-pillar scoring brain. |
| **Guardian** | `BodhiAgent` | Monitors interventions and psych alignment. |
| **Log** | `bet-logger.ts` | Captures emotional and physiological state. |

---

## 🚀 Getting Started

```bash
# Installation
git clone https://github.com/nicholasmacaskill/bet-bodhi.git
npm install

# Awakening the Agent
npx tsx scripts/daily-scanner.ts --mood neutral --calmness 8
```

---

## 📁 Project Structure

```
bet-bodhi/
├── src/lib/agent/
│   ├── bodhi-agent.ts      # Central Agent logic & consciousness
│   └── prism.ts            # Clarity Layer for data refraction
├── src/lib/domain/         # Core analytical engines
│   ├── pillar-analyzer.ts  # Multi-sport scoring core
│   ├── nhl-pillar-analyzer.ts
│   └── bet-logger.ts       # Psychometric tracking
├── scripts/                # Standalone technical commands
│   ├── daily-scanner.ts    # Main Web3 Arb Hunter
│   └── place-bet.ts        # Automated execution bridge
└── supabase/               # SQL Migrations & Psychometric Logs
```

---

## 📜 Scripts Reference

- `scripts/daily-scanner.ts`: Daily Web3 Arbitrage across MLB, NHL, NBA.
- `scripts/place-bet.ts`: Automated execution with slippage protection.
- `scripts/bias-report.ts`: Weekly 🧠 Psychometric Audit.
- `scripts/verify-run-line.ts`: Real-time market state verification.

---

*Creator: [@nicholasmacaskill](https://github.com/nicholasmacaskill) — Moving from gambling to mastery via AI Agents.*
