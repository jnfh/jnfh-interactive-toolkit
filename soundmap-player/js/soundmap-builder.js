/**
 * Spatial Audio Canvas Builder
 * Simple interface for creating interactive spatial audio experiences
 */

class SpatialAudioBuilder {
  constructor(canvasId, config) {
    this.canvasId = canvasId;
    this.config = config || {
      title: "New Spatial Audio Canvas",
      canvasWidth: 1920,
      canvasHeight: 1080,
      audioZones: []
    };
    
    // Canvas
    this.canvas = null;
    this.ctx = null;
    this.gridSize = 50;
    
    // Drawing state
    this.currentTool = null;
    this.isDrawing = false;
    this.currentShape = null;
    this.shapes = [];
    this.nextZoneId = 1;
    
    // Audio
    this.audioContext = null;
    this.masterGainNode = null;
    this.audioZones = new Map();
    this.isPlaying = false;
    this.masterVolume = 0.8;
    this.fadeSpeed = 0.3;
    this.smoothness = 0.15;
    
    // Animation
    this.animationFrameId = null;
    this.targetVolumes = new Map();
    
    // Mode
    this.mode = 'edit'; // 'edit' or 'preview'
    this.pendingAudio = null;
  }
  
  async init() {
    console.log('Initializing Spatial Audio Builder...');
    
    if (!this.config.audioZones) {
      this.config.audioZones = [];
    }
    
    this.initCanvas();
    this.bindControls();
    this.loadExistingZones();
    
    console.log('Builder ready');
  }
  
  initCanvas() {
    this.canvas = document.getElementById(this.canvasId);
    this.ctx = this.canvas.getContext('2d');
    
    const container = document.getElementById('canvas-container');
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    
    this.drawGrid();
    
    // Event listeners
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    
    window.addEventListener('resize', () => {
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
      this.redraw();
    });
  }
  
