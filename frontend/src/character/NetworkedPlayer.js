import * as THREE from 'three';
import { Vector3 } from 'three';
import { gsap } from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterRegistry } from '../registries/CharacterRegistry.js';
import { NameTag } from './NameTag.js';
import { AnimationManager } from './AnimationManager.js';

/**
 * NetworkedPlayerManager is responsible for managing all networked players.
 * It handles shared resources, centralized updates, and player lifecycle.
 */
export class NetworkedPlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map(); // Map of sessionId -> NetworkedPlayer
    this.loader = new GLTFLoader();
    
    // Animation settings
    this.animationSettings = {
      duration: 0.2,
      ease: "power3.out"
    };
  }
  
  /**
   * Add a new player to the manager
   * @param {string} sessionId - The session ID of the remote player
   * @param {Object} playerData - The initial player data
   * @returns {NetworkedPlayer} The created player
   */
  addPlayer(sessionId, playerData) {
    // Check if player already exists
    if (this.players.has(sessionId)) {
      this.updatePlayer(sessionId, playerData);
      return this.players.get(sessionId);
    }
    
    try {
      // Create a new player
      const player = new NetworkedPlayer(
        sessionId, 
        playerData, 
        this.scene,
        {
          loader: this.loader
        }
      );
      
      // Add to players map
      this.players.set(sessionId, player);
      
      return player;
    } catch (error) {
      console.error('Error creating networked player:', error);
      return null;
    }
  }
  
  /**
   * Update a player's state
   * @param {string} sessionId - The session ID of the player to update
   * @param {Object} state - The new state data
   */
  updatePlayer(sessionId, state) {
    const player = this.players.get(sessionId);
    if (player) {
      player.updateState(state);
    } else {
      console.warn(`Attempted to update non-existent player: ${sessionId}`);
    }
  }
  
  /**
   * Remove a player from the manager
   * @param {string} sessionId - The session ID of the player to remove
   */
  removePlayer(sessionId) {
    const player = this.players.get(sessionId);
    if (player) {
      player.dispose();
      this.players.delete(sessionId);
    }
  }
  
  /**
   * Update all players (called in animation loop)
   * @param {number} delta - Time delta since last update
   */
  update(delta) {
    for (const player of this.players.values()) {
      player.update(delta);
    }
  }
  
  /**
   * Dispose of all resources when the manager is no longer needed
   */
  dispose() {
    // Dispose of all players
    for (const player of this.players.values()) {
      player.dispose();
    }
    
    this.players.clear();
  }
}

/**
 * NetworkedPlayer represents a remote player in the game world.
 * Optimized to use shared resources from the manager.
 */
export class NetworkedPlayer {
  /**
   * @param {string} sessionId - The session ID of the remote player
   * @param {Object} playerData - The initial player data
   * @param {Object} scene - The Three.js scene
   * @param {Object} resources - Shared resources from the manager
   */
  constructor(sessionId, playerData, scene, resources) {
    this.scene = scene;
    this.sessionId = sessionId;
    this.playerData = playerData || { x: 0, y: 0, z: 0, rotationY: 0 };
    this.resources = resources;
    
    // Camera height offset - the main character camera is 2 units above ground
    this.cameraHeightOffset = 2.0;
    
    // Animation control
    this.currentAnimation = null;
    this.hoverAnimation = null;
    this.animationManager = null;
    
    // Motion smoothing properties
    this.velocity = new Vector3(0, 0, 0);
    this.lastUpdateTime = Date.now();
    this.positionBuffer = [];
    this.positionBufferMaxSize = 3;
    
    // Position and rotation
    this.targetPosition = new Vector3(
      Number(this.playerData.x || 0), 
      Number(this.playerData.y || 0), 
      Number(this.playerData.z || 0)
    );
    
    this.currentPosition = new Vector3().copy(this.targetPosition);
    this.targetRotationY = Number(this.playerData.rotationY || 0);
    this.currentRotationY = this.targetRotationY;
    
    // Player state (idle, walking, jumping)
    this.playerState = this.playerData.state || 'idle';
    
    // Create name tag
    this.nameTag = new NameTag();
    
    this.createModel();
  }
  
