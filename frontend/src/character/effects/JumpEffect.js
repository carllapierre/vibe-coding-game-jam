import { Effect } from '../../core/Effect.js';

const DEFAULT_DURATION = 5000; // Default duration in milliseconds
const JUMP_MULTIPLIER = 1.5;  // Jump height increase factor
const EFFECT_ID = 'jump';

export class JumpEffect extends Effect {
    // Add a static description for UI purposes
    static description = "Jumpy 🐇";

    constructor(duration = DEFAULT_DURATION, config = {}) {
        // Pass the ID, duration, and any additional config to the parent constructor
        super(EFFECT_ID, duration, { multiplier: JUMP_MULTIPLIER, ...config });
        this.originalJumpHeight = null; // To store the character's original jump height
    }

    /**
     * Applies the jump effect to the target character.
     * @param {object} target - The character entity.
     */
    apply(target) {
        if (!target || typeof target.getJumpHeight !== 'function' || typeof target.setJumpHeight !== 'function') {
            console.error(`JumpEffect.apply: Target is invalid or missing required jump methods.`);
            return;
        }

        this.target = target;
        this.originalJumpHeight = target.getJumpHeight(); // Store the original jump height
        const newJumpHeight = this.originalJumpHeight * this.config.multiplier;
        target.setJumpHeight(newJumpHeight); // Apply the jump height modification
        this.isActive = true;
        this.startTime = Date.now();

        console.log(`JumpEffect applied to ${target.id || 'target'}. Jump height changed from ${this.originalJumpHeight} to ${newJumpHeight}. Duration: ${this.duration}ms`);

        // Start the timer via the parent class method
        // Pass the remove method bound to this instance as the callback
        this._startTimer(() => this.remove());
    }

    /**
     * Removes the jump effect and restores the character's original jump height.
     */
    remove() {
        if (this.target && this.isActive && this.originalJumpHeight !== null) {
            this.target.setJumpHeight(this.originalJumpHeight);
            console.log(`JumpEffect removed from ${this.target.id || 'target'}. Jump height restored to ${this.originalJumpHeight}`);
        }
        // Call the parent remove method for cleanup
        super.remove();
    }
}
