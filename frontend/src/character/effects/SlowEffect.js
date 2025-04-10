import { Effect } from '../../core/Effect.js';

const DEFAULT_DURATION = 5000; // Default duration in milliseconds
const SLOW_MULTIPLIER = 0.3;  // Speed reduction factor
const EFFECT_ID = 'slow';

export class SlowEffect extends Effect {
    // Add a static description for UI purposes
    static description = "Sticky 🍯";

    constructor(duration = DEFAULT_DURATION, config = {}) {
        // Pass the ID, duration, and any additional config to the parent constructor
        super(EFFECT_ID, duration, { multiplier: SLOW_MULTIPLIER, ...config });
        this.originalSpeed = null; // To store the character's original speed
    }

    /**
     * Applies the slow effect to the target character.
     * @param {object} target - The character entity.
     */
    apply(target) {
        if (!target || typeof target.getBaseSpeed !== 'function' || typeof target.setBaseSpeed !== 'function') {
            console.error(`SlowEffect.apply: Target is invalid or missing required speed methods.`);
            return;
        }

        this.target = target;
        this.originalSpeed = target.getBaseSpeed(); // Store the original speed
        const newSpeed = this.originalSpeed * this.config.multiplier;
        target.setBaseSpeed(newSpeed); // Apply the speed modification
        this.isActive = true;
        this.startTime = Date.now();

        console.log(`SlowEffect applied to ${target.id || 'target'}. Speed changed from ${this.originalSpeed} to ${newSpeed}. Duration: ${this.duration}ms`);

        // Start the timer via the parent class method
        // Pass the remove method bound to this instance as the callback
        this._startTimer(() => this.remove());
    }

    /**
     * Removes the slow effect and restores the character's original speed.
     */
    remove() {
        if (this.target && this.isActive && this.originalSpeed !== null) {
            this.target.setBaseSpeed(this.originalSpeed);
            console.log(`SlowEffect removed from ${this.target.id || 'target'}. Speed restored to ${this.originalSpeed}`);
        }
        // Call the parent remove method for cleanup
        super.remove();
    }
}
