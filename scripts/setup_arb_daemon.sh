#!/bin/bash

# Configuration
PLIST_PATH="$HOME/Library/LaunchAgents/com.betbodhi.arbscanner.plist"
PROJECT_DIR="/Users/nicholasmacaskill/Downloads/bet-bodhi"
NODE_PATH="/Users/nicholasmacaskill/.nvm/versions/node/v20.19.6/bin"

echo "Creating launchd plist at $PLIST_PATH..."

# Write plist file
cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.betbodhi.arbscanner</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}/node</string>
        <string>${PROJECT_DIR}/node_modules/.bin/tsx</string>
        <string>${PROJECT_DIR}/scripts/polymarket-arb-scanner.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>${NODE_PATH}:/usr/bin:/bin:/usr/sbin:/sbin</string>
        <key>TS_NODE_PROJECT</key>
        <string>tsconfig.hardhat.json</string>
    </dict>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/data/logs/arb-scanner.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/data/logs/arb-scanner.err</string>
</dict>
</plist>
EOF

# Ensure logs directory exists
mkdir -p "$PROJECT_DIR/data/logs"

# Unload existing if running, and load new configuration
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "🚀 Polymarket Arbitrage Scanner has been configured as a launchd daemon."
echo "It will run persistently in the background on your system (surviving restarts)."
echo "Log files are at:"
echo " - Stdout: $PROJECT_DIR/data/logs/arb-scanner.log"
echo " - Stderr: $PROJECT_DIR/data/logs/arb-scanner.err"
