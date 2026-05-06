const calculateVol = (pulses: number[]) => {
    if (pulses.length <= 1) return "1.0/10 (STABLE)";
    const maxPulse = Math.max(...pulses);
    const minPulse = Math.min(...pulses);
    const mean = pulses.reduce((a, b) => a + b, 0) / pulses.length;
    const stdDev = Math.sqrt(pulses.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / pulses.length);
    const volScore = Math.min(10, 1 + (stdDev * 3));
    const intensity = volScore >= 8 ? "🔥 HIGH" : volScore >= 5 ? "⚠️ MODERATE" : "🟢 LOW";
    return `${volScore.toFixed(1)}/10 (${intensity}) | Spread: ${maxPulse} to ${minPulse}`;
};

console.log("Test 1 (Mixed):", calculateVol([9, 2, 5, 8, 3]));
console.log("Test 2 (Stable):", calculateVol([5, 5, 5]));
console.log("Test 3 (Slight):", calculateVol([5, 6, 5, 6]));
console.log("Test 4 (High):", calculateVol([1, 10, 1, 10]));
