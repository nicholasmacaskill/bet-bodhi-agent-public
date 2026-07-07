# 📊 Model Parameters & Evaluation Framework

The Bodhi trading model is built on a **Three-Pillar Evaluation Framework**. It combines statistical sport modeling, environmental factors, and market pricing to determine the objective edge and the appropriate sizing.

---

## 🏛️ The Three Pillars

Every game is scored on three distinct pillars, each scaled from `0` to `10`:

### 1. Technical Sport Pillar
Evaluates raw matchup strength based on active rosters, starting lineups, and situational stats:
* **Starting Pitcher / Goalie Quality**: Leverages composite indices (e.g. 70/30 blend of last-season ERA + Spring Training, or active season ERA once sample size exceeds 15 innings).
* **Lineup Strength**: Counts of Elite Bats and Hot Bats (72-hour heaters).
* **Late-Inning Statistics**: Bullpen ERA and 7th+ inning OPS mismatch evaluation.
* **Platoon Advantages**: Splitting pitcher metrics against left/right-handed heavy lineups.
* **Team Momentum**: Streak tracking and Last 10 (L10) wins.

### 2. Seasonal & Environmental Pillar
Adapts calculations to context, physical venues, and meteorological data:
* **Venue Adjustments**: Hitter/Pitcher friendly park boosts (e.g. Coors Field hitter boost of `+2.5`, Petco Park pitcher boost of `+1.5`).
* **Atmospheric Factors**: Cactus League dry-air offense uplift, or negative adjustments for cold-weather spring slates.
* **Weather Flags**: Dynamic warning triggers if wind speeds exceed 20mph blowing inward.

### 3. Technical Bookies / Web3 Market Pillar
Evaluates market discrepancies and calculates Expected Value (EV):
* **Consensus Comparison**: Checks traditional bookmakers (e.g. DraftKings via Odds API) and computes implied probability.
* **Polymarket Crowd Discrepancy**: Evaluates current Polymarket share price ($0.00 to $1.00) against Bodhi's True Probability.
* **Expected Value (EV)** is calculated as:
  $$\text{EV} = \text{Bodhi Probability} - \text{Polymarket Share Price}$$
* **Favorite Tax**: If market price exceeds a specified threshold, the model triggers a stricter minimum EV edge threshold to protect capital from overvalued favorites.

---

## 🎚️ Weighting Parameters (MLB Example)

| Factor | Weight | Impact |
| :--- | :--- | :--- |
| **Elite Starting Pitcher** | `+[REDACTED]` | Heavy boost to pitching-dominated slates |
| **Elite Bat (Roster)** | `+[REDACTED]` | Baseline hitter strength adjustment |
| **Hot Bat (72h heater)** | `+[REDACTED]` | Short-term momentum multiplier |
| **Weak Starting Pitcher** | `-[REDACTED]` | Penalty for vulnerable arms |
| **Platoon Exploits** | `+[REDACTED]` | Bonus if hitter matchup matches pitcher's weak split |
| **Bullpen Fatigue Penalty** | `up to -[REDACTED]` | Penalty if bullpen threw multiple pitches yesterday |

---

## 🚫 Safeguards & Veto Rules

The model is highly risk-averse. Even if a bet is flagged as $+EV$, the scanner will issue a **VETO** (neutralizing the recommendation) in the following cases:
1. **Elite Opponent**: Own model favors Team A, but Team B starts an elite pitcher.
2. **Vulnerable Starter**: Own model favors Team A, but Team A's starting pitcher is graded as weak.
3. **Agent Memory Burn List**: Automatically fades teams that have generated poor historical performance ($<-50\%$ ROI over at least 2 trades) inside our Supabase memory logs.

### 🔍 Kill Criteria
Recommendations output specific conditions to abort executing the trade:
* Expected starter scratch or change to opener.
* Consensus reversal (Crowd price shifts below 45%).
* Wind conditions exceeding threshold.

---

## 💰 Capital Allocation & Sizing

Stake sizing scales dynamically with the calculated **Objective Confidence** (average of the three pillars multiplied by 10):

$$\text{Confidence} = \frac{\text{Technical Sport} + \text{Seasonal} + \text{Technical Bookies}}{30} \times 100$$

### Sizing Scale:
* **$\ge [REDACTED]\%$ Confidence**: Aggressive Stake (`[REDACTED]%` of bankroll)
* **$[REDACTED]\% - [REDACTED]\%$ Confidence**: Standard Stake (`[REDACTED]%` of bankroll)
* **$[REDACTED]\% - [REDACTED]\%$ Confidence**: Caution Stake (`[REDACTED]%` of bankroll)
* **$<[REDACTED]\%$ Confidence**: Zero Stake (`0.0%`)

> [!IMPORTANT]
> **Strict League Thresholds**: In NHL and NBA, variance is structurally higher. The model applies a strict confidence floor of **[REDACTED]** for these sports. Any recommendation scoring under this threshold is automatically filtered out as a `PASS`.
