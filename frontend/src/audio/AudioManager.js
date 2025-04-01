import { AudioRegistry } from '../registries/AudioRegistry.js';

export class AudioManager {
    static #audioElements = new Map();
    static #sfxVolume = 1.0;
    static #isMuted = false;
    static #failedLoads = new Map(); // Track failed loads to avoid excessive retries

    /**
     * Play a sound identified by its ID in the AudioRegistry
     * @param {string} id - The ID of the sound to play
     * @param {Object} settings - Optional settings (volume, loop, etc.)
     * @param {Function} callback - Optional callback when sound finishes
     * @returns {HTMLAudioElement} - The audio element being played
     */
    static play(id, settings = {}, callback = null) {
        // Check if we've had multiple failures loading this sound
        if (this.#failedLoads.has(id) && this.#failedLoads.get(id) > 3) {
            console.warn(`Skipping sound '${id}' due to previous load failures`);
            return null;
        }

        const modelPath = AudioRegistry.getModelPath(id);
        if (!modelPath) {
            console.error(`Cannot play sound: ID '${id}' not found in AudioRegistry`);
            return null;
        }

        try {
            // Create or reuse audio element
            let audio = this.#audioElements.get(id);
            let isNewAudio = false;
            
            if (!audio) {
                audio = new Audio(modelPath);
                this.#audioElements.set(id, audio);
                isNewAudio = true;
                
                // Add error handler for better diagnostics and retry logic
                audio.onerror = (e) => {
                    const failCount = this.#failedLoads.get(id) || 0;
                    this.#failedLoads.set(id, failCount + 1);
                    
                    console.error(`Error loading sound ${id} from ${modelPath}:`, 
                        e.target.error ? e.target.error.message : 'unknown error');
                    
                    // Remove from cache so we can try loading again next time
                    this.#audioElements.delete(id);
                };
            }

            // Reset audio element state
            audio.currentTime = 0;
            
            // Apply pitch variation if requested or use default slight variation
            // Use EXTREME variation by default (0.5-1.5 range)
            const pitchMin = settings.pitchMin !== undefined ? settings.pitchMin : 0.5;
            const pitchMax = settings.pitchMax !== undefined ? settings.pitchMax : 1.5;
            
            // Always apply a random pitch variation (much more extreme now)
            const randomPitch = pitchMin + Math.random() * (pitchMax - pitchMin);
            audio.playbackRate = randomPitch;
            
            
            // Apply settings
            const finalVolume = (settings.volume !== undefined ? settings.volume : 1.0) ?? this.#sfxVolume;

            console.log("finalVolume", finalVolume, settings.volume, this.#sfxVolume);
            audio.volume = finalVolume;
            audio.loop = settings.loop || false;
            audio.muted = this.#isMuted;
            
            // Set callback if provided
            if (callback) {
                audio.onended = callback;
            }

            // If this is a variation of an already playing sound, create a new audio element
            // to allow overlapping sounds instead of reusing
            if (!isNewAudio && settings.allowOverlap) {
                const newAudio = new Audio(modelPath);
                newAudio.volume = audio.volume;
                newAudio.playbackRate = audio.playbackRate;
                newAudio.loop = audio.loop;
                newAudio.muted = audio.muted;
                
                // Play sound with promise rejection handling
                const playPromise = newAudio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.warn(`Error playing sound ${id} (overlap):`, e);
                    });
                }
                
                return newAudio;
            }