  drawGrid() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }
    
    // Coordinate labels every 100px
    ctx.fillStyle = '#444';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    for (let x = 0; x <= this.canvas.width; x += 100) {
      ctx.fillText(x.toString(), x + 2, 2);
    }
    for (let y = 0; y <= this.canvas.height; y += 100) {
      ctx.fillText(y.toString(), 2, y + 2);
    }
  }
  
  redraw() {
    this.drawGrid();
    this.shapes.forEach(shape => this.drawShape(shape));
  }
  
  drawShape(shape) {
    const ctx = this.ctx;
    ctx.save();
    
    ctx.strokeStyle = shape.color || '#667eea';
    ctx.fillStyle = shape.fillColor || 'rgba(102, 126, 234, 0.2)';
    ctx.lineWidth = 2;
    
    switch (shape.type) {
      case 'rectangle':
        this.drawRectangle(shape);
        break;
      case 'circle':
        this.drawCircle(shape);
        break;
      case 'path':
        this.drawPath(shape);
        break;
      case 'polygon':
        this.drawPolygon(shape);
        break;
    }
    
    ctx.restore();
  }
  
  drawRectangle(shape) {
    const x = Math.min(shape.start.x, shape.end.x);
    const y = Math.min(shape.start.y, shape.end.y);
    const w = Math.abs(shape.end.x - shape.start.x);
    const h = Math.abs(shape.end.y - shape.start.y);
    
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeRect(x, y, w, h);
  }
  
  drawCircle(shape) {
    const radius = Math.sqrt(
      Math.pow(shape.end.x - shape.start.x, 2) + 
      Math.pow(shape.end.y - shape.start.y, 2)
    );
    
    this.ctx.beginPath();
    this.ctx.arc(shape.start.x, shape.start.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();
  }
  
  drawPath(shape) {
    if (shape.points.length < 2) return;
    
    this.ctx.beginPath();
    this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    this.ctx.stroke();
  }
  
  drawPolygon(shape) {
    if (shape.points.length < 3) return;
    
    this.ctx.beginPath();
    this.ctx.moveTo(shape.points[0].x, shape.points[0].y);
    for (let i = 1; i < shape.points.length; i++) {
      this.ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
  }
  
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
  
  handleMouseDown(e) {
    if (this.mode !== 'edit' || !this.currentTool) return;
    
    const pos = this.getMousePos(e);
    this.isDrawing = true;
    
    if (this.currentTool === 'rectangle' || this.currentTool === 'circle') {
      this.currentShape = {
        type: this.currentTool,
        start: pos,
        end: pos,
        color: '#667eea',
        fillColor: 'rgba(102, 126, 234, 0.2)'
      };
    } else if (this.currentTool === 'path' || this.currentTool === 'polygon') {
      this.currentShape = {
        type: this.currentTool,
        points: [pos],
        color: '#667eea',
        fillColor: 'rgba(102, 126, 234, 0.2)'
      };
    }
  }
  
  handleMouseMove(e) {
    const pos = this.getMousePos(e);
    
    if (this.mode === 'preview' && this.isPlaying) {
      this.updateListenerPosition(pos.x, pos.y);
      return;
    }
    
    if (!this.isDrawing || !this.currentShape) return;
    
    if (this.currentTool === 'rectangle' || this.currentTool === 'circle') {
      this.currentShape.end = pos;
    } else if (this.currentTool === 'path') {
      // Add point on move for freehand drawing
      this.currentShape.points.push(pos);
    }
    
    this.redraw();
    if (this.currentShape) {
      this.drawShape(this.currentShape);
    }
  }
  
  handleMouseUp(e) {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    
    if (this.currentTool === 'polygon') {
      const pos = this.getMousePos(e);
      this.currentShape.points.push(pos);
      this.redraw();
      if (this.currentShape) {
        this.drawShape(this.currentShape);
      }
    }
  }
  
  handleClick(e) {
    if (this.mode !== 'edit' || !this.currentTool) return;
    
    if (this.currentTool === 'polygon' && this.currentShape && !this.isDrawing) {
      // Continue adding points to polygon
      const pos = this.getMousePos(e);
      this.currentShape.points.push(pos);
      this.redraw();
      if (this.currentShape) {
        this.drawShape(this.currentShape);
      }
    }
  }
  
  selectTool(tool) {
    this.currentTool = tool;
    
    // Update button states
    document.querySelectorAll('[id^="tool-"]').forEach(btn => {
      btn.classList.remove('active');
    });
    
    if (tool) {
      document.getElementById(`tool-${tool}`).classList.add('active');
      this.canvas.style.cursor = 'crosshair';
    } else {
      this.canvas.style.cursor = 'default';
    }
    
    // Clear current shape if switching tools
    if (this.currentShape && this.currentTool !== tool) {
      this.currentShape = null;
      this.redraw();
    }
  }
  
  finishShape() {
    if (!this.currentShape) return;
    
    // Finalize the shape
    if (this.currentTool === 'path' && this.currentShape.points.length < 2) {
      alert('Path needs at least 2 points');
      return;
    }
    if (this.currentTool === 'polygon' && this.currentShape.points.length < 3) {
      alert('Polygon needs at least 3 points');
      return;
    }
    
    this.shapes.push(this.currentShape);
    this.currentShape = null;
    this.selectTool(null);
    this.redraw();
  }
  
  async loadR2File() {
    const r2Url = document.getElementById('r2-url').value.trim();
    
    if (!r2Url) {
      alert('Please enter an R2 URL');
      return;
    }
    
    try {
      const response = await fetch(r2Url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      this.pendingAudio = {
        data: arrayBuffer,
        url: r2Url,
        fileName: r2Url.split('/').pop()
      };
      
      alert('File loaded from R2 successfully!');
    } catch (error) {
      console.error('Error loading R2 file:', error);
      alert('Failed to load file from R2: ' + error.message);
    }
  }
  
  async assignAudioToShape() {
    if (this.shapes.length === 0) {
      alert('Please draw a shape first');
      return;
    }
    
    const name = document.getElementById('source-name').value.trim();
    if (!name) {
      alert('Please enter a shape name');
      return;
    }
    
    const sourceType = document.getElementById('audio-source-type').value;
    let audioData = null;
    let audioUrl = null;
    let fileName = null;
    
    if (sourceType === 'upload') {
      const fileInput = document.getElementById('audio-file');
      if (!fileInput.files[0]) {
        alert('Please select an audio file');
        return;
      }
      const file = fileInput.files[0];
      audioData = await file.arrayBuffer();
      fileName = file.name;
    } else if (sourceType === 'r2') {
      if (!this.pendingAudio) {
        alert('Please load a file from R2 first');
        return;
      }
      audioData = this.pendingAudio.data;
      audioUrl = this.pendingAudio.url;
      fileName = this.pendingAudio.fileName;
    }
    
    const fadeDistance = parseInt(document.getElementById('fade-distance').value) || 100;
    
    // Get the last drawn shape
    const shape = this.shapes[this.shapes.length - 1];
    
    const zoneId = `zone-${this.nextZoneId++}`;
    const zone = {
      id: zoneId,
      name: name,
      shape: shape,
      audio: {
        data: audioData,
        url: audioUrl,
        fileName: fileName,
        fadeDistance: fadeDistance,
        volume: 0.8,
        loop: true
      },
      color: this.getRandomColor()
    };
    
    // Update shape color
    shape.color = zone.color;
    shape.fillColor = zone.color.replace(')', ', 0.2)').replace('rgb', 'rgba');
    if (!shape.fillColor.includes('rgba')) {
      shape.fillColor = this.hexToRgba(zone.color, 0.2);
    }
    
    this.config.audioZones.push(zone);
    this.redraw();
    
    // Reset form
    document.getElementById('source-name').value = '';
    document.getElementById('audio-file').value = '';
    document.getElementById('r2-url').value = '';
    this.pendingAudio = null;
    
    this.updateZonesList();
    
    console.log('Zone created:', zoneId);
  }
  
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  loadExistingZones() {
    if (this.config.audioZones) {
      this.config.audioZones.forEach(zone => {
        this.shapes.push(zone.shape);
        this.nextZoneId = Math.max(this.nextZoneId, parseInt(zone.id.replace('zone-', '')) + 1);
      });
      this.redraw();
      this.updateZonesList();
    }
  }
  
  updateZonesList() {
    const container = document.getElementById('source-items');
    const countEl = document.getElementById('source-count');
    
    if (countEl) {
      countEl.textContent = this.config.audioZones.length;
    }
    
    if (container) {
      container.innerHTML = '';
      
      if (this.config.audioZones.length === 0) {
        container.innerHTML = '<p style="font-size: 12px; color: #666;">No audio zones added yet</p>';
        return;
      }
      
      this.config.audioZones.forEach(zone => {
        const item = document.createElement('div');
        item.style.cssText = 'padding: 8px; margin-bottom: 8px; background: #2a2a2a; border-radius: 4px; font-size: 12px;';
        item.innerHTML = `
          <div style="color: ${zone.color}; font-weight: 600;">${zone.name}</div>
          <div style="color: #999; margin-top: 4px;">Fade: ${zone.audio.fadeDistance}px</div>
        `;
        container.appendChild(item);
      });
    }
  }
  
  bindControls() {
    // Mode toggle
    document.getElementById('mode-btn').addEventListener('click', () => {
      this.toggleMode();
    });
    
    // Play/Preview
    document.getElementById('play-btn').addEventListener('click', async () => {
      await this.togglePreview();
    });
    
    // Drawing tools
    document.getElementById('tool-path').addEventListener('click', () => {
      this.selectTool('path');
    });
    document.getElementById('tool-rectangle').addEventListener('click', () => {
      this.selectTool('rectangle');
    });
    document.getElementById('tool-circle').addEventListener('click', () => {
      this.selectTool('circle');
    });
    document.getElementById('tool-polygon').addEventListener('click', () => {
      this.selectTool('polygon');
    });
    
    // Finish shape button (for paths/polygons)
    const finishBtn = document.createElement('button');
    finishBtn.id = 'finish-shape';
    finishBtn.className = 'btn-secondary';
    finishBtn.textContent = 'Finish Shape';
    finishBtn.style.display = 'none';
    finishBtn.addEventListener('click', () => {
      this.finishShape();
      finishBtn.style.display = 'none';
    });
    document.getElementById('edit-panel').appendChild(finishBtn);
    this.finishBtn = finishBtn;
    
    // Audio source type
    document.getElementById('audio-source-type').addEventListener('change', (e) => {
      const type = e.target.value;
      document.getElementById('upload-source').style.display = type === 'upload' ? 'block' : 'none';
      document.getElementById('r2-source').style.display = type === 'r2' ? 'block' : 'none';
    });
    
    // Load R2 file
    document.getElementById('load-r2-file').addEventListener('click', async () => {
      await this.loadR2File();
    });
    
    // Assign audio
    document.getElementById('assign-audio').addEventListener('click', async () => {
      await this.assignAudioToShape();
    });
    
    // Volume controls
    document.getElementById('master-volume').addEventListener('input', (e) => {
      this.masterVolume = e.target.value / 100;
      document.getElementById('volume-value').textContent = e.target.value + '%';
      if (this.masterGainNode) {
        this.masterGainNode.gain.value = this.masterVolume;
      }
    });
    
    document.getElementById('fade-radius').addEventListener('input', (e) => {
      document.getElementById('fade-radius-value').textContent = e.target.value + 'px';
    });
    
    document.getElementById('fade-speed').addEventListener('input', (e) => {
      this.fadeSpeed = parseFloat(e.target.value);
      document.getElementById('fade-speed-value').textContent = e.target.value + 's';
      this.smoothness = Math.max(0.05, Math.min(0.3, this.fadeSpeed * 0.3));
    });
    
    // Export
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
      this.canvas.style.cursor = this.currentTool ? 'crosshair' : 'default';
    } else {
      btn.textContent = 'Preview Mode';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
      editPanel.style.display = 'none';
      this.canvas.style.cursor = 'default';
      this.selectTool(null);
    }
    
    document.getElementById('current-mode').textContent = 
      this.mode === 'edit' ? 'Edit' : 'Preview';
  }
  
  async togglePreview() {
    if (!this.isPlaying) {
      await this.startPreview();
    } else {
      this.stopPreview();
    }
  }
  
  async startPreview() {
    if (this.config.audioZones.length === 0) {
      alert('Add some audio zones first');
      return;
    }
    
    if (!this.audioContext) {
      await this.initAudioContext();
      await this.loadAudioBuffers();
    }
    
    this.isPlaying = true;
    document.getElementById('play-btn').textContent = 'Stop Preview';
    document.getElementById('status').classList.remove('status-hidden');
    
    // Start all audio sources
    this.audioZones.forEach((zone) => {
      this.startAudioSource(zone);
    });
    
    // Initialize target volumes
    this.targetVolumes.clear();
    this.audioZones.forEach((zone, id) => {
      this.targetVolumes.set(id, 0);
    });
    
    // Start animation loop
    this.startAnimationLoop();
    
    console.log('Preview started');
  }
  
  stopPreview() {
    this.isPlaying = false;
    document.getElementById('play-btn').textContent = 'Preview';
    
    this.stopAnimationLoop();
    
    this.audioZones.forEach((zone) => {
      if (zone.source) {
        zone.source.stop();
        zone.source = null;
      }
      zone.currentGain = 0;
      if (zone.gainNode) {
        zone.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      }
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
    }
  }
  
  async loadAudioBuffers() {
    console.log('Loading audio buffers...');
    
    for (const zone of this.config.audioZones) {
      try {
        const audioBuffer = await this.audioContext.decodeAudioData(zone.audio.data.slice(0));
        
        const panner = this.audioContext.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;
        
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0;
        
        panner.connect(gainNode);
        gainNode.connect(this.masterGainNode);
        
        // Calculate center of shape for spatial positioning
        const center = this.getShapeCenter(zone.shape);
        const pos = this.canvasToXYZ(center.x, center.y);
        panner.setPosition(pos.x, pos.y, pos.z);
        
        this.audioZones.set(zone.id, {
          ...zone,
          audioBuffer: audioBuffer,
          source: null,
          panner: panner,
          gainNode: gainNode,
          currentGain: 0
        });
        
        console.log('Loaded:', zone.id);
      } catch (error) {
        console.error('Failed to load:', zone.id, error);
      }
    }
  }
  
  getShapeCenter(shape) {
    switch (shape.type) {
      case 'rectangle':
        return {
          x: (shape.start.x + shape.end.x) / 2,
          y: (shape.start.y + shape.end.y) / 2
        };
      case 'circle':
        return shape.start;
      case 'path':
      case 'polygon':
        const sum = shape.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
        return {
          x: sum.x / shape.points.length,
          y: sum.y / shape.points.length
        };
      default:
        return { x: 0, y: 0 };
    }
  }
  
  canvasToXYZ(x, y) {
    // Convert canvas coordinates to 3D space
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    return {
      x: (x - centerX) * 0.01,
      y: (y - centerY) * 0.01,
      z: 0
    };
  }
  
  pointInShape(x, y, shape) {
    switch (shape.type) {
      case 'rectangle':
        const rx = Math.min(shape.start.x, shape.end.x);
        const ry = Math.min(shape.start.y, shape.end.y);
        const rw = Math.abs(shape.end.x - shape.start.x);
        const rh = Math.abs(shape.end.y - shape.start.y);
        return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh;
        
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(shape.end.x - shape.start.x, 2) + 
          Math.pow(shape.end.y - shape.start.y, 2)
        );
        const dist = Math.sqrt(
          Math.pow(x - shape.start.x, 2) + 
          Math.pow(y - shape.start.y, 2)
        );
        return dist <= radius;
        
      case 'polygon':
        return this.pointInPolygon(x, y, shape.points);
        
      case 'path':
        // For paths, check distance to nearest point
        return this.pointNearPath(x, y, shape.points, 50);
        
      default:
        return false;
    }
  }
  
  pointInPolygon(x, y, points) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].x, yi = points[i].y;
      const xj = points[j].x, yj = points[j].y;
      
      const intersect = ((yi > y) !== (yj > y)) && 
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }
  
  pointNearPath(x, y, points, threshold) {
    for (let i = 0; i < points.length - 1; i++) {
      const dist = this.distanceToLineSegment(
        x, y, 
        points[i].x, points[i].y,
        points[i + 1].x, points[i + 1].y
      );
      if (dist < threshold) return true;
    }
    return false;
  }
  
  distanceToLineSegment(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) param = dot / lenSq;
    
    let xx, yy;
    
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  updateListenerPosition(x, y) {
    if (!this.isPlaying) return;
    
    const pos = this.canvasToXYZ(x, y);
    
    if (this.audioContext.listener.positionX) {
      this.audioContext.listener.positionX.value = pos.x;
      this.audioContext.listener.positionY.value = pos.y;
      this.audioContext.listener.positionZ.value = pos.z;
    }
    
    let nearestDistance = Infinity;
    
    this.audioZones.forEach((zone, id) => {
      const shape = zone.shape;
      const fadeDistance = zone.audio.fadeDistance || 100;
      
      let distance = Infinity;
      let targetVolume = 0;
      
      if (this.pointInShape(x, y, shape)) {
        // Inside shape - full volume
        targetVolume = zone.audio.volume * this.masterVolume;
        distance = 0;
      } else {
        // Calculate distance to shape edge
        const center = this.getShapeCenter(shape);
        const dist = Math.sqrt(
          Math.pow(x - center.x, 2) + 
          Math.pow(y - center.y, 2)
        );
        distance = dist;
        
        if (dist < fadeDistance) {
          const normalized = dist / fadeDistance;
          const falloff = Math.pow(1 - normalized, 2);
          targetVolume = falloff * zone.audio.volume * this.masterVolume;
        }
      }
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
      
      this.targetVolumes.set(id, targetVolume);
    });
    
    if (document.getElementById('distance-display')) {
      document.getElementById('distance-display').textContent = `${Math.round(nearestDistance)}px`;
    }
  }
  
  startAnimationLoop() {
    if (this.animationFrameId) return;
    
    const updateAudio = () => {
      if (!this.isPlaying) {
        this.animationFrameId = null;
        return;
      }
      
      const currentTime = this.audioContext.currentTime;
      
      this.audioZones.forEach((zone, id) => {
        if (!zone.gainNode) return;
        
        const targetVolume = this.targetVolumes.get(id) || 0;
        const currentGain = zone.currentGain || 0;
        
        if (Math.abs(currentGain - targetVolume) < 0.001) {
          zone.currentGain = targetVolume;
          zone.gainNode.gain.setValueAtTime(targetVolume, currentTime);
          return;
        }
        
        const diff = targetVolume - currentGain;
        let newGain = currentGain + (diff * this.smoothness);
        
        if ((targetVolume > currentGain && newGain > targetVolume) || 
            (targetVolume < currentGain && newGain < targetVolume)) {
          newGain = targetVolume;
        }
        
        if (targetVolume === 0 && newGain < 0.001) {
          newGain = 0;
        }
        
        zone.currentGain = newGain;
        
        try {
          zone.gainNode.gain.setValueAtTime(newGain, currentTime);
        } catch (e) {
          console.warn('Error updating gain:', e);
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
  
  startAudioSource(zone) {
    const source = this.audioContext.createBufferSource();
    source.buffer = zone.audioBuffer;
    source.loop = zone.audio.loop;
    source.connect(zone.panner);
    source.start(0);
    zone.source = source;
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
        fadeSpeed: this.fadeSpeed
      },
      audioZones: this.config.audioZones.map(zone => ({
        id: zone.id,
        name: zone.name,
        shape: zone.shape,
        audio: {
          url: zone.audio.url,
          fileName: zone.audio.fileName,
          fadeDistance: zone.audio.fadeDistance,
          volume: zone.audio.volume,
          loop: zone.audio.loop
        },
        color: zone.color
      }))
    };
    
    const json = JSON.stringify(exportConfig, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spatial-audio-config.json';
    a.click();
    
    console.log('Config exported');
  }
}
