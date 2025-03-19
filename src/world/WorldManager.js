import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

export class WorldManager {
    constructor(scene) {
        this.scene = scene;
        this.loader = new GLTFLoader();
        this.worldData = null;
        this.collidableObjects = [];
        this.boundingBoxHelpers = [];
        this.showHitboxes = true;
        
        // Cache for model loading
        this.modelCache = new Map();
    }

    async loadWorldData() {
        try {
            const response = await fetch('/public/data/world.json');
            this.worldData = await response.json();
            return this.worldData;
        } catch (error) {
            console.error('Error loading world data:', error);
            throw error;
        }
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
            await this.loadWorldData();
        }

        const { walls, settings } = this.worldData;
        const loadPromises = [];

        for (const wall of walls) {
            const modelPath = settings.modelBasePath + wall.model;
            
            // Load model once and clone for instances
            const loadPromise = this.loadModel(modelPath).then(gltf => {
                wall.instances.forEach(pos => {
                    const instance = gltf.scene.clone();
                    
                    // Scale the model
                    instance.scale.set(settings.scaleFactor, settings.scaleFactor, settings.scaleFactor);
                    
                    // Position and rotate the wall
                    instance.position.set(pos.x, pos.y, pos.z);
                    instance.rotation.y = pos.rotationY;
                    
                    // Add to the scene
                    this.scene.add(instance);
                    
                    // Update matrices for proper bounding box calculation
                    instance.updateMatrixWorld(true);
                    
                    // Create a bounding box for collision detection
                    const boxInfo = this.createBoundingBoxHelper(instance);
                    this.collidableObjects.push({
                        object: instance,
                        box: boxInfo.box,
                        config: { ...pos, model: wall.model }
                    });
                });
            }).catch(error => {
                console.error(`Error loading wall model ${wall.model}:`, error);
            });

            loadPromises.push(loadPromise);
        }

        // Wait for all models to load
        await Promise.all(loadPromises);
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

    getCollidableObjects() {
        return this.collidableObjects;
    }
} 