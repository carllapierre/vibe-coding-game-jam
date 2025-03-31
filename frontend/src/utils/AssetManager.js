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
   * Load a model with error handling
   * @param {string} path - Path to model file
   * @param {Function} onLoad - Callback when model is loaded
   * @param {Function} onError - Callback when error occurs
   */
  loadModel(path, onLoad, onError) {
    try {
      // Validate path
      if (!path) {
        console.error('Invalid model path');
        if (onError) onError(new Error('Invalid model path'));
        return;
      }
      
      // Set up full path if needed
      const fullPath = path;
      
      // Load the model
      this.gltfLoader.load(
        fullPath,
        (gltf) => {
          // Cache the loaded model for future use
          if (this.modelCache) {
            this.modelCache.set(fullPath, {
              scene: gltf.scene.clone(),
              animations: gltf.animations
            });
          }
          
          // Return loaded model to caller
          if (onLoad) onLoad(gltf);
        },
        // Progress callback
        (xhr) => {
          // Optional progress tracking
        },
        // Error callback
        (error) => {
          console.error(`Error loading model from ${path}:`, error);
          if (onError) onError(error);
        }
      );
    } catch (error) {
      console.error(`Exception loading model ${path}:`, error);
      if (onError) onError(error);
    }
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