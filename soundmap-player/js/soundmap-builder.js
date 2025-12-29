/**
 * JnfH Soundmap Builder
 * Creation tool for spatial audio maps
 */

class SoundmapBuilder {
  constructor(mapContainerId, config) {
    this.mapContainer = mapContainerId;
    this.config = config;
    this.audioContext = null;
    this.audioSources = new Map();
    this.listenerPosition = null;
    
    this.mode = 'edit'; // 'edit' or 'preview'
    this.isPlaying = false;
    this.masterVolume = 0.8;
    
    this.map = null;
    this.sourceMarkers = [];
    this.nextSourceId = 1;
    this.pendingSource = null; // For placing new sources
  }
  
  async init() {
    console.log('Initializing Soundmap Builder...');
    
    this.initMap();
    this.bindControls();
    this.loadExistingSources();
    
    console.log('Builder ready');
  }
  
  initMap() {
    const center = this.config.mapCenter || [51.5074, -0.1278];
    
    this.map = L.map(this.mapContainer).setView(center, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19
    }).addTo(this.map);
    
    // Map click for placing sources
    this.map.on('click', (e) => {
      if (this.mode === 'edit' && this.pendingSource) {
        this.placeSource(e.latlng);
      }
    });
    
    // Mouse move for preview mode
    this.map.on('mousemove', (e) => {
      if (this.mode === 'preview' && this.isPlaying) {
        this.updateListenerPosition(e.latlng.lat, e.latlng.lng);
      }
    });
  }
  
  bindControls() {
    // Mode toggle
    document.getElementById('mode-btn').addEventListener('click', () => {
      this.toggleMode();
    });
    
    // Preview button
    document.getElementById('play-btn').addEventListener('click', async () => {
      await this.togglePreview();
    });
    
    // Add source button
    document.getElementById('add-source').addEventListener('click', () => {
      this.prepareNewSource();
    });
    
    // Volume control
    const volumeSlider = document.getElementById('master-volume');
    const volumeValue = document.getElementById('volume-value');
    volumeSlider.addEventListener('input', (e) => {
      this.masterVolume = e.target.value / 100;
      volumeValue.textContent = e.target.value + '%';
      this.updateMasterVolume();
    });
    
    // Export config
    document.getElementById('export-config').addEventListener('click', () => {
      this.exportConfig();
    });
  }
  
  toggleMode() {
    this.mode = this.mode === 'edit' ? 'preview' : 'edit';
    
    const btn = document.getElementById('mode-btn');
    const editPanel = document.getElementById('edit-panel');
    
    if (this.mode === 'edit') {
      btn.textContent = 'Edit Mode';
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-secondary');
      editPanel.style.display = 'block';
      this.setMarkersDraggable(true);
    } else {
      btn.textContent = 'Preview Mode';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
      editPanel.style.display = 'none';
      this.setMarkersDraggable(false);
    }
    
    document.getElementById('current-mode').textContent = 
      this.mode === 'edit' ? 'Edit' : 'Preview';
  }
  
  prepareNewSource() {
    const nameInput = document.getElementById('source-name');
    const fileInput = document.getElementById('audio-file');
    const distanceInput = document.getElementById('max-distance');
    
    if (!nameInput.value || !fileInput.files[0]) {
      alert('Please provide a name and select an audio file');
      return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      this.pendingSource = {
        name: nameInput.value,
        audioData: e.target.result,
        audioFile: file,
        maxDistance: parseInt(distanceInput.value) || 500
      };
      
      alert('Click on the map to place the audio source');
      
      // Change cursor
      document.getElementById('map').style.cursor = 'crosshair';
    };
    
    reader.readAsArrayBuffer(file);
  }
  
  async placeSource(latlng) {
    if (!this.pendingSource) return;
    
    const sourceId = `source-${this.nextSourceId++}`;
    
    // Create source object
    const source = {
      id: sourceId,
      name: this.pendingSource.name,
      position: [latlng.lat, latlng.lng],
      audio: {
        data: this.pendingSource.audioData,
        fileName: this.pendingSource.audioFile.name,
        maxDistance: this.pendingSource.maxDistance,
        volume: 0.8,
        loop: true
      },
      color: this.getRandomColor()
    };
    
    // Add to config
    this.config.audioSources.push(source);
    
    // Create marker
    this.createSourceMarker(source);
    
    // Update UI list
    this.updateSourcesList();
    
    // Clear pending
    this.pendingSource = null;
    document.getElementById('map').style.cursor = '';
    
    // Clear form
    document.getElementById('source-name').value = '';
    document.getElementById('audio-file').value = '';
    
    console.log('Source placed:', sourceId);
  }
  
  createSourceMarker(source) {
    const marker = L.circleMarker(source.position, {
      radius: 12,
      fillColor: source.color,
      color: '#fff',
      weight: 3,
      opacity: 1,
      fillOpacity: 0.8,
      draggable: this.mode === 'edit'
    }).addTo(this.map);
    
    // Distance ring
    const ring = L.circle(source.position, {
      radius: source.audio.maxDistance,
      fillColor: source.color,
      fillOpacity: 0.05,
      color: source.color,
      weight: 1,
      opacity: 0.3,
      dashArray: '5, 10'
    }).addTo(this.map);
    
    marker.bindPopup(`<b>${source.name}</b><br>Range: ${source.audio.maxDistance}m<br><small>Right-click to delete</small>`);
    
    // Drag to reposition
    marker.on('drag', (e) => {
      const pos = e.target.getLatLng();
      source.position = [pos.lat, pos.lng];
      ring.setLatLng(pos);
    });
    
    // Right-click to delete
    marker.on('contextmenu', (e) => {
      L.DomEvent.preventDefault(e);
      if (confirm(`Delete ${source.name}?`)) {
        this.deleteSource(source.id);
      }
    });
    
    this.sourceMarkers.push({ marker, ring, sourceId: source.id });
  }
  
  deleteSource(sourceId) {
    // Remove from config
    this.config.audioSources = this.config.audioSources.filter(s => s.id !== sourceId);
    
    // Remove marker
    const markerObj = this.sourceMarkers.find(m => m.sourceId === sourceId);
    if (markerObj) {
      this.map.removeLayer(markerObj.marker);
      this.map.removeLayer(markerObj.ring);
      this.sourceMarkers = this.sourceMarkers.filter(m => m.sourceId !== sourceId);
    }
    
    // Remove audio
    this.audioSources.delete(sourceId);
    
    this.updateSourcesList();
  }
  
  loadExistingSources() {
    this.config.audioSources.forEach(source => {
      this.createSourceMarker(source);
    });
    this.updateSourcesList();
  }
  
  setMarkersDraggable(draggable) {
    this.sourceMarkers.forEach(m => {
      if (draggable) {
        m.marker.dragging.enable();
      } else {
        m.marker.dragging.disable();
      }
    });
  }
  
  updateSourcesList() {
    const container = document.getElementById('source-items');
    container.innerHTML = '';
    
    if (this.config.audioSources.length === 0) {
      container.innerHTML = '<p style="font-size: 12px; color: #666;">No sources added yet</p>';
      return;
    }
    
    this.config.audioSources.forEach(source => {
      const item = document.createElement('div');
      item.style.cssText = 'padding: 8px; margin-bottom: 8px; background: #2a2a2a; border-radius: 4px; font-size: 12px;';
      item.innerHTML = `
        <div style="color: ${source.color}; font-weight: 600;">${source.name}</div>
        <div style="color: #999; margin-top: 4px;">Range: ${source.audio.maxDistance}m</div>
      `;
      container.appendChild(item);
    });
  }
  
  async togglePreview() {
    if (!this.isPlaying) {
      await this.startPreview();
    } else {
      this.stopPreview();
    }
  }
  
  async startPreview() {
    if (this.config.audioSources.length === 0) {
      alert('Add some audio sources first');
      return;
    }
    
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await this.loadAudioBuffers();
    }
    
    this.isPlaying = true;
    document.getElementById('play-btn').textContent = 'Stop Preview';
    document.getElementById('status').classList.remove('status-hidden');
    
    // Start all sources
    this.audioSources.forEach((audioSource) => {
      this.startAudioSource(audioSource);
    });
    
    console.log('Preview started - move mouse over map');
  }
  
  stopPreview() {
    this.isPlaying = false;
    document.getElementById('play-btn').textContent = 'Preview';
    
    this.audioSources.forEach((audioSource) => {
      if (audioSource.source) {
        audioSource.source.stop();
        audioSource.source = null;
      }
    });
  }
  
  async loadAudioBuffers() {
    console.log('Loading audio buffers...');
    
    for (const source of this.config.audioSources) {
      try {
        const audioBuffer = await this.audioContext.decodeAudioData(source.audio.data.slice(0));
        
        // Create spatial audio nodes
        const panner = this.audioContext.createPanner();
        panner.panningModel = 'HRTF'; // Binaural
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = source.audio.maxDistance;
        panner.rolloffFactor = 1;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0;
        
        panner.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Set source position (convert lat/lng to xyz)
        const pos = this.latLngToXYZ(source.position[0], source.position[1]);
        panner.setPosition(pos.x, pos.y, pos.z);
        
        this.audioSources.set(source.id, {
          config: source,
          audioBuffer: audioBuffer,
          source: null,
          panner: panner,
          gainNode: gainNode
        });
        
        console.log('Loaded:', source.id);
      } catch (error) {
        console.error('Failed to load:', source.id, error);
      }
    }
  }
  
  startAudioSource(audioSource) {
    const source = this.audioContext.createBufferSource();
    source.buffer = audioSource.audioBuffer;
    source.loop = audioSource.config.audio.loop;
    source.connect(audioSource.panner);
    source.start(0);
    audioSource.source = source;
  }
  
  updateListenerPosition(lat, lng) {
    if (!this.isPlaying) return;
    
    this.listenerPosition = { lat, lng };
    
    // Convert listener position to XYZ
    const listenerPos = this.latLngToXYZ(lat, lng);
    
    // Update audio listener position
    const listener = this.audioContext.listener;
    if (listener.positionX) {
      listener.positionX.value = listenerPos.x;
      listener.positionY.value = listenerPos.y;
      listener.positionZ.value = listenerPos.z;
      
      // Set orientation (facing north/up)
      listener.forwardX.value = 0;
      listener.forwardY.value = 1;
      listener.forwardZ.value = 0;
      listener.upX.value = 0;
      listener.upY.value = 0;
      listener.upZ.value = 1;
    }
    
    // Update distances in UI
    let nearestDistance = Infinity;
    this.audioSources.forEach((audioSource) => {
      const sourcePos = audioSource.config.position;
      const distance = this.calculateDistance(lat, lng, sourcePos[0], sourcePos[1]);
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
      
      // Update gain based on distance
      const maxDist = audioSource.config.audio.maxDistance;
      let volume = 0;
      if (distance < maxDist) {
        volume = (1 - distance / maxDist) * audioSource.config.audio.volume * this.masterVolume;
      }
      audioSource.gainNode.gain.value = volume;
    });
    
    document.getElementById('distance-display').textContent = `${Math.round(nearestDistance)}m`;
  }
  
  latLngToXYZ(lat, lng) {
    // Simple planar approximation for local audio positioning
    const centerLat = this.config.mapCenter[0];
    const centerLng = this.config.mapCenter[1];
    
    const x = (lng - centerLng) * 111320 * Math.cos(centerLat * Math.PI / 180);
    const y = (lat - centerLat) * 110540;
    
    return { x, y, z: 0 };
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
  
  getRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  exportConfig() {
    // Create export without audio data
    const exportConfig = {
      ...this.config,
      audioSources: this.config.audioSources.map(s => ({
        id: s.id,
        name: s.name,
        position: s.position,
        audio: {
          fileName: s.audio.fileName,
          url: `https://pub-b8cf302764c84d3f955e78aac653f917.r2.dev/${s.audio.fileName}`,
          maxDistance: s.audio.maxDistance,
          volume: s.audio.volume,
          loop: s.audio.loop
        },
        color: s.color
      }))
    };
    
    const json = JSON.stringify(exportConfig, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'soundmap-config.json';
    a.click();
    
    console.log('Config exported');
  }
}
