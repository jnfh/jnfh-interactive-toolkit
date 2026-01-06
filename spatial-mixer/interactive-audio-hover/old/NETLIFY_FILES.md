# Files Needed for Netlify Deployment

## Required Files (Minimum)

Upload these 4 files to Netlify:

```
your-project-folder/
├── index.html                    ← Required by Netlify (redirects to player.html)
├── player.html                   ← The player interface
├── interactive-audio-hover.js    ← Main JavaScript file
└── your-config.json              ← Your exported config from builder
```

## File Descriptions

### 1. `index.html` ✅ REQUIRED
- **Purpose:** Netlify requires an `index.html` in the root
- **What it does:** Automatically redirects to `player.html`
- **Location:** Root of your project folder

### 2. `player.html` ✅ REQUIRED
- **Purpose:** The actual player interface
- **What it does:** Loads and displays the interactive audio player
- **Location:** Root of your project folder

### 3. `interactive-audio-hover.js` ✅ REQUIRED
- **Purpose:** Contains all the player logic
- **What it does:** Handles audio, physics, canvas drawing, etc.
- **Location:** Root of your project folder (same folder as player.html)

### 4. `your-config.json` ✅ REQUIRED (Your Config)
- **Purpose:** Your exported configuration from the builder
- **What it contains:** Source positions, settings, colors, titles, audio URLs
- **Example names:** `london-tube-config.json`, `my-audio-config.json`, etc.
- **Location:** Root of your project folder

## Optional: Organize Configs in Folder

If you have multiple configs, you can organize them:

```
your-project-folder/
├── index.html
├── player.html
├── interactive-audio-hover.js
└── configs/
    ├── london-tube-config.json
    ├── another-config.json
    └── yet-another-config.json
```

Then reference them as: `https://your-site.netlify.app/configs/london-tube-config.json`

## Complete Example Structure

```
london-tube-player/
├── index.html
├── player.html
├── interactive-audio-hover.js
└── london-tube-config.json
```

## How to Deploy

### Method 1: Drag & Drop (Easiest)

1. Create a folder with all 4 files
2. Go to [netlify.com](https://www.netlify.com)
3. Log in
4. Drag the folder onto the Netlify dashboard
5. Done! You'll get a URL like `https://random-name-123.netlify.app`

### Method 2: Git Repository (Recommended for Updates)

1. Create a GitHub repository
2. Upload all 4 files to the repository
3. In Netlify: **Add new site** → **Import from Git**
4. Connect GitHub and select your repository
5. Netlify auto-deploys (no build settings needed)

## After Deployment

Your files will be accessible at:
- Player: `https://your-site.netlify.app/player.html`
- Config: `https://your-site.netlify.app/your-config.json`

## Embed Code for Wix

```html
<iframe 
  src="https://your-site.netlify.app/player.html?config=https://your-site.netlify.app/your-config.json"
  width="100%" 
  height="100vh"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

## File Size Notes

- `index.html`: ~1 KB
- `player.html`: ~30-40 KB
- `interactive-audio-hover.js`: ~100-150 KB
- `your-config.json`: Varies (usually 5-50 KB depending on number of sources)

**Total:** Usually under 200 KB (very fast to load!)

## Important Notes

✅ **No build process needed** - Just upload the files  
✅ **No server-side code** - Everything is client-side JavaScript  
✅ **HTTPS automatically** - Netlify provides SSL  
✅ **Free hosting** - Netlify free tier is perfect for this  

## Checklist Before Deploying

- [ ] `index.html` is in the root folder
- [ ] `player.html` is in the root folder
- [ ] `interactive-audio-hover.js` is in the root folder
- [ ] Your config JSON file is in the root folder (or configs/ subfolder)
- [ ] Config file has correct audio URLs (test them in browser)
- [ ] All file names match what you reference in embed code

That's it! Just these 4 files and you're ready to go! 🚀