  /**
   * Create player model using shared resources
   */
  createModel() {
    // Get the model path from CharacterRegistry
    const modelPath = CharacterRegistry.getModelPath('character-1');
    if (!modelPath) {
      console.error('Failed to get character model path');
      return;
    }

    // Load the model
    this.resources.loader.load(modelPath, (gltf) => {
      this.model = gltf.scene;
      
      // Apply scale from registry
      const characterConfig = CharacterRegistry.items.find(item => item.id === 'character-1');
      if (characterConfig) {
        this.model.scale.set(characterConfig.scale, characterConfig.scale, characterConfig.scale);
      }
      
      // Set the model position, adjusting Y for camera height
      const adjustedPosition = this.currentPosition.clone();
      
      // Apply camera height offset - position character at ground level
      if (Math.abs(adjustedPosition.y) < 0.5) {
        // For characters on the ground, subtract the full camera height
        adjustedPosition.y = 0;
      } else {
        // For jumping characters, adjust the height by the offset
        adjustedPosition.y -= this.cameraHeightOffset;
      }
      
      this.model.position.copy(adjustedPosition);
      this.model.rotation.y = this.currentRotationY;
      
      // Add to scene
      this.scene.add(this.model);
      
      // Add a temporary hitbox visualization
      this.addHitbox();
      
      // Log found animations
      if (gltf.animations && gltf.animations.length > 0) {
        console.log(`Found ${gltf.animations.length} animations in the model:`);
        gltf.animations.forEach(anim => {
          console.log(`- Animation: ${anim.name}, Duration: ${anim.duration.toFixed(2)}s`);
        });
      }
      
      // Initialize animation manager with the model and animations
      this.animationManager = new AnimationManager(this.model, gltf.animations);
      
      // Set initial animation state
      this.updateAnimationState(this.playerState);
      
      // Now that model is loaded, add the name tag
      this.updateNameTag();
    }, undefined, (error) => {
      console.error('Error loading character model:', error);
    });
  }
  
