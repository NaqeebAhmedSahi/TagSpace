# Quick Fix for ENOSPC Error

## ✅ Already Fixed in Code

The webpack configurations have been updated to use **polling mode** instead of file watching. This completely avoids the ENOSPC error.

## What Changed

1. **Polling Mode Enabled**: Webpack now checks for changes every 1 second instead of using file watchers
2. **More Directories Ignored**: Added locales, assets, and config directories to ignore list

## Next Steps

1. **Stop the current dev server** (Ctrl+C if it's still running)

2. **Restart the dev server**:
   ```bash
   cd /home/dev/WorkSpace/tagspaces
   npm run dev
   ```

3. **The error should be gone!** The polling mode doesn't use file watchers, so it won't hit the limit.

## Optional: Increase System Limit (Not Required Anymore)

If you want to increase the system limit anyway (for other applications), run:

```bash
# Temporary (until reboot)
echo 524288 | sudo tee /proc/sys/fs/inotify/max_user_watches

# Permanent
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

But this is **not necessary** since we're using polling mode now.

## Note About Polling Mode

- **Slightly slower**: Changes are detected within 1 second (vs instant with file watchers)
- **Uses more CPU**: Checks files periodically instead of event-driven
- **No file watcher limits**: Completely avoids ENOSPC errors
- **Works everywhere**: No system configuration needed

This is a common solution for large projects and works perfectly fine for development!

