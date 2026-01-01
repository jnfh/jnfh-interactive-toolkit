// Interactive Audio Hover Tool
// Places audio sources on a 2D plane and fades them based on mouse proximity

class InteractiveAudioHover {
    constructor() {
        this.audioContext = null;
        this.masterGainNode = null;
        this.sources = [];
        this.canvas = null;
        this.ctx = null;
        this.mousePos = { x: 0, y: 0 };
        this.isPlaying = false;
        this.fadeRadius = 500; // Max default
        this.fadeSpeed = 0.5; // Max default - seconds for fade transitions
        this.masterVolume = 1.0;
        this.animationFrameId = null;
        this.sourcePlacementMode = false;
        this.pendingAudioFiles = [];
        this.pendingAudioUrls = []; // Array for loading multiple audio URLs
        this.pendingWixCmsItems = []; // Array for Wix CMS items with url, title, color
        this.draggedSource = null;
        this.dragOffset = { x: 0, y: 0 };
        this.hoveredSource = null;
        
        // Physics settings - all maxed
        this.physicsEnabled = true;
        this.physicsStrength = 1.0; // Max default
        this.driftStrength = 1.0; // Max default
        this.mouseRepulsion = 1.0; // Max default
        this.sourceRepulsion = 1.0; // Max default
        this.sourceRepulsionRadius = 100; // Distance at which sources start repelling each other
        this.orbitalStrength = 1.0; // Max default
        this.orbitalRadius = 150; // Preferred orbital radius around cursor
        this.orbitalSpeed = 0.1; // Max default
        this.damping = 0.92; // Velocity damping (0-1, lower = more friction)
        this.lastTime = performance.now();
        
        // Spatial audio settings - all maxed
        this.spatialAudioEnabled = true;
        this.spatialAudioStrength = 1.0; // Max default
        this.reverbEnabled = true;
        this.reverbAmount = 1.0; // Max default
        this.maxDistance = 1000; // Maximum distance for 3D audio calculations
        this.convolverNode = null;
        this.reverbImpulse = null;
        this.reverbSendGain = null; // Shared reverb send gain node
        
        // Background color (default transparent)
        this.backgroundColor = 'transparent';
        this.backgroundTransparent = true;
        
        // Track if initialized
        this._initialized = false;
        
        // Don't auto-init - let caller decide when to initialize
        // this.init();
    }

    async init() {
        // Prevent double initialization
        if (this._initialized) {
            console.log('⚠️ Already initialized, skipping...');
            return;
        }
        
        try {
        await this.initAudioContext();
        this.initCanvas();
        this.setupEventListeners();
        this.startAnimationLoop();
            this._initialized = true;
            console.log('✓ InteractiveAudioHover initialized successfully');
        } catch (error) {
            console.error('❌ Error during initialization:', error);
            throw error;
        }
    }

    async initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.connect(this.audioContext.destination);
            this.masterGainNode.gain.value = this.masterVolume;
            
            // Set listener position and orientation
            // Listener should be at origin (0,0,0) - explicitly set it
            if (this.audioContext.listener) {
                // Set listener position to origin
                if (this.audioContext.listener.positionX !== undefined) {
                    // Modern API
                    this.audioContext.listener.positionX.value = 0;
                    this.audioContext.listener.positionY.value = 0;
                    this.audioContext.listener.positionZ.value = 0;
                    
                    // Set listener orientation (facing forward/up)
                    this.audioContext.listener.forwardX.value = 0;
                    this.audioContext.listener.forwardY.value = 0;
                    this.audioContext.listener.forwardZ.value = -1; // Facing forward (negative Z)
                    this.audioContext.listener.upX.value = 0;
                    this.audioContext.listener.upY.value = 1;
                    this.audioContext.listener.upZ.value = 0;
                } else if (this.audioContext.listener.setPosition) {
                    // Legacy API
                    this.audioContext.listener.setPosition(0, 0, 0);
                    this.audioContext.listener.setOrientation(0, 0, -1, 0, 1, 0);
                }
            }
            
