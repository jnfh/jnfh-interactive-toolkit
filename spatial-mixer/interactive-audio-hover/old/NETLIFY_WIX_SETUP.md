# Deploying Player to Netlify & Embedding in Wix

## Step-by-Step Guide

### Part 1: Deploy to Netlify

#### Step 1: Prepare Your Files
You need these files ready:
- `index.html` (required by Netlify - redirects to player.html)
- `player.html`
- `interactive-audio-hover.js`
- Your exported config JSON file (with audio embedded)

**File Structure:**
```
your-project-folder/
├── index.html (required - redirects to player.html)
├── player.html
├── interactive-audio-hover.js
└── (optional) configs/
    └── my-config.json
```

**Important:** Netlify requires an `index.html` file in the root folder. The provided `index.html` automatically redirects to `player.html`, so your player URL will still work as `https://your-site.netlify.app/player.html`.

#### Step 2: Create Netlify Account
1. Go to [netlify.com](https://www.netlify.com)
2. Sign up for free account (GitHub, Email, or Google)
3. Verify your email if needed

#### Step 3: Deploy via Drag & Drop (Easiest Method)

**Option A: Drag & Drop**
1. Log into Netlify dashboard
2. Go to **Sites** tab
3. Drag your project folder (containing `index.html`, `player.html`, and `interactive-audio-hover.js`) onto the Netlify dashboard
4. Netlify will automatically deploy your site
5. You'll get a URL like: `https://random-name-123456.netlify.app`

**Option B: Deploy via Git (Recommended for Updates)**
1. Create a GitHub repository
2. Upload your files to the repository
3. In Netlify dashboard, click **Add new site** → **Import an existing project**
4. Connect your GitHub account
5. Select your repository
6. Netlify will auto-detect settings (no build command needed)
7. Click **Deploy site**

#### Step 4: Verify Deployment
1. Visit your Netlify URL: `https://your-site.netlify.app`
2. You should see the player loading screen
3. Test loading a config file to ensure everything works

#### Step 5: Get Your Player URL
Your player URL will be:
```
https://your-site.netlify.app/player.html
```

**Note:** If you named your HTML file `index.html` instead of `player.html`, the URL would just be:
```
https://your-site.netlify.app/
```

---

### Part 2: Upload Config File

You have **three options** for hosting your config file. Choose whichever is easiest for you:

#### Option A: Upload to Netlify (Recommended - Keeps Everything Together)

**Method 1: Via Git Repository (Best for Updates)**
1. Create a `configs/` folder in your project
2. Add your config JSON file to `configs/my-config.json`
3. Push to GitHub
4. Netlify will auto-deploy
5. File accessible at: `https://your-site.netlify.app/configs/my-config.json`

**Method 2: Via Netlify Dashboard**
1. Go to your site in Netlify dashboard
2. Click **Deploys** tab → **Browse to upload**
3. Drag your config JSON file
4. File accessible at: `https://your-site.netlify.app/configs/my-config.json`

**Pros:** Everything in one place, easy to manage  
**Cons:** Requires redeploying if you update config

#### Option B: Upload to Wix Media Manager (Easiest - No Redeploy Needed)

1. Go to your Wix site editor
2. Click **Media** → **My Uploads**
3. Upload your config JSON file
4. Right-click the file → **Copy Link**
5. You'll get a URL like: `https://static.wixstatic.com/media/abc123-config.json`

**Pros:** Easy to update without redeploying Netlify  
**Cons:** Config is separate from player files

#### Option C: Any Other Hosting/CDN

You can host the config file on:
- Your own server
- AWS S3
- Google Cloud Storage
- Any CDN service
- GitHub (raw file URL)

**Just make sure:** The URL is publicly accessible and uses HTTPS

---

### Part 3: Embed in Wix

#### Step 1: Get Your Config URL

**You can host the config file anywhere!** Common options:

- **Netlify:** `https://your-site.netlify.app/configs/my-config.json`
- **Wix Media:** `https://static.wixstatic.com/media/abc123-config.json`
- **GitHub:** `https://raw.githubusercontent.com/username/repo/main/config.json`
- **Any CDN/Server:** `https://your-cdn.com/path/to/config.json`

**Important:** The config file URL must be:
- Publicly accessible (no authentication)
- HTTPS (not HTTP)
- Returns valid JSON when accessed directly

#### Step 2: URL Encode the Config URL
You need to URL-encode your config URL. Use an online tool like:
- [URL Encoder](https://www.urlencoder.org/)
- Or JavaScript: `encodeURIComponent('your-config-url')`

**Example:**
```
Original: https://your-site.netlify.app/configs/my-config.json
Encoded: https%3A%2F%2Fyour-site.netlify.app%2Fconfigs%2Fmy-config.json
```

#### Step 3: Add HTML Code Element in Wix

1. **Open Wix Editor:**
   - Go to your Wix site editor
   - Navigate to the page where you want the player

2. **Add HTML Element:**
   - Click **Add** (+) button
   - Go to **Embed** → **HTML Code**
   - Or search for "HTML" in the add menu

3. **Paste This Code:**
   ```html
   <div id="audio-player-wrapper" style="width: 100%; height: 100vh; min-height: 600px; position: relative; background: transparent;">
     <iframe 
       id="audio-player-iframe"
       src="https://your-site.netlify.app/player.html?config=YOUR_ENCODED_CONFIG_URL"
       width="100%" 
       height="100%"
       frameborder="0"
       allow="autoplay; microphone"
       style="border: none; background: transparent; position: absolute; top: 0; left: 0; width: 100%; height: 100%;">
     </iframe>
   </div>

   <script>
     // Make iframe responsive
     (function() {
       const wrapper = document.getElementById('audio-player-wrapper');
       const iframe = document.getElementById('audio-player-iframe');
       
       if (!wrapper || !iframe) return;
       
       function resizeIframe() {
         if (wrapper && iframe) {
           const height = wrapper.offsetHeight || window.innerHeight;
           iframe.style.height = height + 'px';
         }
       }
       
       window.addEventListener('resize', resizeIframe);
       resizeIframe();
     })();
   </script>
   ```

4. **Replace Placeholders:**
   - Replace `https://your-site.netlify.app/player.html` with your actual Netlify URL
   - Replace `YOUR_ENCODED_CONFIG_URL` with your URL-encoded config file URL

**Complete Example:**
```html
<iframe 
  src="https://my-audio-player.netlify.app/player.html?config=https%3A%2F%2Fmy-audio-player.netlify.app%2Fconfigs%2Fmy-config.json"
  width="100%" 
  height="600px"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

#### Step 4: Configure Element Settings

1. **Size & Position:**
   - Set width to **100%** (or desired width)
   - Set height to **600px** or **100vh** (full viewport height)
   - Position as needed on your page

2. **Mobile Settings:**
   - Ensure responsive behavior is enabled
   - Test on mobile preview

#### Step 5: Publish & Test

1. Click **Publish** in Wix editor
2. Visit your live site
3. Test the player:
   - Config should load automatically
   - Audio should play when you move mouse
   - Settings panel should work

---

## Quick Reference

### Your URLs:
- **Player URL:** `https://your-site.netlify.app/player.html`
- **Config URL (Netlify):** `https://your-site.netlify.app/configs/my-config.json`
- **Config URL (Wix Media):** `https://static.wixstatic.com/media/abc123-config.json`

### Final Embed Code Template:
```html
<iframe 
  src="YOUR_PLAYER_URL?config=YOUR_ENCODED_CONFIG_URL"
  width="100%" 
  height="600px"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

---

## Troubleshooting

### Player doesn't load
- ✅ Check Netlify deployment is live (green status)
- ✅ Verify player.html URL is correct
- ✅ Check browser console for errors
- ✅ Ensure HTTPS is used (not HTTP)

### Config doesn't load
- ✅ Verify config URL is accessible (try opening directly in browser)
- ✅ Check URL encoding is correct
- ✅ Verify CORS headers (Netlify should handle this automatically)
- ✅ Check config file is valid JSON

### Audio doesn't play
- ✅ Check browser autoplay policies (user interaction required)
- ✅ Verify audio files are embedded in config
- ✅ Check browser console for audio errors
- ✅ Test config file in builder first

### Layout issues
- ✅ Ensure iframe has proper width/height
- ✅ Check responsive settings in Wix
- ✅ Verify no CSS conflicts
- ✅ Test on different screen sizes

---

## Advanced: Custom Domain (Optional)

If you want a custom domain:

1. In Netlify dashboard → **Domain settings**
2. Click **Add custom domain**
3. Enter your domain (e.g., `player.yourdomain.com`)
4. Follow DNS setup instructions
5. Update your embed code with new domain

---

## Tips

1. **File Organization:**
   - Keep configs in a `configs/` folder for organization
   - Use descriptive filenames: `circle-line-audio.json`

2. **Multiple Configs:**
   - Upload multiple config files to Netlify
   - Change the `config=` parameter to load different configs
   - Create a simple page with buttons to switch configs

3. **Performance:**
   - Large config files with embedded audio may take time to load
   - Consider showing a loading indicator
   - Test on slower connections

4. **Security:**
   - Netlify provides HTTPS automatically
   - Config files are publicly accessible (by design)
   - Don't include sensitive data in configs

---

## Example: Complete Setup

### Example 1: Config on Netlify

**Netlify Site:** `https://my-audio-player.netlify.app`

**Files on Netlify:**
```
/
├── index.html (redirects to player.html)
├── player.html
├── interactive-audio-hover.js
└── configs/
    └── circle-line.json
```

**Wix Embed Code:**
```html
<iframe 
  src="https://my-audio-player.netlify.app/player.html?config=https%3A%2F%2Fmy-audio-player.netlify.app%2Fconfigs%2Fcircle-line.json"
  width="100%" 
  height="600px"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

### Example 2: Config on Wix Media (Easier Updates)

**Netlify Site:** `https://my-audio-player.netlify.app`  
**Config on Wix:** `https://static.wixstatic.com/media/abc123-config.json`

**Files on Netlify:**
```
/
├── index.html
├── player.html
└── interactive-audio-hover.js
```

**Wix Embed Code:**
```html
<iframe 
  src="https://my-audio-player.netlify.app/player.html?config=https%3A%2F%2Fstatic.wixstatic.com%2Fmedia%2Fabc123-config.json"
  width="100%" 
  height="600px"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

**Note:** If your config uses audio URLs (from Wix Media), you don't need to include the config in Netlify at all - just host it on Wix Media and reference it!

That's it! Your player should now work on your Wix site. 🎵
