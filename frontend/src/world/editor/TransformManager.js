import * as THREE from 'three';
import { TransformControls } from './../../../node_modules/three/examples/jsm/controls/TransformControls.js';
import { getPositionInFrontOfCamera } from '../../utils/SceneUtils.js';
import { showFeedback } from '../../utils/UIUtils.js';

/**
 * Manages transform controls and object manipulation in the editor
 */
export class TransformManager {
    /**
     * @param {THREE.Scene} scene - Three.js scene
     * @param {THREE.Camera} camera - Three.js camera
     * @param {THREE.WebGLRenderer} renderer - Three.js renderer
     * @param {Object} changeManager - ChangeManager instance
     * @param {HTMLElement} feedbackElement - Element for feedback messages
     * @param {Object} orbitControls - OrbitControls instance for disabling during transform
     */
    constructor(scene, camera, renderer, changeManager, feedbackElement, orbitControls) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.changeManager = changeManager;
        this.feedbackElement = feedbackElement;
        this.orbitControls = orbitControls;
        
        // Create transform controls
        this.transformControls = new TransformControls(camera, renderer.domElement);
        this.scene.add(this.transformControls);
        
        // Mode indicator element
        this.modeIndicator = null;
        
        this.setupEventListeners();
    }
    
    /**
     * Set up event listeners for transform controls
     */
    setupEventListeners() {
        // Add transform controls event listeners
        this.transformControls.addEventListener('dragging-changed', (event) => {
            // Disable orbit controls while dragging
            if (this.orbitControls) {
                this.orbitControls.enabled = !event.value;
            }
            
            // When dragging ends, record the change
            if (!event.value && this.transformControls.object) {
                this.changeManager.recordChange(this.transformControls.object);
            }
        });

        // Listen for changes during transform
        this.transformControls.addEventListener('objectChange', () => {
            if (this.transformControls.object) {
                this.changeManager.recordChange(this.transformControls.object);
            }
        });
    }
    
    /**
     * Set the mode indicator element
     * @param {HTMLElement} element - Mode indicator element
     */
    setModeIndicator(element) {
        this.modeIndicator = element;
    }
    
    /**
     * Update the transform mode indicator
     * @param {string} mode - Mode name to display
     */
    updateModeIndicator(mode) {
        if (this.modeIndicator) {
            this.modeIndicator.textContent = `Transform Mode: ${mode}`;
        }
    }
    
    /**
     * Set the transform mode
     * @param {string} mode - 'translate', 'rotate', or 'scale'
     * @param {Object} options - Optional settings for the mode
     * @param {boolean} options.showX - Show X axis
     * @param {boolean} options.showY - Show Y axis
     * @param {boolean} options.showZ - Show Z axis
     * @param {Function} options.onChange - Custom onChange handler
     */
    setMode(mode, options = {}) {
        const { showX = true, showY = true, showZ = true, onChange = null } = options;
        
        // Set the mode on transform controls
        this.transformControls.setMode(mode);
        
        // Set axis visibility
        this.transformControls.showX = showX;
        this.transformControls.showY = showY;
        this.transformControls.showZ = showZ;
        
        // Update the mode indicator
        let modeName = mode.charAt(0).toUpperCase() + mode.slice(1);
        
        // Special handling for specific modes
        if (mode === 'scale' && showY && !showX && !showZ) {
            modeName = 'Uniform Scale';
        } else if (mode === 'rotate' && showY && !showX && !showZ) {
            modeName = 'Snap Rotate (90°)';
        }
        
        this.updateModeIndicator(modeName);
        
        // If we were provided a custom onChange handler
        if (onChange && this.transformControls.object) {
            // Remove any existing objectChange listeners (stored on the object)
            if (this.transformControls.object.__customChangeHandler) {
                this.transformControls.removeEventListener(
                    'objectChange', 
                    this.transformControls.object.__customChangeHandler
                );
            }
            
            // Add the new handler
            this.transformControls.object.__customChangeHandler = onChange;
            this.transformControls.addEventListener('objectChange', onChange);
        }
    }
    
    /**
     * Create uniform scale mode
     */
    setUniformScaleMode() {
        const onUniformScale = () => {
            const object = this.transformControls.object;
            if (object) {
                // Use Y axis scale as the uniform scale factor
                const scale = object.scale.y;
                // Apply uniform scale to all axes
                object.scale.set(scale, scale, scale);
            }
        };
        
        this.setMode('scale', {
            showX: false, 
            showY: true, 
            showZ: false,
            onChange: onUniformScale
        });
    }
    
    /**
     * Create individual axis scale mode
     */
    setAxisScaleMode() {
        // Clear any existing custom handlers by setting null onChange
        this.setMode('scale', {
            showX: true, 
            showY: true, 
            showZ: true,
            onChange: null
        });
    }
    
    /**
     * Create snap rotation mode
     */
    setSnapRotationMode() {
        const onSnapRotate = () => {
            const object = this.transformControls.object;
            if (object) {
                // Get current Y rotation
                const currentY = object.rotation.y;
                // Snap to nearest 90 degrees (π/2 radians)
                const snapAngle = Math.PI / 2;
                const snappedY = Math.round(currentY / snapAngle) * snapAngle;
                // Apply snapped rotation
                object.rotation.y = snappedY;
            }
        };
        
        this.setMode('rotate', {
            showX: false, 
            showY: true, 
            showZ: false,
            onChange: onSnapRotate
        });
    }
    
    /**
     * Select object by raycasting at mouse position
     * @param {MouseEvent} event - Mouse event with clientX and clientY
     */
    selectObjectAtMouse(event) {
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
            
            // Find the parent object with userData.id and userData.instanceIndex
            while (selectedObject && selectedObject !== this.scene) {
                if (selectedObject.userData && 
                    selectedObject.userData.id !== undefined && 
                    selectedObject.userData.instanceIndex !== undefined) {
                    break; // Found an identifiable parent
                }
                if (selectedObject.parent) {
                    selectedObject = selectedObject.parent;
                } else {
                    break;
                }
            }
            
            // If we couldn't find a proper parent with ID and instance index,
            // try to find it by traversing up from the hit object's parents and siblings
            if (!selectedObject.userData || 
                selectedObject.userData.id === undefined || 
                selectedObject.userData.instanceIndex === undefined) {
                
                // Start from the original hit and walk up the tree
                let parent = intersects[0].object;
                while (parent && parent !== this.scene) {
                    // Check siblings
                    if (parent.parent) {
                        for (const sibling of parent.parent.children) {
                            if (sibling.userData && 
                                sibling.userData.id !== undefined && 
                                sibling.userData.instanceIndex !== undefined) {
                                selectedObject = sibling;
                                break;
                            }
                        }
                    }
                    
                    // Move up to parent
                    if (parent.parent) {
                        parent = parent.parent;
                    } else {
                        break;
                    }
                }
            }
            
            // Prevent selecting the transform controls itself
            if (!selectedObject.isTransformControls && 
                selectedObject.userData && 
                selectedObject.userData.id !== undefined &&
                selectedObject.userData.instanceIndex !== undefined) {
                this.transformControls.detach(); // Detach first to prevent issues
                this.transformControls.attach(selectedObject);
            }
        } else {
            this.transformControls.detach();
        }
    }
    
    /**
     * Delete the currently selected object
     */
    deleteSelectedObject() {
        const object = this.transformControls.object;
        if (!object) return;
        
        // Mark for deletion in the change manager
        this.changeManager.markForDeletion(object);
        
        // Detach transform controls
        this.transformControls.detach();
    }
    
    /**
     * Duplicate the currently selected object
     * @param {Object} worldManager - World manager instance for creating new objects
     */
    async duplicateSelectedObject(worldManager) {
        // Get the currently selected object
        const originalObject = this.transformControls.object;
        if (!originalObject) return;
        
        const objectId = originalObject.userData.id;
        const instanceIndex = originalObject.userData.instanceIndex;
        
        if (objectId === undefined || instanceIndex === undefined) {
            console.error('Cannot duplicate object with invalid ID or instance index');
            return;
        }
        
        try {
            // Generate a new instance index based on timestamp
            const newInstanceIndex = Date.now() % 1000000;
            
            // Create a duplicate with a slight offset
            const positionOffset = 1; // 1 unit offset
            const newPosition = originalObject.position.clone();
            newPosition.x += positionOffset;
            
            // Use the original rotation and scale
            const rotation = originalObject.rotation.clone();
            const scale = originalObject.scale.clone();
            
            // Create a new instance using the worldManager
            const success = await worldManager.createObjectInstance(
                objectId, 
                newInstanceIndex, 
                newPosition, 
                rotation, 
                scale
            );
            
            if (success) {
                // Find and select the newly created object
                this.scene.traverse((object) => {
                    if (object.userData.id === objectId && 
                        object.userData.instanceIndex === newInstanceIndex) {
                        
                        // Select the new object
                        this.transformControls.detach();
                        this.transformControls.attach(object);
                        
                        // Record this as a change
                        this.changeManager.recordChange(object);
                        
                        // Show feedback
                        showFeedback(
                            this.feedbackElement,
                            `Duplicated ${objectId} - Press K to save`,
                            'rgba(0, 255, 0, 0.7)'
                        );
                    }
                });
            } else {
                throw new Error('Failed to create duplicate object');
            }
        } catch (error) {
            console.error(`Error duplicating object ${objectId}:`, error);
            showFeedback(
                this.feedbackElement,
                `Error: ${error.message}`,
                'rgba(255, 0, 0, 0.7)'
            );
        }
    }
    
    /**
     * Get the currently selected object
     * @returns {THREE.Object3D|null} The selected object or null
     */
    getSelectedObject() {
        return this.transformControls.object;
    }
    
    /**
     * Check if an object is currently selected
     * @returns {boolean} True if an object is selected
     */
    hasSelectedObject() {
        return this.transformControls.object !== undefined && 
               this.transformControls.object !== null;
    }
} 