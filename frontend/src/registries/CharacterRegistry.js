import { Registry } from '../core/Registry.js';
import { assetPath } from '../utils/pathHelper.js';

export class CharacterRegistry extends Registry {
    static DEFAULT_PATH = 'characters/';
    
    static items = [
        { id: 'character-1', name: 'John', model: 'character-male-b.glb', scale: 4 },
        { id: 'character-2', name: 'Nate', model: 'character-male-c.glb', scale: 4 },
        { id: 'character-3', name: 'Bob', model: 'character-male-d.glb', scale: 4 },
        { id: 'character-4', name: 'Sam', model: 'character-male-e.glb', scale: 4 },
        { id: 'character-5', name: 'Pieter', model: 'character-male-f.glb', scale: 4 },
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
