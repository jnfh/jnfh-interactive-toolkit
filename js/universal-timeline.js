/**
 * Universal Timeline Controller
 * Synchronizes playback across multiple interactive audio elements
 */

class UniversalTimeline {
    constructor(options = {}) {
        this.players = new Map(); // Map of playerId -> player object
        this.isPlaying = false;
        this.currentTime = 0; // Current playback position in seconds
        this.duration = 0; // Maximum duration across all players
        this.startTime = null; // Audio context time when playback started
        this.pauseTime = 0; // Time position when paused
        this.animationFrameId = null;
        
        // UI elements (will be set when UI is initialized)
        this.uiContainer = null;
        this.playPauseBtn = null;
        this.timelineSlider = null;
        this.timeDisplay = null;
        
        // Options
        this.options = {
            autoUpdate: true,
            updateInterval: 50, // ms
            ...options
        };
        
        // Bind methods
        this.update = this.update.bind(this);
    }
    
    /**
     * Register a player with the timeline
     * @param {string} playerId - Unique identifier for the player
     * @param {Object} player - Player object with timeline interface
     * @param {Function} player.getCurrentTime - Returns current playback time in seconds
     * @param {Function} player.getDuration - Returns total duration in seconds
     * @param {Function} player.seek - Seeks to a specific time position
     * @param {Function} player.play - Starts playback
     * @param {Function} player.pause - Pauses playback
     * @param {Function} player.isPlaying - Returns whether player is currently playing
     */
    registerPlayer(playerId, player) {
        if (!player || typeof player !== 'object') {
            console.error('Invalid player object:', player);
            return;
        }
        
        // Validate required methods
        const requiredMethods = ['getCurrentTime', 'getDuration', 'seek', 'play', 'pause'];
        const missingMethods = requiredMethods.filter(method => typeof player[method] !== 'function');
        
        if (missingMethods.length > 0) {
            console.warn(`Player ${playerId} missing methods:`, missingMethods);
            console.warn('Timeline control may be limited for this player');
        }
        
        this.players.set(playerId, player);
        this.updateDuration();
        
        console.log(`✓ Registered player: ${playerId}`);
    }
    
    /**
     * Unregister a player
     */
    unregisterPlayer(playerId) {
        this.players.delete(playerId);
        this.updateDuration();
        console.log(`✓ Unregistered player: ${playerId}`);
    }
    
    /**
     * Update the maximum duration from all players
     */
    updateDuration() {
        let maxDuration = 0;
        this.players.forEach((player, id) => {
            try {
                const duration = player.getDuration ? player.getDuration() : 0;
                if (duration > maxDuration) {
                    maxDuration = duration;
                }
            } catch (error) {
                console.warn(`Error getting duration from player ${id}:`, error);
            }
        });
        this.duration = maxDuration;
    }
    
    /**
     * Get current playback time (synchronized across all players)
     */
    getCurrentTime() {
        if (this.isPlaying && this.startTime !== null) {
            // Calculate time based on when playback started
            const audioContext = this.getAudioContext();
            if (audioContext) {
                const elapsed = audioContext.currentTime - this.startTime;
                return this.pauseTime + elapsed;
            }
        }
        return this.pauseTime;
    }
    
    /**
     * Get audio context from any registered player
     */
    getAudioContext() {
        for (const [id, player] of this.players) {
            if (player.audioContext) {
                return player.audioContext;
            }
        }
        return null;
    }
    
    /**
     * Play all registered players
     */
    play() {
        if (this.isPlaying) return;
        
        const audioContext = this.getAudioContext();
        if (!audioContext) {
            console.warn('No audio context available');
            return;
        }
        
        this.isPlaying = true;
        this.startTime = audioContext.currentTime;
        
        // Play all players
        this.players.forEach((player, id) => {
            try {
                if (player.play) {
                    player.play();
                }
            } catch (error) {
                console.error(`Error playing player ${id}:`, error);
            }
        });
        
        // Start update loop
        if (this.options.autoUpdate) {
            this.startUpdateLoop();
        }
        
        this.updateUI();
    }
    
    /**
     * Pause all registered players
     */
    pause() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        this.pauseTime = this.getCurrentTime();
        this.startTime = null;
        
        // Pause all players
        this.players.forEach((player, id) => {
            try {
                if (player.pause) {
                    player.pause();
                }
            } catch (error) {
                console.error(`Error pausing player ${id}:`, error);
            }
        });
        
