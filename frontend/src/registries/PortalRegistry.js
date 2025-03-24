import { Registry } from '../core/Registry.js';
import { redirectVibeverse } from '../portals/onEnter/redirectMetaverse.js';
import { redirectRandomGame } from '../portals/onEnter/redirectMetaverse.js';
export class PortalRegistry extends Registry {
    
    static items = [
        { 
            id: 'redirect-vibeverse', 
            onEnter: redirectVibeverse,
            description: 'Vibeverse',
            color: 0x3366ff
        },
        { 
            id: 'redirect-random-game', 
            onEnter: redirectRandomGame,
            description: 'Random Game',
            color: 0x3366ff
        },
    ];

    /**
     * Get the model path for a portal
     * @param {string} id - Portal ID
     * @returns {string|null} - Model path or null if not found
     */
    static getPortalInfo(id) {
        return this.items.find(item => item.id === id);
    }
}
