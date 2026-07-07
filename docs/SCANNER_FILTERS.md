# Bodhi Slate Scanning and Analysis Filter Specifications

This document details the filters, vetoes, and safeguards applied by the Bodhi analysis engine during game slate scanning and EV computation.

---

## 1. Value Play Selection Filters
For a matchup to be identified as an actionable **Value Play** (e.g. highlighted in reports or the Telegram picks feed), it must satisfy all of the following:
* **EV Threshold**: Expected Value (EV) must be >= [REDACTED]% (`polyEV >= [REDACTED]`).
* **Active Direction**: A specific target team must be selected (`valueTeam` is defined and is not `'NEUTRAL'`).
* **Veto Status**: The match must pass all automated veto checks (detailed below). Vetoed matches are marked as `PASS` and their target pick is set to `NEUTRAL` or `undefined`.

---

## 2. Automated Veto Logic
The analysis engine enforces strict technical and performance vetoes to safeguard capital against low-probability scenarios:

### Pitcher-Based Vetoes
Even if a team shows positive EV, the pick is vetoed under the following matchups:
* **Elite Opponent**: Veto if target team is Home, but Away starting pitcher is **Elite**.
* **Elite Opponent**: Veto if target team is Away, but Home starting pitcher is **Elite**.
* **Weak Starter**: Veto if target team is Home, but Home starting pitcher is **Weak** (composite ERA >= [REDACTED]).
* **Weak Starter**: Veto if target team is Away, but Away starting pitcher is **Weak** (composite ERA >= [REDACTED]).

### Agent Memory Burn List Veto
* **Negative ROI Guard**: If the target team (`valueTeam`) has negative historical performance tracked in the agent's memory (ROI < 0%), the engine vetoes the pick with the reason: `VETO: Agent Memory Burn List. [Team] has cost us historically ([ROI]% ROI).`

---

## 3. Team Form, Momentum, and Contextual Weights
The model computes an Alpha Score based on technical roster stats, adjusted by live situational dynamics:

### Hot Bats ("72h Heaters")
* **Rule**: If a starting lineup contains >= [REDACTED] players on a 72h offensive heater (elevated hard-hit/barrel rates), the team receives an advantage boost.
* **Weight Factor**: `WEIGHT_HOT_BAT = [REDACTED]` per hot bat.
* **Mismatch Boost**: Extra bonus is applied if a team has >= [REDACTED] hot bats *and* faces a weak opposing starting pitcher.
* **Report Text**: `⚡ Offensive Surge: [Count] players in the [Team] starting lineup are currently on a 72h 'heater' with elevated hard-hit rates, indicating a peak scoring window.`

### Team Momentum & Cold Streaks (Last 10 Games)
* **Surging Team Momentum**: If a team has won >= [REDACTED] of their last 10 games, it receives a **+[REDACTED]** form bonus and is flagged with `🔥 Team Momentum`.
* **Cold Streak**: If a team has won <= [REDACTED] of their last 10 games, it receives a **-[REDACTED]** form penalty and is flagged with `🥶 Cold Streak` (acting as a risk factor).

### Series Context & Sweep Avoidance
* **Sweep Avoidance (Finale)**: If a team is down 2-0 or 3-0 in a series and playing the series finale, they receive a **+[REDACTED]** bonus (`WEIGHT_SWEEP_AVOID_FINALE = [REDACTED]`).
* **Sweep Avoidance (Game 3)**: If a team is down 2-0 in a 4-game series and playing Game 3, they receive a **+[REDACTED]** bonus (`WEIGHT_SWEEP_AVOID_GAME3 = [REDACTED]`).
* **Report Text**: `🧹 Sweep Avoidance: [Trailer Team] faces a potential sweep (game [gameNumber]/[totalGames]) — teams rarely go quietly.`
* **Series Clinch**: If a team is one win away from clinching the series in the finale, they receive a **+[REDACTED]** bonus (`WEIGHT_SERIES_CLINCH = [REDACTED]`) and the advantage: `🏆 Series Clinch`.
* **Season Series Revenge**: Teams that are trailing in the overall season head-to-head matchup receive a **+[REDACTED]** incentive boost (`WEIGHT_SEASON_SERIES_REVENGE = [REDACTED]`).
* **Dominant Fade**: Fading a team that has historically dominated the season series carries a **-[REDACTED]** penalty (`WEIGHT_SEASON_SERIES_DOMINANT_FADE = -[REDACTED]`).

---

## 4. Pitcher Status Classification & Integrity Overrides
Pitchers are classified based on a blended **Composite ERA**.

### Blended Composite Formula
Composite ERA = (Regular ERA * [REDACTED]) + (Spring ERA * [REDACTED])
* *Spring Guard*: Spring Training ERA is ignored if the sample size is < [REDACTED] innings.
* *Recent Performance Priority*: If a pitcher has >= [REDACTED] innings in the *current* active season, that current season's ERA overrides the historical blended fallback entirely.

### Classifications & Overrides
* **Elite Pitchers List**: Seeded from a static list of top-tier pitchers (e.g. Spencer Strider, Zack Wheeler, Yoshinobu Yamamoto).
* **Integrity Demotion Override**: Strips "Elite" status from any pitcher if their calculated composite/current ERA exceeds **[REDACTED]** (e.g. Shota Imanaga).
* **Integrity Promotion Override**: Elevates a pitcher to "Elite" status if their calculated composite/current ERA is <= **[REDACTED]**.
* **Weak Classification**: Pitchers are classified as "Weak" if they belong to `WEAK_PITCHERS_STATIC` or if their calculated composite/current ERA is >= **[REDACTED]**.

---

## 5. Execution & Sizing Safeguards
* **Lineup Verification (`[SWAP_CHECK]`)**: Compares predicted/probable starters against actual active rosters. If a mismatch is detected, it logs a warning for manual confirmation.
* **Slump Control**: If the user's betting history contains **[REDACTED] consecutive losses**, the system declares a slump and automatically throttles recommended stake sizes by **[REDACTED]%**.
* **Mindset Volatility Adjustments**: Scales confidence levels and recommended stake sizes dynamically based on user-provided mood and calmness parameters (collected via Telegram).
