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

# Check if cron job already exists
(crontab -l | grep -F "$SCRIPT_PATH") > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Nightly automation is already scheduled."
else
    # Add to crontab
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "🚀 Nightly automation scheduled for 3:15 AM daily."
fi