            // Initialize reverb convolver (creates shared reverb send)
            await this.initReverb();
        } catch (error) {
            console.error('Error initializing audio context:', error);
            alert('Your browser does not support Web Audio API');
        }
    }

    async initReverb() {
        if (!this.audioContext || !this.reverbEnabled) return;
        
        try {
            // Create a simple reverb impulse response
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
            
            // Create shared reverb send gain node (all sources send to this)
            this.reverbSendGain = this.audioContext.createGain();
            this.reverbSendGain.gain.value = 0.25; // Overall reverb send level (reduced to prevent distortion)
            
            // Connect: reverbSendGain -> convolver -> masterGainNode (only once!)
            this.reverbSendGain.connect(this.convolverNode);
            this.convolverNode.connect(this.masterGainNode);
            
            console.log('✓ Reverb initialized with shared send/return');
        } catch (error) {
            console.error('Error initializing reverb:', error);
        }
    }

    initCanvas() {
        this.canvas = document.getElementById('audioCanvas');
        if (!this.canvas) {
            throw new Error('Canvas element with id "audioCanvas" not found in DOM');
        }
        
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            throw new Error('Failed to get 2D rendering context from canvas');
        }
        
        // Track previous canvas dimensions for responsive repositioning
        this.previousCanvasWidth = window.innerWidth;
        this.previousCanvasHeight = window.innerHeight;
        
        // Set canvas size to full viewport
        const resizeCanvas = () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            
            // Calculate the center of the window
            const windowCenterX = newWidth / 2;
            const windowCenterY = newHeight / 2;
            
            // Calculate the center of mass of all sources (keep relative positions constant)
            if (this.sources.length > 0) {
                let sumX = 0, sumY = 0, sumBaseX = 0, sumBaseY = 0;
                this.sources.forEach(source => {
                    sumX += source.x;
                    sumY += source.y;
                    sumBaseX += source.baseX;
                    sumBaseY += source.baseY;
                });
                
                const currentCenterX = sumX / this.sources.length;
                const currentCenterY = sumY / this.sources.length;
                const currentBaseCenterX = sumBaseX / this.sources.length;
                const currentBaseCenterY = sumBaseY / this.sources.length;
                
                // Calculate offset needed to center the array
                const offsetX = windowCenterX - currentCenterX;
                const offsetY = windowCenterY - currentCenterY;
                const baseOffsetX = windowCenterX - currentBaseCenterX;
                const baseOffsetY = windowCenterY - currentBaseCenterY;
                
                // Apply the same offset to all sources (maintains relative positions)
                this.sources.forEach(source => {
                    source.x += offsetX;
                    source.y += offsetY;
                    source.baseX += baseOffsetX;
                    source.baseY += baseOffsetY;
                });
            }
            
            // Update canvas dimensions
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            
            // Store new dimensions for next resize
            this.previousCanvasWidth = newWidth;
            this.previousCanvasHeight = newHeight;
            
            // Draw immediately to show background
            if (this.backgroundTransparent || this.backgroundColor === 'transparent') {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            } else {
                this.ctx.fillStyle = this.backgroundColor;
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            }
            // Full draw if sources exist
            if (this.sources.length > 0) {
            this.draw();
            }
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        console.log('✓ Canvas initialized:', this.canvas.width, 'x', this.canvas.height);
    }

    setupEventListeners() {
        // Ensure canvas exists before adding event listeners
        if (!this.canvas) {
            console.warn('⚠️ Canvas not available, skipping event listeners');
            return;
        }
        
        // Canvas events - Mouse
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.mousePos = { x: -1, y: -1 };
            if (this.draggedSource) {
                this.draggedSource = null;
            }
        });

        // Canvas events - Touch (for mobile)
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
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.handleTouchMove(x, y);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handleTouchEnd();
        });

        // Control buttons (only if they exist - player.html has playBtn/stopBtn, builder.html has all)
        const playBtn = document.getElementById('playBtn');
        const stopBtn = document.getElementById('stopBtn');
        const clearBtn = document.getElementById('clearBtn');
        
        if (playBtn) {
            playBtn.addEventListener('click', () => this.playAll());
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopAll());
        }
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearAll());
        }

        // File input (only exists in builder.html, not player.html)
        const audioFileInput = document.getElementById('audioFileInput');
        if (audioFileInput) {
            audioFileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                this.pendingAudioFiles = files;
                this.sourcePlacementMode = true;
                this.canvas.style.cursor = 'crosshair';
                this.updateStatus(`Click on canvas to place each audio source (${files.length} file${files.length > 1 ? 's' : ''} ready)`);
            });
        }

        // Dropbox integration
        const loadDropboxBtn = document.getElementById('loadDropboxBtn');
        const dropboxSection = document.getElementById('dropboxSection');
        const closeDropboxBtn = document.getElementById('closeDropboxBtn');
        const loadDropboxFilesBtn = document.getElementById('loadDropboxFilesBtn');
        const dropboxLinksInput = document.getElementById('dropboxLinks');
        const dropboxStatus = document.getElementById('dropboxStatus');

        if (loadDropboxBtn) {
            loadDropboxBtn.addEventListener('click', () => {
                dropboxSection.style.display = dropboxSection.style.display === 'none' ? 'block' : 'none';
            });
        }

        if (closeDropboxBtn) {
            closeDropboxBtn.addEventListener('click', () => {
                dropboxSection.style.display = 'none';
                dropboxLinksInput.value = '';
                dropboxStatus.textContent = '';
            });
        }

        if (loadDropboxFilesBtn) {
            loadDropboxFilesBtn.addEventListener('click', () => {
                this.loadFromDropbox();
            });
        }

        // Master volume (exists in both builder and player)
        const masterVolumeSlider = document.getElementById('masterVolume');
        if (masterVolumeSlider) {
            masterVolumeSlider.addEventListener('input', (e) => {
                const value = e.target.value / 100;
                this.masterVolume = value;
                if (this.masterGainNode) {
                    this.masterGainNode.gain.value = value;
                }
                const masterVolumeValue = document.getElementById('masterVolumeValue');
                if (masterVolumeValue) {
                    masterVolumeValue.textContent = e.target.value + '%';
                }
            });
        }

        // Fade radius (only in builder)
        const fadeRadiusSlider = document.getElementById('fadeRadius');
        if (fadeRadiusSlider) {
            fadeRadiusSlider.addEventListener('input', (e) => {
                this.fadeRadius = parseInt(e.target.value);
                const fadeRadiusValue = document.getElementById('fadeRadiusValue');
                if (fadeRadiusValue) {
                    fadeRadiusValue.textContent = e.target.value + 'px';
                }
            });
        }

        // Fade speed (only in builder)
        const fadeSpeedSlider = document.getElementById('fadeSpeed');
        if (fadeSpeedSlider) {
            fadeSpeedSlider.addEventListener('input', (e) => {
                this.fadeSpeed = parseFloat(e.target.value);
                const fadeSpeedValue = document.getElementById('fadeSpeedValue');
                if (fadeSpeedValue) {
                    fadeSpeedValue.textContent = e.target.value + 's';
                }
            });
        }

        // Spatial audio controls
        const spatialAudioEnabledCheckbox = document.getElementById('spatialAudioEnabled');
        if (spatialAudioEnabledCheckbox) {
            spatialAudioEnabledCheckbox.addEventListener('change', (e) => {
                this.spatialAudioEnabled = e.target.checked;
            });
        }

        const spatialAudioStrengthSlider = document.getElementById('spatialAudioStrength');
        if (spatialAudioStrengthSlider) {
            spatialAudioStrengthSlider.addEventListener('input', (e) => {
                this.spatialAudioStrength = parseFloat(e.target.value);
                const spatialAudioStrengthValue = document.getElementById('spatialAudioStrengthValue');
                if (spatialAudioStrengthValue) {
                    spatialAudioStrengthValue.textContent = Math.round(e.target.value * 100) + '%';
                }
            });
        }

        const reverbEnabledCheckbox = document.getElementById('reverbEnabled');
        if (reverbEnabledCheckbox) {
            reverbEnabledCheckbox.addEventListener('change', async (e) => {
                this.reverbEnabled = e.target.checked;
                if (e.target.checked && !this.convolverNode) {
                    await this.initReverb();
                    // Reconnect all existing sources if reverb was just enabled
                    if (this.reverbSendGain) {
                        this.sources.forEach(source => {
                            if (source.pannerNode && !source.reverbGain) {
                                // Reconnect source with reverb
                                source.pannerNode.disconnect();
                                source.reverbGain = this.audioContext.createGain();
                                source.reverbGain.gain.value = this.reverbAmount * 0.2;
                                source.pannerNode.connect(source.reverbGain);
                                source.reverbGain.connect(this.reverbSendGain);
                                
                                source.dryGain = this.audioContext.createGain();
                                source.dryGain.gain.value = 0.9;
                                source.pannerNode.connect(source.dryGain);
                                source.dryGain.connect(this.masterGainNode);
                            }
                        });
                    }
                } else if (!e.target.checked && this.reverbSendGain) {
                    // Disconnect reverb when disabled
                    this.sources.forEach(source => {
                        if (source.reverbGain) {
                            source.reverbGain.disconnect();
                            source.reverbGain = null;
                        }
                        if (source.dryGain) {
                            source.dryGain.disconnect();
                            source.dryGain = null;
                            // Reconnect panner directly
                            if (source.pannerNode) {
                                source.pannerNode.connect(this.masterGainNode);
                            }
                        }
                    });
                }
            });
        }

        const reverbAmountSlider = document.getElementById('reverbAmount');
        if (reverbAmountSlider) {
            reverbAmountSlider.addEventListener('input', (e) => {
                this.reverbAmount = parseFloat(e.target.value);
                const reverbAmountValue = document.getElementById('reverbAmountValue');
                if (reverbAmountValue) {
                    reverbAmountValue.textContent = Math.round(e.target.value * 100) + '%';
                }
                
                // Update shared reverb send gain
                if (this.reverbSendGain) {
                    this.reverbSendGain.gain.value = this.reverbAmount * 0.25;
                }
                
                // Update individual source reverb sends
                this.sources.forEach(source => {
                    if (source.reverbGain) {
                        // Keep individual send levels consistent
                        source.reverbGain.gain.value = this.reverbAmount * 0.2;
                    }
                });
            });
        }

        // Physics controls
        const physicsEnabledCheckbox = document.getElementById('physicsEnabled');
        if (physicsEnabledCheckbox) {
            physicsEnabledCheckbox.addEventListener('change', (e) => {
                this.physicsEnabled = e.target.checked;
            });
        }

        const physicsStrengthSlider = document.getElementById('physicsStrength');
        if (physicsStrengthSlider) {
            physicsStrengthSlider.addEventListener('input', (e) => {
                this.physicsStrength = parseFloat(e.target.value);
                const physicsStrengthValue = document.getElementById('physicsStrengthValue');
                if (physicsStrengthValue) {
                    physicsStrengthValue.textContent = Math.round(e.target.value * 100) + '%';
                }
            });
        }

        const driftStrengthSlider = document.getElementById('driftStrength');
        if (driftStrengthSlider) {
            driftStrengthSlider.addEventListener('input', (e) => {
                this.driftStrength = parseFloat(e.target.value);
                const driftStrengthValue = document.getElementById('driftStrengthValue');
                if (driftStrengthValue) {
                    driftStrengthValue.textContent = Math.round(e.target.value * 100) + '%';
                }
            });
        }

        const mouseRepulsionSlider = document.getElementById('mouseRepulsion');
        if (mouseRepulsionSlider) {
            mouseRepulsionSlider.addEventListener('input', (e) => {
                this.mouseRepulsion = parseFloat(e.target.value);
                const mouseRepulsionValue = document.getElementById('mouseRepulsionValue');
                if (mouseRepulsionValue) {
                    mouseRepulsionValue.textContent = Math.round(e.target.value * 100) + '%';
                }
            });
        }

        const sourceRepulsionSlider = document.getElementById('sourceRepulsion');
        if (sourceRepulsionSlider) {
            sourceRepulsionSlider.addEventListener('input', (e) => {
                this.sourceRepulsion = parseFloat(e.target.value);
                const sourceRepulsionValue = document.getElementById('sourceRepulsionValue');
                if (sourceRepulsionValue) {
                    sourceRepulsionValue.textContent = Math.round(e.target.value * 100) + '%';
                }
            });
        }

        const orbitalStrengthSlider = document.getElementById('orbitalStrength');
        if (orbitalStrengthSlider) {
            orbitalStrengthSlider.addEventListener('input', (e) => {
                this.orbitalStrength = parseFloat(e.target.value);
                const orbitalStrengthValue = document.getElementById('orbitalStrengthValue');
                if (orbitalStrengthValue) {
                    orbitalStrengthValue.textContent = Math.round(e.target.value * 100) + '%';
                }
            });
        }

        const orbitalSpeedSlider = document.getElementById('orbitalSpeed');
        if (orbitalSpeedSlider) {
            orbitalSpeedSlider.addEventListener('input', (e) => {
                this.orbitalSpeed = parseFloat(e.target.value);
                // Display as percentage of max (0.1)
                const orbitalSpeedValue = document.getElementById('orbitalSpeedValue');
                if (orbitalSpeedValue) {
                    orbitalSpeedValue.textContent = Math.round((e.target.value / 0.1) * 100) + '%';
                }
            });
        }
    }

    getSourceAtPosition(x, y) {
        const hitRadius = 25; // Radius for hit detection
        for (let i = this.sources.length - 1; i >= 0; i--) {
            const source = this.sources[i];
            const distance = this.calculateDistance(source.x, source.y, x, y);
            if (distance <= hitRadius) {
                return source;
            }
        }
        return null;
    }

    async handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on an existing source
        const clickedSource = this.getSourceAtPosition(x, y);
        
        if (clickedSource) {
            // Start dragging
            this.draggedSource = clickedSource;
            this.dragOffset.x = x - clickedSource.x;
            this.dragOffset.y = y - clickedSource.y;
            this.canvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        // If we have pending Wix CMS items, load and place them
        if (this.pendingWixCmsItems && this.pendingWixCmsItems.length > 0) {
            const fileCount = this.pendingWixCmsItems.length;
            const radius = Math.max(80, fileCount * 15);
            
            // Place all CMS items in a circle
            for (let i = 0; i < this.pendingWixCmsItems.length; i++) {
                const item = this.pendingWixCmsItems[i];
                const angle = (i / fileCount) * Math.PI * 2;
                const offsetX = Math.cos(angle) * radius;
                const offsetY = Math.sin(angle) * radius;
                
                try {
                    const source = await this.addAudioSourceFromUrl(item.url, x + offsetX, y + offsetY, item.title, item.color);
                    // Update editableTitle if provided
                    if (item.title && source) {
                        source.editableTitle = item.title;
                    }
                } catch (error) {
                    console.error(`Error loading CMS item ${i + 1}:`, error);
                }
            }
            
            this.pendingWixCmsItems = [];
            this.sourcePlacementMode = false;
            this.canvas.style.cursor = 'default';
            this.updateStatus('Wix CMS sources placed. Move mouse to explore.');
            return;
        }

        // If we have pending audio URLs, load and place them
        if (this.pendingAudioUrls && this.pendingAudioUrls.length > 0) {
            const fileCount = this.pendingAudioUrls.length;
            const radius = Math.max(80, fileCount * 15);
            
            // Place all URLs in a circle
            for (let i = 0; i < this.pendingAudioUrls.length; i++) {
                const audioUrl = this.pendingAudioUrls[i];
                const angle = (i / fileCount) * Math.PI * 2;
                const offsetX = Math.cos(angle) * radius;
                const offsetY = Math.sin(angle) * radius;
                
                try {
                    await this.addAudioSourceFromUrl(audioUrl, x + offsetX, y + offsetY);
                } catch (error) {
                    console.error(`Error loading URL ${i + 1}:`, error);
                }
            }
            
            this.pendingAudioUrls = [];
            this.sourcePlacementMode = false;
            this.canvas.style.cursor = 'default';
            this.updateStatus('Audio sources placed. Move mouse to explore.');
            return;
        }

        // If we have pending audio files, place them one at a time
        if (this.pendingAudioFiles.length > 0) {
            // Place the first file at the clicked position
            const file = this.pendingAudioFiles.shift(); // Remove first file from array
            this.addAudioSource(file, x, y);
            
            // Update status to show remaining files
            if (this.pendingAudioFiles.length > 0) {
                this.updateStatus(`Click to place next source (${this.pendingAudioFiles.length} remaining)`);
                this.canvas.style.cursor = 'crosshair';
            } else {
                // All files placed
            this.pendingAudioFiles = [];
            this.sourcePlacementMode = false;
                this.canvas.style.cursor = 'default';
                this.updateStatus('All audio sources placed. Move mouse to explore.');
            }
        }
    }

    handleMouseUp(e) {
        this.handlePointerUp();
    }

    handleTouchEnd() {
        this.handlePointerUp();
    }

    handlePointerUp() {
        if (this.draggedSource) {
            // Update base position for physics drift
            this.draggedSource.baseX = this.draggedSource.x;
            this.draggedSource.baseY = this.draggedSource.y;
            // Reset velocity after drag
            this.draggedSource.vx = 0;
            this.draggedSource.vy = 0;
            // Update volumes after drag ends
            this.updateAudioVolumes();
            this.draggedSource = null;
            this.canvas.style.cursor = 'default';
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.handlePointerMove(x, y);
    }

    handleTouchMove(x, y) {
        this.handlePointerMove(x, y);
    }

    handlePointerMove(x, y) {
        this.mousePos.x = x;
        this.mousePos.y = y;

        // Handle dragging
        if (this.draggedSource) {
            // Update source position
            this.draggedSource.x = x - this.dragOffset.x;
            this.draggedSource.y = y - this.dragOffset.y;
            
            // Keep source within canvas bounds
            const margin = 20;
            this.draggedSource.x = Math.max(margin, Math.min(this.canvas.width - margin, this.draggedSource.x));
            this.draggedSource.y = Math.max(margin, Math.min(this.canvas.height - margin, this.draggedSource.y));
            
            // Update volumes immediately while dragging
            this.updateAudioVolumes();
            return;
        }

        // Check for hover state
        const hovered = this.getSourceAtPosition(x, y);
        if (hovered !== this.hoveredSource) {
            this.hoveredSource = hovered;
            this.canvas.style.cursor = hovered ? 'grab' : ((this.pendingAudioFiles.length > 0 || this.pendingAudioUrls.length > 0) ? 'crosshair' : 'default');
        }

        // Update audio volumes based on mouse position
        this.updateAudioVolumes();
    }

    convertDropboxLink(link) {
        // Convert Dropbox shared link to direct download link
        // Format: https://www.dropbox.com/s/xxxxx/file.mp3?dl=0
        // To: https://www.dropbox.com/s/xxxxx/file.mp3?dl=1
        if (!link || !link.includes('dropbox.com')) {
            return null;
        }
        
        // Remove any existing dl parameter and add dl=1
        let directLink = link.trim();
        directLink = directLink.replace(/[?&]dl=\d+/, ''); // Remove existing dl parameter
        directLink += (directLink.includes('?') ? '&' : '?') + 'dl=1';
        
        return directLink;
    }

    async loadFromDropbox() {
        const dropboxLinksInput = document.getElementById('dropboxLinks');
        const dropboxStatus = document.getElementById('dropboxStatus');
        
        if (!dropboxLinksInput || !dropboxStatus) return;

        const linksText = dropboxLinksInput.value.trim();
        if (!linksText) {
            dropboxStatus.textContent = 'Please enter at least one Dropbox link';
            dropboxStatus.style.color = '#f44336';
            return;
        }

        const links = linksText.split('\n').filter(link => link.trim());
        if (links.length === 0) {
            dropboxStatus.textContent = 'No valid links found';
            dropboxStatus.style.color = '#f44336';
            return;
        }

        dropboxStatus.textContent = `Loading ${links.length} file(s) from Dropbox...`;
        dropboxStatus.style.color = '#2196F3';

        const loadDropboxFilesBtn = document.getElementById('loadDropboxFilesBtn');
        if (loadDropboxFilesBtn) {
            loadDropboxFilesBtn.disabled = true;
            loadDropboxFilesBtn.textContent = 'Loading...';
        }

        const files = [];
        let loadedCount = 0;
        let errorCount = 0;

        for (const link of links) {
            try {
                const directLink = this.convertDropboxLink(link);
                if (!directLink) {
                    errorCount++;
                    continue;
                }

                const response = await fetch(directLink);
                if (!response.ok) {
                    throw new Error(`Failed to fetch: ${response.statusText}`);
                }

                const blob = await response.blob();
                const urlParts = directLink.split('/');
                const fileName = urlParts[urlParts.length - 1].split('?')[0] || `audio_${Date.now()}.mp3`;
                
                const file = new File([blob], fileName, { type: blob.type || 'audio/mpeg' });
                files.push(file);
                loadedCount++;
            } catch (error) {
                console.error('Error loading from Dropbox:', error);
                errorCount++;
            }
        }

        if (loadDropboxFilesBtn) {
            loadDropboxFilesBtn.disabled = false;
            loadDropboxFilesBtn.textContent = 'Load Files';
        }

        if (files.length > 0) {
            this.pendingAudioFiles = files;
            this.sourcePlacementMode = true;
            this.canvas.style.cursor = 'crosshair';
            dropboxStatus.textContent = `✓ Loaded ${loadedCount} file(s)${errorCount > 0 ? ` (${errorCount} failed)` : ''}. Click on canvas to place each source one at a time.`;
            dropboxStatus.style.color = '#4CAF50';
            
            // Hide dropbox section after successful load
            setTimeout(() => {
                const dropboxSection = document.getElementById('dropboxSection');
                if (dropboxSection) {
                    dropboxSection.style.display = 'none';
                    dropboxLinksInput.value = '';
                }
            }, 2000);
        } else {
            dropboxStatus.textContent = `Failed to load files. Please check your links.`;
            dropboxStatus.style.color = '#f44336';
        }
    }

    // Add audio source from URL
    async addAudioSourceFromUrl(audioUrl, x, y, fileName = null, customColor = null) {
        if (!this.audioContext) {
            await this.initAudioContext();
        }

        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            // Fetch audio from URL
            console.log(`Loading audio from URL: ${audioUrl}`);
            
            let response;
            try {
                response = await fetch(audioUrl);
            } catch (fetchError) {
                // Handle CORS or network errors
                console.error('Fetch error:', fetchError);
                if (fetchError.message && (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('CORS'))) {
                    throw new Error(`Cannot access audio file due to CORS restrictions. The server needs to allow cross-origin requests. Try uploading to Wix Media Manager - they allow CORS.`);
                }
                throw new Error(`Network error: ${fetchError.message || 'Unknown error'}`);
            }
            
            if (!response.ok) {
                throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}. Make sure the URL is publicly accessible.`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            if (!arrayBuffer || arrayBuffer.byteLength === 0) {
                throw new Error('Audio file appears to be empty');
            }
            
            console.log(`Audio file loaded: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
            
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            if (!audioBuffer || audioBuffer.length === 0) {
                throw new Error('Failed to decode audio file. The file may be corrupted or in an unsupported format.');
            }
            
            console.log(`✓ Audio decoded successfully: ${audioBuffer.duration.toFixed(2)}s, ${audioBuffer.numberOfChannels} channel(s), ${audioBuffer.sampleRate}Hz`);
            
            // Use provided filename or extract from URL
            const name = fileName || audioUrl.split('/').pop().split('?')[0] || 'Audio Source';
            
            // Use custom color if provided, otherwise generate random color
            let color;
            if (customColor) {
                // Convert hex to HSL if needed, or use as-is if already HSL
                if (customColor.startsWith('#')) {
                    color = customColor; // Keep hex format
                } else {
                    color = customColor; // Assume it's already in correct format
                }
            } else {
                // Generate random color for this source
                const hue = Math.random() * 360;
                const saturation = 60 + Math.random() * 40; // 60-100%
                const lightness = 50 + Math.random() * 20; // 50-70%
                color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            }
            
            const source = {
                id: Date.now() + Math.random(),
                name: name,
                editableTitle: name, // Will be set from CMS data if provided
                color: color,
                audioBuffer: audioBuffer,
                audioUrl: audioUrl, // Store the URL for export
                source: null,
                gainNode: null,
                x: x,
                y: y,
                baseX: x,
                baseY: y,
                vx: 0,
                vy: 0,
                currentVolume: 0,
                targetVolume: 0,
                isPlaying: false,
                driftAngle: Math.random() * Math.PI * 2,
                driftSpeed: 0.5 + Math.random() * 0.5,
                orbitalAngle: Math.random() * Math.PI * 2,
                orbitalRadius: 120 + Math.random() * 80,
                orbitalSpeed: 0.015 + Math.random() * 0.01,
                orbitalDirection: Math.random() > 0.5 ? 1 : -1
            };

            // Create gain node for this source
            source.gainNode = this.audioContext.createGain();
            source.gainNode.gain.value = 0;
            
            // Ensure masterGainNode exists (should be created in initAudioContext, but double-check)
            if (!this.masterGainNode) {
                console.warn('masterGainNode missing, creating it now');
                this.masterGainNode = this.audioContext.createGain();
                this.masterGainNode.gain.value = this.masterVolume || 0.3;
                this.masterGainNode.connect(this.audioContext.destination);
            }
            
            // Initialize reverb if enabled but not yet initialized
            if (this.reverbEnabled && (!this.convolverNode || !this.reverbSendGain)) {
                console.warn('Reverb enabled but not initialized, initializing now');
                this.initReverb();
            }
            
            // Create spatial audio panner for 3D positioning (same settings as file-loaded sources)
            if (this.spatialAudioEnabled && this.audioContext.createPanner) {
                source.pannerNode = this.audioContext.createPanner();
                source.pannerNode.panningModel = 'HRTF'; // Head-Related Transfer Function for realistic 3D audio
                source.pannerNode.distanceModel = 'linear'; // Use linear instead of inverse to avoid volume reduction
                source.pannerNode.refDistance = this.maxDistance; // Large ref distance so distance doesn't reduce volume
                source.pannerNode.maxDistance = this.maxDistance * 2;
                source.pannerNode.rolloffFactor = 0; // No rolloff - we handle volume with gain node
                source.pannerNode.coneInnerAngle = 360;
                source.pannerNode.coneOuterAngle = 0;
                source.pannerNode.coneOuterGain = 0;
                
                // Connect: source -> gain -> panner -> (reverb) -> master
                source.gainNode.connect(source.pannerNode);
                
                if (this.reverbEnabled && this.convolverNode && this.reverbSendGain) {
                    // Create reverb send - connect to shared reverb send gain (not convolver directly)
                    source.reverbGain = this.audioContext.createGain();
                    source.reverbGain.gain.value = this.reverbAmount * 0.2; // Individual source reverb send level
                    source.pannerNode.connect(source.reverbGain);
                    source.reverbGain.connect(this.reverbSendGain); // Connect to shared reverb send, not convolver directly
                    
                    // Direct connection (dry signal) - reduce slightly when reverb is active
                    source.dryGain = this.audioContext.createGain();
                    source.dryGain.gain.value = 0.9; // Slightly reduced dry signal when reverb is active
                    source.pannerNode.connect(source.dryGain);
                    source.dryGain.connect(this.masterGainNode);
                } else {
                    source.pannerNode.connect(this.masterGainNode);
                }
            } else {
                // Fallback: connect directly if spatial audio not available
                source.gainNode.connect(this.masterGainNode);
            }

            // Verify audio buffer exists before adding
            if (!source.audioBuffer) {
                throw new Error('Audio buffer is missing - audio decoding may have failed');
            }
            
            // Verify gain node exists
            if (!source.gainNode) {
                throw new Error('Gain node is missing - audio context setup may have failed');
            }
            
            // Verify connection to master gain
            if (!this.masterGainNode) {
                throw new Error('Master gain node is missing - audio context may not be initialized');
            }
            
            this.sources.push(source);
            console.log(`✓ Source added to array. Total sources: ${this.sources.length}`);
            
            this.updateSourceCount();
            this.updateSourceEditor();
            this.draw();

            // If already playing, start this source immediately
            if (this.isPlaying) {
                this.startSource(source);
                if (source.gainNode) {
                    source.gainNode.gain.value = 0;
                }
            }

            console.log(`✓ Audio source added from URL: ${name} (ID: ${source.id})`);
            return source;
        } catch (error) {
            console.error('Error loading audio from URL:', error);
            throw error;
        }
    }

    async addAudioSource(file, x, y) {
        if (!this.audioContext) {
            this.initAudioContext();
        }

        try {
            // Resume audio context if suspended
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

            // Generate random color for this source
            const hue = Math.random() * 360;
            const saturation = 60 + Math.random() * 40; // 60-100%
            const lightness = 50 + Math.random() * 20; // 50-70%
            const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

            const source = {
                id: Date.now() + Math.random(),
                name: file.name,
                editableTitle: file.name, // Editable title, defaults to filename
                color: color, // Custom color for this source
                audioBuffer: audioBuffer,
                source: null,
                gainNode: null,
                x: x,
                y: y,
                baseX: x, // Original position for drift calculations
                baseY: y,
                vx: 0, // Velocity X
                vy: 0, // Velocity Y
                currentVolume: 0,
                targetVolume: 0,
                isPlaying: false,
                driftAngle: Math.random() * Math.PI * 2, // Random drift direction
                driftSpeed: 0.5 + Math.random() * 0.5, // Random drift speed
                orbitalAngle: Math.random() * Math.PI * 2, // Starting orbital angle
                orbitalRadius: 120 + Math.random() * 80, // Random orbital radius (120-200)
                orbitalSpeed: 0.015 + Math.random() * 0.01, // Random orbital speed
                orbitalDirection: Math.random() > 0.5 ? 1 : -1 // Random clockwise/counterclockwise
            };

            // Create gain node for this source
            source.gainNode = this.audioContext.createGain();
            source.gainNode.gain.value = 0;
            
            // Create spatial audio panner for 3D positioning
            if (this.spatialAudioEnabled && this.audioContext.createPanner) {
                source.pannerNode = this.audioContext.createPanner();
                source.pannerNode.panningModel = 'HRTF'; // Head-Related Transfer Function for realistic 3D audio
                source.pannerNode.distanceModel = 'linear'; // Use linear instead of inverse to avoid volume reduction
                source.pannerNode.refDistance = this.maxDistance; // Large ref distance so distance doesn't reduce volume
                source.pannerNode.maxDistance = this.maxDistance * 2;
                source.pannerNode.rolloffFactor = 0; // No rolloff - we handle volume with gain node
                source.pannerNode.coneInnerAngle = 360;
                source.pannerNode.coneOuterAngle = 0;
                source.pannerNode.coneOuterGain = 0;
                
                // Connect: source -> gain -> panner -> (reverb) -> master
                source.gainNode.connect(source.pannerNode);
                
                if (this.reverbEnabled && this.convolverNode && this.reverbSendGain) {
                    // Create reverb send - connect to shared reverb send gain (not convolver directly)
                    source.reverbGain = this.audioContext.createGain();
                    source.reverbGain.gain.value = this.reverbAmount * 0.2; // Individual source reverb send level
                    source.pannerNode.connect(source.reverbGain);
                    source.reverbGain.connect(this.reverbSendGain); // Connect to shared reverb send, not convolver directly
                    
                    // Direct connection (dry signal) - reduce slightly when reverb is active
                    source.dryGain = this.audioContext.createGain();
                    source.dryGain.gain.value = 0.9; // Slightly reduced dry signal when reverb is active
                    source.pannerNode.connect(source.dryGain);
                    source.dryGain.connect(this.masterGainNode);
                } else {
                    source.pannerNode.connect(this.masterGainNode);
                }
            } else {
                // Fallback: connect directly if spatial audio not available
                source.gainNode.connect(this.masterGainNode);
            }

            this.sources.push(source);
            this.updateSourceCount();
            this.updateSourceEditor();
            this.draw();

            // If already playing, start this source immediately (it will fade in based on mouse position)
            if (this.isPlaying) {
                this.startSource(source);
                // Set initial volume to 0 - it will fade in when mouse approaches
                if (source.gainNode) {
                    source.gainNode.gain.value = 0;
                }
            }
        } catch (error) {
            console.error('Error loading audio file:', error);
            alert(`Error loading ${file.name}: ${error.message}`);
        }
    }

    calculateDistance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    }

    calculateVolumeForSource(source) {
        if (this.mousePos.x < 0 || this.mousePos.y < 0) {
            return 0;
        }

        const distance = this.calculateDistance(source.x, source.y, this.mousePos.x, this.mousePos.y);
        
        if (distance >= this.fadeRadius) {
            return 0;
        }

        // Inverse distance falloff - closer = louder
        // Using inverse square for smoother falloff
        const normalizedDistance = distance / this.fadeRadius;
        const volume = Math.max(0, 1 - normalizedDistance);
        
        // Apply smooth curve (ease-in-out)
        return volume * volume * (3 - 2 * volume);
    }

    updateAudioVolumes() {
        const currentTime = this.audioContext.currentTime;

        // Count active sources (sources that are playing and have volume > 0)
        const activeSources = this.sources.filter(s => s.isPlaying && this.calculateVolumeForSource(s) > 0.01);
        const activeCount = activeSources.length;
        
        // Calculate gain reduction factor to prevent clipping when multiple sources sum together
        // Formula: reduce gain by sqrt of active count to prevent linear summing
        // This ensures total signal stays below clipping threshold
        // For 1 source: 1.0, 2 sources: ~0.71, 4 sources: 0.5, 8 sources: ~0.35
        const gainReductionFactor = activeCount > 0 ? Math.min(1.0, 1.0 / Math.sqrt(Math.max(1, activeCount))) : 1.0;
        
        // Also apply a maximum per-source volume limit to prevent individual sources from being too loud
        const maxSourceVolume = 0.7; // Maximum 70% per source

        this.sources.forEach(source => {
            let targetVolume = this.calculateVolumeForSource(source);
            source.targetVolume = targetVolume;

            // Update spatial audio positioning
            if (this.spatialAudioEnabled && source.pannerNode && this.mousePos.x >= 0 && this.mousePos.y >= 0) {
                this.updateSpatialPosition(source);
            }

            // Apply gain reduction to prevent clipping when multiple sources sum together
            // Cap individual source volume and apply multi-source reduction
            targetVolume = Math.min(targetVolume, maxSourceVolume) * gainReductionFactor;
            
            if (source.gainNode && source.isPlaying) {
                const currentGain = source.gainNode.gain.value;
                const gainDiff = Math.abs(targetVolume - currentGain);

                if (gainDiff > 0.001) {
                    source.gainNode.gain.cancelScheduledValues(currentTime);
                    source.gainNode.gain.setValueAtTime(currentGain, currentTime);
                    source.gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + this.fadeSpeed);
                }
            }
        });

        this.updateActiveCount();
    }

    updateSpatialPosition(source) {
        if (!source.pannerNode || !this.audioContext) return;

        // Calculate relative position from mouse (listener) to source
        // Use actual pixel positions directly - no need to normalize to canvas center
        const dx = source.x - this.mousePos.x;
        const dy = source.y - this.mousePos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Map canvas coordinates to 3D audio space
        // Canvas: (0,0) top-left, mouse is listener at origin
        // 3D Audio: listener at origin (0,0,0), forward = -Z, up = +Y, right = +X
        // Map: Up on canvas = forward (-Z), Down = behind (+Z), Left = left (-X), Right = right (+X)
        
        // Convert pixel distances directly to 3D space
        // Use a scale factor that maps canvas pixels to 3D units
        // Smaller scale = sources feel closer, larger scale = sources feel farther
        const pixelsPerUnit = 2; // 2 pixels = 1 audio unit
        const x3d = (-dx / pixelsPerUnit) * this.spatialAudioStrength; // Negate X for correct left/right
        const y3d = 0; // Sources are on same plane as listener
        const z3d = (-dy / pixelsPerUnit) * this.spatialAudioStrength; // Negative Y = forward (up on canvas)
        
        // Set 3D position
        const panner = source.pannerNode;
        if (panner.positionX) {
            // Modern API
            panner.positionX.value = x3d;
            panner.positionY.value = y3d;
            panner.positionZ.value = z3d;
        } else {
            // Legacy API
            panner.setPosition(x3d, y3d, z3d);
        }
        
        // Don't set orientation on panner - that's for source direction, not listener
        // Listener orientation is set once in initAudioContext
        
        // Update reverb based on distance (but keep dry signal at full volume)
        if (source.reverbGain && this.reverbEnabled) {
            const normalizedDist = Math.min(distance / this.maxDistance, 1);
            // Adjust reverb send level based on distance (more reverb for distant sources)
            const reverbGain = this.reverbAmount * 0.2 * (0.3 + normalizedDist * 0.7);
            source.reverbGain.gain.value = reverbGain;
            // Keep dry signal consistent
            if (source.dryGain) {
                source.dryGain.gain.value = 0.9;
            }
        }
    }

    startSource(source) {
        if (source.isPlaying) {
            console.log(`Source ${source.id} already playing`);
            return;
        }
        
        if (!source.audioBuffer) {
            console.error(`Cannot start source ${source.id}: missing audioBuffer`);
            return;
        }
        
        if (!source.gainNode) {
            console.error(`Cannot start source ${source.id}: missing gainNode`);
            return;
        }

        try {
            source.source = this.audioContext.createBufferSource();
            source.source.buffer = source.audioBuffer;
            source.source.loop = true;
            source.source.connect(source.gainNode);
            source.source.start(0);
            source.isPlaying = true;
            console.log(`✓ Started source ${source.id} (${source.name || 'unnamed'})`);
        } catch (error) {
            console.error(`Error starting audio source ${source.id}:`, error);
            console.error('Source details:', {
                id: source.id,
                name: source.name,
                hasAudioBuffer: !!source.audioBuffer,
                hasGainNode: !!source.gainNode,
                audioBufferLength: source.audioBuffer?.length,
                audioBufferDuration: source.audioBuffer?.duration
            });
        }
    }

    stopSource(source) {
        if (!source.isPlaying || !source.source) return;

        try {
            const currentTime = this.audioContext.currentTime;
            const currentGain = source.gainNode.gain.value;
            
            // Fade out smoothly
            source.gainNode.gain.cancelScheduledValues(currentTime);
            source.gainNode.gain.setValueAtTime(currentGain, currentTime);
            source.gainNode.gain.linearRampToValueAtTime(0, currentTime + this.fadeSpeed);

            setTimeout(() => {
                if (source.source) {
                    try {
                        source.source.stop();
                    } catch (e) {}
                    source.source.disconnect();
                    source.source = null;
                }
                source.isPlaying = false;
            }, this.fadeSpeed * 1000 + 50);
        } catch (error) {
            console.error('Error stopping audio source:', error);
        }
    }

    async playAll() {
        if (!this.audioContext) {
            this.initAudioContext();
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        // Filter out sources without audio buffers
        const validSources = this.sources.filter(s => s.audioBuffer);
        
        console.log(`playAll: Total sources: ${this.sources.length}, Valid sources: ${validSources.length}`);
        
        if (validSources.length === 0) {
            if (this.sources.length > 0) {
                console.error('Sources exist but none have valid audio buffers:', this.sources);
                alert(`Found ${this.sources.length} source(s) but none have valid audio data. Please reload the audio files.`);
            } else {
            alert('Please add at least one audio file');
            }
            return;
        }

        this.isPlaying = true;
        
        // Start all valid sources (they'll start at volume 0 and fade based on mouse position)
        validSources.forEach(source => {
            if (!source.isPlaying) {
                this.startSource(source);
            }
            // Ensure volume starts at 0 - will fade in based on mouse position
            if (source.gainNode) {
                const currentTime = this.audioContext.currentTime;
                source.gainNode.gain.cancelScheduledValues(currentTime);
                source.gainNode.gain.setValueAtTime(0, currentTime);
            }
        });

        // Update volumes immediately to apply current mouse position
        this.updateAudioVolumes();
        this.updateStatus('Playing - All tracks playing, move mouse to explore');
    }

    stopAll() {
        this.isPlaying = false;
        
        this.sources.forEach(source => {
            this.stopSource(source);
        });

        this.updateStatus('Stopped');
    }

    clearAll() {
        this.stopAll();
        
        // Immediately clear sources array and disconnect all nodes
            this.sources.forEach(source => {
            // Disconnect all audio nodes
                if (source.gainNode) {
                try { source.gainNode.disconnect(); } catch(e) {}
            }
            if (source.pannerNode) {
                try { source.pannerNode.disconnect(); } catch(e) {}
            }
            if (source.reverbGain) {
                try { source.reverbGain.disconnect(); } catch(e) {}
            }
            if (source.dryGain) {
                try { source.dryGain.disconnect(); } catch(e) {}
            }
            if (source.source) {
                try { 
                    source.source.stop();
                    source.source.disconnect();
                } catch(e) {}
            }
        });
        
        // Clear sources array immediately
            this.sources = [];
            this.updateSourceCount();
            this.updateActiveCount();
            this.updateSourceEditor();
            this.draw();
            this.updateStatus('All sources cleared');
    }

    draw() {
        if (!this.ctx || !this.canvas) {
            console.warn('⚠️ Cannot draw: ctx or canvas not available');
            return;
        }

        const width = this.canvas.width;
        const height = this.canvas.height;

        if (width === 0 || height === 0) {
            console.warn('⚠️ Canvas has zero dimensions:', width, 'x', height);
            return;
        }

        // Fill canvas with background color (or clear if transparent)
        if (this.backgroundTransparent || this.backgroundColor === 'transparent') {
            this.ctx.clearRect(0, 0, width, height);
        } else {
            this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, width, height);
        }

        // Debug: log source count if drawing
        if (this.sources.length > 0 && Math.random() < 0.01) { // Log ~1% of frames to avoid spam
            console.log(`Drawing ${this.sources.length} sources`);
        }

        // Draw grid (only in builder/index, not player)
        const isBuilder = document.getElementById('sourceEditorList') !== null || document.getElementById('exportConfigBtn') !== null;
        if (isBuilder) {
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 1;
        const gridSize = 50;
        for (let x = 0; x < width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
        for (let y = 0; y < height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
            }
        }

        // Draw audio sources
        this.sources.forEach(source => {
            const distance = this.mousePos.x >= 0 && this.mousePos.y >= 0
                ? this.calculateDistance(source.x, source.y, this.mousePos.x, this.mousePos.y)
                : Infinity;
            
            const volume = this.calculateVolumeForSource(source);
            const isActive = volume > 0.01;
            const isDragging = this.draggedSource === source;
            const isHovered = this.hoveredSource === source && !isDragging;

            // Draw fade radius circle (subtle, but more visible when dragging)
            const fadeAlpha = isDragging ? 0.3 : (0.1 + volume * 0.2);
            this.ctx.strokeStyle = `rgba(100, 200, 255, ${fadeAlpha})`;
            this.ctx.lineWidth = isDragging ? 3 : 2;
            this.ctx.setLineDash(isDragging ? [5, 5] : []);
            this.ctx.beginPath();
            this.ctx.arc(source.x, source.y, this.fadeRadius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // Draw source circle (size based on volume)
            const baseRadius = 15;
            const radius = baseRadius + (volume * 20);
            const alpha = 0.5 + (volume * 0.5);
            
            // Parse source color - ensure we have a valid color value
            const sourceColorValue = source.color || '#4CAF50';
            const sourceColor = this.hexToRgba(sourceColorValue, alpha);
            const sourceColorSolid = this.hexToRgba(sourceColorValue, 1.0);
            
            // Outer glow
            if (isActive || isDragging) {
                const gradient = this.ctx.createRadialGradient(
                    source.x, source.y, radius * 0.5,
                    source.x, source.y, radius * 2
                );
                const glowColor = isDragging ? 'rgba(255, 200, 0, 0.8)' : sourceColor;
                gradient.addColorStop(0, glowColor);
                gradient.addColorStop(1, this.hexToRgba(sourceColorValue, 0));
                this.ctx.fillStyle = gradient;
                this.ctx.beginPath();
                this.ctx.arc(source.x, source.y, radius * 2, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Main circle - use custom color
            let circleColor;
            if (isDragging) {
                circleColor = 'rgba(255, 200, 0, 0.8)';
            } else if (isHovered) {
                circleColor = 'rgba(100, 200, 255, 0.6)';
            } else if (isActive) {
                circleColor = sourceColor;
            } else {
                // Inactive - use source color but dimmed
                circleColor = this.hexToRgba(sourceColorValue, 0.3);
            }
            
            this.ctx.fillStyle = circleColor;
            this.ctx.beginPath();
            this.ctx.arc(source.x, source.y, radius, 0, Math.PI * 2);
            this.ctx.fill();

            // Border - use custom color
            let borderColor;
            if (isDragging) {
                borderColor = '#FFC800';
            } else if (isHovered) {
                borderColor = '#64C8FF';
            } else if (isActive) {
                borderColor = sourceColorSolid;
            } else {
                borderColor = this.hexToRgba(sourceColorValue, 0.5);
            }
            
            this.ctx.strokeStyle = borderColor;
            this.ctx.lineWidth = isDragging ? 3 : 2;
            this.ctx.stroke();

            // Label - use editable title
            this.ctx.fillStyle = '#fff';
            this.ctx.font = isDragging ? 'bold 13px sans-serif' : '12px sans-serif';
            this.ctx.textAlign = 'center';
            const label = this.truncateFileName(source.editableTitle || source.name, 20);
            this.ctx.fillText(label, source.x, source.y + radius + 15);
            
            // Volume indicator
            if (isActive || isDragging) {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${isDragging ? 1 : alpha})`;
                this.ctx.fillText(`${Math.round(volume * 100)}%`, source.x, source.y + radius + 30);
            }
        });

        // Draw mouse position indicator
        if (this.mousePos.x >= 0 && this.mousePos.y >= 0) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.beginPath();
            this.ctx.arc(this.mousePos.x, this.mousePos.y, 5, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw lines to active sources - use source colors
            this.sources.forEach(source => {
                const volume = this.calculateVolumeForSource(source);
                if (volume > 0.01) {
                    const sourceColorValue = source.color || '#4CAF50';
                    const lineColor = this.hexToRgba(sourceColorValue, volume * 0.3);
                    this.ctx.strokeStyle = lineColor;
                    this.ctx.lineWidth = 2;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.mousePos.x, this.mousePos.y);
                    this.ctx.lineTo(source.x, source.y);
                    this.ctx.stroke();
                }
            });
        }
    }

    updatePhysics(deltaTime) {
        if (!this.physicsEnabled || this.physicsStrength === 0) {
            // Debug: log why physics aren't running (only once per second to avoid spam)
            if (Math.random() < 0.01) {
                console.log(`⚠️ Physics not running: enabled=${this.physicsEnabled}, strength=${this.physicsStrength}`);
            }
            return;
        }

        const dt = Math.min(deltaTime / 16.67, 2); // Cap delta time, normalize to ~60fps
        
        if (!dt || dt <= 0 || !isFinite(dt)) {
            console.warn(`Invalid deltaTime: ${dt}`);
            return;
        }

        this.sources.forEach(source => {
            // Skip physics for sources being dragged
            if (source === this.draggedSource) {
                source.vx = 0;
                source.vy = 0;
                return;
            }

            // Random drift movement (orbital around base position)
            const driftRadius = 30 * this.driftStrength * this.physicsStrength;
            source.driftAngle += 0.01 * source.driftSpeed * dt;
            const targetX = source.baseX + Math.cos(source.driftAngle) * driftRadius;
            const targetY = source.baseY + Math.sin(source.driftAngle) * driftRadius;

            // Orbital/gravitational movement around cursor
            if (this.mousePos.x >= 0 && this.mousePos.y >= 0 && this.orbitalStrength > 0) {
                const dx = source.x - this.mousePos.x;
                const dy = source.y - this.mousePos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);

                if (distance > 0) {
                    // Calculate current orbital angle
                    source.orbitalAngle = angle;

                    // Gravitational attraction toward preferred orbital radius
                    const preferredRadius = source.orbitalRadius;
                    const radiusDiff = distance - preferredRadius;
                    const gravitationalForce = (radiusDiff / preferredRadius) * this.orbitalStrength * this.physicsStrength * 0.3;
                    
                    // Radial force (toward/away from cursor)
                    source.vx -= Math.cos(angle) * gravitationalForce * dt;
                    source.vy -= Math.sin(angle) * gravitationalForce * dt;

                    // Angular velocity for orbital motion (tangential force)
                    const tangentialForce = this.orbitalSpeed * source.orbitalSpeed * source.orbitalDirection * this.orbitalStrength * this.physicsStrength;
                    const tangentialAngle = angle + Math.PI / 2; // Perpendicular to radial direction
                    source.vx += Math.cos(tangentialAngle) * tangentialForce * dt * (distance / preferredRadius);
                    source.vy += Math.sin(tangentialAngle) * tangentialForce * dt * (distance / preferredRadius);

                    // Close-range repulsion to prevent sources from getting too close to cursor
                    const minDistance = 40;
                    if (distance < minDistance && this.mouseRepulsion > 0) {
                        const repulsionForce = (1 - distance / minDistance) * this.mouseRepulsion * this.physicsStrength;
                        const pushForce = repulsionForce * 0.5 * dt;
                        source.vx += Math.cos(angle) * pushForce;
                        source.vy += Math.sin(angle) * pushForce;
                    }
                }
            }

            // Source-to-source repulsion (sources push away from each other)
            if (this.sourceRepulsion > 0) {
                this.sources.forEach(otherSource => {
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

            // Update position (always apply velocity if physics enabled)
            if (this.physicsEnabled && this.physicsStrength > 0) {
                const oldX = source.x;
                const oldY = source.y;
                source.x += source.vx * dt;
                source.y += source.vy * dt;
                
                // Debug: log if source actually moved significantly
                if (Math.abs(oldX - source.x) > 1 || Math.abs(oldY - source.y) > 1) {
                    // Only log occasionally to avoid spam
                    if (Math.random() < 0.0001) {
                        console.log(`📍 Source "${source.name}" moved: (${oldX.toFixed(1)}, ${oldY.toFixed(1)}) -> (${source.x.toFixed(1)}, ${source.y.toFixed(1)}), vel=(${source.vx.toFixed(3)}, ${source.vy.toFixed(3)})`);
                    }
                }
            }

            // Boundary constraints with bounce
            const margin = 20;
            if (source.x < margin) {
                source.x = margin;
                source.vx *= -0.5; // Bounce
            } else if (source.x > this.canvas.width - margin) {
                source.x = this.canvas.width - margin;
                source.vx *= -0.5;
            }
            if (source.y < margin) {
                source.y = margin;
                source.vy *= -0.5;
            } else if (source.y > this.canvas.height - margin) {
                source.y = this.canvas.height - margin;
                source.vy *= -0.5;
            }
        });
    }

    startAnimationLoop() {
        // Cancel any existing animation loop to prevent duplicates
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        let lastVolumeUpdate = 0;
        let physicsUpdateCount = 0;
        let frameCount = 0;
        
        const update = (currentTime) => {
            frameCount++;
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;

            // Always update physics if enabled (don't skip)
            if (this.physicsEnabled && this.sources.length > 0 && this.physicsStrength > 0) {
                const beforeUpdate = this.sources.map(s => ({ x: s.x.toFixed(1), y: s.y.toFixed(1) }));
            this.updatePhysics(deltaTime);
                physicsUpdateCount++;
                
                // Log physics activity occasionally for debugging
                if (physicsUpdateCount % 300 === 0) { // Every ~5 seconds at 60fps
                    const afterUpdate = this.sources.map(s => ({ x: s.x.toFixed(1), y: s.y.toFixed(1) }));
                    const moved = beforeUpdate.some((before, i) => before.x !== afterUpdate[i].x || before.y !== afterUpdate[i].y);
                    console.log(`⚙️ Physics running: ${this.sources.length} sources, enabled=${this.physicsEnabled}, strength=${this.physicsStrength}, sources moved=${moved}`);
                    if (this.sources.length > 0) {
                        console.log(`   First source: pos=(${this.sources[0].x.toFixed(1)}, ${this.sources[0].y.toFixed(1)}), vel=(${this.sources[0].vx.toFixed(3)}, ${this.sources[0].vy.toFixed(3)})`);
                    }
                }
            } else if (frameCount % 600 === 0) {
                console.log(`⚠️ Physics not running: enabled=${this.physicsEnabled}, strength=${this.physicsStrength}, sources=${this.sources.length}`);
            }

            // Update audio volumes (throttled to ~60fps)
            if (currentTime - lastVolumeUpdate > 16) {
                this.updateAudioVolumes();
                lastVolumeUpdate = currentTime;
            }

            // Draw
            this.draw();

            this.animationFrameId = requestAnimationFrame(update);
        };
        
        this.lastTime = performance.now();
        console.log(`🎬 Starting animation loop...`);
        update(this.lastTime);
    }

    updateSourceCount() {
        const sourceCountEl = document.getElementById('sourceCount');
        if (sourceCountEl) {
            sourceCountEl.textContent = this.sources.length;
        }
        this.updateSourceInfo();
    }

    updateActiveCount() {
        const activeCountEl = document.getElementById('activeCount');
        if (activeCountEl) {
        const activeCount = this.sources.filter(s => s.isPlaying && s.targetVolume > 0.01).length;
            activeCountEl.textContent = activeCount;
        }
    }

    updateSourceInfo() {
        const infoContainer = document.getElementById('sourceInfo');
        if (!infoContainer) return; // Element doesn't exist (e.g., in embed-player.html)
        
        infoContainer.innerHTML = '';
        
        this.sources.forEach((source, index) => {
            const item = document.createElement('div');
            item.className = 'source-item';
            if (source.isPlaying && source.targetVolume > 0.01) {
                item.classList.add('active');
            }
            item.innerHTML = `
                <strong>${index + 1}.</strong> ${this.truncateFileName(source.editableTitle || source.name, 25)}<br>
                <small>Vol: ${Math.round(source.targetVolume * 100)}%</small>
            `;
            infoContainer.appendChild(item);
        });
    }

    updateSourceEditor() {
        const editorContainer = document.getElementById('sourceEditorList');
        if (!editorContainer) {
            console.warn('sourceEditorList container not found!');
            return;
        }
        
        if (this.sources.length === 0) {
            editorContainer.innerHTML = '<p style="opacity: 0.8; font-size: 0.9rem; text-align: center; padding: 10px;">No sources loaded yet. Add audio files to edit them.</p>';
            return;
        }
        
        console.log(`Updating source editor with ${this.sources.length} sources`);
        editorContainer.innerHTML = '';
        
        this.sources.forEach((source, index) => {
            const editorItem = document.createElement('div');
            editorItem.className = 'source-editor-item';
            
            // Create elements manually to ensure data attributes are set correctly
            const title = document.createElement('h4');
            title.textContent = `Source ${index + 1}`;
            
            const titleGroup = document.createElement('div');
            titleGroup.className = 'control-group';
            titleGroup.style.marginBottom = '10px';
            
            const titleLabel = document.createElement('label');
            titleLabel.textContent = 'Title';
            
            const titleInput = document.createElement('input');
            titleInput.type = 'text';
            titleInput.className = 'source-title-input';
            titleInput.setAttribute('data-source-id', source.id.toString());
            titleInput.value = source.editableTitle || source.name;
            titleInput.placeholder = 'Enter title';
            
            const colorGroup = document.createElement('div');
            colorGroup.className = 'control-group';
            
            const colorLabel = document.createElement('label');
            colorLabel.textContent = 'Color';
            
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.className = 'source-color-input';
            colorInput.setAttribute('data-source-id', source.id.toString());
            colorInput.value = this.hslToHex(source.color);
            
            titleGroup.appendChild(titleLabel);
            titleGroup.appendChild(titleInput);
            colorGroup.appendChild(colorLabel);
            colorGroup.appendChild(colorInput);
            
            editorItem.appendChild(title);
            editorItem.appendChild(titleGroup);
            editorItem.appendChild(colorGroup);
            editorContainer.appendChild(editorItem);
        });
        
        // Add event listeners - use index-based matching for reliability
        const titleInputs = editorContainer.querySelectorAll('.source-title-input');
        const colorInputs = editorContainer.querySelectorAll('.source-color-input');
        
        console.log(`Found ${titleInputs.length} title inputs and ${colorInputs.length} color inputs`);
        
        // Attach title listeners using index-based matching
        titleInputs.forEach((input, index) => {
            if (index >= this.sources.length) {
                console.warn(`Input index ${index} exceeds sources array length`);
                return;
            }
            
            const source = this.sources[index];
            if (!source) {
                console.error(`No source at index ${index}`);
                return;
            }
            
            const handleTitleUpdate = (e) => {
                const newTitle = e.target.value || source.name;
                source.editableTitle = newTitle;
                console.log(`✓ Title updated: "${source.name}" -> "${newTitle}"`);
                    this.draw();
                    this.updateSourceInfo();
            };
            
            input.addEventListener('input', handleTitleUpdate);
            input.addEventListener('blur', handleTitleUpdate);
            
            console.log(`✓ Title listeners attached to source ${index + 1}: "${source.name}" (ID: ${source.id})`);
        });
        
        // Attach color listeners using index-based matching
        colorInputs.forEach((input, index) => {
            if (index >= this.sources.length) {
                console.warn(`Input index ${index} exceeds sources array length`);
                return;
            }
            
            const source = this.sources[index];
            if (!source) {
                console.error(`No source at index ${index}`);
                return;
            }
            
            const handleColorUpdate = (e) => {
                const oldColor = source.color;
                    source.color = e.target.value;
                console.log(`✓ Color updated: "${source.name}" ${oldColor} -> ${source.color}`);
                    this.draw();
            };
            
            input.addEventListener('input', handleColorUpdate);
            input.addEventListener('change', handleColorUpdate);
            
            console.log(`✓ Color listeners attached to source ${index + 1}: "${source.name}" (ID: ${source.id})`);
        });
        
        console.log(`✓ Source editor updated with ${this.sources.length} sources`);
        
        // Auto-expand the editor section if it was collapsed and we have sources
        const editorSection = document.getElementById('source-editor');
        const editorToggle = document.getElementById('source-editor-toggle');
        if (editorSection && editorToggle && this.sources.length > 0) {
            // Only expand if currently collapsed
            if (editorSection.classList.contains('collapsed')) {
                // Don't auto-expand - let user control it
                // But ensure it's functional
            }
        }
    }

    hexToRgba(hex, alpha = 1) {
        if (!hex) return `rgba(76, 175, 80, ${alpha})`; // Default green
        
        // Handle HSL colors
        if (hex.startsWith('hsl')) {
            return hex.replace(')', `, ${alpha})`).replace('hsl', 'hsla');
        }
        
        // Handle hex colors (with or without #)
        let hexValue = hex.startsWith('#') ? hex.slice(1) : hex;
        
        // Handle short hex (e.g., #f00 -> #ff0000)
        if (hexValue.length === 3) {
            hexValue = hexValue.split('').map(char => char + char).join('');
        }
        
        // Ensure we have a valid 6-character hex
        if (hexValue.length !== 6) {
            console.warn(`Invalid hex color: ${hex}, using default`);
            return `rgba(76, 175, 80, ${alpha})`;
        }
        
        const r = parseInt(hexValue.slice(0, 2), 16);
        const g = parseInt(hexValue.slice(2, 4), 16);
        const b = parseInt(hexValue.slice(4, 6), 16);
        
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
            console.warn(`Failed to parse hex color: ${hex}, using default`);
            return `rgba(76, 175, 80, ${alpha})`;
        }
        
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    hslToHex(hsl) {
        if (!hsl) return '#4CAF50';
        if (hsl.startsWith('#')) return hsl;
        
        // Parse HSL string like "hsl(120, 80%, 60%)"
        const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (!match) return '#4CAF50';
        
        const h = parseInt(match[1]) / 360;
        const s = parseInt(match[2]) / 100;
        const l = parseInt(match[3]) / 100;
        
        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h * 6) % 2 - 1));
        const m = l - c / 2;
        
        let r, g, b;
        
        if (h < 1/6) {
            r = c; g = x; b = 0;
        } else if (h < 2/6) {
            r = x; g = c; b = 0;
        } else if (h < 3/6) {
            r = 0; g = c; b = x;
        } else if (h < 4/6) {
            r = 0; g = x; b = c;
        } else if (h < 5/6) {
            r = x; g = 0; b = c;
        } else {
            r = c; g = 0; b = x;
        }
        
        r = Math.round((r + m) * 255).toString(16).padStart(2, '0');
        g = Math.round((g + m) * 255).toString(16).padStart(2, '0');
        b = Math.round((b + m) * 255).toString(16).padStart(2, '0');
        
        return `#${r}${g}${b}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateStatus(message) {
        // Could add a status display if needed
        console.log(message);
    }

    updateMousePos() {
        const mousePosEl = document.getElementById('mousePos');
        if (!mousePosEl) return; // Element doesn't exist (e.g., in player.html)
        
        const posText = this.mousePos.x >= 0 && this.mousePos.y >= 0
            ? `${Math.round(this.mousePos.x)}, ${Math.round(this.mousePos.y)}`
            : '-';
        mousePosEl.textContent = posText;
    }

    truncateFileName(name, maxLength = 30) {
        if (name.length > maxLength) {
            return name.substring(0, maxLength - 3) + '...';
        }
        return name;
    }

    // Export configuration as JSON
    exportConfiguration() {
        const config = {
            version: '1.0',
            settings: {
                masterVolume: this.masterVolume,
                fadeRadius: this.fadeRadius,
                fadeSpeed: this.fadeSpeed,
                physicsEnabled: this.physicsEnabled,
                physicsStrength: this.physicsStrength,
                driftStrength: this.driftStrength,
                mouseRepulsion: this.mouseRepulsion,
                sourceRepulsion: this.sourceRepulsion,
                orbitalStrength: this.orbitalStrength,
                orbitalSpeed: this.orbitalSpeed,
                spatialAudioEnabled: this.spatialAudioEnabled,
                spatialAudioStrength: this.spatialAudioStrength,
                reverbEnabled: this.reverbEnabled,
                reverbAmount: this.reverbAmount
            },
            sources: this.sources.map(source => ({
                name: source.name,
                editableTitle: source.editableTitle,
                color: source.color,
                x: source.x,
                y: source.y,
                baseX: source.baseX,
                baseY: source.baseY,
                driftAngle: source.driftAngle,
                driftSpeed: source.driftSpeed,
                orbitalAngle: source.orbitalAngle,
                orbitalRadius: source.orbitalRadius,
                orbitalSpeed: source.orbitalSpeed,
                orbitalDirection: source.orbitalDirection,
                // Store audio URL if available (preferred over embedded audio)
                audioUrl: source.audioUrl || null,
                // Store audio data as base64 (only if no URL available)
                audioData: null // Will be populated if exporting with audio and no URL
            }))
        };

        // Debug: Log what's being exported
        console.log(`📤 Exporting config: ${this.sources.length} sources`);
        console.log(`   Physics enabled: ${config.settings.physicsEnabled}, strength: ${config.settings.physicsStrength}`);
        console.log(`   Orbital strength: ${config.settings.orbitalStrength}, speed: ${config.settings.orbitalSpeed}`);
        if (this.sources.length > 0) {
            const firstSource = config.sources[0];
            console.log(`   First source physics: driftAngle=${firstSource.driftAngle?.toFixed(2)}, orbitalRadius=${firstSource.orbitalRadius?.toFixed(0)}, orbitalSpeed=${firstSource.orbitalSpeed?.toFixed(4)}`);
        }

        return JSON.stringify(config, null, 2);
    }

    // Export configuration with audio files as base64 (larger file)
    async exportConfigurationWithAudio(progressCallback = null) {
        if (this.sources.length === 0) {
            throw new Error('No audio sources to export');
        }

        const config = {
            version: '1.0',
            settings: {
                masterVolume: this.masterVolume,
                fadeRadius: this.fadeRadius,
                fadeSpeed: this.fadeSpeed,
                physicsEnabled: this.physicsEnabled,
                physicsStrength: this.physicsStrength,
                driftStrength: this.driftStrength,
                mouseRepulsion: this.mouseRepulsion,
                sourceRepulsion: this.sourceRepulsion,
                orbitalStrength: this.orbitalStrength,
                orbitalSpeed: this.orbitalSpeed,
                spatialAudioEnabled: this.spatialAudioEnabled,
                spatialAudioStrength: this.spatialAudioStrength,
                reverbEnabled: this.reverbEnabled,
                reverbAmount: this.reverbAmount
            },
            sources: []
        };

        // Convert audio buffers to base64 with progress tracking
        const totalSources = this.sources.length;
        let processedSources = 0;

        // Report initial progress
        if (progressCallback) {
            progressCallback({
                stage: 'preparing',
                current: 0,
                total: totalSources,
                percent: 0,
                message: 'Preparing export...'
            });
        }

        for (let i = 0; i < this.sources.length; i++) {
            const source = this.sources[i];
            
            try {
                if (!source.audioBuffer) {
                    console.warn(`Source ${i + 1} (${source.name}) has no audio buffer, skipping`);
                    continue;
                }

                const audioBuffer = source.audioBuffer;
                const fileName = source.name || `Source ${i + 1}`;
                const fileSizeMB = Math.round((audioBuffer.length * audioBuffer.numberOfChannels * 2) / 1024 / 1024);
                
                // Report progress before processing
                processedSources++;
                const progress = Math.round((processedSources / totalSources) * 100);
                
                if (progressCallback) {
                    progressCallback({
                        stage: 'processing',
                        current: processedSources,
                        total: totalSources,
                        percent: progress,
                        message: `Processing: ${fileName}`,
                        details: `${fileSizeMB}MB • ${Math.round(audioBuffer.duration)}s`
                    });
                }
                
                // If source has an audioUrl, use that instead of embedding
                if (source.audioUrl) {
                    config.sources.push({
                        name: source.name,
                        editableTitle: source.editableTitle,
                        color: source.color,
                        x: source.x,
                        y: source.y,
                        baseX: source.baseX,
                        baseY: source.baseY,
                        driftAngle: source.driftAngle,
                        driftSpeed: source.driftSpeed,
                        orbitalAngle: source.orbitalAngle,
                        orbitalRadius: source.orbitalRadius,
                        orbitalSpeed: source.orbitalSpeed,
                        orbitalDirection: source.orbitalDirection,
                        audioUrl: source.audioUrl // Use URL instead of embedding
                    });
                } else {
                    // No URL available, embed as Base64
                    const audioData = await this.audioBufferToBase64(audioBuffer, (chunkProgress) => {
                        // Report chunk-level progress for large files
                        if (progressCallback && chunkProgress) {
                            const overallPercent = Math.round(
                                ((processedSources - 1) / totalSources) * 100 + 
                                (chunkProgress / totalSources)
                            );
                            progressCallback({
                                stage: 'processing',
                                current: processedSources,
                                total: totalSources,
                                percent: overallPercent,
                                message: `Encoding: ${fileName}`,
                                details: `${fileSizeMB}MB • ${Math.round(chunkProgress)}% encoded`
                            });
                        }
                    });
                    
                    config.sources.push({
                        name: source.name,
                        editableTitle: source.editableTitle,
                        color: source.color,
                        x: source.x,
                        y: source.y,
                        baseX: source.baseX,
                        baseY: source.baseY,
                        driftAngle: source.driftAngle,
                        driftSpeed: source.driftSpeed,
                        orbitalAngle: source.orbitalAngle,
                        orbitalRadius: source.orbitalRadius,
                        orbitalSpeed: source.orbitalSpeed,
                        orbitalDirection: source.orbitalDirection,
                        audioData: audioData,
                        sampleRate: audioBuffer.sampleRate,
                        numberOfChannels: audioBuffer.numberOfChannels,
                        duration: audioBuffer.duration
                    });
                }
                    
                    // Debug: Log physics properties for each source
                    console.log(`   Source "${source.name}": driftAngle=${source.driftAngle?.toFixed(2)}, orbitalRadius=${source.orbitalRadius?.toFixed(0)}, orbitalSpeed=${source.orbitalSpeed?.toFixed(4)}`);
            } catch (error) {
                console.error(`Error exporting source ${i + 1} (${source.name}):`, error);
                throw new Error(`Failed to export source "${source.name}": ${error.message}`);
            }
        }

        if (config.sources.length === 0) {
            throw new Error('No valid audio sources could be exported');
        }

        // Report finalizing stage
        if (progressCallback) {
            progressCallback({
                stage: 'finalizing',
                current: totalSources,
                total: totalSources,
                percent: 95,
                message: 'Finalizing export...'
            });
        }

        // Small delay to show finalizing message
        await new Promise(resolve => setTimeout(resolve, 100));

        const jsonString = JSON.stringify(config, null, 2);

        // Report complete
        if (progressCallback) {
            progressCallback({
                stage: 'complete',
                current: totalSources,
                total: totalSources,
                percent: 100,
                message: 'Export complete!'
            });
        }

        return jsonString;
    }

    // Convert AudioBuffer to base64
    async audioBufferToBase64(audioBuffer, progressCallback = null) {
        try {
            const numberOfChannels = audioBuffer.numberOfChannels;
            const length = audioBuffer.length;
            const sampleRate = audioBuffer.sampleRate;
            
            // Check for valid audio buffer
            if (!audioBuffer || length === 0 || numberOfChannels === 0) {
                throw new Error('Invalid audio buffer');
            }
            
            // Create a WAV file from the audio buffer
            const dataSize = length * numberOfChannels * 2;
            const bufferSize = 44 + dataSize;
            
            // Check if buffer size is reasonable (prevent memory issues)
            // Increased limit to 500MB to accommodate longer/higher quality audio files
            const maxSize = 500 * 1024 * 1024; // 500MB limit
            if (bufferSize > maxSize) {
                throw new Error(`Audio file too large (${Math.round(bufferSize / 1024 / 1024)}MB). Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB.`);
            }
            
            const buffer = new ArrayBuffer(bufferSize);
            const view = new DataView(buffer);
            
            // WAV header
            const writeString = (offset, string) => {
                for (let i = 0; i < string.length; i++) {
                    view.setUint8(offset + i, string.charCodeAt(i));
                }
            };
            
            writeString(0, 'RIFF');
            view.setUint32(4, 36 + dataSize, true);
            writeString(8, 'WAVE');
            writeString(12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true); // PCM format
            view.setUint16(22, numberOfChannels, true);
            view.setUint32(24, sampleRate, true);
            view.setUint32(28, sampleRate * numberOfChannels * 2, true);
            view.setUint16(32, numberOfChannels * 2, true);
            view.setUint16(34, 16, true);
            writeString(36, 'data');
            view.setUint32(40, dataSize, true);
            
            // Convert float samples to 16-bit PCM in chunks to avoid blocking
            let offset = 44;
            const chunkSize = 44100; // Process ~1 second at a time
            const totalChunks = Math.ceil(length / chunkSize);
            let processedChunks = 0;
            
            for (let chunkStart = 0; chunkStart < length; chunkStart += chunkSize) {
                const chunkEnd = Math.min(chunkStart + chunkSize, length);
                
                for (let i = chunkStart; i < chunkEnd; i++) {
                    for (let channel = 0; channel < numberOfChannels; channel++) {
                        // Clamp sample to valid range (-1 to 1)
                        let sample = audioBuffer.getChannelData(channel)[i];
                        sample = Math.max(-1, Math.min(1, sample));
                        
                        // Convert float (-1.0 to 1.0) to signed 16-bit PCM (-32768 to 32767)
                        // Use symmetric scaling: multiply by 32768 for both positive and negative
                        const intSample = Math.max(-32768, Math.min(32767, Math.round(sample * 32768)));
                        view.setInt16(offset, intSample, true);
                        offset += 2;
                    }
                }
                
                processedChunks++;
                const chunkProgress = Math.round((processedChunks / totalChunks) * 100);
                
                // Report progress for this chunk
                if (progressCallback) {
                    progressCallback(chunkProgress);
                }
                
                // Yield to prevent blocking (process in chunks)
                if (chunkStart + chunkSize < length) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }
            
            // Convert to base64 using more efficient method
            const bytes = new Uint8Array(buffer);
            
            // Use btoa with proper handling for large strings
            try {
                // For very large buffers, convert in chunks
                if (bytes.length > 50 * 1024 * 1024) { // 50MB threshold (increased for larger files)
                    const chunkSize = 10 * 1024 * 1024; // 10MB chunks (base64 is ~33% larger)
                    let base64 = '';
                    
                    for (let i = 0; i < bytes.length; i += chunkSize) {
                        const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
                        const chunkBinary = Array.from(chunk).map(b => String.fromCharCode(b)).join('');
                        base64 += btoa(chunkBinary);
                        
                        // Yield periodically
                        if (i + chunkSize < bytes.length) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }
                    }
                    
                    return base64;
                } else {
                    // Small enough to convert all at once
                    const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
                    return btoa(binary);
                }
            } catch (e) {
                throw new Error(`Failed to encode audio to base64: ${e.message}`);
            }
        } catch (error) {
            console.error('Error converting audio buffer to base64:', error);
            throw error;
        }
    }

    // Import configuration from JSON
    async importConfiguration(configJson, audioFiles = null) {
        try {
            const config = typeof configJson === 'string' ? JSON.parse(configJson) : configJson;
            
            // Clear existing sources immediately (clearAll is now synchronous)
            console.log(`Clearing ${this.sources.length} existing sources before import...`);
            this.clearAll();
            
            // Verify sources are cleared
            if (this.sources.length > 0) {
                console.error(`Warning: Sources not cleared! Still have ${this.sources.length} sources. Force clearing...`);
                this.sources.forEach(source => {
                    if (source.gainNode) {
                        try { source.gainNode.disconnect(); } catch(e) {}
                    }
                    if (source.pannerNode) {
                        try { source.pannerNode.disconnect(); } catch(e) {}
                    }
                    if (source.reverbGain) {
                        try { source.reverbGain.disconnect(); } catch(e) {}
                    }
                    if (source.dryGain) {
                        try { source.dryGain.disconnect(); } catch(e) {}
                    }
                    if (source.source) {
                        try { 
                            source.source.stop();
                            source.source.disconnect();
                        } catch(e) {}
                    }
                });
                this.sources = [];
                this.updateSourceCount();
                this.updateSourceEditor();
                this.draw();
            }
            
            // Small delay to ensure audio context is ready
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Apply settings
            if (config.settings) {
                this.masterVolume = config.settings.masterVolume ?? this.masterVolume;
                this.fadeRadius = config.settings.fadeRadius ?? this.fadeRadius;
                this.fadeSpeed = config.settings.fadeSpeed ?? this.fadeSpeed;
                
                // Import physics settings - use config value if present, otherwise keep default (true)
                this.physicsEnabled = config.settings.physicsEnabled !== undefined ? config.settings.physicsEnabled : true;
                this.physicsStrength = config.settings.physicsStrength ?? this.physicsStrength;
                this.driftStrength = config.settings.driftStrength ?? this.driftStrength;
                this.mouseRepulsion = config.settings.mouseRepulsion ?? this.mouseRepulsion;
                this.sourceRepulsion = config.settings.sourceRepulsion ?? this.sourceRepulsion;
                this.orbitalStrength = config.settings.orbitalStrength ?? this.orbitalStrength;
                this.orbitalSpeed = config.settings.orbitalSpeed ?? this.orbitalSpeed;
                
                this.spatialAudioEnabled = config.settings.spatialAudioEnabled !== undefined ? config.settings.spatialAudioEnabled : this.spatialAudioEnabled;
                this.spatialAudioStrength = config.settings.spatialAudioStrength ?? this.spatialAudioStrength;
                this.reverbEnabled = config.settings.reverbEnabled !== undefined ? config.settings.reverbEnabled : this.reverbEnabled;
                this.reverbAmount = config.settings.reverbAmount ?? this.reverbAmount;
                
                console.log(`✓ Physics settings imported: enabled=${this.physicsEnabled}, strength=${this.physicsStrength}, orbital=${this.orbitalStrength}, drift=${this.driftStrength}`);
                
                // Update UI controls
                this.updateUIControls();
            } else {
                // No settings in config - ensure physics are enabled by default
                this.physicsEnabled = true;
                console.log(`✓ No settings in config, using defaults. Physics enabled: ${this.physicsEnabled}`);
            }
            
            // Final verification - ensure physics are enabled
            if (!this.physicsEnabled) {
                console.warn(`⚠ Physics are disabled in config. Enabling by default for player...`);
                this.physicsEnabled = true;
            }
            
            // Ensure physics strength is not zero
            if (this.physicsStrength === 0) {
                console.warn(`⚠ Physics strength is 0. Setting to default (1.0)...`);
                this.physicsStrength = 1.0;
            }
            
            console.log(`✓ Physics final state: enabled=${this.physicsEnabled}, strength=${this.physicsStrength}, orbital=${this.orbitalStrength}`);
            
            // Verify animation loop is running
            if (this.animationFrameId === null) {
                console.warn(`⚠ Animation loop not running! Restarting...`);
                this.startAnimationLoop();
            } else {
                console.log(`✓ Animation loop running (ID: ${this.animationFrameId})`);
            }
            
            // Load sources
            if (config.sources && config.sources.length > 0) {
                // Ensure sources array is completely empty before importing
                console.log(`📥 Importing ${config.sources.length} sources. Current sources before clear: ${this.sources.length}`);
                
                // Debug: Check first source's physics properties
                if (config.sources.length > 0) {
                    const firstSource = config.sources[0];
                    console.log(`   First source config: driftAngle=${firstSource.driftAngle}, orbitalRadius=${firstSource.orbitalRadius}, orbitalSpeed=${firstSource.orbitalSpeed}`);
                }
                
                // Force clear sources array
                this.sources.length = 0;
                this.updateSourceCount();
                this.updateSourceEditor();
                
                // Small delay to ensure UI updates
                await new Promise(resolve => setTimeout(resolve, 50));
                
                console.log(`Sources cleared. Starting import of ${config.sources.length} sources...`);
                
                for (let i = 0; i < config.sources.length; i++) {
                    const sourceConfig = config.sources[i];
                    let audioBuffer;
                    
                    // Priority 1: Load from URL if available (best for large files)
                    if (sourceConfig.audioUrl) {
                        try {
                            console.log(`Loading audio from URL: ${sourceConfig.audioUrl}`);
                            const response = await fetch(sourceConfig.audioUrl);
                            if (!response.ok) {
                                throw new Error(`Failed to fetch audio: ${response.status} ${response.statusText}`);
                            }
                            const arrayBuffer = await response.arrayBuffer();
                            audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                            console.log(`✓ Audio loaded from URL: ${sourceConfig.audioUrl}`);
                        } catch (error) {
                            console.error(`Error loading audio from URL ${sourceConfig.audioUrl}:`, error);
                            // Fall through to try other methods
                        }
                    }
                    
                    // Priority 2: If audio data is embedded in config
                    if (!audioBuffer && sourceConfig.audioData) {
                        try {
                            audioBuffer = await this.base64ToAudioBuffer(
                                sourceConfig.audioData,
                                sourceConfig.sampleRate,
                                sourceConfig.numberOfChannels
                            );
                            console.log(`✓ Audio loaded from embedded Base64 data`);
                        } catch (error) {
                            console.error(`Error loading embedded audio:`, error);
                        }
                    }
                    
                    // Priority 3: If audio files are provided separately
                    if (!audioBuffer && audioFiles && audioFiles[i]) {
                        try {
                            const arrayBuffer = await audioFiles[i].arrayBuffer();
                            audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                            console.log(`✓ Audio loaded from provided file`);
                        } catch (error) {
                            console.error(`Error loading audio file:`, error);
                        }
                    }
                    
                    if (!audioBuffer) {
                        console.warn(`No audio data available for source ${i + 1} (${sourceConfig.name}), skipping`);
                        continue;
                    }
                    
                    // Create source with saved position and settings
                    const sourcesBefore = this.sources.length;
                    try {
                        await this.addAudioSourceFromConfig(sourceConfig, audioBuffer);
                        console.log(`✓ Source ${i + 1}/${config.sources.length} added: "${sourceConfig.name}" (total: ${this.sources.length})`);
                    } catch (sourceError) {
                        console.error(`❌ Error adding source ${i + 1} "${sourceConfig.name}":`, sourceError);
                        // Continue with next source instead of failing completely
                    }
                    
                    // Store the audio URL if it was loaded from URL
                    if (sourceConfig.audioUrl && this.sources.length > sourcesBefore) {
                        const addedSource = this.sources[this.sources.length - 1];
                        addedSource.audioUrl = sourceConfig.audioUrl;
                    }
                    
                    // Verify source was added (debug check)
                    if (this.sources.length !== i + 1) {
                        console.warn(`⚠️ Source count mismatch: expected ${i + 1}, got ${this.sources.length}`);
                    }
                }
                
                console.log(`✅ Import complete: ${this.sources.length} sources imported from ${config.sources.length} config entries`);
            }
            
            this.updateStatus('Configuration imported successfully');
            return true;
        } catch (error) {
            console.error('Error importing configuration:', error);
            alert(`Error importing configuration: ${error.message}`);
            return false;
        }
    }

    // Convert base64 to AudioBuffer
    async base64ToAudioBuffer(base64, sampleRate, numberOfChannels) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        
        // Calculate audio buffer length (skip 44-byte WAV header)
        const dataLength = bytes.length - 44;
        const samplesPerChannel = dataLength / (numberOfChannels * 2);
        
        // Decode WAV file
        const audioBuffer = this.audioContext.createBuffer(numberOfChannels, samplesPerChannel, sampleRate);
        
        // Convert signed 16-bit PCM (little-endian) to float samples (-1.0 to 1.0)
        // Use DataView for proper signed integer reading
        const view = new DataView(bytes.buffer, 44); // Start after WAV header
        let byteOffset = 0;
        
        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                // Read signed 16-bit little-endian integer correctly
                const intSample = view.getInt16(byteOffset, true);
                // Convert to float (-1.0 to 1.0) by dividing by 32768.0
                // This ensures symmetric conversion matching the export function
                const sample = intSample / 32768.0;
                // Clamp to valid range to prevent any overflow issues
                audioBuffer.getChannelData(channel)[i] = Math.max(-1, Math.min(1, sample));
                byteOffset += 2; // Move to next 16-bit sample
            }
        }
        
        return audioBuffer;
    }

    // Add audio source from configuration
    async addAudioSourceFromConfig(sourceConfig, audioBuffer) {
        console.log(`🔧 Adding source from config: "${sourceConfig.name}" at (${sourceConfig.x}, ${sourceConfig.y})`);
        
        if (!this.audioContext) {
            await this.initAudioContext();
        }

        try {
            // Try to resume audio context if suspended (may fail without user interaction)
            if (this.audioContext.state === 'suspended') {
                try {
                    await this.audioContext.resume();
                    console.log('✓ Audio context resumed');
                } catch (resumeError) {
                    console.warn('⚠️ Could not resume audio context (requires user interaction):', resumeError.message);
                    // Continue anyway - sources will be added but won't play until user interacts
                }
            }
            
            console.log(`📦 Creating source object for "${sourceConfig.name}"...`);

            const source = {
                id: Date.now() + Math.random(),
                name: sourceConfig.name,
                editableTitle: sourceConfig.editableTitle || sourceConfig.name,
                color: sourceConfig.color || `hsl(${Math.random() * 360}, 80%, 60%)`,
                audioBuffer: audioBuffer,
                source: null,
                gainNode: null,
                x: sourceConfig.x,
                y: sourceConfig.y,
                baseX: sourceConfig.baseX || sourceConfig.x,
                baseY: sourceConfig.baseY || sourceConfig.y,
                vx: 0, // Velocity X - required for physics
                vy: 0, // Velocity Y - required for physics
                currentVolume: 0,
                targetVolume: 0,
                isPlaying: false,
                driftAngle: sourceConfig.driftAngle ?? Math.random() * Math.PI * 2,
                driftSpeed: sourceConfig.driftSpeed ?? 0.5 + Math.random() * 0.5,
                orbitalAngle: sourceConfig.orbitalAngle ?? Math.random() * Math.PI * 2,
                orbitalRadius: sourceConfig.orbitalRadius ?? 120 + Math.random() * 80,
                orbitalSpeed: sourceConfig.orbitalSpeed ?? 0.015 + Math.random() * 0.01,
                orbitalDirection: sourceConfig.orbitalDirection ?? (Math.random() > 0.5 ? 1 : -1)
            };
            
            // Verify physics properties are set
            console.log(`✓ Source "${source.name}" imported with physics:`);
            console.log(`   driftAngle=${source.driftAngle.toFixed(2)}, driftSpeed=${source.driftSpeed.toFixed(2)}`);
            console.log(`   orbitalRadius=${source.orbitalRadius.toFixed(0)}, orbitalSpeed=${source.orbitalSpeed.toFixed(4)}, orbitalDirection=${source.orbitalDirection}`);
            console.log(`   Position: (${source.x.toFixed(0)}, ${source.y.toFixed(0)}), Base: (${source.baseX.toFixed(0)}, ${source.baseY.toFixed(0)})`);

            // Create gain node (even if audio context is suspended - nodes can be created)
            try {
                source.gainNode = this.audioContext.createGain();
                source.gainNode.gain.value = 0;
                console.log(`✓ Gain node created for "${source.name}"`);
            } catch (gainError) {
                console.error(`❌ Error creating gain node for "${source.name}":`, gainError);
                // Don't throw - add source anyway, audio can be fixed later
                source.gainNode = null;
                console.warn(`⚠️ Continuing without gain node for "${source.name}" - will be created on play`);
            }
            
            // Create spatial audio panner (only if gain node was created)
            if (source.gainNode) {
                if (this.spatialAudioEnabled && this.audioContext.createPanner) {
                    try {
                        source.pannerNode = this.audioContext.createPanner();
                        source.pannerNode.panningModel = 'HRTF';
                        source.pannerNode.distanceModel = 'linear';
                        source.pannerNode.refDistance = this.maxDistance;
                        source.pannerNode.maxDistance = this.maxDistance * 2;
                        source.pannerNode.rolloffFactor = 0;
                        source.pannerNode.coneInnerAngle = 360;
                        source.pannerNode.coneOuterAngle = 0;
                        source.pannerNode.coneOuterGain = 0;
                        
                        source.gainNode.connect(source.pannerNode);
                        
                        if (this.reverbEnabled && this.convolverNode && this.reverbSendGain) {
                            // Create reverb send - connect to shared reverb send gain
                            source.reverbGain = this.audioContext.createGain();
                            source.reverbGain.gain.value = this.reverbAmount * 0.2; // Individual source reverb send level
                            source.pannerNode.connect(source.reverbGain);
                            source.reverbGain.connect(this.reverbSendGain); // Connect to shared reverb send
                            
                            // Direct connection (dry signal) - slightly reduced when reverb is active
                            source.dryGain = this.audioContext.createGain();
                            source.dryGain.gain.value = 0.9; // Slightly reduced dry signal
                            source.pannerNode.connect(source.dryGain);
                            source.dryGain.connect(this.masterGainNode);
                        } else {
                            source.pannerNode.connect(this.masterGainNode);
                        }
                        console.log(`✓ Panner created for "${source.name}"`);
                    } catch (pannerError) {
                        console.warn(`⚠️ Error creating panner for "${source.name}", using direct connection:`, pannerError);
                        // Fall back to direct connection - don't throw, just continue
                        try {
                            source.gainNode.connect(this.masterGainNode);
                        } catch (connectError) {
                            console.error(`❌ Error connecting gain node for "${source.name}":`, connectError);
                            // Still add the source even if audio connection fails - it can be fixed later
                        }
                    }
                } else {
                    try {
                        source.gainNode.connect(this.masterGainNode);
                        console.log(`✓ Gain node connected directly for "${source.name}"`);
                    } catch (connectError) {
                        console.error(`❌ Error connecting gain node for "${source.name}":`, connectError);
                        // Still add the source even if audio connection fails
                    }
                }
            } else {
                console.warn(`⚠️ No gain node for "${source.name}" - source will be added but won't play until audio is fixed`);
            }

            // Check for duplicate before adding (by ID, name+position, or exact match)
            const existingSource = this.sources.find(s => 
                s.id === source.id ||
                (s.name === source.name && 
                 Math.abs(s.x - source.x) < 1 && 
                 Math.abs(s.y - source.y) < 1) ||
                (s.audioBuffer === source.audioBuffer && 
                 Math.abs(s.x - source.x) < 1 && 
                 Math.abs(s.y - source.y) < 1)
            );
            
            if (existingSource) {
                console.warn(`Duplicate source detected: ${source.name} at (${source.x}, ${source.y}), skipping. Current count: ${this.sources.length}`);
                return;
            }
            
            // Verify we're not exceeding expected count
            const expectedCount = this.sources.length + 1;
            console.log(`📝 Adding source "${source.name}" to array (before: ${this.sources.length}, expected: ${expectedCount})`);
            this.sources.push(source);
            console.log(`✅ Source "${source.name}" pushed! New count: ${this.sources.length}`);
            
            if (this.sources.length !== expectedCount) {
                console.error(`❌ Source count mismatch! Expected ${expectedCount}, got ${this.sources.length}`);
            } else {
                console.log(`✓ Source count correct: ${this.sources.length}`);
            }
            this.updateSourceCount();
            this.updateSourceEditor();
            this.draw();
            console.log(`✓ Draw called after adding "${source.name}"`);

            if (this.isPlaying) {
                this.startSource(source);
                if (source.gainNode) {
                    source.gainNode.gain.value = 0;
                }
            }
        } catch (error) {
            console.error('Error adding audio source from config:', error);
            throw error;
        }
    }

    // Update UI controls with current settings
    updateUIControls() {
        const masterVolumeSlider = document.getElementById('masterVolume');
        if (masterVolumeSlider) {
            masterVolumeSlider.value = this.masterVolume * 100;
            document.getElementById('masterVolumeValue').textContent = Math.round(this.masterVolume * 100) + '%';
            if (this.masterGainNode) {
                this.masterGainNode.gain.value = this.masterVolume;
            }
        }

        const fadeRadiusSlider = document.getElementById('fadeRadius');
        if (fadeRadiusSlider) {
            fadeRadiusSlider.value = this.fadeRadius;
            document.getElementById('fadeRadiusValue').textContent = this.fadeRadius + 'px';
        }

        const fadeSpeedSlider = document.getElementById('fadeSpeed');
        if (fadeSpeedSlider) {
            fadeSpeedSlider.value = this.fadeSpeed;
            document.getElementById('fadeSpeedValue').textContent = this.fadeSpeed + 's';
        }

        const physicsEnabledCheckbox = document.getElementById('physicsEnabled');
        if (physicsEnabledCheckbox) {
            physicsEnabledCheckbox.checked = this.physicsEnabled;
        }

        const physicsStrengthSlider = document.getElementById('physicsStrength');
        if (physicsStrengthSlider) {
            physicsStrengthSlider.value = this.physicsStrength;
            document.getElementById('physicsStrengthValue').textContent = Math.round(this.physicsStrength * 100) + '%';
        }

        const driftStrengthSlider = document.getElementById('driftStrength');
        if (driftStrengthSlider) {
            driftStrengthSlider.value = this.driftStrength;
            document.getElementById('driftStrengthValue').textContent = Math.round(this.driftStrength * 100) + '%';
        }

        const mouseRepulsionSlider = document.getElementById('mouseRepulsion');
        if (mouseRepulsionSlider) {
            mouseRepulsionSlider.value = this.mouseRepulsion;
            document.getElementById('mouseRepulsionValue').textContent = Math.round(this.mouseRepulsion * 100) + '%';
        }

        const sourceRepulsionSlider = document.getElementById('sourceRepulsion');
        if (sourceRepulsionSlider) {
            sourceRepulsionSlider.value = this.sourceRepulsion;
            document.getElementById('sourceRepulsionValue').textContent = Math.round(this.sourceRepulsion * 100) + '%';
        }

        const orbitalStrengthSlider = document.getElementById('orbitalStrength');
        if (orbitalStrengthSlider) {
            orbitalStrengthSlider.value = this.orbitalStrength;
            document.getElementById('orbitalStrengthValue').textContent = Math.round(this.orbitalStrength * 100) + '%';
        }

        const orbitalSpeedSlider = document.getElementById('orbitalSpeed');
        if (orbitalSpeedSlider) {
            orbitalSpeedSlider.value = this.orbitalSpeed;
            document.getElementById('orbitalSpeedValue').textContent = Math.round((this.orbitalSpeed / 0.1) * 100) + '%';
        }
    }

    // Download configuration as file
    async downloadConfiguration(includeAudio = false, progressCallback = null) {
        try {
            const configJson = includeAudio 
                ? await this.exportConfigurationWithAudio(progressCallback) 
                : this.exportConfiguration();
            
            const blob = new Blob([configJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `audio-hover-config${includeAudio ? '-with-audio' : ''}-${Date.now()}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.updateStatus(includeAudio 
                ? 'Configuration with audio exported successfully' 
                : 'Configuration exported successfully (audio files not included)');
        } catch (error) {
            console.error('Error exporting configuration:', error);
            throw error;
        }
    }
}

// Auto-initialize only if not already initialized by the HTML file
// This allows index.html to work automatically, while builder.html and player.html can control initialization
document.addEventListener('DOMContentLoaded', () => {
    // Only auto-initialize if no instance exists (prevents double initialization)
    if (!window.audioHover) {
        window.audioHover = new InteractiveAudioHover();
        
        // Update mouse position display periodically (only if elements exist)
        setInterval(() => {
            if (window.audioHover) {
                // These methods already check for element existence internally
                window.audioHover.updateMousePos();
                window.audioHover.updateSourceInfo();
            }
        }, 100);
    }
});

