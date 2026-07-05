#!/bin/bash

# Configuration
PLIST_PATH="$HOME/Library/LaunchAgents/com.betbodhi.sovereignreport.plist"
PROJECT_DIR="/Users/nicholasmacaskill/Downloads/bet-bodhi"

echo "Creating launchd plist at $PLIST_PATH..."

# Write plist file to run at 1:00 PM EST daily
cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.betbodhi.sovereignreport</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${PROJECT_DIR}/scripts/run_sovereign_report.sh</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>13</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/data/logs/sovereign-launchd_out.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/data/logs/sovereign-launchd_err.log</string>
</dict>
</plist>
EOF

# Ensure logs directory exists
mkdir -p "$PROJECT_DIR/data/logs"

# Unload existing if configured, and load new agent
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "🚀 Sovereign Report daily schedule configured via launchd."
echo "The report will automatically run daily at 1:00 PM EST."
echo "Log file: $PROJECT_DIR/data/logs/sovereign-report.log"