        this.stopUpdateLoop();
        this.updateUI();
    }
    
    /**
     * Stop all registered players and reset to beginning
     */
    stop() {
        this.isPlaying = false;
        this.pauseTime = 0;
        this.startTime = null;
        this.currentTime = 0;
        
        // Stop all players
        this.players.forEach((player, id) => {
            try {
                if (player.stop) {
                    player.stop();
                } else if (player.pause) {
                    player.pause();
                }
                if (player.seek) {
                    player.seek(0);
                }
            } catch (error) {
                console.error(`Error stopping player ${id}:`, error);
            }
        });
        
        this.stopUpdateLoop();
        this.updateUI();
    }
    
    /**
     * Seek all players to a specific time position
     */
    seek(time) {
        time = Math.max(0, Math.min(time, this.duration));
        this.pauseTime = time;
        this.currentTime = time;
        
        if (this.isPlaying) {
            const audioContext = this.getAudioContext();
            if (audioContext) {
                this.startTime = audioContext.currentTime;
            }
        }
        
        // Seek all players
        this.players.forEach((player, id) => {
            try {
                if (player.seek) {
                    player.seek(time);
                }
            } catch (error) {
                console.error(`Error seeking player ${id}:`, error);
            }
        });
        
        this.updateUI();
    }
    
    /**
     * Toggle play/pause
     */
    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    /**
     * Update loop for UI and synchronization
     */
    update() {
        if (this.isPlaying) {
            this.currentTime = this.getCurrentTime();
            
            // Check if we've reached the end
            if (this.duration > 0 && this.currentTime >= this.duration) {
                this.pause();
            }
        }
        
        this.updateUI();
        
        if (this.options.autoUpdate && this.isPlaying) {
            this.animationFrameId = requestAnimationFrame(this.update);
        }
    }
    
    /**
     * Start the update loop
     */
    startUpdateLoop() {
        if (this.animationFrameId === null) {
            this.animationFrameId = requestAnimationFrame(this.update);
        }
    }
    
    /**
     * Stop the update loop
     */
    stopUpdateLoop() {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
    
    /**
     * Create and initialize the timeline UI
     */
    createUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container element not found: ${containerId}`);
            console.error('Available IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
            return;
        }
        
        this.uiContainer = container;
        
        // Ensure container is visible
        container.style.display = 'block';
        container.style.visibility = 'visible';
        container.style.opacity = '1';
        
        // Create timeline HTML
        container.innerHTML = `
            <div class="universal-timeline">
                <div class="timeline-controls">
                    <button class="timeline-play-pause" id="timeline-play-pause" title="Play/Pause">
                        <span class="play-icon">▶</span>
                        <span class="pause-icon" style="display: none;">⏸</span>
                    </button>
                    <button class="timeline-stop" id="timeline-stop" title="Stop">⏹</button>
                    <div class="timeline-track">
                        <input type="range" class="timeline-slider" id="timeline-slider" 
                               min="0" max="100" value="0" step="0.1">
                        <div class="timeline-progress" style="width: 0%;"></div>
                    </div>
                    <div class="timeline-time">
                        <span id="timeline-current-time">0:00</span>
                        <span class="time-separator">/</span>
                        <span id="timeline-duration">0:00</span>
                    </div>
                </div>
            </div>
        `;
        
        console.log('Timeline UI created in container:', container);
        console.log('Timeline HTML:', container.innerHTML.substring(0, 200));
        
        // Verify the timeline element was created
        const timelineEl = container.querySelector('.universal-timeline');
        if (!timelineEl) {
            console.error('ERROR: Timeline element not found after creation!');
            return;
        }
        console.log('Timeline element verified:', timelineEl);
        
        // Get UI elements
        this.playPauseBtn = container.querySelector('#timeline-play-pause');
        this.stopBtn = container.querySelector('#timeline-stop');
        this.timelineSlider = container.querySelector('#timeline-slider');
        this.currentTimeDisplay = container.querySelector('#timeline-current-time');
        this.durationDisplay = container.querySelector('#timeline-duration');
        
        // Bind events
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.toggle());
        }
        
        if (this.stopBtn) {
            this.stopBtn.addEventListener('click', () => this.stop());
        }
        
        if (this.timelineSlider) {
            let isDragging = false;
            
            this.timelineSlider.addEventListener('mousedown', () => {
                isDragging = true;
            });
            
            this.timelineSlider.addEventListener('mouseup', () => {
                isDragging = false;
            });
            
            this.timelineSlider.addEventListener('input', (e) => {
                if (isDragging) {
                    const value = parseFloat(e.target.value);
                    const time = (value / 100) * this.duration;
                    this.seek(time);
                }
            });
            
            this.timelineSlider.addEventListener('change', (e) => {
                const value = parseFloat(e.target.value);
                const time = (value / 100) * this.duration;
                this.seek(time);
            });
        }
        
        // Initial UI update
        this.updateUI();
        
        console.log('Timeline UI initialized successfully');
    }
    
    /**
     * Update the timeline UI
     */
    updateUI() {
        if (!this.uiContainer) return;
        
        // Update play/pause button
        if (this.playPauseBtn) {
            const playIcon = this.playPauseBtn.querySelector('.play-icon');
            const pauseIcon = this.playPauseBtn.querySelector('.pause-icon');
            
            if (this.isPlaying) {
                if (playIcon) playIcon.style.display = 'none';
                if (pauseIcon) pauseIcon.style.display = 'inline';
            } else {
                if (playIcon) playIcon.style.display = 'inline';
                if (pauseIcon) pauseIcon.style.display = 'none';
            }
        }
        
        // Update slider
        if (this.timelineSlider) {
            if (this.duration > 0) {
                const percent = (this.currentTime / this.duration) * 100;
                this.timelineSlider.value = percent;
                this.timelineSlider.max = 100;
            } else {
                this.timelineSlider.value = 0;
                this.timelineSlider.max = 100;
            }
        }
        
        // Update progress bar
        const progressBar = this.uiContainer.querySelector('.timeline-progress');
        if (progressBar) {
            if (this.duration > 0) {
                const percent = (this.currentTime / this.duration) * 100;
                progressBar.style.width = percent + '%';
            } else {
                progressBar.style.width = '0%';
            }
        }
        
        // Update time displays
        if (this.currentTimeDisplay) {
            this.currentTimeDisplay.textContent = this.formatTime(this.currentTime);
        }
        
        if (this.durationDisplay) {
            this.durationDisplay.textContent = this.formatTime(this.duration);
        }
    }
    
    /**
     * Format time in MM:SS format
     */
    formatTime(seconds) {
        if (!isFinite(seconds) || seconds < 0) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Destroy the timeline and clean up
     */
    destroy() {
        this.stop();
        this.stopUpdateLoop();
        this.players.clear();
        
        if (this.uiContainer) {
            this.uiContainer.innerHTML = '';
        }
    }
}

// Export for use in modules or global scope
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UniversalTimeline;
} else {
    window.UniversalTimeline = UniversalTimeline;
}

