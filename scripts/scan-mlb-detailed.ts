import { MLBApi } from '../src/lib/mlb-api';
import { PillarAnalyzer } from '../src/lib/pillar-analyzer';

// Console colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const MAGENTA = '\x1b[35m';

function pillarColor(score: number): string {
    if (score >= 8) return GREEN;
    if (score >= 5) return YELLOW;
    return RED;
}

function bar(score: number, max: number = 10): string {
    const filled = Math.round(score);
    const empty = max - filled;
    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
}

function confidenceBar(conf: number): string {
    const filled = Math.round(conf / 5);
    const empty = 20 - filled;
    const color = conf >= 70 ? GREEN : conf >= 55 ? YELLOW : RED;
    return `${CYAN}[${color}${'█'.repeat(filled)}${DIM}${'░'.repeat(empty)}${CYAN}]${RESET} ${BOLD}${conf}%${RESET}`;
}

async function main() {
    const mlbApi = new MLBApi();
    const analyzer = new PillarAnalyzer();
    const date = '2026-03-08';

    console.log(`\n${BOLD}${CYAN}🔍 BODHI MLB SPRING TRAINING SCANNER — ${date}${RESET}\n`);

    const mlbGames = await mlbApi.getSchedule(date);
    console.log(`Analyzing ${mlbGames.length} MLB games...\n`);

    for (const game of mlbGames) {
        let details: any = { probables: game.probables || {}, lineups: game.lineups || { home: [], away: [] } };
        if ((!details.lineups.home || details.lineups.home.length === 0) && game.gamePk) {
            const fetched = await mlbApi.getGameDetails(game.gamePk);
            if (fetched) details = fetched;
        }

        const analysis = analyzer.analyzeGame(game, details, undefined, [], [], new Map());

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`⚾ ${BOLD}${analysis.awayTeam} @ ${analysis.homeTeam}${RESET}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        console.log(`  ${BOLD}PILLARS${RESET}`);
        analysis.pillars.forEach((p, i) => {
            const isLast = i === analysis.pillars.length - 1;
            const prefix = isLast ? '  └─' : '  ├─';
            const contPrefix = isLast ? '     ' : '  │  ';
            const scoreColor = pillarColor(p.score);
            const scoreBar = bar(p.score);
            console.log(`${prefix} ${BOLD}${p.pillar.padEnd(24)}${RESET} ${scoreColor}${scoreBar} ${p.score}/10${RESET}`);

            const words = p.reason.split(' ');
            let line = '';
            const lines: string[] = [];
            for (const word of words) {
                if ((line + word).length > 60) { lines.push(line.trim()); line = ''; }
                line += word + ' ';
            }
            if (line.trim()) lines.push(line.trim());
            lines.forEach(l => console.log(`${contPrefix}    ${DIM}${l}${RESET}`));
        });

        console.log(`\n  ${BOLD}CONFIDENCE${RESET}  ${confidenceBar(analysis.overallConfidence)}`);

        const sigColor = analysis.recommendedAction.includes("CONVICTION") ? GREEN : analysis.recommendedAction.includes("LEAN") ? YELLOW : DIM;
        console.log(`  ${BOLD}SIGNAL${RESET}      ${sigColor}${analysis.recommendedAction}${RESET}\n`);
    }
}

main().catch(console.error);
