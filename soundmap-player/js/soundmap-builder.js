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
    
    // Path drawing state
    this.pathDrawingMode = false;
    this.currentPathPoints = [];
    this.pendingPath = null;
    this.pathPolylines = [];
    this.nextPathId = 1;
    
    // Animation loop for smooth fading
    this.animationFrameId = null;
    this.targetVolumes = new Map(); // Target volumes for each source (calculated from position)
    this.targetPathVolumes = new Map(); // Target volumes for each path
  }
  
  async init() {
    console.log('Initializing Soundmap Builder...');
    
    // Initialize audioPaths array if it doesn't exist
    if (!this.config.audioPaths) {
      this.config.audioPaths = [];
    }
    
    this.initMap();
    this.bindControls();
    this.loadExistingSources();
    this.loadExistingPaths();
    
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
    
    document.getElementById('add-path').addEventListener('click', () => {
      this.prepareNewPath();
    });
    
    document.getElementById('finish-path').addEventListener('click', () => {
      this.finishPath();
    });
    
    document.getElementById('cancel-path').addEventListener('click', () => {
      this.cancelPath();
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
      // Cancel any path drawing in progress
      if (this.pathDrawingMode) {
        this.cancelPath();
      }
      // Disable map dragging in edit mode to allow marker dragging
      this.map.dragging.disable();
    } else {
      btn.textContent = 'Preview Mode';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
      editPanel.style.display = 'none';
      this.disableSourceDragging();
      // Cancel any path drawing in progress
      if (this.pathDrawingMode) {
        this.cancelPath();
      }
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
  
  loadExistingPaths() {
    if (!this.config.audioPaths) return;
    
    this.config.audioPaths.forEach(path => {
      this.createPathPolyline(path);
      // Update nextPathId to avoid conflicts
      const pathNum = parseInt(path.id.replace('path-', ''));
      if (pathNum >= this.nextPathId) {
        this.nextPathId = pathNum + 1;
      }
    });
  }
  
  prepareNewPath() {
    const nameInput = document.getElementById('path-name');
    const fileInput = document.getElementById('path-audio-file');
    const proximityInput = document.getElementById('path-proximity');
    
    if (!nameInput.value || !fileInput.files[0]) {
      alert('Please provide a name and select an audio file');
      return;
    }
    
    const file = fileInput.files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
      this.pendingPath = {
        name: nameInput.value,
        audioData: e.target.result,
        audioFile: file,
        proximityDistance: parseInt(proximityInput.value) || 500
      };
      
      this.pathDrawingMode = true;
      this.currentPathPoints = [];
      this.pendingSource = null; // Cancel any pending source
      
      document.getElementById('add-path').style.display = 'none';
      document.getElementById('finish-path').style.display = 'inline-block';
      document.getElementById('cancel-path').style.display = 'inline-block';
      document.getElementById('map').style.cursor = 'crosshair';
      
      alert('Click on the map to add points to the path. Double-click or click "Finish Path" when done.');
    };
    
    reader.readAsArrayBuffer(file);
  }
  
  addPathPoint(latlng) {
    this.currentPathPoints.push([latlng.lat, latlng.lng]);
    
    // Draw a temporary polyline to show progress
    if (this.tempPathPolyline) {
      this.map.removeLayer(this.tempPathPolyline);
    }
    
    if (this.currentPathPoints.length >= 2) {
      this.tempPathPolyline = L.polyline(this.currentPathPoints, {
        color: this.getRandomColor(),
        weight: 4,
        opacity: 0.7
      }).addTo(this.map);
    } else if (this.currentPathPoints.length === 1) {
      // Add a marker for the first point
      this.tempPathStartMarker = L.marker(this.currentPathPoints[0]).addTo(this.map);
    }
  }
  
  finishPath() {
    if (this.currentPathPoints.length < 2) {
      alert('Path needs at least 2 points');
      return;
    }
    
    if (!this.pendingPath) return;
    
    const pathId = `path-${this.nextPathId++}`;
    
    const path = {
      id: pathId,
      name: this.pendingPath.name,
      points: this.currentPathPoints,
      audio: {
        data: this.pendingPath.audioData,
        fileName: this.pendingPath.audioFile.name,
        proximityDistance: this.pendingPath.proximityDistance,
        volume: 0.8,
        loop: true
      },
      color: this.getRandomColor()
    };
    
    this.config.audioPaths.push(path);
    this.createPathPolyline(path);
    this.updateSourcesList();
    
    // Clean up
    if (this.tempPathPolyline) {
      this.map.removeLayer(this.tempPathPolyline);
      this.tempPathPolyline = null;
    }
    if (this.tempPathStartMarker) {
      this.map.removeLayer(this.tempPathStartMarker);
      this.tempPathStartMarker = null;
    }
    
    this.pendingPath = null;
    this.pathDrawingMode = false;
    this.currentPathPoints = [];
    
    document.getElementById('add-path').style.display = 'inline-block';
    document.getElementById('finish-path').style.display = 'none';
    document.getElementById('cancel-path').style.display = 'none';
    document.getElementById('map').style.cursor = '';
    document.getElementById('path-name').value = '';
    document.getElementById('path-audio-file').value = '';
    
    console.log('Path created:', pathId);
  }
  
  cancelPath() {
    // Clean up temporary drawing
    if (this.tempPathPolyline) {
      this.map.removeLayer(this.tempPathPolyline);
      this.tempPathPolyline = null;
    }
    if (this.tempPathStartMarker) {
      this.map.removeLayer(this.tempPathStartMarker);
      this.tempPathStartMarker = null;
    }
    
    this.pendingPath = null;
    this.pathDrawingMode = false;
    this.currentPathPoints = [];
    
    document.getElementById('add-path').style.display = 'inline-block';
    document.getElementById('finish-path').style.display = 'none';
    document.getElementById('cancel-path').style.display = 'none';
    document.getElementById('map').style.cursor = '';
  }
  
  createPathPolyline(path) {
    const polyline = L.polyline(path.points, {
      color: path.color,
      weight: 4,
      opacity: 0.7
    }).addTo(this.map);
    
    // Add popup with delete button
    const popupContent = `
      <div style="text-align: center;">
        <strong>${path.name}</strong><br>
        <small>Proximity: ${path.audio.proximityDistance}m</small><br>
        <button id="delete-path-${path.id}" style="
          margin-top: 8px;
          padding: 6px 12px;
          background: #ff4444;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
        ">Delete Path</button>
      </div>
    `;
    
    polyline.bindPopup(popupContent);
    
    // Handle delete button click
    polyline.on('popupopen', () => {
      const deleteBtn = document.getElementById(`delete-path-${path.id}`);
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
          if (confirm(`Delete "${path.name}"?`)) {
            this.deletePath(path.id);
            polyline.closePopup();
          }
        });
      }
    });
    
    this.pathPolylines.push({ polyline, pathId: path.id });
  }
  
  deletePath(pathId) {
    this.config.audioPaths = this.config.audioPaths.filter(p => p.id !== pathId);
    
    const polylineObj = this.pathPolylines.find(p => p.pathId === pathId);
    if (polylineObj) {
      this.map.removeLayer(polylineObj.polyline);
      this.pathPolylines = this.pathPolylines.filter(p => p.pathId !== pathId);
    }
    
    this.audioSources.delete(pathId); // Remove from audio sources if loaded
    this.updateSourcesList();
    
    console.log('Deleted path:', pathId);
  }
  
  calculateDistanceToPath(lat, lng, path) {
    // Calculate distance from point to nearest point on path segments
    let minDistance = Infinity;
    
    for (let i = 0; i < path.points.length - 1; i++) {
      const p1 = path.points[i];
      const p2 = path.points[i + 1];
      
      // Calculate distance to line segment
      const dist = this.distanceToLineSegment(lat, lng, p1[0], p1[1], p2[0], p2[1]);
      minDistance = Math.min(minDistance, dist);
    }
    
    return minDistance;
  }
  
  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    // Simplified approach: calculate distance to each point and approximate
    // For more accuracy, we'd need proper great circle calculations
    // This approximation works well for short segments
    
    const d1 = this.calculateDistance(px, py, x1, y1);
    const d2 = this.calculateDistance(px, py, x2, y2);
    const d12 = this.calculateDistance(x1, y1, x2, y2);
    
    // If segment is very short, return minimum distance to endpoints
    if (d12 < 10) return Math.min(d1, d2);
    
    // Approximate distance using perpendicular distance calculation
    // Convert lat/lng to approximate meters for calculation
    const R = 6371000;
    const toRad = (deg) => deg * (Math.PI / 180);
    
    const pxRad = toRad(px);
    const pyRad = toRad(py);
    const x1Rad = toRad(x1);
    const y1Rad = toRad(y1);
    const x2Rad = toRad(x2);
    const y2Rad = toRad(y2);
    
    // Convert to approximate Cartesian (good for small distances)
    const avgLat = (y1Rad + y2Rad) / 2;
    const x1m = x1Rad * R * Math.cos(avgLat);
    const y1m = y1Rad * R;
    const x2m = x2Rad * R * Math.cos(avgLat);
    const y2m = y2Rad * R;
    const pxm = pxRad * R * Math.cos(avgLat);
    const pym = pyRad * R;
    
    // Vector from p1 to p2
    const dx = x2m - x1m;
    const dy = y2m - y1m;
    const segLenSq = dx * dx + dy * dy;
    
    if (segLenSq < 0.01) return d1;
    
    // Vector from p1 to point
    const dpx = pxm - x1m;
    const dpy = pym - y1m;
    
    // Projection parameter
    const t = Math.max(0, Math.min(1, (dpx * dx + dpy * dy) / segLenSq));
    
    // Closest point on segment
    const closestX = x1m + t * dx;
    const closestY = y1m + t * dy;
    
    // Convert back to lat/lng
    const closestLat = closestY / R;
    const closestLng = closestX / (R * Math.cos(avgLat));
    
    // Return distance using haversine
    return this.calculateDistance(px, py, closestLat * (180 / Math.PI), closestLng * (180 / Math.PI));
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
    
    if (this.config.audioSources.length === 0 && (!this.config.audioPaths || this.config.audioPaths.length === 0)) {
      container.innerHTML = '<p style="font-size: 12px; color: #666;">No sources or paths added yet</p>';
    } else if (this.config.audioSources.length > 0) {
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
    
    // Update paths list
    const pathContainer = document.getElementById('path-items');
    const pathCountEl = document.getElementById('path-count');
    
    if (pathCountEl) {
      pathCountEl.textContent = (this.config.audioPaths || []).length;
    }
    
    if (pathContainer) {
      pathContainer.innerHTML = '';
      
      if (this.config.audioPaths && this.config.audioPaths.length > 0) {
        this.config.audioPaths.forEach(path => {
          const item = document.createElement('div');
          item.style.cssText = 'padding: 8px; margin-bottom: 8px; background: #2a2a2a; border-radius: 4px; font-size: 12px; cursor: pointer; border: 2px solid transparent;';
          
          item.innerHTML = `
            <div style="color: ${path.color}; font-weight: 600;">${path.name}</div>
            <div style="color: #999; margin-top: 4px;">Proximity: ${path.audio.proximityDistance}m | Points: ${path.points.length}</div>
          `;
          
          // Click to focus on path
          item.addEventListener('click', () => {
            const polylineObj = this.pathPolylines.find(p => p.pathId === path.id);
            if (polylineObj) {
              polylineObj.polyline.openPopup();
              this.map.fitBounds(polylineObj.polyline.getBounds());
            }
          });
          
          pathContainer.appendChild(item);
        });
      }
    }
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
    
    // Initialize target volumes for ALL sources
    this.targetVolumes.clear();
    this.audioSources.forEach((audioSource, id) => {
      // Ensure currentGain is initialized
      if (typeof audioSource.currentGain === 'undefined') {
        audioSource.currentGain = 0;
      }
      // Cancel any existing scheduled values and reset to 0
      const currentTime = this.audioContext.currentTime;
      audioSource.gainNode.gain.cancelScheduledValues(currentTime);
      audioSource.gainNode.gain.setValueAtTime(0, currentTime);
      // Set initial target volume to 0
      this.targetVolumes.set(id, 0);
      this.startAudioSource(audioSource);
    });
    
    console.log(`Initialized ${this.audioSources.size} audio sources for preview`);
    
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
    
    // Load point sources
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
          currentGain: 0,
          type: 'point' // Mark as point source
        });
        
        console.log('Loaded:', source.id);
      } catch (error) {
        console.error('Failed to load:', source.id, error);
      }
    }
    
    // Load path audio
    if (this.config.audioPaths) {
      for (const path of this.config.audioPaths) {
        try {
          const audioBuffer = await this.audioContext.decodeAudioData(path.audio.data.slice(0));
          
          // For paths, we'll use the center point for spatial positioning
          const centerLat = path.points.reduce((sum, p) => sum + p[0], 0) / path.points.length;
          const centerLng = path.points.reduce((sum, p) => sum + p[1], 0) / path.points.length;
          
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
          
          const pos = this.latLngToXYZ(centerLat, centerLng);
          panner.setPosition(pos.x, pos.y, pos.z);
          
          this.audioSources.set(path.id, {
            config: path,
            audioBuffer: audioBuffer,
            source: null,
            panner: panner,
            gainNode: gainNode,
            reverbSend: reverbSend,
            currentGain: 0,
            type: 'path' // Mark as path
          });
          
          console.log('Loaded path:', path.id);
        } catch (error) {
          console.error('Failed to load path:', path.id, error);
        }
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
      let distance;
      let maxDist;
      
      if (audioSource.type === 'path') {
        // Calculate distance to path
        distance = this.calculateDistanceToPath(lat, lng, audioSource.config);
        maxDist = audioSource.config.audio.proximityDistance || this.fadeRadius;
      } else {
        // Point source - calculate distance to position
        const sourcePos = audioSource.config.position;
        distance = this.calculateDistance(lat, lng, sourcePos[0], sourcePos[1]);
        maxDist = audioSource.config.audio.maxDistance || this.fadeRadius;
      }
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
      
      let targetVolume = 0;
      
      if (distance < maxDist) {
        // Add minimum distance threshold to prevent jerky behavior at center
        const minDistance = 1; // 1 meter minimum to stabilize calculations
        const adjustedDistance = Math.max(distance, minDistance);
        const normalized = adjustedDistance / maxDist;
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
        // Safety check - ensure audioSource and gainNode exist
        if (!audioSource || !audioSource.gainNode) {
          console.warn('Missing audioSource or gainNode for:', id);
          return;
        }
        
        // Ensure this source has a target volume (initialize if missing)
        if (!this.targetVolumes.has(id)) {
          this.targetVolumes.set(id, 0);
        }
        
        const targetVolume = this.targetVolumes.get(id);
        
        // Ensure currentGain is defined (initialize if missing)
        if (typeof audioSource.currentGain === 'undefined') {
          audioSource.currentGain = audioSource.gainNode.gain.value || 0;
        }
        const currentGain = audioSource.currentGain;
        
        // Use exponential interpolation for ultra-smooth fading
        // The smoothness factor controls how fast we approach the target (0.05-0.3)
        // Lower values = smoother but slower response
        // Higher values = faster response but potentially less smooth
        
        // Only update if there's a meaningful difference (reduces unnecessary updates)
        if (Math.abs(currentGain - targetVolume) < 0.0001) {
          // Already at target (or very close) - no update needed
          return;
        }
        
        // Exponential interpolation toward target
        // This creates buttery smooth transitions
        const diff = targetVolume - currentGain;
        let newGain = currentGain + (diff * this.smoothness);
        
        // Clamp to target to prevent overshoot/undershoot
        if ((targetVolume > currentGain && newGain > targetVolume) || 
            (targetVolume < currentGain && newGain < targetVolume)) {
          newGain = targetVolume;
        }
        
        // Allow going to zero for sources far away
        if (targetVolume === 0 && newGain < 0.001) {
          newGain = 0;
        }
        
        // Update tracked gain value
        audioSource.currentGain = newGain;
        
        // Set new value directly using setValueAtTime with currentTime
        // This immediately sets the value without scheduling, overriding any previous scheduled values
        try {
          audioSource.gainNode.gain.setValueAtTime(newGain, currentTime);
        } catch (e) {
          console.warn('Error updating gain for', id, ':', e);
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
      })),
      audioPaths: (this.config.audioPaths || []).map(p => ({
        id: p.id,
        name: p.name,
        points: p.points,
        audio: {
          fileName: p.audio.fileName,
          url: `https://pub-b8cf302764c84d3f955e78aac653f917.r2.dev/${p.audio.fileName}`,
          proximityDistance: p.audio.proximityDistance,
          volume: p.audio.volume,
          loop: p.audio.loop
        },
        color: p.color
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

