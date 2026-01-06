# Your Wix Embed Code

## Your Netlify Site
**Player URL:** `https://tubemusic-ux.netlify.app/player.html`

## Step 1: Upload Your Config File

Make sure you've uploaded your exported config JSON file to Netlify. For example:
- `london-tube-config.json`
- Or whatever you named your exported config

**Your config URL will be:**
```
https://tubemusic-ux.netlify.app/your-config.json
```

## Step 2: Embed in Wix

1. **In Wix Editor:**
   - Go to the page where you want the player
   - Click **Add** (+) → **Embed** → **HTML Code**

2. **Paste this code** (replace `your-config.json` with your actual config filename):

```html
<iframe 
  src="https://tubemusic-ux.netlify.app/player.html?config=https://tubemusic-ux.netlify.app/your-config.json"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

## Example with London Tube Config

If your config file is named `london-tube-config.json`:

```html
<iframe 
  src="https://tubemusic-ux.netlify.app/player.html?config=https://tubemusic-ux.netlify.app/london-tube-config.json"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

## What Happens

✅ **Auto-loads** - Config loads automatically from the URL  
✅ **Auto-plays** - Starts playing after 500ms (may need user click first due to browser policies)  
✅ **50% Volume** - Default volume is 50%  
✅ **Exact Positions** - Sources appear where you placed them in builder  

## Quick Checklist

- [ ] Config JSON file uploaded to Netlify
- [ ] Config filename matches what's in the embed code
- [ ] Iframe width set to 100%
- [ ] Iframe height set to 100vh
- [ ] Published and tested

## Test Your Config URL

Before embedding, test that your config file is accessible:
- Open: `https://tubemusic-ux.netlify.app/your-config.json`
- Should show your JSON file
- If you see 404, the file isn't uploaded yet

That's it! Your player will auto-load and auto-play on Wix! 🎵

