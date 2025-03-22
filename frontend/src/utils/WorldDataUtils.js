import * as THREE from 'three';

/**
 * Utility functions for handling world data operations
 */

/**
 * Find an object in world data by ID
 * @param {Object} worldData - The world data object
 * @param {string} objectId - The object ID to find
 * @returns {Object|null} - The found object data or null
 */
export function findObjectInWorldData(worldData, objectId) {
    if (!worldData || !worldData.objects) return null;
    return worldData.objects.find(obj => obj.id === objectId) || null;
}

/**
 * Find a spawner in world data by ID
 * @param {Object} worldData - The world data object
 * @param {string} spawnerId - The spawner ID to find
 * @returns {Object|null} - The found spawner data or null
 */
export function findSpawnerInWorldData(worldData, spawnerId) {
    if (!worldData || !worldData.spawners) return null;
    return worldData.spawners.find(spawner => spawner.id === spawnerId) || null;
}

/**
 * Get the next available instance index for an object
 * @param {Object} worldData - The world data object
 * @param {string} objectId - The object ID
 * @returns {number} - The next available instance index
 */
export function getNextInstanceIndex(worldData, objectId) {
    const objectData = findObjectInWorldData(worldData, objectId);
    
    if (!objectData || !objectData.instances) {
        return 0;
    }
    
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
            return i;
        }
    }
    
    // Fallback (should never reach here)
    return maxIndex + 1;
}

/**
 * Create a new object instance in world data
 * @param {Object} worldData - The world data object
 * @param {string} objectId - The object ID
 * @param {number} instanceIndex - The instance index
 * @param {THREE.Vector3} position - The position
 * @param {THREE.Euler} rotation - The rotation
 * @param {THREE.Vector3} scale - The scale
 * @param {number} worldScaleFactor - The world scale factor to normalize scales
 * @returns {Object} - Updated world data
 */
export function addObjectInstanceToWorldData(worldData, objectId, instanceIndex, position, rotation, scale, worldScaleFactor = 1.0) {
    if (!worldData) {
        worldData = { objects: [], spawners: [] };
    }
    
    if (!worldData.objects) {
        worldData.objects = [];
    }
    
    let objectData = findObjectInWorldData(worldData, objectId);
    
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
    
    return worldData;
}

/**
 * Add a spawner to world data
 * @param {Object} worldData - The world data object
 * @param {string} spawnerId - The spawner ID
 * @param {number} instanceIndex - The instance index
 * @param {THREE.Vector3} position - The position
 * @returns {Object} - Updated world data
 */
export function addSpawnerToWorldData(worldData, spawnerId, instanceIndex, position) {
    if (!worldData) {
        worldData = { objects: [], spawners: [] };
    }
    
    if (!worldData.spawners) {
        worldData.spawners = [];
    }
    
    // Create the spawner data
    const spawnerData = {
        id: spawnerId,
        index: instanceIndex,
        x: position.x,
        y: position.y,
        z: position.z
    };
    
    // Add to spawners array
    worldData.spawners.push(spawnerData);
    
    return worldData;
}

/**
 * Update an object instance in world data
 * @param {Object} worldData - The world data object
 * @param {string} objectId - The object ID
 * @param {number} instanceIndex - The instance index
 * @param {THREE.Vector3} position - The position
 * @param {THREE.Euler} rotation - The rotation
 * @param {THREE.Vector3} scale - The scale
 * @param {number} worldScaleFactor - The world scale factor to normalize scales
 * @returns {boolean} - Success or failure
 */
export function updateObjectInstanceInWorldData(worldData, objectId, instanceIndex, position, rotation, scale, worldScaleFactor = 1.0) {
    if (!worldData || !worldData.objects) return false;
    
    const objectData = findObjectInWorldData(worldData, objectId);
    
    if (!objectData || !objectData.instances || instanceIndex >= objectData.instances.length) {
        return false;
    }
    
    // Calculate normalized scale (divided by world scale factor)
    const normalizedScale = {
        x: scale.x / worldScaleFactor,
        y: scale.y / worldScaleFactor,
        z: scale.z / worldScaleFactor
    };
    
    // Update the instance
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
    
    return true;
}

