# Embedding Interactive Audio Hover Player in Wix Studio

## Overview
The player can be embedded in Wix Studio using an iframe or custom HTML element. The player supports loading configurations via URL parameter, making it easy to embed.

## Method 1: Using HTML iframe (Recommended)

### Step 1: Host Your Files
You need to host these files on a web server:
- `player.html`
- `interactive-audio-hover.js`
- Your exported config JSON file (with audio)

**Hosting Options:**
- **Wix Media Manager** (for config JSON only)
- **External hosting**: GitHub Pages, Netlify, Vercel, or your own server
- **CDN**: Upload to a CDN service

### Step 2: Upload Config File to Wix Media Manager
1. Go to your Wix site editor
2. Click **Media** → **My Uploads**
3. Upload your exported config JSON file
4. Right-click the file → **Copy Link**
5. Save this URL (you'll need it)

### Step 3: Add HTML iframe Element
1. In Wix Editor, add an **HTML iframe** element (or **Custom HTML**)
2. Set the iframe source to:
   ```
   https://your-hosted-domain.com/player.html?config=YOUR_CONFIG_URL
   ```
   Replace:
   - `your-hosted-domain.com` with where you're hosting `player.html`
   - `YOUR_CONFIG_URL` with the URL-encoded config file URL from Wix Media

**Example:**
```html
<iframe 
  src="https://yourdomain.com/player.html?config=https%3A%2F%2Fstatic.wixstatic.com%2Fmedia%2Fyour-config.json"
  width="100%" 
  height="600px"
  frameborder="0"
  allow="autoplay"
  style="border: none; background: transparent;">
</iframe>
```

### Step 4: Make it Responsive
Add this CSS to your Wix site (via **Settings** → **Custom Code** → **Add CSS**):
```css
.audio-player-iframe {
  width: 100%;
  height: 100vh;
  min-height: 600px;
  border: none;
  background: transparent;
}
```

## Method 2: Using Custom HTML Element (Full Control)

### Step 1: Host Files Externally
Host `player.html` and `interactive-audio-hover.js` on an external server.

### Step 2: Add Custom HTML Code
1. In Wix Editor, add **HTML Code** element
2. Paste this code:

```html
<div id="audio-player-container" style="width: 100%; height: 100vh; min-height: 600px; position: relative;">
  <iframe 
    id="audio-player-iframe"
    src="https://yourdomain.com/player.html?config=YOUR_CONFIG_URL"
    width="100%" 
    height="100%"
    frameborder="0"
    allow="autoplay; microphone"
    style="border: none; background: transparent; position: absolute; top: 0; left: 0;">
  </iframe>
</div>

<script>
  // Make iframe responsive
  function resizeIframe() {
    const container = document.getElementById('audio-player-container');
    const iframe = document.getElementById('audio-player-iframe');
    if (container && iframe) {
      iframe.style.height = container.offsetHeight + 'px';
    }
  }
  
  window.addEventListener('resize', resizeIframe);
  resizeIframe();
</script>
```

### Step 3: Configure Settings
- **Width**: 100% (or specific width)
- **Height**: Auto or specific height
- **Position**: As needed

## Method 3: Direct Embedding (Self-Contained)

If you want to embed directly without external hosting, you can create a single HTML file that includes everything inline.

### Create `player-embedded.html`:
This would be a modified version that includes the JavaScript inline and loads config from a parameter.

## Important Considerations

### 1. CORS (Cross-Origin Resource Sharing)
- If hosting files on different domains, ensure CORS headers are set correctly
- Wix Media files should be accessible from your player domain

### 2. File Size Limits
- Wix Media Manager has file size limits
- For large config files with embedded audio, consider:
  - Using external hosting (CDN)
  - Splitting audio files separately
  - Using the config URL parameter method

### 3. Mobile Responsiveness
The player is designed to be responsive. Ensure your iframe container is also responsive:
```css
.audio-player-wrapper {
  width: 100%;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

@media (max-width: 768px) {
  .audio-player-wrapper {
    height: 100vh;
  }
}
```

### 4. Autoplay Policies
- Modern browsers block autoplay with sound
- The player handles this gracefully (user interaction required)
- Ensure `allow="autoplay"` is set in iframe attributes

### 5. SSL/HTTPS
- Wix sites use HTTPS
- Your hosted player files must also use HTTPS
- Mixed content (HTTP iframe on HTTPS page) will be blocked

## Quick Setup Checklist

- [ ] Host `player.html` and `interactive-audio-hover.js` on external server
- [ ] Upload config JSON to Wix Media Manager (or external hosting)
- [ ] Get the config file URL
- [ ] URL-encode the config URL
- [ ] Add iframe or HTML element to Wix page
- [ ] Set iframe src with config parameter
- [ ] Test on desktop and mobile
- [ ] Verify audio plays correctly
- [ ] Check responsive behavior

## Example URLs

**Config hosted on Wix Media:**
```
https://yourdomain.com/player.html?config=https%3A%2F%2Fstatic.wixstatic.com%2Fmedia%2Fabc123-config.json
```

**Config hosted externally:**
```
https://yourdomain.com/player.html?config=https%3A%2F%2Fcdn.example.com%2Fconfigs%2Fmy-config.json
```

## Troubleshooting

### Player doesn't load
- Check browser console for errors
- Verify file URLs are correct and accessible
- Check CORS headers if loading from different domain

### Audio doesn't play
- Check browser autoplay policies
- Verify audio files are accessible
- Check browser console for audio context errors

### Config doesn't load
- Verify config URL is correctly URL-encoded
- Check config file is valid JSON
- Verify config file is accessible (try opening URL directly)

### Layout issues
- Ensure iframe has proper width/height
- Check z-index if elements overlap
- Verify responsive CSS is applied

## Advanced: Dynamic Config Loading

You can also load different configs dynamically using JavaScript:

```html
<iframe id="audio-player" src="about:blank" width="100%" height="600px"></iframe>

<script>
  function loadPlayerConfig(configUrl) {
    const iframe = document.getElementById('audio-player');
    const encodedUrl = encodeURIComponent(configUrl);
    iframe.src = `https://yourdomain.com/player.html?config=${encodedUrl}`;
  }
  
  // Load config on page load or button click
  loadPlayerConfig('https://static.wixstatic.com/media/your-config.json');
</script>
```
