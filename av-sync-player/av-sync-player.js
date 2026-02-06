// AV Synchronized Player
// Handles synchronized playback of video and multiple audio sources with unified timeline control

class AVSyncPlayer {
    constructor() {
        this.audioContext = null;
        this.masterGainNode = null;
        this.videoElement = null;
        this.canvas = null;
        this.ctx = null;
        this.audioSources = [];
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.updateInterval = null;
        this.startTime = 0;
        this.pausedTime = 0;
        this.masterVolume = 1.5; // Increased overall volume
        this.centerVolumeBoost = 1.5; // Boost volume at center sweet spot (multiplier)
        this._seeking = false;
        this.fadeDuration = 0.3; // Audio fade in/out duration in seconds
        this._fadingIn = false;
        this._fadingOut = false;
        this._fadeEndTime = 0;
        
        // Multi-layer video support
        this.videoLayers = []; // Array of video layer objects
        this.imageOverlays = []; // Array of PNG overlay objects
        this.videoCompositorCanvas = null; // Canvas for compositing video layers
        this.videoCompositorCtx = null; // Context for video compositor
        this.videoCompositorFrameId = null; // Animation frame ID for video compositing
        
        // Spatial audio settings
        this.mousePos = { x: 0, y: 0 }; // Will be initialized to center in initSpatialCanvas
        this.fadeRadius = 1000; // Base fade radius in pixels (will be scaled to video display area)
        this.fadeRadiusVideoRelative = 1.5; // Fade radius as fraction of video width (1.5 = 150% of video width - much longer fade)
        this.fadeSpeed = 0.5;
        this.spatialAudioEnabled = true;
        this.spatialAudioStrength = 1.0;
        this.animationFrameId = null;
        this.lastTime = performance.now();
        
        // Video dimensions for positioning audio sources
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.videoDisplayArea = { x: 0, y: 0, width: 0, height: 0, scale: 1 }; // Video display area on canvas
        
        // Physics settings (all default to 0)
        this.physicsEnabled = false;
        this.physicsStrength = 0;
        this.driftStrength = 0;
        this.mouseRepulsion = 0;
        this.sourceRepulsion = 0;
        this.sourceRepulsionRadius = 100;
        this.orbitalStrength = 0;
        this.orbitalRadius = 150;
        this.orbitalSpeed = 0.1;
        this.damping = 0.92;
        
        // Reverb settings
        this.reverbEnabled = true;
        this.reverbAmount = 1.0;
        this.maxDistance = 1000;
        this.convolverNode = null;
        this.reverbImpulse = null;
        this.reverbSendGain = null;
        
        // Dragging
        this.draggedSource = null;
        this.dragOffset = { x: 0, y: 0 };
        this.draggedAnnotation = null; // For dragging annotations
        
        // Ensure video is muted by default
        this.videoMuted = true;
        
        // Display settings
        this.showAudioSources = true;
        
        // Visual reactive elements
        this.cursorTrail = []; // Trail of cursor positions for smooth trail effect
        this.maxTrailLength = 15;
        this.lastMousePos = { x: 0, y: 0 };
        this.sourcePulse = new Map(); // Track pulse animation for each source
        this.ripples = []; // Ripple effects from cursor movement
        this.time = 0; // Animation time
        
        // Timeline annotations system
        this.annotations = []; // Array of annotation objects
        this.hoveredAnnotation = null; // Currently hovered annotation for tooltip
        this.tooltipElement = null; // Tooltip DOM element
    }

    async init() {
        try {
            // Initialize Audio Context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.connect(this.audioContext.destination);
            this.masterGainNode.gain.value = this.masterVolume;
            
            // Set listener position and orientation
            if (this.audioContext.listener) {
                if (this.audioContext.listener.positionX !== undefined) {
                    this.audioContext.listener.positionX.value = 0;
                    this.audioContext.listener.positionY.value = 0;
                    this.audioContext.listener.positionZ.value = 0;
                    this.audioContext.listener.forwardX.value = 0;
                    this.audioContext.listener.forwardY.value = 0;
                    this.audioContext.listener.forwardZ.value = -1;
                    this.audioContext.listener.upX.value = 0;
                    this.audioContext.listener.upY.value = 1;
                    this.audioContext.listener.upZ.value = 0;
                } else if (this.audioContext.listener.setPosition) {
                    this.audioContext.listener.setPosition(0, 0, 0);
                    this.audioContext.listener.setOrientation(0, 0, -1, 0, 1, 0);
                }
            }
            
            // Initialize reverb
            await this.initReverb();

            // Get video element
            this.videoElement = document.getElementById('videoElement');
            if (!this.videoElement) {
                throw new Error('Video element not found');
            }

            // Mute video by default
            this.videoElement.muted = true;
            this.videoMuted = true;

            // Initialize video compositor canvas
            this.initVideoCompositor();

            // Set up video event listeners
            this.videoElement.addEventListener('loadedmetadata', () => {
                this.updateDuration();
            });

            this.videoElement.addEventListener('timeupdate', () => {
                if (!this._seeking) {
                    this.currentTime = this.videoElement.currentTime;
                }
            });

            this.videoElement.addEventListener('ended', () => {
                this.stop();
            });

            // Initialize spatial canvas
            this.initSpatialCanvas();

            // Initialize tooltip
            this.initTooltip();

            // Start update loop
            this.startUpdateLoop();

            console.log('✓ AVSyncPlayer initialized');
        } catch (error) {
            console.error('Error initializing AVSyncPlayer:', error);
            throw error;
        }
    }

    initVideoCompositor() {
        // Get or create display canvas for video compositing
        let displayCanvas = document.getElementById('videoCompositorDisplay');
        if (!displayCanvas) {
            // Create display canvas if it doesn't exist
            displayCanvas = document.createElement('canvas');
            displayCanvas.id = 'videoCompositorDisplay';
            displayCanvas.style.cssText = 'max-width: 100%; max-height: 100%; width: auto; height: auto; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);';
            const container = this.videoElement?.parentElement;
            if (container && this.videoElement) {
                container.insertBefore(displayCanvas, this.videoElement);
            }
        }
        
        // Use display canvas for compositing
        this.videoCompositorCanvas = displayCanvas;
        this.videoCompositorCtx = this.videoCompositorCanvas.getContext('2d', { alpha: true });
        
        // Set canvas size to match container (same as spatial canvas)
        const resizeCompositorCanvas = () => {
            const container = this.videoElement?.parentElement;
            if (container) {
                this.videoCompositorCanvas.width = container.clientWidth;
                this.videoCompositorCanvas.height = container.clientHeight;
            } else {
                this.videoCompositorCanvas.width = window.innerWidth;
                this.videoCompositorCanvas.height = window.innerHeight;
            }
        };
        
        resizeCompositorCanvas();
        window.addEventListener('resize', resizeCompositorCanvas);
        
        // Start video compositing loop
        this.startVideoCompositorLoop();
        
        console.log('✓ Video compositor initialized');
    }

    startVideoCompositorLoop() {
        if (this.videoCompositorFrameId) {
            cancelAnimationFrame(this.videoCompositorFrameId);
        }
        
        const composite = () => {
            this.compositeVideoLayers();
            this.videoCompositorFrameId = requestAnimationFrame(composite);
        };
        
        this.videoCompositorFrameId = requestAnimationFrame(composite);
    }

