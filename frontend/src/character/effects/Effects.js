// Import specific effect classes
import { SpeedEffect } from './SpeedEffect.js';
import { SlowEffect } from './SlowEffect.js';

// Export an object where keys are effect IDs and values are the effect classes
// This allows easy lookup, for example, when loading effect configurations.
export const Effects = {
    'speed': SpeedEffect,
    'slow': SlowEffect,
    // Add other effects here as they are created:
    // 'damageOverTime': DamageOverTimeEffect,
};

// Optional: You could also re-export the base Effect class if needed elsewhere
// export { Effect } from '../../core/Effect.js';
