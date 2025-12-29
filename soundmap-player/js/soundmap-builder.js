/**
 * JnfH Soundmap Builder with Advanced Spatial Audio
 */

class SoundmapBuilder {
  constructor(mapContainerId, config) {
    this.mapContainer = mapContainerId;
    this.config = config;
    this.audioContext = null;
    this.masterGainNode = null;
    this.audioSources = new Map();
    this.listenerPosition = null;
    
    // Reverb system
    this.convolverNode = null;
    this.reverbSendGain = null;
    this.reverbEnabled = true;
    this.reverbAmount = 1.0;
    
    this.mode = 'edit';
    this.isPlaying = false;
    this.masterVolume = 0.8;
    this.fadeRadius = 500;
    this.fadeSpeed = 0.3;
    this.smoothness = 0.15; // Smoothness factor for interpolation (lower = smoother, 0.05-0.3 range)
    // Initialize smoothness from fadeSpeed (inverse relationship - faster fade = less smooth)
    this.updateSmoothnessFromFadeSpeed();
    
    // Spatial audio settings
    this.spatialAudioEnabled = true;
    this.spatialAudioStrength = 1.0;
    this.maxDistance = 1000;
    
    this.map = null;
    this.sourceMarkers = [];
    this.nextSourceId = 1;
    this.pendingSource = null;
    this.selectedSource = null;
    
    // Animation loop for smooth fading
    this.animationFrameId = null;
    this.targetVolumes = new Map(); // Target volumes for each source (calculated from position)
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
    
    this.map = L.map(this.mapContainer, {
      dragging: true,
      doubleClickZoom: true,
      scrollWheelZoom: true
    }).setView(center, 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '� OpenStreetMap',
      maxZoom: 19
    }).addTo(this.map);
    
    // Click for placing sources only
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
    document.getElementById('mode-btn').addEventListener('click', () => {
      this.toggleMode();
    });
    
    document.getElementById('play-btn').addEventListener('click', async () => {
      await this.togglePreview();
    });
    
    document.getElementById('add-source').addEventListener('click', () => {
      this.prepareNewSource();
    });
    
    // Volume control
    const volumeSlider = document.getElementById('master-volume');
    volumeSlider.addEventListener('input', (e) => {
      this.masterVolume = e.target.value / 100;
      document.getElementById('volume-value').textContent = e.target.value + '%';
      this.updateMasterVolume();
    });
    
    // Fade radius
    const fadeRadiusSlider = document.getElementById('fade-radius');
    fadeRadiusSlider.addEventListener('input', (e) => {
      this.fadeRadius = parseInt(e.target.value);
      document.getElementById('fade-radius-value').textContent = e.target.value + 'm';
      this.updateSourceRings();
    });
    
    // Fade speed (controls smoothness of interpolation)
    const fadeSpeedSlider = document.getElementById('fade-speed');
    fadeSpeedSlider.addEventListener('input', (e) => {
      this.fadeSpeed = parseFloat(e.target.value);
      document.getElementById('fade-speed-value').textContent = e.target.value + 's';
      this.updateSmoothnessFromFadeSpeed();
    });
    
