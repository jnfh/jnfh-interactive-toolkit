/**
 * JnfH Soundmap - Point Source Audio with Mouse-based Positioning
 */

class SoundmapPlayer {
  constructor(mapContainerId, config) {
    this.mapContainer = mapContainerId;
    this.config = config;
    this.audioContext = null;
    this.audioSources = new Map();
    this.listenerPosition = null;
    this.isPlaying = false;
    this.masterVolume = 0.8;
    
    this.map = null;
    this.sourceMarkers = [];
    
    // Timeline integration
    this.playbackStartTime = 0; // Audio context time when playback started
    this.pauseTime = 0; // Time position when paused
  }
  
  async init() {
    console.log('Initializing Point Source Player...');
    
    this.initMap();
    this.setupAudioContext();
    this.bindControls();
    
    console.log('Ready - click Start Audio, then move mouse over map');
  }
  
  initMap() {
    const center = this.config.mapCenter || [51.5074, -0.1278];
    
    this.map = L.map(this.mapContainer).setView(center, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '� OpenStreetMap',
      maxZoom: 19
    }).addTo(this.map);
    
    // Draw audio source points
    this.drawAudioSources();
    
    // Mouse move updates listener position
    this.map.on('mousemove', (e) => {
      if (this.isPlaying) {
        this.updateListenerPosition(e.latlng.lat, e.latlng.lng);
      }
    });
  }
  
  drawAudioSources() {
    const sources = this.config.audioSources || [];
    
    sources.forEach(source => {
      // Red circle marker for audio source
      const marker = L.circleMarker(source.position, {
        radius: 12,
        fillColor: source.color || '#FF6B6B',
        color: '#fff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.map);
      
      // Add distance rings
      L.circle(source.position, {
        radius: source.audio.maxDistance || 500,
        fillColor: source.color || '#FF6B6B',
        fillOpacity: 0.05,
        color: source.color || '#FF6B6B',
        weight: 1,
        opacity: 0.3,
        dashArray: '5, 10'
      }).addTo(this.map);
      
      marker.bindPopup(`<b>${source.name}</b><br>Audio source<br>Max range: ${source.audio.maxDistance || 500}m`);
      
      this.sourceMarkers.push(marker);
    });
  }
  
  setupAudioContext() {
    document.getElementById('play-btn').addEventListener('click', async () => {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio context started');
        
        await this.loadAudioSources();
      }
      
      this.togglePlayback();
    });
  }
  
  bindControls() {
    const volumeSlider = document.getElementById('master-volume');
    const volumeValue = document.getElementById('volume-value');
    volumeSlider.addEventListener('input', (e) => {
      this.masterVolume = e.target.value / 100;
      volumeValue.textContent = e.target.value + '%';
      this.updateMasterVolume();
    });
  }
  
  async loadAudioSources() {
    const sources = this.config.audioSources || [];
    
    console.log('Loading audio sources...');
    
    for (const source of sources) {
      try {
        console.log('Fetching:', source.audio.url);
        
        const response = await fetch(source.audio.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        console.log('Loaded:', source.id, `Duration: ${audioBuffer.duration}s`);
        
        // Create audio nodes
        const gainNode = this.audioContext.createGain();
        const filterNode = this.audioContext.createBiquadFilter();
        
        gainNode.gain.value = 0;
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 20000;
        
        filterNode.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        this.audioSources.set(source.id, {
          config: source,
          audioBuffer: audioBuffer,
          source: null,
          gainNode: gainNode,
          filterNode: filterNode
        });
        
      } catch (error) {
        console.error('Failed to load:', source.id, error);
      }
    }
    
    console.log(`Loaded ${this.audioSources.size} sources`);
  }
  
  togglePlayback() {
    if (!this.isPlaying) {
      this.startPlayback();
    } else {
      this.stopPlayback();
    }
  }
  
  startPlayback() {
    if (this.audioSources.size === 0) {
      console.error('No audio loaded');
      return;
    }
    
    this.isPlaying = true;
    this.playbackStartTime = this.audioContext.currentTime - this.pauseTime;
    
    if (document.getElementById('play-btn')) {
      document.getElementById('play-btn').textContent = 'Stop Audio';
    }
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.classList.remove('status-hidden');
    }
    
    console.log('Starting playback - move mouse over map');
    
    // Start all sources
    this.audioSources.forEach((audioSource, id) => {
      const source = this.audioContext.createBufferSource();
      source.buffer = audioSource.audioBuffer;
      source.loop = audioSource.config.audio.loop;
      source.connect(audioSource.filterNode);
      // Use modulo to handle looping audio correctly
      const offset = audioSource.config.audio.loop 
        ? this.pauseTime % audioSource.audioBuffer.duration 
        : Math.min(this.pauseTime, audioSource.audioBuffer.duration);
      source.start(0, offset);
      audioSource.source = source;
    });
  }
  
  stopPlayback() {
    this.isPlaying = false;
    this.pauseTime = this.getCurrentTime();
    
    if (document.getElementById('play-btn')) {
      document.getElementById('play-btn').textContent = 'Start Audio';
    }
    const statusEl = document.getElementById('status');
    if (statusEl) {
      statusEl.classList.add('status-hidden');
    }
    
    this.audioSources.forEach((audioSource) => {
      if (audioSource.source) {
        audioSource.source.stop();
        audioSource.source = null;
      }
      audioSource.gainNode.gain.value = 0;
    });
  }
  
  // Timeline integration methods
  play() {
    if (!this.audioContext) {
      console.warn('Audio context not initialized');
      return;
    }
    if (!this.isPlaying) {
      this.startPlayback();
    }
  }
  
  pause() {
    if (this.isPlaying) {
      this.stopPlayback();
    }
  }
  
  stop() {
    this.pause();
    this.pauseTime = 0;
    this.seek(0);
  }
  
  getCurrentTime() {
    if (this.isPlaying && this.audioContext && this.playbackStartTime > 0) {
      return this.audioContext.currentTime - this.playbackStartTime;
    }
    return this.pauseTime;
  }
  
  getDuration() {
    let maxDuration = 0;
    this.audioSources.forEach((audioSource) => {
      if (audioSource.audioBuffer) {
        const duration = audioSource.audioBuffer.duration;
        if (duration > maxDuration) {
          maxDuration = duration;
        }
      }
    });
    return maxDuration;
  }
  
  seek(time) {
    const wasPlaying = this.isPlaying;
    
    // Stop current playback
    if (this.isPlaying) {
      this.stopPlayback();
    }
    
    this.pauseTime = Math.max(0, time);
    
    // Restart if was playing
    if (wasPlaying && this.audioSources.size > 0) {
      this.startPlayback();
    }
  }
  
  updateListenerPosition(lat, lng) {
    if (!this.isPlaying) return;
    
    this.listenerPosition = { lat, lng };
    
    let nearestSource = null;
    let minDistance = Infinity;
    
    this.audioSources.forEach((audioSource, id) => {
      const sourcePos = audioSource.config.position;
      const distance = this.calculateDistance(lat, lng, sourcePos[0], sourcePos[1]);
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestSource = id;
      }
      
      this.updateAudioForDistance(audioSource, distance);
    });
    
    // Update UI
    document.getElementById('current-zone').textContent = 
      nearestSource ? `${nearestSource} (${Math.round(minDistance)}m)` : 'None';
  }
  
  updateAudioForDistance(audioSource, distance) {
    const maxDistance = audioSource.config.audio.maxDistance || 500;
    const targetVolume = audioSource.config.audio.volume || 0.8;
    
    // Calculate volume (inverse square law)
    let volume = 0;
    if (distance < maxDistance) {
      const normalized = distance / maxDistance;
      volume = Math.pow(1 - normalized, 2) * targetVolume * this.masterVolume;
    }
    
    // Calculate filter frequency
    let filterFreq = 20000;
    if (distance < maxDistance) {
      const normalized = distance / maxDistance;
      filterFreq = 20000 - (normalized * 18500);
    } else {
      filterFreq = 500;
    }
    
    // Apply smoothly
    const currentTime = this.audioContext.currentTime;
    audioSource.gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.05);
    audioSource.filterNode.frequency.linearRampToValueAtTime(filterFreq, currentTime + 0.05);
  }
  
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }
  
  updateMasterVolume() {
    if (this.listenerPosition && this.isPlaying) {
      this.updateListenerPosition(this.listenerPosition.lat, this.listenerPosition.lng);
    }
  }
}
