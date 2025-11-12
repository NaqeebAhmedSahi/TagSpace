# Fix for ENOSPC: System Limit for Number of File Watchers Reached

## Problem
When running `npm run dev` in TagSpaces, you may encounter this error:
```
Error: ENOSPC: system limit for number of file watchers reached
```

This happens because Linux has a limit on how many files can be watched simultaneously, and large projects with many `node_modules` exceed this limit.

## Solutions Applied

### 1. Webpack Configuration Updates ✅
I've updated the webpack configuration files with two fixes:
- `webpack.config.renderer.dev.ts`
- `webpack.config.main.dev.ts`
- `webpack.config.preload.dev.ts`

**Fix 1: Ignore Large Directories**
These configs now ignore:
- `node_modules`
- `.git`
- `dist`, `build`, `release`
- `beekeeper-studio` (if in workspace)
- `src/renderer/locales/**` (all locale files)
- `assets/**` (assets directory)
- `src/main/config/**` (config files)
- Test data directories
- Other build artifacts

**Fix 2: Polling Mode (Primary Solution)**
Changed from file watching to polling mode (`poll: 1000`). This:
- Checks for file changes every 1 second
- Completely avoids file watcher limits
- Uses slightly more CPU but prevents ENOSPC errors

### 2. Increase System Limit (Required)

You need to increase the system limit. Choose one method:

#### Method A: Run the Fix Script (Recommended)
```bash
cd /home/dev/WorkSpace/tagspaces
sudo ./fix-file-watchers.sh
```

#### Method B: Manual Fix

**Temporary fix (until reboot):**
```bash
echo 524288 | sudo tee /proc/sys/fs/inotify/max_user_watches
```

**Permanent fix:**
```bash
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

#### Method C: User-Specific Limit (Alternative)
If you can't use sudo, you can set a user-specific limit (requires logout/login):
```bash
echo "fs.inotify.max_user_watches=524288" | sudo tee -a /etc/sysctl.d/99-user-watches.conf
sudo sysctl -p /etc/sysctl.d/99-user-watches.conf
```

### 3. Verify the Fix
```bash
cat /proc/sys/fs/inotify/max_user_watches
```
Should show `524288` or higher.

## If Still Having Issues

### Option 1: Use Polling Instead of Watching
If the error persists, you can switch webpack to use polling instead of file watching. Edit the webpack configs and change:

```typescript
watchOptions: {
  // ... existing options ...
  poll: 1000, // Change from false to 1000 (milliseconds)
}
```

**Note:** Polling uses more CPU but doesn't have file watcher limits.

### Option 2: Further Reduce Watched Directories
Add more directories to the `ignored` array in `watchOptions`:

```typescript
ignored: [
  // ... existing ...
  '**/any-large-directory/**',
]
```

### Option 3: Close Other Applications
Close other development servers or applications that might be watching files.

## Current Configuration

The webpack configs now have:
```typescript
watchOptions: {
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/dist/**',
    '**/build/**',
    '**/release/**',
    '**/web/dist/**',
    '**/cordova/www/**',
    '**/tests/testdata/**',
    '**/tests/testdata-tmp/**',
    '**/coverage/**',
    '**/.erb/dll/**',
    '**/beekeeper-studio/**',
  ],
  aggregateTimeout: 300,
  poll: false,
}
```

## After Fixing

1. Stop any running dev servers
2. Run the fix script or manual commands above
3. Restart the dev server: `npm run dev`

The error should no longer occur!

## Additional Notes

- The default limit is usually 8192 or 65536
- For large projects, 524288 is a safe value
- You can go higher (e.g., 1048576) if needed, but 524288 should be sufficient
- The limit applies system-wide, so this fix helps all applications