    compositeVideoLayers() {
        if (!this.videoCompositorCtx) {
            return;
        }

        const canvasWidth = this.videoCompositorCanvas.width;
        const canvasHeight = this.videoCompositorCanvas.height;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;

        // Only clear canvas if we have videos ready to draw
        // This prevents black screens during seeking/loading
        const hasReadyVideo = this.videoElement && this.videoElement.readyState >= 2;
        const hasReadyLayers = this.videoLayers.some(layer => 
            layer.videoElement && layer.visible && layer.videoElement.readyState >= 2
        );
        
        if (hasReadyVideo || hasReadyLayers) {
            // Clear canvas only when we have content to draw
            this.videoCompositorCtx.clearRect(0, 0, canvasWidth, canvasHeight);
        } else {
            // Don't clear if no videos are ready - preserve last frame
            return;
        }

        // Draw base video first (if exists and no layers, or as background)
        if (this.videoElement && this.videoElement.readyState >= 2) {
            try {
                const baseWidth = this.videoElement.videoWidth || canvasWidth;
                const baseHeight = this.videoElement.videoHeight || canvasHeight;
                
                // Scale to fit canvas while maintaining aspect ratio
                const scale = Math.min(
                    canvasWidth / baseWidth,
                    canvasHeight / baseHeight
                );
                const scaledWidth = baseWidth * scale;
                const scaledHeight = baseHeight * scale;
                
                // Center the video (aligned with sweet spot at center)
                const x = centerX - scaledWidth / 2;
                const y = centerY - scaledHeight / 2;
                
                this.videoCompositorCtx.drawImage(
                    this.videoElement,
                    x, y, scaledWidth, scaledHeight
                );
            } catch (e) {
                // Base video may not be ready
            }
        }

        // If no layers, we're done
        if (this.videoLayers.length === 0) {
            return;
        }

        // Sort layers by z-index (lower z-index renders first/behind)
        const sortedLayers = [...this.videoLayers].sort((a, b) => 
            (a.zIndex || 0) - (b.zIndex || 0)
        );

        // Draw each video layer
        sortedLayers.forEach(layer => {
            if (!layer.videoElement || !layer.visible || layer.videoElement.readyState < 2) {
                return; // Skip if video not ready or hidden
            }

            const video = layer.videoElement;
            const opacity = layer.opacity !== undefined ? layer.opacity : 1.0;
            const scaleX = layer.scaleX !== undefined ? layer.scaleX : 1.0;
            const scaleY = layer.scaleY !== undefined ? layer.scaleY : 1.0;
            
            // Get video dimensions
            const videoWidth = video.videoWidth || canvasWidth;
            const videoHeight = video.videoHeight || canvasHeight;
            
            // Calculate scaled dimensions
            const scaledWidth = videoWidth * scaleX;
            const scaledHeight = videoHeight * scaleY;
            
            // Position relative to center (sweet spot)
            // If x/y are specified, they're offsets from center; otherwise center the layer
            const offsetX = layer.x !== undefined ? layer.x : 0;
            const offsetY = layer.y !== undefined ? layer.y : 0;
            const x = centerX - scaledWidth / 2 + offsetX;
            const y = centerY - scaledHeight / 2 + offsetY;

            // Save context state
            this.videoCompositorCtx.save();

            // Apply opacity
            this.videoCompositorCtx.globalAlpha = opacity;

            // Draw video frame centered (with transparency support)
            try {
                this.videoCompositorCtx.drawImage(
                    video,
                    x, y, scaledWidth, scaledHeight
                );
            } catch (e) {
                // Video may not be ready, skip this frame
                if (Math.random() < 0.01) { // Log occasionally to avoid spam
                    console.warn('Video layer not ready:', layer.name || 'unnamed');
                }
            }

            // Restore context state
            this.videoCompositorCtx.restore();
        });

        // Draw image overlays (PNG files) - these appear on top of video but below spatial canvas
        if (this.imageOverlays && this.imageOverlays.length > 0) {
            // Sort by z-index
            const sortedOverlays = [...this.imageOverlays].sort((a, b) => 
                (a.zIndex || 0) - (b.zIndex || 0)
            );
            
            // Debug: log overlay count (only occasionally to avoid spam)
            if (Math.random() < 0.001) {
                console.log(`Drawing ${sortedOverlays.length} image overlay(s)`);
            }

            sortedOverlays.forEach(overlay => {
                if (!overlay.image || !overlay.visible) {
                    return; // Skip if image not loaded or hidden
                }

                const image = overlay.image;
                
                // Check if image is fully loaded
                if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
                    return; // Image not ready yet
                }
                
                // Ensure isReady flag is set
                if (overlay.isReady === undefined) {
                    overlay.isReady = true;
                }

                // Check timing - only show if within time range
                const currentTime = this.currentTime || 0;
                const startTime = overlay.time || 0;
                const duration = overlay.duration || 0;
                const endTime = duration > 0 ? startTime + duration : Infinity;

                if (currentTime < startTime || currentTime > endTime) {
                    return; // Not in time range
                }

                // Calculate fade opacity
                let opacity = overlay.opacity !== undefined ? overlay.opacity : 1.0;
                const fadeDuration = overlay.fadeDuration || 0.5; // Default 0.5s fade

                if (fadeDuration > 0) {
                    const timeSinceStart = currentTime - startTime;
                    const timeUntilEnd = endTime - currentTime;

                    if (timeSinceStart < fadeDuration) {
                        // Fade in
                        opacity *= (timeSinceStart / fadeDuration);
                    } else if (timeUntilEnd < fadeDuration) {
                        // Fade out
                        opacity *= (timeUntilEnd / fadeDuration);
                    }
                }

                if (opacity <= 0) {
                    return; // Fully transparent
                }

                const scaleX = overlay.scaleX !== undefined ? overlay.scaleX : 1.0;
                const scaleY = overlay.scaleY !== undefined ? overlay.scaleY : 1.0;
                
                // Get image dimensions (use naturalWidth/naturalHeight for actual image size)
                const imageWidth = image.naturalWidth || image.width || 100;
                const imageHeight = image.naturalHeight || image.height || 100;
                
                // Calculate scaled dimensions
                const scaledWidth = imageWidth * scaleX;
                const scaledHeight = imageHeight * scaleY;
                
                // Position relative to center (sweet spot) or absolute
                let x, y;
                if (overlay.positionType === 'absolute') {
                    // Absolute positioning (0-1 normalized)
                    x = (overlay.x !== undefined ? overlay.x : 0.5) * canvasWidth;
                    y = (overlay.y !== undefined ? overlay.y : 0.5) * canvasHeight;
                    // Adjust for anchor point
                    const anchorX = overlay.anchorX !== undefined ? overlay.anchorX : 0.5; // 0=left, 0.5=center, 1=right
                    const anchorY = overlay.anchorY !== undefined ? overlay.anchorY : 0.5; // 0=top, 0.5=center, 1=bottom
                    x -= scaledWidth * anchorX;
                    y -= scaledHeight * anchorY;
                } else {
                    // Relative to center (default)
                    const offsetX = overlay.x !== undefined ? overlay.x : 0;
                    const offsetY = overlay.y !== undefined ? overlay.y : 0;
                    x = centerX - scaledWidth / 2 + offsetX;
                    y = centerY - scaledHeight / 2 + offsetY;
                }

                // Save context state
                this.videoCompositorCtx.save();

                // Apply opacity
                this.videoCompositorCtx.globalAlpha = opacity;

                // Draw image
                try {
                    this.videoCompositorCtx.drawImage(
                        image,
                        x, y, scaledWidth, scaledHeight
                    );
                } catch (e) {
                    // Image may not be ready
                    if (Math.random() < 0.01) {
                        console.warn('Image overlay not ready:', overlay.name || 'unnamed');
                    }
                }

                // Restore context state
                this.videoCompositorCtx.restore();
            });
        }
    }

    updateDuration() {
        // Update duration to longest video or audio
        const videoDurations = this.videoLayers.map(layer => 
            layer.videoElement?.duration || 0
        );
        const longestVideo = Math.max(...videoDurations, this.videoElement?.duration || 0);
        const longestAudio = Math.max(...this.audioSources.map(s => s.duration || 0));
        this.duration = Math.max(longestVideo, longestAudio);
    }

    initSpatialCanvas() {
        this.canvas = document.getElementById('spatialCanvas');
        if (!this.canvas) {
            console.warn('Spatial canvas not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size to match video container
        let resizeTimeout = null;
        const resizeCanvas = () => {
            const container = this.canvas.parentElement;
            if (container) {
                const oldWidth = this.canvas.width;
                const oldHeight = this.canvas.height;
                
                this.canvas.width = container.clientWidth;
                this.canvas.height = container.clientHeight;
                
                // Only update if size actually changed
                if (oldWidth === this.canvas.width && oldHeight === this.canvas.height) {
                    return;
                }
                
                // Update video display area FIRST (before updating positions)
                this.updateVideoDisplayArea();
                
                // Update audio source positions based on video display area
                // This preserves video-relative positions and only updates canvas positions
                // Only update if sources have video-relative positions (video loaded)
                if (this.videoWidth > 0 && this.videoHeight > 0) {
                    this.updateAudioSourcePositions();
                }
                
                // Adjust mouse position to center if canvas was resized or on first init
                if (oldWidth === 0 || oldHeight === 0 || 
                    this.mousePos.x < 0 || this.mousePos.y < 0 ||
                    this.mousePos.x > oldWidth || this.mousePos.y > oldHeight) {
                    this.mousePos.x = this.canvas.width / 2;
                    this.mousePos.y = this.canvas.height / 2;
                } else {
                    // Scale mouse position proportionally relative to center
                    const oldCenterX = oldWidth / 2;
                    const oldCenterY = oldHeight / 2;
                    const newCenterX = this.canvas.width / 2;
                    const newCenterY = this.canvas.height / 2;
                    const scaleX = this.canvas.width / oldWidth;
                    const scaleY = this.canvas.height / oldHeight;
                    const relativeX = this.mousePos.x - oldCenterX;
                    const relativeY = this.mousePos.y - oldCenterY;
                    this.mousePos.x = newCenterX + relativeX * scaleX;
                    this.mousePos.y = newCenterY + relativeY * scaleY;
                }
                
                this.drawSpatialCanvas();
            }
        };
        
        // Debounced resize handler to prevent rapid updates
        const debouncedResize = () => {
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }
            resizeTimeout = setTimeout(() => {
                resizeCanvas();
            }, 16); // ~60fps
        };
        
        resizeCanvas();
        window.addEventListener('resize', debouncedResize);
        
        // Initialize mouse position to center
        if (this.canvas.width > 0 && this.canvas.height > 0) {
            this.mousePos.x = this.canvas.width / 2;
            this.mousePos.y = this.canvas.height / 2;
        }
        
        // Initialize position readout
        this.updatePositionReadout();

        // Mouse tracking and dragging
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const newX = e.clientX - rect.left;
            const newY = e.clientY - rect.top;
            
            // Update mouse position (will be clamped to video bounds for spatial audio)
            this.mousePos.x = newX;
            this.mousePos.y = newY;
            
            // Check if cursor actually moved (for ripple effect)
            const dx = newX - (this.mousePos.x || newX);
            const dy = newY - (this.mousePos.y || newY);
            const moved = Math.sqrt(dx * dx + dy * dy) > 5; // Only create ripple if moved > 5px
            
            // Only add to cursor trail if within video bounds
            if (moved && this.isPositionInVideoBounds(newX, newY)) {
                this.cursorTrail.push({ x: newX, y: newY, time: Date.now(), opacity: 1.0 });
                if (this.cursorTrail.length > this.maxTrailLength) {
                    this.cursorTrail.shift();
                }
                
                // Create subtle ripple effect when moving (only within video bounds)
                if (moved > 15) {
                    this.ripples.push({
                        x: this.mousePos.x,
                        y: this.mousePos.y,
                        radius: 0,
                        maxRadius: 80,
                        opacity: 0.4,
                        speed: 2
                    });
                }
            }
            
            // Update cursor based on hover
            if (!this.draggedSource) {
                const hoveredSource = this.getSourceAtPosition(this.mousePos.x, this.mousePos.y);
                this.canvas.style.cursor = hoveredSource ? 'grab' : 'crosshair';
            }
            
            this.handleMouseMove(e);
        });
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));

        this.canvas.addEventListener('mouseleave', () => {
            // Set mouse position to center of canvas when leaving
            const oldX = this.mousePos.x;
            const oldY = this.mousePos.y;
            this.mousePos.x = this.canvas.width / 2;
            this.mousePos.y = this.canvas.height / 2;
            
            // Create smooth trail to center
            if (Math.abs(oldX - this.mousePos.x) > 10 || Math.abs(oldY - this.mousePos.y) > 10) {
                this.cursorTrail.push({ x: this.mousePos.x, y: this.mousePos.y, time: Date.now(), opacity: 1.0 });
                if (this.cursorTrail.length > this.maxTrailLength) {
                    this.cursorTrail.shift();
                }
            }
            
            if (this.draggedSource) {
                this.draggedSource = null;
            }
            this.updateSpatialVolumes();
        });

        // Touch support
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.handleTouchStart(x, y);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const touch = e.touches[0];
            this.mousePos.x = touch.clientX - rect.left;
            this.mousePos.y = touch.clientY - rect.top;
            this.handleTouchMove(this.mousePos.x, this.mousePos.y);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            // Set mouse position to center when touch ends
            this.mousePos.x = this.canvas.width / 2;
            this.mousePos.y = this.canvas.height / 2;
            this.handleTouchEnd();
            this.updateSpatialVolumes();
        });

        // Start animation loop for canvas drawing
        this.startAnimationLoop();
    }
    
    // Calculate video display area on canvas (centered, maintaining aspect ratio)
    updateVideoDisplayArea() {
        if (!this.canvas || !this.videoWidth || !this.videoHeight) {
            // Fallback to full canvas if video not loaded
            this.videoDisplayArea = {
                x: 0,
                y: 0,
                width: this.canvas ? this.canvas.width : window.innerWidth,
                height: this.canvas ? this.canvas.height : window.innerHeight,
                scale: 1
            };
            return;
        }
        
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // Calculate scale to fit video while maintaining aspect ratio
        const scale = Math.min(
            canvasWidth / this.videoWidth,
            canvasHeight / this.videoHeight
        );
        
        const scaledWidth = this.videoWidth * scale;
        const scaledHeight = this.videoHeight * scale;
        
        // Center the video display area
        const x = (canvasWidth - scaledWidth) / 2;
        const y = (canvasHeight - scaledHeight) / 2;
        
        this.videoDisplayArea = {
            x: x,
            y: y,
            width: scaledWidth,
            height: scaledHeight,
            scale: scale
        };
    }
    
    // Convert video-relative position (0-1 normalized) to canvas position
    videoToCanvasPosition(videoX, videoY) {
        if (!this.videoDisplayArea || this.videoDisplayArea.width === 0) {
            // Fallback to center if video not loaded
            return {
                x: this.canvas ? this.canvas.width / 2 : 0,
                y: this.canvas ? this.canvas.height / 2 : 0
            };
        }
        
        return {
            x: this.videoDisplayArea.x + (videoX * this.videoDisplayArea.width),
            y: this.videoDisplayArea.y + (videoY * this.videoDisplayArea.height)
        };
    }
    
    // Convert canvas position to video-relative position (0-1 normalized)
    canvasToVideoPosition(canvasX, canvasY) {
        if (!this.videoDisplayArea || this.videoDisplayArea.width === 0) {
            // Fallback to center if video not loaded
            return { x: 0.5, y: 0.5 };
        }
        
        // Clamp to video display area
        const clampedX = Math.max(0, Math.min(1, (canvasX - this.videoDisplayArea.x) / this.videoDisplayArea.width));
        const clampedY = Math.max(0, Math.min(1, (canvasY - this.videoDisplayArea.y) / this.videoDisplayArea.height));
        
        return { x: clampedX, y: clampedY };
    }
    
    // Update audio source positions from video-relative to canvas positions
    updateAudioSourcePositions() {
        if (!this.audioSources || this.audioSources.length === 0) return;
        
        // Ensure video display area is up to date
        this.updateVideoDisplayArea();
        
        this.audioSources.forEach(source => {
            // If source doesn't have video-relative position, initialize it from current canvas position
            if (source.videoX === undefined || source.videoY === undefined) {
                // Convert current canvas position to video-relative
                const videoPos = this.canvasToVideoPosition(source.x || this.canvas.width / 2, source.y || this.canvas.height / 2);
                source.videoX = videoPos.x;
                source.videoY = videoPos.y;
            }
            
            // Always preserve video-relative position and convert to canvas
            // This ensures sources maintain their position relative to video regardless of canvas size
            const canvasPos = this.videoToCanvasPosition(source.videoX, source.videoY);
            source.x = canvasPos.x;
            source.y = canvasPos.y;
            source.baseX = source.x;
            source.baseY = source.y;
        });
    }

    async loadVideo(file, options = {}) {
        return new Promise((resolve, reject) => {
            // Support both File objects and URL strings (for Cloudflare R2)
            const url = typeof file === 'string' ? file : URL.createObjectURL(file);
            const fileName = typeof file === 'string' ? options.name || 'video' : file.name;
            
            // If this is the base video (first layer), use the main video element
            if (this.videoLayers.length === 0 && !options.isLayer) {
                this.videoElement.src = url;
                this.videoElement.muted = true;
                this.videoMuted = true;
                
                // Optimize preload strategy for long files
                // Use 'auto' to preload more data and avoid black screens during seeking
                // Falls back to 'metadata' for very long files to save bandwidth
                this.videoElement.preload = options.preload || 'auto';
                
                // Enable range requests (automatic with HTTP, but ensure it's set)
                if (typeof file === 'string') {
                    // For URL-based loading (Cloudflare R2), ensure CORS is handled
                    this.videoElement.crossOrigin = 'anonymous';
                }
                
                this.videoElement.onloadedmetadata = () => {
                    this.updateDuration();
                    console.log(`✓ Base video loaded: ${fileName}, duration: ${this.formatDuration(this.duration)}s`);
                    
                    // Store video dimensions
                    if (this.videoElement.videoWidth && this.videoElement.videoHeight) {
                        this.videoWidth = this.videoElement.videoWidth;
                        this.videoHeight = this.videoElement.videoHeight;
                        
                        // Calculate fade radius as fraction of video width for consistent scaling
                        // Default: 1.5 (150% of video width) for much longer fade dropoff
                        if (this.fadeRadiusVideoRelative === undefined) {
                            this.fadeRadiusVideoRelative = 1.5; // 150% of video width - much longer fade
                        }
                        
                        // Update video display area
                        this.updateVideoDisplayArea();
                        
                        // Initialize video-relative positions for all sources if they don't have them
                        if (this.audioSources && this.audioSources.length > 0) {
                            this.audioSources.forEach(source => {
                                if (source.videoX === undefined || source.videoY === undefined) {
                                    // Convert current canvas position to video-relative
                                    const videoPos = this.canvasToVideoPosition(
                                        source.x || (this.canvas ? this.canvas.width / 2 : 0), 
                                        source.y || (this.canvas ? this.canvas.height / 2 : 0)
                                    );
                                    source.videoX = videoPos.x;
                                    source.videoY = videoPos.y;
                                }
                            });
                        }
                        
                        // Update audio source positions based on video display area
                        this.updateAudioSourcePositions();
                    }
                    
                    // Update compositor canvas size to match video
                    if (this.videoCompositorCanvas && this.videoElement.videoWidth) {
                        this.videoCompositorCanvas.width = this.videoElement.videoWidth;
                        this.videoCompositorCanvas.height = this.videoElement.videoHeight;
                    }
                    
                    // Resize spatial canvas when video loads
                    if (this.canvas) {
                        const container = this.canvas.parentElement;
                        if (container) {
                            this.canvas.width = container.clientWidth;
                            this.canvas.height = container.clientHeight;
                        }
                    }
                    resolve();
                };
                
                this.videoElement.onerror = () => {
                    reject(new Error(`Failed to load video: ${fileName}`));
                };
            } else {
                // This is an additional layer
                this.addVideoLayer(file, options).then(resolve).catch(reject);
            }
        });
    }

    async addVideoLayer(file, options = {}) {
        return new Promise((resolve, reject) => {
            const videoElement = document.createElement('video');
            
            // Support both File objects and URL strings (for Cloudflare R2)
            const url = typeof file === 'string' ? file : URL.createObjectURL(file);
            const fileName = typeof file === 'string' ? options.name || `layer-${this.videoLayers.length}` : file.name;
            
            videoElement.src = url;
            videoElement.muted = true;
            
            // Optimize preload: 'auto' to preload more data and avoid black screens during seeking
            // Falls back to 'metadata' for very long files to save bandwidth
            videoElement.preload = options.preload || 'auto';
            
            // Enable CORS for URL-based loading (Cloudflare R2)
            if (typeof file === 'string') {
                videoElement.crossOrigin = 'anonymous';
            }
            
            // Set up video layer object
            const layer = {
                id: this.videoLayers.length,
                name: fileName,
                file: typeof file === 'string' ? null : file, // Store file only if File object
                url: url,
                videoElement: videoElement,
                isUrl: typeof file === 'string', // Track if loaded from URL
                opacity: options.opacity !== undefined ? options.opacity : 1.0,
                x: options.x !== undefined ? options.x : 0,
                y: options.y !== undefined ? options.y : 0,
                width: options.width,
                height: options.height,
                scaleX: options.scaleX !== undefined ? options.scaleX : 1.0,
                scaleY: options.scaleY !== undefined ? options.scaleY : 1.0,
                zIndex: options.zIndex !== undefined ? options.zIndex : this.videoLayers.length,
                visible: options.visible !== undefined ? options.visible : true,
                offset: options.offset !== undefined ? options.offset : 0, // Start time offset
                duration: 0,
                isReady: false
            };

            videoElement.onloadedmetadata = () => {
                layer.duration = videoElement.duration;
                layer.isReady = true;
                this.updateDuration();
                
                // Update compositor canvas size if needed
                if (this.videoCompositorCanvas && videoElement.videoWidth) {
                    // Use largest video dimensions
                    if (videoElement.videoWidth > this.videoCompositorCanvas.width) {
                        this.videoCompositorCanvas.width = videoElement.videoWidth;
                    }
                    if (videoElement.videoHeight > this.videoCompositorCanvas.height) {
                        this.videoCompositorCanvas.height = videoElement.videoHeight;
                    }
                }
                
                console.log(`✓ Video layer ${layer.id} loaded: ${file.name}, duration: ${this.formatDuration(layer.duration)}s`);
                resolve(layer);
            };

            videoElement.onerror = () => {
                reject(new Error(`Failed to load video layer: ${file.name}`));
            };

            // Add to layers array
            this.videoLayers.push(layer);
            
            // Trigger metadata load
            videoElement.load();
        });
    }

    async loadVideoLayers(files, options = {}) {
        const layers = [];
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const layerOptions = {
                ...options,
                zIndex: options.zIndex !== undefined ? options.zIndex : i,
                isLayer: i > 0 // First file is base, rest are layers
            };
            
            try {
                if (i === 0 && this.videoLayers.length === 0) {
                    // First file is base video
                    await this.loadVideo(file, { ...layerOptions, isLayer: false });
                } else {
                    // Additional layers
                    const layer = await this.addVideoLayer(file, layerOptions);
                    layers.push(layer);
                }
            } catch (error) {
                console.error(`Error loading video layer ${i}:`, error);
                throw error;
            }
        }
        
        console.log(`✓ ${files.length} video layer(s) loaded`);
        return layers;
    }

    async loadAudioFiles(files, onProgress) {
        // Clear existing audio sources
        this.stopAllAudio();
        this.audioSources = [];

        // Load each audio file with progress tracking
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                const progressCallback = onProgress ? (index, percent, message) => {
                    onProgress(index, percent, message, i + 1, files.length);
                } : null;
                
                const source = await this.loadAudioFile(file, i, progressCallback);
                this.audioSources.push(source);
                console.log(`✓ Audio ${i + 1}/${files.length} loaded: ${file.name} (${this.formatDuration(source.duration)})`);
            } catch (error) {
                console.error(`Error loading audio file ${i + 1}:`, error);
                throw error;
            }
        }

        // Update duration to longest audio or video
        const longestAudio = Math.max(...this.audioSources.map(s => s.duration || 0));
        if (longestAudio > this.duration) {
            this.duration = longestAudio;
        }

            // Recalculate positions now that we know total count
        // Try to detect channel positions from filenames first
        if (this.canvas && this.audioSources.length > 0) {
            this.audioSources.forEach((source, index) => {
                // Try to detect channel from filename
                const channelPos = this.detectChannelPosition(source.name || source.file?.name || '');
                
                let videoX, videoY;
                
                if (channelPos) {
                    // Use detected channel position (convert to video-relative 0-1)
                    videoX = 0.5 + channelPos.x * 0.25;
                    videoY = 0.5 + channelPos.y * 0.25;
                } else {
                    // Fall back to default positioning
                    if (this.audioSources.length === 4 && index < 4) {
                        // Square arrangement for 4 sources
                        const positions = [
                            { x: -0.25, y: -0.25 }, // top-left
                            { x: 0.25, y: -0.25 },  // top-right
                            { x: 0.25, y: 0.25 },   // bottom-right
                            { x: -0.25, y: 0.25 }   // bottom-left
                        ];
                        const pos = positions[index];
                        videoX = 0.5 + pos.x;
                        videoY = 0.5 + pos.y;
                    } else {
                        // Circular arrangement for other counts
                        const radius = 0.25;
                        const angle = (index / this.audioSources.length) * Math.PI * 2;
                        videoX = 0.5 + Math.cos(angle) * radius;
                        videoY = 0.5 + Math.sin(angle) * radius;
                    }
                }
                
                // Clamp to video bounds
                videoX = Math.max(0, Math.min(1, videoX));
                videoY = Math.max(0, Math.min(1, videoY));
                
                // Store video-relative position
                source.videoX = videoX;
                source.videoY = videoY;
                
                // Convert to canvas position
                const canvasPos = this.videoToCanvasPosition(videoX, videoY);
                source.x = canvasPos.x;
                source.y = canvasPos.y;
                source.baseX = source.x;
                source.baseY = source.y;
            });
            
            // Trigger redraw
            this.drawSpatialCanvas();
        }

        console.log(`✓ ${this.audioSources.length} audio sources loaded (total duration: ${this.formatDuration(this.duration)})`);
        
        // Update position readout when sources are loaded
        this.updatePositionReadout();
    }

    // Helper function to format duration
    async initReverb() {
        if (!this.audioContext || !this.reverbEnabled) return;
        
        try {
            const sampleRate = this.audioContext.sampleRate;
            const length = sampleRate * 2; // 2 seconds
            const impulse = this.audioContext.createBuffer(2, length, sampleRate);
            const impulseL = impulse.getChannelData(0);
            const impulseR = impulse.getChannelData(1);
            
            // Generate exponential decay reverb
            for (let i = 0; i < length; i++) {
                const n = length - i;
                impulseL[i] = (Math.random() * 2 - 1) * Math.pow(n / length, 2);
                impulseR[i] = (Math.random() * 2 - 1) * Math.pow(n / length, 2);
            }
            
            this.reverbImpulse = impulse;
            this.convolverNode = this.audioContext.createConvolver();
            this.convolverNode.buffer = impulse;
            this.convolverNode.normalize = true;
            
            this.reverbSendGain = this.audioContext.createGain();
            this.reverbSendGain.gain.value = 0.25;
            
            this.reverbSendGain.connect(this.convolverNode);
            this.convolverNode.connect(this.masterGainNode);
            
            console.log('✓ Reverb initialized');
        } catch (error) {
            console.error('Error initializing reverb:', error);
        }
    }

    formatDuration(seconds) {
        if (!seconds || !isFinite(seconds)) return 'unknown';
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    detectChannelPosition(filename) {
        // Handle undefined, null, or empty strings
        if (!filename || typeof filename !== 'string') {
            return null;
        }
        
        // Normalize filename to lowercase for matching
        const name = filename.toLowerCase();
        
        // Remove file extension
        const nameWithoutExt = name.replace(/\.[^/.]+$/, '');
        
        // Channel detection patterns (with up/front being top, negative y)
        // Format: { x: horizontal offset, y: vertical offset } 
        // x: -1 = left, 0 = center, 1 = right
        // y: -1 = front/up, 0 = middle, 1 = back/down
        
        // Center / Front Center
        if (/\b(center|centre|c|front\s*center|front\s*centre|fc)\b/.test(nameWithoutExt)) {
            return { x: 0, y: -1, channel: 'center' };
        }
        
        // Front Left - square pattern equidistant from center (top-left corner)
        if (/\b(fl|front\s*left|left\s*front|lf)\b/.test(nameWithoutExt)) {
            return { x: -1, y: -1, channel: 'front-left' }; // Square pattern equidistant
        }
        
        // Front Right - square pattern equidistant from center (top-right corner)
        if (/\b(fr|front\s*right|right\s*front|rf)\b/.test(nameWithoutExt)) {
            return { x: 1, y: -1, channel: 'front-right' }; // Square pattern equidistant
        }
        
        // Left Surround / Surround Left / Back Left / Rear Left
        if (/\b(ls|l\s*surround|surround\s*left|left\s*surround|bl|back\s*left|rear\s*left)\b/.test(nameWithoutExt)) {
            return { x: -1, y: 1, channel: 'left-surround' };
        }
        
        // Right Surround / Surround Right / Back Right / Rear Right
        if (/\b(rs|r\s*surround|surround\s*right|right\s*surround|br|back\s*right|rear\s*right)\b/.test(nameWithoutExt)) {
            return { x: 1, y: 1, channel: 'right-surround' };
        }
        
        // Left (if it's just "LEFT" without surround/rear/back, treat as FRONT LEFT - top-left corner)
        if (/\bleft\b/.test(nameWithoutExt) && !/\b(surround|rear|back|ls|bl)\b/.test(nameWithoutExt)) {
            return { x: -1, y: -1, channel: 'front-left' }; // Top-left corner
        }
        
        // Right (if it's just "RIGHT" without surround/rear/back, treat as FRONT RIGHT - top-right corner)
        if (/\bright\b/.test(nameWithoutExt) && !/\b(surround|rear|back|rs|br)\b/.test(nameWithoutExt)) {
            return { x: 1, y: -1, channel: 'front-right' }; // Top-right corner
        }
        
        // Rear / Back / Surround (center rear)
        if (/\b(rear|back|surround|sub|subwoofer|lfe)\b/.test(nameWithoutExt) && 
            !/\b(left|right|l|r|ls|rs|bl|br)\b/.test(nameWithoutExt)) {
            return { x: 0, y: 1, channel: 'rear' };
        }
        
        // No match found - return null to use default positioning
        return null;
    }

    async loadAudioFile(file, index, onProgress) {
        return new Promise((resolve, reject) => {
            // Use HTML5 Audio element for long files (memory efficient)
            // We'll connect it to Web Audio API for mixing
            const audioElement = new Audio();
            
            // Handle both File objects, URL strings, and objects with url/name properties
            let url;
            let fileName;
            if (typeof file === 'string') {
                // It's a URL string
                url = file;
                // Decode URL-encoded filename (e.g., LEFT%20%20FRONT -> LEFT  FRONT)
                const urlFilename = decodeURIComponent(file.split('/').pop() || '');
                fileName = urlFilename || `audio-${index}`;
            } else if (file && file.url) {
                // Object with URL property (from config)
                url = file.url;
                // Use provided name, or extract from URL, or use default
                if (file.name) {
                    fileName = file.name;
                } else {
                    const urlFilename = decodeURIComponent(file.url.split('/').pop() || '');
                    fileName = urlFilename || `audio-${index}`;
                }
            } else if (file instanceof File) {
                // It's a File object
                url = URL.createObjectURL(file);
                fileName = file.name;
            } else {
                // Fallback
                url = '';
                fileName = `audio-${index}`;
            }
            
            let mediaSourceNode = null;
            
            // Set up audio element
            audioElement.preload = 'metadata'; // Only load metadata initially, stream on play
            audioElement.src = url;
            audioElement.crossOrigin = 'anonymous';
            
            // Track loading progress
            audioElement.addEventListener('loadstart', () => {
                if (onProgress) onProgress(index, 0, `Loading ${fileName}...`);
            });
            
            audioElement.addEventListener('progress', () => {
                if (audioElement.buffered.length > 0) {
                    const loaded = audioElement.buffered.end(0);
                    const duration = audioElement.duration || 0;
                    const percent = duration > 0 ? (loaded / duration) * 100 : 0;
                    if (onProgress) onProgress(index, percent, `Loading ${fileName}...`);
                }
            });
            
            audioElement.addEventListener('loadedmetadata', () => {
                try {
                    // Create MediaElementSource from HTML5 audio element
                    // This connects HTML5 audio to Web Audio API
                    mediaSourceNode = this.audioContext.createMediaElementSource(audioElement);
                    
                    // Create gain node for volume control
                    const gainNode = this.audioContext.createGain();
                    gainNode.gain.value = 1.0;

                    // Create analyser node for audio reactivity
                    const analyserNode = this.audioContext.createAnalyser();
                    analyserNode.fftSize = 256; // Lower FFT size for better performance
                    analyserNode.smoothingTimeConstant = 0.8; // Smooth the audio data
                    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);

                    // Create 3D panner node for spatial audio
                    let pannerNode;
                    if (this.spatialAudioEnabled && this.audioContext.createPanner) {
                        pannerNode = this.audioContext.createPanner();
                        pannerNode.panningModel = 'HRTF';
                        pannerNode.distanceModel = 'linear';
                        pannerNode.refDistance = this.maxDistance;
                        pannerNode.maxDistance = this.maxDistance * 2;
                        pannerNode.rolloffFactor = 0;
                        pannerNode.coneInnerAngle = 360;
                        pannerNode.coneOuterAngle = 0;
                        pannerNode.coneOuterGain = 0;
                    } else {
                        // Fallback to stereo panner
                        pannerNode = this.audioContext.createStereoPanner();
                        if (pannerNode.pan) {
                            pannerNode.pan.value = 0;
                        }
                    }

                    // Connect with analyser for audio reactivity
                    // Route: mediaSourceNode -> gainNode -> analyserNode -> pannerNode
                    mediaSourceNode.connect(gainNode);
                    gainNode.connect(analyserNode);
                    analyserNode.connect(pannerNode);
                    
                    // Calculate initial position relative to video (normalized 0-1)
                    // Try to detect channel from filename first, then fall back to default positioning
                    let videoX, videoY;
                    // Use fileName which we already extracted (handles both File objects and URLs)
                    const channelPos = this.detectChannelPosition(fileName);
                    
                    if (channelPos) {
                        // Use detected channel position (convert from -1 to 1 range to 0 to 1 range)
                        videoX = 0.5 + channelPos.x * 0.25; // Center ± 25%
                        videoY = 0.5 + channelPos.y * 0.25; // Center ± 25%
                    } else {
                        // Fall back to default positioning
                        const totalSources = this.audioSources.length + 1; // +1 for current source
                        
                        // For 4 sources, arrange in a square pattern
                        if (totalSources === 4 || index < 4) {
                            // Square arrangement: top-left, top-right, bottom-right, bottom-left
                            const positions = [
                                { x: -0.25, y: -0.25 }, // top-left
                                { x: 0.25, y: -0.25 },  // top-right
                                { x: 0.25, y: 0.25 },   // bottom-right
                                { x: -0.25, y: 0.25 }   // bottom-left
                            ];
                            const pos = positions[index % 4];
                            videoX = 0.5 + pos.x;
                            videoY = 0.5 + pos.y;
                        } else {
                            // For more than 4 sources, fall back to circular arrangement
                            const radius = 0.25;
                            const angle = (index / totalSources) * Math.PI * 2;
                            videoX = 0.5 + Math.cos(angle) * radius;
                            videoY = 0.5 + Math.sin(angle) * radius;
                        }
                    }
                    
                    // Clamp to video bounds (0-1)
                    videoX = Math.max(0, Math.min(1, videoX));
                    videoY = Math.max(0, Math.min(1, videoY));
                    
                    // Convert to canvas position
                    const canvasPos = this.videoToCanvasPosition(videoX, videoY);
                    const x = canvasPos.x;
                    const y = canvasPos.y;

                    const audioSource = {
                        id: index,
                        name: fileName,
                        file: typeof file === 'object' && !file.url && file instanceof File ? file : null, // Only store File object, not URL strings
                        url: url, // Store URL for R2 files
                        audioElement: audioElement,
                        mediaSourceNode: mediaSourceNode,
                        gainNode: gainNode,
                        analyserNode: analyserNode,
                        analyserDataArray: dataArray,
                        pannerNode: pannerNode,
                        volume: 1.0,
                        pan: 0,
                        muted: false,
                        solo: false,
                        duration: audioElement.duration || 0,
                        offset: 0,
                        isReady: false,
                        // Spatial positioning
                        x: x,
                        y: y,
                        baseX: x,
                        baseY: y,
                        videoX: videoX, // Video-relative position (0-1 normalized)
                        videoY: videoY, // Video-relative position (0-1 normalized)
                        vx: 0,
                        vy: 0,
                        driftAngle: Math.random() * Math.PI * 2,
                        driftSpeed: 0.5 + Math.random() * 0.5,
                        orbitalAngle: Math.random() * Math.PI * 2,
                        orbitalRadius: 120 + Math.random() * 80,
                        orbitalSpeed: 0.015 + Math.random() * 0.01,
                        orbitalDirection: Math.random() > 0.5 ? 1 : -1,
                        targetVolume: 1.0,
                        currentVolume: 1.0,
                        // Audio reactivity
                        audioLevel: 0, // Current audio level (0-1)
                        smoothedAudioLevel: 0, // Smoothed for visual effects
                        color: 'rgba(255, 255, 255, 1)' // White by default
                    };

                    // Connect reverb if enabled (after audioSource is created)
                    if (this.reverbEnabled && this.convolverNode && this.reverbSendGain) {
                        audioSource.reverbGain = this.audioContext.createGain();
                        audioSource.reverbGain.gain.value = this.reverbAmount * 0.2;
                        pannerNode.connect(audioSource.reverbGain);
                        audioSource.reverbGain.connect(this.reverbSendGain);
                        
                        audioSource.dryGain = this.audioContext.createGain();
                        audioSource.dryGain.gain.value = 0.9;
                        pannerNode.connect(audioSource.dryGain);
                        audioSource.dryGain.connect(this.masterGainNode);
                    } else {
                        pannerNode.connect(this.masterGainNode);
                    }

                    // Wait for duration to be available
                    if (audioElement.duration && isFinite(audioElement.duration)) {
                        audioSource.isReady = true;
                        audioSource.duration = audioElement.duration;
                        if (onProgress) onProgress(index, 100, `${file.name} loaded`);
                        resolve(audioSource);
                    } else {
                        // Wait a bit more for duration
                        const checkDuration = setInterval(() => {
                            if (audioElement.duration && isFinite(audioElement.duration)) {
                                clearInterval(checkDuration);
                                audioSource.isReady = true;
                                audioSource.duration = audioElement.duration;
                                if (onProgress) onProgress(index, 100, `${file.name} loaded`);
                                resolve(audioSource);
                            }
                        }, 100);
                        
                        // Timeout after 5 seconds
                        setTimeout(() => {
                            clearInterval(checkDuration);
                            if (!audioSource.isReady) {
                                // Try to resolve anyway with estimated duration
                                audioSource.isReady = true;
                                if (onProgress) onProgress(index, 100, `${file.name} loaded (duration unknown)`);
                                resolve(audioSource);
                            }
                        }, 5000);
                    }
                } catch (error) {
                    reject(error);
                }
            });
            
            audioElement.addEventListener('error', (e) => {
                reject(new Error(`Failed to load audio file: ${file.name}`));
            });
            
            // Trigger metadata load
            audioElement.load();
        });
    }

    play() {
        if (this.isPlaying) {
            return;
        }
        
        // Require minimum of 2 audio files
        if (!this.audioSources || this.audioSources.length < 2) {
            alert(`Please add at least 2 audio files. Currently loaded: ${this.audioSources ? this.audioSources.length : 0}`);
            return;
        }

        // Resume audio context if suspended (required for autoplay)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Calculate start offset
        const startOffset = this.currentTime;

        // Play base video
        if (this.videoElement) {
            this.videoElement.currentTime = startOffset;
            this.videoElement.play().catch(err => {
                // Ignore AbortError (play interrupted by pause) - this is normal
                if (err.name !== 'AbortError') {
                    console.error('Error playing video:', err);
                }
            });
        }

        // Play all video layers
        this.videoLayers.forEach(layer => {
            if (layer.videoElement && layer.visible) {
                const layerStartTime = Math.max(0, startOffset - (layer.offset || 0));
                const layerDuration = layer.duration || Infinity;
                
                if (layerStartTime < layerDuration) {
                    layer.videoElement.currentTime = layerStartTime;
                    layer.videoElement.play().catch(err => {
                        if (err.name !== 'AbortError') {
                            console.error(`Error playing video layer ${layer.id}:`, err);
                        }
                    });
                }
            }
        });

        // Play all audio sources with fade in
        this.audioSources.forEach(audioSource => {
            this.playAudioSource(audioSource, startOffset);
        });

        // Fade in all audio sources (small delay to ensure audio elements are playing)
        setTimeout(() => {
            this.fadeInAudio();
        }, 50);

        this.isPlaying = true;
        this.startTime = this.audioContext.currentTime - startOffset;
        this.pausedTime = 0;

        console.log('✓ Playback started');
    }

    playAudioSource(audioSource, startOffset) {
        // Pause and reset audio element if playing
        if (!audioSource.audioElement.paused) {
            audioSource.audioElement.pause();
        }
        audioSource.audioElement.currentTime = 0;

        // Calculate when to start
        const audioDuration = audioSource.duration || 0;
        const playOffset = Math.min(startOffset, audioDuration);
        
        // Don't start if offset is beyond audio duration
        if (audioDuration > 0 && playOffset >= audioDuration) {
            audioSource.gainNode.gain.value = 0;
            return;
        }

        // Check if should play based on mute/solo state
        const hasSolo = this.audioSources.some(s => s.solo);
        const shouldPlay = !audioSource.muted && (!hasSolo || audioSource.solo);

        if (!shouldPlay || (audioDuration > 0 && playOffset >= audioDuration)) {
            // Set volume to 0 if not playing
            if (audioSource.gainNode) {
                audioSource.gainNode.gain.value = 0;
            }
            return;
        }

        // Set volume and pan (before starting)
        // Use base volume initially - spatial system will override if mouse is on canvas
        const baseVolume = audioSource.volume * this.masterVolume;
        if (audioSource.gainNode) {
            // Only set volume if mouse is off canvas (spatial system handles it otherwise)
            if (this.mousePos.x < 0 || this.mousePos.y < 0) {
                audioSource.gainNode.gain.value = baseVolume;
            }
            // Initialize currentVolume for spatial system
            audioSource.currentVolume = audioSource.volume;
            audioSource.targetVolume = audioSource.volume;
        }
        // Only set pan if it's a stereo panner (not 3D panner)
        if (audioSource.pannerNode && audioSource.pannerNode.pan) {
            audioSource.pannerNode.pan.value = audioSource.pan;
        }

        // Start playback using HTML5 audio element
        try {
            audioSource.audioElement.currentTime = playOffset;
            const playPromise = audioSource.audioElement.play();
            
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    console.log(`✓ Audio source ${audioSource.id} playing`);
                }).catch(error => {
                    // Ignore AbortError (play interrupted by pause) - this is normal during seeking
                    if (error.name !== 'AbortError') {
                        console.error(`Error playing audio source ${audioSource.id}:`, error);
                    }
                });
            }
        } catch (error) {
            console.error(`Error starting audio source ${audioSource.id}:`, error);
        }
    }

    pause() {
        if (!this.isPlaying) {
            return;
        }

        // Pause base video
        if (this.videoElement) {
            this.videoElement.pause();
        }

        // Pause all video layers
        this.videoLayers.forEach(layer => {
            if (layer.videoElement) {
                layer.videoElement.pause();
            }
        });

        // Fade out all audio sources, then stop
        this.fadeOutAudio(() => {
            this.stopAllAudio();
        });

        // Update paused time
        this.pausedTime = this.currentTime;
        this.isPlaying = false;

        console.log('✓ Playback paused');
    }

    stop() {
        // Fade out all audio sources, then stop
        this.fadeOutAudio(() => {
            // Stop base video
            if (this.videoElement) {
                this.videoElement.pause();
                this.videoElement.currentTime = 0;
            }

            // Stop all video layers
            this.videoLayers.forEach(layer => {
                if (layer.videoElement) {
                    layer.videoElement.pause();
                    layer.videoElement.currentTime = 0;
                }
            });

            // Stop all audio
            this.stopAllAudio();

            // Reset state
            this.isPlaying = false;
            this.currentTime = 0;
            this.pausedTime = 0;
            this.startTime = 0;

            console.log('✓ Playback stopped');
        });
    }

    restart() {
        this.stop();
        this.play();
    }

    seek(time) {
        this._seeking = true;

        // Don't pause during seeking - keep playback continuous
        this.currentTime = Math.max(0, Math.min(time, this.duration));
        
        // Seek base video directly - reliable and immediate
        if (this.videoElement && this.videoElement.readyState >= 2) {
            try {
                this.videoElement.currentTime = this.currentTime;
            } catch (e) {
                // Video might not be ready, ignore
            }
        }

        // Seek all video layers directly
        this.videoLayers.forEach(layer => {
            if (layer.videoElement && layer.visible && layer.videoElement.readyState >= 2) {
                try {
                    const layerTime = Math.max(0, this.currentTime - (layer.offset || 0));
                    const layerDuration = layer.duration || Infinity;
                    
                    if (layerTime < layerDuration) {
                        layer.videoElement.currentTime = layerTime;
                    } else {
                        layer.videoElement.pause();
                    }
                } catch (e) {
                    // Layer might not be ready, ignore
                }
            }
        });

        // Seek audio sources immediately - audio seeks are fast
        this.audioSources.forEach((audioSource) => {
            if (audioSource.audioElement && audioSource.audioElement.readyState >= 2) {
                try {
                    // Seek audio element directly - it will continue playing from new position
                    audioSource.audioElement.currentTime = this.currentTime;
                } catch (e) {
                    // Audio might not be ready, ignore
                }
            }
        });

        // Mark seeking as complete quickly for responsive UI
        this._seeking = false;
    }

    fadeInAudio() {
        const now = this.audioContext.currentTime;
        const fadeInTime = this.fadeDuration;
        
        this._fadingIn = true;
        this._fadingOut = false;
        this._fadeEndTime = now + fadeInTime;
        
        this.audioSources.forEach(audioSource => {
            if (audioSource.gainNode && !audioSource.muted) {
                const hasSolo = this.audioSources.some(s => s.solo);
                const shouldPlay = !hasSolo || audioSource.solo;
                
                if (shouldPlay) {
                    // Cancel any pending changes
                    audioSource.gainNode.gain.cancelScheduledValues(now);
                    // Set immediate value to 0 for fade in
                    audioSource.gainNode.gain.setValueAtTime(0, now);
                    // Smoothly ramp to target volume based on current spatial calculation
                    const targetVolume = audioSource.currentVolume * this.masterVolume;
                    audioSource.gainNode.gain.linearRampToValueAtTime(
                        Math.max(0, Math.min(1, targetVolume)),
                        now + fadeInTime
                    );
                }
            }
        });
        
        // Clear fade flag after fade completes
        setTimeout(() => {
            this._fadingIn = false;
        }, fadeInTime * 1000);
    }

    fadeOutAudio(callback) {
        const now = this.audioContext.currentTime;
        const fadeOutTime = this.fadeDuration;
        
        this._fadingOut = true;
        this._fadingIn = false;
        this._fadeEndTime = now + fadeOutTime;
        
        this.audioSources.forEach(audioSource => {
            if (audioSource.gainNode) {
                const currentGain = audioSource.gainNode.gain.value;
                // Cancel any pending changes
                audioSource.gainNode.gain.cancelScheduledValues(now);
                // Set current value
                audioSource.gainNode.gain.setValueAtTime(currentGain, now);
                // Smoothly ramp to 0
                audioSource.gainNode.gain.linearRampToValueAtTime(0, now + fadeOutTime);
            }
        });
        
        // Clear fade flag and call callback after fade completes
        setTimeout(() => {
            this._fadingOut = false;
            if (callback) {
                callback();
            }
        }, fadeOutTime * 1000);
    }

    stopAllAudio() {
        this.audioSources.forEach(audioSource => {
            if (audioSource.audioElement) {
                try {
                    audioSource.audioElement.pause();
                    audioSource.audioElement.currentTime = 0;
                } catch (e) {
                    // Element may already be stopped
                }
            }
            // Reset gain node immediately (fade should have already completed)
            if (audioSource.gainNode) {
                const now = this.audioContext.currentTime;
                audioSource.gainNode.gain.cancelScheduledValues(now);
                audioSource.gainNode.gain.value = 0;
            }
        });
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.masterGainNode.gain.value = this.masterVolume;

        // Update all audio source volumes (spatial system will override during hover)
        this.audioSources.forEach(audioSource => {
            if (!audioSource.muted) {
                const hasSolo = this.audioSources.some(s => s.solo);
                const shouldPlay = !hasSolo || audioSource.solo;
                // Only set base volume if not using spatial (mouse off canvas)
                if (this.mousePos.x < 0 || this.mousePos.y < 0) {
                    audioSource.gainNode.gain.value = shouldPlay ? audioSource.volume * this.masterVolume : 0;
                }
                // Otherwise, spatial system will handle it
            } else {
                audioSource.gainNode.gain.value = 0;
            }
        });
    }

    setAudioVolume(index, volume) {
        if (index < 0 || index >= this.audioSources.length) return;
        
        const audioSource = this.audioSources[index];
        if (!audioSource) return;
        
        audioSource.volume = Math.max(0, Math.min(1, volume));
        
        // Only set gain if gainNode exists
        if (audioSource.gainNode) {
            if (!audioSource.muted) {
                const hasSolo = this.audioSources.some(s => s.solo);
                const shouldPlay = !hasSolo || audioSource.solo;
                audioSource.gainNode.gain.value = shouldPlay ? audioSource.volume * this.masterVolume : 0;
            }
        }
    }

    setAudioPan(index, pan) {
        if (index < 0 || index >= this.audioSources.length) return;
        
        const audioSource = this.audioSources[index];
        if (!audioSource) return;
        
        audioSource.pan = Math.max(-1, Math.min(1, pan));
        
        // Only set pan if pannerNode exists and is a stereo panner (has .pan property)
        // 3D panners (HRTF) don't have .pan - they use 3D positioning instead
        if (audioSource.pannerNode && audioSource.pannerNode.pan !== undefined) {
            audioSource.pannerNode.pan.value = audioSource.pan;
        }
    }

    setAudioMute(index, muted) {
        if (index < 0 || index >= this.audioSources.length) return;
        
        const audioSource = this.audioSources[index];
        if (!audioSource) return;
        
        audioSource.muted = muted;
        
        // Update volume only if gainNode exists
        if (audioSource.gainNode) {
            const hasSolo = this.audioSources.some(s => s.solo);
            const shouldPlay = !muted && (!hasSolo || audioSource.solo);
            
            audioSource.gainNode.gain.value = shouldPlay ? audioSource.volume * this.masterVolume : 0;
        }
        
        // If playing and now muted, pause the element; if unmuted, resume it
        if (this.isPlaying) {
            if (muted && audioSource.audioElement && !audioSource.audioElement.paused) {
                audioSource.audioElement.pause();
            } else if (!muted && shouldPlay && audioSource.audioElement && audioSource.audioElement.paused) {
                this.playAudioSource(audioSource, this.currentTime);
            }
        }
    }

    setAudioSolo(index, solo) {
        if (index < 0 || index >= this.audioSources.length) return;
        
        const audioSource = this.audioSources[index];
        audioSource.solo = solo;

            // Update all sources based on solo state
            const hasSolo = this.audioSources.some(s => s.solo);
            
            if (this.isPlaying) {
                // Restart all audio sources to apply solo state
                this.audioSources.forEach(source => {
                    const shouldPlay = !source.muted && (!hasSolo || source.solo);
                    if (shouldPlay && source.audioElement.paused) {
                        this.playAudioSource(source, this.currentTime);
                    } else if (!shouldPlay && !source.audioElement.paused) {
                        source.audioElement.pause();
                    }
                    source.gainNode.gain.value = shouldPlay ? source.volume * this.masterVolume : 0;
                });
            } else {
                // Just update gain values
                this.audioSources.forEach(source => {
                    const shouldPlay = !source.muted && (!hasSolo || source.solo);
                    source.gainNode.gain.value = shouldPlay ? source.volume * this.masterVolume : 0;
                });
            }
    }

    startUpdateLoop() {
        this.updateInterval = setInterval(() => {
            if (this.isPlaying && !this._seeking) {
                this.currentTime = this.videoElement.currentTime;
                
                // Sync audio if it drifts (every 500ms)
                if (Math.random() < 0.1) { // ~10% chance per update = roughly every 500ms
                    this.syncAudio();
                }
            }
        }, 50); // Update every 50ms
    }

    updatePositionReadout() {
        const listenerXEl = document.getElementById('listenerX');
        const listenerYEl = document.getElementById('listenerY');
        const sourcesListEl = document.getElementById('sourcesList');
        
        if (!listenerXEl || !listenerYEl || !sourcesListEl) {
            return; // Position readout elements not found
        }

        // Get effective listener position (center if outside video bounds)
        const listenerPos = this.getEffectiveListenerPosition();
        
        // Update listener (cursor) position
        if (this.canvas) {
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const relativeX = listenerPos.x - centerX;
            const relativeY = listenerPos.y - centerY;
            
            // Show indicator if outside video bounds
            const isOutsideBounds = !this.isPositionInVideoBounds(this.mousePos.x, this.mousePos.y);
            const indicator = isOutsideBounds ? ' [CENTER]' : '';
            
            listenerXEl.textContent = `${Math.round(listenerPos.x)} (${relativeX >= 0 ? '+' : ''}${Math.round(relativeX)})${indicator}`;
            listenerYEl.textContent = `${Math.round(listenerPos.y)} (${relativeY >= 0 ? '+' : ''}${Math.round(relativeY)})${indicator}`;
        } else {
            listenerXEl.textContent = Math.round(listenerPos.x);
            listenerYEl.textContent = Math.round(listenerPos.y);
        }

        // Update sources list
        if (this.audioSources && this.audioSources.length > 0) {
            sourcesListEl.innerHTML = '';
            this.audioSources.forEach((source, index) => {
                const centerX = this.canvas ? this.canvas.width / 2 : 0;
                const centerY = this.canvas ? this.canvas.height / 2 : 0;
                const relativeX = source.x - centerX;
                const relativeY = source.y - centerY;
                
                const item = document.createElement('div');
                item.className = 'position-readout-item';
                item.innerHTML = `
                    <span class="position-readout-label">${source.name || `Source ${index + 1}`}:</span>
                    <span class="position-readout-value">X:${Math.round(source.x)} (${relativeX >= 0 ? '+' : ''}${Math.round(relativeX)}) Y:${Math.round(source.y)} (${relativeY >= 0 ? '+' : ''}${Math.round(relativeY)})</span>
                `;
                sourcesListEl.appendChild(item);
            });
        } else {
            sourcesListEl.innerHTML = '<div class="position-readout-item"><span class="position-readout-label" style="opacity: 0.5;">No sources</span></div>';
        }
    }

    startAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        let lastVolumeUpdate = 0;
        let lastPositionUpdate = 0;
        
        const animate = (currentTime) => {
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;

            // Update physics
            if (this.physicsEnabled && this.audioSources && this.audioSources.length > 0 && this.physicsStrength > 0) {
                this.updatePhysics(deltaTime);
            }

            // Update audio volumes (throttled)
            if (currentTime - lastVolumeUpdate > 16) {
                if (this.audioSources && this.audioSources.length > 0) {
                    this.updateSpatialVolumes();
                }
                lastVolumeUpdate = currentTime;
            }

            // Update position readout (throttled to ~30fps for performance)
            if (currentTime - lastPositionUpdate > 33) {
                this.updatePositionReadout();
                lastPositionUpdate = currentTime;
            }

            // Draw
            this.drawSpatialCanvas();

            this.animationFrameId = requestAnimationFrame(animate);
        };
        
        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame(animate);
    }

    calculateDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Get fade radius scaled to video display area
    getScaledFadeRadius() {
        if (!this.videoDisplayArea || this.videoDisplayArea.width === 0 || !this.videoWidth) {
            // Fallback to fixed pixel value if video not loaded
            return this.fadeRadius;
        }
        
        // Scale fade radius based on video display area width
        // fadeRadiusVideoRelative is a fraction of video width (e.g., 0.5 = 50% of video width)
        return this.videoDisplayArea.width * this.fadeRadiusVideoRelative;
    }
    
    calculateVolumeForSource(source) {
        // Use effective listener position (center if outside video bounds)
        const listenerPos = this.getEffectiveListenerPosition();
        const distance = this.calculateDistance(source.x, source.y, listenerPos.x, listenerPos.y);
        
        // Use scaled fade radius for consistent experience across screen sizes
        const scaledFadeRadius = this.getScaledFadeRadius();
        
        if (distance >= scaledFadeRadius) {
            return 0;
        }

        // At center (distance 0), return boosted original volume
        // Linear fade from boosted volume at distance 0 to 0 at fadeRadius
        if (distance === 0) {
            return source.volume * this.centerVolumeBoost; // Boosted volume at center sweet spot
        }
        
        // Apply boost that fades out smoothly as distance increases
        const distanceRatio = distance / scaledFadeRadius;
        const baseVolume = source.volume * (1 - distanceRatio);
        // Boost factor decreases linearly with distance (full boost at center, no boost at fadeRadius)
        const boostFactor = 1 + (this.centerVolumeBoost - 1) * (1 - distanceRatio);
        return baseVolume * boostFactor;
    }

    // Check if position is within video display area bounds
    isPositionInVideoBounds(x, y) {
        if (!this.videoDisplayArea || this.videoDisplayArea.width === 0) {
            // If video not loaded, allow full canvas interaction
            return true;
        }
        
        return x >= this.videoDisplayArea.x && 
               x <= (this.videoDisplayArea.x + this.videoDisplayArea.width) &&
               y >= this.videoDisplayArea.y && 
               y <= (this.videoDisplayArea.y + this.videoDisplayArea.height);
    }
    
    // Get effective listener position (center if outside video bounds)
    getEffectiveListenerPosition() {
        if (!this.videoDisplayArea || this.videoDisplayArea.width === 0) {
            // Fallback to canvas center if video not loaded
            return {
                x: this.canvas ? this.canvas.width / 2 : 0,
                y: this.canvas ? this.canvas.height / 2 : 0
            };
        }
        
        // Check if mouse is within video bounds
        if (this.isPositionInVideoBounds(this.mousePos.x, this.mousePos.y)) {
            return { x: this.mousePos.x, y: this.mousePos.y };
        } else {
            // Return center of video display area (sweet spot)
            return {
                x: this.videoDisplayArea.x + (this.videoDisplayArea.width / 2),
                y: this.videoDisplayArea.y + (this.videoDisplayArea.height / 2)
            };
        }
    }

    updateSpatialVolumes() {
        if (!this.audioSources || this.audioSources.length === 0) return;
        
        // Get effective listener position (center if outside video bounds)
        const listenerPos = this.getEffectiveListenerPosition();
        
        this.audioSources.forEach(source => {
            // Get audio level for reactivity - INCREASED sensitivity and FIXED
            if (source.analyserNode && source.analyserDataArray && this.isPlaying && !source.muted && source.audioElement && !source.audioElement.paused) {
                try {
                    source.analyserNode.getByteFrequencyData(source.analyserDataArray);
                    
                    // Calculate average audio level with more emphasis on higher frequencies
                    let sum = 0;
                    let weightedSum = 0;
                    let maxValue = 0;
                    for (let i = 0; i < source.analyserDataArray.length; i++) {
                        const value = source.analyserDataArray[i];
                        sum += value;
                        maxValue = Math.max(maxValue, value);
                        // Weight higher frequencies more (they're more audible)
                        const weight = 1 + (i / source.analyserDataArray.length) * 0.5;
                        weightedSum += value * weight;
                    }
                    const average = sum / source.analyserDataArray.length;
                    const weightedAverage = weightedSum / (source.analyserDataArray.length * 1.25); // Normalize weighted sum
                    
                    // Use both average and max for more reactive response
                    const audioLevel = Math.min(1.0, Math.max(
                        (weightedAverage / 255) * 2.0, // Boost sensitivity more
                        (maxValue / 255) * 1.5 // Also use peak values
                    ));
                    
                // Immediate audio level (no smoothing for instant reactivity)
                source.audioLevel = audioLevel;
                if (source.smoothedAudioLevel === undefined) {
                    source.smoothedAudioLevel = 0;
                }
                source.smoothedAudioLevel = audioLevel; // Immediate, no smoothing
                } catch (e) {
                    // Analyser might not be ready yet - immediate fade out
                    if (source.smoothedAudioLevel === undefined) {
                        source.smoothedAudioLevel = 0;
                    }
                    source.smoothedAudioLevel = 0; // Immediate fade out, no smoothing
                }
            } else {
                // No audio playing, immediate fade out
                if (source.smoothedAudioLevel === undefined) {
                    source.smoothedAudioLevel = 0;
                }
                source.smoothedAudioLevel = 0; // Immediate fade out, no smoothing
            }
            
            // Calculate target volume based on mouse proximity
            const targetVolume = this.calculateVolumeForSource(source);
            source.targetVolume = targetVolume;

            // Smooth volume transition
            const volumeDiff = targetVolume - source.currentVolume;
            source.currentVolume += volumeDiff * (this.fadeSpeed * 0.1); // Smooth transition

            // Apply volume (but respect mute/solo)
            const hasSolo = this.audioSources.some(s => s.solo);
            const shouldPlay = !source.muted && (!hasSolo || source.solo);
            
            if (shouldPlay) {
                // Apply spatial volume to the base volume (but respect fade state)
                const now = this.audioContext.currentTime;
                const effectiveVolume = source.currentVolume * this.masterVolume;
                
                // During fade in/out, don't override scheduled gains
                if (this._fadingIn || this._fadingOut) {
                    // Check if fade is still in progress
                    if (now < this._fadeEndTime) {
                        // During fade out, don't override - let it fade to 0
                        if (this._fadingOut) {
                            return; // Skip spatial updates during fade out
                        }
                        // During fade in, continue to update target but use linear ramp to blend
                        // This allows spatial adjustments during fade without abrupt changes
                        source.gainNode.gain.cancelScheduledValues(now);
                        const currentGain = source.gainNode.gain.value;
                        source.gainNode.gain.setValueAtTime(currentGain, now);
                        source.gainNode.gain.linearRampToValueAtTime(
                            Math.max(0, Math.min(1, effectiveVolume)),
                            this._fadeEndTime
                        );
                    } else {
                        // Fade completed, clear flags
                        this._fadingIn = false;
                        this._fadingOut = false;
                        // Continue with normal operation
                        source.gainNode.gain.value = Math.max(0, Math.min(1, effectiveVolume));
                    }
                } else {
                    // Normal operation: update gain directly
                    source.gainNode.gain.value = Math.max(0, Math.min(1, effectiveVolume));
                }
                
                // Update reverb sends if enabled
                if (source.reverbGain) {
                    source.reverbGain.gain.value = this.reverbAmount * 0.2 * source.currentVolume;
                }
                if (source.dryGain) {
                    source.dryGain.gain.value = 0.9 * source.currentVolume;
                }
            } else {
                // Mute reverb sends too
                if (source.reverbGain) {
                    source.reverbGain.gain.value = 0;
                }
                if (source.dryGain) {
                    source.dryGain.gain.value = 0;
                }
            }

            // Update spatial 3D positioning (always update if spatial audio enabled)
            if (this.spatialAudioEnabled && source.pannerNode) {
                this.updateSpatialPosition(source);
            }
        });
    }

    getSourceAtPosition(x, y) {
        const hitRadius = 25;
        for (let i = this.audioSources.length - 1; i >= 0; i--) {
            const source = this.audioSources[i];
            const distance = this.calculateDistance(source.x, source.y, x, y);
            if (distance <= hitRadius) {
                return source;
            }
        }
        return null;
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // First check if clicking on an annotation
        const activeAnnotations = this.getAnnotationsAtTime(this.currentTime);
        const normalizedX = x / rect.width;
        const normalizedY = y / rect.height;
        
        for (const ann of activeAnnotations) {
            if (!ann.visible) continue;
            
            // Check if click is near annotation position (within reasonable distance)
            const distance = Math.sqrt(
                Math.pow(normalizedX - ann.position.x, 2) + 
                Math.pow(normalizedY - ann.position.y, 2)
            );
            
            // Check if click is within annotation bounds (estimate based on text size)
            const fontSize = ann.fontSize || (ann.style === 'title' ? 32 : ann.style === 'subtitle' ? 24 : ann.style === 'info' ? 16 : 20);
            const padding = ann.padding !== undefined ? ann.padding : 16;
            const estimatedWidth = Math.max(100, (ann.title || ann.text || '').length * fontSize * 0.6);
            const estimatedHeight = fontSize * 1.5;
            const clickRadius = Math.max(estimatedWidth, estimatedHeight) / 2 / rect.width;
            
            if (distance < clickRadius + 0.05) { // Add some padding for easier clicking
                this.draggedAnnotation = ann;
                this.dragOffset = { x: normalizedX - ann.position.x, y: normalizedY - ann.position.y };
                this.canvas.style.cursor = 'grabbing';
                e.preventDefault();
                return; // Don't check for audio sources if we're dragging an annotation
            }
        }
        
        // Check for audio source dragging
        const clickedSource = this.getSourceAtPosition(x, y);
        if (clickedSource) {
            this.draggedSource = clickedSource;
            this.dragOffset.x = x - clickedSource.x;
            this.dragOffset.y = y - clickedSource.y;
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    }

    handleMouseMove(e) {
        if (this.draggedSource) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.draggedSource.x = x - this.dragOffset.x;
            this.draggedSource.y = y - this.dragOffset.y;
            this.draggedSource.baseX = this.draggedSource.x;
            this.draggedSource.baseY = this.draggedSource.y;
            // Update position readout when dragging
            this.updatePositionReadout();
        } else if (this.draggedSource) {
            // Dragging an audio source - update canvas position and convert to video-relative
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            // Update canvas position
            this.draggedSource.x = x - this.dragOffset.x;
            this.draggedSource.y = y - this.dragOffset.y;
            
            // Convert to video-relative position and clamp to video bounds
            const videoPos = this.canvasToVideoPosition(this.draggedSource.x, this.draggedSource.y);
            this.draggedSource.videoX = videoPos.x;
            this.draggedSource.videoY = videoPos.y;
            
            // Update base position
            this.draggedSource.baseX = this.draggedSource.x;
            this.draggedSource.baseY = this.draggedSource.y;
            
            // Update position readout when dragging
            this.updatePositionReadout();
        } else if (this.draggedAnnotation) {
            // Dragging an annotation
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const normalizedX = Math.max(0, Math.min(1, x / rect.width));
            const normalizedY = Math.max(0, Math.min(1, y / rect.height));
            this.draggedAnnotation.position.x = normalizedX;
            this.draggedAnnotation.position.y = normalizedY;
            // Trigger update
            this.onAnnotationsChanged?.();
        } else {
            // Check for tooltip hover on annotations and update cursor
            const isHoveringAnnotation = this.checkTooltipHover(e.clientX, e.clientY);
            
            // Update cursor based on hover state
            if (isHoveringAnnotation && this.hoveredAnnotation) {
                this.canvas.style.cursor = 'move';
            } else if (!this.draggedSource && !this.draggedAnnotation) {
                this.canvas.style.cursor = 'crosshair';
            }
        }
    }

    handleMouseUp(e) {
        if (this.draggedSource) {
            this.draggedSource = null;
            this.canvas.style.cursor = 'crosshair';
        }
        if (this.draggedAnnotation) {
            this.draggedAnnotation = null;
            this.canvas.style.cursor = 'crosshair';
        }
    }

    handleTouchStart(x, y) {
        const clickedSource = this.getSourceAtPosition(x, y);
        
        if (clickedSource) {
            this.draggedSource = clickedSource;
            this.dragOffset.x = x - clickedSource.x;
            this.dragOffset.y = y - clickedSource.y;
            this.canvas.style.cursor = 'grabbing';
        }
    }

    handleTouchMove(x, y) {
        if (this.draggedSource) {
            // Update canvas position
            this.draggedSource.x = x - this.dragOffset.x;
            this.draggedSource.y = y - this.dragOffset.y;
            
            // Convert to video-relative position and clamp to video bounds
            const videoPos = this.canvasToVideoPosition(this.draggedSource.x, this.draggedSource.y);
            this.draggedSource.videoX = videoPos.x;
            this.draggedSource.videoY = videoPos.y;
            
            // Update base position
            this.draggedSource.baseX = this.draggedSource.x;
            this.draggedSource.baseY = this.draggedSource.y;
            
            // Update position readout when dragging
            this.updatePositionReadout();
        } else if (this.draggedAnnotation) {
            const normalizedX = Math.max(0, Math.min(1, x / this.canvas.width));
            const normalizedY = Math.max(0, Math.min(1, y / this.canvas.height));
            this.draggedAnnotation.position.x = normalizedX;
            this.draggedAnnotation.position.y = normalizedY;
            this.onAnnotationsChanged?.();
        }
    }

    handleTouchEnd() {
        if (this.draggedSource) {
            this.draggedSource = null;
            this.canvas.style.cursor = 'crosshair';
        }
        if (this.draggedAnnotation) {
            this.draggedAnnotation = null;
            this.canvas.style.cursor = 'crosshair';
        }
    }

    updatePhysics(deltaTime) {
        if (!this.physicsEnabled || this.physicsStrength === 0) return;
        if (!this.audioSources || this.audioSources.length === 0) return;

        const dt = Math.min(deltaTime / 16.67, 2); // Normalize to ~60fps
        
        if (!dt || dt <= 0 || !isFinite(dt)) return;

        this.audioSources.forEach(source => {
            // Skip physics for sources being dragged
            if (source === this.draggedSource) {
                source.vx = 0;
                source.vy = 0;
                return;
            }

            // Random drift movement
            const driftRadius = 30 * this.driftStrength * this.physicsStrength;
            source.driftAngle += 0.01 * source.driftSpeed * dt;
            const targetX = source.baseX + Math.cos(source.driftAngle) * driftRadius;
            const targetY = source.baseY + Math.sin(source.driftAngle) * driftRadius;

            // Orbital movement around cursor (mouse position always valid now)
            if (this.orbitalStrength > 0) {
                const dx = source.x - this.mousePos.x;
                const dy = source.y - this.mousePos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);

                if (distance > 0) {
                    source.orbitalAngle = angle;

                    // Gravitational attraction toward preferred orbital radius
                    const preferredRadius = source.orbitalRadius;
                    const radiusDiff = distance - preferredRadius;
                    const gravitationalForce = (radiusDiff / preferredRadius) * this.orbitalStrength * this.physicsStrength * 0.3;
                    
                    source.vx -= Math.cos(angle) * gravitationalForce * dt;
                    source.vy -= Math.sin(angle) * gravitationalForce * dt;

                    // Angular velocity for orbital motion
                    const tangentialForce = this.orbitalSpeed * source.orbitalSpeed * source.orbitalDirection * this.orbitalStrength * this.physicsStrength;
                    const tangentialAngle = angle + Math.PI / 2;
                    source.vx += Math.cos(tangentialAngle) * tangentialForce * dt * (distance / preferredRadius);
                    source.vy += Math.sin(tangentialAngle) * tangentialForce * dt * (distance / preferredRadius);

                    // Close-range repulsion
                    const minDistance = 40;
                    if (distance < minDistance && this.mouseRepulsion > 0) {
                        const repulsionForce = (1 - distance / minDistance) * this.mouseRepulsion * this.physicsStrength;
                        const pushForce = repulsionForce * 0.5 * dt;
                        source.vx += Math.cos(angle) * pushForce;
                        source.vy += Math.sin(angle) * pushForce;
                    }
                }
            }

            // Source-to-source repulsion
            if (this.sourceRepulsion > 0) {
                this.audioSources.forEach(otherSource => {
                    if (otherSource === source || otherSource === this.draggedSource) return;

                    const dx = source.x - otherSource.x;
                    const dy = source.y - otherSource.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < this.sourceRepulsionRadius && distance > 0) {
                        const normalizedDistance = distance / this.sourceRepulsionRadius;
                        const force = (1 - normalizedDistance) * this.sourceRepulsion * this.physicsStrength;
                        const angle = Math.atan2(dy, dx);
                        const pushForce = force * 0.3 * dt;
                        source.vx += Math.cos(angle) * pushForce;
                        source.vy += Math.sin(angle) * pushForce;
                    }
                });
            }

            // Spring force back to drift position
            const springForce = 0.05 * this.physicsStrength;
            source.vx += (targetX - source.x) * springForce * dt;
            source.vy += (targetY - source.y) * springForce * dt;

            // Apply damping
            source.vx *= Math.pow(this.damping, dt);
            source.vy *= Math.pow(this.damping, dt);

            // Update position
            if (this.physicsEnabled && this.physicsStrength > 0) {
                source.x += source.vx * dt;
                source.y += source.vy * dt;
            }
            
            // Convert to video-relative position and clamp to video bounds (0-1)
            const videoPos = this.canvasToVideoPosition(source.x, source.y);
            let clampedVideoX = Math.max(0, Math.min(1, videoPos.x));
            let clampedVideoY = Math.max(0, Math.min(1, videoPos.y));
            
            // Bounce if hit boundary
            if (videoPos.x !== clampedVideoX) {
                source.vx *= -0.5;
            }
            if (videoPos.y !== clampedVideoY) {
                source.vy *= -0.5;
            }
            
            source.videoX = clampedVideoX;
            source.videoY = clampedVideoY;
            
            // Convert back to canvas position (ensures we're within video bounds)
            const canvasPos = this.videoToCanvasPosition(source.videoX, source.videoY);
            source.x = canvasPos.x;
            source.y = canvasPos.y;
        });
    }

    updateSpatialPosition(source) {
        if (!source.pannerNode || !this.audioContext) return;

        // Use effective listener position (center if outside video bounds)
        const listenerPos = this.getEffectiveListenerPosition();
        
        // Calculate relative position from listener to source
        const dx = source.x - listenerPos.x;
        const dy = source.y - listenerPos.y;
        
        // Map canvas coordinates to 3D audio space
        const pixelsPerUnit = 2;
        const x3d = (-dx / pixelsPerUnit) * this.spatialAudioStrength;
        const y3d = 0; // Sources are on same plane
        const z3d = (-dy / pixelsPerUnit) * this.spatialAudioStrength;

        // Set 3D position
        const panner = source.pannerNode;
        if (panner.positionX) {
            // Modern API
            panner.positionX.value = x3d;
            panner.positionY.value = y3d;
            panner.positionZ.value = z3d;
        } else if (panner.setPosition) {
            // Legacy API
            panner.setPosition(x3d, y3d, z3d);
        }
    }

    generateColorForIndex(index) {
        // All sources are white by default
        return 'rgba(255, 255, 255, 1)';
    }

    drawSpatialCanvas() {
        if (!this.canvas || !this.ctx) return;

        // Update animation time
        this.time += 0.016; // ~60fps

        // Clear canvas (transparent overlay) - use alpha for trail effect
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'; // Very subtle fade
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear for fresh frame

        if (!this.audioSources || this.audioSources.length === 0) return;

        // Get effective listener position (center if outside video bounds)
        const listenerPos = this.getEffectiveListenerPosition();

        // Update and draw ripples
        this.ripples = this.ripples.filter(ripple => {
            ripple.radius += ripple.speed;
            ripple.opacity *= 0.95;
            return ripple.radius < ripple.maxRadius && ripple.opacity > 0.01;
        });

        // Draw ripples (subtle wave effects)
        this.ripples.forEach(ripple => {
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.opacity * 0.15})`;
            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
            this.ctx.stroke();
        });

        // Draw cursor trail (fading trail behind cursor)
        if (this.cursorTrail.length > 1) {
            const now = Date.now();
            for (let i = 0; i < this.cursorTrail.length - 1; i++) {
                const point = this.cursorTrail[i];
                const nextPoint = this.cursorTrail[i + 1];
                const age = now - point.time;
                const maxAge = 800; // Trail fades over 800ms
                const opacity = Math.max(0, 1 - (age / maxAge)) * 0.3;
                
                if (opacity > 0.01) {
                    const progress = i / this.cursorTrail.length;
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                    this.ctx.lineWidth = 2 * (1 - progress); // Thinner as it trails
                    this.ctx.beginPath();
                    this.ctx.moveTo(point.x, point.y);
                    this.ctx.lineTo(nextPoint.x, nextPoint.y);
                    this.ctx.stroke();
                }
            }
        }

        // Draw subtle center position indicator (sweet spot / center reference)
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2; // Center of screen
        const centerIndicatorSize = 8;
        const centerPulse = 1 + Math.sin(this.time * 2) * 0.1; // Very subtle pulse
        
        // Outer ring (very subtle)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, centerIndicatorSize * centerPulse, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Crosshair lines (subtle)
        const crosshairLength = 12;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 0.5;
        this.ctx.setLineDash([2, 4]); // Dashed for subtlety
        
        // Horizontal line
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - crosshairLength, centerY);
        this.ctx.lineTo(centerX + crosshairLength, centerY);
        this.ctx.stroke();
        
        // Vertical line
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, centerY - crosshairLength);
        this.ctx.lineTo(centerX, centerY + crosshairLength);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]); // Reset
        
        // Center dot (very subtle)
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 2 * centerPulse, 0, Math.PI * 2);
        this.ctx.fill();

        // Only draw audio sources if enabled
        if (!this.showAudioSources) {
            // Still draw subtle visual feedback even when sources are hidden
            // Draw ripples and trail
            this.ripples.forEach(ripple => {
                this.ctx.strokeStyle = `rgba(255, 255, 255, ${ripple.opacity * 0.1})`;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
                this.ctx.stroke();
            });
            
            // Draw cursor trail
            if (this.cursorTrail.length > 1) {
                const now = Date.now();
                for (let i = 0; i < this.cursorTrail.length - 1; i++) {
                    const point = this.cursorTrail[i];
                    const nextPoint = this.cursorTrail[i + 1];
                    const age = now - point.time;
                    const maxAge = 800;
                    const opacity = Math.max(0, 1 - (age / maxAge)) * 0.15; // Even more subtle
                    
                    if (opacity > 0.01) {
                        const progress = i / this.cursorTrail.length;
                        this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
                        this.ctx.lineWidth = 1.5 * (1 - progress);
                        this.ctx.beginPath();
                        this.ctx.moveTo(point.x, point.y);
                        this.ctx.lineTo(nextPoint.x, nextPoint.y);
                        this.ctx.stroke();
                    }
                }
            }
            
            // Draw reactive indicators for audio source positions (when hidden) - TONED DOWN
            this.audioSources.forEach((source, index) => {
                const volume = this.calculateVolumeForSource(source);
                const isActive = volume > 0.01;
                
                // Get audio reactivity - direct audio level only, NO PULSE
                const audioReactivity = source.smoothedAudioLevel || 0;
                
                // Direct size variation based on audio level only (no pulse)
                const baseDotSize = isActive ? 4 : 2;
                const reactiveSize = audioReactivity * 5; // Direct size boost from audio level
                const dotSize = baseDotSize + reactiveSize;
                
                // Direct opacity based on audio level only (no pulse)
                const baseOpacity = isActive ? 0.4 : 0.2;
                const audioOpacity = audioReactivity * 0.6; // Direct audio contribution
                const dotOpacity = Math.min(1.0, baseOpacity + audioOpacity); // Immediate, no fade, no pulse
                
                // Draw reactive dot with subtle glow
                const dotColor = `rgba(255, 255, 255, ${dotOpacity})`;
                
                // Draw subtle outer glow (audio-reactive)
                if (audioReactivity > 0.15) {
                    const glowRadius = dotSize * (1.5 + audioReactivity * 0.8);
                    const glowOpacity = audioReactivity * 0.25;
                    const gradient = this.ctx.createRadialGradient(
                        source.x, source.y, dotSize,
                        source.x, source.y, glowRadius
                    );
                    gradient.addColorStop(0, `rgba(255, 255, 255, ${glowOpacity})`);
                    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${glowOpacity * 0.5})`);
                    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                    this.ctx.fillStyle = gradient;
                    this.ctx.beginPath();
                    this.ctx.arc(source.x, source.y, glowRadius, 0, Math.PI * 2);
                    this.ctx.fill();
                }
                
                // Draw main dot
                this.ctx.fillStyle = dotColor;
                this.ctx.beginPath();
                this.ctx.arc(source.x, source.y, dotSize, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Draw ring based on audio level only (no pulse)
                if (isActive && (volume > 0.15 || audioReactivity > 0.1)) {
                    const ringRadius = dotSize + 8 + audioReactivity * 10; // Direct audio-based radius
                    const ringOpacity = dotOpacity * 0.3;
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${ringOpacity})`;
                    this.ctx.lineWidth = 0.8 + audioReactivity * 2; // Direct audio-based width
                    this.ctx.beginPath();
                    this.ctx.arc(source.x, source.y, ringRadius, 0, Math.PI * 2);
                    this.ctx.stroke();
                }
            });
            
            // Draw center position indicator (sweet spot) even when sources are hidden
            // Use rounded values to ensure precise alignment (reuse centerX/Y from above)
            const centerIndicatorSize = 6;
            const centerPulse = 1 + Math.sin(this.time * 2) * 0.1;
            
            // Outer ring
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
            this.ctx.lineWidth = 0.8;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, centerIndicatorSize * centerPulse, 0, Math.PI * 2);
            this.ctx.stroke();
            
            // Subtle crosshair - ensure precise centering
            const crosshairLength = 8;
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            this.ctx.lineWidth = 0.5;
            this.ctx.setLineDash([2, 3]);
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - crosshairLength, centerY);
            this.ctx.lineTo(centerX + crosshairLength, centerY);
            this.ctx.moveTo(centerX, centerY - crosshairLength);
            this.ctx.lineTo(centerX, centerY + crosshairLength);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
            
            // Center dot - at exact center
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, 1.5 * centerPulse, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw cursor indicator (listener position dot)
            // Use effective listener position (center if outside video bounds)
            const listenerPos = this.getEffectiveListenerPosition();
            const cursorPulse = 1 + Math.sin(this.time * 3) * 0.15;
            
            // Draw cursor dot at listener position (center when outside video bounds)
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            this.ctx.beginPath();
            this.ctx.arc(listenerPos.x, listenerPos.y, 5 * cursorPulse, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw inner highlight
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.beginPath();
            this.ctx.arc(listenerPos.x, listenerPos.y, 2.5 * cursorPulse, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw subtle connecting lines (when hidden) - NO FADE RINGS
            this.audioSources.forEach((source, index) => {
                const volume = this.calculateVolumeForSource(source);
                const audioReactivity = source.smoothedAudioLevel || 0;
                
                // Draw audio-reactive connecting lines (direct audio level, no pulse)
                if (volume > 0.01) {
                    const lineOpacity = volume * 0.08 + audioReactivity * 0.15; // Direct audio-based opacity
                    const lineWidth = 0.8 + audioReactivity * 0.8; // Direct audio-based width
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.3, lineOpacity)})`; // Cap at 0.3 max
                    this.ctx.lineWidth = lineWidth;
                    this.ctx.setLineDash([]); // Solid lines
                    this.ctx.beginPath();
                    this.ctx.moveTo(listenerPos.x, listenerPos.y);
                    this.ctx.lineTo(source.x, source.y);
                    this.ctx.stroke();
                }
                
                // FADE RINGS REMOVED - no fade rings in hidden state
            });
            
            // Draw text overlays (annotations) - always visible even when sources are hidden
            this.drawTextOverlays(this.ctx);
            
            return;
        }

        // Draw audio sources
        this.audioSources.forEach((source, index) => {
            const distance = this.calculateDistance(source.x, source.y, this.mousePos.x, this.mousePos.y);
            
            const volume = this.calculateVolumeForSource(source);
            const isActive = volume > 0.01;
            const isDragging = this.draggedSource === source;
            
            // Simple pulse animation (no audio reactivity)
            if (!this.sourcePulse.has(index)) {
                this.sourcePulse.set(index, 0);
            }
            let pulsePhase = this.sourcePulse.get(index);
            
            // Simple pulse based on time only (not audio)
            pulsePhase += 0.05; // Constant pulse speed
            this.sourcePulse.set(index, pulsePhase);
            
            // Simple size variation (volume-based only, no audio reactivity)
            const volumePulse = 1 + Math.sin(pulsePhase * 0.5) * volume * 0.1;
            
            const baseRadius = 15;
            const radius = baseRadius * volumePulse + (isActive ? 3 : 0) + (isDragging ? 3 : 0);

            // Draw fade radius circle (no pulsing)
            if (isActive) {
                // Calculate fade radius scaled to video display area
                const scaledFadeRadius = this.getScaledFadeRadius();
                
                // Outer glow (very subtle)
                const glowOpacity = volume * 0.08;
                this.ctx.strokeStyle = `rgba(255, 255, 255, ${glowOpacity})`;
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.arc(source.x, source.y, scaledFadeRadius, 0, Math.PI * 2);
                this.ctx.stroke();
                
                // Inner radius indicator (even more subtle)
                const innerRadius = 50 + volume * 20;
                this.ctx.strokeStyle = `rgba(255, 255, 255, ${glowOpacity * 0.5})`;
                this.ctx.lineWidth = 0.5;
                this.ctx.beginPath();
                this.ctx.arc(source.x, source.y, innerRadius, 0, Math.PI * 2);
                this.ctx.stroke();
            }

            // Draw simple glow effect (volume-based only, no audio reactivity)
            if (isActive && volume > 0.2) {
                const glowIntensity = volume;
                const glowRadius = radius * (1.5 + glowIntensity * 0.5);
                
                // Simple white glow based on volume only
                const glowOpacity = glowIntensity * 0.2;
                const glowColor = `rgba(255, 255, 255, ${glowOpacity})`;
                
                // Radial gradient for glow
                const gradient = this.ctx.createRadialGradient(
                    source.x, source.y, radius,
                    source.x, source.y, glowRadius
                );
                gradient.addColorStop(0, glowColor);
                gradient.addColorStop(0.5, `rgba(255, 255, 255, ${glowOpacity * 0.5})`);
                gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(source.x, source.y, glowRadius, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Draw source circle (white, volume-based only, no audio reactivity)
            const circleOpacity = isActive ? 1.0 : 0.5;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${circleOpacity})`;
            this.ctx.beginPath();
            this.ctx.arc(source.x, source.y, radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Draw border (simple pulse, no audio reactivity)
            const borderPulse = Math.sin(pulsePhase * 2) * 0.1; // Simple pulse
            const borderOpacity = isDragging ? 1 : (isActive ? 0.8 + borderPulse : 0.6);
            const borderWidth = isDragging ? 3 : (isActive ? 2.5 : 2);
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${borderOpacity})`;
            this.ctx.lineWidth = borderWidth;
            this.ctx.stroke();

            // Draw label
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.font = '12px Poppins, sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(source.name || `Track ${source.id + 1}`, source.x, source.y + radius + 15);

            // Draw volume percentage
            if (isActive) {
                this.ctx.fillText(`${Math.round(volume * 100)}%`, source.x, source.y + radius + 30);
            }
        });

        // Draw mouse position indicator (listener/cursor) with subtle pulse and glow
        // Draw cursor at effective listener position (center if outside video bounds)
        const cursorPulse = 1 + Math.sin(this.time * 3) * 0.2; // Subtle breathing effect
        const cursorRadius = 6 * cursorPulse;
        
        // Outer glow ring
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(listenerPos.x, listenerPos.y, cursorRadius + 3, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // Main cursor dot (listener position) - ensure precise positioning
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.beginPath();
        this.ctx.arc(listenerPos.x, listenerPos.y, cursorRadius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Inner highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        this.ctx.beginPath();
        this.ctx.arc(listenerPos.x, listenerPos.y, cursorRadius * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Draw lines to active sources (volume-based only, no audio reactivity)
        this.audioSources.forEach(source => {
                const volume = this.calculateVolumeForSource(source);
                if (volume > 0.01) {
                    // White connecting lines (volume-based only)
                    const lineOpacity = volume * 0.3;
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${lineOpacity})`;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(listenerPos.x, listenerPos.y);
                    this.ctx.lineTo(source.x, source.y);
                    this.ctx.stroke();
                }
            });
        
        // Draw text overlays (annotations)
        this.drawTextOverlays(this.ctx);
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, (h / 360) + 1/3);
            g = hue2rgb(p, q, h / 360);
            b = hue2rgb(p, q, (h / 360) - 1/3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    }

    syncAudio() {
        if (!this.isPlaying) return;
        
        // Sync audio elements with video time
        const videoTime = this.videoElement?.currentTime || this.currentTime;
        
        // Sync video layers
        this.videoLayers.forEach(layer => {
            if (!layer.videoElement || !layer.visible) return;
            
            const expectedLayerTime = Math.max(0, videoTime - (layer.offset || 0));
            const actualLayerTime = layer.videoElement.currentTime;
            const layerDuration = layer.duration || Infinity;
            const timeDiff = Math.abs(expectedLayerTime - actualLayerTime);
            
            // If time difference is too large (>100ms), resync
            if (timeDiff > 0.1 && expectedLayerTime < layerDuration) {
                layer.videoElement.currentTime = expectedLayerTime;
            }
            
            // Check if layer ended prematurely but should still be playing
            if (expectedLayerTime < layerDuration) {
                if (layer.videoElement.ended || layer.videoElement.paused) {
                    layer.videoElement.currentTime = expectedLayerTime;
                    layer.videoElement.play().catch(err => {
                        if (err.name !== 'AbortError') {
                            console.error(`Error resuming video layer ${layer.id}:`, err);
                        }
                    });
                }
            } else if (layer.videoElement.currentTime >= layerDuration) {
                layer.videoElement.pause();
            }
        });
        
        // Sync audio sources
        this.audioSources.forEach(audioSource => {
            if (!audioSource.audioElement || audioSource.muted) return;
            
            const audioTime = audioSource.audioElement.currentTime;
            const audioDuration = audioSource.duration || Infinity;
            const timeDiff = Math.abs(videoTime - audioTime);
            
            // If time difference is too large (>100ms), resync
            if (timeDiff > 0.1 && videoTime < audioDuration) {
                audioSource.audioElement.currentTime = videoTime;
            }
            
            // Check if audio ended prematurely but should still be playing
            const hasSolo = this.audioSources.some(s => s.solo);
            const shouldPlay = !audioSource.muted && (!hasSolo || audioSource.solo);
            
            if (shouldPlay && videoTime < audioDuration) {
                if (audioSource.audioElement.ended || audioSource.audioElement.paused) {
                    this.playAudioSource(audioSource, videoTime);
                }
            }
        });
    }

    async loadConfig(config, onProgress) {
        try {
            // Load base video if specified
            if (config.video) {
                if (config.video.url) {
                    // Use URL directly for efficient loading (Cloudflare R2, etc.)
                    // Browser will use HTTP Range Requests automatically
                    if (onProgress) {
                        onProgress(-1, 0, `Loading base video from URL...`);
                    }
                    await this.loadVideo(config.video.url, { 
                        name: config.video.name || 'base-video',
                        preload: config.video.preload || 'metadata'
                    });
                } else if (config.video.file) {
                    // If file object is in config (unlikely but handle it)
                    await this.loadVideo(config.video.file);
                }
            }

            // Load video layers if specified
            if (config.videoLayers && Array.isArray(config.videoLayers)) {
                for (let i = 0; i < config.videoLayers.length; i++) {
                    const layerConfig = config.videoLayers[i];
                    if (onProgress) {
                        onProgress(-1, (i / config.videoLayers.length) * 50, `Loading video layer ${i + 1}/${config.videoLayers.length}...`);
                    }
                    
                    if (layerConfig.url) {
                        // Use URL directly for efficient loading (Cloudflare R2, etc.)
                        // Browser will use HTTP Range Requests automatically
                        const layerOptions = {
                            name: layerConfig.name || `layer-${i}`,
                            preload: layerConfig.preload || 'metadata',
                            opacity: layerConfig.opacity,
                            x: layerConfig.x,
                            y: layerConfig.y,
                            width: layerConfig.width,
                            height: layerConfig.height,
                            scaleX: layerConfig.scaleX,
                            scaleY: layerConfig.scaleY,
                            zIndex: layerConfig.zIndex !== undefined ? layerConfig.zIndex : i + 1,
                            visible: layerConfig.visible !== undefined ? layerConfig.visible : true,
                            offset: layerConfig.offset
                        };
                        
                        await this.addVideoLayer(layerConfig.url, layerOptions);
                    } else if (layerConfig.file) {
                        await this.addVideoLayer(layerConfig.file, layerConfig);
                    }
                }
            }

            // Load audio files
            if (config.audio && Array.isArray(config.audio)) {
                // Check if we have URLs (R2, etc.) or need to load files
                const hasUrls = config.audio.some(item => item.url && item.url.trim() !== '');
                
                if (hasUrls) {
                    // Load from URLs directly (more efficient - uses streaming)
                    // Clear existing audio sources first
                    this.stopAllAudio();
                    this.audioSources = [];
                    
                    for (let i = 0; i < config.audio.length; i++) {
                        const audioItem = config.audio[i];
                        if (audioItem.url && audioItem.url.trim() !== '') {
                            const progressCallback = onProgress ? (index, percent, message) => {
                                const overallPercent = (i / config.audio.length) * 50 + (percent / config.audio.length) * 50;
                                onProgress(i, overallPercent, message || `Loading ${audioItem.name || `audio ${i + 1}`} from URL...`);
                            } : null;
                            
                            // Pass object with url and name - loadAudioFile handles both File objects and URLs
                            // Use name from config if available, otherwise extract from URL
                            const fileToLoad = audioItem.name 
                                ? { url: audioItem.url, name: audioItem.name }
                                : audioItem.url;
                            const source = await this.loadAudioFile(fileToLoad, i, progressCallback);
                            
                            // Ensure source name is set (use config name if available)
                            if (audioItem.name) {
                                source.name = audioItem.name;
                            }
                            
                            this.audioSources.push(source);
                            
                            // Apply individual settings after source is fully loaded
                            // Settings are stored in the source object and will be applied when nodes are ready
                            // Store settings for later application
                            if (audioItem.volume !== undefined) {
                                source.volume = audioItem.volume;
                            }
                            if (audioItem.pan !== undefined) {
                                source.pan = audioItem.pan;
                            }
                            if (audioItem.muted !== undefined) {
                                source.muted = audioItem.muted;
                            }
                            
                            // Apply settings once nodes are ready (in next tick)
                            setTimeout(() => {
                                if (audioItem.volume !== undefined && source.gainNode) {
                                    this.setAudioVolume(i, audioItem.volume);
                                }
                                if (audioItem.pan !== undefined && source.pannerNode) {
                                    this.setAudioPan(i, audioItem.pan);
                                }
                                if (audioItem.muted !== undefined && source.gainNode) {
                                    this.setAudioMute(i, audioItem.muted);
                                }
                            }, 0);
                        }
                    }
                } else {
                    // Fallback: Load from file objects (for local files)
                    const audioFiles = [];
                    for (const audioItem of config.audio) {
                        if (audioItem.file) {
                            audioFiles.push(audioItem.file);
                        }
                    }
                    if (audioFiles.length > 0) {
                        await this.loadAudioFiles(audioFiles, onProgress);
                    }
                }
                
                // Apply settings from config
                if (config.settings) {
                    // Apply volumes and pans (if not already applied)
                    if (!hasUrls) {
                        config.audio.forEach((audioItem, index) => {
                            if (index < this.audioSources.length) {
                                if (audioItem.volume !== undefined) {
                                    this.setAudioVolume(index, audioItem.volume);
                                }
                                if (audioItem.pan !== undefined) {
                                    this.setAudioPan(index, audioItem.pan);
                                }
                                if (audioItem.muted !== undefined) {
                                    this.setAudioMute(index, audioItem.muted);
                                }
                            }
                        });
                    }

                    // Apply master volume
                    if (config.settings.masterVolume !== undefined) {
                        this.setMasterVolume(config.settings.masterVolume);
                    }
                    
                    // Apply spatial audio settings
                    if (config.settings.fadeRadiusVideoRelative !== undefined) {
                        this.fadeRadiusVideoRelative = config.settings.fadeRadiusVideoRelative;
                    }
                    if (config.settings.spatialAudioEnabled !== undefined) {
                        this.spatialAudioEnabled = config.settings.spatialAudioEnabled;
                    }
                    if (config.settings.spatialAudioStrength !== undefined) {
                        this.spatialAudioStrength = config.settings.spatialAudioStrength;
                    }
                    
                    // Apply physics settings
                    if (config.settings.physicsEnabled !== undefined) {
                        this.physicsEnabled = config.settings.physicsEnabled;
                    }
                    if (config.settings.physicsStrength !== undefined) {
                        this.physicsStrength = config.settings.physicsStrength;
                    }
                    if (config.settings.driftStrength !== undefined) {
                        this.driftStrength = config.settings.driftStrength;
                    }
                    if (config.settings.mouseRepulsion !== undefined) {
                        this.mouseRepulsion = config.settings.mouseRepulsion;
                    }
                    if (config.settings.sourceRepulsion !== undefined) {
                        this.sourceRepulsion = config.settings.sourceRepulsion;
                    }
                    if (config.settings.orbitalStrength !== undefined) {
                        this.orbitalStrength = config.settings.orbitalStrength;
                    }
                    
                    // Apply reverb settings
                    if (config.settings.reverbEnabled !== undefined) {
                        this.reverbEnabled = config.settings.reverbEnabled;
                    }
                    if (config.settings.reverbAmount !== undefined) {
                        this.reverbAmount = config.settings.reverbAmount;
                    }
                }
            }

            // Load image overlays if specified
            if (config.imageOverlays && Array.isArray(config.imageOverlays)) {
                this.imageOverlays = [];
                for (let i = 0; i < config.imageOverlays.length; i++) {
                    const overlayConfig = config.imageOverlays[i];
                    if (onProgress) {
                        onProgress(-1, 0, `Loading image overlay ${i + 1}/${config.imageOverlays.length}...`);
                    }
                    
                    if (overlayConfig.url) {
                        await this.addImageOverlay(overlayConfig.url, {
                            id: overlayConfig.id,
                            name: overlayConfig.name,
                            time: overlayConfig.time,
                            duration: overlayConfig.duration,
                            fadeDuration: overlayConfig.fadeDuration,
                            opacity: overlayConfig.opacity,
                            x: overlayConfig.x,
                            y: overlayConfig.y,
                            scaleX: overlayConfig.scaleX,
                            scaleY: overlayConfig.scaleY,
                            zIndex: overlayConfig.zIndex,
                            visible: overlayConfig.visible,
                            positionType: overlayConfig.positionType,
                            anchorX: overlayConfig.anchorX,
                            anchorY: overlayConfig.anchorY
                        });
                    }
                }
            }

            // Load annotations if specified
            if (config.annotations && Array.isArray(config.annotations)) {
                this.annotations = [];
                config.annotations.forEach(annConfig => {
                    this.addAnnotation(annConfig);
                });
            }

            console.log('✓ Configuration loaded');
        } catch (error) {
            console.error('Error loading configuration:', error);
            throw error;
        }
    }

    // Timeline Annotations Methods
    addAnnotation(annotation) {
        // Validate annotation structure
        if (!annotation.time || annotation.time < 0) {
            throw new Error('Annotation must have a valid time (>= 0)');
        }
        
        // Helper function to convert hex to rgba
        const hexToRgba = (hex, alpha = 1) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        };
        
        // Parse color - handle both hex and rgba
        const parseColor = (color, defaultColor) => {
            if (!color) return defaultColor;
            if (color.startsWith('#')) return color;
            return color;
        };
        
        const newAnnotation = {
            id: annotation.id || `annotation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            time: annotation.time, // Time in seconds when annotation appears
            duration: annotation.duration || 0, // Duration in seconds (0 = permanent until next annotation)
            title: annotation.title || '', // Title text to display
            text: annotation.text || '', // Body text/tooltip content
            tooltip: annotation.tooltip || annotation.text || '', // Tooltip text (hover)
            position: annotation.position || { x: 0.5, y: 0.5 }, // Position on canvas (0-1 normalized)
            style: annotation.style || 'default', // Style: 'default', 'title', 'subtitle', 'info'
            fontFamily: annotation.fontFamily || 'Poppins', // Font family
            color: parseColor(annotation.color, 'rgba(255, 255, 255, 0.9)'), // Text color
            backgroundColor: parseColor(annotation.backgroundColor, 'rgba(0, 0, 0, 0.7)'), // Background color
            // Default background opacity: 0 (no background) for all styles
            backgroundOpacity: annotation.backgroundOpacity !== undefined ? annotation.backgroundOpacity : 0,
            fontSize: annotation.fontSize || null, // Font size (null = auto)
            textAlign: annotation.textAlign || 'center', // Text alignment
            borderRadius: annotation.borderRadius !== undefined ? annotation.borderRadius : 0, // Border radius (0 = no border)
            padding: annotation.padding !== undefined ? annotation.padding : 16, // Padding
            showOnTimeline: annotation.showOnTimeline !== false, // Show marker on timeline
            timelineColor: annotation.timelineColor || 'rgba(255, 255, 255, 0.8)', // Timeline marker color
            visible: annotation.visible !== false // Whether annotation is visible
        };
        
        this.annotations.push(newAnnotation);
        this.annotations.sort((a, b) => a.time - b.time); // Sort by time
        
        // Trigger update event
        this.onAnnotationsChanged?.();
        
        return newAnnotation;
    }
    
    removeAnnotation(id) {
        const index = this.annotations.findIndex(a => a.id === id);
        if (index !== -1) {
            this.annotations.splice(index, 1);
            this.onAnnotationsChanged?.();
            return true;
        }
        return false;
    }
    
    updateAnnotation(id, updates) {
        const annotation = this.annotations.find(a => a.id === id);
        if (annotation) {
            Object.assign(annotation, updates);
            this.annotations.sort((a, b) => a.time - b.time); // Re-sort after update
            this.onAnnotationsChanged?.();
            return annotation;
        }
        return null;
    }
    
    getAnnotationsAtTime(time) {
        return this.annotations.filter(ann => {
            if (!ann.visible) return false;
            if (time < ann.time) return false;
            if (ann.duration > 0 && time > ann.time + ann.duration) return false;
            return true;
        });
    }
    
    getActiveAnnotation(time) {
        // Get the most recent annotation that's currently active
        const active = this.getAnnotationsAtTime(time);
        return active.length > 0 ? active[active.length - 1] : null;
    }
    
    initTooltip() {
        // Create tooltip element if it doesn't exist
        if (!this.tooltipElement) {
            this.tooltipElement = document.createElement('div');
            this.tooltipElement.id = 'annotationTooltip';
            this.tooltipElement.className = 'annotation-tooltip';
            this.tooltipElement.style.cssText = `
                position: absolute;
                pointer-events: none;
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.2s ease;
            `;
            document.body.appendChild(this.tooltipElement);
        }
    }
    
    showTooltip(text, x, y) {
        if (!this.tooltipElement) this.initTooltip();
        if (!text) {
            this.hideTooltip();
            return;
        }
        
        this.tooltipElement.textContent = text;
        
        // Position tooltip, keeping it within viewport
        const tooltipRect = this.tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let left = x + 10;
        let top = y + 10;
        
        // Adjust if tooltip would go off right edge
        if (left + tooltipRect.width > viewportWidth) {
            left = x - tooltipRect.width - 10;
        }
        
        // Adjust if tooltip would go off bottom edge
        if (top + tooltipRect.height > viewportHeight) {
            top = y - tooltipRect.height - 10;
        }
        
        // Ensure tooltip doesn't go off left or top edges
        left = Math.max(10, left);
        top = Math.max(10, top);
        
        this.tooltipElement.style.left = `${left}px`;
        this.tooltipElement.style.top = `${top}px`;
        this.tooltipElement.style.opacity = '1';
    }
    
    hideTooltip() {
        if (this.tooltipElement) {
            this.tooltipElement.style.opacity = '0';
        }
    }
    
    checkTooltipHover(mouseX, mouseY) {
        // Check if mouse is over any annotation marker on timeline or canvas
        const timelineElement = document.getElementById('timeline');
        const minimalTimeline = document.getElementById('minimalTimelineSlider');
        
        if (timelineElement) {
            const rect = timelineElement.getBoundingClientRect();
            const timelineX = mouseX - rect.left;
            const timelineProgress = timelineX / rect.width;
            const hoverTime = timelineProgress * this.duration;
            
            // Check for timeline markers
            const nearbyAnnotations = this.annotations.filter(ann => {
                if (!ann.visible || !ann.showOnTimeline) return false;
                const markerProgress = ann.time / this.duration;
                const distance = Math.abs(timelineProgress - markerProgress);
                return distance < 0.01; // Within 1% of timeline
            });
            
            if (nearbyAnnotations.length > 0) {
                const ann = nearbyAnnotations[0];
                if (ann.tooltip) {
                    this.showTooltip(ann.tooltip, mouseX, mouseY);
                    this.hoveredAnnotation = ann;
                    return true;
                }
            }
        }
        
        // Check canvas position annotations
        if (this.canvas) {
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = mouseX - rect.left;
            const canvasY = mouseY - rect.top;
            const normalizedX = canvasX / rect.width;
            const normalizedY = canvasY / rect.height;
            
            const activeAnnotations = this.getAnnotationsAtTime(this.currentTime);
            for (const ann of activeAnnotations) {
                const distance = Math.sqrt(
                    Math.pow(normalizedX - ann.position.x, 2) + 
                    Math.pow(normalizedY - ann.position.y, 2)
                );
                if (distance < 0.05) { // Within 5% of canvas
                    if (ann.tooltip) {
                        this.showTooltip(ann.tooltip, mouseX, mouseY);
                        this.hoveredAnnotation = ann;
                        return true;
                    }
                }
            }
        }
        
        this.hideTooltip();
        this.hoveredAnnotation = null;
        return false;
    }
    
    drawTimelineMarkers(ctx, timelineElement) {
        if (!timelineElement || !ctx) return;
        
        const rect = timelineElement.getBoundingClientRect();
        const timelineWidth = rect.width;
        
        this.annotations.forEach(ann => {
            if (!ann.visible || !ann.showOnTimeline || this.duration === 0) return;
            
            const progress = ann.time / this.duration;
            const x = rect.left + (progress * timelineWidth);
            
            // Draw marker line
            ctx.strokeStyle = ann.timelineColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, rect.top);
            ctx.lineTo(x, rect.bottom);
            ctx.stroke();
            
            // Draw marker dot
            ctx.fillStyle = ann.timelineColor;
            ctx.beginPath();
            ctx.arc(x, rect.top + (rect.height / 2), 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    drawTextOverlays(ctx) {
        if (!ctx || !this.canvas) return;
        
        const activeAnnotations = this.getAnnotationsAtTime(this.currentTime);
        const fadeDuration = 0.5; // Fade in/out duration in seconds
        
        activeAnnotations.forEach(ann => {
            if (!ann.visible) return;
            
            // Calculate fade opacity
            let opacity = 1.0;
            const timeSinceStart = this.currentTime - ann.time;
            
            if (ann.duration > 0) {
                // Fade in at start
                if (timeSinceStart < fadeDuration) {
                    opacity = Math.min(1.0, timeSinceStart / fadeDuration);
                }
                // Fade out at end
                const timeUntilEnd = (ann.time + ann.duration) - this.currentTime;
                if (timeUntilEnd < fadeDuration) {
                    opacity = Math.min(opacity, timeUntilEnd / fadeDuration);
                }
            } else {
                // Permanent annotation - fade in only
                if (timeSinceStart < fadeDuration) {
                    opacity = Math.min(1.0, timeSinceStart / fadeDuration);
                }
            }
            
            if (opacity <= 0) return; // Don't draw if completely faded
            
            const x = ann.position.x * this.canvas.width;
            const y = ann.position.y * this.canvas.height;
            
            // Determine font size
            const fontSize = ann.fontSize || 
                (ann.style === 'title' ? 32 : 
                 ann.style === 'subtitle' ? 24 : 
                 ann.style === 'info' ? 16 : 20);
            
            // Get font family (default to Poppins)
            const fontFamily = ann.fontFamily || 'Poppins';
            
            ctx.save();
            
            // Draw background if there's text
            if (ann.title || ann.text) {
                ctx.font = `${fontSize}px '${fontFamily}', sans-serif`;
                
                // Set text alignment
                const textAlign = ann.textAlign || 'center';
                ctx.textAlign = textAlign;
                ctx.textBaseline = 'middle';
                
                const lines = [];
                if (ann.title) lines.push(ann.title);
                if (ann.text && ann.text !== ann.title) lines.push(ann.text);
                
                if (lines.length === 0) {
                    ctx.restore();
                    return;
                }
                
                const lineHeight = fontSize * 1.2;
                const totalHeight = lines.length * lineHeight;
                const textWidths = lines.map(line => ctx.measureText(line).width);
                const maxWidth = Math.max(...textWidths);
                
                const padding = ann.padding !== undefined ? ann.padding : 0; // No padding by default (no background)
                const borderRadius = ann.borderRadius !== undefined ? ann.borderRadius : 0; // No border radius by default (no background)
                
                // Calculate background position based on text alignment
                let bgX, bgY, bgWidth, bgHeight;
                bgWidth = maxWidth + (padding * 2);
                bgHeight = totalHeight + (padding * 2);
                
                if (textAlign === 'center') {
                    bgX = x - (bgWidth / 2);
                } else if (textAlign === 'left') {
                    bgX = x;
                } else { // right
                    bgX = x - bgWidth;
                }
                bgY = y - (bgHeight / 2);
                
                // Parse background color and apply opacity
                let bgColor = ann.backgroundColor || 'rgba(0, 0, 0, 0.7)';
                const backgroundOpacity = ann.backgroundOpacity !== undefined ? ann.backgroundOpacity : 0; // No background by default
                const finalBackgroundOpacity = backgroundOpacity * opacity; // Apply fade opacity to background
                
                // Only draw background if opacity > 0
                if (finalBackgroundOpacity > 0) {
                    // If color is hex, convert to rgba with opacity
                    if (bgColor.startsWith('#')) {
                        const r = parseInt(bgColor.slice(1, 3), 16);
                        const g = parseInt(bgColor.slice(3, 5), 16);
                        const b = parseInt(bgColor.slice(5, 7), 16);
                        bgColor = `rgba(${r}, ${g}, ${b}, ${finalBackgroundOpacity})`;
                    } else if (bgColor.startsWith('rgba')) {
                        // Replace opacity in existing rgba
                        bgColor = bgColor.replace(/rgba\(([^)]+)\)/, (match, values) => {
                            const parts = values.split(',').map(v => v.trim());
                            return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${finalBackgroundOpacity})`;
                        });
                    } else if (bgColor.startsWith('rgb')) {
                        // Convert rgb to rgba
                        bgColor = bgColor.replace('rgb', 'rgba').replace(')', `, ${finalBackgroundOpacity})`);
                    }
                    
                    // Draw background with rounded corners
                    ctx.fillStyle = bgColor;
                ctx.beginPath();
                if (ctx.roundRect) {
                    ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
                } else {
                    // Fallback for browsers without roundRect
                    const radius = borderRadius;
                    ctx.moveTo(bgX + radius, bgY);
                    ctx.lineTo(bgX + bgWidth - radius, bgY);
                    ctx.quadraticCurveTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + radius);
                    ctx.lineTo(bgX + bgWidth, bgY + bgHeight - radius);
                    ctx.quadraticCurveTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - radius, bgY + bgHeight);
                    ctx.lineTo(bgX + radius, bgY + bgHeight);
                    ctx.quadraticCurveTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - radius);
                    ctx.lineTo(bgX, bgY + radius);
                    ctx.quadraticCurveTo(bgX, bgY, bgX + radius, bgY);
                    ctx.closePath();
                }
                    ctx.fill();
                }
                
                // Draw text with fade opacity
                let textColor = ann.color || 'rgba(255, 255, 255, 0.9)';
                // Apply fade opacity to text color
                if (textColor.startsWith('rgba')) {
                    textColor = textColor.replace(/rgba\(([^)]+)\)/, (match, values) => {
                        const parts = values.split(',').map(v => v.trim());
                        const originalAlpha = parseFloat(parts[3] || '0.9');
                        return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${originalAlpha * opacity})`;
                    });
                } else if (textColor.startsWith('rgb')) {
                    textColor = textColor.replace('rgb', 'rgba').replace(')', `, ${opacity})`);
                } else if (textColor.startsWith('#')) {
                    const r = parseInt(textColor.slice(1, 3), 16);
                    const g = parseInt(textColor.slice(3, 5), 16);
                    const b = parseInt(textColor.slice(5, 7), 16);
                    textColor = `rgba(${r}, ${g}, ${b}, ${opacity})`;
                }
                ctx.fillStyle = textColor;
                
                // Calculate text X position based on alignment
                let textX = x;
                if (textAlign === 'left') {
                    textX = x + padding;
                } else if (textAlign === 'right') {
                    textX = x - padding;
                }
                
                lines.forEach((line, index) => {
                    ctx.fillText(line, textX, y - (totalHeight / 2) + (index * lineHeight) + (lineHeight / 2));
                });
            }
            
            ctx.restore();
        });
    }

    exportConfig() {
        // Get video URL - prefer stored URL over blob URL
        let videoUrl = '';
        let videoName = 'Base Video';
        let videoPreload = 'metadata';
        
        if (this.videoElement && this.videoElement.src) {
            // Check if it's a blob URL (local file) or actual URL
            if (this.videoElement.src.startsWith('blob:') || this.videoElement.src.startsWith('file:')) {
                // For local files, try to get original file name or use placeholder
                videoUrl = '';
                videoName = this.videoElement.getAttribute('data-name') || 'Base Video';
            } else {
                videoUrl = this.videoElement.src;
                videoName = this.videoElement.getAttribute('data-name') || 'Base Video';
            }
        }
        
        // Get video preload setting
        if (this.videoElement) {
            videoPreload = this.videoElement.preload || 'metadata';
        }

        const config = {
            version: '1.0',
            video: {
                url: videoUrl,
                name: videoName,
                preload: videoPreload,
                duration: this.duration
            },
            videoLayers: this.videoLayers.map(layer => ({
                name: layer.name,
                url: layer.isUrl ? layer.url : '', // Only export URL if loaded from URL
                preload: layer.videoElement?.preload || 'metadata',
                opacity: layer.opacity,
                x: layer.x,
                y: layer.y,
                scaleX: layer.scaleX,
                scaleY: layer.scaleY,
                zIndex: layer.zIndex,
                visible: layer.visible,
                offset: layer.offset,
                duration: layer.duration
            })),
            imageOverlays: this.imageOverlays.map(overlay => ({
                id: overlay.id,
                name: overlay.name,
                url: overlay.url || '', // Export URL if loaded from URL
                time: overlay.time,
                duration: overlay.duration,
                fadeDuration: overlay.fadeDuration,
                opacity: overlay.opacity,
                x: overlay.x,
                y: overlay.y,
                scaleX: overlay.scaleX,
                scaleY: overlay.scaleY,
                zIndex: overlay.zIndex,
                visible: overlay.visible,
                positionType: overlay.positionType,
                anchorX: overlay.anchorX,
                anchorY: overlay.anchorY
            })),
            audio: this.audioSources.map(source => {
                // Prefer URL over blob URL - URLs are persistent (R2, etc.)
                let audioUrl = '';
                if (source.url && !source.url.startsWith('blob:') && !source.url.startsWith('file:')) {
                    // It's a real URL (R2, etc.) - use it
                    audioUrl = source.url;
                } else if (source.file) {
                    // Local file - store name but not blob URL (they expire)
                    audioUrl = '';
                }
                
                return {
                    name: source.name,
                    url: audioUrl,
                    volume: source.volume,
                    pan: source.pan,
                    muted: source.muted,
                    duration: source.duration
                };
            }),
            settings: {
                masterVolume: this.masterVolume,
                fadeRadiusVideoRelative: this.fadeRadiusVideoRelative,
                spatialAudioEnabled: this.spatialAudioEnabled,
                spatialAudioStrength: this.spatialAudioStrength,
                physicsEnabled: this.physicsEnabled,
                physicsStrength: this.physicsStrength,
                driftStrength: this.driftStrength,
                mouseRepulsion: this.mouseRepulsion,
                sourceRepulsion: this.sourceRepulsion,
                orbitalStrength: this.orbitalStrength,
                reverbEnabled: this.reverbEnabled,
                reverbAmount: this.reverbAmount
            },
            annotations: this.annotations.map(ann => ({
                id: ann.id,
                time: ann.time,
                duration: ann.duration,
                title: ann.title,
                text: ann.text,
                tooltip: ann.tooltip,
                position: ann.position,
                style: ann.style,
                fontFamily: ann.fontFamily,
                color: ann.color,
                backgroundColor: ann.backgroundColor,
                backgroundOpacity: ann.backgroundOpacity,
                fontSize: ann.fontSize,
                textAlign: ann.textAlign,
                borderRadius: ann.borderRadius,
                padding: ann.padding,
                showOnTimeline: ann.showOnTimeline,
                timelineColor: ann.timelineColor,
                visible: ann.visible
            }))
        };

        return config;
    }

    destroy() {
        // Clean up
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.videoCompositorFrameId) {
            cancelAnimationFrame(this.videoCompositorFrameId);
            this.videoCompositorFrameId = null;
        }
        
        this.stop();
        
        // Clean up video layers
        this.videoLayers.forEach(layer => {
            if (layer.videoElement) {
                layer.videoElement.pause();
                layer.videoElement.src = '';
                if (layer.url) {
                    URL.revokeObjectURL(layer.url);
                }
            }
        });
        this.videoLayers = [];
        
        // Clean up audio sources
        this.audioSources.forEach(audioSource => {
            if (audioSource.audioElement) {
                audioSource.audioElement.pause();
                audioSource.audioElement.src = '';
                if (audioSource.url) {
                    URL.revokeObjectURL(audioSource.url);
                }
            }
            if (audioSource.mediaSourceNode) {
                try {
                    audioSource.mediaSourceNode.disconnect();
                } catch (e) {
                    // Already disconnected
                }
            }
        });
        
        if (this.audioContext) {
            this.audioContext.close();
        }

        console.log('✓ AVSyncPlayer destroyed');
    }

    // Image Overlay Methods
    async addImageOverlay(fileOrUrl, options = {}) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = 'anonymous';

            const overlayId = options.id || `overlay-${Date.now()}-${Math.random()}`;
            const fileName = typeof fileOrUrl === 'string' ? fileOrUrl.split('/').pop() : fileOrUrl.name;

            image.onload = () => {
                const overlay = {
                    id: overlayId,
                    name: options.name || fileName,
                    image: image,
                    url: typeof fileOrUrl === 'string' ? fileOrUrl : null,
                    file: typeof fileOrUrl === 'object' && fileOrUrl instanceof File ? fileOrUrl : null,
                    time: options.time !== undefined ? options.time : 0, // Start time in seconds
                    duration: options.duration !== undefined ? options.duration : 0, // Duration (0 = permanent)
                    fadeDuration: options.fadeDuration !== undefined ? options.fadeDuration : 0.5, // Fade in/out duration
                    opacity: options.opacity !== undefined ? options.opacity : 1.0,
                    x: options.x !== undefined ? options.x : 0, // Offset from center or absolute position
                    y: options.y !== undefined ? options.y : 0,
                    scaleX: options.scaleX !== undefined ? options.scaleX : 1.0,
                    scaleY: options.scaleY !== undefined ? options.scaleY : 1.0,
                    zIndex: options.zIndex !== undefined ? options.zIndex : this.imageOverlays.length,
                    visible: options.visible !== undefined ? options.visible : true,
                    positionType: options.positionType || 'center', // 'center' or 'absolute'
                    anchorX: options.anchorX !== undefined ? options.anchorX : 0.5, // 0=left, 0.5=center, 1=right
                    anchorY: options.anchorY !== undefined ? options.anchorY : 0.5, // 0=top, 0.5=center, 1=bottom
                    isReady: true // Mark as ready
                };

                this.imageOverlays.push(overlay);
                console.log(`✓ Image overlay added: ${overlay.name} (${image.naturalWidth}x${image.naturalHeight})`);
                resolve(overlay);
            };

            image.onerror = () => {
                reject(new Error(`Failed to load image overlay: ${fileName}`));
            };

            // Load image from file or URL
            if (typeof fileOrUrl === 'string') {
                image.src = fileOrUrl;
            } else {
                const url = URL.createObjectURL(fileOrUrl);
                image.src = url;
            }
        });
    }

    removeImageOverlay(overlayId) {
        const index = this.imageOverlays.findIndex(o => o.id === overlayId);
        if (index !== -1) {
            const overlay = this.imageOverlays[index];
            // Clean up blob URL if exists
            if (overlay.file && overlay.url && overlay.url.startsWith('blob:')) {
                URL.revokeObjectURL(overlay.url);
            }
            this.imageOverlays.splice(index, 1);
            console.log(`✓ Image overlay removed: ${overlay.name}`);
            return true;
        }
        return false;
    }

    updateImageOverlay(overlayId, updates) {
        const overlay = this.imageOverlays.find(o => o.id === overlayId);
        if (overlay) {
            Object.assign(overlay, updates);
            console.log(`✓ Image overlay updated: ${overlay.name}`);
            return true;
        }
        return false;
    }
}

