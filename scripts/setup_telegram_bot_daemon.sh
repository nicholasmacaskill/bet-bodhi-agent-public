#!/bin/bash

# Configuration
PLIST_PATH="$HOME/Library/LaunchAgents/com.betbodhi.telegrambot.plist"
PROJECT_DIR="/Users/nicholasmacaskill/Downloads/bet-bodhi"
NODE_PATH="/Users/nicholasmacaskill/.nvm/versions/node/v20.19.6/bin/node"
TSX_PATH="${PROJECT_DIR}/node_modules/.bin/tsx"
BOT_SCRIPT="${PROJECT_DIR}/scripts/telegram-bot.ts"

echo "Creating launchd plist at $PLIST_PATH..."

# Write plist file to run telegram bot continuously
cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.betbodhi.telegrambot</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${TSX_PATH}</string>
        <string>${BOT_SCRIPT}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${PROJECT_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/Users/nicholasmacaskill/.nvm/versions/node/v20.19.6/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${PROJECT_DIR}/data/logs/telegram-bot.log</string>
    <key>StandardErrorPath</key>
    <string>${PROJECT_DIR}/data/logs/telegram-bot.err</string>
</dict>
</plist>
EOF

# Ensure logs directory exists
mkdir -p "$PROJECT_DIR/data/logs"

# Unload existing if configured, and load new agent
launchctl unload "$PLIST_PATH" 2>/dev/null
launchctl load "$PLIST_PATH"

echo "🚀 Telegram Bot daemon configured and started via launchd."
echo "Log files:"
echo "  Out: $PROJECT_DIR/data/logs/telegram-bot.log"
echo "  Err: $PROJECT_DIR/data/logs/telegram-bot.err"
