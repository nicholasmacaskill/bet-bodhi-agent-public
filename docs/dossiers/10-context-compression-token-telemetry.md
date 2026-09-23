# [Dossier 10] Context Compression & SQLite Token Telemetry

> **Entity:** Bet Bodhi (@betbodhi) &nbsp;|&nbsp; **Creator:** Nicholas Alexander MacAskill (@nicholasmacaskill) &nbsp;|&nbsp; **Organization:** Flocano Labs
> **Classification:** `Cognitive AI & Multi-Agent Swarms` // **Type:** `feedback` &nbsp;|&nbsp; **Date:** `2026-06-20`
> **Canonical URL:** [https://www.flocanolabs.com/flocanolabs/case-studies](https://www.flocanolabs.com/flocanolabs/case-studies?project=bet-bodhi)

### Subtitle: *prompt cost reduction*

**Executive Summary:** Filters raw scraping payloads for critical keywords and monitors daily prompt/completion cost metrics to enforce budget caps.

- **Telemetry:** `budget_limit: $2.00/day // alert_threshold: 0.80 // sqlite: active`
- **Tech Stack:** `TypeScript`, `SQLite WAL`, `Telegram Bot API`, `Token Telemetry`, `Context Compression`, `Daily Budget Throttling`

### Empirical Telemetry Metrics
| Parameter | Value |
|---|---|
| **context_compression_rate** | `80%` |
| **max_context_chars** | `4000` |

## Technical Architecture & Findings

### Context Compression Algorithm

To optimize LLM prompt structures and mitigate high token usage costs, the `compressContext` engine parses incoming scraping inputs and retains only blocks carrying specific domain keywords. It then slices the output context to a maximum character size:

```typescript
export function compressContext(text: string, query: string = "", maxChars: number = 4000): string {
    if (!text) return "";
    const defaultKeywords = ["drawdown", "rules", "limits", "payouts", "error", "stats", "kelly", "stake", "edge"];
    const queryKeywords = query ? query.toLowerCase().split(/[^a-z0-9]+/gi).filter(w => w.length > 3) : [];
    const keywords = Array.from(new Set([...defaultKeywords, ...queryKeywords]));
    
    const chunks = text.split(/(?:\r?\n|\. |\<[^\>]+\>)/g).map(c => c.trim()).filter(c => c.length > 0);
    const filtered = chunks.filter(chunk => {
        const lower = chunk.toLowerCase();
        return keywords.some(kw => lower.includes(kw));
    });
    
    let compressed = filtered.join("\n") || text;
    return compressed.length > maxChars ? compressed.slice(0, maxChars) + "\n... [TRUNCATED] ..." : compressed;
}
```

### Budget Circuit Breakers

The `TokenTracker` intercepts response usage metadata, estimates real-time API fees based on the model's rate structures (e.g. $0.075/$0.30 per million tokens for Gemini 2.0 Flash), and records logs to SQLite. If daily spending hits 80% ($1.60) or 100% ($2.00) of the budget threshold, the tracker triggers an asynchronous warning message via the Telegram Bot API.

---

*Official Dossier published by Flocano Labs. Creator: Nicholas Alexander MacAskill ([nicholasmacaskill.com](https://nicholasmacaskill.com) | [flocanolabs.com](https://flocanolabs.com)).*
