import * as THREE from 'three';
import worldManagerService from '../../services/WorldManagerService.js';
import { showFeedback } from '../../utils/UIUtils.js';
import { findObjectWithUserData } from '../../utils/SceneUtils.js';

/**
 * Manages changes to world objects in the editor
 */
export class ChangeManager {
    /**
     * @param {THREE.Scene} scene - Three.js scene
     * @param {HTMLElement} feedbackElement - Element for displaying feedback
     */
    constructor(scene, feedbackElement) {
        this.scene = scene;
        this.feedbackElement = feedbackElement;
        
        // Map to track changes: Map<objectId-instanceIndex, change>
        this.pendingChanges = new Map();
        
        // Map to track large timestamp indices to actual instance indices
        this.largeIndexMapping = new Map();
        
        // Set to track deleted objects by their changeId
        this.deletedObjects = new Set();
        
        this.changeCount = 0;
    }
    
    /**
     * Records a change to an object
     * @param {THREE.Object3D} object - The object being changed
     */
    recordChange(object) {
        const objectId = object.userData.id;
        const instanceIndex = object.userData.instanceIndex;
        
        if (objectId === undefined || instanceIndex === undefined) {
            console.warn('Cannot record change for object without ID or instance index', object);
            return;
        }

        const changeId = `${objectId}-${instanceIndex}`;
        
        if (!this.pendingChanges.has(changeId)) {
            // Store original and current state when first modifying an object
            const change = {
                id: objectId,
                type: 'transform',
                userData: { ...object.userData },
                position: object.position.clone(),
                rotation: object.rotation.clone(),
                scale: object.scale.clone()
            };
            
            this.pendingChanges.set(changeId, change);

        } else {
            // Update current state if it's not a delete operation
            const change = this.pendingChanges.get(changeId);
            if (change.type !== 'delete') {
                change.position = object.position.clone();
                change.rotation = object.rotation.clone();
                change.scale = object.scale.clone();

            }
        }

        this.changeCount = this.pendingChanges.size;
        this.updateChangeIndicator();
    }
    
    /**
     * Mark an object for deletion
     * @param {THREE.Object3D} object - The object to delete
     */
    markForDeletion(object) {
        const objectId = object.userData.id;
        const instanceIndex = object.userData.instanceIndex;
        
        if (objectId === undefined || instanceIndex === undefined) {
            console.error('Cannot delete object with invalid ID or instance index', {
                objectId,
                instanceIndex
            });
            return;
        }

        // Create a consistent change ID format
        const changeId = `${objectId}-${instanceIndex}`;
        
        // Create a delete type change and add to pending changes
        const deleteChange = {
            id: objectId,
            type: 'delete',
            userData: {
                ...object.userData,
                instanceIndex: instanceIndex
            }
        };
        
        // Add to pending changes
        this.pendingChanges.set(changeId, deleteChange);
        
        // Remove object from scene immediately for visual feedback
        this.scene.remove(object);
        
        // Add to deleted objects set
        this.deletedObjects.add(changeId);
        
        // Update change indicator
        this.changeCount = this.pendingChanges.size;
        this.updateChangeIndicator();
        
        // Show deletion feedback
        showFeedback(
            this.feedbackElement, 
            'Object marked for deletion - Press K to save',
            'rgba(255, 165, 0, 0.7)'
        );
    }
    
    /**
     * Update the changes indicator UI
     */
    updateChangeIndicator() {
        if (this.changeCount > 0) {
            this.feedbackElement.style.background = 'rgba(255, 165, 0, 0.7)';
            this.feedbackElement.textContent = `${this.changeCount} Unsaved Changes - Press K to Save`;
            this.feedbackElement.style.display = 'block';
            this.feedbackElement.style.opacity = '1';
        } else {
            this.feedbackElement.style.opacity = '0';
            setTimeout(() => {
                this.feedbackElement.style.display = 'none';
            }, 300);
        }
    }
    
