import * as THREE from 'three';
import { GLTFLoader } from './../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { ItemSpawner } from '../spawners/ItemSpawner.js';
import worldManagerService from '../services/WorldManagerService.js';
import { ObjectRegistry } from '../registries/ObjectRegistry.js';

export class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.worldData = null;
        this.collidableObjects = [];
        this.boundingBoxHelpers = [];
        this.showHitboxes = false;
        this.spawners = [];
        
        // Cache for model loading
        this.modelCache = new Map();
    }

    get scaleFactor() {
        return this.worldData?.settings?.scaleFactor;
    }

    async loadWorld() {
        try {
            const worldData = await worldManagerService.getWorldData();
            this.worldData = worldData;
            return worldData;
        } catch (error) {
            console.error('Failed to load world:', error);
            throw error;
        }
    }

    async saveWorldData() {
        try {
            // Clean up null instances before saving
            this.cleanupNullInstances();
            
            const success = await worldManagerService.saveWorldData(this.worldData);
            if (success) {
                console.log('World data saved successfully');
            }
            return success;
        } catch (error) {
            console.error('Failed to save world:', error);
            throw error;
        }
    }

    cleanupNullInstances() {
        if (!this.worldData || !this.worldData.objects) return;
        
        // For each object in the world data
        for (let i = 0; i < this.worldData.objects.length; i++) {
            const objectData = this.worldData.objects[i];
            
            if (objectData.instances) {
                // Filter out null instances
                const cleanedInstances = objectData.instances.filter(instance => instance !== null);
                
                // If all instances were null, the object will be removed later
                objectData.instances = cleanedInstances;
            }
            
            // If no instances left after cleanup, mark for removal
            if (!objectData.instances || objectData.instances.length === 0) {
                this.worldData.objects.splice(i, 1);
                i--; // Adjust index after removal
            }
        }
    }

    update(character) {
        // Update all spawners
        this.spawners.forEach((spawner, index) => {
            if (!spawner) {
                console.warn(`Invalid spawner at index ${index}`);
                return;
            }
            
            try {
                spawner.update();
                
                // Check for item collection if character is provided
                if (character) {
                    spawner.checkCollection(character);
                }
            } catch (error) {
                console.error(`Error updating spawner ${index}:`, error);
            }
        });
    }

    getCollidableObjects() {
        return this.collidableObjects;
    }

    toggleHitboxes(show) {
        this.showHitboxes = show;
        this.boundingBoxHelpers.forEach(helper => {
            helper.visible = show;
        });
    }

    async updateObjectInstance(objectId, instanceIndex, position, rotation, scale) {
        if (!this.worldData || !this.worldData.objects) return false;

        let objectData = this.worldData.objects.find(obj => obj.id === objectId);
        
        // If the object doesn't exist in worldData yet, create it
        if (!objectData) {
            console.log(`Creating new object entry for ${objectId} in worldData`);
            objectData = {
                id: objectId,
                instances: []
            };
            this.worldData.objects.push(objectData);
        }
        
        // If the instance doesn't exist yet, create an empty placeholder
        if (!objectData.instances[instanceIndex]) {
            console.log(`Creating new instance for ${objectId}[${instanceIndex}]`);
            
            // Ensure instances array is large enough (fill any gaps)
            while (objectData.instances.length <= instanceIndex) {
                objectData.instances.push(null);
            }
            
            objectData.instances[instanceIndex] = {};
        }

        // Update the instance data
        // When saving, divide by scaleFactor to get the actual scale values
        const scaleFactor = this.worldData.settings.scaleFactor;
        objectData.instances[instanceIndex] = {
            x: position.x,
            y: position.y,
            z: position.z,
            rotationY: rotation.y,
            scaleX: scale ? scale.x / scaleFactor : 1,
            scaleY: scale ? scale.y / scaleFactor : 1,
            scaleZ: scale ? scale.z / scaleFactor : 1
        };

        console.log(`Saving normalized scale for ${objectId}[${instanceIndex}]:`, {
            x: objectData.instances[instanceIndex].scaleX,
            y: objectData.instances[instanceIndex].scaleY,
            z: objectData.instances[instanceIndex].scaleZ
        });

        // Save the changes to the server
        try {
            await this.saveWorldData();
            console.log(`Updated and saved object instance: ${objectId} [${instanceIndex}]`);
            return true;
        } catch (error) {
            console.error('Failed to save object instance update:', error);
            return false;
        }
    }

    async deleteObjectInstance(objectId, instanceIndex) {
        if (!this.worldData || !this.worldData.objects) {
            console.error('No world data or objects array available');
            return false;
        }

        console.log('Attempting to delete object:', { objectId, instanceIndex });

        // Validate instanceIndex is a valid number
        if (isNaN(instanceIndex) || instanceIndex === undefined) {
            console.error('Invalid instance index:', instanceIndex);
            return false;
        }

        const objectIndex = this.worldData.objects.findIndex(obj => obj.id === objectId);
        if (objectIndex === -1) {
            console.error('Object not found in world data:', objectId);
            console.log('Available objects:', this.worldData.objects.map(obj => obj.id));
            return false;
        }

        const objectData = this.worldData.objects[objectIndex];
        if (!objectData.instances[instanceIndex]) {
            console.error('Instance not found:', { objectId, instanceIndex });
            return false;
        }

        console.log('Found object to delete:', {
            objectId,
            instanceIndex,
            totalInstances: objectData.instances.length
        });

        // Set the instance to null rather than removing it
        // This preserves indices for the current session
        // The cleanup method will remove nulls when saving
        objectData.instances[instanceIndex] = null;
        
        // Remove from collidable objects
        const collidableIndex = this.collidableObjects.findIndex(obj => 
            obj.config.id === objectId && obj.object.userData.instanceIndex === instanceIndex
        );
        
        if (collidableIndex !== -1) {
            console.log('Removing from collidable objects:', collidableIndex);
            this.collidableObjects.splice(collidableIndex, 1);
        } else {
            console.warn('Object not found in collidable objects:', { objectId, instanceIndex });
        }

        // Save the changes to the server
        try {
            console.log('Saving world data after deletion...');
            await this.saveWorldData();
            console.log(`Successfully deleted object instance: ${objectId} [${instanceIndex}]`);
            return true;
        } catch (error) {
            console.error('Failed to delete object instance:', {
                objectId,
                instanceIndex,
                error: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    async loadModel(path) {
        // Check cache first
        if (this.modelCache.has(path)) {
            return this.modelCache.get(path).clone();
        }

        return new Promise((resolve, reject) => {
            this.loader.load(path, (gltf) => {
                // Store in cache
                this.modelCache.set(path, gltf.scene.clone());
                resolve(gltf);
            }, undefined, reject);
        });
    }

    createBoundingBoxHelper(object) {
        const box = new THREE.Box3().setFromObject(object);
        return { box };
    }

    async loadObjects() {
        if (!this.worldData) {
            await this.loadWorld();
        }

        // Initialize objects array if it doesn't exist
        if (!this.worldData.objects) {
            console.warn('No objects array found in world data, initializing empty array');
            this.worldData.objects = [];
        }
        
        const promises = this.worldData.objects.map(async (objectData) => {
            const registryItem = ObjectRegistry.items.find(item => item.id === objectData.id);
            if (!registryItem) {
                console.warn(`Object ${objectData.id} not found in registry`);
                return;
            }

            const modelPath = this.worldData.settings.modelBasePath + registryItem.model;
            const gltf = await this.loadModel(modelPath);
            
            // Create instances
            objectData.instances.forEach((instance, index) => {
                // Skip null instances
                if (!instance) {
                    return;
                }
                
                const objectInstance = gltf.scene.clone();
                
                // Apply position and rotation
                objectInstance.position.set(
                    instance.x,
                    instance.y,
                    instance.z
                );
                objectInstance.rotation.y = instance.rotationY;

                // Apply scale - use saved scale values if they exist, otherwise use registry scale
                const baseScale = registryItem.scale || 1;
                if (instance.scaleX !== undefined && instance.scaleY !== undefined && instance.scaleZ !== undefined) {
                    console.log(`Applying saved scale for ${objectData.id}[${index}]:`, instance.scaleX, instance.scaleY, instance.scaleZ);
                    objectInstance.scale.set(
                        instance.scaleX * this.worldData.settings.scaleFactor * baseScale,
                        instance.scaleY * this.worldData.settings.scaleFactor * baseScale,
                        instance.scaleZ * this.worldData.settings.scaleFactor * baseScale
                    );
                } else {
                    console.log(`No saved scale for ${objectData.id}[${index}], using default`);
                    objectInstance.scale.multiplyScalar(this.worldData.settings.scaleFactor * baseScale);
                }

                // Store object information for transform saving
                objectInstance.userData.id = objectData.id;
                objectInstance.userData.instanceIndex = index;

                this.scene.add(objectInstance);
                
                // Update matrices for proper bounding box calculation
                objectInstance.updateMatrixWorld(true);
                
                // Create a bounding box for collision detection
                const boxInfo = this.createBoundingBoxHelper(objectInstance);
                
                // Store the object instance and its collision data with scale information
                this.collidableObjects.push({
                    object: objectInstance,
                    box: boxInfo.box,
                    meshes: [], // Array to store actual meshes for collision
                    config: { 
                        ...instance, 
                        id: objectData.id,
                        scaleX: instance.scaleX || baseScale,
                        scaleY: instance.scaleY || baseScale,
                        scaleZ: instance.scaleZ || baseScale
                    }
                });
                
                // Collect all meshes from the object instance for precise collision
                objectInstance.traverse((child) => {
                    if (child.isMesh) {
                        this.collidableObjects[this.collidableObjects.length - 1].meshes.push(child);
                    }
                });
            });
        });

        await Promise.all(promises);
        return this.collidableObjects;
    }

    async initializeSpawners() {
        if (!this.worldData) {
            await this.loadWorld();
        }
        
        if (this.worldData.spawners) {
            console.log('Found spawners in world data:', this.worldData.spawners);
            this.loadSpawners(this.worldData.spawners);
        } else {
            console.warn('No spawners found in world data');
        }
    }

    loadSpawners(spawnerData) {
        if (!spawnerData || !Array.isArray(spawnerData)) {
            console.warn("No valid spawner data provided");
            return;
        }
        
        console.log("Loading spawners:", spawnerData);

        spawnerData.forEach((spawnerConfig, index) => {
            if (!spawnerConfig || !spawnerConfig.position) {
                console.warn(`Invalid spawner config at index ${index}`, spawnerConfig);
                return;
            }

            const position = new THREE.Vector3(
                spawnerConfig.position.x,
                spawnerConfig.position.y,
                spawnerConfig.position.z
            );

            // Handle both itemIds array and items object formats
            let itemIds, quantities;
            if (spawnerConfig.itemIds) {
                itemIds = spawnerConfig.itemIds;
                quantities = spawnerConfig.quantities || itemIds.map(() => 1);
                console.log(`Spawner ${index} using itemIds format:`, { itemIds, quantities });
            } else if (spawnerConfig.items) {
                itemIds = spawnerConfig.items.map(item => item.id);
                quantities = spawnerConfig.items.map(item => item.quantity || 1);
                console.log(`Spawner ${index} using items format:`, { itemIds, quantities });
            } else {
                console.warn(`No items or itemIds found in spawner config at index ${index}`);
                return;
            }

            const cooldown = spawnerConfig.cooldown || 5000;

            try {
                // Create spawner with position first, then itemIds
                const spawner = new ItemSpawner(position, itemIds, cooldown, quantities);
                console.log(`Created spawner at position:`, position);
                spawner.addToScene(this.scene); // Add to scene after creation
                this.spawners.push(spawner);
                console.log(`Added spawner to world, total spawners:`, this.spawners.length);
            } catch (error) {
                console.error(`Error creating spawner at index ${index}:`, error);
            }
        });
    }
}