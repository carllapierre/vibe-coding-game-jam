import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ObjectRegistry } from '../../registries/ObjectRegistry.js';
import worldManagerService from '../../services/WorldManagerService.js';
import { ChangeManager } from './ChangeManager.js';
import { TransformManager } from './TransformManager.js';
import { SpawnerManager } from './SpawnerManager.js';
import { ObjectCatalog } from './ObjectCatalog.js';
import { showFeedback } from '../../utils/UIUtils.js';

/**
 * Main world editor class that integrates all editor components
 */
export class EditorCore {
    /**
     * @param {THREE.Scene} scene - Three.js scene
     * @param {THREE.Camera} camera - Three.js camera
     * @param {THREE.WebGLRenderer} renderer - Three.js renderer
     * @param {Object} character - Character controller (to disable during editing)
     */
    constructor(scene, camera, renderer, character) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.character = character;
        
        // Store original camera state
        this.originalCameraPosition = new THREE.Vector3();
        this.originalCameraRotation = new THREE.Euler();
        
        // Create orbit controls for free roaming (disabled by default)
        this.orbitControls = new OrbitControls(camera, renderer.domElement);
        this.orbitControls.enabled = false;
        this.setupOrbitControls();
        
        // Initialize model loader
        this.modelLoader = new GLTFLoader();
        
        // Create UI elements
        this.createUIElements();
        
        // Create component managers
        this.initManagers();
        
        // Debug mode state
        this.isDebugMode = false;
        
