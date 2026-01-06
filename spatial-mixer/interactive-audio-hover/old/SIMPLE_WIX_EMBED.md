# Simple Wix Embed - Just Use the Netlify URL!

## Option 1: Just Filename (Simplest!)

You can now use just the filename in the URL parameter:

```html
<iframe 
  src="https://tubemusic-ux.netlify.app/player.html?config=audio-hover-config-1766186541092.json"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

**No need for the full URL!** The player automatically assumes the config file is on the same domain.

## Option 2: Rename to config.json (Even Simpler!)

If you rename your config file to `config.json` on Netlify, you can use just:

```html
<iframe 
  src="https://tubemusic-ux.netlify.app/player.html"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

**No config parameter needed!** It automatically loads `config.json`.

## Option 3: Full URL (Still Works)

You can still use the full URL if you prefer:

```html
<iframe 
  src="https://tubemusic-ux.netlify.app/player.html?config=https://tubemusic-ux.netlify.app/audio-hover-config-1766186541092.json"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

## Recommended: Option 1

Just use the filename - it's the simplest:

```html
<iframe 
  src="https://tubemusic-ux.netlify.app/player.html?config=audio-hover-config-1766186541092.json"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

## What Changed?

The player now:
- ✅ Accepts just a filename (assumes same domain)
- ✅ Automatically tries `config.json` if no parameter
- ✅ Still supports full URLs
- ✅ Auto-loads and auto-plays

## Test It

1. Make sure your config file is on Netlify: `audio-hover-config-1766186541092.json`
2. Test the URL: `https://tubemusic-ux.netlify.app/player.html?config=audio-hover-config-1766186541092.json`
3. Should load automatically!

That's it! Much simpler now! 🎵