    /**
     * Save all pending changes to the world
     * @param {Object} worldManager - The world manager instance
     * @returns {Promise<boolean>} Success status
     */
    async saveAllChanges(worldManager) {
        try {

            // Process all pending changes
            if (this.pendingChanges.size === 0) {
                return true;
            }
            
            // Get current world data - this will be updated as we process changes
            let worldData = await worldManagerService.getWorldData();
            
            // Ensure the spawners array exists
            if (!worldData.spawners) {
                worldData.spawners = [];
            }
            
            // Convert Map to array for processing
            const allChanges = Array.from(this.pendingChanges.values());
            
            let successCount = 0;
            let failCount = 0;
            
            // First process all deletes to avoid conflicts
            const deleteChanges = allChanges.filter(change => change.type === 'delete');
            const transformChanges = allChanges.filter(change => change.type !== 'delete');
            
            // Process all deletions first
            for (const change of deleteChanges) {
                if (change.userData && change.userData.type === 'spawner') {
                    // Handle spawner deletion
                    const success = await this.handleSpawnerDeletion(worldData, change, worldManager);
                    success ? successCount++ : failCount++;
                } else {
                    // Handle regular object deletion
                    const success = await this.handleObjectDeletion(worldData, change);
                    success ? successCount++ : failCount++;
                }
            }
            
            // Only explicitly save after spawner deletions, since object deletions
            // are handled by deleteObjectFromWorldData which saves internally
            const hasSpawnerDeletions = deleteChanges.some(change => change.userData && change.userData.type === 'spawner');
            
            if (hasSpawnerDeletions) {
                // Save changes to disk for spawner deletions
                await worldManagerService.saveWorldData(worldData);
            }
            
            // If there are no transform changes, we can return now
            if (transformChanges.length === 0) {
                // Clear changes after saving
                this.pendingChanges.clear();
                this.deletedObjects.clear();
                
                // Show success message
                showFeedback(
                    this.feedbackElement, 
                    `Saved ${successCount} Changes Successfully`,
                    'rgba(0, 255, 0, 0.7)'
                );
                return true;
            }
            
            // Process all transform changes
            for (const change of transformChanges) {
                if (change.type === 'transform' && change.userData && change.userData.type === 'spawner') {
                    // Handle spawner transform update
                    const success = await this.handleSpawnerTransform(worldData, change);
                    success ? successCount++ : failCount++;
                } 
                else if (change.type === 'transform') {
                    // Handle regular object transform update
                    const success = await this.handleObjectTransform(worldData, change, worldManager);
                    success ? successCount++ : failCount++;
                }
            }
            
            // Save the updated world data only if there are transform changes
            if (transformChanges.length > 0) {
                await worldManagerService.saveWorldData(worldData);
            }
            
            // Clear changes after saving
            this.pendingChanges.clear();
            this.deletedObjects.clear();
            
            // Show appropriate feedback
            if (failCount === 0) {
                showFeedback(
                    this.feedbackElement, 
                    `Saved ${successCount} Changes Successfully`,
                    'rgba(0, 255, 0, 0.7)'
                );
            } else if (successCount === 0) {
                showFeedback(
                    this.feedbackElement, 
                    `Failed to Save ${failCount} Changes`,
                    'rgba(255, 0, 0, 0.7)'
                );
            } else {
                showFeedback(
                    this.feedbackElement, 
                    `Saved ${successCount}, Failed ${failCount}`,
                    'rgba(255, 165, 0, 0.7)'
                );
            }
            
            return true;
        } catch (error) {
            console.error('Failed to save debug changes:', error);
            
            // Show error feedback
            showFeedback(
                this.feedbackElement, 
                `Error: ${error.message}`,
                'rgba(255, 0, 0, 0.7)'
            );
            
            return false;
        }
    }
    
