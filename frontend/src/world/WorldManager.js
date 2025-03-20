import * as THREE from 'three';
import { GLTFLoader } from './../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { ItemSpawner } from '../spawners/ItemSpawner.js';
import worldManagerService from '../services/WorldManagerService.js';

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

    async updateWallInstance(modelName, instanceIndex, position, rotation, scale) {
        if (!this.worldData || !this.worldData.walls) return false;

        const wallData = this.worldData.walls.find(wall => wall.model === modelName);
        if (!wallData || !wallData.instances[instanceIndex]) return false;

        // Update the instance data
        // When saving, divide by scaleFactor to get the actual scale values
        const scaleFactor = this.worldData.settings.scaleFactor;
        wallData.instances[instanceIndex] = {
            x: position.x,
            y: position.y,
            z: position.z,
            rotationY: rotation.y,
            scaleX: scale ? scale.x / scaleFactor : 1,
            scaleY: scale ? scale.y / scaleFactor : 1,
            scaleZ: scale ? scale.z / scaleFactor : 1
        };

        console.log(`Saving normalized scale for ${modelName}[${instanceIndex}]:`, {
            x: wallData.instances[instanceIndex].scaleX,
            y: wallData.instances[instanceIndex].scaleY,
            z: wallData.instances[instanceIndex].scaleZ
        });

        // Save the changes to the server
        try {
            await this.saveWorldData();
            console.log(`Updated and saved wall instance: ${modelName} [${instanceIndex}]`);
            return true;
        } catch (error) {
            console.error('Failed to save wall instance update:', error);
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

    async loadWalls() {
        if (!this.worldData) {
            await this.loadWorld();
        }
        
        const promises = this.worldData.walls.map(async (wallData) => {
            const modelPath = this.worldData.settings.modelBasePath + wallData.model;
            const gltf = await this.loadModel(modelPath);
            
            // Create instances
            wallData.instances.forEach((instance, index) => {
                const wallInstance = gltf.scene.clone();
                
                // Apply position and rotation
                wallInstance.position.set(
                    instance.x,
                    instance.y,
                    instance.z
                );
                wallInstance.rotation.y = instance.rotationY;

                // Apply scale - use saved scale values if they exist, otherwise use default scale
                if (instance.scaleX !== undefined && instance.scaleY !== undefined && instance.scaleZ !== undefined) {
                    console.log(`Applying saved scale for ${wallData.model}[${index}]:`, instance.scaleX, instance.scaleY, instance.scaleZ);
                    wallInstance.scale.set(
                        instance.scaleX * this.worldData.settings.scaleFactor,
                        instance.scaleY * this.worldData.settings.scaleFactor,
                        instance.scaleZ * this.worldData.settings.scaleFactor
                    );
                } else {
                    console.log(`No saved scale for ${wallData.model}[${index}], using default`);
                    wallInstance.scale.multiplyScalar(this.worldData.settings.scaleFactor);
                }

                // Store model information for transform saving
                wallInstance.userData.model = wallData.model;
                wallInstance.userData.instanceIndex = index;

                this.scene.add(wallInstance);
                
                // Update matrices for proper bounding box calculation
                wallInstance.updateMatrixWorld(true);
                
                // Create a bounding box for collision detection
                const boxInfo = this.createBoundingBoxHelper(wallInstance);
                
                // Store the wall instance and its collision data with scale information
                this.collidableObjects.push({
                    object: wallInstance,
                    box: boxInfo.box,
                    meshes: [], // Array to store actual meshes for collision
                    config: { 
                        ...instance, 
                        model: wallData.model,
                        scaleX: instance.scaleX || 1,
                        scaleY: instance.scaleY || 1,
                        scaleZ: instance.scaleZ || 1
                    }
                });
                
                // Collect all meshes from the wall instance for precise collision
                wallInstance.traverse((child) => {
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