        // Movement settings
        this.moveSpeed = 1.0;
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            q: false,
            e: false,
            shift: false
        };
        
        // Setup event listeners
        this.setupEventListeners();
        
        // World manager reference
        this.worldManager = null;
    }
    
    /**
     * Create UI elements for the editor
     */
    createUIElements() {
        // Create debug overlay
        this.debugOverlay = document.createElement('div');
        this.debugOverlay.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: #00ff00;
            padding: 10px;
            font-family: monospace;
            font-size: 14px;
            border-radius: 5px;
            display: none;
            z-index: 1000;
        `;
        this.debugOverlay.innerHTML = `
            <div>Editor Mode Active</div>
            <div>Press Shift+D to return to game</div>
            <div>Left Click + Drag: Rotate</div>
            <div>Right Click + Drag: Pan</div>
            <div>WASD: Move horizontally</div>
            <div>Q/E: Move up/down</div>
            <div>Hold Shift: Move faster</div>
            <div style="margin-top: 10px;">Transform Controls:</div>
            <div>1: Move Mode</div>
            <div>2: Rotate Mode</div>
            <div>3: Scale Mode</div>
            <div>4: Uniform Scale Mode</div>
            <div>5: Snap Rotate (90°)</div>
            <div>Space: Duplicate Object</div>
            <div>X: Cancel Transform</div>
            <div>L: Delete Selected Object</div>
            <div>K: Save Transform</div>
            <div>N: Toggle Object Catalog</div>
        `;
        document.body.appendChild(this.debugOverlay);

        // Create transform mode indicator
        this.transformModeIndicator = document.createElement('div');
        this.transformModeIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: #00ff00;
            padding: 10px;
            font-family: monospace;
            font-size: 14px;
            border-radius: 5px;
            display: none;
            z-index: 1000;
        `;
        document.body.appendChild(this.transformModeIndicator);

        // Create save feedback overlay
        this.saveFeedback = document.createElement('div');
        this.saveFeedback.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 255, 0, 0.7);
            color: white;
            padding: 15px 20px;
            font-family: monospace;
            font-size: 16px;
            border-radius: 5px;
            display: none;
            z-index: 1000;
            pointer-events: none;
            transition: all 0.3s ease;
        `;
        this.saveFeedback.textContent = 'Changes Saved!';
        document.body.appendChild(this.saveFeedback);
    }
    
    /**
     * Configure orbit controls settings
     */
    setupOrbitControls() {
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.screenSpacePanning = false;
        this.orbitControls.minDistance = 1;
        this.orbitControls.maxDistance = 500;
        this.orbitControls.maxPolarAngle = Math.PI;
    }
    
    /**
     * Initialize all manager components
     */
    initManagers() {
        // Change manager to track changes
        this.changeManager = new ChangeManager(this.scene, this.saveFeedback);
        
        // Transform manager for object manipulation
        this.transformManager = new TransformManager(
            this.scene, 
            this.camera, 
            this.renderer, 
            this.changeManager, 
            this.saveFeedback, 
            this.orbitControls
        );
        this.transformManager.setModeIndicator(this.transformModeIndicator);
        
        // Spawner manager for spawner visuals
        this.spawnerManager = new SpawnerManager(
            this.scene, 
            this.changeManager, 
            this.transformManager.transformControls, 
            this.saveFeedback
        );
        
        // Create object catalog
        this.objectCatalog = new ObjectCatalog(
            this.placeObjectInWorld.bind(this), 
            this.placeSpawnerInWorld.bind(this),
            this.camera,
            this.saveFeedback
        );
    }
    
    /**
     * Set up keyboard and mouse event listeners
     */
    setupEventListeners() {
        // Handle key down events
        document.addEventListener('keydown', async (event) => {
            // Skip if we're typing in search input
            if (document.activeElement && document.activeElement.id === 'catalog-search-input') {
                return;
            }
            
            // Handle existing movement keys
            if (this.isDebugMode) {
                this.handleKeyDown(event);
            }

            // Toggle debug mode with Shift+D
            if (event.shiftKey && event.key.toLowerCase() === 'd') {
                this.toggleDebugMode();
            }
        });

        // Handle key up events
        document.addEventListener('keyup', (event) => {
            // Skip if we're typing in search
            if (document.activeElement && document.activeElement.id === 'catalog-search-input') {
                return;
            }
            
            if (this.isDebugMode) {
                this.handleKeyUp(event);
            }
        });

        // Add click handler for object selection
        this.renderer.domElement.addEventListener('click', (event) => {
            if (this.isDebugMode && !this.transformManager.transformControls.isDragging) {
                this.transformManager.selectObjectAtMouse(event);
            }
        });

        // Listen for transform save events
        document.addEventListener('transformSave', this.handleTransformSave.bind(this));
    }
    
    /**
     * Handle key down events in debug mode
     * @param {KeyboardEvent} event - Key event
     */
    async handleKeyDown(event) {
        switch(event.key.toLowerCase()) {
            case 'w': this.keys.w = true; break;
            case 'a': this.keys.a = true; break;
            case 's': this.keys.s = true; break;
            case 'd': this.keys.d = true; break;
            case 'q': this.keys.q = true; break;
            case 'e': this.keys.e = true; break;
            case 'shift': this.keys.shift = true; break;
            
            // Transform mode keys
            case '1': 
                this.transformManager.setMode('translate');
                break;
            case '2': 
                this.transformManager.setMode('rotate');
                break;
            case '3': 
                this.transformManager.setAxisScaleMode();
                break;
            case '4': 
                this.transformManager.setUniformScaleMode();
                break;
            case '5': 
                this.transformManager.setSnapRotationMode();
                break;
            case '6': 
                this.transformManager.setMode('scale');
                break;
                
            // Object manipulation keys
            case 'k': 
                await this.saveAllChanges();
                break;
            case 'delete':
            case 'l':
                if (this.transformManager.hasSelectedObject()) {
                    this.transformManager.deleteSelectedObject();
                }
                break;
            case 'n':
                this.objectCatalog.toggleCatalog();
                break;
            case ' ': // Space key
                if (this.transformManager.hasSelectedObject()) {
                    this.transformManager.duplicateSelectedObject(this.worldManager);
                }
                break;
        }
    }
    
    /**
     * Handle key up events in debug mode
     * @param {KeyboardEvent} event - Key event
     */
    handleKeyUp(event) {
        switch(event.key.toLowerCase()) {
            case 'w': this.keys.w = false; break;
            case 'a': this.keys.a = false; break;
            case 's': this.keys.s = false; break;
            case 'd': this.keys.d = false; break;
            case 'q': this.keys.q = false; break;
            case 'e': this.keys.e = false; break;
            case 'shift': this.keys.shift = false; break;
        }
    }
    
    /**
     * Handle a transform save event from the inspector
     * @param {CustomEvent} event - Transform save event
     */
    async handleTransformSave(event) {
        if (this.worldManager && event.detail.object) {
            const object = event.detail.object;
            const objectId = object.userData.id;
            const index = object.userData.instanceIndex;

            if (objectId !== undefined && index !== undefined) {
                try {
                    const success = await this.worldManager.updateObjectInstance(
                        objectId,
                        index,
                        object.position,
                        object.rotation,
                        object.scale
                    );
                    
                    if (success) {
                        showFeedback(
                            this.saveFeedback,
                            'Changes Saved!',
                            'rgba(0, 255, 0, 0.7)'
                        );
                    } else {
                        // Show error feedback
                        showFeedback(
                            this.saveFeedback,
                            'Failed to Save Changes',
                            'rgba(255, 0, 0, 0.7)'
                        );
                    }
                } catch (error) {
                    console.error('Error saving transform:', error);
                    // Show error feedback
                    showFeedback(
                        this.saveFeedback,
                        'Error Saving Changes',
                        'rgba(255, 0, 0, 0.7)'
                    );
                }
            }
        }
    }
    
    /**
     * Toggle debug mode on/off
     */
    toggleDebugMode() {
        // Check for unsaved changes before exiting
        if (this.isDebugMode && this.changeManager.hasPendingChanges()) {
            const shouldExit = confirm('You have unsaved changes. Exit debug mode anyway?');
            if (!shouldExit) {
                return;
            }
            this.changeManager.clearChanges();
        }
        
        this.isDebugMode = !this.isDebugMode;
        
        if (this.isDebugMode) {
            // Make sure worldManager methods are initialized
            this.initializeWorldManagerMethods();
            
            // Store current camera state
            this.originalCameraPosition.copy(this.camera.position);
            this.originalCameraRotation.copy(this.camera.rotation);
            
            // Enable orbit controls
            this.orbitControls.enabled = true;
            
            // Disable character controls
            if (this.character) {
                this.character.enabled = false;
                this.character.controls.unlock();
            }

            // Show debug UI
            this.debugOverlay.style.display = 'block';
            this.transformModeIndicator.style.display = 'block';
            this.transformManager.updateModeIndicator('Move');
            
            // Create visual indicators for existing spawners
            this.spawnerManager.createSpawnerVisuals();
        } else {
            // Restore camera state
            this.camera.position.copy(this.originalCameraPosition);
            this.camera.rotation.copy(this.originalCameraRotation);
            
            // Disable orbit controls
            this.orbitControls.enabled = false;
            
            // Enable character controls
            if (this.character) {
                this.character.enabled = true;
            }

            // Hide debug UI
            this.debugOverlay.style.display = 'none';
            this.transformModeIndicator.style.display = 'none';
            
            // Close catalog if open
            this.objectCatalog.toggleCatalog(false);

            // Clear transform selection
            this.transformManager.transformControls.detach();
            
            // Remove spawner visual indicators
            this.spawnerManager.removeSpawnerVisuals();
        }

        // Toggle hitbox visibility
        if (this.worldManager) {
            this.worldManager.toggleHitboxes(this.isDebugMode);
        }
    }
    
    /**
     * Place an object in the world
     * @param {string} objectId - ID of object to place
     * @param {THREE.Vector3} position - Position to place the object
     */
    async placeObjectInWorld(objectId, position) {
        try {
            // Get model info from registry
            const itemInfo = ObjectRegistry.items.find(item => item.id === objectId);
            if (!itemInfo) throw new Error(`Item ${objectId} not found in registry`);
            
            const rotation = new THREE.Euler(0, 0, 0);
            
            // Get the accurate world scale factor
            const worldScaleFactor = this.worldManager.scaleFactor || 1.0;
            
            // Get base scale from the registry item
            const baseScale = itemInfo.scale || 1.0;
                
            // Apply world scale factor to the object's scale
            const scale = new THREE.Vector3(
                baseScale * worldScaleFactor, 
                baseScale * worldScaleFactor, 
                baseScale * worldScaleFactor
            );
            
            // Get the current world data to determine next available instance index
            let instanceIndex;
            try {
                const worldData = await worldManagerService.getWorldData();
                const objectData = worldData.objects.find(obj => obj.id === objectId);
                
                if (objectData && objectData.instances) {
                    // Find the next available index by looking for gaps or using the next number
                    let maxIndex = -1;
                    const usedIndices = new Set();
                    
                    objectData.instances.forEach((instance, idx) => {
                        if (instance !== null) {
                            usedIndices.add(idx);
                            maxIndex = Math.max(maxIndex, idx);
                        }
                    });
                    
                    // Look for the first unused index
                    for (let i = 0; i <= maxIndex + 1; i++) {
                        if (!usedIndices.has(i)) {
                            instanceIndex = i;
                            break;
                        }
                    }
                } else {
                    // If object doesn't exist yet, start with index 0
                    instanceIndex = 0;
                }
            } catch (error) {
                // Fallback to simple incrementing index if we can't get world data
                console.warn("Couldn't determine next instance index, using fallback:", error);
                instanceIndex = 0;
            }


            // Create the object instance
            const success = await this.worldManager.createObjectInstance(
                objectId,
                instanceIndex,
                position,
                rotation,
                scale
            );
            
            if (success) {
                // Get the created object and attach transform controls
                this.scene.traverse((object) => {
                    if (object.userData.id === objectId && 
                        object.userData.instanceIndex === instanceIndex) {
                        
                        this.transformManager.transformControls.detach();
                        this.transformManager.transformControls.attach(object);
                        
                        // Record this as a change
                        this.changeManager.recordChange(object);
                        
                        // Show feedback
                        showFeedback(
                            this.saveFeedback,
                            `Added ${objectId} - Press K to save`,
                            'rgba(0, 255, 0, 0.7)'
                        );
                    }
                });
                
                return true;
            } else {
                throw new Error('Failed to create object instance');
            }
        } catch (error) {
            console.error(`Error placing object ${objectId}:`, error);
            showFeedback(
                this.saveFeedback,
                `Error: ${error.message}`,
                'rgba(255, 0, 0, 0.7)'
            );
            return false;
        }
    }
    
    /**
     * Place a spawner in the world
     * @param {string} spawnerId - ID of spawner to place
     * @param {THREE.Vector3} position - Position to place the spawner
     */
    placeSpawnerInWorld(spawnerId, position) {
        const success = this.spawnerManager.placeSpawnerInWorld(spawnerId, position);
        
        if (success) {
            showFeedback(
                this.saveFeedback,
                `Added ${spawnerId} spawner - Press K to save`,
                'rgba(0, 255, 0, 0.7)'
            );
        } else {
            showFeedback(
                this.saveFeedback,
                `Error placing ${spawnerId} spawner`,
                'rgba(255, 0, 0, 0.7)'
            );
        }
        
        return success;
    }
    
    /**
     * Save all pending changes
     */
    async saveAllChanges() {
        return this.changeManager.saveAllChanges(this.worldManager);
    }
    
    /**
     * Update editor state (called every frame)
     */
    update() {
        if (!this.isDebugMode) return;

        // Update orbit controls
        this.orbitControls.update();

        // Only handle movement if we're not dragging an object
        if (!this.transformManager.transformControls.dragging) {
            // Handle keyboard movement
            const moveSpeed = this.keys.shift ? this.moveSpeed * 2 : this.moveSpeed;
            
            if (this.keys.w) this.camera.position.z -= moveSpeed;
            if (this.keys.s) this.camera.position.z += moveSpeed;
            if (this.keys.a) this.camera.position.x -= moveSpeed;
            if (this.keys.d) this.camera.position.x += moveSpeed;
            if (this.keys.q) this.camera.position.y -= moveSpeed;
            if (this.keys.e) this.camera.position.y += moveSpeed;
        }
    }
    
    /**
     * Set world manager reference
     * @param {Object} worldManager - World manager instance
     */
    setWorldManager(worldManager) {
        this.worldManager = worldManager;
        
        // Ensure the worldManager has all required methods for editor functionality
        this.initializeWorldManagerMethods();
    }
    
    /**
     * Initialize required methods on the world manager
     */
    initializeWorldManagerMethods() {
        if (!this.worldManager) return;
        
        // If createObjectInstance doesn't exist, create it
        if (typeof this.worldManager.createObjectInstance !== 'function') {
            // Ensure world manager has model loader
            if (!this.worldManager.modelLoader) {
                this.worldManager.modelLoader = this.modelLoader;
            }
            
            // Create a new method on worldManager for creating object instances
            this.worldManager.createObjectInstance = async (objectId, instanceIndex, position, rotation, scale) => {
                try {
                    
                    // Find the model path based on objectId
                    const modelInfo = ObjectRegistry.items.find(item => item.id === objectId);
                    if (!modelInfo) {
                        return false;
                    }
                    
                    // Get the full path to the model using assetPath helper
                    const modelPath = ObjectRegistry.getModelPath(objectId);
                    
                    // First, update the worldData to include this new instance
                    try {
                        // Get world data and ensure object exists
                        if (!this.worldManager.worldData) {
                            await this.worldManager.loadWorld();
                        }
                        
                        let worldData = this.worldManager.worldData;
                        let objectData = worldData.objects.find(obj => obj.id === objectId);
                        
                        if (!objectData) {
                            objectData = {
                                id: objectId,
                                instances: []
                            };
                            worldData.objects.push(objectData);
                        }
                        
                        // Ensure instances array exists
                        if (!objectData.instances) {
                            objectData.instances = [];
                        }
                        
                        // Calculate normalized scale (divided by world scale factor)
                        const worldScaleFactor = this.worldManager.scaleFactor || 1;
                        const normalizedScale = {
                            x: scale.x / worldScaleFactor,
                            y: scale.y / worldScaleFactor,
                            z: scale.z / worldScaleFactor
                        };
                        
                        // Make sure array is big enough
                        while (objectData.instances.length <= instanceIndex) {
                            objectData.instances.push(null);
                        }
                        
                        // Create new instance data
                        objectData.instances[instanceIndex] = {
                            x: position.x,
                            y: position.y,
                            z: position.z,
                            rotationX: rotation.x,
                            rotationY: rotation.y,
                            rotationZ: rotation.z,
                            scaleX: normalizedScale.x,
                            scaleY: normalizedScale.y,
                            scaleZ: normalizedScale.z
                        };
                    } catch (error) {
                        console.error('Error updating world data:', error);
                    }
                    
                    return new Promise((resolve, reject) => {
                        this.modelLoader.load(
                            modelPath,
                            (gltf) => {
                                const model = gltf.scene.clone();
                                
                                // Apply position, rotation, and scale
                                model.position.copy(position);
                                model.rotation.copy(rotation);
                                model.scale.copy(scale);
                                
                                // Store metadata for later reference
                                model.userData.id = objectId;
                                model.userData.instanceIndex = instanceIndex;
                                model.userData.type = 'object';
                                
                                // Add to scene
                                this.scene.add(model);
                                
                                resolve(true);
                            },
                            undefined,
                            (error) => {
                                console.error(`Error loading model ${objectId}:`, error);
                                reject(error);
                            }
                        );
                    });
                } catch (error) {
                    console.error(`Error creating object instance:`, error);
                    return false;
                }
            };
        }
        
        // Add delete method if it doesn't exist
        if (typeof this.worldManager.deleteObjectInstance !== 'function') {
            this.worldManager.deleteObjectInstance = async (objectId, instanceIndex) => {
                try {
                    // Find the object in the scene
                    let objectToRemove = null;
                    this.scene.traverse(object => {
                        if (object.userData.id === objectId && 
                            object.userData.instanceIndex === parseInt(instanceIndex)) {
                            objectToRemove = object;
                        }
                    });
                    
                    if (objectToRemove) {
                        this.scene.remove(objectToRemove);
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error(`Error deleting object: ${error.message}`);
                    return false;
                }
            };
        }
        
        // Add update method if it doesn't exist
        if (typeof this.worldManager.updateObjectInstance !== 'function') {
            this.worldManager.updateObjectInstance = async (objectId, instanceIndex, position, rotation, scale) => {
                try {
                    // Find the object in the scene
                    let objectToUpdate = null;
                    this.scene.traverse(object => {
                        if (object.userData.id === objectId && 
                            object.userData.instanceIndex === parseInt(instanceIndex)) {
                            objectToUpdate = object;
                        }
                    });
                    
                    if (objectToUpdate) {
                        objectToUpdate.position.copy(position);
                        objectToUpdate.rotation.copy(rotation);
                        objectToUpdate.scale.set(scale.x, scale.y, scale.z);
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error(`Error updating object: ${error.message}`);
                    return false;
                }
            };
        }
    }
    
    /**
     * Clean up all components and event listeners
     */
    dispose() {
        // Remove event listeners
        // Remove components
        this.transformManager.transformControls.dispose();
        this.orbitControls.dispose();
        
        // Remove UI elements
        document.body.removeChild(this.debugOverlay);
        document.body.removeChild(this.transformModeIndicator);
        document.body.removeChild(this.saveFeedback);
        
        // Clean up catalog
        this.objectCatalog.dispose();
    }
} 