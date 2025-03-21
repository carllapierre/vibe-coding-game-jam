import { Registry } from '../core/Registry.js';
import { assetPath } from '../utils/pathHelper.js';
export class ObjectRegistry extends Registry {
    static DEFAULT_PATH = 'scene/';
    
    static items = [
        // Walls and Structure
        { id: 'wall', model: 'wall.glb', scale: 1.0 },
        { id: 'wall-corner', model: 'wall-corner.glb', scale: 1.0 },
        { id: 'wall-door', model: 'wall-door-rotate.glb', scale: 1.0 },
        { id: 'wall-window', model: 'wall-window.glb', scale: 1.0 },
        { id: 'column', model: 'column.glb', scale: 1.0 },
        { id: 'floor', model: 'floor.glb', scale: 1.0 },
        { id: 'fence', model: 'fence.glb', scale: 1.0 },
        { id: 'fence-door', model: 'fence-door-rotate.glb', scale: 1.0 },

        // Store Fixtures
        { id: 'freezer', model: 'freezer.glb', scale: 1.0 },
        { id: 'freezers-standing', model: 'freezers-standing.glb', scale: 1.0 },
        { id: 'shelf-bags', model: 'shelf-bags.glb', scale: 1.0 },
        { id: 'shelf-boxes', model: 'shelf-boxes.glb', scale: 1.0 },
        { id: 'shelf-end', model: 'shelf-end.glb', scale: 1.0 },
        { id: 'display-bread', model: 'display-bread.glb', scale: 1.0 },
        { id: 'display-fruit', model: 'display-fruit.glb', scale: 1.0 },
        { id: 'bottle-return', model: 'bottle-return.glb', scale: 1.0 },
        { id: 'cash-register', model: 'cash-register.glb', scale: 1.0 },

        // Shopping Equipment
        { id: 'shopping-basket', model: 'shopping-basket.glb', scale: 1.0 },
        { id: 'shopping-cart', model: 'shopping-cart.glb', scale: 1.0 },

        // Objects
        { id: 'wholer-ham', model: 'wholer-ham.glb', scale: 1.0, pathOverride: 'objects/' },
    ];

    static getModelPath(id) {
        const item = this.items.find(item => item.id === id);
        if (!item) {
            console.warn(`Object ${id} not found in registry`);
            return null;
        }

        return item.pathOverride 
            ? assetPath(item.pathOverride + item.model)
            : assetPath(this.DEFAULT_PATH + item.model);
    }
    
}
