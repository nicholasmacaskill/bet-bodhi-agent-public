# [Dossier 14] Multi-Sport Scanner Pipeline & Bodhi Prism Agent Facade

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Cognitive AI & Multi-Agent Swarms` // **Type:** `technical` &nbsp;|&nbsp; **Date:** `2026-06-26`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *five-league ingestion through a unified agent interface*

**Executive Summary:** Orchestrates daily-scanner.ts across MLB, NHL, NBA, MMA, and KBO data engines, resolves Gamma markets via fuzzy mascot matching, and exposes all capabilities through the Bodhi Prism agent facade.

- **Telemetry:** `sports_engines: 5 // pipeline: daily-scanner.ts // agent_facade: BodhiPrism`
- **Tech Stack:** `TypeScript`, `Polymarket Gamma API`, `MLB API`, `NHL API`, `NBA API`, `KBO API`, `MMA API`, `Odds API`, `Gemini API`, `BodhiPrism`, `Supabase`, `Node.js`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **concurrent_sport_engines** | `5` |
| **pillar_analyzers** | `5 sport-specific` |
| **scan_output** | `scan-results.json` |
| **ev_confidence_floor** | `60%` |

## Technical Architecture & Findings

### Bodhi Scanner Execution Pipeline

The **Bodhi Scanner** (`daily-scanner.ts`) is the automated entrypoint for discovering and evaluating +EV opportunities across Polymarket sports markets. Each invocation runs a deterministic sequence:

```
Start Scan → Sync Live Bets & Bankroll → Fetch Sports Slate
→ Fetch Traditional Odds & CLOB Markets → Resolve Matchups to Conditions
→ Run Pillar Analyzer per Game → Check Circuit Breaker → Export scan-results.json
```

### Multi-Sport Data Ingestion

The scanner fetches schedule, lineup, and roster data concurrently across five sport-specific engines:

| Engine | Data Ingested |
| :--- | :--- |
| **MLB** | Pitching matchups, daily lineups, platoon splits, bullpen fatigue, hot hitter lists |
| **NHL** | Goalie SV%/GAA matchups, team standings |
| **NBA** | Team form, rosters, schedules |
| **MMA** | Card lineups, location, fighter metrics |
| **KBO** | Starting pitchers, team stats, linescores |

### Market Resolution & Pillar Routing

For each retrieved matchup, the scanner queries active sports markets from the Polymarket Gamma API. Mascot-based fuzzy matching resolves team names in market question text (e.g. "Marlins" vs "Angels"), with a `getMarketByTeams` fallback. Matched games route to the corresponding sport-specific `PillarAnalyzer` for three-pillar confidence scoring.

### Bodhi Prism: Unified Agent Facade

`BodhiPrism` collapses isolated scripts and analyzer classes into a single clarity layer for autonomous AI agents:

```typescript
export class BodhiPrism {
    async scanMLB(date: string, bankroll: number = 464) { /* schedule → pillar → filter ≥60% */ }
    async scanNHL(date: string, bankroll: number = 464) { /* goalie stats → pillar → filter ≥60% */ }
    async getUserState() { /* bankroll + performance from Supabase */ }
    async analyzeBiases() { /* chase-win / overconfidence detection */ }
    async checkSlump() { /* 50% stake throttle on losing streaks */ }
    async recordBet(entry: BetLogEntry) { /* psychometric logging to Supabase */ }
}
```

Agents call Prism methods instead of invoking scripts directly — scanning, bankroll state, bias analysis, circuit breakers, and bet logging share one interface.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
