import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ObjectRegistry } from '../../registries/ObjectRegistry.js';
import { PortalRegistry } from '../../registries/PortalRegistry.js';
import { PortalObject } from '../../portals/PortalObject.js';
import worldManagerService from '../../services/WorldManagerService.js';
import { ChangeManager } from './ChangeManager.js';
import { TransformManager } from './TransformManager.js';
import { SpawnerManager } from './SpawnerManager.js';
import { ObjectCatalog } from './ObjectCatalog.js';
import { showFeedback } from '../../utils/UIUtils.js';
import { api } from '../../config.js';
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
            this.placePortalInWorld.bind(this),
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

            if (api.environment !== 'production') { 
                // Toggle debug mode with Shift+D
                if (event.shiftKey && event.key.toLowerCase() === 'd') {
                    this.toggleDebugMode();
                }
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
     * Place a portal in the world
     * @param {string} portalId - Portal ID from registry
     * @param {THREE.Vector3} position - Position to place the portal
     */
    placePortalInWorld(portalId, position) {
        try {
            console.log(`Placing portal ${portalId} at position:`, position);
            
            // Generate a unique instance index - use current timestamp
            const instanceIndex = Date.now();
            
            // Create portal object with explicit instance index
            const portal = new PortalObject(portalId, position, instanceIndex);
            console.log(`Created portal object with instanceIndex ${instanceIndex}:`, portal);
            
            // Add to scene
            this.scene.add(portal);
            
            // Select with transform controls
            this.transformManager.transformControls.attach(portal);
            
            // Record creation change
            this.changeManager.recordChange(portal);
            
            // Show feedback
            showFeedback(
                this.saveFeedback,
                `Added ${portalId} portal - Press K to save`,
                'rgba(0, 255, 0, 0.7)'
            );
            
            // Return the created portal
            return portal;
        } catch (error) {
            console.error('Error placing portal:', error);
            
            showFeedback(
                this.saveFeedback,
                `Error: ${error.message}`,
                'rgba(255, 0, 0, 0.7)'
            );
            return null;
        }
    }
    
    /**
     * Save all changes to the world
     */
    async saveAllChanges() {
        try {
            // If we have a world manager, save all changes
            if (this.worldManager) {
                console.log("Starting to save all changes...");
                
                // Save object changes
                await this.changeManager.saveAllChanges(this.worldManager);
                
                // Save world data
                const promises = [];
                
                // Save objects
                if (this.worldManager.saveObjects) {
                    console.log("Adding saveObjects to save queue");
                    promises.push(this.worldManager.saveObjects());
                }
                
                // Save spawners
                if (this.worldManager.saveSpawners) {
                    console.log("Adding saveSpawners to save queue");
                    promises.push(this.worldManager.saveSpawners());
                }
                
                // Save portals
                if (this.worldManager.savePortals) {
                    console.log("Adding savePortals to save queue");
                    promises.push(this.worldManager.savePortals());
                } else {
                    console.warn("savePortals method not found on worldManager");
                }
                
                // Wait for all saves to complete
                console.log(`Executing ${promises.length} save operations...`);
                await Promise.all(promises);
                console.log("All save operations completed successfully");
            }
        } catch (error) {
            console.error('Error saving changes:', error);
        }
    }
    
    /**
     * Update the editor components
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Update orbit controls
        if (this.isDebugMode && this.orbitControls.enabled) {
            this.orbitControls.update();
        }
        
        // Update camera position based on keys
        if (this.isDebugMode) {
            this.updateCameraPosition(deltaTime);
        }
        
        // Update spawners and portals
        if (this.worldManager) {
            // Call the worldManagerService's updateSpawners method directly
            worldManagerService.updateSpawners(this.character);
            
            // Update portals
            if (this.worldManager.updatePortals && typeof this.worldManager.updatePortals === 'function') {
                this.worldManager.updatePortals(deltaTime);
            }
        }
    }
    
    /**
     * Set world manager reference
     * @param {Object} worldManager - World manager instance
     */
    setWorldManager(worldManager) {
        this.worldManager = worldManager;
        
        // Initialize required properties if they don't exist
        if (!this.worldManager.initPromises) {
            this.worldManager.initPromises = [];
        }
        
        if (!this.worldManager.saveTypes) {
            this.worldManager.saveTypes = [];
        }
        
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

        // Add portals from world data
        const addPortals = async () => {
            try {
                console.log("Starting to load portals from world data...");
                const worldData = await worldManagerService.getWorldData();
                
                console.log("World data keys:", Object.keys(worldData));
                
                if (!worldData) {
                    console.warn("No world data found for loading portals");
                    return;
                }
                
                if (!worldData.portals) {
                    console.log("No portals array in world data");
                    return;
                }
                
                if (!Array.isArray(worldData.portals)) {
                    console.warn("Portals property exists but is not an array:", worldData.portals);
                    return;
                }
                
                if (worldData.portals.length === 0) {
                    console.log("Portals array is empty - no portals to load");
                    return;
                }
                
                console.log(`Found ${worldData.portals.length} portals in world data:`, worldData.portals);
                
                // First, remove any existing portals from the scene to prevent duplicates
                const existingPortals = [];
                this.scene.traverse(obj => {
                    if (obj.userData && obj.userData.type === 'portal') {
                        existingPortals.push(obj);
                    }
                });
                
                if (existingPortals.length > 0) {
                    console.log(`Removing ${existingPortals.length} existing portals before loading`);
                    existingPortals.forEach(portal => {
                        // Dispose resources if possible
                        if (typeof portal.dispose === 'function') {
                            portal.dispose();
                        }
                        this.scene.remove(portal);
                    });
                }
                
                // Add each portal to the scene
                worldData.portals.forEach((portalData, index) => {
                    try {
                        console.log(`Loading portal ${index + 1}/${worldData.portals.length}: ${portalData.id}`);
                        
                        // Skip portals with invalid data
                        if (!portalData.id || !portalData.position) {
                            console.warn(`Portal ${index} has invalid data:`, portalData);
                            return;
                        }
                        
                        // Create the portal
                        const portal = new PortalObject(portalData.id, new THREE.Vector3(
                            portalData.position.x,
                            portalData.position.y,
                            portalData.position.z
                        ));
                        
                        // Make sure the portal has the correct instanceIndex from the saved data
                        if (portalData.instanceIndex) {
                            portal.userData.instanceIndex = portalData.instanceIndex;
                        }
                        
                        // Set rotation
                        if (portalData.rotation) {
                            portal.rotation.set(
                                portalData.rotation.x,
                                portalData.rotation.y,
                                portalData.rotation.z
                            );
                        }
                        
                        // Set scale
                        if (portalData.scale) {
                            portal.scale.set(
                                portalData.scale.x,
                                portalData.scale.y,
                                portalData.scale.z
                            );
                        }
                        
                        // Update label if custom label exists
                        if (portalData.label) {
                            portal.updateLabel(portalData.label);
                        }
                        
                        // Add to scene
                        this.scene.add(portal);
                        
                        console.log(`Added portal ${portalData.id} to scene`);
                        
                    } catch (error) {
                        console.error(`Error loading portal ${portalData.id}:`, error);
                    }
                });
                
                console.log(`Successfully loaded ${worldData.portals.length} portals from world data`);
                
            } catch (error) {
                console.error('Error loading portals:', error);
            }
        };
        
        // Add method to save portals
        this.worldManager.savePortals = async () => {
            try {
                console.log("Starting savePortals process...");
                
                // Get current world data
                const worldData = await worldManagerService.getWorldData();
                console.log("Current world data structure:", Object.keys(worldData));
                
                // Ensure the portals array exists
                if (!worldData.portals) {
                    console.log("Creating portals array in world data");
                    worldData.portals = [];
                }
                
                // Find all portals in the scene
                const portalObjects = [];
                this.scene.traverse(object => {
                    if (object.userData && object.userData.type === 'portal') {
                        console.log(`Found portal in scene: ${object.userData.id} with instance ${object.userData.instanceIndex}`);
                        portalObjects.push(object);
                    }
                });
                
                console.log(`Found ${portalObjects.length} portals in the scene`);
                
                // Reset portals array
                worldData.portals = [];
                
                // Add each portal to world data
                portalObjects.forEach(portal => {
                    const portalData = {
                        id: portal.userData.id,
                        instanceIndex: portal.userData.instanceIndex,
                        position: {
                            x: portal.position.x,
                            y: portal.position.y,
                            z: portal.position.z
                        },
                        rotation: {
                            x: portal.rotation.x,
                            y: portal.rotation.y,
                            z: portal.rotation.z
                        },
                        scale: {
                            x: portal.scale.x,
                            y: portal.scale.y,
                            z: portal.scale.z
                        },
                        label: portal.label ? portal.label.text : null
                    };
                    
                    console.log(`Adding portal to world data:`, portalData);
                    worldData.portals.push(portalData);
                });
                
                console.log(`Prepared ${worldData.portals.length} portals for saving`);
                
                // Log the structure of the world data before saving
                console.log("World data structure before saving:", {
                    hasPortals: !!worldData.portals,
                    portalCount: worldData.portals ? worldData.portals.length : 0,
                    topLevelKeys: Object.keys(worldData)
                });
                
                // Save world data
                const saveResult = await worldManagerService.saveWorldData(worldData);
                console.log(`Saved ${worldData.portals.length} portals to world data, result:`, saveResult);
                
                return true;
            } catch (error) {
                console.error('Error saving portals:', error);
                return false;
            }
        };
        
        // Add method to update portals
        this.worldManager.updatePortals = (deltaTime) => {
            // Update all portal animations
            this.scene.traverse(object => {
                if (object instanceof PortalObject) {
                    object.update(deltaTime);
                }
            });
        };
        
        // Add portals to initial load chain
        if (!this.worldManager.initPromises) {
            this.worldManager.initPromises = [];
        }
        this.worldManager.initPromises.push(addPortals());
        
        // Add portals to save chain
        if (!this.worldManager.saveTypes) {
            this.worldManager.saveTypes = [];
        }
        this.worldManager.saveTypes.push('portals');
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

    /**
     * Update camera position based on keyboard input
     * @param {number} deltaTime - Time since last update
     */
    updateCameraPosition(deltaTime) {
        // Only handle movement if we're not dragging an object
        if (this.transformManager.transformControls.dragging) {
            return;
        }
        
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