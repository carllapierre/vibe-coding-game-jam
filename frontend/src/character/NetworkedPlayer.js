import * as THREE from 'three';
import { Vector3 } from 'three';
import { gsap } from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterRegistry } from '../registries/CharacterRegistry.js';
import { NameTag } from './NameTag.js';
import { HealthBar } from './HealthBar.js';
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
   * Get all collision boxes for hit detection
   * @returns {Array} Array of collision boxes from all players
   */
  getCollisionBoxes() {
    const boxes = [];
    for (const player of this.players.values()) {
      const box = player.getCollisionBox();
      if (box) {
        boxes.push(box);
      }
    }
    return boxes;
  }
  
  /**
   * Register this manager's collision boxes with the FoodProjectile system
   * @param {class} FoodProjectile - The FoodProjectile class 
   */
  registerWithProjectileSystem(FoodProjectile) {
    if (!FoodProjectile || !FoodProjectile.updateCollidableObjects) {
      console.error('Invalid FoodProjectile class provided');
      return;
    }

    // Function to update projectile system with current player boxes
    const updateProjectileCollisions = () => {
      const boxes = this.getCollisionBoxes();
      // Add these boxes to any existing collidable objects
      const allCollidables = [...FoodProjectile.collidableObjects.filter(obj => obj.type !== 'player'), ...boxes];
      FoodProjectile.updateCollidableObjects(allCollidables);
    };
    
    // Update immediately and then every frame
    updateProjectileCollisions();
    
    // Store the update function so it can be called in the update method
    this.updateProjectileCollisions = updateProjectileCollisions;
  }
  
  /**
   * Update all players (called in animation loop)
   * @param {number} delta - Time delta since last update
   */
  update(delta) {
    for (const player of this.players.values()) {
      player.update(delta);
    }
    
    // Update projectile collisions if we're registered
    if (this.updateProjectileCollisions) {
      this.updateProjectileCollisions();
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
  
  /**
   * Validate players against the provided list of valid IDs
   * Removes any players that are no longer in the server state
   * @param {string[]} validPlayerIds - Array of valid player session IDs
   */
  validatePlayers(validPlayerIds) {
    const validIdSet = new Set(validPlayerIds);
    const playerIds = Object.keys(this.players);
    
    // Find and remove any players not in the valid set
    playerIds.forEach(id => {
      if (!validIdSet.has(id)) {
        console.log(`Cleaning up stale player: ${id}`);
        this.removePlayer(id);
      }
    });
    
    // Return true if any players were removed
    return playerIds.length !== Object.keys(this.players).length;
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
    
    // Create health bar
    this.healthBar = new HealthBar();
    
    // Store health values
    this.health = this.playerData.health || 100;
    this.maxHealth = 100;
    
    // Hit prediction properties for reconciliation
    this.lastHitTime = null;
    this.lastHitDamage = null;
    
    // Select a random character ID for this player
    this.characterId = this.getRandomCharacterId();
    
    // Bounding box
    this.boundingBox = null;
    this.boundingBoxSize = new THREE.Vector3(1.5, 3, 1.5); // Default size, will adjust based on model
    
    this.createModel();
  }
  
  /**
   * Get a random character ID from the registry
   * @returns {string} A random character ID
   */
  getRandomCharacterId() {
    // Get all available character IDs
    const availableCharacters = CharacterRegistry.items.map(item => item.id);
    
    // Use player's session ID to seed the random selection to keep it consistent
    // This ensures the same player always gets the same character model
    const seed = this.sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomIndex = seed % availableCharacters.length;
    
    return availableCharacters[randomIndex];
  }
  
  /**
   * Create player model using shared resources
   */
  createModel() {
    // Get the model path from CharacterRegistry using the random character
    const modelPath = CharacterRegistry.getModelPath(this.characterId);
    if (!modelPath) {
      console.error('Failed to get character model path');
      return;
    }

    // Load the model
    this.resources.loader.load(modelPath, (gltf) => {
      this.model = gltf.scene;
      
      // Apply scale from registry
      const characterConfig = CharacterRegistry.items.find(item => item.id === this.characterId);
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
      
      // Add 180-degree rotation to make model face the same direction as the camera
      this.modelRotationOffset = Math.PI; // 180 degrees in radians
      this.model.rotation.y = this.currentRotationY + this.modelRotationOffset;
      
      // Add to scene
      this.scene.add(this.model);
      
      // Create bounding box
      this.createBoundingBox();
      
      // Log found animations
      if (gltf.animations && gltf.animations.length > 0) {
        gltf.animations.forEach(anim => {
        });
      }
      
      // Initialize animation manager with the model and animations
      this.animationManager = new AnimationManager(this.model, gltf.animations);
      
      // Set initial animation state
      this.updateAnimationState(this.playerState);
      
      // Now that model is loaded, add the name tag
      this.updateNameTag();
      
      // Add the health bar
      this.updateHealthBar();
    }, undefined, (error) => {
      console.error('Error loading character model:', error);
    });
  }
  
  /**
   * Create bounding box around the player
   */
  createBoundingBox() {
    if (!this.model) return;
    
    try {
      // Create a visible box helper
      // First create a basic invisible mesh to serve as the basis for the helper
      const width = 1.80;  
      const height = 3.0;
      const depth = 1.80; 
      
      // Create an invisible mesh as the base object
      const boxGeometry = new THREE.BoxGeometry(width, height, depth);
      const invisibleMaterial = new THREE.MeshBasicMaterial({ 
        visible: false 
      });
      const boxMesh = new THREE.Mesh(boxGeometry, invisibleMaterial);
      
      // Position the mesh
      boxMesh.position.copy(this.model.position);
      boxMesh.position.y += height / 2; // Move up by half the height
      
      // Create a BoxHelper around the mesh - this makes a clearer wireframe
      this.boundingBox = new THREE.BoxHelper(boxMesh, 0xff0000);
      
      // Make the box helper invisible - only needed for collision detection
      this.boundingBox.visible = false;
      this.boundingBox.frustumCulled = false;
      
      // Store both the mesh and its dimensions
      this.boxMesh = boxMesh;
      this.boundingBoxSize = new THREE.Vector3(width, height, depth);
      
      // Add both to the scene
      this.scene.add(this.boxMesh);
      this.scene.add(this.boundingBox);
      
      console.log(`Created bounding box for player ${this.sessionId}`);
    } catch (error) {
      console.error('Error creating bounding box:', error);
    }
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
   * Create and update the health bar
   * @param {boolean} showHitEffect - Whether to show a hit effect
   */
  updateHealthBar(showHitEffect = false) {
    if (!this.healthBar) return;
    
    // Get current health values from player data
    const currentHealth = this.playerData.health !== undefined ? this.playerData.health : this.health;
    
    if (this.model) {
      // If the health bar hasn't been created yet, create it
      if (!this.healthBar.sprite) {
        this.healthBar.create(this.model, currentHealth, this.maxHealth);
      } else {
        // Immediate texture update for faster visual feedback
        this.healthBar.draw(currentHealth, this.maxHealth);
        
        // Then trigger the animation effect if needed
        if (showHitEffect) {
          this.healthBar.showHitEffect();
        }
      }
      
      // Store current health
      this.health = currentHealth;
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
      
      // Calculate distance to new target
      const distanceToNewTarget = this.targetPosition.distanceTo(newPosition);
      
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
      
      // Update health if provided
      if (state.health !== undefined && state.health !== this.health) {
        const prevHealth = this.health;
        this.playerData.health = state.health;
        // Show hit effect if health decreased
        const showHitEffect = state.health < prevHealth;
        this.updateHealthBar(showHitEffect);
      }
      
      // Add to position buffer for smoothing
      this.positionBuffer.push(newPosition.clone());
      
      // Keep buffer at max size
      while (this.positionBuffer.length > this.positionBufferMaxSize) {
        this.positionBuffer.shift();
      }
      
      // Animate to new position - force immediate update for first position
      const isFirstUpdate = this.positionBuffer.length <= 1;
      this.animateToNewPosition(newPosition, distanceToNewTarget, isFirstUpdate);
      
      // Update nametag with name
      this.playerData.name = state.name || this.playerData.name;
      this.updateNameTag();
    } catch (error) {
      console.error('Error updating networked player state:', error);
    }
  }
  
  /**
   * Animate the player to a new position
   * @param {Vector3} newPosition - New target position
   * @param {number} distance - Distance to new position
   * @param {boolean} immediate - Whether to update immediately
   */
  animateToNewPosition(newPosition, distance, immediate = false) {
    // Store new target position
    this.targetPosition = newPosition.clone();
    
    // Handle Y position specially for the network position
    const isCloseToGround = Math.abs(this.targetPosition.y) < 0.5;
    const isJumping = !isCloseToGround || this.targetPosition.y > 2.1;
    
    // Kill existing animation
    if (this.currentAnimation) {
      this.currentAnimation.kill();
    }
    
    // For the first update or teleportation, update immediately
    if (immediate || distance > 10) {
      this.currentPosition.copy(newPosition);
      
      if (this.model) {
        this.model.position.x = newPosition.x;
        this.model.position.z = newPosition.z;
        
        // Apply camera height offset for model Y position
        const modelY = isJumping ? 
          newPosition.y - this.cameraHeightOffset : 0;
        
        this.model.position.y = modelY;
        
        // Update rotation immediately too
        this.model.rotation.y = this.targetRotationY + (this.modelRotationOffset || 0);
        this.currentRotationY = this.targetRotationY;
        
        // Update bounding box position
        this.updateBoundingBoxPosition();
      }
      
      console.log(`Player ${this.sessionId} teleported to:`, {
        x: newPosition.x.toFixed(2),
        y: newPosition.y.toFixed(2),
        z: newPosition.z.toFixed(2)
      });
      
      return;
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
          
          // Update bounding box position
          this.updateBoundingBoxPosition();
        }
      },
      onComplete: () => {
        this.currentAnimation = null;
      }
    });
    
    // Calculate the shortest rotation path 
    if (this.model) {
      // Find the shortest angle between current and target rotation
      let currentAngle = this.model.rotation.y - (this.modelRotationOffset || 0);
      let targetAngle = this.targetRotationY;
      
      // Normalize angles to 0-2π range
      while (currentAngle < 0) currentAngle += Math.PI * 2;
      while (targetAngle < 0) targetAngle += Math.PI * 2;
      
      // Find the shortest path
      let angleDiff = targetAngle - currentAngle;
      
      // If angle difference is greater than 180 degrees (π radians), go the other way
      if (Math.abs(angleDiff) > Math.PI) {
        if (angleDiff > 0) {
          angleDiff -= Math.PI * 2;
        } else {
          angleDiff += Math.PI * 2;
        }
      }
      
      // Calculate the target angle using the shortest path and add the model offset
      const shortestPathTarget = currentAngle + angleDiff;
      const finalRotation = shortestPathTarget + (this.modelRotationOffset || 0);
      
      // Animate rotation
      gsap.to(this.model.rotation, {
        y: finalRotation,
        duration: Math.min(duration * 1.2, 0.4),
        ease: "sine.out",
        onUpdate: () => {
          this.currentRotationY = this.model.rotation.y - (this.modelRotationOffset || 0);
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
        
        // Update bounding box position
        this.updateBoundingBoxPosition();
      }
    }
  }
  
  /**
   * Update the bounding box position to follow the model
   */
  updateBoundingBoxPosition() {
    if (!this.boundingBox || !this.boxMesh || !this.model) return;
    
    // Update the position of the helper's mesh
    this.boxMesh.position.x = this.model.position.x;
    this.boxMesh.position.z = this.model.position.z;
    
    // For Y, position the box so its bottom is at the model's feet
    const boxHeight = this.boundingBoxSize.y;
    this.boxMesh.position.y = this.model.position.y + (boxHeight / 2);
    
    // Update the helper to match the mesh's new position
    this.boundingBox.update();
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
      
      // Remove bounding box
      if (this.boundingBox) {
        this.scene.remove(this.boundingBox);
        this.boundingBox.dispose(); // Remove material and geometry
        this.boundingBox = null;
      }
      
      // Remove box mesh
      if (this.boxMesh) {
        this.scene.remove(this.boxMesh);
        this.boxMesh.geometry.dispose();
        this.boxMesh.material.dispose();
        this.boxMesh = null;
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
      
      // Clean up health bar
      if (this.healthBar) {
        this.healthBar.dispose();
        this.healthBar = null;
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
  
  /**
   * Get the bounding box for collision detection
   * @returns {Object} Object with box and meshes properties
   */
  getCollisionBox() {
    if (!this.boxMesh) return null;
    
    return {
      box: new THREE.Box3().setFromObject(this.boxMesh),
      meshes: [this.boxMesh],
      type: 'player',
      player: this,
      sessionId: this.sessionId,
      position: this.model ? this.model.position : this.currentPosition
    };
  }
} 