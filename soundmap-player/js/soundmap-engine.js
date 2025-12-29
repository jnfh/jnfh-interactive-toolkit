/**
 * JnfH Soundmap Audio Engine
 * Handles audio zone triggering, crossfading, and spatial mixing
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
        await Tone.start();
        this.audioContext = Tone.getContext();
        console.log('Audio context started');
        
        // Load audio zones AFTER context is ready
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
        console.log('Loading audio:', zone.audio.url);
        
        // Load audio buffer first
        const buffer = new Tone.ToneAudioBuffer(zone.audio.url);
        await buffer.load();
        
        console.log('Buffer loaded for:', zone.id);
        
        // Create player with loaded buffer
        const player = new Tone.Player({
          buffer: buffer,
          loop: zone.audio.loop !== false,
          volume: Tone.gainToDb(0)
        }).toDestination();
        
        console.log('Player created for:', zone.id);
        
        this.activeTracks.set(zone.id, {
          player: player,
          zone: zone,
          active: false,
          targetVolume: zone.audio.volume || 0.8
        });
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
    
    this.activeTracks.forEach(track => {
      track.player.start();
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
  
  stopPlayback() {
    this.isPlaying = false;
    document.getElementById('play-btn').textContent = 'Start Audio';
    
    this.activeTracks.forEach(track => {
      track.player.volume.rampTo(Tone.gainToDb(0), 1);
      setTimeout(() => track.player.stop(), 1000);
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
    const targetDb = Tone.gainToDb(track.targetVolume * this.masterVolume);
    track.player.volume.rampTo(targetDb, this.crossfadeDuration);
  }
  
  fadeOutTrack(track) {
    if (!track.active) return;
    
    track.active = false;
    track.player.volume.rampTo(Tone.gainToDb(0), this.crossfadeDuration);
  }
  
  updateMasterVolume() {
    this.activeTracks.forEach(track => {
      if (track.active) {
        const targetDb = Tone.gainToDb(track.targetVolume * this.masterVolume);
        track.player.volume.value = targetDb;
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
