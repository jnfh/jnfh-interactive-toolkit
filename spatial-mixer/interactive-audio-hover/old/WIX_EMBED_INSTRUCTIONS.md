# How to Embed Player on Wix with Auto-Load & Auto-Play

## Step-by-Step Instructions

### Step 1: Get Your URLs

After deploying to Netlify, you'll have:
- **Player URL:** `https://your-site.netlify.app/player.html`
- **Config URL:** `https://your-site.netlify.app/your-config.json`

### Step 2: Add HTML Code Element in Wix

1. **Open Wix Editor**
   - Go to your Wix site editor
   - Navigate to the page where you want the player

2. **Add HTML Element**
   - Click **Add** (+) button (top left)
   - Go to **Embed** → **HTML Code**
   - Or search for "HTML" in the add menu

3. **Paste This Code:**

```html
<iframe 
  id="audio-player-iframe"
  src="https://your-site.netlify.app/player.html?config=https://your-site.netlify.app/your-config.json"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

4. **Replace the URLs:**
   - Replace `https://your-site.netlify.app` with your actual Netlify URL
   - Replace `your-config.json` with your actual config filename

### Step 3: Configure Element Settings

1. **Size Settings:**
   - **Width:** Set to **100%** (or "Full Width")
   - **Height:** Set to **100vh** or **600px** (or "Full Height")
   - Make it **Full Width** and **Full Height** for best results

2. **Position:**
   - Position it where you want on the page
   - Can be full page or in a specific section

3. **Mobile Settings:**
   - Ensure it's responsive
   - Test in mobile preview

### Step 4: Publish & Test

1. Click **Publish** in Wix editor
2. Visit your live site
3. The player should:
   - ✅ Auto-load the config from the URL
   - ✅ Auto-play after a short delay (500ms)
   - ✅ Show all sources in their exact positions
   - ✅ Start at 50% volume

## Complete Example

If your Netlify site is: `https://london-tube-player.netlify.app`  
And your config is: `london-tube-config.json`

**Embed Code:**
```html
<iframe 
  id="audio-player-iframe"
  src="https://london-tube-player.netlify.app/player.html?config=https://london-tube-player.netlify.app/london-tube-config.json"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

## How Auto-Load Works

The player automatically:
1. Checks for `?config=` URL parameter
2. Fetches the JSON file from that URL
3. Loads all sources with their positions and settings
4. Hides the loading overlay
5. Shows the canvas with all sources

**No manual file upload needed!** Everything loads from URLs.

## How Auto-Play Works

The player automatically:
1. Starts playing after config loads (500ms delay)
2. All sources start at volume 0
3. Sources fade in/out based on mouse position
4. User interaction may be required (browser autoplay policies)

**Note:** Modern browsers (Chrome, Safari, Firefox) require user interaction before audio can play. The player will:
- Load everything automatically
- Start the audio context
- Wait for user to click/tap anywhere on the page
- Then audio will play

## Advanced: Full Page Embed

If you want the player to take up the entire page:

```html
<div style="position: fixed; top: 0; left: 0; width: 100%; height: 100vh; z-index: 9999; margin: 0; padding: 0;">
  <iframe 
    id="audio-player-iframe"
    src="https://your-site.netlify.app/player.html?config=https://your-site.netlify.app/your-config.json"
    width="100%" 
    height="100%"
    frameborder="0"
    allow="autoplay"
    style="border: none; background: transparent; position: absolute; top: 0; left: 0;">
  </iframe>
</div>
```

## Troubleshooting

### Player doesn't load?
- ✅ Check both URLs are correct
- ✅ Test config URL directly in browser (should show JSON)
- ✅ Check browser console (F12) for errors
- ✅ Make sure Netlify site is published

### Audio doesn't play automatically?
- ✅ This is normal - browsers block autoplay with sound
- ✅ User needs to click/tap anywhere on the page first
- ✅ After first click, audio will play
- ✅ This is a browser security feature, not a bug

### Config doesn't load?
- ✅ Verify config URL is accessible (open in browser)
- ✅ Check JSON is valid (use JSON validator)
- ✅ Make sure config file is on Netlify
- ✅ Check browser console for fetch errors

### Layout issues?
- ✅ Set iframe width to 100%
- ✅ Set iframe height to 100vh or specific pixels
- ✅ Remove any padding/margins on container
- ✅ Test on mobile preview

## Quick Checklist

- [ ] Player URL is correct
- [ ] Config URL is correct
- [ ] Config file is uploaded to Netlify
- [ ] Iframe has `allow="autoplay"` attribute
- [ ] Width set to 100%
- [ ] Height set to 100vh or specific pixels
- [ ] Published site and tested

## Pro Tips

1. **Test First:** Open player URL directly in browser before embedding
2. **Multiple Configs:** Create different configs for different pages
3. **Update Easily:** Just update JSON file on Netlify and redeploy
4. **Mobile:** Player is responsive, works on all devices
5. **Settings:** Users can click ⚙️ button to adjust settings

That's it! Your player will auto-load and auto-play on Wix! 🎵