/**
 * Update a spawner in world data
 * @param {Object} worldData - The world data object
 * @param {string} spawnerId - The spawner ID
 * @param {number} instanceIndex - The instance index
 * @param {THREE.Vector3} position - The position
 * @returns {boolean} - Success or failure
 */
export function updateSpawnerInWorldData(worldData, spawnerId, instanceIndex, position) {
    if (!worldData || !worldData.spawners) return false;
    
    const spawnerIndex = worldData.spawners.findIndex(
        spawner => spawner.id === spawnerId && spawner.index === instanceIndex
    );
    
    if (spawnerIndex === -1) return false;
    
    // Update spawner position
    worldData.spawners[spawnerIndex].x = position.x;
    worldData.spawners[spawnerIndex].y = position.y;
    worldData.spawners[spawnerIndex].z = position.z;
    
    return true;
}

/**
 * Remove an object instance from world data
 * @param {Object} worldData - The world data object
 * @param {string} objectId - The object ID
 * @param {number} instanceIndex - The instance index
 * @returns {boolean} - Success or failure
 */
export function removeObjectInstanceFromWorldData(worldData, objectId, instanceIndex) {
    if (!worldData || !worldData.objects) return false;
    
    const objectData = findObjectInWorldData(worldData, objectId);
    
    if (!objectData || !objectData.instances || instanceIndex >= objectData.instances.length) {
        return false;
    }
    
    // Set the instance to null (don't remove, to keep index alignment)
    objectData.instances[instanceIndex] = null;
    
    return true;
}

/**
 * Remove a spawner from world data
 * @param {Object} worldData - The world data object
 * @param {string} spawnerId - The spawner ID
 * @param {number} instanceIndex - The instance index
 * @returns {boolean} - Success or failure
 */
export function removeSpawnerFromWorldData(worldData, spawnerId, instanceIndex) {
    if (!worldData || !worldData.spawners) return false;
    
    console.log("removeSpawnerFromWorldData called with:", {
        spawnerId,
        instanceIndex,
        spawners_count: worldData.spawners.length
    });
    
    // Log all spawners for debugging
    console.log("Available spawners:", worldData.spawners.map(s => ({
        id: s.id,
        instanceIndex: s.instanceIndex,
        index: s.index
    })));
    
    // Check for spawner with either instanceIndex or index
    const spawnerIndex = worldData.spawners.findIndex(
        spawner => spawner.id === spawnerId && (spawner.instanceIndex === instanceIndex || spawner.index === instanceIndex)
    );
    
    console.log(`Spawner search result index: ${spawnerIndex}`);
    
    if (spawnerIndex === -1) {
        console.warn(`Could not find spawner with id=${spawnerId} and instanceIndex/index=${instanceIndex}`);
        return false;
    }
    
    // Remove spawner from array
    const removedSpawner = worldData.spawners.splice(spawnerIndex, 1)[0];
    console.log("Removed spawner:", removedSpawner);
    
    return true;
}

/**
 * Convert a Three.js Vector3 to a plain object
 * @param {THREE.Vector3} vector - The vector to convert
 * @returns {Object} - Plain object with x, y, z properties
 */
export function vector3ToObject(vector) {
    return {
        x: vector.x,
        y: vector.y,
        z: vector.z
    };
}

/**
 * Convert a plain object to a Three.js Vector3
 * @param {Object} obj - The object with x, y, z properties
 * @returns {THREE.Vector3} - The Vector3
 */
export function objectToVector3(obj) {
    return new THREE.Vector3(
        obj.x || 0,
        obj.y || 0,
        obj.z || 0
    );
}

/**
 * Convert a Three.js Euler to a plain object
 * @param {THREE.Euler} euler - The euler to convert
 * @returns {Object} - Plain object with rotationX, rotationY, rotationZ properties
 */
export function eulerToObject(euler) {
    return {
        rotationX: euler.x,
        rotationY: euler.y,
        rotationZ: euler.z
    };
}

/**
 * Convert rotation properties to a Three.js Euler
 * @param {Object} obj - The object with rotationX, rotationY, rotationZ properties
 * @returns {THREE.Euler} - The Euler
 */
export function objectToEuler(obj) {
    return new THREE.Euler(
        obj.rotationX || 0,
        obj.rotationY || 0,
        obj.rotationZ || 0
    );
} 