    /**
     * Handle deleting a spawner
     * @private
     */
    async handleSpawnerDeletion(worldData, change, worldManager) {
        try {
            console.log("handleSpawnerDeletion called with:", {
                change_id: change.id,
                change_userData: change.userData,
                worldData_spawners_count: worldData.spawners?.length || 0
            });
            
            // Find and remove the spawner from worldData
            const spawnerIndex = worldData.spawners.findIndex(
                s => s.id === change.id && (s.instanceIndex === change.userData.instanceIndex || s.index === change.userData.instanceIndex)
            );
            
            console.log("Spawner search results:", {
                spawnerIndex,
                worldData_spawners: JSON.stringify(worldData.spawners.map(s => ({ id: s.id, instanceIndex: s.instanceIndex || s.index })))
            });
            
            if (spawnerIndex !== -1) {
                worldData.spawners.splice(spawnerIndex, 1);
                console.log(`Removed spawner at index ${spawnerIndex} from worldData`);
                
                // Clean up the actual spawner if it exists
                if (worldManagerService.loadedSpawners) {
                    console.log("loadedSpawners structure:", {
                        type: typeof worldManagerService.loadedSpawners,
                        isArray: Array.isArray(worldManagerService.loadedSpawners),
                        length: Array.isArray(worldManagerService.loadedSpawners) ? worldManagerService.loadedSpawners.length : Object.keys(worldManagerService.loadedSpawners).length
                    });
                    
                    // loadedSpawners is an array, not an object with keys
                    const spawnerArrayIndex = worldManagerService.loadedSpawners.findIndex(
                        s => s.id === change.id && s.instanceIndex === change.userData.instanceIndex
                    );
                    console.log(`Spawner array index: ${spawnerArrayIndex}`);
                    
                    if (spawnerArrayIndex !== -1) {
                        const spawner = worldManagerService.loadedSpawners[spawnerArrayIndex];
                        console.log(`Found spawner to remove at index ${spawnerArrayIndex}`, {
                            id: spawner.id,
                            instanceIndex: spawner.instanceIndex
                        });
                        
                        // If spawner has a cleanup method, call it
                        if (spawner.clearTimeouts) {
                            spawner.clearTimeouts();
                            console.log("Cleared spawner timeouts");
                        }
                        
                        // If spawner has a current spawnable, clean it up
                        if (spawner.currentSpawnable) {
                            spawner.currentSpawnable.cleanup();
                            console.log("Cleaned up spawner's currentSpawnable");
                        }
                        
                        // Remove from loadedSpawners array
                        worldManagerService.loadedSpawners.splice(spawnerArrayIndex, 1);
                        console.log(`Removed spawner from loadedSpawners array`);
                        
                        // Remove the visual from the scene (important!)
                        const visualName = `spawner-visual-${change.id}-${change.userData.instanceIndex}`;
                        const visual = this.scene.getObjectByName(visualName);
                        if (visual) {
                            this.scene.remove(visual);
                            console.log(`Removed spawner visual ${visualName} from scene`);
                        } else {
                            console.warn(`Could not find spawner visual ${visualName} in scene`);
                        }
                        
                        // Remove any actual spawner models from the scene
                        if (spawner.model) {
                            this.scene.remove(spawner.model);
                            console.log("Removed spawner model from scene");
                        }
                    } else {
                        console.warn(`Could not find spawner ${change.id}-${change.userData.instanceIndex} in loadedSpawners array`);
                    }
                } else {
                    console.warn("worldManagerService.loadedSpawners is not available");
                }
                
                // Also remove the object that was marked for deletion
                const objectToDelete = findObjectWithUserData(this.scene, {
                    id: change.id,
                    instanceIndex: change.userData.instanceIndex,
                    type: 'spawner'
                });
                
                if (objectToDelete) {
                    this.scene.remove(objectToDelete);
                    console.log(`Removed object with userData from scene`);
                } else {
                    console.warn(`Could not find object with userData in scene`);
                }
                
                console.log("Spawner deletion completed successfully");
                return true;
            } else {
                console.warn(`Could not find spawner ${change.id} (${change.userData.instanceIndex}) in world data`);
                return false;
            }
        } catch (error) {
            console.error(`Error deleting spawner: ${error.message}`, error);
            return false;
        }
    }
    
