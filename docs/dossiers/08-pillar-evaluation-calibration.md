# [Dossier 08] Pillar Evaluation & Probability Calibration

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Quantitative Engineering & Microstructure` // **Type:** `strategic` &nbsp;|&nbsp; **Date:** `2026-06-20`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *matchup probability weighting*

**Executive Summary:** Scores sporting matchups on a three-pillar scale to resolve the mathematical discrepancy between internal baseline probability and Polymarket crowd prices.

- **Telemetry:** `mode: active // calibration: multi-sport // favorite_tax_threshold: 0.60`
- **Tech Stack:** `TypeScript`, `Odds API`, `MLB API`, `KBO API`, `Supabase`, `Gemini API`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **confidence_weight_limit** | `85% (nhl/nba)` |
| **base_stake_multiplier** | `0.5 (slump_mode)` |

## Technical Architecture & Findings

### Pillar Scoring Framework

The system evaluates matchups by combining sport-specific parameters into an objective confidence score ($C$). The scoring model evaluates three core pillars, each scaling from $0$ to $10$:

1. **Technical Sport ($P_1$)**: Evaluates pitching metrics (composite ERA calculated via a 70/30 blend of last year's regular season and spring training, or active season ERA after a 15-inning sample size), lineup quality (Elite/Hot bats), bullpen fatigue logs, and platoon splits.
2. **Seasonal/Environmental ($P_2$)**: Integrates venue metrics (e.g. Coors Field hitter boost of `+2.5`, Petco Park pitcher boost of `+1.5`), weather parameters (wind speeds and directions), and ramping factors.
3. **Technical Bookies ($P_3$)**: Tracks implied pricing from traditional bookmakers compared to Polymarket crowd prices to resolve Expected Value (EV):

$$\text{EV} = \frac{C}{100} - \text{Polymarket Share Price}$$

### Sizing and Risk Mitigation

```typescript
export function getSizing(confidence: number, bankroll: number): { label: string, amount: number } {
    if (confidence >= 80) return { label: "Aggressive (7.5%)", amount: bankroll * 0.075 };
    if (confidence >= 70) return { label: "Standard (4.0%)", amount: bankroll * 0.04 };
    if (confidence >= 60) return { label: "Caution (2.0%)", amount: bankroll * 0.02 };
    return { label: "Zero (0%)", amount: 0 };
}
```

If the system detects a performance drawdown (e.g. 3 consecutive losses or 4 of the last 5 settled as losses in Supabase), it enters `Slump Mode`, automatically reducing the suggested stake sizes by 50% ($0.5\times$ multiplier) to preserve capital during high-variance periods.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
