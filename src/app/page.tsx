"use client";

import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Terminal as TerminalIcon,
    Loader2,
    ChevronRight,
    Zap,
    Copy,
    CheckCircle2,
    AlertCircle,
    Wifi,
    WifiOff
} from "lucide-react";

interface BodhiPillar {
    pillar: string;
    score: number;
    reason: string;
}

interface BodhiAnalysis {
    awayTeam: string;
    homeTeam: string;
    valueTeam?: string;
    overallConfidence: number;
    recommendedAction: string;
    recommendedSize: string;
    suggestedStake: number;
    polyConditionId?: string;
    polySharePrice?: number;
    polyEV?: number;
    sxMarketHash?: string;
    sxSharePrice?: number;
    sxEV?: number;
    executionRoute?: string;
    pillars: BodhiPillar[];
    polyOutcomeIndex?: number;
    homeOdds?: number;
    awayOdds?: number;
}

interface ScanResult {
    sport: string;
    matchup: string;
    analysis: BodhiAnalysis;
    startTime?: string;
}

interface ScanData {
    lastUpdated: string;
    date: string;
    results: ScanResult[];
}

export default function BodhiTerminal() {
    const [data, setData] = useState<ScanData | null>(null);
    const [filter, setFilter] = useState("");
    const [loading, setLoading] = useState(true);
    const [executing, setExecuting] = useState(false);
    const [terminalOutput, setTerminalOutput] = useState<{ stdout: string; stderr: string; command: string; error?: string } | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [bridgeStatus, setBridgeStatus] = useState<'checking' | 'active' | 'offline'>('checking');

    useEffect(() => {
        // Initial data fetch
        fetch("/scan-results.json")
            .then((res) => res.json())
            .then((json) => {
                setData(json);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to load scan data:", err);
                setLoading(false);
            });

        // Check bridge status
        fetch("/api/execute")
            .then(res => res.ok ? setBridgeStatus('active') : setBridgeStatus('offline'))
            .catch(() => setBridgeStatus('offline'));
    }, []);

    const sportEmoji = (sport: string) => {
        switch (sport.toUpperCase()) {
            case 'MLB': return '⚾';
            case 'NBA': return '🏀';
            case 'NHL': return '🏒';
            case 'MMA': return '🥊';
            default: return '🔍';
        }
    };

    const filteredResults = data?.results.filter((r) => {
        const search = filter.toLowerCase();
        return r.matchup.toLowerCase().includes(search) ||
            r.sport.toLowerCase().includes(search) ||
            r.analysis.recommendedAction.toLowerCase().includes(search);
    }) || [];

    const handleExecute = async (command: string) => {
        if (executing) return;
        setExecuting(true);
        setTerminalOutput(null);

        try {
            const response = await fetch('/api/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command }),
            });

            const result = await response.json();

            setTerminalOutput({
                command,
                stdout: result.stdout || '',
                stderr: result.stderr || '',
                error: result.error || (response.ok ? undefined : `HTTP Error ${response.status}`)
            });
        } catch (error: any) {
            setTerminalOutput({
                command,
                stdout: '',
                stderr: '',
                error: error.message || 'Network failure or API offline.'
            });
        } finally {
            setExecuting(false);
        }
    };

    const getExecutionCommand = (r: ScanResult) => {
        const { analysis } = r;
        if (analysis.executionRoute === 'SX' && analysis.sxMarketHash) {
            return `npx tsx scripts/place-bet.ts --market sx --id ${analysis.sxMarketHash} --outcome \"${analysis.valueTeam}\" --amount ${analysis.suggestedStake.toFixed(2)} --price ${analysis.sxSharePrice?.toFixed(2)}`;
        } else if (analysis.polyConditionId) {
            const outcomeIndex = (analysis.valueTeam === analysis.homeTeam || analysis.valueTeam?.includes(analysis.homeTeam.split(' ').pop() || '')) ? 0 : 1;
            return `npx tsx scripts/place-bet.ts --market poly --id ${analysis.polyConditionId} --outcome ${outcomeIndex} --amount ${analysis.suggestedStake.toFixed(2)} --price ${analysis.polySharePrice?.toFixed(2)}`;
        }
        return "";
    };

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center text-[#666] mono uppercase text-[11px]">
                [ system ] analyzing_sovereign_feed...
            </div>
        );
    }

    return (
        <div className="terminal-layout bg-[#0d0d0d]">
            <div className="terminal-content pt-20 px-6">
                {/* Terminal Header */}
                <header className="mb-20 space-y-4">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <div className="text-[11px] mono uppercase tracking-widest text-[#555]">
                                BODHI_SOVEREIGN_SCAN // {data?.date}
                            </div>
                            <div className="text-[11px] mono text-[#444]">
                                [ STDOUT ] RUNNING_DAILY_SCANNER... <br />
                                [ UPDATE ] {data?.lastUpdated}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] mono uppercase">
                            {bridgeStatus === 'active' ? (
                                <span className="text-[#22c55e] flex items-center gap-1.5 bg-[#22c55e]/5 px-2 py-1 border border-[#22c55e]/20">
                                    <Wifi className="w-3 h-3" /> Bridge Online
                                </span>
                            ) : bridgeStatus === 'offline' ? (
                                <span className="text-red-500 flex items-center gap-1.5 bg-red-500/5 px-2 py-1 border border-red-500/20">
                                    <WifiOff className="w-3 h-3" /> Bridge Offline
                                </span>
                            ) : (
                                <span className="text-[#555] flex items-center gap-1.5 px-2 py-1 bg-[#111] animate-pulse">
                                    Connecting...
                                </span>
                            )}
                        </div>
                    </div>
                </header>

                {/* Console Feed */}
                <section className="space-y-24">
                    {filteredResults.map((r, idx) => {
                        const hasEdge = r.analysis.suggestedStake > 0;
                        const hasPoly = !!r.analysis.polyConditionId;

                        return (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mono space-y-6"
                            >
                                <div className="text-[#262626] select-none text-[10px]">
                                    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                </div>

                                <div className="flex gap-3 items-center">
                                    <span className="text-[#a1a1a1] w-6 text-center">{sportEmoji(r.sport)}</span>
                                    <span className="text-[#444] shrink-0">[{r.sport}]</span>
                                    <span className="text-[#ffffff] font-medium">{r.matchup}</span>
                                    <span className="text-[#444] ml-auto text-[11px]">
                                        {r.startTime ? new Date(r.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'LIVE'}
                                    </span>
                                </div>

                                <div className="space-y-4 pl-9 border-l border-[#1a1a1a]">
                                    <div className="space-y-1">
                                        <div className="text-[#555] text-[10px] uppercase tracking-widest font-bold">MATCHUP INFO</div>
                                        {hasPoly && (
                                            <div className="text-[#666] text-[11px]">
                                                Polymarket: {r.analysis.awayTeam.split(' ').pop()} [${r.analysis.awayOdds?.toFixed(2)}] | {r.analysis.homeTeam.split(' ').pop()} [${r.analysis.homeOdds?.toFixed(2)}]
                                            </div>
                                        )}
                                        <div className={`text-[11px] mt-2 ${hasEdge ? 'text-[#22c55e]' : 'text-[#666]'}`}>
                                            Bodhi Action: {r.analysis.recommendedAction}
                                        </div>

                                        {hasEdge && (
                                            <div className="flex gap-4 mt-2">
                                                <button
                                                    disabled={bridgeStatus !== 'active' || executing}
                                                    onClick={() => handleExecute(getExecutionCommand(r))}
                                                    className={`px-2 py-0.5 text-[10px] uppercase transition-all flex items-center gap-1.5 border ${bridgeStatus === 'active'
                                                            ? 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/20'
                                                            : 'bg-[#111] border-[#222] text-[#444] cursor-not-allowed'
                                                        }`}
                                                >
                                                    <Zap className="w-3 h-3" /> Execute Play
                                                </button>
                                                <button
                                                    onClick={() => copyToClipboard(getExecutionCommand(r), `copy-${idx}`)}
                                                    className="text-[#444] hover:text-[#888] text-[10px] uppercase transition-all flex items-center gap-1.5"
                                                >
                                                    {copiedId === `copy-${idx}` ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                    Copy Cmd
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-1 pt-2">
                                        <div className="text-[#555] text-[10px] uppercase tracking-widest font-bold">PILLARS</div>
                                        <div className="space-y-0.5">
                                            {r.analysis.pillars.map((p, pIdx) => (
                                                <div key={pIdx} className="flex gap-2 text-[11px]">
                                                    <span className="text-[#333]">├─</span>
                                                    <span className="text-[#666] w-40">{p.pillar}</span>
                                                    <span className="text-[#333]">[</span>
                                                    <span className="text-[#888]">
                                                        {"█".repeat(Math.floor(p.score))}
                                                        {"░".repeat(10 - Math.floor(p.score))}
                                                    </span>
                                                    <span className="text-[#333]">]</span>
                                                    <span className="text-[#666] ml-2">{p.score}/10</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-4 space-y-1">
                                        <div className="flex items-center gap-4 text-[11px]">
                                            <span className="text-[#666] uppercase w-20">CONFIDENCE</span>
                                            <div className="flex gap-0.5">
                                                <span className="text-[#262626]">[</span>
                                                <span className={hasEdge ? "text-[#22c55e]" : "text-[#444]"}>
                                                    {"█".repeat(Math.floor(r.analysis.overallConfidence / 5))}
                                                    {"░".repeat(20 - Math.floor(r.analysis.overallConfidence / 5))}
                                                </span>
                                                <span className="text-[#262626]">]</span>
                                            </div>
                                            <span className={hasEdge ? "text-[#22c55e]" : "text-[#a1a1a1]"}>{r.analysis.overallConfidence}%</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </section>

                <footer className="py-32 text-center opacity-20 mono text-[10px] uppercase tracking-[0.4em]">
                    -- SOVEREIGN FEED END --
                </footer>
            </div>

            {/* Terminal Output Overlay */}
            <AnimatePresence>
                {terminalOutput && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
                    >
                        <div className="w-full max-w-2xl bg-[#0d0d0d] border border-[#262626] shadow-2xl p-6 mono text-[11px] max-h-[80vh] flex flex-col relative rounded-lg">
                            <button
                                onClick={() => setTerminalOutput(null)}
                                className="absolute top-4 right-4 text-[#444] hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>

                            <div className="text-[#555] mb-4 border-b border-[#1a1a1a] pb-2 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TerminalIcon className="w-3 h-3 text-[#22c55e]" />
                                    <span className="text-[#a1a1a1]">STDOUT_CAPTURE</span>
                                </div>
                                <span className="text-[#333] text-[9px] uppercase">LOCAL_BRIDGE_V1</span>
                            </div>

                            <div className="mb-4 p-3 bg-black rounded border border-[#1a1a1a] text-[#444] text-[10px] break-all">
                                $ {terminalOutput.command}
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scroll">
                                {terminalOutput.error && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 flex gap-2">
                                        <AlertCircle className="w-4 h-4 shrink-0" />
                                        <div className="space-y-1">
                                            <div className="font-bold underline">SYSTEM ERROR</div>
                                            <div className="opacity-90">{terminalOutput.error}</div>
                                        </div>
                                    </div>
                                )}
                                {terminalOutput.stdout && (
                                    <div className="text-[#a1a1a1] whitespace-pre-wrap leading-relaxed">
                                        {terminalOutput.stdout}
                                    </div>
                                )}
                                {terminalOutput.stderr && (
                                    <div className="text-orange-500/80 whitespace-pre-wrap leading-relaxed border-t border-[#1a1a1a] mt-2 pt-2">
                                        <div className="text-[9px] uppercase mb-1 opacity-50">STDERR:</div>
                                        {terminalOutput.stderr}
                                    </div>
                                )}
                                {(!terminalOutput.stdout && !terminalOutput.stderr && !terminalOutput.error) && (
                                    <div className="text-[#444] italic">Command completed with no output.</div>
                                )}
                            </div>

                            <div className="mt-4 pt-4 border-t border-[#1a1a1a] text-center">
                                <button
                                    onClick={() => setTerminalOutput(null)}
                                    className="text-[10px] uppercase text-[#666] hover:text-white transition-colors"
                                >
                                    Close Terminal
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FIXED CHATBOX (IDE REPL STYLE) */}
            <div className="chat-container">
                <div className="chat-box">
                    <span className="text-[#22c55e] mono text-sm select-none">
                        {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : "$"}
                    </span>
                    <input
                        type="text"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                if (filter.startsWith('npx')) {
                                    handleExecute(filter);
                                    setFilter('');
                                }
                            }
                        }}
                        placeholder={executing ? "EXECUTING COMMAND..." : bridgeStatus === 'active' ? "Search feed or enter command (npx...)" : "Execution Bridge Offline"}
                        className="chat-input"
                        disabled={executing || bridgeStatus !== 'active'}
                        autoFocus
                    />
                    <div className="flex gap-1.5 px-2">
                        <div className={`w-1 h-1 rounded-full ${executing ? 'bg-orange-500 animate-pulse' : 'bg-[#333]'}`} />
                        <div className={`w-1 h-1 rounded-full ${executing ? 'bg-orange-500 animate-pulse' : 'bg-[#333]'}`} />
                        <div className={`w-1 h-1 rounded-full ${executing ? 'bg-orange-500 animate-pulse' : 'bg-[#22c55e] animate-pulse'}`} />
                    </div>
                </div>
            </div>
        </div>
    );
}
