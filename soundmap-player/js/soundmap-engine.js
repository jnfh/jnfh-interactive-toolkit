/**
 * JnfH Soundmap Audio Engine
 * Using native Web Audio API for better CORS compatibility
 */

class SoundmapPlayer {
  constructor(mapContainerId, config) {
    this.mapContainer = mapContainerId;
    this.config = config;
    this.audioContext = null;
    this.activeTracks = new Map();
    this.currentPosition = null;
    this.isPlaying = false;
    this.masterVolume = 0.8;
    this.crossfadeDuration = 2;
    this.mode = 'click';
    
    this.animationProgress = 0;
    this.animationActive = false;
    this.animationStartTime = null;
    
    this.map = null;
    this.markers = {
      listener: null,
      zones: []
    };
  }
  
  async init() {
    console.log('Initializing Soundmap Player...');
    
    this.initMap();
    this.setupAudioContext();
    this.bindControls();
    
    if (this.config.path) {
      this.drawPath();
    }
    
    console.log('Soundmap Player ready - click Start Audio to begin');
  }
  
  initMap() {
    const center = this.config.mapCenter || [51.5074, -0.1278];
    
    this.map = L.map(this.mapContainer).setView(center, 13);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);
    
    this.markers.listener = L.marker(center, {
      icon: L.divIcon({
        className: 'listener-marker',
        html: '<div class="pulse"></div>',
        iconSize: [30, 30]
      }),
      draggable: this.mode === 'click'
    }).addTo(this.map);
    
