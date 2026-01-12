# AV Spatial Mixer - Synchronized Audio/Video Player

A professional tool for creating audiovisual content with synchronized multi-track audio and video playback. Perfect for interactive audio mixing, spatial audio panning, and creating synchronized multimedia experiences.

## Features

- **Synchronized Playback**: Play video and multiple audio tracks (4+) in perfect sync
- **Multi-Layer Video Support**: Composite multiple video layers with transparency support
- **Unified Timeline Control**: Single playhead that controls all media simultaneously
- **Optimized for Long Files**: Efficiently handles files from 4 minutes to 1+ hours using HTML5 Audio streaming (no full file memory loading)
- **Interactive Audio Mixing**: 
  - Individual volume control for each audio track
  - Stereo panning (left/right) for spatial positioning
  - Solo and mute controls per track
  - Master volume control
- **Professional Controls**: Play, pause, stop, restart, and seek functionality
- **Export/Import**: Save and load configurations for quick setup
- **Web Audio API**: High-quality audio processing and mixing with HTML5 Audio integration
- **Loading Progress**: Real-time progress indicators for long file loading

## Usage

### Basic Setup

1. Open `index.html` in a modern web browser
2. Click the **Settings** button (⚙️) in the top-right corner
3. Load your media files:
   - **Select Base Video (MP4)**: Choose your background/base video file (MP4 recommended)
   - **Select Video Layers (WebM with Alpha)**: Choose transparent overlay videos (WebM with alpha channel recommended)
   - **Select Audio Files (4+)**: Choose at least 4 audio files (FLAC recommended for quality)
   - All files should start from the same point for proper synchronization

### Controls

#### Transport Controls
- **Play/Pause**: Start or pause all media simultaneously
- **Stop**: Stop playback and return to start
- **Restart**: Stop and immediately start playback from the beginning

#### Timeline
- **Seek**: Click or drag on the timeline to jump to any position
- All audio and video will sync to the new position

#### Audio Mixing
Each audio track has:
- **Volume**: Control individual track volume (0-100%)
- **Pan**: Stereo positioning (-100% left to +100% right)
- **Solo**: Isolate a single track (mutes all others)
- **Mute**: Temporarily disable a track

#### Master Volume
- Global volume control affecting all audio tracks

### Export Configuration

1. Load your media files
2. Adjust volumes, pans, and settings as desired
3. Click **Export Config** in the settings panel
4. A JSON file will be downloaded with your current setup

**Note**: The exported config contains file paths/URLs, not the actual media files. Share both the config file and media files together.

### Import Configuration

1. Click **Load Config File** in the settings panel
2. Select a previously exported JSON configuration file
3. The player will attempt to load media from the paths specified in the config
4. For local files, you may need to manually select the files after loading the config

## File Formats

### Recommended Formats

**Video:**
- **Base/Background Video**: MP4 (H.264 codec) - Standard, widely supported
- **Transparent Overlays**: WebM (VP8/VP9 codec with alpha channel) - Best browser support for transparency
  - Alternative: MOV with PNG codec (larger files, perfect transparency)
  - Alternative: MP4 with HEVC/H.265 alpha (limited browser support, mainly Safari)

**Audio:**
- **FLAC** - Lossless quality, recommended for professional use
- MP3, AAC, OGG - Also supported

### Creating Transparent Videos

To create transparent video overlays:

1. **Using FFmpeg** (recommended):
   ```bash
   # Export as WebM with VP8 and alpha channel
   ffmpeg -i input.mov -c:v libvpx -pix_fmt yuva420p -auto-alt-ref 0 output.webm
   
   # Or VP9 for better compression
   ffmpeg -i input.mov -c:v libvpx-vp9 -pix_fmt yuva420p output.webm
   ```

2. **Using Adobe After Effects**:
   - Export as QuickTime MOV with Animation codec (supports alpha)
   - Or use Media Encoder to export as WebM with alpha

3. **Using Blender**:
   - Render with RGBA output
   - Export as FFmpeg Video with WebM/VP8 codec and RGBA pixel format

### Configuration JSON Structure

