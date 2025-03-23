import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ItemSpawner } from '../spawners/ItemSpawner.js';
import worldManagerService from '../services/WorldManagerService.js';
import { ObjectRegistry } from '../registries/ObjectRegistry.js';
import { SpawnerRegistry } from '../registries/SpawnerRegistry.js';
import { SpawnableRegistry } from '../registries/SpawnableRegistry.js';
import { spawner as spawnerConfig } from '../config.js';

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
        
        // Frustum culling
        this.frustum = new THREE.Frustum();
        this.projScreenMatrix = new THREE.Matrix4();
        this.frustumCullingEnabled = true;
        this.cullingDistance = 100; // Maximum distance for objects to be visible
        this.visibilityUpdateFrequency = 5; // Update visibility every N frames
        this.frameCount = 0;
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

    update(character, camera) {
        // Update object visibility using frustum culling
        if (this.frustumCullingEnabled && this.frameCount % this.visibilityUpdateFrequency === 0) {
            this.updateObjectVisibility(camera);
        }
        
        // Update frame counter
        this.frameCount = (this.frameCount + 1) % 1000; // Reset to prevent overflow
        
        // Update spawners
        worldManagerService.updateSpawners(character);
    }
    
    updateObjectVisibility(camera) {
        // Update the frustum
        this.projScreenMatrix.multiplyMatrices(
            camera.projectionMatrix, 
            camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.projScreenMatrix);
        
        // Get camera position for distance culling
        const cameraPosition = camera.position;
        
        // Check each object against the frustum
        this.collidableObjects.forEach(collidableObj => {
            if (!collidableObj.object) return;
            
            const object = collidableObj.object;
            const box = collidableObj.box;
            
            // Skip objects without a bounding box
            if (!box) return;
            
            // Create points for the box corners
            const center = new THREE.Vector3();
            box.getCenter(center);
            
            // Get the distance to the camera
            const distance = center.distanceTo(cameraPosition);
            
            // Skip tiny objects that are far away
            const size = box.getSize(new THREE.Vector3());
            const maxDimension = Math.max(size.x, size.y, size.z);
            const isTiny = maxDimension < 0.5 && distance > this.cullingDistance / 2;
            
            // Check if the bounding box is in the frustum and within culling distance
            const isInFrustum = this.frustum.intersectsBox(box) && 
                               distance < this.cullingDistance;
                               
            // Set visibility
            object.visible = isInFrustum && !isTiny;
            
            // Also update visibility of any child meshes
            if (object.traverse) {
                object.traverse(child => {
                    if (child.isMesh) {
                        child.visible = isInFrustum && !isTiny;
                    }
                });
            }
        });
    }
    
    setFrustumCullingDistance(distance) {
        this.cullingDistance = distance;
    }
    
    toggleFrustumCulling(enabled) {
        this.frustumCullingEnabled = enabled;
        
        // If disabled, make all objects visible again
        if (!enabled) {
            this.collidableObjects.forEach(collidableObj => {
                if (collidableObj.object) {
                    collidableObj.object.visible = true;
                    
                    if (collidableObj.object.traverse) {
                        collidableObj.object.traverse(child => {
                            if (child.isMesh) {
                                child.visible = true;
                            }
                        });
                    }
                }
            });
        }
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
            objectData = {
                id: objectId,
                instances: []
            };
            this.worldData.objects.push(objectData);
        }
        
        // If the instance doesn't exist yet, create an empty placeholder
        if (!objectData.instances[instanceIndex]) {
            
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
            rotationX: rotation.x,
            rotationY: rotation.y,
            rotationZ: rotation.z,
            scaleX: scale ? scale.x / scaleFactor : 1,
            scaleY: scale ? scale.y / scaleFactor : 1,
            scaleZ: scale ? scale.z / scaleFactor : 1
        };

        // Save the changes to the server
        try {
            await this.saveWorldData();
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

        // Validate instanceIndex is a valid number
        if (isNaN(instanceIndex) || instanceIndex === undefined) {
            console.error('Invalid instance index:', instanceIndex);
            return false;
        }

        const objectIndex = this.worldData.objects.findIndex(obj => obj.id === objectId);
        if (objectIndex === -1) {
            console.error('Object not found in world data:', objectId);
            return false;
        }

        const objectData = this.worldData.objects[objectIndex];
        if (!objectData.instances[instanceIndex]) {
            console.error('Instance not found:', { objectId, instanceIndex });
            return false;
        }

        // Set the instance to null
        objectData.instances[instanceIndex] = null;
        
        // Immediately filter out null instances
        objectData.instances = objectData.instances.filter(instance => instance !== null);
        
        // If no instances left, remove the entire object
        if (objectData.instances.length === 0) {
            this.worldData.objects.splice(objectIndex, 1);
        }
        
        // Remove from collidable objects
        const collidableIndex = this.collidableObjects.findIndex(obj => 
            obj.config.id === objectId && obj.object.userData.instanceIndex === instanceIndex
        );
        
        if (collidableIndex !== -1) {
            this.collidableObjects.splice(collidableIndex, 1);
        } else {
            console.warn('Object not found in collidable objects:', { objectId, instanceIndex });
        }

        // Save the changes to the server
        try {
            await this.saveWorldData();
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

        console.log('World data:', this.worldData);

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

            const modelPath = ObjectRegistry.getModelPath(objectData.id);
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
                
                // Apply rotation - handle both full rotation and legacy y-only rotation
                if (instance.rotationX !== undefined && instance.rotationZ !== undefined) {
                    objectInstance.rotation.set(
                        instance.rotationX,
                        instance.rotationY,
                        instance.rotationZ
                    );
                } else {
                    // Legacy support for y-only rotation
                    objectInstance.rotation.y = instance.rotationY;
                }

                // Apply scale - use saved scale values if they exist, otherwise use registry scale
                const baseScale = registryItem.scale || 1;
                if (instance.scaleX !== undefined && instance.scaleY !== undefined && instance.scaleZ !== undefined) {
                    objectInstance.scale.set(
                        instance.scaleX * this.worldData.settings.scaleFactor * baseScale,
                        instance.scaleY * this.worldData.settings.scaleFactor * baseScale,
                        instance.scaleZ * this.worldData.settings.scaleFactor * baseScale
                    );
                } else {
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

    async initializeSpawners(character) {
        if (!this.worldData) {
            await this.loadWorld();
        }
        
        // Use the WorldManagerService to handle spawner initialization
        await worldManagerService.initializeSpawners(this.scene, character);
    }

    loadSpawners(spawnerData) {
        if (!spawnerData || !Array.isArray(spawnerData)) {
            console.warn("No valid spawner data provided");
            return;
        }
        

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

            // Get spawner configuration from registry instead of world data
            const spawnerId = spawnerConfig.id;
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


            try {
                // Create spawner with position, itemIds, cooldown, and quantities
                const spawner = new ItemSpawner(position, itemIds, cooldown, quantities);
                spawner.addToScene(this.scene); // Add to scene after creation
                this.spawners.push(spawner);
            } catch (error) {
                console.error(`Error creating spawner at index ${index}:`, error);
            }
        });
    }
}