            // Play sound with promise rejection handling
            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(e => {
                    console.warn(`Error playing sound ${id}:`, e);
                    
                    // If it's a user interaction error, we can't do much about it
                    if (e.name === 'NotAllowedError') {
                        console.info('Audio playback requires user interaction first');
                    }
                });
            }
            
            return audio;
        } catch (error) {
            console.error(`Exception playing sound ${id}:`, error);
            return null;
        }
    }

    /**
     * Play spatial audio with volume based on distance between source and listener
     * @param {string} id - The ID of the sound to play from AudioRegistry
     * @param {Object} sourcePosition - Position vector {x,y,z} where sound originates
     * @param {Object} listenerPosition - Position vector {x,y,z} of the listener
     * @param {Object} options - Additional options
     * @param {number} options.maxDistance - Maximum distance at which sound can be heard (default: 50)
     * @param {number} options.minDistance - Distance at which sound is at full volume (default: 5)
     * @param {number} options.volumeMultiplier - Additional volume multiplier (default: 1.0)
     * @param {number} options.pitchMin - Minimum pitch variation (default: 0.5)
     * @param {number} options.pitchMax - Maximum pitch variation (default: 1.5)
     * @param {boolean} options.allowOverlap - Allow overlapping instances of same sound (default: false)
     * @param {boolean} options.debug - Enable debug logging (default: false)
     * @param {Function} callback - Optional callback when sound finishes
     * @returns {HTMLAudioElement} - The audio element being played
     */
    static playSpatial(id, sourcePosition, listenerPosition, options = {}, callback = null) {
        try {
            // Default values for distances
            const maxDistance = options.maxDistance !== undefined ? options.maxDistance : 30;
            const minDistance = options.minDistance !== undefined ? options.minDistance : 1;
            const volumeMultiplier = options.volumeMultiplier !== undefined ? options.volumeMultiplier : 1.0;
            
            // Calculate distance between source and listener
            const dx = sourcePosition.x - listenerPosition.x;
            const dy = sourcePosition.y - listenerPosition.y;
            const dz = sourcePosition.z - listenerPosition.z;
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            
            // Skip playing if beyond max distance
            if (distance >= maxDistance) {
                return null;
            }
            
            // Calculate volume based on distance using a quadratic falloff for more dramatic effect
            let volume;
            
            if (distance <= minDistance) {
                // Full volume within minDistance
                volume = 1.0;
            } else {
                // Quadratic falloff (drops off faster than linear)
                const t = (distance - minDistance) / (maxDistance - minDistance);
                volume = 1.0 - (t * t);
            }
            
            // Force volume to be between 0 and 1
            volume = Math.max(0, Math.min(1, volume));
            
            // Apply volume multiplier with maximum amplification for testing
            volume *= volumeMultiplier;
            
            // Apply EXTREMELY dramatic pitch variation based on distance
            // Closer = higher pitch, Further = lower pitch
            const distanceFactor = Math.max(0, Math.min(1, distance / maxDistance));
            
            // Default to extremely wide range of pitch variation
            const pitchMin = options.pitchMin !== undefined ? options.pitchMin : 0.5;
            const pitchMax = options.pitchMax !== undefined ? options.pitchMax : 1.5;
            
            // Make pitch variation distance-dependent:
            // - At distance=0: pitch range is [1.2, 1.5] (higher pitch)
            // - At max distance: pitch range is [0.5, 0.8] (lower pitch)
            const adjustedPitchMin = pitchMin + (1.0 - distanceFactor) * 0.3; // 0.5 to 0.8
            const adjustedPitchMax = pitchMax - distanceFactor * 0.7; // 1.5 to 0.8
            
            // Play sound with calculated volume and pitch variation
            return this.play(id, { 
                volume, 
                pitchMin: adjustedPitchMin, 
                pitchMax: adjustedPitchMax,
                allowOverlap: options.allowOverlap || false,
                ...options 
            }, callback);
        } catch (error) {
            console.error(`Error playing spatial sound ${id}:`, error);
            return null;
        }
    }

    /**
     * Stop a currently playing sound
     * @param {string} id - The ID of the sound to stop
     */
    static stop(id) {
        const audio = this.#audioElements.get(id);
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    }

    /**
     * Set the master volume for all SFX sounds
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    static setSfxVolume(volume) {
        this.#sfxVolume = Math.max(0, Math.min(1, volume));
        
        // Update volume for all currently loaded audio elements
        this.#audioElements.forEach(audio => {
            if (!audio.dataset.radioPlayer) {
                audio.volume = this.#sfxVolume;
            }
        });
    }

    /**
     * Get the current SFX volume
     * @returns {number} - Current volume level
     */
    static getSfxVolume() {
        return this.#sfxVolume;
    }

    /**
     * Mute or unmute all SFX sounds
     * @param {boolean} muted - Whether to mute sounds
     */
    static setMuted(muted) {
        this.#isMuted = muted;
        
        // Apply to all audio elements
        this.#audioElements.forEach(audio => {
            if (!audio.dataset.radioPlayer) {
                audio.muted = muted;
            }
        });
    }

    /**
     * Check if SFX sounds are muted
     * @returns {boolean} - Whether sounds are muted
     */
    static isMuted() {
        return this.#isMuted;
    }
    
    /**
     * Clear the audio cache and failed loads tracking
     * Call this when you want to reset audio state, such as after a scene change
     */
    static clearCache() {
        // Stop all playing sounds
        this.#audioElements.forEach(audio => {
            audio.pause();
            audio.currentTime = 0;
        });
        
        // Clear the maps
        this.#audioElements.clear();
        this.#failedLoads.clear();
    }
} 