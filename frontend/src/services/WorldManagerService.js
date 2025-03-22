import * as THREE from 'three';
import { ItemSpawner } from '../spawners/ItemSpawner.js';
import { SpawnerRegistry } from '../registries/SpawnerRegistry.js';
import { SpawnableRegistry } from '../registries/SpawnableRegistry.js';
import { spawner as spawnerConfig } from '../config.js';

class WorldManagerService {
    constructor() {
        // Default API host
        this.apiHost = 'http://127.0.0.1:5000';
        
        // // Try to get from Vite env if available
        // try {
        //     if (import.meta.env && import.meta.env.VITE_API_HOST) {
        //         this.apiHost = import.meta.env.VITE_API_HOST;
        //     }
        // } catch (error) {
        //     console.warn('Using default API host:', this.apiHost);
        // }

        // Default world data structure
        this.defaultWorldData = {
            settings: {
                modelBasePath: '/public/assets/scene/',
                scaleFactor: 3.5
            },
            objects: [],
            spawners: []
        };
        
        // Keep track of loaded spawners
        this.loadedSpawners = [];
    }

    async getWorldData() {
        try {
            const response = await fetch(`${this.apiHost}/api/world`);
            if (!response.ok) {
                throw new Error(`Failed to fetch world data: ${response.statusText}`);
            }
            let data = await response.json();

            // Create a deep copy to prevent reference issues
            const worldDataCopy = JSON.parse(JSON.stringify({
                settings: data.settings || this.defaultWorldData.settings,
                objects: data.objects || [],
                spawners: data.spawners || []
            }));

            return worldDataCopy;
        } catch (error) {
            console.error('Error fetching world data:', error);
            // Return default world data if fetch fails
            return JSON.parse(JSON.stringify({ ...this.defaultWorldData }));
        }
    }

