import { Effect } from '../../core/Effect.js';

const DEFAULT_DURATION = 5000; // Default duration in milliseconds
const SPEED_MULTIPLIER = 2;  // Speed increase factor
const EFFECT_ID = 'speed';

export class SpeedEffect extends Effect {
    // Add a static description for UI purposes
    static description = "Speedy ⚡";

    constructor(duration = DEFAULT_DURATION, config = {}) {
        // Pass the ID, duration, and any additional config to the parent constructor
        super(EFFECT_ID, duration, { multiplier: SPEED_MULTIPLIER, ...config });
        this.originalSpeed = null; // To store the character's original speed
    }
dw
    /**
     * Applies the speed effect to the target character.
     * @param {object} target - The character entity.
     */
    apply(target) {
        if (!target || typeof target.getBaseSpeed !== 'function' || typeof target.setBaseSpeed !== 'function') {
            console.error(`SpeedEffect.apply: Target is invalid or missing required speed methods.`);
            return;
        }

        this.target = target;
        this.originalSpeed = target.getBaseSpeed(); // Store the original speed
        const newSpeed = this.originalSpeed * this.config.multiplier;
        target.setBaseSpeed(newSpeed); // Apply the speed modification
        this.isActive = true;
        this.startTime = Date.now();

        console.log(`SpeedEffect applied to ${target.id || 'target'}. Speed changed from ${this.originalSpeed} to ${newSpeed}. Duration: ${this.duration}ms`);

        // Start the timer via the parent class method
        // Pass the remove method bound to this instance as the callback
        this._startTimer(() => this.remove());
    }

    /**
     * Removes the speed effect from the target character.
     */
    remove() {
        if (!this.isActive || !this.target) {
            // console.warn("SpeedEffect.remove: Effect is not active or target is missing.");
            return; // Avoid removing effect if not active or target lost
        }

        if (this.originalSpeed !== null) {
            this.target.setBaseSpeed(this.originalSpeed); // Restore original speed
            console.log(`SpeedEffect removed from ${this.target.id || 'target'}. Speed restored to ${this.originalSpeed}.`);
        } else {
            console.warn(`SpeedEffect.remove: Original speed was not stored for ${this.target.id || 'target'}. Cannot restore speed.`);
        }

        this.isActive = false;
        this.originalSpeed = null;
        const targetId = this.target ? this.target.id : 'unknown'; // Keep id before setting target to null
        this.target = null; // Release reference to the target

        // Call the parent remove method AFTER specific cleanup
        // It handles timer clearing and notifying the manager
        super.remove();

        // Log removal *after* super.remove confirms manager interaction (optional)
        // console.log(`SpeedEffect fully removed for target ${targetId}.`);
    }
}

// Register this effect class with the base Effect class registry
// Effect.register(EFFECT_ID, SpeedEffect); // REMOVE this registration call
