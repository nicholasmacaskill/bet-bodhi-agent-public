#!/bin/bash
export PATH="/Users/nicholasmacaskill/.nvm/versions/node/v20.19.6/bin:$PATH"
cd /Users/nicholasmacaskill/Downloads/bet-bodhi

LOG_PATH="/Users/nicholasmacaskill/Downloads/bet-bodhi/data/logs/db_sync.log"
mkdir -p data/logs

echo "[$(date)] Starting trade pipeline (single process)..." >> "$LOG_PATH"
npx tsx scripts/run-trade-pipeline.ts >> "$LOG_PATH" 2>&1
EXIT=$?
echo "[$(date)] Trade pipeline finished (exit $EXIT)." >> "$LOG_PATH"
exit $EXIT