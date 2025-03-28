import { Registry } from '../core/Registry.js';
import { assetPath } from '../utils/pathHelper.js';

export class AudioRegistry extends Registry {
    static DEFAULT_PATH = 'audio/';
    
    static items = [
        { id: 'song-1', name: 'Song 1', model: 'song-1.wav', type: 'song' },
        { id: 'song-2', name: 'Song 2', model: 'song-2.wav', type: 'song' },
        { id: 'song-3', name: 'Song 3', model: 'song-3.wav', type: 'song' },
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
