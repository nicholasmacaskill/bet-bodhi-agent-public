#!/bin/bash
export PATH="/Users/nicholasmacaskill/.nvm/versions/node/v20.19.6/bin:$PATH"
cd /Users/nicholasmacaskill/Downloads/bet-bodhi
npx tsx scripts/scanners/nightly_full_report.ts >> /Users/nicholasmacaskill/Downloads/bet-bodhi/data/logs/automation.log 2>&1
