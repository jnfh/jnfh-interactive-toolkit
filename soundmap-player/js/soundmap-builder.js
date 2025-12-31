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
    this.r2DirectoryFiles = []; // List of files from R2 directory
    this.r2DirectoryUrl = null; // Base URL of R2 directory
    
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
    
    console.log('Builder ready');
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
      if (e.key === 'Delete' && this.editingZoneId) {
        if (confirm(`Delete zone "${this.config.audioZones.find(z => z.id === this.editingZoneId)?.name}"?`)) {
          this.deleteZone(this.editingZoneId);
        }
      }
      
      // Tool shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
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
      this.drawShape(zone.shape, zone.color, zone.name);
    });
    if (this.currentShape) {
      this.drawShape(this.currentShape);
    }
  }
  
  drawShape(shape, color = null, name = null) {
    const ctx = this.ctx;
    ctx.save();
    
    const shapeColor = color || shape.color || '#667eea';
    const fillColor = shape.fillColor || this.hexToRgba(shapeColor, 0.2);
    
    ctx.strokeStyle = shapeColor;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = shape.lineWidth || this.lineThickness || 2;
    
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
    
    ctx.restore();
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
    
    // Check if hovering over a zone in edit mode
    if (this.mode === 'edit' && !this.isDrawing && !this.currentTool) {
      const hoveredZone = this.config.audioZones.find(zone => 
        this.pointInShape(pos.x, pos.y, zone.shape)
      );
      if (hoveredZone) {
        this.canvas.style.cursor = 'pointer';
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
  
  async loadR2Directory() {
    const r2Url = document.getElementById('r2-url').value.trim();
    
    if (!r2Url) {
      alert('Please enter an R2 directory URL');
      return;
    }
    
    // Normalize URL - ensure it ends with /
    let directoryUrl = r2Url.endsWith('/') ? r2Url : r2Url + '/';
    this.r2DirectoryUrl = directoryUrl;
    
    try {
      // Try multiple methods to list files
      let files = [];
      
      // Method 1: Try to fetch manifest.json
      try {
        const manifestUrl = directoryUrl + 'manifest.json';
        const manifestResponse = await fetch(manifestUrl);
        if (manifestResponse.ok) {
          const manifest = await manifestResponse.json();
          if (Array.isArray(manifest.files)) {
            files = manifest.files.map(file => ({
              name: file.name || file,
              url: file.url || (directoryUrl + (file.name || file))
            }));
          } else if (Array.isArray(manifest)) {
            files = manifest.map(file => ({
              name: typeof file === 'string' ? file : (file.name || file.url),
              url: typeof file === 'string' ? (directoryUrl + file) : (file.url || directoryUrl + file.name)
            }));
          }
        }
      } catch (e) {
        console.log('Manifest.json not found, trying other methods...');
      }
      
      // Method 2: Try Cloudflare Workers API endpoint (if configured)
      if (files.length === 0) {
        try {
          // Try common Workers endpoint patterns
          const workersUrl = directoryUrl.replace(/\/$/, '') + '/list';
          const workersResponse = await fetch(workersUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json'
            }
          });
          if (workersResponse.ok) {
            const data = await workersResponse.json();
            if (Array.isArray(data)) {
              files = data.map(file => ({
                name: typeof file === 'string' ? file : (file.name || file.key),
                url: typeof file === 'string' ? (directoryUrl + file) : (file.url || directoryUrl + (file.name || file.key))
              }));
            } else if (data.files && Array.isArray(data.files)) {
              files = data.files.map(file => ({
                name: typeof file === 'string' ? file : (file.name || file.key),
                url: typeof file === 'string' ? (directoryUrl + file) : (file.url || directoryUrl + (file.name || file.key))
              }));
            }
          }
        } catch (e) {
          console.log('Workers API not available');
        }
      }
      
      // Method 3: Try to parse HTML directory listing (if R2 supports it)
      if (files.length === 0) {
        try {
          const htmlResponse = await fetch(directoryUrl);
          if (htmlResponse.ok) {
            const html = await htmlResponse.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = doc.querySelectorAll('a[href]');
            
            links.forEach(link => {
              const href = link.getAttribute('href');
              if (href && !href.startsWith('../') && !href.startsWith('/') && href !== '../') {
                // Check if it's an audio file
                const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
                const isAudio = audioExtensions.some(ext => href.toLowerCase().endsWith(ext));
                if (isAudio) {
                  files.push({
                    name: href,
                    url: directoryUrl + href
                  });
                }
              }
            });
          }
        } catch (e) {
          console.log('HTML directory listing not available');
        }
      }
      
      if (files.length === 0) {
        // If all methods fail, provide manual entry option
        const manualFiles = prompt(
          'Could not automatically list files. Please enter file names separated by commas:\n' +
          '(e.g., file1.mp3, file2.wav, file3.mp3)'
        );
        
        if (manualFiles) {
          files = manualFiles.split(',').map(file => ({
            name: file.trim(),
            url: directoryUrl + file.trim()
          }));
        } else {
          alert('No files found. Please check the directory URL or create a manifest.json file.');
          return;
        }
      }
      
      // Filter to only audio files
      const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
      files = files.filter(file => {
        const fileName = file.name.toLowerCase();
        return audioExtensions.some(ext => fileName.endsWith(ext));
      });
      
      if (files.length === 0) {
        alert('No audio files found in directory');
        return;
      }
      
      // Store files and populate dropdown
      this.r2DirectoryFiles = files;
      this.populateR2FileDropdown(files);
      
      // Show the dropdown
      document.getElementById('r2-file-list').style.display = 'block';
      
      alert(`Found ${files.length} audio file(s) in directory`);
    } catch (error) {
      console.error('Error loading R2 directory:', error);
      alert('Failed to load directory: ' + error.message);
    }
  }
  
  populateR2FileDropdown(files) {
    const select = document.getElementById('r2-file-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Select a file --</option>';
    files.forEach((file, index) => {
      const option = document.createElement('option');
      option.value = index;
      option.textContent = file.name;
      select.appendChild(option);
    });
  }
  
  async loadR2File() {
    // Check if we're loading from dropdown or direct URL
    const fileSelect = document.getElementById('r2-file-select');
    let r2Url = null;
    let fileName = null;
    
    if (fileSelect && fileSelect.value !== '') {
      // Loading from dropdown
      const selectedIndex = parseInt(fileSelect.value);
      const selectedFile = this.r2DirectoryFiles[selectedIndex];
      if (!selectedFile) {
        alert('Please select a file from the dropdown');
        return;
      }
      r2Url = selectedFile.url;
      fileName = selectedFile.name;
    } else {
      // Loading from direct URL input
      r2Url = document.getElementById('r2-url').value.trim();
      if (!r2Url) {
        alert('Please enter an R2 URL or select a file from the dropdown');
        return;
      }
      fileName = r2Url.split('/').pop();
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
        fileName: fileName
      };
      
      alert('File loaded from R2 successfully!');
    } catch (error) {
      console.error('Error loading R2 file:', error);
      alert('Failed to load file from R2: ' + error.message);
    }
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
    this.resetForm();
    
    this.redraw();
    this.updateZonesList();
    
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
        
        item.addEventListener('dblclick', () => {
          this.editZone(zone.id);
        });
        item.addEventListener('mouseenter', () => {
          if (this.editingZoneId !== zone.id) {
            item.style.background = '#333';
          }
        });
        item.addEventListener('mouseleave', () => {
          if (this.editingZoneId !== zone.id) {
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
      // Reset R2 file list when switching
      if (type !== 'r2') {
        document.getElementById('r2-file-list').style.display = 'none';
        this.r2DirectoryFiles = [];
      }
    });
    
    // Load R2 directory
    const loadR2DirectoryBtn = document.getElementById('load-r2-directory');
    if (loadR2DirectoryBtn) {
      loadR2DirectoryBtn.addEventListener('click', async () => {
        await this.loadR2Directory();
      });
    }
    
    // Load R2 file
    document.getElementById('load-r2-file').addEventListener('click', async () => {
      await this.loadR2File();
    });
    
    // When file is selected from dropdown, auto-load it
    const r2FileSelect = document.getElementById('r2-file-select');
    if (r2FileSelect) {
      r2FileSelect.addEventListener('change', async (e) => {
        if (e.target.value !== '') {
          // Auto-load the selected file
          await this.loadR2File();
        }
      });
    }
    
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
      document.getElementById(`tool-${tool}`).classList.add('active');
      if (this.mode === 'edit') {
        this.canvas.style.cursor = 'crosshair';
      }
    } else {
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
