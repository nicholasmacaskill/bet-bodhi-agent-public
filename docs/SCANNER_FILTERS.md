# Bodhi Slate Scanning and Analysis Filter Specifications

This document details the filters, vetoes, and safeguards applied by the Bodhi analysis engine during game slate scanning and EV computation.

---

## 1. Value Play Selection Filters
For a matchup to be identified as an actionable **Value Play** (e.g. highlighted in reports or the Telegram picks feed), it must satisfy all of the following:
* **EV Threshold**: Expected Value ($EV$) must be $\ge 2.0\%$ (`polyEV >= 0.02`).
* **Active Direction**: A specific target team must be selected (`valueTeam` is defined and is not `'NEUTRAL'`).
* **Veto Status**: The match must pass all automated veto checks (detailed below). Vetoed matches are marked as `PASS` and their target pick is set to `NEUTRAL` or `undefined`.

---

## 2. Automated Veto Logic
The analysis engine enforces strict technical and performance vetoes to safeguard capital against low-probability scenarios:

### Pitcher-Based Vetoes
Even if a team shows positive EV, the pick is vetoed under the following matchups:
* **Elite Opponent**: Veto if target team is Home, but Away starting pitcher is **Elite**.
* **Elite Opponent**: Veto if target team is Away, but Home starting pitcher is **Elite**.
* **Weak Starter**: Veto if target team is Home, but Home starting pitcher is **Weak** (composite ERA $\ge 5.00$).
* **Weak Starter**: Veto if target team is Away, but Away starting pitcher is **Weak** (composite ERA $\ge 5.00$).

### Agent Memory Burn List Veto
* **Negative ROI Guard**: If the target team (`valueTeam`) has negative historical performance tracked in the agent's memory (ROI $< 0\%$), the engine vetoes the pick with the reason: `VETO: Agent Memory Burn List. [Team] has cost us historically ([ROI]% ROI).`

---

## 3. Team Form, Momentum, and Contextual Weights
The model computes an Alpha Score based on technical roster stats, adjusted by live situational dynamics:

### Hot Bats ("72h Heaters")
* **Rule**: If a starting lineup contains $\ge 2$ players on a 72h offensive heater (elevated hard-hit/barrel rates), the team receives an advantage boost.
* **Weight Factor**: `WEIGHT_HOT_BAT = 1.2` per hot bat (calibrated down from 2.0 to prevent over-inflation of alpha).
* **Mismatch Boost**: Extra bonus is applied if a team has $\ge 2$ hot bats *and* faces a weak opposing starting pitcher.
* **Report Text**: `⚡ Offensive Surge: [Count] players in the [Team] starting lineup are currently on a 72h 'heater' with elevated hard-hit rates, indicating a peak scoring window.`

### Team Momentum & Cold Streaks (Last 10 Games)
* **Surging Team Momentum**: If a team has won $\ge 7$ of their last 10 games, it receives a **+2.0** form bonus and is flagged with `🔥 Team Momentum`.
* **Cold Streak**: If a team has won $\le 3$ of their last 10 games, it receives a **-2.0** form penalty and is flagged with `🥶 Cold Streak` (acting as a risk factor).

### Series Context & Sweep Avoidance
* **Sweep Avoidance (Finale)**: If a team is down 2-0 or 3-0 in a series and playing the series finale, they receive a **+2.5** bonus (`WEIGHT_SWEEP_AVOID_FINALE = 2.5`).
* **Sweep Avoidance (Game 3)**: If a team is down 2-0 in a 4-game series and playing Game 3, they receive a **+2.0** bonus (`WEIGHT_SWEEP_AVOID_GAME3 = 2.0`).
* **Report Text**: `🧹 Sweep Avoidance: [Trailer Team] faces a potential sweep (game [gameNumber]/[totalGames]) — teams rarely go quietly.`
* **Series Clinch**: If a team is one win away from clinching the series in the finale, they receive a **+1.5** bonus (`WEIGHT_SERIES_CLINCH = 1.5`) and the advantage: `🏆 Series Clinch`.
* **Season Series Revenge**: Teams that are trailing in the overall season head-to-head matchup receive a **+1.5** incentive boost (`WEIGHT_SEASON_SERIES_REVENGE = 1.5`).
* **Dominant Fade**: Fading a team that has historically dominated the season series carries a **-1.0** penalty (`WEIGHT_SEASON_SERIES_DOMINANT_FADE = -1.0`).

---

## 4. Pitcher Status Classification & Integrity Overrides
Pitchers are classified based on a blended **Composite ERA** (70% Regular Season / 30% Spring Training).

### Blended Composite Formula
$$\text{Composite ERA} = (\text{Regular ERA} \times 0.7) + (\text{Spring ERA} \times 0.3)$$
* *Spring Guard*: Spring Training ERA is ignored if the sample size is $< 10$ innings.
* *Recent Performance Priority*: If a pitcher has $\ge 15$ innings in the *current* active season, that current season's ERA overrides the historical blended fallback entirely.

### Classifications & Overrides
* **Elite Pitchers List**: Seeded from a static list of top-tier pitchers (e.g. Spencer Strider, Zack Wheeler, Yoshinobu Yamamoto).
* **Integrity Demotion Override**: Strips "Elite" status from any pitcher if their calculated composite/current ERA exceeds **4.30** (e.g. Shota Imanaga).
* **Integrity Promotion Override**: Elevates a pitcher to "Elite" status if their calculated composite/current ERA is $\le \mathbf{2.80}$.
* **Weak Classification**: Pitchers are classified as "Weak" if they belong to `WEAK_PITCHERS_STATIC` or if their calculated composite/current ERA is $\ge \mathbf{5.00}$.

---

## 5. Execution & Sizing Safeguards
* **Lineup Verification (`[SWAP_CHECK]`)**: Compares predicted/probable starters against actual active rosters. If a mismatch is detected, it logs a warning for manual confirmation.
* **Slump Control**: If the user's betting history contains **3 consecutive losses**, the system declares a slump and automatically throttles recommended stake sizes by **50%**.
* **Mindset Volatility Adjustments**: Scales confidence levels and recommended stake sizes dynamically based on user-provided mood and calmness parameters (collected via Telegram).
