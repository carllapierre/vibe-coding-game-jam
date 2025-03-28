import { AudioRegistry } from '../registries/AudioRegistry.js';

export class RadioPlayer {
    static #currentAudio = null;
    static #currentSongId = null;
    static #volume = 0.005;
    static #isMuted = false;
    static #isPlaying = false;
    static #songQueue = [];
    static #fadeInterval = null;
    static #fadeTime = 2000; // Crossfade time in ms
    static #isInitialized = false;
    static #pendingPlay = false;
    
    // Audio processing
    static #audioContext = null;
    static #gainNode = null;
    static #delayNode = null;
    static #audioSource = null;
    
    /**
     * Initialize the radio player without auto-playing
     */
    static initialize() {
        // Initialize Web Audio API for effects
        this.#initAudioContext();
        
        // Filter out only song type items from AudioRegistry
        const songItems = AudioRegistry.items.filter(item => item.type === 'song');
        
        if (songItems.length === 0) {
            console.warn('No songs found in AudioRegistry. RadioPlayer will not play anything.');
            return;
        }
        
        // Create a shuffled queue of songs
        this.#songQueue = this.#shuffleArray([...songItems]);
        
        // Mark as initialized but don't auto-play
        this.#isInitialized = true;
        this.#pendingPlay = true;
        
        // Setup user interaction detection to start playback
        this.#setupAutoplayHandler();
        
        console.log('Radio player initialized. Will start playing after user interaction.');
    }
    
    /**
     * Setup handlers to start playback after user interaction
     */
    static #setupAutoplayHandler() {
        const startPlayback = () => {
            if (this.#pendingPlay) {
                console.log('Starting radio playback after user interaction');
                this.play();
                this.#pendingPlay = false;
            }
            
            // Remove listeners after first interaction
            document.removeEventListener('click', startPlayback);
            document.removeEventListener('keydown', startPlayback);
            document.removeEventListener('touchstart', startPlayback);
        };
        
