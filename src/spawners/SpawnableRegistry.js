import { FoodRegistry } from '../food/FoodRegistry.js';
import { assetPath } from '../utils/pathHelper.js';
export class SpawnableRegistry {
    static spawnableTypes = [];
    
    // Initialize the spawnable types from food registry
    static initialize() {
        console.log("Initializing SpawnableRegistry...");
        // Clear existing types
        this.spawnableTypes = [];
        
        // Create a spawnable type for each food item
        FoodRegistry.foodTypes.forEach(food => {
            console.log(`Registering spawnable type for food: ${food.id}`);
            this.registerSpawnableType({
                id: food.id, // Use the food ID as the spawnable ID
                glowColor: 0xadd8e6,
                glowIntensity: 0.6,
                glowRadius: 4,
                bobSpeed: 0.02,
                bobHeight: 0.4,
                rotationSpeed: 0.005,
                showGlowMesh: false,
                modelPath: assetPath(`objects/${food.model}`),
                scale: food.scale * 2.5,
                shadowColor: 0xadd8e6,
                shadowOpacity: 0.25,
                shadowScale: 2.2,
                particleColor: 0xadd8e6,
                particleCount: 25,
                particleSize: 0.1,
                particleSpeed: 0.02,
                particleRadius: 0.8,
                // Store the original food reference
                foodRef: food
            });
        });
        
        console.log(`SpawnableRegistry initialized with ${this.spawnableTypes.length} types`);
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