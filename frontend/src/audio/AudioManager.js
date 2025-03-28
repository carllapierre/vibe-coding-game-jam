import { AudioRegistry } from '../registries/AudioRegistry.js';

export class AudioManager {
    static #audioElements = new Map();
    static #sfxVolume = 1.0;
    static #isMuted = false;

    /**
     * Play a sound identified by its ID in the AudioRegistry
     * @param {string} id - The ID of the sound to play
     * @param {Object} settings - Optional settings (volume, loop, etc.)
     * @param {Function} callback - Optional callback when sound finishes
     * @returns {HTMLAudioElement} - The audio element being played
     */
    static play(id, settings = {}, callback = null) {
        const modelPath = AudioRegistry.getModelPath(id);
        if (!modelPath) {
            console.error(`Cannot play sound: ID '${id}' not found in AudioRegistry`);
            return null;
        }

        // Create or reuse audio element
        let audio = this.#audioElements.get(id);
        if (!audio) {
            audio = new Audio(modelPath);
            this.#audioElements.set(id, audio);
        }

        // Reset audio element state
        audio.currentTime = 0;
        
        // Apply settings
        audio.volume = (settings.volume !== undefined ? settings.volume : 1.0) * this.#sfxVolume;
        audio.loop = settings.loop || false;
        audio.muted = this.#isMuted;
        
        // Set callback if provided
        if (callback) {
            audio.onended = callback;
        }

        // Play sound
        audio.play().catch(e => console.error(`Error playing sound ${id}:`, e));
        return audio;
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
} 