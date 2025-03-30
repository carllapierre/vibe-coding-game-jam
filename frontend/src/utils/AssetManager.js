import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetPath } from './pathHelper.js';

/**
 * AssetManager - A utility service for managing and caching 3D assets
 * Uses THREE.Cache to prevent duplicate asset loading
 */
class AssetManager {
  constructor() {
    // Ensure THREE.Cache is enabled
    THREE.Cache.enabled = true;
    
    // Initialize loaders
    this.gltfLoader = new GLTFLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.cubeTextureLoader = new THREE.CubeTextureLoader();
    
    // In-memory cache for loaded models (since GLTFLoader results aren't auto-cached by THREE.Cache)
    this.modelCache = new Map();
    this.textureCache = new Map();
    this.cubeTextureCache = new Map();
  }

  /**
   * Load a GLTF model with caching
   * @param {string} path - Path to the model
   * @param {Function} onLoad - Callback when model is loaded
   * @param {Function} onProgress - Callback for load progress
   * @param {Function} onError - Callback for load errors
   */
  loadModel(path, onLoad, onProgress, onError) {
    const fullPath = path.startsWith('/') ? path : assetPath(path);
    
    // Check our model cache first
    if (this.modelCache.has(fullPath)) {
      const cachedModel = this.modelCache.get(fullPath);
      // Clone the cached model scene to avoid reference issues
      const clone = THREE.SkeletonUtils?.clone ? 
        THREE.SkeletonUtils.clone(cachedModel.scene) : 
        cachedModel.scene.clone();
      
      // Wrap in a GLTF-like object to maintain consistency
      const clonedResult = { scene: clone, animations: cachedModel.animations };
      
      // Call the onLoad callback with cached data
      if (onLoad) {
        setTimeout(() => onLoad(clonedResult), 0);
      }
      return;
    }
    
    // Not in cache, load it
    this.gltfLoader.load(
      fullPath,
      (gltf) => {
        // Cache the result
        this.modelCache.set(fullPath, {
          scene: gltf.scene.clone(),
          animations: gltf.animations
        });
        
        if (onLoad) {
          onLoad(gltf);
        }
      },
      onProgress,
      onError
    );
  }
  
  /**
   * Load a texture with caching
   * @param {string} path - Path to the texture
   * @param {Function} onLoad - Callback when texture is loaded
   * @param {Function} onProgress - Callback for load progress
   * @param {Function} onError - Callback for load errors
   */
  loadTexture(path, onLoad, onProgress, onError) {
    const fullPath = path.startsWith('/') ? path : assetPath(path);
    
    // Check if already in our cache
    if (this.textureCache.has(fullPath)) {
      const texture = this.textureCache.get(fullPath);
      if (onLoad) {
        setTimeout(() => onLoad(texture), 0);
      }
      return texture;
    }
    
    // Load the texture (THREE.Cache will handle internally)
    const texture = this.textureLoader.load(
      fullPath,
      (loadedTexture) => {
        this.textureCache.set(fullPath, loadedTexture);
        if (onLoad) onLoad(loadedTexture);
      },
      onProgress,
      onError
    );
    
    return texture;
  }
  
  /**
   * Load a cubemap texture with caching
   * @param {Array<string>} paths - Array of 6 paths for the cubemap
   * @param {Function} onLoad - Callback when cubemap is loaded
   * @param {Function} onProgress - Callback for load progress
   * @param {Function} onError - Callback for load errors
   */
  loadCubeTexture(paths, onLoad, onProgress, onError) {
    const key = paths.join('|');
    
    // Check if already in our cache
    if (this.cubeTextureCache.has(key)) {
      const texture = this.cubeTextureCache.get(key);
      if (onLoad) {
        setTimeout(() => onLoad(texture), 0);
      }
      return texture;
    }
    
    // Set path prefix if needed
    if (!paths[0].startsWith('/') && !paths[0].startsWith('http')) {
      this.cubeTextureLoader.setPath(assetPath(''));
    }
    
    // Load the cubemap
    const texture = this.cubeTextureLoader.load(
      paths,
      (loadedTexture) => {
        this.cubeTextureCache.set(key, loadedTexture);
        if (onLoad) onLoad(loadedTexture);
      },
      onProgress,
      onError
    );
    
    return texture;
  }
  
  /**
   * Check if an item exists in the cache
   * @param {string} key - The cache key to check
   * @returns {boolean} - Whether the item exists in cache
   */
  hasInCache(key) {
    return THREE.Cache.get(key) !== undefined ||
           this.modelCache.has(key) ||
           this.textureCache.has(key);
  }
  
  /**
   * Clear specific items from cache or entire cache
   * @param {string|null} key - Specific key to clear, or null for all
   */
  clearCache(key = null) {
    if (key) {
      THREE.Cache.remove(key);
      this.modelCache.delete(key);
      this.textureCache.delete(key);
      
      // For cube textures, check if key is part of a cube map path
      for (const cubeKey of this.cubeTextureCache.keys()) {
        if (cubeKey.includes(key)) {
          this.cubeTextureCache.delete(cubeKey);
        }
      }
    } else {
      THREE.Cache.clear();
      this.modelCache.clear();
      this.textureCache.clear();
      this.cubeTextureCache.clear();
    }
  }
}

// Export as a singleton
const assetManager = new AssetManager();
export default assetManager; 