/**
 * JnfH Soundmap - Point Source Audio with Distance-based Mixing
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
    this.listenerMarker = null;
    this.sourceMarkers = [];
  }
  
  async init() {
    console.log('Initializing Point Source Player...');
    
    this.initMap();
    this.setupAudioContext();
    this.bindControls();
    
    console.log('Ready - click Start Audio');
  }
  
  initMap() {
    const center = this.config.mapCenter || [51.5074, -0.1278];
    
    this.map = L.map(this.mapContainer).setView(center, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(this.map);
    
    // Listener marker (you)
    this.listenerMarker = L.marker(center, {
      icon: L.divIcon({
        className: 'listener-marker',
        html: '<div class="pulse"></div>',
        iconSize: [30, 30]
      }),
      draggable: true
    }).addTo(this.map);
    
    this.listenerMarker.on('drag', (e) => {
      const pos = e.target.getLatLng();
      this.updateListenerPosition(pos.lat, pos.lng);
    });
    
    // Click to move
    this.map.on('click', (e) => {
      if (this.isPlaying) {
        this.listenerMarker.setLatLng(e.latlng);
        this.updateListenerPosition(e.latlng.lat, e.latlng.lng);
      }
    });
    
    // Draw audio source points
    this.drawAudioSources();
  }
  
  drawAudioSources() {
    const sources = this.config.audioSources || [];
    
    sources.forEach(source => {
      const marker = L.circleMarker(source.position, {
        radius: 10,
        fillColor: source.color || '#FF6B6B',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(this.map);
      
      marker.bindPopup(`<b>${source.name}</b><br>Audio source`);
      
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
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        
        console.log('Loaded:', source.id);
        
        // Create audio nodes
        const gainNode = this.audioContext.createGain();
        const filterNode = this.audioContext.createBiquadFilter();
        
        gainNode.gain.value = 0;
        filterNode.type = 'lowpass';
        filterNode.frequency.value = 20000;
        
        // Connect: source -> filter -> gain -> destination
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
    document.getElementById('play-btn').textContent = 'Stop Audio';
    document.getElementById('status').classList.remove('status-hidden');
    
    // Start all sources
    this.audioSources.forEach((audioSource) => {
      const source = this.audioContext.createBufferSource();
      source.buffer = audioSource.audioBuffer;
      source.loop = audioSource.config.audio.loop;
      source.connect(audioSource.filterNode);
      source.start(0);
      audioSource.source = source;
    });
    
    // Initial position update
    const pos = this.listenerMarker.getLatLng();
    this.updateListenerPosition(pos.lat, pos.lng);
  }
  
  stopPlayback() {
    this.isPlaying = false;
    document.getElementById('play-btn').textContent = 'Start Audio';
    
    this.audioSources.forEach((audioSource) => {
      if (audioSource.source) {
        audioSource.source.stop();
        audioSource.source = null;
      }
      audioSource.gainNode.gain.value = 0;
    });
  }
  
  updateListenerPosition(lat, lng) {
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
      
      // Update audio based on distance
      this.updateAudioForDistance(audioSource, distance);
    });
    
    // Update UI
    document.getElementById('current-zone').textContent = 
      nearestSource ? `${nearestSource} (${Math.round(minDistance)}m)` : 'None';
    document.getElementById('active-tracks').textContent = this.audioSources.size;
  }
  
  updateAudioForDistance(audioSource, distance) {
    const maxDistance = audioSource.config.audio.maxDistance || 500;
    const targetVolume = audioSource.config.audio.volume || 0.8;
    
    // Calculate volume based on distance (inverse square law)
    let volume = 0;
    if (distance < maxDistance) {
      volume = Math.pow(1 - (distance / maxDistance), 2) * targetVolume * this.masterVolume;
    }
    
    // Calculate filter frequency (low-pass when distant)
    let filterFreq = 20000;
    if (distance < maxDistance) {
      const normalized = distance / maxDistance;
      filterFreq = 20000 - (normalized * 19000); // 20kHz to 1kHz
    } else {
      filterFreq = 500; // Very muffled when far
    }
    
    // Apply smoothly
    const currentTime = this.audioContext.currentTime;
    audioSource.gainNode.gain.linearRampToValueAtTime(volume, currentTime + 0.1);
    audioSource.filterNode.frequency.linearRampToValueAtTime(filterFreq, currentTime + 0.1);
  }
  
  calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
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
    if (this.listenerPosition) {
      this.updateListenerPosition(this.listenerPosition.lat, this.listenerPosition.lng);
    }
  }
}
