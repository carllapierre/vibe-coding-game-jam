import { assetPath } from '../utils/pathHelper.js';
export class SpawnableRegistry {
    static spawnableTypes = [];
    
    // Initialize the spawnable types from food registry
    static initialize(spawnables = []) {
        // Clear existing types
        this.spawnableTypes = [];

        this.defaultSpawnableType = {
            id: 'default', // Use the food ID as the spawnable ID
            glowColor: 0xadd8e6,
            glowIntensity: 0.6,
            glowRadius: 3,
            bobSpeed: 0.02,
            bobHeight: 0.4,
            rotationSpeed: 0.005,
            showGlowMesh: false,
            model: assetPath(`objects/default.glb`),
            scale: 2.5,
            shadowColor: 0xadd8e6,
            shadowOpacity: 0.25,
            shadowScale: 1,
            particleColor: 0xadd8e6,
            particleCount: 25,
            particleSize: 0.1,
            particleSpeed: 0.02,
            particleRadius: 0.8,
            ref: null
        }
        
        spawnables.forEach(spawnable => {
            this.registerSpawnableType({...this.defaultSpawnableType, ...spawnable});
        });
        
    }

    static updateSpawnableProperties(spawnableIds = [], properties) {
        spawnableIds.forEach(spawnableId => {
            const index = this.spawnableTypes.findIndex(type => type.id === spawnableId);
            if (index !== -1) {
                this.spawnableTypes[index] = {...this.spawnableTypes[index], ...properties};
            }
        });
    }

    static getSpawnableType(id) {
        const type = this.spawnableTypes.find(type => type.id === id);
        if (!type) {
            console.warn(`Spawnable type with id ${id} not found`);
        }
        return type;
    }

    static getSpawnableTypeByIndex(index) {
        return this.spawnableTypes[index];
    }

    static getSpawnableCount() {
        return this.spawnableTypes.length;
    }

    static getAllSpawnableIds() {
        return this.spawnableTypes.map(type => type.id);
    }

    static registerSpawnableType(config) {
        if (!config.id) {
            throw new Error('Spawnable type must have an id');
        }
        
        // Check for duplicate id
        if (this.spawnableTypes.some(type => type.id === config.id)) {
            console.warn(`Spawnable type with id ${config.id} already exists, skipping registration`);
            return;
        }

        this.spawnableTypes.push(config);
    }

    static removeSpawnableType(id) {
        this.spawnableTypes = this.spawnableTypes.filter(type => type.id !== id);
    }
} 