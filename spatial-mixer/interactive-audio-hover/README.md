# Interactive Audio Hover Tool

A tool for creating and sharing interactive audio experiences where audio sources respond to mouse movement on a 2D canvas.

## Files

- **builder.html** - The editor tool for creating and configuring audio experiences
- **player.html** - Standalone player for embedding and sharing experiences
- **interactive-audio-hover.js** - Core JavaScript library (used by both builder and player)

## Usage

### Creating an Experience (Builder)

1. Open `builder.html` in your browser
2. Click "Add Audio Files" to load audio files
3. Click on the canvas to place audio sources
4. Drag sources to reposition them
5. Adjust settings (fade radius, physics, etc.)
6. Export your configuration:
   - **Export Config (No Audio)**: Saves positions and settings only (smaller file, requires separate audio files)
   - **Export Config + Audio**: Includes audio files as base64 (larger file, self-contained)
   - **Copy Config to Clipboard**: Copies JSON to clipboard for quick sharing

### Sharing an Experience (Player)

#### Option 1: Self-contained (with audio)
1. Export using "Export Config + Audio" from builder
2. Share the JSON file
3. Users open `player.html` and load the JSON file

#### Option 2: Separate audio files
1. Export using "Export Config (No Audio)" from builder
2. Share the JSON file + original audio files
3. Users open `player.html`, load the JSON file, then add the audio files

#### Option 3: Embed with URL parameter
```html
<iframe src="player.html?config=https://yoursite.com/config.json"></iframe>
```

### Importing a Configuration

1. Open `builder.html` or `player.html`
2. Click "Load Config File" and select your JSON file
3. If the config doesn't include audio, click "Add Audio Files" and select the audio files
4. Click "Import Configuration" or "Load Configuration"

## Configuration Format

The exported JSON contains:

```json
{
  "version": "1.0",
  "settings": {
    "masterVolume": 1.0,
    "fadeRadius": 200,
    "fadeSpeed": 0.1,
    "physicsEnabled": true,
    "physicsStrength": 0.5,
    // ... more settings
  },
  "sources": [
    {
      "name": "audio.mp3",
      "editableTitle": "My Audio",
      "color": "#4CAF50",
      "x": 300,
      "y": 200,
      // ... position and physics settings
      "audioData": "base64encoded..." // Only if exported with audio
    }
  ]
}
```

## Features

- **Interactive Audio**: Audio sources fade in/out based on mouse proximity
- **Physics Movement**: Sources drift, orbit around cursor, and repel each other
- **Spatial Audio**: 3D audio positioning for realistic sound placement
- **Customizable**: Adjust fade radius, speed, physics strength, and more
- **Export/Import**: Save and share configurations
- **Embeddable**: Player can be embedded in websites or shared standalone

## Browser Compatibility

Requires modern browser with Web Audio API support:
- Chrome/Edge (recommended)
- Firefox
- Safari (may have limitations)

## Notes

- Audio files are converted to WAV format when exporting with audio (larger file size)
- Configurations without audio require matching audio files in the same order
- For best performance, use compressed audio formats (MP3, OGG) and keep file sizes reasonable