  /**
   * Add a visible hitbox around the character
   */
  addHitbox() {
    // Create a wireframe box to represent the hitbox
    const hitboxGeometry = new THREE.BoxGeometry(0.7, 0.8, 0.7);
    const hitboxMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true
    });
    
    this.hitboxMesh = new THREE.Mesh(hitboxGeometry, hitboxMaterial);
    
    // Position the hitbox slightly higher for better collision detection
    this.hitboxMesh.position.y = 0.5;
    
    // Add to the model
    this.model.add(this.hitboxMesh);
  }
  
  /**
   * Update the name tag with player name
   */
  updateNameTag() {
    if (!this.nameTag) return;
    
    const displayName = this.playerData.name || "Player";
    
    if (this.model) {
      this.nameTag.create(this.model, displayName);
    }
  }
  
  /**
   * Update animation state based on player state
   * @param {string} state - The new player state
   */
  updateAnimationState(state) {
    if (!this.animationManager) return;
    
    // Pass the state directly to the animation manager
    // The animation manager already has mappings for all the possible states
    this.animationManager.setState(state);
  }
  
  /**
   * Start a subtle hover animation for the player model
   */
  startHoverAnimation() {
    // Removing the hover animation by making this a no-op
    // The hoverOffset is not needed anymore
    this.hoverOffset = 0;
  }
  
  /**
   * Update player state with new data from server
   */
  updateState(state) {
    try {
      // Calculate time since last update
      const now = Date.now();
      const timeDelta = (now - this.lastUpdateTime) / 1000; // in seconds
      this.lastUpdateTime = now;
      
      // Update target position
      const newPosition = new Vector3(
        Number(state.x) || 0,
        Number(state.y) || 0,
        Number(state.z) || 0
      );
      
      // Calculate distance to new position
      const distanceToNewTarget = this.currentPosition.distanceTo(newPosition);
      
      // Calculate velocity
      if (timeDelta > 0.001 && timeDelta < 1.0 && this.positionBuffer.length > 0) {
        const prevPos = this.positionBuffer[this.positionBuffer.length - 1];
        this.velocity.subVectors(newPosition, prevPos).divideScalar(timeDelta);
        
        // Cap extreme velocity values
        const maxVelocity = 20;
        if (this.velocity.length() > maxVelocity) {
          this.velocity.normalize().multiplyScalar(maxVelocity);
        }
      }
      
      // Update rotation
      if (state.rotationY !== undefined) {
        this.targetRotationY = Number(state.rotationY);
      }
      
      // Update player state if provided
      if (state.state !== undefined) {
        this.playerState = state.state;
        this.updateAnimationState(this.playerState);
      }
      
      // Add to position buffer for smoothing
      this.positionBuffer.push(newPosition.clone());
      
      // Keep buffer at max size
      while (this.positionBuffer.length > this.positionBufferMaxSize) {
        this.positionBuffer.shift();
      }
      
      // Animate to new position
      this.animateToNewPosition(newPosition, distanceToNewTarget);
      
      // Update nametag with name
      this.playerData.name = state.name || this.playerData.name;
      this.updateNameTag();
    } catch (error) {
      console.error('Error updating networked player state:', error);
    }
  }
  
  /**
   * Animate the player to a new position
   */
  animateToNewPosition(newPosition, distance) {
    // Store new target position
    this.targetPosition = newPosition.clone();
    
    // Handle Y position specially for the network position
    const isCloseToGround = Math.abs(this.targetPosition.y) < 0.5;
    const isJumping = !isCloseToGround || this.targetPosition.y > 2.1;
    
    // Kill existing animation
    if (this.currentAnimation) {
      this.currentAnimation.kill();
    }
    
    // Choose animation parameters based on distance
    let duration, ease;
    
    if (distance > 5) {
      duration = 0.15;
      ease = "power1.out";
    } else if (distance > 2) {
      duration = 0.25;
      ease = "power2.out";
    } else if (distance > 0.5) {
      duration = 0.3;
      ease = "power3.out";
    } else {
      duration = Math.min(0.4, Math.max(0.2, distance * 0.6));
      ease = "sine.out";
    }
    
    // Apply prediction for smoother movement
    const predictedPosition = newPosition.clone();
    
    if (distance < 3 && this.velocity.lengthSq() > 0.01) {
      predictedPosition.add(
        this.velocity.clone().multiplyScalar(duration * 0.5)
      );
    }
    
    // Animate the current position
    this.currentAnimation = gsap.to(this.currentPosition, {
      x: predictedPosition.x,
      y: predictedPosition.y, // Keep original Y from server
      z: predictedPosition.z,
      duration: duration,
      ease: ease,
      onUpdate: () => {
        // Update the actual model position with camera height adjustment
        if (this.model) {
          this.model.position.x = this.currentPosition.x;
          this.model.position.z = this.currentPosition.z;
          
          // Apply camera height offset for model Y position
          const modelY = isJumping ? 
            this.currentPosition.y - this.cameraHeightOffset : 0;
          
          this.model.position.y = modelY;
        }
      },
      onComplete: () => {
        this.currentAnimation = null;
      }
    });
    
    // Animate rotation
    if (this.model) {
      gsap.to(this.model.rotation, {
        y: this.targetRotationY,
        duration: Math.min(duration * 1.2, 0.4),
        ease: "sine.out",
        onUpdate: () => {
          this.currentRotationY = this.model.rotation.y;
        }
      });
    }
  }
  
  /**
   * Update method for game loop integration
   */
  update(delta = 0.016) {
    // Update animation mixer if available
    if (this.animationManager) {
      this.animationManager.update(delta);
    }
    
    // Apply predictive movement between network updates
    if (!this.currentAnimation && this.velocity.lengthSq() > 0.01) {
      // Reduce velocity over time
      this.velocity.multiplyScalar(0.95);
      
      // Apply predicted movement
      const movement = this.velocity.clone().multiplyScalar(delta);
      
      // Update the current position (base position)
      this.currentPosition.x += movement.x;
      this.currentPosition.z += movement.z;
      this.currentPosition.y += movement.y;
      
      // Apply the change to the model's position with camera height adjustment
      if (this.model) {
        this.model.position.x = this.currentPosition.x;
        this.model.position.z = this.currentPosition.z;
        
        // Apply camera height offset
        const isJumping = Math.abs(this.currentPosition.y) > 0.5;
        const modelY = isJumping ? 
          this.currentPosition.y - this.cameraHeightOffset : 0;
          
        this.model.position.y = modelY;
      }
    }
  }
  
  /**
   * Clean up resources when player disconnects
   */
  dispose() {
    try {
      // Kill animations
      if (this.currentAnimation) {
        this.currentAnimation.kill();
      }
      
      if (this.hoverAnimation) {
        this.hoverAnimation.kill();
      }
      
      // Kill all GSAP animations targeting this model
      gsap.killTweensOf(this.model.position);
      gsap.killTweensOf(this.model.rotation);
      
      if (this.model && this.model.children[0]) {
        gsap.killTweensOf(this.model.children[0].material);
      }
      
      // Remove from scene
      if (this.model) {
        this.scene.remove(this.model);
      }
      
      // Clean up name tag
      if (this.nameTag) {
        this.nameTag.dispose();
        this.nameTag = null;
      }
    } catch (error) {
      console.error('Error disposing NetworkedPlayer:', error);
    }
  }
  
  /**
   * Alias for dispose() for backward compatibility
   */
  remove() {
    this.dispose();
  }
} 