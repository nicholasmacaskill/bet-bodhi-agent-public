# Bet Bodhi — Web3 EV Arbitrage Engine v4.0

> *The transition from a passive dashboard to a proactive Guardian. From traditional sportsbooks to Web3 Arbitrage.*

Bet Bodhi is an autonomous AI agent designed for high-value **Web3 EV Discovery**. By dropping reliance on legacy bookmakers, it continuously scans the Polymarket Gamma API and SX Bet liquidity, returning Arbitrage opportunities directly against the **Seven Pillars** internal probabilities.

---

## 🏛️ The Seven Pillars (v4.0)

Every game is passed through the `BodhiAnalyzer` which scores seven specific dimensions from 0 to 10:

1.  **Technical (Sport)**: Deep statistical analysis of player/team performance metrics (GFA, GAA, SV%, xERA).
2.  **Seasonal (Sport)**: Environmental factors including Cactus/Grapefruit logic and real-time wind speed validation.
3.  **Psychological (Players)**: Situational intangibles (Road Warrior streaks, Momentum Surges, Roster Battles).
4.  **Technical (Bookies)**: **The Edge Layer.** Compares Bodhi True Prob% to Web3 crowd pricing.
5.  **Technical (Bankroll)**: Safety circuit breaker that throttles stake sizes if depth is in the "caution range."
6.  **Psychological (Bettor)**: Factors in **User Mood & Sentiment**. If the agent detects tilt or overconfidence, sizes are automatically cut by 50%.
7.  **Physiological/Spiritual**: Measures the "Clarity of Signal"—ensuring the decision is free of impulse.

---

## 🧠 Psychometric Guardian & Sentiment Tracking

Bet Bodhi treats the bettor as a component of the system. We've implemented a **Sentiment Tracker** to mitigate human bias:

### 🏷️ Motivation Tagging
Every log entry requires a `MotivationTag` to identify the "Why":
- `bodhi_signal`: Clean, engine-generated play.
- `chase_win`: Placed after a recent win (Momentum Bias detection).
- `gut_feel`: Impulse/Narrative detection.
- `analysis`: Long-form research committed 2+ hours in advance.

### 📊 Real-time Bias Detection
The `analyzeBiases()` module scan your history for:
- **Complacency/Overconfidence**: Increasing stakes by >50% immediately after a win.
- **The Rush Zone**: Warning if a bet is placed <30 mins before kickoff (The Bodhi 2-Hour Rule).

---

## 📈 The Evolution & Optimization Story

### Phase 1: The Legacy Era
Bodhi began by analyzing DraftKings/FanDuel lines. We quickly realized that the "vig" and sharp market efficiency made sustainable +EV play nearly impossible for solo agents.

### Phase 2: The Web3 Pivot
We shifted to **Polymarket**. The decentralization of liquidity creates massive "pockets" of inefficiency—especially in low-volume sports where the "crowd" reacts slowly to breaking team news.

### Phase 3: Live Sync Optimization
We replaced static database balances with **Live On-Chain Sync**. By querying the Polygon network directly for USDC.e balances, we ensured that the `Bankroll Pillar` is always working with $1 resolution.

---

## 🛠️ Technical Challenges Overcome

### 1. The "Hallucination" Gate
**Problem**: The model would occasionally recommend a play based on an "Elite Pitcher" who was actually on the IL or scratched.
**Solution**: Built the **Hallucination Hard-Validation** layer. The agent now pulls the official active roster (`mlbApi.getTeamRoster`) and kills any signal where the star player isn't physically present.

### 2. High-Altitude Scoring Noise
**Problem**: Spring Training games in Arizona (Cactus League) were throwing off the `Seasonal Pillar` due to dry air.
**Solution**: Integrated real-time wind speed and humidity overrides to "veto" high-scoring leans if weather conditions neutralize the altitude edge.

### 3. Execution Slippage
**Problem**: By the time a user manually placed a bet, the Polymarket price had moved.
**Solution**: Built a CLI-based execution bridge in `place-bet.ts` that calculates slippage-adjusted limit orders, acting like a market order but with strict price protection.

---

## 🤖 The Bodhi Toolbox

| Layer | Component | Function |
| :--- | :--- | :--- |
| **Ingestion** | `MLBApi`, `NHLApi`, `SXBetApi` | Real-time state collection. |
| **Logic** | `NHLPillarAnalyzer` | The multi-pillar scoring brain. |
| **Guardian** | `BodhiAgent` | Monitors interventions and psych alignment. |
| **Log** | `bet-logger.ts` | Captures emotional and physiological state. |

---

## 🚀 Awakening the Agent

```bash
# Full Daily Scan (All Sports)
npx tsx scripts/daily-scanner.ts --mood neutral --calmness 8
```

*Creator: [@nicholasmacaskill](https://github.com/nicholasmacaskill) — Moving from gambling to mastery via AI Agents.*
