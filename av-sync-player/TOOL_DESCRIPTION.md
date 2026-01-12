# AV Spatial Mixer - Comprehensive Tool Description

## Overview

The AV Spatial Mixer is an innovative web-based audiovisual player that creates immersive, interactive spatial audio experiences. It combines synchronized multi-track audio playback with multi-layer video compositing, allowing users to explore soundscapes through cursor movement that dynamically adjusts audio volume and spatial positioning in real-time.

## Core Concept

The tool transforms traditional linear audio playback into a **spatial, interactive experience**. Instead of passively listening, users actively explore the soundscape by moving their cursor (or finger on touch devices) across a canvas. Each audio source responds to proximity—sounds grow louder and clearer as you approach them, fade away as you move further, creating a sense of physical navigation through an audio landscape.

## Key Features

### 1. Spatial Audio System

**Interactive Audio Positioning:**
- Multiple audio sources (4+ tracks) are positioned on a 2D canvas
- Each source represents a distinct sound element (e.g., different field recording locations, instruments, or environmental sounds)
- Audio volume dynamically responds to cursor proximity using a distance-based fade algorithm
- At the center "sweet spot," all sounds play at boosted volume (2.25x), creating a full-spectrum listening experience
- As you move away from sources, they fade smoothly based on distance (configurable fade radius, default 1000px)

**Real-Time Audio Reactivity:**
- Visual indicators respond to actual audio levels in real-time
- Each source analyzes its audio signal using Web Audio API's AnalyserNode
- Visual elements (dots, glows, connecting lines) pulse and react based on the audio playing
- Creates a direct visual-audio connection, making the soundscape "visible"

**3D Spatial Audio Processing:**
- Uses Web Audio API's HRTF (Head-Related Transfer Function) panner for realistic 3D spatialization
- Converts 2D canvas positions to 3D audio space
- Provides immersive binaural audio experience through standard headphones
- Optional reverb processing adds environmental depth and realism

### 2. Multi-Layer Video Compositing

**Layered Visual Experience:**
- Base video layer (MP4) provides background/context
- Multiple transparent overlay layers (WebM with alpha channel) can be composited
- Each layer has independent control:
  - Position (x, y offset)
  - Scale (scaleX, scaleY)
  - Opacity (0.0 to 1.0)
  - Z-index (rendering order)
  - Time offset (delayed start)
- All layers synchronized to the same timeline

**Canvas-Based Compositing:**
- Uses HTML5 Canvas API for real-time video compositing
- Efficient rendering pipeline optimized for performance
- Supports transparency for layered visual storytelling
- Centered display aligned with audio spatial canvas

### 3. Synchronized Playback

**Unified Timeline:**
- Single playhead controls all audio tracks and video layers simultaneously
- Perfect synchronization maintained through periodic resync checks
- Handles long-form content efficiently (tested up to 1+ hours)
- Smooth seeking/scrubbing across entire duration

**Efficient Long-File Handling:**
- Uses HTML5 Audio streaming (not full file loading)
- Metadata-only preloading for fast initial load
- Progressive loading during playback
- Memory-efficient for hour-long pieces

### 4. Visual Feedback System

**Audio Source Visualization:**
- Each audio source appears as a white dot on the canvas
- Dots react to audio levels: size, opacity, and glow intensity respond to the actual sound
- Connecting lines between cursor and active sources show audio relationships
- Fade rings around sources indicate audio activity
- All visual elements use audio-reactive animations (no artificial pulsing)

**Center Sweet Spot Indicator:**
- Crosshair marks the center of the canvas
- Represents the optimal listening position where all sounds are balanced
- Visual reference point for navigation

**Cursor Trail:**
- Fading trail follows cursor movement
- Creates a visual history of exploration
- Helps users understand their path through the soundscape

**Hidden State Visualization:**
- When control panel is hidden, minimal visual feedback remains
- Audio-reactive dots and connecting lines still visible
- Creates immersive, distraction-free experience
- Perfect for fullscreen, contemplative listening

### 5. User Interface

**Builder Version (`index.html`):**
- Full-featured editor for creating experiences
- File loaders for video and audio
- Individual track controls (volume, pan, mute, solo)
- Physics and spatial audio settings
- Export/import configuration
- Position readout for debugging

**Player Version (`player.html`):**
- Minimal, polished interface for end users
- Essential controls only: play/pause, timeline, volume, fullscreen
- Auto-hiding controls for immersive experience
- Keyboard shortcuts for power users
- Click-to-play functionality
- Mobile-optimized touch controls

**Keyboard Shortcuts:**
- `Space` - Play/Pause
- `←` / `→` - Seek backward/forward 5 seconds
- `↑` / `↓` - Volume up/down 10%
- `F` - Toggle fullscreen
- `M` - Mute/unmute
- `?` - Show/hide help

### 6. Audio Processing Features

**Professional Audio Mixing:**
- Individual track volume control (0-100%)
- Stereo panning (-100% left to +100% right)
- Solo and mute per track
- Master volume control
- Smooth fade in/out on play/stop (0.3s)

