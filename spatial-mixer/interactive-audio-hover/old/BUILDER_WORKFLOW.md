# Builder Workflow: From CMS to Wix Embed

## Complete Workflow

### Step 1: Get Your Audio Data

**Option A: From Wix CMS**
1. Export your CMS collection as JSON (or use HTTP Function)
2. Format should be: `[{url, title, color}, ...]`

**Option B: Manual JSON**
Create a JSON file like `london-tube-lines.json`:
```json
[
  {
    "url": "https://static.wixstatic.com/mp3/...",
    "title": "Central Line",
    "color": "#FF0000"
  }
]
```

### Step 2: Load in Builder

1. Open `builder.html`
2. Click **"Load from Wix CMS"**
3. Either:
   - Paste your JSON array in the textarea, OR
   - Enter a URL that returns your JSON array
4. Click **"Load from CMS Data"** or **"Fetch from URL"**
5. Click on the canvas to place all sources (they'll be arranged in a circle)

### Step 3: Arrange & Customize

1. **Drag sources** to position them exactly where you want
2. **Edit titles & colors** in the "Edit Sources" section
3. **Adjust settings:**
   - Master Volume (defaults to 50% in player)
   - Fade Radius & Speed
   - Physics & Movement
   - Spatial Audio & Reverb
4. **Test it out** - Click "Play All" and move your mouse around

### Step 4: Export Configuration

1. Click **"Export Configuration"** section
2. Click **"💾 Export Config (No Audio)"**
   - This exports positions, settings, colors, titles, and audio URLs
   - Audio files are NOT embedded (keeps file small)
   - Audio loads from URLs when player runs
3. Save the file (e.g., `london-tube-config.json`)

### Step 5: Deploy to Netlify

1. Create a folder with:
   - `index.html`
   - `player.html`
   - `interactive-audio-hover.js`
   - `london-tube-config.json` (your exported config)
2. Drag folder to Netlify
3. Get your URL: `https://your-site.netlify.app`

### Step 6: Embed in Wix

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

## What Gets Exported?

The builder export includes:

**Settings:**
- Master Volume
- Fade Radius & Speed
- Physics enabled/disabled & strength
- Drift, Orbital, Repulsion settings
- Spatial Audio & Reverb settings

**Sources:**
- Exact X, Y positions
- Base positions (for physics drift)
- Colors
- Titles (editable)
- Audio URLs
- Physics properties (orbital radius, speed, direction, etc.)

**Result:**
- Player loads with exact same layout as builder
- All settings preserved
- Audio loads from URLs (no embedded files)
- Ready to embed on Wix!

## Tips

1. **Test in Builder First** - Make sure everything works before exporting
2. **Use URLs, Not Embedded Audio** - Export "Config (No Audio)" to keep files small
3. **Save Multiple Versions** - Export different configs for different pages
4. **Update Easily** - Just update the JSON file on Netlify and redeploy

## Example Export Structure

```json
{
  "version": "1.0",
  "settings": {
    "masterVolume": 0.5,
    "fadeRadius": 500,
    "fadeSpeed": 0.5,
    "physicsEnabled": true,
    "physicsStrength": 1.0,
    ...
  },
  "sources": [
    {
      "name": "Central Line",
      "editableTitle": "Central Line",
      "color": "#FF0000",
      "x": 450,
      "y": 300,
      "audioUrl": "https://static.wixstatic.com/mp3/...",
      ...
    }
  ]
}
```

This is what gets loaded automatically in the player! 🎵