    async saveWorldData(worldData) {
        try {
            // Create a deep copy to ensure we're not affected by references
            const dataToSave = JSON.parse(JSON.stringify({
                settings: worldData.settings || this.defaultWorldData.settings,
                objects: worldData.objects || [],
                spawners: worldData.spawners || []
            }));

            // Detailed logging of what we're saving
            console.log('Saving world data - objects count:', dataToSave.objects.length);
            
            // Log each object and its instances
            dataToSave.objects.forEach(obj => {
                console.log(`Object ${obj.id}: ${obj.instances ? obj.instances.length : 0} instances`);
            });

            // Log request details
            console.log(`Sending POST request to: ${this.apiHost}/api/world`);
            
            // Convert to a string once to avoid JSON.stringify being called multiple times
            const jsonData = JSON.stringify(dataToSave, null, 4);
            console.log(`Data size: ${jsonData.length} characters`);
            
            const response = await fetch(`${this.apiHost}/api/world`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: jsonData
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response not OK:', {
                    status: response.status,
                    statusText: response.statusText,
                    responseText: errorText
                });
                throw new Error(`Failed to save world data: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Save response from server:', result);
            console.log('World data saved successfully to backend');
            return true;
        } catch (error) {
            console.error('Error saving world data:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    // Initialize spawners in the world from loaded data
    initializeSpawners(scene, character) {
        // First, clean up any previously loaded spawners
        this.cleanupSpawners();
        
        // Get current world data
        return this.getWorldData().then(worldData => {
            if (!worldData.spawners || !worldData.spawners.length) {
                console.log('No spawners found in world data');
                return;
            }
            
            console.log(`Found ${worldData.spawners.length} spawners in world data`);
            
            // For each spawner in the world data
            worldData.spawners.forEach(spawnerData => {
                try {
                    // Create a THREE.Vector3 position
                    const position = new THREE.Vector3(
                        spawnerData.position.x, 
                        spawnerData.position.y + 1, 
                        spawnerData.position.z
                    );
                    
                    // Get spawner configuration from registry
                    const spawnerId = spawnerData.id;
                    const registrySpawner = SpawnerRegistry.items.find(item => item.id === spawnerId);
                    
                    if (!registrySpawner) {
                        console.warn(`Spawner ${spawnerId} not found in registry, skipping`);
                        return;
                    }
                    
                    // Use the configuration from SpawnerRegistry
                    const itemIds = registrySpawner.items;
                    const cooldown = registrySpawner.cooldown || spawnerConfig.defaultCooldown;
                    
                    // Get quantities from SpawnableRegistry for each item with min/max format
                    const quantities = itemIds.map(itemId => {
                        const spawnableType = SpawnableRegistry.getSpawnableType(itemId);
                        if (!spawnableType) return { min: 1, max: 5 }; // Default
                        
                        // If quantity is directly defined, use it as both min and max for fixed value
                        // or interpret it as max with min=1
                        if (spawnableType.quantity) {
                            return {
                                min: spawnableType.quantityMin || 1,
                                max: spawnableType.quantity
                            };
                        }
                        
                        // If min/max are defined, use those
                        if (spawnableType.quantityMin || spawnableType.quantityMax) {
                            return {
                                min: spawnableType.quantityMin || 1,
                                max: spawnableType.quantityMax || 5
                            };
                        }
                        
                        // Default to config
                        return {
                            min: spawnerConfig.defaultQuantityMin,
                            max: spawnerConfig.defaultQuantityMax
                        };
                    });
                    
                    console.log(`Using registry config for spawner ${spawnerId}: cooldown=${cooldown}, items=${itemIds.join(',')}`);
                    console.log(`Quantity ranges:`, quantities.map((q, i) => `${itemIds[i]}: ${q.min}-${q.max}`));
                    
                    // Create a new ItemSpawner with registry data including quantities
                    const spawner = new ItemSpawner(
                        position,
                        itemIds,
                        cooldown,
                        quantities
                    );
                    
                    // Store the instance index for saving/updating
                    spawner.instanceIndex = spawnerData.instanceIndex || Date.now() % 1000000;
                    spawner.id = spawnerData.id;
                    
                    // Add to scene
                    spawner.addToScene(scene);
                    
                    // Store in loadedSpawners
                    this.loadedSpawners.push(spawner);
                    
                    console.log(`Initialized spawner: ${spawnerData.id} at position:`, position);
                } catch (error) {
                    console.error(`Error initializing spawner ${spawnerData.id}:`, error);
                }
            });
            
            console.log(`Successfully initialized ${this.loadedSpawners.length} spawners`);
        }).catch(error => {
            console.error('Error loading spawners:', error);
        });
    }
    
    // Clean up spawners when needed
    cleanupSpawners() {
        if (this.loadedSpawners && this.loadedSpawners.length > 0) {
            console.log(`Cleaning up ${this.loadedSpawners.length} spawners`);
            this.loadedSpawners.forEach(spawner => {
                // Call cleanup on the spawner if it has one
                if (spawner.clearTimeouts) {
                    spawner.clearTimeouts();
                }
                // If it has a current spawnable, clean that up too
                if (spawner.currentSpawnable) {
                    spawner.currentSpawnable.cleanup();
                }
            });
            
            this.loadedSpawners = [];
        }
    }
    
    // Method to update spawners at regular intervals
    updateSpawners(character) {
        this.loadedSpawners.forEach(spawner => {
            if (spawner.update) {
                spawner.update();
            }
            
            // Check for collection if character is provided
            if (character && spawner.checkCollection) {
                spawner.checkCollection(character);
            }
        });
    }

    async deleteObjectFromWorldData(objectId, instanceIndex) {
        try {
            // Get current world data
            const worldData = await this.getWorldData();
            
            console.log('BEFORE DELETE - Full world data structure:', JSON.stringify(worldData, null, 2));
            
            // Find the object in the objects array
            if (worldData.objects && Array.isArray(worldData.objects)) {
                // Convert instanceIndex to number to ensure proper comparison
                const instanceNumber = parseInt(instanceIndex, 10);
                console.log(`Looking for object ${objectId} instance ${instanceNumber}`);
                
                // Find the object with matching ID
                const objectIndex = worldData.objects.findIndex(obj => obj.id === objectId);
                
                if (objectIndex === -1) {
                    console.warn(`Object ${objectId} not found in world data`);
                    return false;
                }
                
                const objectData = worldData.objects[objectIndex];
                
                if (!objectData.instances || !Array.isArray(objectData.instances)) {
                    console.warn(`Object ${objectId} has no instances array`);
                    return false;
                }
                
                console.log(`Found object ${objectId} with ${objectData.instances.length} instances:`, 
                    objectData.instances.map((inst, i) => inst ? `[${i}]: ${JSON.stringify(inst).substring(0, 30)}...` : `[${i}]: null`));
                
                // Find the specific instance
                const instanceExists = instanceNumber < objectData.instances.length && 
                                      objectData.instances[instanceNumber] !== null;
                                      
                if (!instanceExists) {
                    console.warn(`Instance ${instanceNumber} not found in object ${objectId}`);
                    return false;
                }
                
                console.log(`Removing instance at index ${instanceNumber}`);
                
                // Remove the instance by filtering the array 
                const originalLength = objectData.instances.length;
                
                // Create a new array with the specified instance removed
                const newInstances = objectData.instances.filter((_, index) => index !== instanceNumber);
                objectData.instances = newInstances;
                
                console.log(`After filtering: ${originalLength} -> ${objectData.instances.length} instances`);
                
                // If no instances are left, remove the entire object
                if (objectData.instances.length === 0) {
                    console.log(`No instances left, removing entire object ${objectId}`);
                    worldData.objects.splice(objectIndex, 1);
                }
                
                console.log('AFTER DELETE - Modified world data structure:', JSON.stringify(worldData, null, 2));
                
                // Save the updated world data
                console.log('Saving modified world data to server...');
                const saveResult = await this.saveWorldData(worldData);
                console.log('Save result:', saveResult);
                return true;
            } else {
                console.warn('No objects array in world data');
                return false;
            }
        } catch (error) {
            console.error(`Error deleting object from world data:`, error);
            return false;
        }
    }
}

// Create a singleton instance
const worldManagerService = new WorldManagerService();
export default worldManagerService; 