**Reverb Processing:**
- Optional convolution reverb for spatial depth
- Configurable reverb amount
- Creates sense of space and environment
- Particularly effective for field recordings and environmental sounds

**Audio Quality:**
- Supports lossless FLAC format (recommended)
- Also supports MP3, AAC, OGG
- High-quality Web Audio API processing
- No quality loss during spatial processing

## Technical Architecture

### Core Technologies

**Web Audio API:**
- Real-time audio processing and mixing
- HRTF-based 3D spatialization
- Convolution reverb
- Audio analysis for reactivity

**HTML5 Canvas:**
- 2D spatial audio visualization
- Video layer compositing
- Real-time rendering at 60fps
- Efficient drawing operations

**HTML5 Video/Audio:**
- Native browser media playback
- Efficient streaming for long files
- Cross-platform compatibility
- Metadata preloading

### Synchronization System

**Multi-Media Sync:**
- Video element drives timeline
- Audio sources started with calculated offsets
- Periodic sync checks every ~500ms
- Automatic drift correction if sync error >100ms
- Unified seek function updates all media simultaneously

**Time Management:**
- Single `currentTime` property for all media
- Calculated from video element or audio context
- Handles pause/resume seamlessly
- Accurate seeking across entire duration

### Spatial Audio Algorithm

**Distance-Based Volume:**
```
distance = √((sourceX - cursorX)² + (sourceY - cursorY)²)
if distance >= fadeRadius: volume = 0
if distance == 0: volume = sourceVolume × centerVolumeBoost (1.5x)
else: volume = sourceVolume × (1 - distance/fadeRadius) × boostFactor
```

**3D Spatialization:**
- Maps 2D canvas coordinates to 3D audio space
- Uses HRTF panner for realistic binaural audio
- Configurable spatial strength
- Maintains audio quality during spatial processing

### Performance Optimizations

**Efficient Rendering:**
- RequestAnimationFrame for smooth 60fps updates
- Optimized canvas drawing operations
- Minimal redraws (only when needed)
- Efficient audio analysis (throttled updates)

**Memory Management:**
- Streaming audio (not full file loading)
- Metadata-only preloading
- Efficient video compositing
- Garbage collection friendly

**Long File Support:**
- HTTP Range Requests for efficient seeking
- Progressive loading during playback
- No memory spikes with hour-long content
- Smooth scrubbing even with large files

## Use Cases

### Field Recordings & Environmental Soundscapes
- **Perfect for:** Environmental recordings, nature sounds, location-based audio
- **Example:** Multiple microphones placed around a glacier, each capturing different perspectives
- **Experience:** Users explore the soundscape by moving through different recording positions
- **Benefit:** Creates immersive sense of place and spatial relationships

### Multi-Part Compositions
- **Perfect for:** Long-form pieces with multiple movements or sections
- **Example:** 46-minute piece with distinct parts, each represented by different audio sources
- **Experience:** Users can focus on specific parts or explore transitions between sections
- **Benefit:** Non-linear exploration of linear composition

### Sound Art Installations
- **Perfect for:** Interactive sound art, gallery installations
- **Example:** Multiple speakers/sources in physical space mapped to canvas
- **Experience:** Physical movement translates to audio exploration
- **Benefit:** Accessible web-based alternative to physical installations

### Educational & Documentary
- **Perfect for:** Teaching spatial audio, demonstrating sound relationships
- **Example:** Explaining how different instruments interact in an orchestra
- **Experience:** Visual feedback helps understand audio concepts
- **Benefit:** Makes abstract audio concepts tangible and explorable

### Music Production & Mixing
- **Perfect for:** Previewing multi-track mixes, spatial audio experiments
- **Example:** Mixing multiple instrument tracks with spatial positioning
- **Experience:** Real-time mixing with visual feedback
- **Benefit:** Intuitive interface for spatial audio mixing

## Specific Application: Jokulvatn

### Context
**Jokulvatn** is a 46-minute multi-part composition based on field recordings of a melting Icelandic glacier. The piece explores the sounds of ice, water, wind, and the environment through multiple recording perspectives.

### How AV Spatial Mixer Enhances the Experience

**Spatial Representation:**
- Each field recording location becomes an audio source on the canvas
- Users can "move" between different recording positions
- Creates sense of navigating the physical glacier environment
- Different perspectives reveal different aspects of the melting process

**Temporal Exploration:**
- Long-form 46-minute duration fully supported
- Users can seek to specific moments or movements
- Timeline shows progress through the piece
- Smooth playback without memory issues

**Visual Storytelling:**
- Base video layer shows glacier imagery
- Transparent overlay layers can show:
  - Ice formations
  - Water flows
  - Environmental changes
  - Abstract visualizations of sound
- Visual layers synchronized with audio creates unified narrative

**Immersive Experience:**
- Minimal UI allows focus on the soundscape
- Auto-hiding controls create distraction-free environment
- Fullscreen mode for complete immersion
- Spatial audio through headphones creates realistic sense of place

