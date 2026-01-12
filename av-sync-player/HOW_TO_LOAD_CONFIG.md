# How to Load Config File in AV Spatial Mixer

## Quick Steps

1. **Open the player:**
   - Open `index.html` in your web browser

2. **Open Settings:**
   - Click the **⚙️ Settings** button in the top-right corner

3. **Load Config File:**
   - In the settings panel, find **"📄 Load Config File"**
   - Click the button/label
   - Select your `jokulvatn-config.json` file

4. **Wait for Loading:**
   - A loading overlay will appear
   - The player will load all audio files from the URLs in your config
   - Progress will be shown

5. **Done!**
   - Once loaded, you can start playing
   - Audio sources will be positioned automatically based on their names

---

## Step-by-Step with Screenshots

### Step 1: Open the Player
- Navigate to the `av-sync-player` folder
- Double-click `index.html` to open in your browser
- Or right-click → "Open with" → Choose your browser

### Step 2: Open Settings Panel
- Look for the **⚙️ Settings** icon/button in the **top-right corner**
- Click it to open the settings panel

### Step 3: Find "Load Config File"
- Scroll down in the settings panel
- Look for the section with **"📄 Load Config File"**
- You'll see a file input button

### Step 4: Select Your Config File
- Click the **"📄 Load Config File"** button/label
- A file picker will open
- Navigate to your `jokulvatn-config.json` file
- Select it and click "Open"

### Step 5: Wait for Loading
- A loading overlay will appear showing progress
- The player will:
  - Load video (if specified in config)
  - Load video layers (if any)
  - Load all audio files from R2 URLs
- You'll see progress messages like:
  - "Loading configuration..."
  - "Loading audio files..."
  - "Loading: 50%"

### Step 6: Start Playing
- Once loading completes, the overlay disappears
- You'll see a success message: "Configuration loaded"
- Click **Play** to start playback
- Move your mouse/cursor to control spatial audio

---

## Troubleshooting

### Config File Not Loading

**Problem:** Nothing happens when selecting the file

**Solutions:**
1. Check browser console (F12 → Console tab) for errors
2. Verify JSON is valid (no syntax errors)
3. Make sure file extension is `.json`
4. Check that all URLs in config are accessible

### CORS Errors

**Problem:** Console shows "CORS policy" errors

**Solutions:**
1. Verify CORS is configured in R2 bucket settings
2. Check that `AllowedOrigins` includes your domain or `["*"]`
3. Ensure `AllowedMethods` includes `["GET", "HEAD"]`

### Files Not Loading

**Problem:** Config loads but audio files don't play

**Solutions:**
1. Test URLs directly in browser (should download/play)
2. Check file paths are correct in config
3. Verify files are uploaded to R2
4. Check file sizes are under 300MB
5. Verify file formats are supported (.opus, .flac, .m4a)

### Missing Audio Sources

**Problem:** Some audio tracks don't appear

**Solutions:**
1. Check config has all 5 audio entries
2. Verify all URLs are correct and accessible
3. Check browser console for specific error messages
4. Ensure audio files are actually uploaded to R2

---

## Alternative: Drag and Drop

Some browsers support drag-and-drop:
1. Open the player
2. Open Settings panel
3. Drag `jokulvatn-config.json` onto the "Load Config File" area
4. Release to load

---

## What Happens When Config Loads

1. **Video Loading:**
   - If `video.url` is specified, loads base video
   - Shows loading progress

2. **Video Layers:**
   - Loads any video layers specified in `videoLayers` array
   - Composites them together

3. **Audio Loading:**
   - Loads each audio file from URLs in `audio` array
   - Creates spatial audio sources
   - Auto-positions sources based on channel names:
     - "LEFT FRONT" → top-left
     - "RIGHT FRONT" → top-right
     - "LEFT SURROUND" → bottom-left
     - "RIGHT SURROUND" → bottom-right
     - "FULL MIX" → center (if present)

4. **Settings Applied:**
   - Master volume from `settings.masterVolume`
   - Individual track volumes from `audio[].volume`
   - Pan settings from `audio[].pan`

---

## Config File Requirements

Your config file must have:
- ✅ `version`: "1.0"
- ✅ `video`: Object with `url` (can be empty string if no video)
- ✅ `videoLayers`: Array (can be empty `[]`)
- ✅ `audio`: Array with at least 4 audio objects
- ✅ `settings`: Object with `masterVolume`
- ✅ `annotations`: Array (can be empty `[]`)

Each audio object needs:
- ✅ `name`: Display name
- ✅ `url`: Full URL to audio file
- ✅ `volume`: 0.0 to 1.0
- ✅ `pan`: -1.0 (left) to 1.0 (right)
- ✅ `muted`: true/false
- ✅ `duration`: Duration in seconds

---

## Quick Test

After loading config, test that everything works:

1. **Check Audio Sources:**
   - Look at the canvas - you should see dots for each audio source
   - Move your mouse - audio should fade based on distance

2. **Test Playback:**
   - Click Play
   - Audio should start playing
   - Move mouse around - volume should change

3. **Check Controls:**
   - Settings panel should show all 5 audio tracks
   - Volume sliders should work
   - Mute/Solo buttons should work

---

## Need Help?

If config still doesn't load:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error messages
4. Check Network tab to see if files are loading
5. Verify your config JSON is valid (use JSON validator)