    /**
     * Handle deleting a regular object
     * @private
     */
    async handleObjectDeletion(worldData, change) {
        try {
            console.log("handleObjectDeletion called with:", {
                change_id: change.id,
                change_userData: change.userData,
            });
            
            // First delete from world data via the service
            const result = await worldManagerService.deleteObjectFromWorldData(change.id, change.userData.instanceIndex);
            
            console.log(`Delete from worldData result: ${result ? 'success' : 'failed'}`);
            
            if (result) {
                // Then remove from scene if successful
                const objectToDelete = findObjectWithUserData(this.scene, {
                    id: change.id,
                    instanceIndex: change.userData.instanceIndex
                });
                
                if (objectToDelete) {
                    this.scene.remove(objectToDelete);
                    console.log(`Removed object ${change.id} (${change.userData.instanceIndex}) from scene`);
                    return true;
                } else {
                    console.warn(`Object to delete not found in scene: ${change.id}:${change.userData.instanceIndex}`);
                    // Still count as success since world data was updated
                    return true;
                }
            } else {
                console.error(`Failed to delete object ${change.id} from world data`);
                return false;
            }
        } catch (error) {
            console.error(`Failed to delete ${change.id}:`, error);
            return false;
        }
    }
    
    /**
     * Handle spawner transform changes
     * @private
     */
    async handleSpawnerTransform(worldData, change) {
        try {
            console.log("handleSpawnerTransform called with:", {
                change_id: change.id,
                change_userData: change.userData,
                position: change.position
            });
            
            // Find if this spawner already exists - check both instanceIndex and index
            const existingIndex = worldData.spawners.findIndex(
                s => s.id === change.id && (s.instanceIndex === change.userData.instanceIndex || s.index === change.userData.instanceIndex)
            );
            
            console.log(`Spawner search for updates, index: ${existingIndex}`);
            
            // Create spawner data object - only save ID, instance index and position
            const spawnerData = {
                id: change.id,
                instanceIndex: change.userData.instanceIndex,
                position: {
                    x: change.position.x,
                    y: change.position.y,
                    z: change.position.z
                }
            };
            
            // Update or add to world data
            if (existingIndex >= 0) {
                worldData.spawners[existingIndex] = spawnerData;
                console.log(`Updated spawner at index ${existingIndex} in worldData`);
            } else {
                worldData.spawners.push(spawnerData);
                console.log(`Added new spawner to worldData`);
            }
            
            // Update the actual spawner if it exists
            if (worldManagerService.loadedSpawners) {
                // Find spawner in array by id and instanceIndex
                const spawnerArrayIndex = worldManagerService.loadedSpawners.findIndex(
                    s => s.id === change.id && s.instanceIndex === change.userData.instanceIndex
                );
                
                if (spawnerArrayIndex !== -1) {
                    const spawner = worldManagerService.loadedSpawners[spawnerArrayIndex];
                    spawner.position.copy(change.position);
                    console.log(`Updated spawner position in loadedSpawners array`);
                }
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to update spawner ${change.id}:`, error);
            return false;
        }
    }
    
    /**
     * Handle object transform changes
     * @private
     */
    async handleObjectTransform(worldData, change, worldManager) {
        try {
            // Find the object in the world data
            let objectData = worldData.objects.find(obj => obj.id === change.id);
            
            // If object doesn't exist yet, create it
            if (!objectData) {
                objectData = {
                    id: change.id,
                    instances: []
                };
                worldData.objects.push(objectData);
            }
            
            // Ensure instances array exists
            if (!objectData.instances) {
                objectData.instances = [];
            }
            
            const instanceIndex = parseInt(change.userData.instanceIndex, 10);
            let actualIndex = instanceIndex;
            
            // For objects with very large timestamp-based indices (from newly placed objects)
            // we need to handle them specially
            if (instanceIndex > 100000) { // Threshold for timestamp-based indices
                
                // Check if we already have a mapping for this large index
                const mappingKey = `${change.id}-${instanceIndex}`;
                
                // If we don't have this object in our large index mapping, add it
                if (!this.largeIndexMapping) {
                    this.largeIndexMapping = new Map();
                }
                
                if (this.largeIndexMapping.has(mappingKey)) {
                    // Use the previously mapped index
                    actualIndex = this.largeIndexMapping.get(mappingKey);
                } else {
                    // Create a new instance at the end of the array
                    actualIndex = objectData.instances.length;
                    this.largeIndexMapping.set(mappingKey, actualIndex);
                    
                    // Add an empty object at this index
                    objectData.instances.push({});
                    
                    // Find the object in the scene with this large index
                    const sceneObject = findObjectWithUserData(this.scene, {
                        id: change.id,
                        instanceIndex: instanceIndex
                    });
                    
                    // Update the object's userData to use the new, smaller index
                    if (sceneObject) {
                        sceneObject.userData.instanceIndex = actualIndex;
                        
                        // Also update the change object to use the new index
                        change.userData.instanceIndex = actualIndex;
                        
                        // Update the pendingChanges map key
                        const oldChangeId = `${change.id}-${instanceIndex}`;
                        const newChangeId = `${change.id}-${actualIndex}`;
                        if (this.pendingChanges.has(oldChangeId)) {
                            const changeObj = this.pendingChanges.get(oldChangeId);
                            changeObj.userData.instanceIndex = actualIndex;
                            this.pendingChanges.delete(oldChangeId);
                            this.pendingChanges.set(newChangeId, changeObj);
                        }
                    }
                }
            }
            else if (instanceIndex >= objectData.instances.length || !objectData.instances[instanceIndex]) {
                // For more normal indices, create new instances as needed
                
                // Ensure array is large enough and instance exists
                while (objectData.instances.length <= instanceIndex) {
                    objectData.instances.push(null);
                }
                objectData.instances[instanceIndex] = {};
            }
            
            
            // Update position
            objectData.instances[actualIndex].x = change.position.x;
            objectData.instances[actualIndex].y = change.position.y;
            objectData.instances[actualIndex].z = change.position.z;
            
            // Update rotation
            objectData.instances[actualIndex].rotationX = change.rotation.x;
            objectData.instances[actualIndex].rotationY = change.rotation.y;
            objectData.instances[actualIndex].rotationZ = change.rotation.z;
            
            // Update scale - apply the world scale factor
            if (change.scale) {
                const scaleFactor = worldManager.scaleFactor || 1;
                objectData.instances[actualIndex].scaleX = change.scale.x / scaleFactor;
                objectData.instances[actualIndex].scaleY = change.scale.y / scaleFactor;
                objectData.instances[actualIndex].scaleZ = change.scale.z / scaleFactor;
            }
            
            return true;
        } catch (error) {
            console.error(`Failed to update transform for ${change.id}:`, error);
            return false;
        }
    }
    
    /**
     * Restore deleted objects when exiting without saving
     */
    restoreDeletedObjects() {
        // No-op if no deleted objects
        if (this.deletedObjects.size === 0) return;
        
        // We can't actually restore the objects since we've removed them from the scene
        // Just clear the tracking so the next time editor is opened, they'll be loaded fresh
        this.deletedObjects.clear();
    }
    
    /**
     * Check if there are pending changes
     * @returns {boolean} True if changes exist
     */
    hasPendingChanges() {
        return this.pendingChanges.size > 0;
    }
    
    /**
     * Clear all pending changes
     */
    clearChanges() {
        this.pendingChanges.clear();
        this.deletedObjects.clear();
        this.changeCount = 0;
        this.updateChangeIndicator();
    }
} 