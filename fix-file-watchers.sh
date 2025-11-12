#!/bin/bash

# Script to fix ENOSPC: system limit for number of file watchers reached
# Run this script with sudo privileges

echo "Fixing file watcher limit issue..."

# Check current limit
CURRENT_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches)
echo "Current limit: $CURRENT_LIMIT"

# Set new limit (524288 is a good value for large projects)
NEW_LIMIT=524288

# Temporary fix (until reboot)
echo "Setting temporary limit to $NEW_LIMIT..."
echo $NEW_LIMIT | sudo tee /proc/sys/fs/inotify/max_user_watches

# Permanent fix
if ! grep -q "fs.inotify.max_user_watches" /etc/sysctl.conf; then
    echo "Adding permanent fix to /etc/sysctl.conf..."
    echo "fs.inotify.max_user_watches=$NEW_LIMIT" | sudo tee -a /etc/sysctl.conf
    echo "Permanent fix added. The limit will persist after reboot."
else
    echo "Limit already configured in /etc/sysctl.conf"
    # Update existing value
    sudo sed -i "s/fs.inotify.max_user_watches=.*/fs.inotify.max_user_watches=$NEW_LIMIT/" /etc/sysctl.conf
    sudo sysctl -p
fi

# Verify new limit
NEW_CURRENT=$(cat /proc/sys/fs/inotify/max_user_watches)
echo "New limit: $NEW_CURRENT"

if [ "$NEW_CURRENT" -ge "$NEW_LIMIT" ]; then
    echo "✅ File watcher limit successfully increased!"
    echo "You can now run 'npm run dev' without the ENOSPC error."
else
    echo "❌ Failed to set limit. Please run with sudo: sudo ./fix-file-watchers.sh"
fi

