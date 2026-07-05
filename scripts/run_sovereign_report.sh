#!/bin/bash
export PATH="/Users/nicholasmacaskill/.nvm/versions/node/v20.19.6/bin:$PATH"
cd /Users/nicholasmacaskill/Downloads/bet-bodhi

# Run the report generator
echo "[$(date)] Starting Daily Sovereign Report Scan (1:00 PM EST)..." >> /Users/nicholasmacaskill/Downloads/bet-bodhi/data/logs/sovereign-report.log
npx tsx scripts/scanners/nightly_full_report.ts >> /Users/nicholasmacaskill/Downloads/bet-bodhi/data/logs/sovereign-report.log 2>&1
echo "[$(date)] Daily Sovereign Report complete." >> /Users/nicholasmacaskill/Downloads/bet-bodhi/data/logs/sovereign-report.log