**Interactive Discovery:**
- Users discover different aspects by exploring
- Moving toward ice sounds reveals cracking, melting details
- Moving toward water sounds reveals flow, movement
- Center position provides balanced, full-spectrum experience
- Each listening session can be unique based on exploration path

**Audio Reactivity:**
- Visual elements respond to actual glacier sounds
- Cracking ice creates visual pulses
- Water flow creates flowing visual patterns
- Wind creates subtle visual movements
- Direct connection between sound and visual feedback

### Technical Requirements for Jokulvatn

**Audio Files:**
- Multiple FLAC files (one per field recording location/perspective)
- All synchronized to same start point
- 46-minute duration each
- Lossless quality preserves environmental detail

**Video Files:**
- Base video: Glacier footage (MP4)
- Overlay layers: Transparent visualizations (WebM with alpha)
- All synchronized to audio timeline
- Can represent different visual perspectives or abstract interpretations

**Configuration:**
- JSON config file defines:
  - Audio source positions on canvas
  - Video layer properties
  - Initial volume levels
  - Spatial audio settings
- Allows precise control over spatial relationships

**Hosting:**
- Cloudflare R2 recommended for efficient delivery
- Direct URLs for streaming
- CORS configured for web access
- CDN for global performance

## User Experience Flow

### Initial Load
1. User opens player (or it loads automatically)
2. Configuration file loads (defines audio sources, video layers)
3. Media files begin loading (progress indicators shown)
4. Once loaded, player is ready

### Playback
1. User clicks play or presses spacebar
2. All audio sources and video layers start simultaneously
3. Audio fades in smoothly (0.3s)
4. Visual canvas shows audio source positions
5. Cursor defaults to center (sweet spot)

### Exploration
1. User moves cursor around canvas
2. Audio volumes adjust in real-time based on proximity
3. Visual elements react to audio levels
4. Connecting lines show active audio relationships
5. User discovers different aspects of the soundscape

### Navigation
1. Timeline shows progress through piece
2. User can seek to specific moments
3. All media synchronizes to new position
4. Spatial relationships maintained at all times

### Immersion
1. User hides control panel (or it auto-hides)
2. Minimal visual feedback remains
3. Focus shifts entirely to audio experience
4. Fullscreen mode available for complete immersion

## Technical Specifications

### Browser Requirements
- Modern browser with Web Audio API support
- HTML5 Video/Audio support
- Canvas API support
- Recommended: Chrome, Edge, Firefox, Safari

### File Format Support
- **Audio:** FLAC (recommended), MP3, AAC, OGG, WAV
- **Video:** MP4 (H.264), WebM (VP8/VP9 with alpha)
- **Config:** JSON

### Performance Characteristics
- Handles 4+ audio tracks simultaneously
- Supports 5-10 video layers (recommended max)
- Efficient with files up to 1+ hours
- 60fps visual rendering
- Real-time audio processing (<10ms latency)

### Accessibility
- Keyboard navigation support
- Screen reader compatible (with ARIA labels)
- Touch-friendly for mobile devices
- Responsive design for various screen sizes

## Unique Selling Points

1. **True Spatial Audio:** Not just panning—real 3D spatialization using HRTF
2. **Real-Time Reactivity:** Visual elements respond to actual audio, not artificial animations
3. **Long-Form Support:** Efficiently handles hour-long pieces without performance issues
4. **Multi-Layer Video:** Composable visual layers synchronized with audio
5. **Immersive Experience:** Minimal UI, auto-hiding controls, fullscreen support
6. **Interactive Exploration:** Users actively explore rather than passively consume
7. **Professional Quality:** Lossless audio support, high-quality processing
8. **Web-Based:** No installation, works in browser, accessible globally
9. **Configurable:** JSON-based configuration allows precise control
10. **Open & Flexible:** Can be customized and extended for specific needs

## Philosophical Approach

The AV Spatial Mixer transforms audio from a **temporal** medium (time-based) into a **spatial** medium (space-based). Instead of sounds existing only in time, they exist in a navigable space that users can explore. This creates:

- **Agency:** Users control their experience through movement
- **Discovery:** Each exploration reveals different aspects
- **Presence:** Spatial audio creates sense of "being there"
- **Connection:** Visual feedback creates tangible relationship with sound
- **Contemplation:** Immersive mode allows deep, focused listening

For environmental pieces like Jokulvatn, this approach allows listeners to:
- Experience the glacier as a physical space
- Navigate between different recording perspectives
- Discover relationships between different sound sources
- Create personal, unique listening experiences
- Connect with the environment through interactive exploration

## Conclusion

The AV Spatial Mixer is a powerful tool for creating immersive, interactive spatial audio experiences. It combines professional audio processing with intuitive visual feedback, allowing users to explore soundscapes in ways that traditional linear playback cannot achieve. For long-form environmental compositions like Jokulvatn, it provides a unique platform for experiencing field recordings as navigable, spatial environments, creating deeper connections between listeners and the recorded sounds of place.