        // Add event listeners for common user interactions
        document.addEventListener('click', startPlayback);
        document.addEventListener('keydown', startPlayback);
        document.addEventListener('touchstart', startPlayback);
    }
    
    /**
     * Initialize the Web Audio API context and effect nodes
     */
    static #initAudioContext() {
        // Create audio context
        this.#audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create gain node for volume control
        this.#gainNode = this.#audioContext.createGain();
        this.#gainNode.gain.value = this.#volume;
        
        // Create delay node for echo effect
        this.#delayNode = this.#audioContext.createDelay(0.1);
        this.#delayNode.delayTime.value = 0.02; // 20ms delay
        
        // Create a feedback gain for the echo
        const feedbackGain = this.#audioContext.createGain();
        feedbackGain.gain.value = 0.02; // Echo volume (0-1)
        
        // Connect nodes: gain -> output and gain -> delay -> feedback -> gain
        this.#gainNode.connect(this.#audioContext.destination);
        this.#gainNode.connect(this.#delayNode);
        this.#delayNode.connect(feedbackGain);
        feedbackGain.connect(this.#delayNode); // Create feedback loop
        this.#delayNode.connect(this.#audioContext.destination); // Connect delay to output
    }
    
    /**
     * Start playing the radio
     */
    static play() {
        if (this.#isPlaying) return;
        
        // Resume audio context if it was suspended (autoplay policy)
        if (this.#audioContext && this.#audioContext.state === 'suspended') {
            this.#audioContext.resume();
        }
        
        if (!this.#currentSongId) {
            // Select the first song from the queue if none is playing
            const nextSong = this.#songQueue.shift();
            this.#songQueue.push(nextSong); // Move to the end of the queue
            this.#currentSongId = nextSong.id;
        }
        
        this.#playSong(this.#currentSongId);
        this.#isPlaying = true;
    }
    
    /**
     * Pause the currently playing song
     */
    static pause() {
        if (!this.#isPlaying || !this.#currentAudio) return;
        
        this.#currentAudio.pause();
        if (this.#audioSource) {
            this.#audioSource.disconnect();
        }
        this.#isPlaying = false;
    }
    
    /**
     * Skip to the next song
     */
    static nextSong() {
        this.#fadeOutCurrentSong(() => {
            const nextSong = this.#songQueue.shift();
            this.#songQueue.push(nextSong); // Move to the end of the queue
            this.#currentSongId = nextSong.id;
            
            if (this.#isPlaying) {
                this.#playSong(this.#currentSongId);
            }
        });
    }
    
    /**
     * Set the radio volume
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    static setVolume(volume) {
        this.#volume = Math.max(0, Math.min(1, volume));
        
        // Update gain node volume if available
        if (this.#gainNode) {
            this.#gainNode.gain.value = this.#volume;
        }
        
        // Also update HTML audio element as fallback
        if (this.#currentAudio) {
            this.#currentAudio.volume = this.#volume;
        }
    }
    
    /**
     * Get the current radio volume
     * @returns {number} - Current volume level
     */
    static getVolume() {
        return this.#volume;
    }
    
    /**
     * Mute or unmute the radio
     * @param {boolean} muted - Whether to mute the radio
     */
    static setMuted(muted) {
        this.#isMuted = muted;
        
        // Update gain node if available
        if (this.#gainNode) {
            this.#gainNode.gain.value = muted ? 0 : this.#volume;
        }
        
        // Also update HTML audio element as fallback
        if (this.#currentAudio) {
            this.#currentAudio.muted = muted;
        }
    }
    
    /**
     * Check if the radio is muted
     * @returns {boolean} - Whether the radio is muted
     */
    static isMuted() {
        return this.#isMuted;
    }
    
    /**
     * Play a specific song by ID
     * @param {string} songId - ID of the song to play
     */
    static #playSong(songId) {
        const modelPath = AudioRegistry.getModelPath(songId);
        if (!modelPath) {
            console.error(`Cannot play song: ID '${songId}' not found in AudioRegistry`);
            return;
        }
        
        // Create a new audio element
        const audio = new Audio(modelPath);
        audio.dataset.radioPlayer = true;
        audio.crossOrigin = "anonymous"; // Needed for Web Audio API to process audio
        
        // Disconnect previous audio source if exists
        if (this.#audioSource) {
            this.#audioSource.disconnect();
        }
        
        // Connect to Web Audio API for echo effect
        if (this.#audioContext) {
            // Resume audio context if it was suspended
            if (this.#audioContext.state === 'suspended') {
                this.#audioContext.resume();
            }
            
            // Create new audio source from the HTML audio element
            this.#audioSource = this.#audioContext.createMediaElementSource(audio);
            
            // Connect to effect chain: source -> gain node (which is already connected to delay)
            this.#audioSource.connect(this.#gainNode);
            
            // Volume is handled by gain node
            audio.volume = 1.0;
        } else {
            // Fallback if Web Audio API failed to initialize
            audio.volume = this.#volume;
        }
        
        audio.muted = this.#isMuted;
        
        // Handle song completion
        audio.onended = () => this.nextSong();
        
        // Start playing
        audio.play().catch(e => console.error(`Error playing song ${songId}:`, e));
        
        // Store reference
        this.#currentAudio = audio;
        this.#currentSongId = songId;
    }
    
    /**
     * Fade out the current song and then execute a callback
     * @param {Function} callback - Function to call after fade
     */
    static #fadeOutCurrentSong(callback) {
        if (!this.#currentAudio) {
            if (callback) callback();
            return;
        }
        
        // If using Web Audio API
        if (this.#gainNode && this.#audioSource) {
            const currentVolume = this.#gainNode.gain.value;
            const fadeSteps = 20;
            const stepTime = this.#fadeTime / fadeSteps;
            let step = 0;
            
            const fadeInterval = setInterval(() => {
                step++;
                const newVolume = currentVolume * (1 - step/fadeSteps);
                this.#gainNode.gain.setValueAtTime(newVolume, this.#audioContext.currentTime);
                
                if (step >= fadeSteps) {
                    clearInterval(fadeInterval);
                    this.#currentAudio.pause();
                    this.#audioSource.disconnect();
                    this.#audioSource = null;
                    this.#currentAudio = null;
                    
                    // Reset gain for next song
                    this.#gainNode.gain.setValueAtTime(this.#volume, this.#audioContext.currentTime);
                    
                    if (callback) callback();
                }
            }, stepTime);
        } else {
            // Fallback to standard HTML Audio fading
            const startVolume = this.#currentAudio.volume;
            const fadeStep = startVolume / (this.#fadeTime / 50);
            
            clearInterval(this.#fadeInterval);
            
            this.#fadeInterval = setInterval(() => {
                if (this.#currentAudio.volume > fadeStep) {
                    this.#currentAudio.volume -= fadeStep;
                } else {
                    clearInterval(this.#fadeInterval);
                    this.#currentAudio.pause();
                    this.#currentAudio = null;
                    
                    if (callback) callback();
                }
            }, 50);
        }
    }
    
    /**
     * Shuffle an array using Fisher-Yates algorithm
     * @param {Array} array - Array to shuffle
     * @returns {Array} - Shuffled array
     */
    static #shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
} 