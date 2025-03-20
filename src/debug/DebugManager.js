import * as THREE from 'three';
import { OrbitControls } from './../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from './../../node_modules/three/examples/jsm/controls/TransformControls.js';

export class DebugManager {
    constructor(scene, camera, renderer, character) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.character = character;
        this.isDebugMode = false;
        this.worldManager = null;
        
        // Store original camera position and rotation
        this.originalCameraPosition = new THREE.Vector3();
        this.originalCameraRotation = new THREE.Euler();
        
        // Create orbit controls for free roaming (disabled by default)
        this.orbitControls = new OrbitControls(camera, renderer.domElement);
        this.orbitControls.enabled = false;
        
        // Configure orbit controls
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.screenSpacePanning = false;
        this.orbitControls.minDistance = 1;
        this.orbitControls.maxDistance = 500;
        this.orbitControls.maxPolarAngle = Math.PI;

        // Add change tracking
        this.pendingChanges = new Map(); // Map<objectId, {model, index, originalState, currentState}>
        this.changeCount = 0;
        
        // Create transform controls
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.scene.add(this.transformControls);
        
        // Add transform controls event listeners
        this.transformControls.addEventListener('dragging-changed', (event) => {
            // Disable orbit controls while dragging
            this.orbitControls.enabled = !event.value;
            
            // When dragging ends, record the change
            if (!event.value && this.transformControls.object) {
                this.recordChange(this.transformControls.object);
            }
        });

        // Listen for changes during transform
        this.transformControls.addEventListener('objectChange', () => {
            if (this.transformControls.object) {
                this.recordChange(this.transformControls.object);
            }
        });
        
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
        
        // Create debug overlay
        this.createDebugOverlay();
        
        // Setup event listeners
        this.setupEventListeners();

