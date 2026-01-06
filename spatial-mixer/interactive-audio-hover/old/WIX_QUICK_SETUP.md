# Quick Setup Guide: London Tube Lines Player on Wix

## Step 1: Create Your Configuration in the Builder

1. Open `builder.html` in your browser
2. Load your audio tracks:
   - Click **"Load from Wix CMS"**
   - Paste your JSON array (like `london-tube-lines.json`) or load from URL
   - Click on canvas to place sources
3. **Arrange your sources** - Drag them to the positions you want
4. **Adjust settings** - Set volume, physics, spatial audio, etc. to your liking
5. **Export configuration:**
   - Click **"Export Configuration"** section
   - Click **"💾 Export Config (No Audio)"** (since you're using URLs)
   - Save the JSON file (e.g., `london-tube-config.json`)

**Why export from builder?**
- ✅ Preserves exact source positions you arranged
- ✅ Saves all your settings (volume, physics, etc.)
- ✅ Includes colors and titles
- ✅ Uses audio URLs (no need to embed audio files)

## Step 2: Host All Files on Netlify

Host everything in one place on Netlify:
- `player.html`
- `interactive-audio-hover.js`
- Your exported config JSON (e.g., `london-tube-config.json`)

**File Structure:**
```
your-project/
├── index.html
├── player.html
├── interactive-audio-hover.js
└── london-tube-config.json  ← Your exported config from builder
```

**Deploy to Netlify:**
1. Go to [netlify.com](https://www.netlify.com)
2. Drag your project folder onto Netlify dashboard
3. Get your URL: `https://your-site.netlify.app`

**Your URLs will be:**
- Player: `https://your-site.netlify.app/player.html`
- Config: `https://your-site.netlify.app/london-tube-lines.json`

## Step 3: Embed in Wix

1. In Wix Editor, go to the page where you want the player
2. Click **Add** (+) → **Embed** → **HTML Code**
3. Paste this code (replace with your Netlify URL and config filename):

```html
<iframe 
  src="https://your-site.netlify.app/player.html?config=https://your-site.netlify.app/london-tube-config.json"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

**That's it!** No URL encoding needed since both URLs are on the same domain.

## Complete Example

If your Netlify site is: `https://london-tube-player.netlify.app`

**Embed Code:**
```html
<iframe 
  src="https://london-tube-player.netlify.app/player.html?config=https://london-tube-player.netlify.app/london-tube-config.json"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

## Alternative: Using Simple JSON Array (Without Builder)

If you want to skip the builder and just use the simple array format:

1. Use `london-tube-lines.json` (the simple array format)
2. The player will automatically convert it and place sources in a circle
3. You won't have custom positions or settings, but it's faster to set up

**But using the builder export is recommended!** You get exact positions and all your settings preserved.

## What Happens Automatically

✅ **Auto-loads** - The player automatically loads your JSON config from the URL  
✅ **Auto-plays** - Audio starts playing automatically (after user interaction due to browser policies)  
✅ **50% Volume** - Default master volume is set to 50% (or whatever you set in builder)  
✅ **Exact Positions** - Sources appear exactly where you placed them in the builder  
✅ **All Settings Preserved** - Physics, spatial audio, colors, titles - everything from your builder export  
✅ **No Manual Loading** - Everything loads automatically, no need to upload files again

## Features

- **7 London Tube Lines** with correct colors
- **Interactive** - Move mouse to explore different sounds
- **Full Screen** - Takes up the full viewport
- **Settings Panel** - Click the ⚙️ button to adjust settings
- **Responsive** - Works on mobile and desktop

## Troubleshooting

### Player doesn't load?
- Check that both URLs are correct
- Make sure JSON URL is URL-encoded
- Verify JSON file is accessible (try opening URL directly in browser)

### Audio doesn't play?
- Modern browsers require user interaction first (click anywhere on page)
- Check browser console (F12) for errors
- Verify audio file URLs in JSON are correct

### Volume too loud/quiet?
- Click the ⚙️ Settings button
- Adjust "Master Volume" slider
- Default is 50% but you can change it

## Tips

1. **Test First**: Open the player URL directly in a browser to test before embedding
2. **Mobile**: The player is responsive and works on mobile devices
3. **Multiple Players**: You can embed multiple players with different configs on different pages
4. **Update Config**: Just update the JSON file in Wix Media and the player will use the new version

That's it! Your London Tube Lines interactive audio player is now live on Wix! 🚇🎵

