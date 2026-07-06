# 📉 Mid-Season Performance Dip Analysis

This document provides a systematic review of the **mid-season performance dip** observed in our trading results, as identified by recent audits and on-chain metrics.

---

## 📊 Performance Reality Check

According to our latest [Performance Audit Report](file:///Users/nicholasmacaskill/Downloads/bet-bodhi/reports/BODHI_PERFORMANCE_AUDIT.md):
* **Total Scanned Recommendations**: 537
* **Overall Model Win Rate**: `49.0%`
* **High Alpha (10+) Win Rate**: `42.0%` (100 / 238)
* **Simulated MLB Model ROI**: `-11.84%` (flat $35.00 staking)

---

## 🔍 Structural Causes of the Mid-Season Dip

As the sporting calendar transitions from early-season (April/May) to mid-season (June/July), several critical macro variables shift, eroding early-season edges:

### 1. 🌡️ Weather Shifts (Summer Heat & Humidity)
* **Early Season**: Cold air is dense, dampening ball travel. Games are low-scoring, pitcher-dominated, and highly predictable via starting matchup baseline stats.
* **Mid Season**: Temperatures rise. The air becomes less dense, leading to increased ball travel (more home runs and higher total scoring). This introduces random high-scoring variance, making starter-dominated projections less predictive.

### 2. 🎚️ Bullpen Fatigue (Roster Exhaustion)
* By mid-season (60+ games in), major league bullpens carry accumulated fatigue. High-leverage relievers are frequently unavailable, leading to late-inning blowups.
* This is evidenced by our [Macro Volatility Index Tracker](file:///Users/nicholasmacaskill/Downloads/bet-bodhi/scripts/macro-regime-daemon.ts) which flags when **late-inning lead changes** spike. When late-game volatility flatlines or breaks out unexpectedly, the model's pre-match starter-based edge decays.

### 3. 🎯 Data Saturation & Market Efficiency
* **Early Season**: Bookmakers and prediction market crowds rely on outdated prior-season priors or small current-season samples. The model easily flags statistical inefficiencies.
* **Mid Season**: Market prices (consisting of thousands of sharp traders) align near-perfectly with current-season performance. With high data saturation, prediction markets become highly efficient, leaving very narrow "+EV" gaps.

### 4. 💸 Favorite Tax (Crowd Bias)
* Polymarket crowds heavily tax popular favorites. If market prices exceed `$0.60` (60%) or `$0.70` (70%), the vig and favorite bias require an exceptionally high probability edge to justify a bet. In a saturated market, placing trades on high-volume favorites without an extreme edge drains long-term ROI.

---

## 🛠️ Mitigations & Adjustments

To combat the mid-season dip, the system has implemented the following controls:

1. **Slump Circuit Breaker**:
   The `checkSlump()` detector automatically throttles all suggested stakes by `50%` if the model suffers a losing streak (3 consecutive losses or 4 out of last 5 lost). This preserves capital during high-variance mid-season periods.
2. **Volative Regime Sizing**:
   The `macro-regime-daemon.ts` monitors rolling late-inning shifts. If the 3-day rolling average drops below `0.5`, it triggers a `REGIME_FLATLINED` alert via Telegram, advising the operator to reduce unit sizing and avoid "trailing favorite" angles.
3. **Platoon & Late-Inning Bullpen Modifiers**:
   We added a dynamic **Bullpen Fatigue Penalty** (up to `-3.0` weight) and **Late Inning Mismatches** (`+1.0` bonus) to our [Pillar Analyzer](file:///Users/nicholasmacaskill/Downloads/bet-bodhi/src/lib/pillar-analyzer.ts) to discount starting pitcher bias when relief corps are spent.
