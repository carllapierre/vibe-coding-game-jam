import { Registry } from '../core/Registry.js';
import { assetPath } from '../utils/pathHelper.js';

export class CharacterRegistry extends Registry {
    static DEFAULT_PATH = 'characters/';
    
    static items = [
        { id: 'character-1', name: 'Tim', model: 'character-male-b.glb', scale: 4 },
    ];

    static getModelPath(id) {
        const item = this.items.find(item => item.id === id);
        if (!item) {
            console.warn(`Character ${id} not found in registry`);  
            return null;
        }

        return item.pathOverride 
            ? assetPath(item.pathOverride + item.model)
            : assetPath(this.DEFAULT_PATH + item.model);
    }

}
