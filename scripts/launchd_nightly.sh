#!/bin/bash

# Define strict PATH for Node.js
export PATH="/Users/nicholasmacaskill/.nvm/versions/node/v20.19.6/bin:$PATH"

# Navigate to project directory
cd /Users/nicholasmacaskill/Downloads/bet-bodhi

# Ensure logs directory exists
mkdir -p data/logs

# Execute the scanner using npx tsx and log the output
echo "[$(date)] Starting BODHI-8 LaunchAgent Scan..." >> data/logs/automation.log
npx tsx scripts/scanners/nightly_full_report.ts >> data/logs/automation.log 2>&1
echo "[$(date)] Starting BODHI Performance Audit..." >> data/logs/automation.log
/usr/bin/python3 scripts/daily-audit.py >> data/logs/automation.log 2>&1
echo "[$(date)] Automation suite completed." >> data/logs/automation.log
