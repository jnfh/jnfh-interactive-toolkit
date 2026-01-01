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
    this.nextZoneId = 1;
    this.smoothPath = false; // Toggle for smooth curves vs freehand
    this.lineThickness = 2; // Default line thickness
    
    // Selection and editing
    this.selectedZoneId = null;
    this.isMoving = false;
    this.isResizing = false;
    this.moveStartPos = null;
    this.resizeHandle = null;
    this.clipboardZone = null;
    
    // Audio
    this.audioContext = null;
    this.masterGainNode = null;
    this.audioZones = new Map();
    this.isPlaying = false;
    this.masterVolume = 0.8;
    this.fadeSpeed = 0.3;
    this.smoothness = 0.15;
    // Initialize fade decay rate based on fade speed
    this.fadeDecayRate = 0.98 - (this.fadeSpeed - 0.05) * 0.13 / 0.95;
    this.fadeDecayRate = Math.max(0.85, Math.min(0.98, this.fadeDecayRate));
    
    // Animation
    this.animationFrameId = null;
    this.targetVolumes = new Map();
    
    // Mode
    this.mode = 'edit';
    this.pendingAudio = null;
    this.editingZoneId = null;
    this.multipleR2Files = [];
    this.audioFileLists = []; // Available audio file lists
    
    // Background image
    this.backgroundImage = null;
    this.imageOpacity = 0.5;
    this.showGrid = true;
    this.showImage = true;
  }
  
  async init() {
    console.log('Initializing Spatial Audio Builder...');
    
    if (!this.config.audioZones) {
      this.config.audioZones = [];
    }
    
    // Load background image from config if present
    if (this.config.backgroundImage) {
      const img = new Image();
      img.onload = () => {
        this.backgroundImage = img;
        this.redraw();
      };
      img.src = this.config.backgroundImage;
    }
    
    // Load settings from config
    if (this.config.settings) {
      if (this.config.settings.imageOpacity !== undefined) {
        this.imageOpacity = this.config.settings.imageOpacity;
      }
      if (this.config.settings.showGrid !== undefined) {
        this.showGrid = this.config.settings.showGrid;
      }
      if (this.config.settings.showImage !== undefined) {
        this.showImage = this.config.settings.showImage;
      }
    }
    
    this.initCanvas();
    this.bindControls();
    this.loadExistingZones();
    this.setupKeyboardShortcuts();
    this.updateImageControls();
    this.initializeColorPicker();
    this.loadAudioFileLists();
    
    console.log('Builder ready');
  }
  
  async loadAudioFileLists() {
    // Look for .txt files in the assets/audio-lists directory
    // These files should contain one URL per line or comma-separated URLs
    const listFiles = [
      'assets/audio-lists/notes.txt',
      'assets/audio-lists/tubemusicclips.txt',
      'assets/audio-lists/custom.txt'
    ];
    
    const availableLists = [];
    
    for (const filePath of listFiles) {
      try {
        const response = await fetch(filePath);
        if (response.ok) {
          const text = await response.text();
          const fileName = filePath.split('/').pop().replace('.txt', '');
          availableLists.push({
            name: fileName.charAt(0).toUpperCase() + fileName.slice(1),
            path: filePath,
            content: text
          });
        }
      } catch (e) {
        // File doesn't exist, skip it
        console.log(`File list not found: ${filePath}`);
      }
    }
    
    this.audioFileLists = availableLists;
    this.populateFileListDropdown(availableLists);
  }
  
  populateFileListDropdown(lists) {
    const select = document.getElementById('r2-file-list-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Select a file list --</option>';
    lists.forEach((list, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = list.name;
      select.appendChild(option);
    });
  }
  
  onFileListSelected() {
    const select = document.getElementById('r2-file-list-select');
    const fileListContainer = document.getElementById('r2-file-list-files');
    const fileSelect = document.getElementById('r2-file-from-list');
    
    if (!select || select.value === '') {
      fileListContainer.style.display = 'none';
      return;
    }
    
    const listIndex = parseInt(select.value);
    const fileList = this.audioFileLists[listIndex];
    if (!fileList) {
      fileListContainer.style.display = 'none';
      return;
    }
    
    // Parse the file content - support both line-separated and comma-separated URLs
    const urls = fileList.content
      .split(/[,\n]/)
      .map(url => url.trim())
      .filter(url => url && url.startsWith('http') && !url.startsWith('#'));
    
    if (urls.length === 0) {
      fileListContainer.style.display = 'none';
      alert('No valid URLs found in file list');
      return;
    }
    
    // Populate file dropdown
    fileSelect.innerHTML = '<option value="">-- Select a file --</option>';
    urls.forEach((url, index) => {
      const fileName = url.split('/').pop().replace(/%23/g, '#');
      const option = document.createElement('option');
      option.value = url;
      option.textContent = fileName;
      fileSelect.appendChild(option);
    });
    
    fileListContainer.style.display = 'block';
  }
  
  async loadSelectedFileFromList() {
    const fileSelect = document.getElementById('r2-file-from-list');
    if (!fileSelect || !fileSelect.value) {
      alert('Please select a file from the list');
      return;
    }
    
    const url = fileSelect.value;
    await this.loadSingleR2File(url);
  }
  
  async loadSingleR2File(url) {
    const statusDiv = document.getElementById('r2-loading-status');
    if (statusDiv) {
      statusDiv.style.display = 'block';
      statusDiv.textContent = 'Loading...';
      statusDiv.style.color = '#999';
    }
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const fileName = url.split('/').pop().replace(/%23/g, '#');
      
      this.pendingAudio = {
        data: arrayBuffer,
        url: url,
        fileName: fileName
      };
      
      if (statusDiv) {
        statusDiv.textContent = `✓ Loaded: ${fileName}`;
        statusDiv.style.color = '#4ade80';
      }
    } catch (error) {
      console.error('Error loading R2 file:', error);
      if (statusDiv) {
        statusDiv.textContent = `✗ Failed: ${error.message}`;
        statusDiv.style.color = '#ff4444';
      }
      alert('Failed to load file: ' + error.message);
    }
  }
  
  initializeColorPicker() {
    const colorInput = document.getElementById('zone-color');
    if (colorInput && !colorInput.value) {
      colorInput.value = this.getRandomColor();
    }
  }
  
  updateImageControls() {
    // Update image opacity display
    const imageOpacityInput = document.getElementById('image-opacity');
    const imageOpacityValue = document.getElementById('image-opacity-value');
    if (imageOpacityInput && imageOpacityValue) {
      imageOpacityInput.value = this.imageOpacity;
      imageOpacityValue.textContent = Math.round(this.imageOpacity * 100) + '%';
    }
    
    // Update toggle buttons
    const toggleGridBtn = document.getElementById('toggle-grid');
    if (toggleGridBtn) {
      toggleGridBtn.textContent = this.showGrid ? 'Hide Grid' : 'Show Grid';
      toggleGridBtn.classList.toggle('active', !this.showGrid);
    }
    
    const toggleImageBtn = document.getElementById('toggle-image');
    if (toggleImageBtn) {
      toggleImageBtn.textContent = this.showImage ? 'Hide Image' : 'Show Image';
      toggleImageBtn.classList.toggle('active', !this.showImage);
    }
  }
  
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      // Escape to cancel edit or clear current shape
      if (e.key === 'Escape') {
        if (this.editingZoneId) {
          this.cancelEdit();
        } else if (this.currentShape) {
          this.currentShape = null;
          this.redraw();
        }
      }
      
      // Delete key to delete selected zone
      if (e.key === 'Delete') {
        if (this.selectedZoneId) {
          const zone = this.config.audioZones.find(z => z.id === this.selectedZoneId);
          if (zone && confirm(`Delete zone "${zone.name}"?`)) {
            this.deleteZone(this.selectedZoneId);
            this.selectedZoneId = null;
          }
        } else if (this.editingZoneId) {
          const zone = this.config.audioZones.find(z => z.id === this.editingZoneId);
          if (zone && confirm(`Delete zone "${zone.name}"?`)) {
            this.deleteZone(this.editingZoneId);
          }
        }
      }
      
      // Copy/Paste shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c':
            e.preventDefault();
            if (this.selectedZoneId) {
              this.copyZone(this.selectedZoneId);
            }
            break;
          case 'v':
            e.preventDefault();
            if (this.clipboardZone) {
              this.pasteZone();
            }
            break;
          case 'e':
            e.preventDefault();
            document.getElementById('export-config')?.click();
            break;
          case 'i':
            e.preventDefault();
            document.getElementById('import-config')?.click();
            break;
        }
      }
    });
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
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
    
    window.addEventListener('resize', () => {
      const oldWidth = this.canvas.width;
      const oldHeight = this.canvas.height;
      this.canvas.width = container.clientWidth;
      this.canvas.height = container.clientHeight;
      
      // Scale shapes proportionally if canvas size changed significantly
      const scaleX = this.canvas.width / oldWidth;
      const scaleY = this.canvas.height / oldHeight;
      
      // Only scale if change is significant (not just small adjustments)
      if (Math.abs(scaleX - 1) > 0.1 || Math.abs(scaleY - 1) > 0.1) {
        this.config.audioZones.forEach(zone => {
          this.scaleShape(zone.shape, scaleX, scaleY);
        });
        if (this.currentShape) {
          this.scaleShape(this.currentShape, scaleX, scaleY);
        }
      }
      
      this.redraw();
    });
  }
  
  scaleShape(shape, scaleX, scaleY) {
    switch (shape.type) {
      case 'rectangle':
      case 'circle':
        shape.start.x *= scaleX;
        shape.start.y *= scaleY;
        shape.end.x *= scaleX;
        shape.end.y *= scaleY;
        break;
      case 'path':
      case 'polygon':
        shape.points.forEach(point => {
          point.x *= scaleX;
          point.y *= scaleY;
        });
        break;
    }
  }
  
  drawGrid() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background image if available
    if (this.backgroundImage && this.showImage) {
      ctx.save();
      ctx.globalAlpha = this.imageOpacity;
      ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
    }
    
    // Draw grid if enabled
    if (this.showGrid) {
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
      
      // Coordinate labels
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
  }
  
  redraw() {
    this.drawGrid();
    this.config.audioZones.forEach(zone => {
      const isSelected = zone.id === this.selectedZoneId;
      this.drawShape(zone.shape, zone.color, zone.name, isSelected);
    });
    if (this.currentShape) {
      this.drawShape(this.currentShape);
    }
  }
  
  drawShape(shape, color = null, name = null, isSelected = false) {
    const ctx = this.ctx;
    ctx.save();
    
    const shapeColor = color || shape.color || '#667eea';
    const fillColor = shape.fillColor || this.hexToRgba(shapeColor, 0.2);
    
    ctx.strokeStyle = shapeColor;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = shape.lineWidth || this.lineThickness || 2;
    
    // Highlight selected shape
    if (isSelected) {
      ctx.strokeStyle = '#ffff00';
      ctx.lineWidth = (shape.lineWidth || this.lineThickness || 2) + 2;
    }
    
    let centerX = 0, centerY = 0;
    
    switch (shape.type) {
      case 'rectangle':
        const rx = Math.min(shape.start.x, shape.end.x);
        const ry = Math.min(shape.start.y, shape.end.y);
        const rw = Math.abs(shape.end.x - shape.start.x);
        const rh = Math.abs(shape.end.y - shape.start.y);
        centerX = rx + rw / 2;
        centerY = ry + rh / 2;
        ctx.fillRect(rx, ry, rw, rh);
        ctx.strokeRect(rx, ry, rw, rh);
        break;
        
      case 'circle':
        const radius = Math.sqrt(
          Math.pow(shape.end.x - shape.start.x, 2) + 
          Math.pow(shape.end.y - shape.start.y, 2)
        );
        centerX = shape.start.x;
        centerY = shape.start.y;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
        
      case 'path':
        if (shape.points.length >= 2) {
          ctx.beginPath();
          ctx.moveTo(shape.points[0].x, shape.points[0].y);
          
          if (shape.smooth && shape.points.length >= 3) {
            // Draw smooth curves using quadratic bezier curves
            // Use Catmull-Rom spline approximation for smoother curves
            for (let i = 0; i < shape.points.length - 1; i++) {
              const p0 = i > 0 ? shape.points[i - 1] : shape.points[i];
              const p1 = shape.points[i];
              const p2 = shape.points[i + 1];
              const p3 = i < shape.points.length - 2 ? shape.points[i + 2] : shape.points[i + 1];
              
              // Calculate control points for smooth curve
              const cp1x = p1.x + (p2.x - p0.x) / 6;
              const cp1y = p1.y + (p2.y - p0.y) / 6;
              const cp2x = p2.x - (p3.x - p1.x) / 6;
              const cp2y = p2.y - (p3.y - p1.y) / 6;
              
              if (i === 0) {
                ctx.moveTo(p1.x, p1.y);
              }
              ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
            }
          } else {
            // Draw straight lines (freehand)
            for (let i = 1; i < shape.points.length; i++) {
              ctx.lineTo(shape.points[i].x, shape.points[i].y);
            }
          }
          
          ctx.stroke();
          // Calculate center for path
          const pathSum = shape.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
          centerX = pathSum.x / shape.points.length;
          centerY = pathSum.y / shape.points.length;
        }
        break;
        
      case 'polygon':
        if (shape.points.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(shape.points[0].x, shape.points[0].y);
          
          if (shape.smooth && shape.points.length >= 3) {
            // Draw smooth curves for polygon using quadratic curves
            for (let i = 1; i < shape.points.length; i++) {
              const prev = shape.points[i - 1];
              const current = shape.points[i];
              const next = shape.points[(i + 1) % shape.points.length];
              
              const cp1x = (prev.x + current.x) / 2;
              const cp1y = (prev.y + current.y) / 2;
              const cp2x = (current.x + next.x) / 2;
              const cp2y = (current.y + next.y) / 2;
              
              ctx.quadraticCurveTo(current.x, current.y, cp2x, cp2y);
            }
            ctx.closePath();
          } else {
            // Draw straight lines
            for (let i = 1; i < shape.points.length; i++) {
              ctx.lineTo(shape.points[i].x, shape.points[i].y);
            }
            ctx.closePath();
          }
          
          ctx.fill();
          ctx.stroke();
          // Calculate center for polygon
          const polySum = shape.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
          centerX = polySum.x / shape.points.length;
          centerY = polySum.y / shape.points.length;
        }
        break;
    }
    
    // Draw zone name label if provided
    if (name && (shape.type === 'rectangle' || shape.type === 'circle' || shape.type === 'polygon')) {
      ctx.fillStyle = shapeColor;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Draw text with outline for visibility
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(name, centerX, centerY);
      ctx.fillText(name, centerX, centerY);
    }
    
    // Draw resize handles for selected shapes
    if (isSelected && (shape.type === 'rectangle' || shape.type === 'circle')) {
      this.drawResizeHandles(shape);
    }
    
    ctx.restore();
  }
  
  drawResizeHandles(shape) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#ffff00';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    
    const handleSize = 8;
    const handles = this.getResizeHandlePositions(shape);
    
    handles.forEach(handle => {
      ctx.beginPath();
      ctx.arc(handle.x, handle.y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
    
    ctx.restore();
  }
  
  getResizeHandlePositions(shape) {
    const handles = [];
    
    if (shape.type === 'rectangle') {
      const rx = Math.min(shape.start.x, shape.end.x);
      const ry = Math.min(shape.start.y, shape.end.y);
      const rw = Math.abs(shape.end.x - shape.start.x);
      const rh = Math.abs(shape.end.y - shape.start.y);
      
      // Corner handles
      handles.push({ x: rx, y: ry, type: 'nw' });
      handles.push({ x: rx + rw, y: ry, type: 'ne' });
      handles.push({ x: rx, y: ry + rh, type: 'sw' });
      handles.push({ x: rx + rw, y: ry + rh, type: 'se' });
    } else if (shape.type === 'circle') {
      const radius = Math.sqrt(
        Math.pow(shape.end.x - shape.start.x, 2) + 
        Math.pow(shape.end.y - shape.start.y, 2)
      );
      
      // Handle at the end point (resize radius)
      handles.push({ x: shape.end.x, y: shape.end.y, type: 'radius' });
    }
    
    return handles;
  }
  
  getResizeHandle(pos) {
    if (!this.selectedZoneId) return null;
    
    const zone = this.config.audioZones.find(z => z.id === this.selectedZoneId);
    if (!zone) return null;
    
    const handles = this.getResizeHandlePositions(zone.shape);
    const handleSize = 8;
    
    for (const handle of handles) {
      const dist = Math.sqrt(
        Math.pow(pos.x - handle.x, 2) + 
        Math.pow(pos.y - handle.y, 2)
      );
      if (dist < handleSize) {
        return handle.type;
      }
    }
    
    return null;
  }
  
  moveZone(zoneId, deltaX, deltaY) {
    const zone = this.config.audioZones.find(z => z.id === zoneId);
    if (!zone) return;
    
    const shape = zone.shape;
    
    switch (shape.type) {
      case 'rectangle':
      case 'circle':
        shape.start.x += deltaX;
        shape.start.y += deltaY;
        shape.end.x += deltaX;
        shape.end.y += deltaY;
        break;
      case 'path':
      case 'polygon':
        shape.points.forEach(point => {
          point.x += deltaX;
          point.y += deltaY;
        });
        break;
    }
    
    this.redraw();
  }
  
  resizeZone(zoneId, handleType, deltaX, deltaY) {
    const zone = this.config.audioZones.find(z => z.id === zoneId);
    if (!zone) return;
    
    const shape = zone.shape;
    
    if (shape.type === 'rectangle') {
      const rx = Math.min(shape.start.x, shape.end.x);
      const ry = Math.min(shape.start.y, shape.end.y);
      const rw = Math.abs(shape.end.x - shape.start.x);
      const rh = Math.abs(shape.end.y - shape.start.y);
      
      switch (handleType) {
        case 'nw':
          shape.start.x += deltaX;
          shape.start.y += deltaY;
          break;
        case 'ne':
          shape.end.x += deltaX;
          shape.start.y += deltaY;
          break;
        case 'sw':
          shape.start.x += deltaX;
          shape.end.y += deltaY;
          break;
        case 'se':
          shape.end.x += deltaX;
          shape.end.y += deltaY;
          break;
      }
    } else if (shape.type === 'circle') {
      if (handleType === 'radius') {
        shape.end.x += deltaX;
        shape.end.y += deltaY;
      }
    }
    
    this.redraw();
  }
  
  copyZone(zoneId) {
    const zone = this.config.audioZones.find(z => z.id === zoneId);
    if (!zone) return;
    
    // Deep clone the zone
    this.clipboardZone = JSON.parse(JSON.stringify(zone));
    this.clipboardZone.id = `zone-${this.nextZoneId++}`;
    
    // Offset the copied zone slightly
    const offset = 50;
    const shape = this.clipboardZone.shape;
    
    switch (shape.type) {
      case 'rectangle':
      case 'circle':
        shape.start.x += offset;
        shape.start.y += offset;
        shape.end.x += offset;
        shape.end.y += offset;
        break;
      case 'path':
      case 'polygon':
        shape.points.forEach(point => {
          point.x += offset;
          point.y += offset;
        });
        break;
    }
    
    // Generate new color
    this.clipboardZone.color = this.getRandomColor();
    this.clipboardZone.shape.color = this.clipboardZone.color;
    this.clipboardZone.shape.fillColor = this.hexToRgba(this.clipboardZone.color, 0.2);
    
    // Update name
    this.clipboardZone.name = zone.name + ' (Copy)';
  }
  
  pasteZone() {
    if (!this.clipboardZone) return;
    
    this.config.audioZones.push(this.clipboardZone);
    this.selectedZoneId = this.clipboardZone.id;
    this.updateZonesList();
    this.redraw();
    
    // Prepare for next paste (offset again)
    const offset = 50;
    const shape = this.clipboardZone.shape;
    
    switch (shape.type) {
      case 'rectangle':
      case 'circle':
        shape.start.x += offset;
        shape.start.y += offset;
        shape.end.x += offset;
        shape.end.y += offset;
        break;
      case 'path':
      case 'polygon':
        shape.points.forEach(point => {
          point.x += offset;
          point.y += offset;
        });
        break;
    }
    
    this.clipboardZone.id = `zone-${this.nextZoneId++}`;
  }
  
  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }
  
  handleMouseDown(e) {
    if (this.mode !== 'edit') return;
    
    const pos = this.getMousePos(e);
    
    // Check if clicking on a resize handle
    if (this.selectedZoneId) {
      const handle = this.getResizeHandle(pos);
      if (handle) {
        this.isResizing = true;
        this.resizeHandle = handle;
        this.moveStartPos = pos;
        return;
      }
      
      // Check if clicking on the selected zone to move it
      const selectedZone = this.config.audioZones.find(z => z.id === this.selectedZoneId);
      if (selectedZone && this.pointInShape(pos.x, pos.y, selectedZone.shape)) {
        this.isMoving = true;
        this.moveStartPos = pos;
        return;
      }
    }
    
    // Check if clicking on any zone to select it, or deselect if clicking empty space
    if (!this.currentTool) {
      const clickedZone = this.config.audioZones.find(zone => 
        this.pointInShape(pos.x, pos.y, zone.shape)
      );
      if (clickedZone) {
        this.selectedZoneId = clickedZone.id;
        this.updateZonesList();
        this.updateCopyPasteButtons();
        this.redraw();
        return;
      } else {
        // Deselect when clicking empty space
        this.selectedZoneId = null;
        this.updateZonesList();
        this.updateCopyPasteButtons();
        this.redraw();
        return;
      }
    }
    
    if (!this.currentTool) return;
    
    this.isDrawing = true;
    
    if (this.currentTool === 'rectangle' || this.currentTool === 'circle') {
      this.currentShape = {
        type: this.currentTool,
        start: pos,
        end: pos,
        color: '#667eea',
        fillColor: 'rgba(102, 126, 234, 0.2)',
        lineWidth: this.lineThickness
      };
    } else if (this.currentTool === 'path') {
      this.currentShape = {
        type: 'path',
        points: [pos],
        color: '#667eea',
        fillColor: 'rgba(102, 126, 234, 0.2)',
        smooth: this.smoothPath,
        lineWidth: this.lineThickness
      };
    } else if (this.currentTool === 'polygon') {
      if (!this.currentShape) {
        this.currentShape = {
          type: 'polygon',
          points: [pos],
          color: '#667eea',
          fillColor: 'rgba(102, 126, 234, 0.2)',
          lineWidth: this.lineThickness
        };
      } else {
        this.currentShape.points.push(pos);
      }
      this.redraw();
    }
  }
  
  handleMouseMove(e) {
    const pos = this.getMousePos(e);
    
    if (this.mode === 'preview' && this.isPlaying) {
      this.updateListenerPosition(pos.x, pos.y);
      return;
    }
    
    // Handle moving selected zone
    if (this.isMoving && this.selectedZoneId) {
      const deltaX = pos.x - this.moveStartPos.x;
      const deltaY = pos.y - this.moveStartPos.y;
      this.moveZone(this.selectedZoneId, deltaX, deltaY);
      this.moveStartPos = pos;
      return;
    }
    
    // Handle resizing selected zone
    if (this.isResizing && this.selectedZoneId) {
      const deltaX = pos.x - this.moveStartPos.x;
      const deltaY = pos.y - this.moveStartPos.y;
      this.resizeZone(this.selectedZoneId, this.resizeHandle, deltaX, deltaY);
      this.moveStartPos = pos;
      return;
    }
    
    // Check if hovering over a zone in edit mode
    if (this.mode === 'edit' && !this.isDrawing && !this.currentTool && !this.isMoving && !this.isResizing) {
      const hoveredZone = this.config.audioZones.find(zone => 
        this.pointInShape(pos.x, pos.y, zone.shape)
      );
      if (hoveredZone) {
        this.canvas.style.cursor = 'move';
      } else if (this.selectedZoneId && this.getResizeHandle(pos)) {
        this.canvas.style.cursor = 'nwse-resize';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }
    
    if (!this.isDrawing || !this.currentShape) return;
    
    if (this.currentTool === 'rectangle' || this.currentTool === 'circle') {
      this.currentShape.end = pos;
      this.redraw();
    } else if (this.currentTool === 'path') {
      // For smooth paths, only add points at intervals to avoid too many points
      // For freehand, add every point
      if (this.smoothPath) {
        const lastPoint = this.currentShape.points[this.currentShape.points.length - 1];
        const distance = Math.sqrt(
          Math.pow(pos.x - lastPoint.x, 2) + 
          Math.pow(pos.y - lastPoint.y, 2)
        );
        // Only add point if moved at least 5 pixels (smoother curves)
        if (distance > 5) {
          this.currentShape.points.push(pos);
          this.redraw();
        }
      } else {
        this.currentShape.points.push(pos);
        this.redraw();
      }
    }
  }
  
  handleMouseUp(e) {
    if (this.isMoving) {
      this.isMoving = false;
      return;
    }
    
    if (this.isResizing) {
      this.isResizing = false;
      this.resizeHandle = null;
      return;
    }
    
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    
    // For rectangle and circle, shape is complete on mouse up
    if (this.currentTool === 'rectangle' || this.currentTool === 'circle') {
      this.finishCurrentShape();
    }
    // Path finishes when mouse is released
    else if (this.currentTool === 'path') {
      if (this.currentShape.points.length >= 2) {
        this.finishCurrentShape();
      } else {
        this.currentShape = null;
        this.redraw();
      }
    }
    // Polygon continues adding points on click, finishes on double-click
  }
  
  handleDoubleClick(e) {
    if (this.mode !== 'edit' || this.currentTool !== 'polygon') return;
    
    if (this.currentShape && this.currentShape.points.length >= 3) {
      this.finishCurrentShape();
    }
  }
  
  finishCurrentShape() {
    if (!this.currentShape) return;
    
    // Validate shape
    if ((this.currentShape.type === 'path' && this.currentShape.points.length < 2) ||
        (this.currentShape.type === 'polygon' && this.currentShape.points.length < 3)) {
      this.currentShape = null;
      this.redraw();
      return;
    }
    
    // Shape is ready - keep it in currentShape until audio is assigned
    // Don't add to shapes array yet - wait for audio assignment
    this.redraw();
  }
  
  async loadR2File() {
    const r2UrlInput = document.getElementById('r2-url').value.trim();
    const statusDiv = document.getElementById('r2-loading-status');
    
    if (!r2UrlInput) {
      alert('Please enter an R2 URL or comma-separated URLs');
      return;
    }
    
    // Check if multiple URLs (comma-separated)
    const urls = r2UrlInput.split(',').map(url => url.trim()).filter(url => url);
    
    if (urls.length > 1) {
      // Bulk load multiple files
      await this.loadMultipleR2Files(urls);
    } else {
      // Single file load
      await this.loadSingleR2File(urls[0]);
    }
  }
  
  async loadMultipleR2Files(urls) {
    const loadedFiles = [];
    const failedFiles = [];
    
    // Show loading indicator
    const originalButton = document.getElementById('load-r2-file');
    const originalText = originalButton.textContent;
    originalButton.textContent = 'Loading...';
    originalButton.disabled = true;
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        loadedFiles.push({
          data: arrayBuffer,
          url: url,
          fileName: url.split('/').pop()
        });
        
        // Update progress
        originalButton.textContent = `Loading ${i + 1}/${urls.length}...`;
      } catch (error) {
        console.error(`Error loading ${url}:`, error);
        failedFiles.push({ url, error: error.message });
      }
    }
    
    // Restore button
    originalButton.textContent = originalText;
    originalButton.disabled = false;
    
    // Store all loaded files - use the first one as pending, store rest for selection
    if (loadedFiles.length > 0) {
      this.pendingAudio = loadedFiles[0];
      this.multipleR2Files = loadedFiles;
      
      // If multiple files loaded, show selection dropdown
      if (loadedFiles.length > 1) {
        this.showR2FileSelector(loadedFiles);
      } else if (loadedFiles.length === 1) {
        this.pendingAudio = loadedFiles[0];
        const statusDiv = document.getElementById('r2-loading-status');
        if (statusDiv) {
          statusDiv.style.display = 'block';
          statusDiv.textContent = `✓ Loaded: ${loadedFiles[0].fileName}`;
          statusDiv.style.color = '#4ade80';
        }
      }
    }
    
    if (failedFiles.length > 0) {
      const statusDiv = document.getElementById('r2-loading-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.textContent = `⚠ Loaded ${loadedFiles.length}, ${failedFiles.length} failed`;
        statusDiv.style.color = '#ffa500';
      }
    }
  }
  
  showR2FileSelector(files) {
    // Create or update file selector dropdown
    let selector = document.getElementById('r2-file-selector');
    if (!selector) {
      selector = document.createElement('div');
      selector.id = 'r2-file-selector';
      selector.style.cssText = 'margin-top: 12px; padding: 12px; background: #2a2a2a; border-radius: 6px; border: 1px solid #444;';
      document.getElementById('r2-source').appendChild(selector);
    }
    
    selector.innerHTML = `
      <label style="display: block; margin-bottom: 8px; font-size: 12px; color: #999;">
        ${files.length} files loaded. Select one:
      </label>
      <select id="r2-file-select-dropdown" style="width: 100%; padding: 10px; background: #1a1a1a; border: 1px solid #444; border-radius: 6px; color: #e0e0e0; font-size: 13px; margin-bottom: 8px;">
        ${files.map((file, index) => `<option value="${index}">${file.fileName}</option>`).join('')}
      </select>
      <button id="select-r2-file" class="btn-secondary" style="width: 100%;">Use Selected File</button>
    `;
    
    document.getElementById('select-r2-file').addEventListener('click', () => {
      const dropdown = document.getElementById('r2-file-select-dropdown');
      const selectedIndex = parseInt(dropdown.value);
      this.pendingAudio = files[selectedIndex];
      const statusDiv = document.getElementById('r2-loading-status');
      if (statusDiv) {
        statusDiv.style.display = 'block';
        statusDiv.textContent = `✓ Selected: ${files[selectedIndex].fileName}`;
        statusDiv.style.color = '#4ade80';
      }
      selector.remove();
    });
  }
  
  async assignAudioToShape() {
    const name = document.getElementById('source-name').value.trim();
    if (!name) {
      alert('Please enter a shape name');
      return;
    }
    
    // If editing, update existing zone
    if (this.editingZoneId) {
      await this.updateZone(this.editingZoneId);
      return;
    }
    
    // Otherwise, assign to new shape
    if (!this.currentShape) {
      alert('Please draw a shape first');
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
    
    // Get color from color picker or use random
    const colorInput = document.getElementById('zone-color');
    const color = colorInput ? colorInput.value : this.getRandomColor();
    
    // Create zone with the current shape
    const zoneId = `zone-${this.nextZoneId++}`;
    
    // Update shape with assigned color and ensure lineWidth is set
    this.currentShape.color = color;
    this.currentShape.fillColor = this.hexToRgba(color, 0.2);
    if (!this.currentShape.lineWidth) {
      this.currentShape.lineWidth = this.lineThickness;
    }
    
    const zone = {
      id: zoneId,
      name: name,
      shape: this.currentShape,
      audio: {
        data: audioData,
        url: audioUrl,
        fileName: fileName,
        fadeDistance: fadeDistance,
        volume: 0.8,
        loop: true
      },
      color: color
    };
    
    this.config.audioZones.push(zone);
    
    // Clear current shape and reset form
    this.currentShape = null;
    this.selectedZoneId = zoneId; // Select the newly created zone
    this.resetForm();
    
    this.redraw();
    this.updateZonesList();
    this.updateCopyPasteButtons();
    
    console.log('Zone created:', zoneId);
  }
  
  async updateZone(zoneId) {
    const zone = this.config.audioZones.find(z => z.id === zoneId);
    if (!zone) return;
    
    const name = document.getElementById('source-name').value.trim();
    if (!name) {
      alert('Please enter a shape name');
      return;
    }
    
    const sourceType = document.getElementById('audio-source-type').value;
    let audioData = zone.audio.data; // Keep existing data by default
    let audioUrl = zone.audio.url;
    let fileName = zone.audio.fileName;
    
    // Only update audio if changed
    if (sourceType === 'upload') {
      const fileInput = document.getElementById('audio-file');
      if (fileInput.files[0]) {
        const file = fileInput.files[0];
        audioData = await file.arrayBuffer();
        fileName = file.name;
        audioUrl = null; // Clear R2 URL if uploading new file
      }
    } else if (sourceType === 'r2') {
      if (this.pendingAudio && this.pendingAudio.url !== zone.audio.url) {
        audioData = this.pendingAudio.data;
        audioUrl = this.pendingAudio.url;
        fileName = this.pendingAudio.fileName;
      }
    }
    
    const fadeDistance = parseInt(document.getElementById('fade-distance').value) || 100;
    
    // Get color from color picker
    const colorInput = document.getElementById('zone-color');
    if (colorInput) {
      zone.color = colorInput.value;
      zone.shape.color = colorInput.value;
      zone.shape.fillColor = this.hexToRgba(colorInput.value, 0.2);
    }
    
    // Update line thickness
    zone.shape.lineWidth = this.lineThickness;
    
    // Update smooth setting if it's a path
    if (zone.shape.type === 'path') {
      zone.shape.smooth = this.smoothPath;
    }
    
    // Update zone
    zone.name = name;
    zone.audio.data = audioData;
    zone.audio.url = audioUrl;
    zone.audio.fileName = fileName;
    zone.audio.fadeDistance = fadeDistance;
    
    // If audio changed, need to reload it
    if (this.audioZones.has(zoneId)) {
      // Remove from audio zones map so it gets reloaded
      const oldZone = this.audioZones.get(zoneId);
      if (oldZone.source) {
        oldZone.source.stop();
      }
      this.audioZones.delete(zoneId);
    }
    
    // Reset form and exit edit mode
    this.cancelEdit();
    
    this.redraw();
    this.updateZonesList();
    
    console.log('Zone updated:', zoneId);
  }
  
  resetForm() {
    document.getElementById('source-name').value = '';
    document.getElementById('audio-file').value = '';
    document.getElementById('r2-url').value = '';
    document.getElementById('fade-distance').value = '100';
    document.getElementById('audio-source-type').value = 'upload';
    document.getElementById('upload-source').style.display = 'block';
    document.getElementById('r2-source').style.display = 'none';
    const colorInput = document.getElementById('zone-color');
    if (colorInput) {
      colorInput.value = this.getRandomColor();
    }
    this.pendingAudio = null;
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
        item.style.cssText = 'padding: 10px; margin-bottom: 8px; background: #2a2a2a; border-radius: 6px; font-size: 12px; cursor: pointer; transition: all 0.2s; display: flex; justify-content: space-between; align-items: center;';
        if (this.editingZoneId === zone.id) {
          item.style.background = '#3a3a3a';
          item.style.border = '2px solid #667eea';
        } else if (this.selectedZoneId === zone.id) {
          item.style.background = '#3a3a3a';
          item.style.border = '2px solid #ffff00';
        }
        
        const content = document.createElement('div');
        content.style.flex = '1';
        content.innerHTML = `
          <div style="color: ${zone.color}; font-weight: 600; margin-bottom: 4px;">${zone.name}</div>
          <div style="color: #999; font-size: 11px;">Fade: ${zone.audio.fadeDistance}px</div>
        `;
        
        const colorBtn = document.createElement('input');
        colorBtn.type = 'color';
        colorBtn.value = zone.color || '#667eea';
        colorBtn.style.cssText = 'width: 32px; height: 32px; border: 2px solid #444; border-radius: 4px; cursor: pointer; padding: 0; background: none; flex-shrink: 0; margin-left: 8px;';
        colorBtn.addEventListener('change', (e) => {
          zone.color = e.target.value;
          zone.shape.color = e.target.value;
          zone.shape.fillColor = this.hexToRgba(e.target.value, 0.2);
          this.redraw();
          this.updateZonesList();
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '×';
        deleteBtn.style.cssText = 'background: #ff4444; border: none; color: white; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 18px; line-height: 1; padding: 0; flex-shrink: 0; margin-left: 8px; transition: background 0.2s;';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Delete zone "${zone.name}"?`)) {
            this.deleteZone(zone.id);
          }
        });
        deleteBtn.addEventListener('mouseenter', () => {
          deleteBtn.style.background = '#ff6666';
        });
        deleteBtn.addEventListener('mouseleave', () => {
          deleteBtn.style.background = '#ff4444';
        });
        
        item.appendChild(content);
        item.appendChild(colorBtn);
        item.appendChild(deleteBtn);
        
        item.addEventListener('click', () => {
          this.selectedZoneId = zone.id;
          this.updateZonesList();
          this.updateCopyPasteButtons();
          this.redraw();
        });
        item.addEventListener('dblclick', () => {
          this.editZone(zone.id);
        });
        item.addEventListener('mouseenter', () => {
          if (this.editingZoneId !== zone.id && this.selectedZoneId !== zone.id) {
            item.style.background = '#333';
          }
        });
        item.addEventListener('mouseleave', () => {
          if (this.editingZoneId !== zone.id && this.selectedZoneId !== zone.id) {
            item.style.background = '#2a2a2a';
          }
        });
        container.appendChild(item);
      });
    }
  }
  
  deleteZone(zoneId) {
    // Remove from config
    const index = this.config.audioZones.findIndex(z => z.id === zoneId);
    if (index !== -1) {
      this.config.audioZones.splice(index, 1);
    }
    
    // Stop and remove audio if playing
    if (this.audioZones.has(zoneId)) {
      const zone = this.audioZones.get(zoneId);
      if (zone.source) {
        zone.source.stop();
      }
      this.audioZones.delete(zoneId);
      this.targetVolumes.delete(zoneId);
    }
    
    // Clear edit mode if deleting the zone being edited
    if (this.editingZoneId === zoneId) {
      this.cancelEdit();
    }
    
    // Clear selection if deleting selected zone
    if (this.selectedZoneId === zoneId) {
      this.selectedZoneId = null;
    }
    
    this.redraw();
    this.updateZonesList();
  }
  
  editZone(zoneId) {
    const zone = this.config.audioZones.find(z => z.id === zoneId);
    if (!zone) return;
    
    this.editingZoneId = zoneId;
    
    // Populate form with zone data
    document.getElementById('source-name').value = zone.name;
    document.getElementById('fade-distance').value = zone.audio.fadeDistance || 100;
    const colorInput = document.getElementById('zone-color');
    if (colorInput) {
      colorInput.value = zone.color || this.getRandomColor();
    }
    
    // Update line thickness if shape has it
    if (zone.shape.lineWidth) {
      this.lineThickness = zone.shape.lineWidth;
      const lineThicknessInput = document.getElementById('line-thickness');
      const lineThicknessValue = document.getElementById('line-thickness-value');
      if (lineThicknessInput) {
        lineThicknessInput.value = this.lineThickness;
      }
      if (lineThicknessValue) {
        lineThicknessValue.textContent = this.lineThickness + 'px';
      }
    }
    
    // Update smooth path checkbox if it's a path
    if (zone.shape.type === 'path') {
      this.smoothPath = zone.shape.smooth || false;
      const smoothPathCheckbox = document.getElementById('smooth-path');
      if (smoothPathCheckbox) {
        smoothPathCheckbox.checked = this.smoothPath;
      }
    }
    
    // Set audio source type based on whether it has a URL
    if (zone.audio.url) {
      document.getElementById('audio-source-type').value = 'r2';
      document.getElementById('r2-url').value = zone.audio.url;
      document.getElementById('upload-source').style.display = 'none';
      document.getElementById('r2-source').style.display = 'block';
      this.pendingAudio = {
        data: zone.audio.data,
        url: zone.audio.url,
        fileName: zone.audio.fileName
      };
    } else {
      document.getElementById('audio-source-type').value = 'upload';
      document.getElementById('upload-source').style.display = 'block';
      document.getElementById('r2-source').style.display = 'none';
      document.getElementById('r2-url').value = '';
    }
    
    // Update form title and button
    document.getElementById('audio-form-title').textContent = 'Edit Audio Zone';
    document.getElementById('assign-audio').textContent = 'Save Changes';
    document.getElementById('cancel-edit').style.display = 'block';
    
    this.updateZonesList();
  }
  
  cancelEdit() {
    this.editingZoneId = null;
    this.resetForm();
    document.getElementById('audio-form-title').textContent = 'Assign Audio to Shape';
    document.getElementById('assign-audio').textContent = 'Assign Audio';
    document.getElementById('cancel-edit').style.display = 'none';
    this.updateZonesList();
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
    const selectToolBtn = document.getElementById('tool-select');
    if (selectToolBtn) {
      selectToolBtn.addEventListener('click', () => {
        this.selectTool(null); // null = select mode
      });
    }
    
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
    
    // Smooth path toggle
    const smoothPathCheckbox = document.getElementById('smooth-path');
    if (smoothPathCheckbox) {
      smoothPathCheckbox.addEventListener('change', (e) => {
        this.smoothPath = e.target.checked;
        // Update current shape if it's a path
        if (this.currentShape && this.currentShape.type === 'path') {
          this.currentShape.smooth = this.smoothPath;
        }
      });
    }
    
    // Line thickness control
    const lineThicknessInput = document.getElementById('line-thickness');
    const lineThicknessValue = document.getElementById('line-thickness-value');
    if (lineThicknessInput && lineThicknessValue) {
      lineThicknessInput.addEventListener('input', (e) => {
        this.lineThickness = parseInt(e.target.value);
        lineThicknessValue.textContent = this.lineThickness + 'px';
        // Update current shape if drawing
        if (this.currentShape) {
          this.currentShape.lineWidth = this.lineThickness;
          this.redraw();
        }
      });
    }
    
    // Audio source type
    document.getElementById('audio-source-type').addEventListener('change', (e) => {
      const type = e.target.value;
      document.getElementById('upload-source').style.display = type === 'upload' ? 'block' : 'none';
      document.getElementById('r2-source').style.display = type === 'r2' ? 'block' : 'none';
      
      // Reset R2 file list selection when switching
      if (type !== 'r2') {
        document.getElementById('r2-file-list-files').style.display = 'none';
        document.getElementById('r2-loading-status').style.display = 'none';
        const fileListSelect = document.getElementById('r2-file-list-select');
        if (fileListSelect) fileListSelect.value = '';
      }
    });
    
    // File list selection
    const fileListSelect = document.getElementById('r2-file-list-select');
    if (fileListSelect) {
      fileListSelect.addEventListener('change', () => {
        this.onFileListSelected();
      });
    }
    
    // Load selected file from list
    const loadSelectedFileBtn = document.getElementById('load-selected-file');
    if (loadSelectedFileBtn) {
      loadSelectedFileBtn.addEventListener('click', async () => {
        await this.loadSelectedFileFromList();
      });
    }
    
    // Load R2 file (manual URLs)
    document.getElementById('load-r2-file').addEventListener('click', async () => {
      await this.loadR2File();
    });
    
    // Assign audio
    document.getElementById('assign-audio').addEventListener('click', async () => {
      await this.assignAudioToShape();
    });
    
    // Cancel edit
    document.getElementById('cancel-edit').addEventListener('click', () => {
      this.cancelEdit();
    });
    
    // Volume controls
    document.getElementById('master-volume').addEventListener('input', (e) => {
      this.masterVolume = e.target.value / 100;
      document.getElementById('volume-value').textContent = e.target.value + '%';
      if (this.masterGainNode) {
        this.masterGainNode.gain.value = this.masterVolume;
      }
    });
    
    document.getElementById('fade-speed').addEventListener('input', (e) => {
      this.fadeSpeed = parseFloat(e.target.value);
      document.getElementById('fade-speed-value').textContent = e.target.value + 's';
      // Adjust decay rate based on fade speed (faster fade = lower decay rate)
      // Map fade speed (0.05-1) to decay rate (0.85-0.98)
      this.fadeDecayRate = 0.98 - (this.fadeSpeed - 0.05) * 0.13 / 0.95;
      this.fadeDecayRate = Math.max(0.85, Math.min(0.98, this.fadeDecayRate));
    });
    
    // Export
    document.getElementById('export-config').addEventListener('click', () => {
      this.exportConfig();
    });
    
    // Background image upload
    const imageInput = document.getElementById('background-image');
    if (imageInput) {
      imageInput.addEventListener('change', (e) => {
        this.loadBackgroundImage(e.target.files[0]);
      });
    }
    
    // Image opacity control
    const imageOpacityInput = document.getElementById('image-opacity');
    if (imageOpacityInput) {
      imageOpacityInput.addEventListener('input', (e) => {
        this.imageOpacity = parseFloat(e.target.value);
        document.getElementById('image-opacity-value').textContent = Math.round(this.imageOpacity * 100) + '%';
        this.redraw();
      });
    }
    
    // Toggle grid
    const toggleGridBtn = document.getElementById('toggle-grid');
    if (toggleGridBtn) {
      toggleGridBtn.addEventListener('click', () => {
        this.showGrid = !this.showGrid;
        toggleGridBtn.textContent = this.showGrid ? 'Hide Grid' : 'Show Grid';
        toggleGridBtn.classList.toggle('active', !this.showGrid);
        this.redraw();
      });
    }
    
    // Toggle image
    const toggleImageBtn = document.getElementById('toggle-image');
    if (toggleImageBtn) {
      toggleImageBtn.addEventListener('click', () => {
        this.showImage = !this.showImage;
        toggleImageBtn.textContent = this.showImage ? 'Hide Image' : 'Show Image';
        toggleImageBtn.classList.toggle('active', !this.showImage);
        this.redraw();
      });
    }
    
    // Clear image
    const clearImageBtn = document.getElementById('clear-image');
    if (clearImageBtn) {
      clearImageBtn.addEventListener('click', () => {
        if (confirm('Remove background image?')) {
          this.backgroundImage = null;
          this.showImage = false;
          if (document.getElementById('background-image')) {
            document.getElementById('background-image').value = '';
          }
          if (toggleImageBtn) {
            toggleImageBtn.textContent = 'Show Image';
            toggleImageBtn.classList.remove('active');
          }
          this.redraw();
        }
      });
    }
    
    // Import config
    const importBtn = document.getElementById('import-config');
    const importFileInput = document.getElementById('import-config-file');
    if (importBtn && importFileInput) {
      importBtn.addEventListener('click', () => {
        importFileInput.click();
      });
      importFileInput.addEventListener('change', (e) => {
        this.importConfig(e.target.files[0]);
      });
    }
    
    // Copy/Paste buttons
    const copyBtn = document.getElementById('copy-zone');
    const pasteBtn = document.getElementById('paste-zone');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (this.selectedZoneId) {
          this.copyZone(this.selectedZoneId);
          this.updateCopyPasteButtons();
        }
      });
    }
    if (pasteBtn) {
      pasteBtn.addEventListener('click', () => {
        if (this.clipboardZone) {
          this.pasteZone();
          this.updateCopyPasteButtons();
        }
      });
    }
    
    this.updateCopyPasteButtons();
  }
  
  updateCopyPasteButtons() {
    const copyBtn = document.getElementById('copy-zone');
    const pasteBtn = document.getElementById('paste-zone');
    
    if (copyBtn) {
      copyBtn.disabled = !this.selectedZoneId;
    }
    if (pasteBtn) {
      pasteBtn.disabled = !this.clipboardZone;
    }
  }
  
  async importConfig(file) {
    if (!file) return;
    
    try {
      const text = await file.text();
      const importedConfig = JSON.parse(text);
      
      // Load background image if present
      if (importedConfig.backgroundImage) {
        const img = new Image();
        img.onload = () => {
          this.backgroundImage = img;
          this.redraw();
        };
        img.src = importedConfig.backgroundImage;
      }
      
      // Load settings
      if (importedConfig.settings) {
        if (importedConfig.settings.masterVolume !== undefined) {
          this.masterVolume = importedConfig.settings.masterVolume;
          document.getElementById('master-volume').value = this.masterVolume * 100;
          document.getElementById('volume-value').textContent = Math.round(this.masterVolume * 100) + '%';
        }
        if (importedConfig.settings.fadeSpeed !== undefined) {
          this.fadeSpeed = importedConfig.settings.fadeSpeed;
          document.getElementById('fade-speed').value = this.fadeSpeed;
          document.getElementById('fade-speed-value').textContent = this.fadeSpeed + 's';
        }
        if (importedConfig.settings.imageOpacity !== undefined) {
          this.imageOpacity = importedConfig.settings.imageOpacity;
          document.getElementById('image-opacity').value = this.imageOpacity;
          document.getElementById('image-opacity-value').textContent = Math.round(this.imageOpacity * 100) + '%';
        }
        if (importedConfig.settings.showGrid !== undefined) {
          this.showGrid = importedConfig.settings.showGrid;
          const toggleGridBtn = document.getElementById('toggle-grid');
          if (toggleGridBtn) {
            toggleGridBtn.textContent = this.showGrid ? 'Hide Grid' : 'Show Grid';
            toggleGridBtn.classList.toggle('active', !this.showGrid);
          }
        }
        if (importedConfig.settings.showImage !== undefined) {
          this.showImage = importedConfig.settings.showImage;
          const toggleImageBtn = document.getElementById('toggle-image');
          if (toggleImageBtn) {
            toggleImageBtn.textContent = this.showImage ? 'Hide Image' : 'Show Image';
            toggleImageBtn.classList.toggle('active', !this.showImage);
          }
        }
      }
      
      // Load audio zones (without audio data, just structure)
      if (importedConfig.audioZones) {
        this.config.audioZones = importedConfig.audioZones.map(zone => ({
          ...zone,
          audio: {
            ...zone.audio,
            data: null // Audio data needs to be loaded separately
          }
        }));
        this.nextZoneId = Math.max(...this.config.audioZones.map(z => parseInt(z.id.replace('zone-', '')) || 0), 0) + 1;
        this.updateZonesList();
        this.redraw();
      }
      
      alert('Config imported successfully! Note: Audio files need to be re-assigned.');
    } catch (error) {
      console.error('Error importing config:', error);
      alert('Failed to import config: ' + error.message);
    }
  }
  
  loadBackgroundImage(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.backgroundImage = img;
        this.showImage = true;
        if (document.getElementById('toggle-image')) {
          document.getElementById('toggle-image').textContent = 'Hide Image';
          document.getElementById('toggle-image').classList.remove('active');
        }
        this.redraw();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
  
  selectTool(tool) {
    // If switching tools, clear current shape
    if (this.currentTool !== tool && this.currentShape) {
      this.currentShape = null;
      this.redraw();
    }
    
    this.currentTool = tool;
    
    // Update button states
    document.querySelectorAll('[id^="tool-"]').forEach(btn => {
      btn.classList.remove('active');
    });
    
    if (tool) {
      const toolBtn = document.getElementById(`tool-${tool}`);
      if (toolBtn) {
        toolBtn.classList.add('active');
      }
      if (this.mode === 'edit') {
        this.canvas.style.cursor = 'crosshair';
      }
    } else {
      // Select mode
      const selectBtn = document.getElementById('tool-select');
      if (selectBtn) {
        selectBtn.classList.add('active');
      }
      this.canvas.style.cursor = 'default';
    }
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
      // Clear any current shape when entering edit mode
      if (this.currentShape && !this.config.audioZones.find(z => z.shape === this.currentShape)) {
        this.currentShape = null;
      }
    } else {
      btn.textContent = 'Preview Mode';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-secondary');
      editPanel.style.display = 'none';
      this.canvas.style.cursor = 'default';
      // Clear drawing state
      this.currentShape = null;
      this.isDrawing = false;
    }
    
    this.redraw();
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
    
    // Stop any currently playing sources
    if (this.isPlaying) {
      this.stopPreview();
    }
    
    if (!this.audioContext) {
      await this.initAudioContext();
    }
    
    // Load any new zones that haven't been loaded yet
    await this.loadNewAudioBuffers();
    
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
  
  async loadNewAudioBuffers() {
    // Find zones that haven't been loaded yet
    const zonesToLoad = this.config.audioZones.filter(zone => !this.audioZones.has(zone.id));
    
    if (zonesToLoad.length === 0) {
      return; // All zones already loaded
    }
    
    console.log(`Loading ${zonesToLoad.length} new audio buffer(s)...`);
    
    for (const zone of zonesToLoad) {
      try {
        // Skip if already loaded
        if (this.audioZones.has(zone.id)) {
          continue;
        }
        
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
        targetVolume = zone.audio.volume * this.masterVolume;
        distance = 0;
      } else {
        const center = this.getShapeCenter(shape);
        const dist = Math.sqrt(
          Math.pow(x - center.x, 2) + 
          Math.pow(y - center.y, 2)
        );
        distance = dist;
        
        if (dist < fadeDistance) {
          const normalized = dist / fadeDistance;
          // Use exponential falloff for smoother decay curve
          // Creates a more natural fade that feels smoother
          const falloff = Math.pow(1 - normalized, 2.5);
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
      const deltaTime = 1 / 60; // Approximate frame time (60fps)
      
      this.audioZones.forEach((zone, id) => {
        if (!zone.gainNode) return;
        
        const targetVolume = this.targetVolumes.get(id) || 0;
        let currentGain = zone.currentGain || 0;
        
        // Use exponential decay for smoother fades
        // This creates a natural decay curve instead of linear interpolation
        if (Math.abs(currentGain - targetVolume) < 0.0001) {
          zone.currentGain = targetVolume;
          zone.gainNode.gain.setValueAtTime(targetVolume, currentTime);
          return;
        }
        
        // Exponential approach: newValue = target + (current - target) * decayRate
        // This creates smooth acceleration/deceleration
        let newGain;
        if (targetVolume > currentGain) {
          // Fading in: exponential approach from below
          newGain = targetVolume - (targetVolume - currentGain) * this.fadeDecayRate;
          // Ensure we don't overshoot
          if (newGain > targetVolume) newGain = targetVolume;
        } else {
          // Fading out: exponential decay
          newGain = targetVolume + (currentGain - targetVolume) * this.fadeDecayRate;
          // Ensure we don't overshoot
          if (newGain < targetVolume) newGain = targetVolume;
        }
        
        // Clamp to valid range
        newGain = Math.max(0, Math.min(1, newGain));
        
        // If very close to zero, set to zero to avoid unnecessary processing
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
    // Convert background image to data URL if present
    let backgroundImageData = null;
    if (this.backgroundImage) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = this.backgroundImage.width;
      tempCanvas.height = this.backgroundImage.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(this.backgroundImage, 0, 0);
      backgroundImageData = tempCanvas.toDataURL('image/png');
    }
    
    const exportConfig = {
      ...this.config,
      settings: {
        masterVolume: this.masterVolume,
        fadeSpeed: this.fadeSpeed,
        imageOpacity: this.imageOpacity,
        showGrid: this.showGrid,
        showImage: this.showImage
      },
      backgroundImage: backgroundImageData,
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