    // Reverb amount
    const reverbSlider = document.getElementById('reverb-amount');
    reverbSlider.addEventListener('input', (e) => {
      this.reverbAmount = e.target.value / 100;
      document.getElementById('reverb-value').textContent = e.target.value + '%';
      if (this.reverbSendGain) {
        this.reverbSendGain.gain.value = this.reverbAmount * 0.25;
      }
    });
    
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
      this.enableSourceDragging();
      // Disable map dragging in edit mode to allow marker dragging
      this.map.dragging.disable();
    } else {
      btn.textContent = 'Preview Mode';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
      editPanel.style.display = 'none';
      this.disableSourceDragging();
      // Enable map dragging in preview mode
      this.map.dragging.enable();
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
        maxDistance: parseInt(distanceInput.value) || this.fadeRadius
      };
      
      alert('Click on the map to place the audio source');
      document.getElementById('map').style.cursor = 'crosshair';
    };
    
    reader.readAsArrayBuffer(file);
  }
  
  async placeSource(latlng) {
    if (!this.pendingSource) return;
    
    const sourceId = `source-${this.nextSourceId++}`;
    
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
    
    this.config.audioSources.push(source);
    this.createSourceMarker(source);
    this.updateSourcesList();
    
    this.pendingSource = null;
    document.getElementById('map').style.cursor = '';
    document.getElementById('source-name').value = '';
    document.getElementById('audio-file').value = '';
    
    console.log('Source placed:', sourceId);
  }
  
  createSourceMarker(source) {
    const marker = L.marker(source.position, {
      icon: L.divIcon({
        className: 'audio-source-marker',
        html: `<div style="background: ${source.color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      }),
      draggable: false // Will be enabled in edit mode
    }).addTo(this.map);
    
    const ring = L.circle(source.position, {
      radius: source.audio.maxDistance,
      fillColor: source.color,
      fillOpacity: 0.05,
      color: source.color,
      weight: 1,
      opacity: 0.3,
      dashArray: '5, 10',
      interactive: false
    }).addTo(this.map);
    
    // Popup with delete button
    const popupContent = `
      <div style="text-align: center;">
        <strong>${source.name}</strong><br>
        <small>Range: ${source.audio.maxDistance}m</small><br>
        <button id="delete-${source.id}" style="
          margin-top: 8px;
          padding: 6px 12px;
          background: #ff4444;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">Delete Source</button>
      </div>
    `;
    
    marker.bindPopup(popupContent);
    
    // Handle delete button click
    marker.on('popupopen', () => {
      const deleteBtn = document.getElementById(`delete-${source.id}`);
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (confirm(`Delete "${source.name}"?`)) {
            this.deleteSource(source.id);
            marker.closePopup();
          }
        });
      }
    });
    
    // Drag event
    marker.on('drag', (e) => {
      const pos = e.target.getLatLng();
      source.position = [pos.lat, pos.lng];
      ring.setLatLng(pos);
    });
    
    // Click to select
    marker.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (this.mode === 'edit') {
        this.selectSource(source.id);
      }
    });
    
    this.sourceMarkers.push({ marker, ring, sourceId: source.id });
  }
  
  selectSource(sourceId) {
    this.selectedSource = sourceId;
    
    // Highlight selected marker
    this.sourceMarkers.forEach(m => {
      const source = this.config.audioSources.find(s => s.id === m.sourceId);
      if (m.sourceId === sourceId) {
        m.marker.setIcon(L.divIcon({
          className: 'audio-source-marker',
          html: `<div style="background: ${source.color}; width: 30px; height: 30px; border-radius: 50%; border: 4px solid yellow; box-shadow: 0 3px 10px rgba(255,255,0,0.6);"></div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        }));
      } else {
        m.marker.setIcon(L.divIcon({
          className: 'audio-source-marker',
          html: `<div style="background: ${source.color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        }));
      }
    });
  }
  
  deleteSource(sourceId) {
    this.config.audioSources = this.config.audioSources.filter(s => s.id !== sourceId);
    
    const markerObj = this.sourceMarkers.find(m => m.sourceId === sourceId);
    if (markerObj) {
      this.map.removeLayer(markerObj.marker);
      this.map.removeLayer(markerObj.ring);
      this.sourceMarkers = this.sourceMarkers.filter(m => m.sourceId !== sourceId);
    }
    
    this.audioSources.delete(sourceId);
    this.updateSourcesList();
    
    console.log('Deleted:', sourceId);
  }
  
  loadExistingSources() {
    this.config.audioSources.forEach(source => {
      this.createSourceMarker(source);
    });
    this.updateSourcesList();
  }
  
  enableSourceDragging() {
    this.sourceMarkers.forEach(m => {
      m.marker.dragging.enable();
    });
  }
  
  disableSourceDragging() {
    this.sourceMarkers.forEach(m => {
      m.marker.dragging.disable();
    });
  }
  
  updateSourceRings() {
    this.sourceMarkers.forEach(markerObj => {
      const source = this.config.audioSources.find(s => s.id === markerObj.sourceId);
      if (source && source.audio.maxDistance !== this.fadeRadius) {
        source.audio.maxDistance = this.fadeRadius;
        this.map.removeLayer(markerObj.ring);
        
        markerObj.ring = L.circle(source.position, {
          radius: this.fadeRadius,
          fillColor: source.color,
          fillOpacity: 0.05,
          color: source.color,
          weight: 1,
          opacity: 0.3,
          dashArray: '5, 10',
          interactive: false
        }).addTo(this.map);
      }
    });
  }
  
  updateSourcesList() {
    const container = document.getElementById('source-items');
    const countEl = document.getElementById('source-count');
    
    if (countEl) {
      countEl.textContent = this.config.audioSources.length;
    }
    
    container.innerHTML = '';
    
    if (this.config.audioSources.length === 0) {
      container.innerHTML = '<p style="font-size: 12px; color: #666;">No sources added yet</p>';
      return;
    }
    
    this.config.audioSources.forEach(source => {
      const item = document.createElement('div');
      item.style.cssText = 'padding: 8px; margin-bottom: 8px; background: #2a2a2a; border-radius: 4px; font-size: 12px; cursor: pointer; border: 2px solid transparent;';
      
      item.innerHTML = `
        <div style="color: ${source.color}; font-weight: 600;">${source.name}</div>
        <div style="color: #999; margin-top: 4px;">Range: ${source.audio.maxDistance}m</div>
      `;
      
      // Click to select
      item.addEventListener('click', () => {
        this.selectSource(source.id);
        const markerObj = this.sourceMarkers.find(m => m.sourceId === source.id);
        if (markerObj) {
          this.map.setView(markerObj.marker.getLatLng(), this.map.getZoom());
          markerObj.marker.openPopup();
        }
      });
      
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
      await this.initAudioContext();
      await this.loadAudioBuffers();
    }
    
    this.isPlaying = true;
    document.getElementById('play-btn').textContent = 'Stop Preview';
    document.getElementById('status').classList.remove('status-hidden');
    
    // Initialize target volumes
    this.targetVolumes.clear();
    this.audioSources.forEach((audioSource, id) => {
      this.targetVolumes.set(id, 0);
      this.startAudioSource(audioSource);
    });
    
    // Start animation loop for smooth fading
    this.startAnimationLoop();
    
    console.log('Preview started');
  }
  
  stopPreview() {
    this.isPlaying = false;
    document.getElementById('play-btn').textContent = 'Preview';
    
    // Stop animation loop
    this.stopAnimationLoop();
    
    this.audioSources.forEach((audioSource) => {
      if (audioSource.source) {
        audioSource.source.stop();
        audioSource.source = null;
      }
    });
    
    // Reset all gains to 0
    this.audioSources.forEach((audioSource) => {
      audioSource.currentGain = 0;
      audioSource.gainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
      audioSource.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    });
    
    this.targetVolumes.clear();
  }
  
  async initAudioContext() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.connect(this.audioContext.destination);
    this.masterGainNode.gain.value = this.masterVolume;
    
    if (this.audioContext.listener.positionX) {
      this.audioContext.listener.positionX.value = 0;
      this.audioContext.listener.positionY.value = 0;
      this.audioContext.listener.positionZ.value = 0;
      
      this.audioContext.listener.forwardX.value = 0;
      this.audioContext.listener.forwardY.value = 1;
      this.audioContext.listener.forwardZ.value = 0;
      this.audioContext.listener.upX.value = 0;
      this.audioContext.listener.upY.value = 0;
      this.audioContext.listener.upZ.value = 1;
    }
    
    await this.initReverb();
    console.log('Audio context initialized');
  }
  
  async initReverb() {
    if (!this.reverbEnabled) return;
    
    const sampleRate = this.audioContext.sampleRate;
    const length = sampleRate * 2;
    const impulse = this.audioContext.createBuffer(2, length, sampleRate);
    const impulseL = impulse.getChannelData(0);
    const impulseR = impulse.getChannelData(1);
    
    for (let i = 0; i < length; i++) {
      const n = length - i;
      impulseL[i] = (Math.random() * 2 - 1) * Math.pow(n / length, 2);
      impulseR[i] = (Math.random() * 2 - 1) * Math.pow(n / length, 2);
    }
    
    this.convolverNode = this.audioContext.createConvolver();
    this.convolverNode.buffer = impulse;
    this.convolverNode.normalize = true;
    
    this.reverbSendGain = this.audioContext.createGain();
    this.reverbSendGain.gain.value = this.reverbAmount * 0.25;
    
    this.reverbSendGain.connect(this.convolverNode);
    this.convolverNode.connect(this.masterGainNode);
    
    console.log('Reverb initialized');
  }
  
  async loadAudioBuffers() {
    console.log('Loading audio buffers...');
    
    for (const source of this.config.audioSources) {
      try {
        const audioBuffer = await this.audioContext.decodeAudioData(source.audio.data.slice(0));
        
        const panner = this.audioContext.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = this.maxDistance;
        panner.rolloffFactor = 1;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0;
        
        const reverbSend = this.audioContext.createGain();
        reverbSend.gain.value = 0.3;
        
        panner.connect(gainNode);
        gainNode.connect(this.masterGainNode);
        
        if (this.reverbEnabled && this.reverbSendGain) {
          panner.connect(reverbSend);
          reverbSend.connect(this.reverbSendGain);
        }
        
        const pos = this.latLngToXYZ(source.position[0], source.position[1]);
        panner.setPosition(pos.x, pos.y, pos.z);
        
        this.audioSources.set(source.id, {
          config: source,
          audioBuffer: audioBuffer,
          source: null,
          panner: panner,
          gainNode: gainNode,
          reverbSend: reverbSend,
          currentGain: 0 // Track current gain value for smooth interpolation
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
    
    const listenerPos = this.latLngToXYZ(lat, lng);
    
    // Update listener position immediately for spatial audio
    if (this.audioContext.listener.positionX) {
      this.audioContext.listener.positionX.value = listenerPos.x;
      this.audioContext.listener.positionY.value = listenerPos.y;
      this.audioContext.listener.positionZ.value = listenerPos.z;
    }
    
    let nearestDistance = Infinity;
    
    // Calculate target volumes based on distance (don't update gains directly)
    this.audioSources.forEach((audioSource, id) => {
      const sourcePos = audioSource.config.position;
      const distance = this.calculateDistance(lat, lng, sourcePos[0], sourcePos[1]);
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
      
      const maxDist = audioSource.config.audio.maxDistance || this.fadeRadius;
      let targetVolume = 0;
      
      if (distance < maxDist) {
        // Smooth falloff curve (inverse square with smoothing)
        const normalized = distance / maxDist;
        const falloff = Math.pow(1 - normalized, 2.5); // Slightly steeper curve for better definition
        targetVolume = falloff * audioSource.config.audio.volume * this.masterVolume;
      }
      
      // Store target volume - animation loop will smoothly interpolate to it
      this.targetVolumes.set(id, targetVolume);
    });
    
    document.getElementById('distance-display').textContent = `${Math.round(nearestDistance)}m`;
  }
  
  startAnimationLoop() {
    if (this.animationFrameId) return;
    
    const updateAudio = () => {
      if (!this.isPlaying) {
        this.animationFrameId = null;
        return;
      }
      
      const currentTime = this.audioContext.currentTime;
      
      // Smoothly interpolate each source's gain toward its target volume
      this.audioSources.forEach((audioSource, id) => {
        const targetVolume = this.targetVolumes.get(id) || 0;
        const currentGain = audioSource.currentGain;
        
        // Use exponential interpolation for ultra-smooth fading
        // The smoothness factor controls how fast we approach the target (0.05-0.3)
        // Lower values = smoother but slower response
        // Higher values = faster response but potentially less smooth
        
        if (Math.abs(currentGain - targetVolume) < 0.001) {
          // Already at target (or very close)
          audioSource.currentGain = targetVolume;
          audioSource.gainNode.gain.setValueAtTime(targetVolume, currentTime);
        } else {
          // Exponential interpolation toward target
          // This creates buttery smooth transitions
          const diff = targetVolume - currentGain;
          let newGain = currentGain + (diff * this.smoothness);
          
          // Clamp to target to prevent overshoot/undershoot
          if (targetVolume > currentGain && newGain > targetVolume) {
            newGain = targetVolume;
          } else if (targetVolume < currentGain && newGain < targetVolume) {
            newGain = targetVolume;
          }
          
          // Allow going to zero for sources far away
          if (targetVolume === 0 && newGain < 0.001) {
            newGain = 0;
          }
          
          // Update tracked gain value
          audioSource.currentGain = newGain;
          
          // Cancel any scheduled values and set new value immediately
          // This ensures smooth continuous updates without scheduling conflicts
          audioSource.gainNode.gain.cancelScheduledValues(currentTime);
          audioSource.gainNode.gain.setValueAtTime(newGain, currentTime);
        }
      });
      
      this.animationFrameId = requestAnimationFrame(updateAudio);
    };
    
    this.animationFrameId = requestAnimationFrame(updateAudio);
  }
  
  stopAnimationLoop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
  
  latLngToXYZ(lat, lng) {
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
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = this.masterVolume;
    }
  }
  
  updateSmoothnessFromFadeSpeed() {
    // Convert fade speed to smoothness factor
    // Faster fade speed = less smooth (higher smoothness value)
    // Slower fade speed = more smooth (lower smoothness value)
    // Map fadeSpeed (0.05-1.0) to smoothness (0.05-0.3)
    // Lower smoothness = smoother but slower response
    this.smoothness = Math.max(0.05, Math.min(0.3, this.fadeSpeed * 0.3));
  }
  
  getRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  exportConfig() {
    const exportConfig = {
      ...this.config,
      settings: {
        masterVolume: this.masterVolume,
        fadeRadius: this.fadeRadius,
        fadeSpeed: this.fadeSpeed,
        reverbEnabled: this.reverbEnabled,
        reverbAmount: this.reverbAmount,
        spatialAudioEnabled: this.spatialAudioEnabled
      },
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