```json
{
  "version": "1.0",
  "video": {
    "url": "path/to/base-video.mp4",
    "duration": 120.5
  },
  "videoLayers": [
    {
      "name": "Overlay Layer 1",
      "url": "path/to/transparent-overlay.webm",
      "opacity": 1.0,
      "x": 0,
      "y": 0,
      "scaleX": 1.0,
      "scaleY": 1.0,
      "zIndex": 1,
      "visible": true,
      "offset": 0,
      "duration": 120.5
    }
  ],
  "audio": [
    {
      "name": "Track Name",
      "url": "path/to/audio.flac",
      "volume": 1.0,
      "pan": 0,
      "muted": false,
      "duration": 120.5
    }
  ],
  "settings": {
    "masterVolume": 1.0
  }
}
```

### Video Layer Properties

- **opacity**: Layer transparency (0.0 to 1.0)
- **x, y**: Position offset in pixels
- **scaleX, scaleY**: Scale factors (1.0 = 100%)
- **zIndex**: Rendering order (lower = behind, higher = in front)
- **visible**: Show/hide layer (true/false)
- **offset**: Start time offset in seconds (for delayed start)

## Browser Compatibility

Requires modern browser with support for:
- **Web Audio API**: For audio processing
- **HTML5 Video**: For video playback
- **File API**: For loading local files

Tested on:
- Chrome/Edge (recommended)
- Firefox
- Safari (may have limitations)

## Technical Details

### Synchronization

The player uses multiple techniques to maintain sync:
- Video playback drives the timeline
- Audio sources are started with calculated offsets
- Periodic sync checks (every ~500ms) prevent drift
- Unified seek function updates all media simultaneously
- Time difference corrections if sync drifts >100ms

### Audio Processing

- **HTML5 Audio Elements**: Used for efficient playback of long files (streaming, not full buffer loading)
- **Web Audio API Integration**: HTML5 audio is connected to Web Audio API via `createMediaElementSource`
- Each track has independent gain and pan nodes
- Master gain node for global volume control
- Real-time audio mixing and spatial positioning
- Memory efficient: Only loads metadata initially, streams audio during playback

### Long File Support

- Files are loaded with `preload='metadata'` for fast initial load
- Audio streams during playback rather than loading entire file into memory
- Progress tracking shows loading status for each file
- Works efficiently with files up to 1+ hours in length
- Timeline scrubbing works smoothly even with hour-long content

## Use Cases

- **Music Production**: Mix multiple instrument tracks with video
- **Podcast Production**: Sync multiple microphone tracks with video
- **Film/Video Editing**: Preview multi-channel audio mixes
- **Interactive Installations**: Create spatial audio experiences
- **Educational Content**: Demonstrate audio mixing techniques

## Tips

1. **File Preparation**: Ensure all audio and video files start from the same point for best synchronization
2. **File Formats**: 
   - Use MP4 for base videos (best compatibility)
   - Use WebM with VP8/VP9 for transparent overlays (best browser support)
   - Use FLAC for audio when quality is important, MP3/AAC for smaller file sizes
3. **File Sizes**: Keep file sizes reasonable for smooth loading and playback
4. **Video Layers**: 
   - Keep transparent overlays optimized (WebM with VP9 provides good compression)
   - Use appropriate z-index values to control layer order
   - Test opacity and positioning before finalizing
5. **Sync Check**: Use the timeline to verify all tracks and layers stay in sync throughout playback
6. **Export Often**: Save your configurations regularly to preserve your mix settings
7. **Performance**: Limit the number of video layers for optimal performance (recommended: 5-10 layers max)

## Troubleshooting

### Audio/Video Out of Sync
- Ensure all files start from the same point
- Check that files are fully loaded before playback
- Try restarting playback or seeking to resync

### Audio Not Playing
- Check browser autoplay policies (interaction may be required)
- Verify audio files are in supported formats
- Check browser console for errors
- Ensure volume is not muted and master volume is up

### Performance Issues
- Reduce the number of audio tracks if experiencing lag
- Use compressed audio formats
- Close other browser tabs/applications

## License

Based on the interactive-audio-hover tool. Free to use and modify.

