#!/bin/bash

# Configuration
PROJECT_DIR="/Users/nicholasmacaskill/Downloads/bet-bodhi"
SCRIPT_PATH="scripts/scanners/nightly_full_report.ts"
LOG_PATH="$PROJECT_DIR/data/logs/automation.log"

# Create log file if it doesn't exist
mkdir -p "$PROJECT_DIR/data/logs"
touch "$LOG_PATH"

# Cron Job Definition (3:15 AM Local)
# Source node environment then execute via npx tsx
CRON_JOB="15 3 * * * export PATH=\"/Users/nicholasmacaskill/.nvm/versions/node/v20.19.6/bin:\$PATH\" && cd $PROJECT_DIR && npx tsx $SCRIPT_PATH >> $LOG_PATH 2>&1"

# Trade pipeline: sync → pnl → enrich (3:00 AM Local)
PIPELINE_SCRIPT_PATH="scripts/run_trade_pipeline.sh"
SYNC_LOG_PATH="$PROJECT_DIR/data/logs/db_sync.log"
touch "$SYNC_LOG_PATH"
chmod +x "$PROJECT_DIR/$PIPELINE_SCRIPT_PATH"
SYNC_CRON_JOB="0 3 * * * $PROJECT_DIR/$PIPELINE_SCRIPT_PATH"

# Check if cron job already exists for report
(crontab -l | grep -F "$SCRIPT_PATH") > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Nightly automation is already scheduled."
else
    # Add to crontab
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "🚀 Nightly automation scheduled for 3:15 AM daily."
fi

# Check if cron job already exists for trade pipeline
(crontab -l | grep -F "$PIPELINE_SCRIPT_PATH") > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Daily trade pipeline automation is already scheduled."
else
    # Remove legacy sync-only cron if present
    crontab -l 2>/dev/null | grep -v "scripts/sync-on-chain-to-db.ts" | crontab - 2>/dev/null || true
    (crontab -l 2>/dev/null; echo "$SYNC_CRON_JOB") | crontab -
    echo "🚀 Daily trade pipeline scheduled for 3:00 AM (sync → pnl → enrich)."
fi
