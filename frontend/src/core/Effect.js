// import { Logger } from './Logger.js'; // Remove Logger import

// Static registry to hold all effect classes, keyed by their ID
// const effectRegistry = new Map(); // REMOVE registry map

export class Effect {
    /**
     * Registers an effect class in the registry.
     * @param {string} id - The unique ID for the effect type.
     * @param {typeof Effect} effectClass - The effect class constructor.
     */
    // REMOVE static register method
    /*
    static register(id, effectClass) {
        if (effectRegistry.has(id)) {
            console.warn(`Effect.register: Effect with ID '${id}' is already registered. Overwriting.`);
        }
        if (!(effectClass.prototype instanceof Effect)) {
             throw new Error(`Effect.register: Class for ID '${id}' does not extend Effect.`);
        }
        effectRegistry.set(id, effectClass);
        console.log(`Effect '${id}' registered.`);
    }
    */

    /**
     * Retrieves an effect class from the registry.
     * @param {string} id - The ID of the effect type to retrieve.
     * @returns {typeof Effect | undefined} The effect class constructor, or undefined if not found.
     */
    // REMOVE static getEffectClass method
    /*
    static getEffectClass(id) {
        return effectRegistry.get(id);
    }
    */

    /**
     * @param {string} id - The unique identifier for this effect instance or type.
     * @param {number} duration - How long the effect lasts in milliseconds.
     * @param {object} [config={}] - Additional configuration specific to the effect.
     */
    constructor(id, duration, config = {}) {
        if (new.target === Effect) {
            throw new TypeError("Cannot construct Abstract instance directly");
        }
        this.id = id;
        this.duration = duration;
        this.config = config; // Store any extra config needed by subclasses
        this.timerId = null; // To store the setTimeout ID
        this.isActive = false;
        this.target = null; // The character the effect is applied to
        this._manager = null; // Reference to the EffectsManager instance
    }

    /**
     * Applies the effect to the target character.
     * Must be implemented by subclasses.
     * @param {object} target - The character or entity to apply the effect to.
     * @throws {Error} If not implemented by subclass.
     */
    apply(target) {
        throw new Error("Method 'apply()' must be implemented.");
    }

    /**
     * Removes the effect from the target character.
     * Must be implemented by subclasses.
     * @throws {Error} If not implemented by subclass.
     */
    remove() {
        // Base remove logic - clear timer and notify manager if present
        this._clearTimer();
        if (this._manager) {
            this._manager._handleEffectCompletion(this.id);
        }
        this.isActive = false;
        this.target = null;
        this._manager = null; // Clear manager reference
        // Subclasses should call super.remove() after their specific cleanup
    }

    /**
     * Updates the effect state. Optional for effects needing frame-by-frame updates.
     * @param {number} deltaTime - The time elapsed since the last frame.
     */
    update(deltaTime) {
        // Optional: Implement in subclasses if needed
    }

    /**
     * Starts the effect timer.
     * @param {Function} onComplete - Callback function when the effect duration expires.
     */
    _startTimer(onComplete) {
        if (this.duration > 0 && isFinite(this.duration)) {
            // Use the effect's own remove method as the completion callback
            const removalCallback = () => {
                // Check if the effect is still active and managed before removing
                // This prevents issues if remove() was called manually before timer fired
                if (this.isActive && this._manager && this._manager.hasEffect(this.id)) {
                    this.remove(); // Call the effect's remove method
                }
            };
            this.timerId = setTimeout(removalCallback, this.duration);
        }
    }

    /**
     * Clears the effect timer if it's running.
     */
    _clearTimer() {
        if (this.timerId !== null) {
            clearTimeout(this.timerId);
            this.timerId = null;
        }
    }
}

// Export the registry itself if needed elsewhere, though getEffectClass is the primary interface
// export { effectRegistry }; // REMOVE registry export