        // Listen for transform save events
        document.addEventListener('transformSave', this.handleTransformSave.bind(this));
    }
    
    createDebugOverlay() {
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
            <div>Mouse Wheel: Zoom</div>
            <div style="margin-top: 10px;">Transform Controls:</div>
            <div>1: Move Mode</div>
            <div>2: Rotate Mode</div>
            <div>3: Scale Mode</div>
            <div>4: Uniform Scale Mode</div>
            <div>Space: Lock Transform</div>
            <div>X: Cancel Transform</div>
            <div>K: Save Transform</div>
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

    setupEventListeners() {
        document.addEventListener('keydown', async (event) => {
            // Handle existing movement keys
            if (this.isDebugMode) {
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
                        this.transformControls.setMode('translate');
                        this.transformControls.showX = true;
                        this.transformControls.showY = true;
                        this.transformControls.showZ = true;
                        this.updateTransformModeIndicator('Move');
                        break;
                    case '2': 
                        this.transformControls.setMode('rotate');
                        this.transformControls.showX = true;
                        this.transformControls.showY = true;
                        this.transformControls.showZ = true;
                        this.updateTransformModeIndicator('Rotate');
                        break;
                    case '3': 
                        this.transformControls.setMode('scale');
                        this.transformControls.showX = true;
                        this.transformControls.showY = true;
                        this.transformControls.showZ = true;
                        this.updateTransformModeIndicator('Scale');
                        break;
                    case '4': 
                        this.transformControls.setMode('scale');
                        // For uniform scaling, show only Y axis for simpler scaling
                        this.transformControls.showX = false;
                        this.transformControls.showY = true;
                        this.transformControls.showZ = false;
                        this.updateTransformModeIndicator('Uniform Scale');
                        
                        // Add a change listener for uniform scaling
                        const object = this.transformControls.object;
                        if (object) {
                            const onObjectChange = () => {
                                // Use Y axis scale as the uniform scale factor
                                const scale = object.scale.y;
                                // Apply uniform scale to all axes
                                object.scale.set(scale, scale, scale);
                            };
                            
                            // Remove any existing listener to prevent duplicates
                            this.transformControls.removeEventListener('objectChange', onObjectChange);
                            this.transformControls.addEventListener('objectChange', onObjectChange);
                            
                            // Remove the listener when switching modes
                            const clearListener = (event) => {
                                if (event.key >= '1' && event.key <= '3') {
                                    this.transformControls.removeEventListener('objectChange', onObjectChange);
                                    document.removeEventListener('keydown', clearListener);
                                }
                            };
                            document.addEventListener('keydown', clearListener);
                        }
                        break;
                    case 'k': 
                        console.log('K pressed, saving all changes...');
                        await this.saveAllChanges();
                        break;
                }
            }

            // Toggle debug mode with Shift+D
            if (event.shiftKey && event.key.toLowerCase() === 'd') {
                this.toggleDebugMode();
            }
        });

        document.addEventListener('keyup', (event) => {
            if (this.isDebugMode) {
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
        });

        // Add click handler for object selection
        this.renderer.domElement.addEventListener('click', (event) => {
            if (this.isDebugMode && !this.transformControls.isDragging) {
                this.handleObjectSelection(event);
            }
        });
    }

    handleObjectSelection(event) {
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // Get all objects in the scene that can be selected
        const objects = [];
        this.scene.traverse((object) => {
            // Only add meshes that aren't part of the transform controls
            if (object.isMesh && !object.parent?.isTransformControls) {
                objects.push(object);
            }
        });

        const intersects = raycaster.intersectObjects(objects, false);
        
        if (intersects.length > 0) {
            // Find the root object (the parent that represents the full model)
            let selectedObject = intersects[0].object;
            while (selectedObject.parent && selectedObject.parent !== this.scene) {
                selectedObject = selectedObject.parent;
            }
            
            // Prevent selecting the transform controls itself
            if (!selectedObject.isTransformControls) {
                this.transformControls.detach(); // Detach first to prevent any potential issues
                this.transformControls.attach(selectedObject);
            }
        } else {
            this.transformControls.detach();
        }
    }

    updateTransformModeIndicator(mode) {
        this.transformModeIndicator.textContent = `Transform Mode: ${mode}`;
    }

    showSaveFeedback() {
        this.saveFeedback.style.display = 'block';
        this.saveFeedback.style.opacity = '1';
        setTimeout(() => {
            this.saveFeedback.style.opacity = '0';
            setTimeout(() => {
                this.saveFeedback.style.display = 'none';
            }, 300); // Wait for fade out animation
        }, 1500);
    }

    async handleTransformSave(event) {
        if (this.worldManager && event.detail.object) {
            const object = event.detail.object;
            const modelName = object.userData.model;
            const index = object.userData.instanceIndex;

            if (modelName !== undefined && index !== undefined) {
                try {
                    const success = await this.worldManager.updateWallInstance(
                        modelName,
                        index,
                        object.position,
                        object.rotation,
                        object.scale
                    );
                    
                    if (success) {
                        this.saveFeedback.style.background = 'rgba(0, 255, 0, 0.7)';
                        this.saveFeedback.textContent = 'Changes Saved!';
                        this.showSaveFeedback();
                        console.log('Saved transform changes for', modelName, 'instance', index);
                    } else {
                        // Show error feedback
                        this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
                        this.saveFeedback.textContent = 'Failed to Save Changes';
                        this.showSaveFeedback();
                    }
                } catch (error) {
                    console.error('Error saving transform:', error);
                    // Show error feedback
                    this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
                    this.saveFeedback.textContent = 'Error Saving Changes';
                    this.showSaveFeedback();
                }
            }
        }
    }
    
    setWorldManager(worldManager) {
        this.worldManager = worldManager;
    }

    toggleDebugMode() {
        if (this.isDebugMode && this.pendingChanges.size > 0) {
            const shouldExit = confirm('You have unsaved changes. Exit debug mode anyway?');
            if (!shouldExit) {
                return;
            }
            this.pendingChanges.clear();
            this.changeCount = 0;
        }
        
        this.isDebugMode = !this.isDebugMode;
        
        if (this.isDebugMode) {
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
            this.updateTransformModeIndicator('Move');
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

            // Clear transform selection
            this.transformControls.detach();
        }

        // Toggle hitbox visibility
        if (this.worldManager) {
            this.worldManager.toggleHitboxes(this.isDebugMode);
        }
    }

    update() {
        if (!this.isDebugMode) return;

        // Update orbit controls
        this.orbitControls.update();

        // Only handle movement if we're not dragging an object
        if (!this.transformControls.dragging) {
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

    dispose() {
        // Remove event listeners and clean up
        this.transformControls.dispose();
        this.orbitControls.dispose();
        document.body.removeChild(this.debugOverlay);
        document.body.removeChild(this.transformModeIndicator);
        document.body.removeChild(this.saveFeedback);
    }

    recordChange(object) {
        const modelName = object.userData.model;
        const instanceIndex = object.userData.instanceIndex;
        
        if (modelName === undefined || instanceIndex === undefined) {
            return;
        }

        const objectId = `${modelName}-${instanceIndex}`;
        
        if (!this.pendingChanges.has(objectId)) {
            // Store the original state when first modifying an object
            this.pendingChanges.set(objectId, {
                model: modelName,
                index: instanceIndex,
                originalState: {
                    position: object.position.clone(),
                    rotation: object.rotation.clone(),
                    scale: object.scale.clone()
                },
                currentState: {
                    position: object.position.clone(),
                    rotation: object.rotation.clone(),
                    scale: object.scale.clone()
                }
            });
        } else {
            // Update current state
            const change = this.pendingChanges.get(objectId);
            change.currentState.position.copy(object.position);
            change.currentState.rotation.copy(object.rotation);
            change.currentState.scale.copy(object.scale);
        }

        this.changeCount = this.pendingChanges.size;
        this.updateChangeIndicator();
    }

    updateChangeIndicator() {
        if (this.changeCount > 0) {
            this.saveFeedback.style.background = 'rgba(255, 165, 0, 0.7)';
            this.saveFeedback.textContent = `${this.changeCount} Unsaved Changes - Press K to Save`;
            this.saveFeedback.style.display = 'block';
            this.saveFeedback.style.opacity = '1';
        } else {
            this.saveFeedback.style.opacity = '0';
            setTimeout(() => {
                this.saveFeedback.style.display = 'none';
            }, 300);
        }
    }

    async saveAllChanges() {
        if (this.pendingChanges.size === 0) {
            this.saveFeedback.style.background = 'rgba(255, 165, 0, 0.7)';
            this.saveFeedback.textContent = 'No Changes to Save';
            this.showSaveFeedback();
            return;
        }

        let successCount = 0;
        let failCount = 0;

        for (const [objectId, change] of this.pendingChanges) {
            try {
                const success = await this.worldManager.updateWallInstance(
                    change.model,
                    change.index,
                    change.currentState.position,
                    change.currentState.rotation,
                    change.currentState.scale
                );
                
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`Failed to save changes for ${objectId}:`, error);
                failCount++;
            }
        }

        // Clear pending changes regardless of success (prevent stuck state)
        this.pendingChanges.clear();
        this.changeCount = 0;

        // Show appropriate feedback
        if (failCount === 0) {
            this.saveFeedback.style.background = 'rgba(0, 255, 0, 0.7)';
            this.saveFeedback.textContent = `Saved ${successCount} Changes Successfully`;
        } else if (successCount === 0) {
            this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
            this.saveFeedback.textContent = `Failed to Save ${failCount} Changes`;
        } else {
            this.saveFeedback.style.background = 'rgba(255, 165, 0, 0.7)';
            this.saveFeedback.textContent = `Saved ${successCount}, Failed ${failCount}`;
        }
        
        this.showSaveFeedback();
        setTimeout(() => this.updateChangeIndicator(), 1500);
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
                // Apply position, rotation, and scale
                wallInstance.position.set(
                    instance.x,
                    instance.y,
                    instance.z
                );
                wallInstance.rotation.y = instance.rotationY;

                // Apply individual scale if available, otherwise use default scale
                if (instance.scaleX !== undefined && instance.scaleY !== undefined && instance.scaleZ !== undefined) {
                    wallInstance.scale.set(
                        instance.scaleX * this.worldData.settings.scaleFactor,
                        instance.scaleY * this.worldData.settings.scaleFactor,
                        instance.scaleZ * this.worldData.settings.scaleFactor
                    );
                } else {
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
                
                // Store the wall instance and its collision data
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
} 