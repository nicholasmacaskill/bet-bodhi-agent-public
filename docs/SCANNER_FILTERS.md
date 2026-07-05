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

## 3. Pitcher Status Classification & Integrity Overrides
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

## 4. Execution & Sizing Safeguards
* **Lineup Verification (`[SWAP_CHECK]`)**: Compares predicted/probable starters against actual active rosters. If a mismatch is detected, it logs a warning for manual confirmation.
* **Slump Control**: If the user's betting history contains **3 consecutive losses**, the system declares a slump and automatically throttles recommended stake sizes by **50%**.
* **Mindset Volatility Adjustments**: Scales confidence levels and recommended stake sizes dynamically based on user-provided mood and calmness parameters (collected via Telegram).
