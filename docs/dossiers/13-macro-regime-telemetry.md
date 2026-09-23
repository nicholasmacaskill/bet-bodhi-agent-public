# [Dossier 13] Macro Regime Telemetry & Psychometric Circuit Breakers

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Quantitative Engineering & Microstructure` // **Type:** `strategic` &nbsp;|&nbsp; **Date:** `2026-06-26`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *league volatility index and slump mode stake throttling*

**Executive Summary:** Tracks rolling 3-day late-inning lead change averages to detect flatlined volatility regimes and pairs macro alerts with automated 50% stake reduction during losing streaks.

- **Telemetry:** `daemon: macro-regime-daemon.ts // alert_threshold: 0.5 // slump_multiplier: 0.5`
- **Tech Stack:** `TypeScript`, `ESPN API`, `Supabase`, `Telegram Bot API`, `Macro Regime Telemetry`, `Slump Mode Throttling`, `Rolling Volatility Tracking`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **rolling_window** | `3 days` |
| **regime_alert_threshold** | `< 0.5 lead changes` |
| **slump_stake_reduction** | `50%` |
| **baseline_volatility** | `~1.8 / slate` |

## Technical Architecture & Findings

### Regime-Aware Capital Safeguards

Quantitative sports strategies decay during flatlined volatility regimes — mid-season dips when weather variance spikes or fatigued bullpens generate unpredictable late-inning flips. Operating at full unit size through these periods risks severe drawdowns. Bodhi implements two automated circuit breakers: a **macro telemetry daemon** for league-wide volatility and a **psychometric slump detector** for personal losing streaks.

### Macro Regime Daemon

`macro-regime-daemon.ts` ingests completed MLB box scores via the ESPN scoreboard API, counts **7th-inning-or-later lead changes** per slate, and maintains a rolling 3-day history in `macro_regime_state.json`. When the rolling average drops below `0.5` (baseline healthy state: ~1.8), the daemon fires a `REGIME_FLATLINED` Telegram alert advising percentage-based risk reduction:

```typescript
const ALERT_THRESHOLD = 0.5;

// Count lead changes in innings 7+
if (newLeader !== currentLeader && currentLeader !== 'TIE' && newLeader !== 'TIE') {
    if (i >= 6) lateInningLeadChanges++;
}

if (state.history.length === 3 && rollingAvg < ALERT_THRESHOLD) {
    await sendTelegramAlert(
        `🚨 *REGIME_FLATLINED* 🚨\n3-Day Rolling Avg: *${rollingAvg.toFixed(2)}*\nReduce unit sizing. Avoid trailing-favorite angles.`,
        'Markdown'
    );
}
```

### Psychometric Slump Mode

`BodhiPrism.checkSlump()` evaluates the last 5 settled bets in Supabase. If the trader has **3 consecutive losses** or **4 losses in the last 5**, the system enters Slump Mode and throttles all model-suggested stakes by **50%** (`multiplier: 0.5`):

```typescript
const last3Losses = recentBets.slice(0, 3).every(b => b.result === 'loss');
const last5Slump = recentBets.length === 5 && lossCount >= 4;

if (last3Losses || last5Slump) {
    return { isSlump: true, multiplier: 0.5, reason: "SLUMP DETECTED: Stakes throttled by 50%." };
}
```

The macro daemon catches **environmental** regime shifts before they eat the bankroll; slump mode catches **personal** variance clusters — together they remove discretionary tilt from sizing decisions.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
