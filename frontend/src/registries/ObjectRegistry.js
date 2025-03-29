import { Registry } from '../core/Registry.js';
import { assetPath } from '../utils/pathHelper.js';
export class ObjectRegistry extends Registry {
    static DEFAULT_PATH = 'scene/';
    
    static items = [
        { id: 'pieter', model: 'pieter.glb', scale: 1.0 },

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

        { id: 'vibermart', model: 'vibermart.glb', scale: 1.0 },

        // Objects
        { id: 'wholer-ham', model: 'wholer-ham.glb', scale: 1.0, pathOverride: 'objects/' },

        { id: 'wine-red', model: 'wine-red.glb', scale: 1.0, pathOverride: 'objects/' },
        { id: 'wine-white', model: 'wine-white.glb', scale: 1.0, pathOverride: 'objects/' },
        { id: 'soda', model: 'soda.glb', scale: 1.0, pathOverride: 'objects/' },
        { id: 'soda-bottle', model: 'soda-bottle.glb', scale: 1.0, pathOverride: 'objects/' },
        { id: 'soda-can', model: 'soda-can.glb', scale: 1.0, pathOverride: 'objects/' },
        { id: 'soda-glass', model: 'soda-glass.glb', scale: 1.0, pathOverride: 'objects/' },


        { id: 'box', model: 'box.glb', scale: 1.0, pathOverride: 'boxes/' },
        { id: 'box-open', model: 'box-open.glb', scale: 1.0, pathOverride: 'boxes/' },
        { id: 'box-large', model: 'box-large.glb', scale: 1.0, pathOverride: 'boxes/' },
        { id: 'box-large-open', model: 'box-large-open.glb', scale: 1.0, pathOverride: 'boxes/' },
        { id: 'chest', model: 'chest.glb', scale: 1.0, pathOverride: 'boxes/' },
        { id: 'barrel', model: 'barrel.glb', scale: 1.0, pathOverride: 'boxes/' },
        { id: 'barrel-open', model: 'barrel-open.glb', scale: 1.0, pathOverride: 'boxes/' },


        // Prototype

        { id: 'floor-thick', model: 'floor-thick.glb', scale: 1.0, pathOverride: 'prototype/' },
        { id: 'stairs-small', model: 'stairs-small.glb', scale: 1.0, pathOverride: 'prototype/' },


        // Furniture
        { id: 'toilet', model: 'toilet.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'table-cross', model: 'tableCross.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'table-coffee', model: 'tableCoffee.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'potted-plant', model: 'pottedPlant.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'plant-small-3', model: 'plantSmall3.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'plant-small-2', model: 'plantSmall2.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'plant-small-1', model: 'plantSmall1.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'lounge-sofa-corner', model: 'loungeSofaCorner.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'lounge-sofa', model: 'loungeSofa.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'lamp-round-floor', model: 'lampRoundFloor.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'kitchen-sink', model: 'kitchenSink.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'kitchen-fridge', model: 'kitchenFridge.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'kitchen-coffee-machine', model: 'kitchenCoffeeMachine.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'kitchen-cabinet', model: 'kitchenCabinet.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'kitchen-blender', model: 'kitchenBlender.glb', scale: 1.0, pathOverride: 'furniture/' },
        { id: 'kitchen-bar', model: 'kitchenBar.glb', scale: 1.0, pathOverride: 'furniture/' },
        
        // Games
        { id: 'vending-machine', model: 'vending-machine.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'ticket-machine', model: 'ticket-machine.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'prizes', model: 'prizes.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'prize-wheel', model: 'prize-wheel.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'pinball', model: 'pinball.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'gambling-machine', model: 'gambling-machine.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'dance-machine', model: 'dance-machine.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'claw-machine', model: 'claw-machine.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'character-gamer', model: 'character-gamer.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'character-employee', model: 'character-employee.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'cash-register', model: 'cash-register.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'basketball-game', model: 'basketball-game.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'arcade-machine', model: 'arcade-machine.glb', scale: 1.0, pathOverride: 'games/' },
        { id: 'air-hockey', model: 'air-hockey.glb', scale: 1.0, pathOverride: 'games/' }
        
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
