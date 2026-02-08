# Browser Cache Clearing Instructions

## The Problem

Your browser is likely caching the old JavaScript code. Even though the files have been updated on disk, the browser is still running the old code from its cache.

## Solution: Clear Browser Cache Completely

### Method 1: Hard Refresh (Quick)

**Windows/Linux:**
1. Open the app in browser
2. Press `Ctrl + Shift + Delete`
3. Select "Cached images and files"
4. Click "Clear data"
5. Close browser completely
6. Reopen and test

**OR** try:
- `Ctrl + F5` (hard reload)
- `Ctrl + Shift + R` (hard reload)

### Method 2: DevTools Cache Disable (Recommended)

1. Open browser DevTools (`F12`)
2. Go to **Network** tab
3. Check ✅ **"Disable cache"**
4. Keep DevTools open while testing
5. Refresh page (`F5`)

### Method 3: Clear All Browser Data

**Chrome/Edge:**
1. Press `Ctrl + Shift + Delete`
2. Select **"All time"** from time range
3. Check:
   - ✅ Browsing history
   - ✅ Cookies and other site data
   - ✅ Cached images and files
4. Click **"Clear data"**
5. Restart browser

**Firefox:**
1. Press `Ctrl + Shift + Delete`
2. Select **"Everything"** from time range
3. Check:
   - ✅ Browsing & Download History
   - ✅ Cookies
   - ✅ Cache
4. Click **"Clear Now"**
5. Restart browser

### Method 4: Incognito/Private Mode

1. Close all browser windows
2. Open **Incognito/Private** window:
   - Chrome/Edge: `Ctrl + Shift + N`
   - Firefox: `Ctrl + Shift + P`
3. Navigate to `http://localhost:3000`
4. Test the effects

### Method 5: Different Browser

If nothing works, try a completely different browser:
- If using Chrome → Try Firefox
- If using Firefox → Try Edge
- If using Edge → Try Chrome

## Verification Steps

After clearing cache:

1. **Open DevTools** (`F12`)
2. **Go to Console tab**
3. **Open Mixer** → Select a channel
4. **Add Reverb effect** → Open editor
5. **Look for console messages** (if I added debug logs)
6. **Test the knobs**:
   - Drag Decay up
   - Release
   - Immediately drag Damping up
   - Check if Decay stays put

## How to Know If Cache is Cleared

In DevTools Console, you should see:
- No "304 Not Modified" messages in Network tab
- All files show "200 OK" status
- File sizes match (not 0 bytes)

## Alternative: Restart Dev Server

Sometimes the webpack dev server needs a restart:

1. **Stop the server**: Press `Ctrl + C` in terminal (twice if needed)
2. **Wait 5 seconds**
3. **Start again**: `npm start`
4. **Wait for "Compiled successfully!"**
5. **Hard refresh browser**: `Ctrl + Shift + R`

## Nuclear Option: Delete node_modules/.cache

If absolutely nothing works:

```powershell
# In frontend directory
Remove-Item -Recurse -Force node_modules\.cache
npm start
```

This forces webpack to rebuild everything from scratch.

## Expected Behavior After Cache Clear

### ✅ Working (After Fix):
1. Drag Decay knob to 15.0s
2. Release
3. Drag Damping knob
4. **Decay stays at 15.0s** (doesn't jump)

### ❌ Broken (Old Cached Code):
1. Drag Decay knob to 15.0s
2. Release
3. Drag Damping knob
4. **Decay jumps initially** then stabilizes

## Debug: Check File Timestamp

To verify the file is actually updated:

```powershell
# In PowerShell
Get-Item "d:\New folder\Reson-Studio\frontend\src\components\EffectEditor.js" | Select-Object LastWriteTime
```

The LastWriteTime should be recent (within the last few minutes).

## Debug: Check File Content

Verify the flush logic is in the file:

```powershell
# Search for the flush comment
Select-String -Path "d:\New folder\Reson-Studio\frontend\src\components\EffectEditor.js" -Pattern "Flush any pending updates"
```

Should return line 632 and 677 (knob and slider handlers).

## If Still Not Working

1. **Check browser console** for JavaScript errors
2. **Check Network tab** for failed requests
3. **Verify webpack compiled** without errors
4. **Try a different port** (if 3000 is cached, try 3001)
5. **Restart computer** (last resort - clears all caches)

## Contact Points

If after all this it still doesn't work, the issue might be:
1. **React Fast Refresh** not picking up changes
2. **Service Worker** caching (check Application tab in DevTools)
3. **Proxy/CDN** caching (unlikely in localhost)
4. **Antivirus** interfering with file changes

## Quick Test Script

Run this in browser console to check if new code is loaded:

```javascript
// Check if flush logic exists
console.log('Testing effect editor...');
// Try to trigger an effect editor
// If console shows "[KNOB] Starting drag..." then new code is loaded
```

---

**TL;DR**: 
1. Open DevTools (`F12`)
2. Network tab → Check "Disable cache"
3. Hard refresh (`Ctrl + Shift + R`)
4. Test effects
