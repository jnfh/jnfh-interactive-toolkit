# Universal Timeline Controller

A powerful synchronization system for controlling multiple interactive audio elements in sync.

## Overview

The Universal Timeline Controller allows you to synchronize playback across multiple audio players (Soundmap Player, Spatial Mixer, etc.) with a single timeline interface. All registered players will play, pause, and seek together, maintaining perfect synchronization.

## Features

- **Synchronized Playback**: Control multiple players with a single play/pause button
- **Unified Timeline**: One timeline controls all registered players
- **Seeking Support**: Jump to any position and all players seek together
- **Time Display**: Shows current time and total duration
- **Easy Integration**: Simple API for registering players

## Quick Start

### 1. Include Required Files

```html
<link rel="stylesheet" href="css/universal-timeline.css">
<script src="js/universal-timeline.js"></script>
```

### 2. Create Timeline UI

```html
<div id="timeline-container"></div>
```

### 3. Initialize Timeline

```javascript
const timeline = new UniversalTimeline();
timeline.createUI('timeline-container');
```

### 4. Register Players

Players must implement the timeline interface:

```javascript
const player = {
    // Required methods
    play: function() { /* start playback */ },
    pause: function() { /* pause playback */ },
    seek: function(time) { /* seek to time in seconds */ },
    getCurrentTime: function() { return currentTime; },
    getDuration: function() { return duration; },
    
    // Optional
    stop: function() { /* stop and reset */ },
    
    // Audio context (for synchronization)
    audioContext: audioContextInstance
};

timeline.registerPlayer('player-id', player);
```

## Player Integration

### SoundmapPlayer

The SoundmapPlayer class already includes timeline integration methods:

```javascript
const soundmapPlayer = new SoundmapPlayer('map-container', config);
await soundmapPlayer.init();

timeline.registerPlayer('soundmap', soundmapPlayer);
```

### InteractiveAudioHover

The InteractiveAudioHover class also includes timeline integration:

```javascript
const spatialPlayer = new InteractiveAudioHover();
await spatialPlayer.init();

timeline.registerPlayer('spatial', spatialPlayer);
```

## API Reference

### UniversalTimeline Class

#### Constructor

```javascript
new UniversalTimeline(options)
```

Options:
- `autoUpdate` (boolean): Automatically update UI (default: true)
- `updateInterval` (number): Update interval in ms (default: 50)

#### Methods

##### `registerPlayer(playerId, player)`

Register a player with the timeline.

**Parameters:**
- `playerId` (string): Unique identifier for the player
- `player` (object): Player object with timeline interface

**Required Player Methods:**
- `play()`: Start playback
- `pause()`: Pause playback
- `seek(time)`: Seek to time position (seconds)
- `getCurrentTime()`: Get current playback time (seconds)
- `getDuration()`: Get total duration (seconds)

**Optional Player Methods:**
- `stop()`: Stop and reset playback

**Player Properties:**
- `audioContext`: Web Audio API AudioContext instance (for synchronization)

##### `unregisterPlayer(playerId)`

Remove a player from the timeline.

##### `play()`

Start playback on all registered players.

##### `pause()`

Pause playback on all registered players.

##### `stop()`

Stop and reset all players to the beginning.

##### `seek(time)`

Seek all players to the specified time position (in seconds).

##### `toggle()`

Toggle play/pause state.

##### `getCurrentTime()`

Get the current synchronized playback time.

##### `createUI(containerId)`

Create and initialize the timeline UI in the specified container element.

##### `destroy()`

Clean up and destroy the timeline instance.

## Example Usage

See `examples/timeline-example.html` for a complete working example.

```javascript
// Initialize timeline
const timeline = new UniversalTimeline();
timeline.createUI('timeline-container');

// Initialize and register players
const soundmapPlayer = new SoundmapPlayer('map', config);
await soundmapPlayer.init();
timeline.registerPlayer('soundmap', soundmapPlayer);

const spatialPlayer = new InteractiveAudioHover();
await spatialPlayer.init();
timeline.registerPlayer('spatial', spatialPlayer);

// Timeline now controls both players in sync!
```

## Styling

The timeline uses CSS classes that can be customized:

- `.universal-timeline`: Main timeline container
- `.timeline-controls`: Control buttons and slider container
- `.timeline-play-pause`: Play/pause button
- `.timeline-stop`: Stop button
- `.timeline-slider`: Timeline scrubber
- `.timeline-time`: Time display

You can add variants:
- `.floating`: Floating timeline variant
- `.compact`: Compact variant

## Browser Support

- Modern browsers with Web Audio API support
- Chrome, Firefox, Safari, Edge (latest versions)

## Notes

- All players must use the same AudioContext or compatible timing for perfect synchronization
- Looping audio sources will restart at the correct offset when seeking
- The timeline automatically calculates the maximum duration from all registered players

## Troubleshooting

**Players not synchronizing:**
- Ensure all players have an `audioContext` property
- Check that players implement all required timeline methods
- Verify players are registered before calling `play()`

**Timeline not updating:**
- Check that `autoUpdate` option is enabled (default: true)
- Ensure the timeline UI container exists in the DOM

**Seeking not working:**
- Verify players implement the `seek(time)` method correctly
- Check that audio buffers are loaded before seeking

