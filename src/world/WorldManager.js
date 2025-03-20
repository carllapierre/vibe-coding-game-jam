import * as THREE from 'three';
import { GLTFLoader } from './../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { ItemSpawner } from '../spawners/ItemSpawner.js';

export class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.worldData = null;
        this.collidableObjects = [];
        this.boundingBoxHelpers = [];
        this.showHitboxes = true;
        this.spawners = [];
        
        // Cache for model loading
        this.modelCache = new Map();
    }

    async loadWorld() {
        const response = await fetch('/public/data/world.json');
        const worldData = await response.json();
        
        // Store world data for other initialization steps
        this.worldData = worldData;
        
        // Return the promise so we can chain initialization steps
        return worldData;
    }

    async saveWorldData() {
        try {
            const response = await fetch('/public/data/world.json', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.worldData, null, 4)
            });
            
            if (!response.ok) {
                throw new Error('Failed to save world data');
            }
            
            return true;
        } catch (error) {
            console.error('Error saving world data:', error);
            throw error;
        }
    }

    createBoundingBoxHelper(object) {
        const box = new THREE.Box3().setFromObject(object);
        const helper = new THREE.Box3Helper(box, 0xff0000);
        helper.visible = this.showHitboxes;
        this.scene.add(helper);
        this.boundingBoxHelpers.push(helper);
        return { box, helper };
    }

    toggleHitboxes() {
        this.showHitboxes = !this.showHitboxes;
        this.boundingBoxHelpers.forEach(helper => {
            helper.visible = this.showHitboxes;
        });
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

    async loadWalls() {
        if (!this.worldData) {
            await this.loadWorld();
        }
        
        const promises = this.worldData.walls.map(async (wallData) => {
            const modelPath = this.worldData.settings.modelBasePath + wallData.model;
            const gltf = await this.loadModel(modelPath);
            
            // Create instances
            wallData.instances.forEach(instance => {
                const wallInstance = gltf.scene.clone();
                // Apply position without scaling it (the scale factor will be applied to the model itself)
                wallInstance.position.set(
                    instance.x,
                    instance.y,
                    instance.z
                );
                wallInstance.rotation.y = instance.rotationY;
                wallInstance.scale.multiplyScalar(this.worldData.settings.scaleFactor);
                this.scene.add(wallInstance);
                
                // Update matrices for proper bounding box calculation
                wallInstance.updateMatrixWorld(true);
                
                // Create a bounding box for collision detection
                const boxInfo = this.createBoundingBoxHelper(wallInstance);
                this.collidableObjects.push({
                    object: wallInstance,
                    box: boxInfo.box,
                    config: { ...instance, model: wallData.model }
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
            this.loadSpawners(this.worldData.spawners);
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

            let spawner;
            switch (spawnerConfig.type) {
                case 'item':
                    // Use itemIds array if available, fall back to itemId for backward compatibility
                    const itemIds = spawnerConfig.itemIds || (spawnerConfig.itemId ? [spawnerConfig.itemId] : []);
                    console.log(`Creating ItemSpawner ${index} with items: ${itemIds.join(', ')}`);
                    
                    // Skip if no items are defined
                    if (itemIds.length === 0) {
                        console.warn(`Skipping spawner ${index} with no items defined`);
                        return;
                    }
                    
                    spawner = new ItemSpawner(position, itemIds, spawnerConfig.cooldown);
                    
                    // Set active state if specified
                    if (spawnerConfig.active !== undefined) {
                        spawner.setActive(spawnerConfig.active);
                    }
                    break;
                default:
                    console.warn(`Unknown spawner type: ${spawnerConfig.type}`);
                    return;
            }

            if (spawner) {
                this.spawners.push(spawner);
                // Spawn initial item if spawner is active
                if (spawner.active) {
                    spawner.spawn();
                }
                spawner.addToScene(this.scene);
            }
        });
    }

    addWallInstance(modelName, position, rotation) {
        const wallConfig = this.worldData.walls.find(w => w.model === modelName);
        if (!wallConfig) {
            console.error('Wall model not found:', modelName);
            return;
        }

        const newInstance = {
            x: position.x,
            y: position.y,
            z: position.z,
            rotationY: rotation.y
        };

        wallConfig.instances.push(newInstance);
        
        // Use cached model if available
        const modelPath = this.worldData.settings.modelBasePath + modelName;
        if (this.modelCache.has(modelPath)) {
            const instance = this.modelCache.get(modelPath).clone();
            this.setupWallInstance(instance, newInstance, modelName);
        } else {
            this.loadModel(modelPath).then(gltf => {
                const instance = gltf.scene.clone();
                this.setupWallInstance(instance, newInstance, modelName);
            });
        }
    }

    setupWallInstance(instance, config, modelName) {
        instance.scale.set(
            this.worldData.settings.scaleFactor,
            this.worldData.settings.scaleFactor,
            this.worldData.settings.scaleFactor
        );
        instance.position.set(config.x, config.y, config.z);
        instance.rotation.y = config.rotationY;
        
        this.scene.add(instance);
        instance.updateMatrixWorld(true);
        
        const boxInfo = this.createBoundingBoxHelper(instance);
        this.collidableObjects.push({
            object: instance,
            box: boxInfo.box,
            config: { ...config, model: modelName }
        });
    }

    removeWallInstance(modelName, index) {
        const wallConfig = this.worldData.walls.find(w => w.model === modelName);
        if (!wallConfig || index >= wallConfig.instances.length) {
            console.error('Wall instance not found:', modelName, index);
            return;
        }

        const instanceToRemove = wallConfig.instances[index];
        wallConfig.instances.splice(index, 1);

        // Find and remove the corresponding object
        const objectIndex = this.collidableObjects.findIndex(
            obj => obj.config.model === modelName && 
                  obj.config.x === instanceToRemove.x &&
                  obj.config.z === instanceToRemove.z
        );

        if (objectIndex !== -1) {
            const obj = this.collidableObjects[objectIndex];
            this.scene.remove(obj.object);
            this.boundingBoxHelpers[objectIndex].dispose();
            this.scene.remove(this.boundingBoxHelpers[objectIndex]);
            this.collidableObjects.splice(objectIndex, 1);
            this.boundingBoxHelpers.splice(objectIndex, 1);
        }
    }

    updateWallInstance(modelName, index, newPosition, newRotation) {
        const wallConfig = this.worldData.walls.find(w => w.model === modelName);
        if (!wallConfig || index >= wallConfig.instances.length) {
            console.error('Wall instance not found:', modelName, index);
            return;
        }

        const oldInstance = wallConfig.instances[index];
        const newInstance = {
            x: newPosition.x,
            y: newPosition.y,
            z: newPosition.z,
            rotationY: newRotation.y
        };

        // Update configuration
        wallConfig.instances[index] = newInstance;

        // Find and update the corresponding object
        const objectIndex = this.collidableObjects.findIndex(
            obj => obj.config.model === modelName &&
                  obj.config.x === oldInstance.x &&
                  obj.config.z === oldInstance.z
        );

        if (objectIndex !== -1) {
            const obj = this.collidableObjects[objectIndex];
            obj.object.position.copy(newPosition);
            obj.object.rotation.y = newRotation.y;
            obj.object.updateMatrixWorld(true);
            obj.box.setFromObject(obj.object);
            obj.config = { ...newInstance, model: modelName };
        }
    }

    update(player) {
        // Update all spawners
        this.spawners.forEach((spawner, index) => {
            spawner.update();
            
            // Check for item collection
            if (player && spawner.currentSpawnable && !spawner.currentSpawnable.isCollected) {
                // Use the collision sphere for better collision detection
                const playerBox = player.collisionSphere ? 
                    new THREE.Box3().setFromObject(player.collisionSphere) : 
                    new THREE.Box3().setFromObject(player.camera);
                
                const itemBox = new THREE.Box3();
                
                // If the item has a model, use it for collision
                if (spawner.currentSpawnable.model) {
                    itemBox.setFromObject(spawner.currentSpawnable.model);
                } else {
                    // Fallback to using position with a small radius
                    const radius = 0.5;
                    const pos = spawner.currentSpawnable.position;
                    itemBox.min.set(pos.x - radius, pos.y - radius, pos.z - radius);
                    itemBox.max.set(pos.x + radius, pos.y + radius, pos.z + radius);
                }
                
                // Check for intersection
                if (playerBox.intersectsBox(itemBox)) {
                    console.log(`Player collected item from spawner ${index}`);
                    // Call the spawner's collect method instead of the spawnable's directly
                    spawner.collect(player);
                }
            }
        });
    }

    getCollidableObjects() {
        return this.collidableObjects;
    }
} 