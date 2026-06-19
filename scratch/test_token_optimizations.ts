import { compressContext, TokenTracker } from '../src/lib/agent/token-tracker';
import { db } from '../src/lib/sqlite-client';

async function runTest() {
    console.log("=== Testing Input Context Compressor ===");
    const rawContext = `
        This is a random sentence.
        Our drawdown limits are set to 5% maximum per day.
        Another irrelevant sentence about sports.
        Make sure you follow the rules regarding payouts and withdrawal limits.
        An error occurred during transaction execution.
        Special sentence about Yankees that has no other keywords.
    `;
    console.log("Compressed Context (default keywords only):\n", compressContext(rawContext));
    console.log("\nCompressed Context (query matching 'Yankees'):\n", compressContext(rawContext, "Deep analysis for Yankees"));
    console.log("\nCompressed Context (fallback, no matches):\n", compressContext("Some text with no matching words at all"));

    console.log("\n=== Testing SQLite Token Tracker Logging & Budget Check ===");
    
    // Clear out any old logs from today to make test predictable if needed, 
    // but better to just insert some mock values and see the response.
    db.prepare("DELETE FROM token_usage_logs WHERE model = 'test-model'").run();

    console.log("Logging normal usage...");
    TokenTracker.trackUsage('gemini-pro', { promptTokenCount: 1000, candidatesTokenCount: 200 });

    console.log("Logging usage that triggers warnings (exceeding budget)...");
    // Trigger >$2.00 usage ($2.00 limit)
    // gemini-pro input pricing: $0.50/1M = $0.0000005 per token
    // gemini-pro output pricing: $1.50/1M = $0.0000015 per token
    // If we request 3,000,000 input tokens and 1,000,000 output tokens:
    // 3M * $0.50 = $1.50
    // 1M * $1.50 = $1.50
    // Total = $3.00 (which is > $2.00 limit)
    TokenTracker.trackUsage('gemini-pro', { promptTokenCount: 3000000, candidatesTokenCount: 1000000 });

    // Inspect db entries
    const rows = db.prepare("SELECT * FROM token_usage_logs ORDER BY timestamp DESC LIMIT 2").all();
    console.log("\nRecent SQLite Logs:", JSON.stringify(rows, null, 2));
}

runTest().catch(console.error);
