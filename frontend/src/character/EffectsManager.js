import { Effect } from '../core/Effect.js';
import { Effects } from './effects/Effects.js'; // Import the Effects map

export class EffectsManager {
    /**
     * @param {object} character - The character instance this manager belongs to.
     */
    constructor(character) {
        if (!character) {
            throw new Error("EffectsManager requires a character instance.");
        }
        this.character = character;
        /** @type {Map<string, {effectInstance: Effect, itemId: string | null}>} */
        this.activeEffects = new Map(); // Stores {effectInstance, itemId}, keyed by effect ID
    }

    /**
     * Applies an effect to the character based on configuration.
     * @param {object} effectConfig - Configuration object for the effect.
     * @param {string} effectConfig.id - The ID of the effect to apply (e.g., 'speed').
     * @param {number} [effectConfig.duration] - Optional duration override in milliseconds.
     * @param {object} [effectConfig.config] - Optional additional configuration for the effect.
     * @param {string | null} [itemId=null] - Optional ID of the item that triggered this effect.
     */
    apply(effectConfig, itemId = null) {
        const { id, duration, config } = effectConfig;

        if (!id) {
            console.error("EffectsManager.apply: Effect config must include an 'id'.");
            return;
        }

        // Check if an effect of the same type is already active
        if (this.activeEffects.has(id)) {
            console.warn(`EffectsManager.apply: Effect with ID '${id}' is already active. Reapplying might reset or stack, depending on effect logic.`);
            // Optionally remove the existing effect before applying the new one
            // this.remove(id);
        }

        const EffectClass = Effects[id]; // Lookup in the Effects map
        console.log(`EffectsManager: Attempting to get EffectClass for id '${id}'. Found:`, EffectClass);
        if (!EffectClass) {
            console.error(`EffectsManager.apply: No effect registered with ID '${id}'.`);
            return;
        }

        try {
            // Instantiate the effect
            const effectInstance = new EffectClass(duration, config);

            // Store the effect instance and the triggering item ID
            this.activeEffects.set(id, { effectInstance, itemId });

            // Apply the effect to the character
            effectInstance.apply(this.character);

            // Add manager reference for removal callback
            effectInstance._manager = this;

        } catch (error) {
            console.error(`EffectsManager.apply: Failed to apply effect '${id}'.`, error);
            this.activeEffects.delete(id); // Clean up if instantiation or apply failed
        }
    }

    /**
     * Handles the completion/removal of an effect.
     * Called internally or by the effect instance itself.
     * @param {string} effectId - The ID of the effect that has completed.
     */
    _handleEffectCompletion(effectId) {
        if (this.activeEffects.has(effectId)) {
            const effectData = this.activeEffects.get(effectId);
            // Ensure timer is cleared and resources released (though effect.remove should handle this)
            if (effectData && effectData.effectInstance) {
                 effectData.effectInstance._clearTimer();
            }
            this.activeEffects.delete(effectId);
            console.log(`EffectsManager: Effect '${effectId}' removed from character ${this.character.id || 'ID unavailable'}.`);
        } else {
            console.warn(`EffectsManager._handleEffectCompletion: Effect '${effectId}' not found in active effects.`);
        }
    }

    /**
     * Removes a specific effect by its ID.
     * @param {string} effectId - The ID of the effect to remove.
     */
    remove(effectId) {
        if (this.activeEffects.has(effectId)) {
            const effectData = this.activeEffects.get(effectId);
            if (effectData && effectData.effectInstance) {
                 effectData.effectInstance.remove(); // Call the effect's own remove logic
            }
            // The effect's remove method should call _handleEffectCompletion.
            // For robustness, ensure cleanup here too if needed, but _handleEffectCompletion should be sufficient.
            // this._handleEffectCompletion(effectId); // This is called by effectInstance.remove() via _manager reference
        } else {
            console.warn(`EffectsManager.remove: Effect '${effectId}' not found or already removed.`);
        }
    }

    /**
     * Updates all active effects. Should be called in the game loop.
     * @param {number} deltaTime - Time elapsed since the last frame.
     */
    update(deltaTime) {
        this.activeEffects.forEach(({ effectInstance }) => { // Destructure to get effectInstance
            if (typeof effectInstance.update === 'function') {
                effectInstance.update(deltaTime);
            }
        });
    }

    /**
     * Checks if a specific effect is currently active.
     * @param {string} effectId - The ID of the effect to check.
     * @returns {boolean} True if the effect is active, false otherwise.
     */
    hasEffect(effectId) {
        return this.activeEffects.has(effectId);
    }

    /**
     * Gets the instance of an active effect.
     * @param {string} effectId - The ID of the effect.
     * @returns {Effect | undefined} The active effect instance, or undefined if not active.
     */
    getEffect(effectId) {
        const effectData = this.activeEffects.get(effectId);
        return effectData ? effectData.effectInstance : undefined;
    }

    /**
     * Gets the item ID associated with an active effect.
     * @param {string} effectId - The ID of the effect.
     * @returns {string | null | undefined} The item ID, or null if none, or undefined if effect not active.
     */
    getEffectItemId(effectId) {
        const effectData = this.activeEffects.get(effectId);
        return effectData ? effectData.itemId : undefined;
    }

    /**
     * Gets a list of keys (IDs) of all currently active effects.
     * @returns {string[]} An array of active effect IDs.
     */
    getActiveEffectKeys() {
        return Array.from(this.activeEffects.keys());
    }

    /**
     * Gets data for all active effects, including instance and item ID.
     * @returns {Array<{id: string, effectInstance: Effect, itemId: string | null}>}
     */
    getActiveEffectsData() {
        return Array.from(this.activeEffects.entries()).map(([id, data]) => ({
            id,
            ...data
        }));
    }

    /**
     * Removes all active effects from the character.
     */
    removeAllEffects() {
        console.log(`EffectsManager: Removing all effects from character ${this.character.id || 'ID unavailable'}.`);
        const effectIds = Array.from(this.activeEffects.keys());
        effectIds.forEach(id => this.remove(id));
        if (this.activeEffects.size > 0) {
             console.warn("EffectsManager.removeAllEffects: Some effects might not have been cleared correctly.");
             this.activeEffects.clear();
        }
    }
}
