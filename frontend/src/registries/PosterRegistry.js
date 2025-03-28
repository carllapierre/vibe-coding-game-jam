import { Registry } from '../core/Registry.js';
import { assetPath } from '../utils/pathHelper.js';

export class PosterRegistry extends Registry {

    static DEFAULT_PATH = 'posters/';
    
    static items = [
        { 
            id: 'poster-1', 
            description: 'Metaverse-explorer',
            image: 'poster-1.png',
            frameColor: 0x8B4513 // Brown frame
        },
        { 
            id: 'poster-2', 
            description: 'VibeMart Logo',
            image: 'poster-2.png',
            frameColor: 0x2F4F4F // Dark slate gray frame
        },
        { 
            id: 'cake', 
            description: 'Cake Ad',
            image: 'cake.png',
            frameColor: 0x2F4F4F // Dark slate gray frame
        },
        { 
            id: 'sandwich', 
            description: 'Sandwich Ad',
            image: 'sandwich.png',
            frameColor: 0x2F4F4F // Dark slate gray frame
        },
        { 
            id: 'zuck', 
            description: 'Zuck',
            image: 'zuck.png',
            frameColor: 0x2F4F4F // Dark slate gray frame
        },
        { 
            id: 'pizza', 
            description: 'Pizza Ad',
            image: 'pizza.png',
            frameColor: 0x2F4F4F // Dark slate gray frame
        },
        { 
            id: 'desert', 
            description: 'Desert Ad',
            image: 'desertark.png',
            frameColor: 0x2F4F4F // Dark slate gray frame
        },
        { 
            id: 'fly', 
            description: 'Fly Ad',
            image: 'fly.png',
            frameColor: 0x2F4F4F // Dark slate gray frame
        },




    ];

    static getImage(id) {
        const item = this.items.find(item => item.id === id);
        if (!item) {
            console.warn(`Poster ${id} not found in registry`);  
            return null;
        }

        return item.pathOverride 
            ? assetPath(item.pathOverride + item.image)
            : assetPath(this.DEFAULT_PATH + item.image);
    }
    
    /**
     * Get poster information by ID
     * @param {string} id - Poster ID
     * @returns {Object|null} - Poster information or null if not found
     */
    static getPosterInfo(id) {
        return this.items.find(item => item.id === id);
    }
}