    this.markers.listener.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      this.updateListenerPosition(pos.lat, pos.lng);
    });
    
    this.map.on('click', (e) => {
      if (this.mode === 'click' && this.isPlaying) {
        this.markers.listener.setLatLng(e.latlng);
        this.updateListenerPosition(e.latlng.lat, e.latlng.lng);
      }
    });
  }
  
  setupAudioContext() {
    document.getElementById('play-btn').addEventListener('click', async () => {
      if (!this.audioContext) {
        // Use native Web Audio API instead of Tone.js
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('Audio context started');
        
        await this.loadAudioZones();
        this.drawZones();
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
    
    const crossfadeSlider = document.getElementById('crossfade-time');
    const crossfadeValue = document.getElementById('crossfade-value');
    crossfadeSlider.addEventListener('input', (e) => {
      this.crossfadeDuration = parseFloat(e.target.value);
      crossfadeValue.textContent = e.target.value + 's';
    });
    
    const modeSelect = document.getElementById('mode-select');
    modeSelect.addEventListener('change', (e) => {
      this.changeMode(e.target.value);
    });
  }
  
  async loadAudioZones() {
    const zones = this.config.audioZones || [];
    
    console.log('Loading audio zones...');
    
    for (const zone of zones) {
      try {
        console.log('Fetching audio:', zone.audio.url);
        
        // Fetch audio file
        const response = await fetch(zone.audio.url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log('Downloaded audio for:', zone.id);
        
        // Decode audio data
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
        console.log('Decoded audio for:', zone.id);
        
        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0; // Start silent
        gainNode.connect(this.audioContext.destination);
        
        this.activeTracks.set(zone.id, {
          audioBuffer: audioBuffer,
          gainNode: gainNode,
          source: null,
          zone: zone,
          active: false,
          targetVolume: zone.audio.volume || 0.8,
          loop: zone.audio.loop !== false
        });
        
        console.log('Setup complete for:', zone.id);
      } catch (error) {
        console.error('Failed to load audio for zone:', zone.id, error);
      }
    }
    
    console.log(`Loaded ${this.activeTracks.size} audio zones`);
  }
  
  drawZones() {
    this.config.audioZones.forEach(zone => {
      this.drawZone(zone);
    });
  }
  
  drawZone(zone) {
    if (!zone.coordinates || zone.coordinates.length === 0) return;
    
    const polygon = L.polygon(zone.coordinates, {
      color: zone.color || '#3388ff',
      fillOpacity: 0.2,
      weight: 2
    }).addTo(this.map);
    
    polygon.on('click', () => {
      this.showZoneInfo(zone);
    });
    
    this.markers.zones.push(polygon);
  }
  
  drawPath() {
    const pathCoords = this.config.path.coordinates;
    
    const polyline = L.polyline(pathCoords, {
      color: '#FF6B6B',
      weight: 3,
      opacity: 0.7,
      dashArray: '10, 10'
    }).addTo(this.map);
    
    this.map.fitBounds(polyline.getBounds());
  }
  
  togglePlayback() {
    if (!this.isPlaying) {
      this.startPlayback();
    } else {
      this.stopPlayback();
    }
  }
  
  startPlayback() {
    if (this.activeTracks.size === 0) {
      console.error('No audio zones loaded yet');
      return;
    }
    
    this.isPlaying = true;
    document.getElementById('play-btn').textContent = 'Stop Audio';
    document.getElementById('status').classList.remove('status-hidden');
    
    // Start all audio sources
    this.activeTracks.forEach((track, zoneId) => {
      this.startAudioSource(track);
    });
    
    const pos = this.markers.listener.getLatLng();
    this.updateListenerPosition(pos.lat, pos.lng);
    
    if (this.mode === 'animate') {
      this.startAnimation();
    }
    
    if (this.mode === 'gps') {
      this.startGPSTracking();
    }
  }
  
  startAudioSource(track) {
    // Create new source node
    const source = this.audioContext.createBufferSource();
    source.buffer = track.audioBuffer;
    source.loop = track.loop;
    source.connect(track.gainNode);
    source.start(0);
    
    track.source = source;
  }
  
  stopPlayback() {
    this.isPlaying = false;
    document.getElementById('play-btn').textContent = 'Start Audio';
    
    // Stop all audio sources
    this.activeTracks.forEach(track => {
      if (track.source) {
        track.source.stop();
        track.source = null;
      }
      track.gainNode.gain.value = 0;
    });
    
    if (this.animationActive) {
      this.stopAnimation();
    }
    
    if (this.gpsWatchId) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
    }
  }
  
  updateListenerPosition(lat, lng) {
    this.currentPosition = { lat, lng };
    
    const activeZones = [];
    
    this.activeTracks.forEach((track, zoneId) => {
      const inZone = this.isPointInZone(lat, lng, track.zone);
      
      if (inZone) {
        activeZones.push(zoneId);
        this.fadeInTrack(track);
      } else {
        this.fadeOutTrack(track);
      }
    });
    
    document.getElementById('current-zone').textContent = 
      activeZones.length > 0 ? activeZones.join(', ') : 'None';
    document.getElementById('active-tracks').textContent = activeZones.length;
  }
  
  isPointInZone(lat, lng, zone) {
    if (!zone.coordinates) return false;
    
    const point = L.latLng(lat, lng);
    const polygon = L.polygon(zone.coordinates);
    return polygon.getBounds().contains(point);
  }
  
  fadeInTrack(track) {
    if (track.active) return;
    
    track.active = true;
    const targetVolume = track.targetVolume * this.masterVolume;
    const currentTime = this.audioContext.currentTime;
    
    track.gainNode.gain.cancelScheduledValues(currentTime);
    track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, currentTime);
    track.gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + this.crossfadeDuration);
  }
  
  fadeOutTrack(track) {
    if (!track.active) return;
    
    track.active = false;
    const currentTime = this.audioContext.currentTime;
    
    track.gainNode.gain.cancelScheduledValues(currentTime);
    track.gainNode.gain.setValueAtTime(track.gainNode.gain.value, currentTime);
    track.gainNode.gain.linearRampToValueAtTime(0, currentTime + this.crossfadeDuration);
  }
  
  updateMasterVolume() {
    this.activeTracks.forEach(track => {
      if (track.active) {
        const targetVolume = track.targetVolume * this.masterVolume;
        track.gainNode.gain.value = targetVolume;
      }
    });
  }
  
  changeMode(newMode) {
    this.mode = newMode;
    
    if (newMode === 'click') {
      this.markers.listener.dragging.enable();
    } else {
      this.markers.listener.dragging.disable();
    }
    
    if (this.animationActive) {
      this.stopAnimation();
    }
  }
  
  startAnimation() {
    if (!this.config.path) return;
    
    this.animationActive = true;
    this.animationStartTime = Date.now();
    this.animationProgress = 0;
    
    const duration = this.config.path.duration * 1000;
    const pathCoords = this.config.path.coordinates;
    
    const animate = () => {
      if (!this.animationActive) return;
      
      const elapsed = Date.now() - this.animationStartTime;
      this.animationProgress = Math.min(elapsed / duration, 1);
      
      const index = this.animationProgress * (pathCoords.length - 1);
      const lowerIndex = Math.floor(index);
      const upperIndex = Math.ceil(index);
      const fraction = index - lowerIndex;
      
      const posA = pathCoords[lowerIndex];
      const posB = pathCoords[upperIndex] || posA;
      
      const lat = posA[0] + (posB[0] - posA[0]) * fraction;
      const lng = posA[1] + (posB[1] - posA[1]) * fraction;
      
      this.markers.listener.setLatLng([lat, lng]);
      this.updateListenerPosition(lat, lng);
      
      if (this.animationProgress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.animationActive = false;
      }
    };
    
    animate();
  }
  
  stopAnimation() {
    this.animationActive = false;
  }
  
  startGPSTracking() {
    if (!navigator.geolocation) {
      alert('GPS not supported on this device');
      return;
    }
    
    this.gpsWatchId = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        this.markers.listener.setLatLng([lat, lng]);
        this.updateListenerPosition(lat, lng);
        this.map.panTo([lat, lng]);
      },
      (error) => {
        console.error('GPS error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000
      }
    );
  }
  
  showZoneInfo(zone) {
    const infoPanel = document.getElementById('zone-info');
    document.getElementById('zone-title').textContent = zone.name || zone.id;
    document.getElementById('zone-description').textContent = 
      zone.description || 'Audio zone';
    
    infoPanel.classList.remove('info-hidden');
    
    setTimeout(() => {
      infoPanel.classList.add('info-hidden');
    }, 3000);
  }
}
