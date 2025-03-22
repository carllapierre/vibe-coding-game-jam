import * as THREE from 'three';

/**
 * Find objects in scene by userData criteria
 * @param {THREE.Scene} scene - Three.js scene to search
 * @param {Object} criteria - Object with key/value pairs to match against userData
 * @returns {THREE.Object3D|null} The found object or null
 */
export function findObjectWithUserData(scene, criteria) {
    let foundObject = null;
    
    // Recursively check all objects in the scene
    scene.traverse(object => {
        if (foundObject) return; // Already found
        
        // Check if this object's userData matches all criteria
        const matches = Object.entries(criteria).every(([key, value]) => {
            return object.userData[key] === value;
        });
        
        if (matches) {
            foundObject = object;
        }
    });
    
    return foundObject;
}

/**
 * Get all objects in scene matching userData criteria
 * @param {THREE.Scene} scene - Three.js scene to search
 * @param {Object} criteria - Object with key/value pairs to match against userData
 * @returns {Array<THREE.Object3D>} Array of matching objects
 */
export function findAllObjectsWithUserData(scene, criteria) {
    const foundObjects = [];
    
    // Recursively check all objects in the scene
    scene.traverse(object => {
        // Check if this object's userData matches all criteria
        const matches = Object.entries(criteria).every(([key, value]) => {
            return object.userData[key] === value;
        });
        
        if (matches) {
            foundObjects.push(object);
        }
    });
    
    return foundObjects;
}

/**
 * Find an object by name in the scene
 * @param {THREE.Scene} scene - Three.js scene to search
 * @param {string} name - Name to search for
 * @returns {THREE.Object3D|null} The found object or null
 */
export function findObjectByName(scene, name) {
    return scene.getObjectByName(name);
}

/**
 * Calculate a position in front of the camera
 * @param {THREE.Camera} camera - Camera to calculate position from
 * @param {number} distance - Distance in front of camera
 * @param {boolean} placeOnGround - Whether to place on ground (y=0)
 * @returns {THREE.Vector3} The calculated position
 */
export function getPositionInFrontOfCamera(camera, distance = 5, placeOnGround = true) {
    const cameraDirection = new THREE.Vector3(0, 0, -1);
    cameraDirection.applyQuaternion(camera.quaternion);
    
    // Place the object in front of the camera
    const position = new THREE.Vector3().copy(camera.position).add(
        cameraDirection.multiplyScalar(distance)
    );
    
    // Place on the ground if requested
    if (placeOnGround) {
        position.y = 0;
    }
    
    return position;
}

/**
 * Clone an object and its materials
 * @param {THREE.Object3D} originalObject - Object to clone
 * @returns {THREE.Object3D} Cloned object
 */
export function deepCloneObject(originalObject) {
    const clone = originalObject.clone();
    
    // Clone materials for all descendent meshes
    clone.traverse(obj => {
        if (obj.isMesh && obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material = obj.material.map(mat => mat.clone());
            } else {
                obj.material = obj.material.clone();
            }
        }
    });
    
    return clone;
} 