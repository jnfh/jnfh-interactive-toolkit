# AV Spatial Mixer - Player Version

A polished, minimal player interface for end users. This version removes all developer/builder controls and provides a clean, immersive experience.

## Features

### Clean UI
- **Minimal Control Bar**: Only essential controls (play/pause, timeline, volume, fullscreen)
- **Auto-Hide Controls**: Control bar automatically hides after 3 seconds of inactivity during playback
- **Smooth Transitions**: Polished animations and transitions throughout
- **Loading States**: Visual feedback during media loading

### Keyboard Shortcuts
- `Space` - Play/Pause
- `←` / `→` - Seek backward/forward 5 seconds
- `↑` / `↓` - Increase/decrease volume by 10%
- `F` - Toggle fullscreen
- `M` - Mute/unmute
- `?` - Show/hide keyboard shortcuts help

### User Experience
- **Click to Play**: Click anywhere on the canvas to play/pause
- **Mouse Movement**: Moving the mouse shows controls temporarily
- **Touch Support**: Optimized for mobile and tablet devices
- **Fullscreen Mode**: Immersive fullscreen playback
- **Error Handling**: Clear error messages if media fails to load

## Setup

1. **Create a `config.json` file** in the same directory as `player.html`:

```json
{
  "version": "1.0",
  "video": {
    "url": "https://your-r2-bucket.r2.cloudflarestorage.com/base-video.mp4",
    "name": "Base Video",
    "preload": "metadata"
  },
  "videoLayers": [
    {
      "name": "Overlay Layer 1",
      "url": "https://your-r2-bucket.r2.cloudflarestorage.com/overlay-1.webm",
      "opacity": 1.0,
      "x": 0,
      "y": 0,
      "scaleX": 1.0,
      "scaleY": 1.0,
      "zIndex": 1,
      "visible": true,
      "offset": 0
    }
  ],
  "audio": [
    {
      "name": "Audio Track 1",
      "url": "https://your-r2-bucket.r2.cloudflarestorage.com/audio1.flac",
      "volume": 1.0,
      "muted": false
    }
  ],
  "settings": {
    "masterVolume": 1.0
  }
}
```

2. **Open `player.html`** in a web browser

The player will automatically:
- Load the configuration from `config.json`
- Load all video and audio files
- Initialize the spatial audio mixer
- Hide audio source visualization by default (clean experience)

## Customization

### Default Settings
- Audio sources are hidden by default (`showAudioSources: false`)
- Control bar auto-hides after 3 seconds of inactivity
- Master volume defaults to 100% (or value from config)

### Modifying Behavior
Edit `player.html` to customize:
- `CONTROL_BAR_HIDE_DELAY`: Change auto-hide delay (default: 3000ms)
- `showAudioSources`: Set to `true` to show audio source visualization
- Default volume, colors, and other UI elements

## Differences from Builder Version

| Feature | Builder (`index.html`) | Player (`player.html`) |
|---------|----------------------|----------------------|
| File Loaders | ✅ Yes | ❌ No (uses config.json) |
| Settings Panel | ✅ Full panel | ❌ Removed |
| Physics Controls | ✅ Yes | ❌ No |
| Reverb Controls | ✅ Yes | ❌ No |
| Spatial Audio Settings | ✅ Yes | ❌ No |
| Export Config | ✅ Yes | ❌ No |
| Position Readout | ✅ Yes | ❌ No |
| Keyboard Shortcuts | ❌ No | ✅ Yes |
| Auto-Hide Controls | ❌ No | ✅ Yes |
| Fullscreen Button | ❌ No | ✅ Yes |
| Click to Play | ❌ No | ✅ Yes |

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## Hosting

The player can be hosted on any static hosting service:
- **Netlify**: Drag and drop the folder
- **Cloudflare Pages**: Connect your Git repository
- **GitHub Pages**: Enable in repository settings
- **Cloudflare R2**: Use with Cloudflare Workers for dynamic config

## Tips for Best Experience

1. **Use Cloudflare R2** for hosting media files (see `CLOUDFLARE_R2_SETUP.md`)
2. **Optimize videos** before uploading (see `OPTIMIZATION_GUIDE.md`)
3. **Test on multiple devices** to ensure responsive design works
4. **Provide keyboard shortcuts hint** to users (press `?` in player)

