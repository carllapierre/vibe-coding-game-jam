import * as THREE from 'three';
import { Vector3 } from 'three';
import { gsap } from 'gsap';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterRegistry } from '../registries/CharacterRegistry.js';
import { NameTag } from './NameTag.js';
import { HealthBar } from './HealthBar.js';
import { AnimationManager } from './AnimationManager.js';
import { deathMessages } from '../config.js';
import { HitMarker } from '../projectiles/HitMarker.js';
import { AudioManager } from '../audio/AudioManager.js';

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
    
    // Add death state tracking
    this.isDead = false;
    this.deathStartTime = null;
    this.respawnTime = null;
    this.deathMessageObject = null;
    this.hasShownDeathMessage = false; // New flag to track if we've shown death message
    
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
      console.log('Player State:', state.state);

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
      
      // Handle death state - simply react to Character.js state
      if (state.state === 'death' && !this.isDead) {
        this.triggerDeath();
      } else if (state.state !== 'death' && this.isDead) {
        // Character has finished respawning, now we can restore the model
        this.isDead = false;
        if (this.model) {
          this.model.visible = true;
        }
        // Remove any death message
        this.removeDeathMessage();
      }
      
      // Update health if provided
      if (state.health !== undefined && state.health !== this.health) {
        const prevHealth = this.health;
        this.playerData.health = state.health;
        // Show hit effect if health decreased
        const showHitEffect = state.health < prevHealth;
        this.updateHealthBar(showHitEffect);
        
        // Check for death transition (health reached 0)
        if (state.health <= 0 && prevHealth > 0) {
          this.triggerDeath();
        }
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
    
    // Simple direct movement without prediction
    this.currentAnimation = gsap.to(this.currentPosition, {
      x: newPosition.x,
      y: newPosition.y,
      z: newPosition.z,
      duration: 0.2, // Short duration for responsiveness
      ease: "none", // Linear movement
      onUpdate: () => {
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
    
    // Simple rotation without prediction
    if (this.model) {
      gsap.to(this.model.rotation, {
        y: this.targetRotationY + (this.modelRotationOffset || 0),
        duration: 0.2,
        ease: "none",
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
  
  /**
   * Trigger death effects and state
   */
  triggerDeath() {
    if (this.hasShownDeathMessage) return;
    // Set death state
    this.isDead = true;
    this.deathStartTime = Date.now();
    
    // Hide the model
    if (this.model) {
      // Create death explosion effect before hiding model
      this.createDeathExplosion();
      
      AudioManager.play('death', {
        volume: 1.0,
        allowOverlap: true           // Allow multiple death sounds to overlap
      });
      
      // Show random death message only if we haven't shown it yet
      this.showDeathMessage();
      this.hasShownDeathMessage = true;
      
      // Create a big hit marker at the player's position
      this.createDeathHitMarker();
      
      this.model.visible = false;
    }
  }
  
  /**
   * Create explosion of particles and confetti when player dies
   */
  createDeathExplosion() {
    if (!this.model) return;
    
    const position = this.model.position.clone();
    const particleCount = 150; // Increased particles
    const confettiCount = 100; // Increased confetti
    
    // Create colored particles
    const particleColors = [0xff0000, 0xff8800, 0xffff00, 0xffffff, 0xff00ff];
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = [];
    const particleVelocities = [];
    
    for (let i = 0; i < particleCount; i++) {
      // Start particles at random positions within the player's body
      particlePositions.push(
        position.x + (Math.random() - 0.5) * 1.0,
        position.y + Math.random() * 2.0, // Distribute across player height
        position.z + (Math.random() - 0.5) * 1.0
      );
      
      // Explode outward with random velocities
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.1 + Math.random() * 0.3; // Increased speed
      particleVelocities.push(
        Math.cos(angle) * speed,
        0.1 + Math.random() * 0.3, // Upward bias, increased
        Math.sin(angle) * speed
      );
    }
    
    particleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(particlePositions, 3));
    
    // Create different colored particle systems for variety
    const particleSystems = [];
    
    particleColors.forEach(color => {
      const material = new THREE.PointsMaterial({
        color: color,
        size: 0.12, // Larger particles
        transparent: true,
        opacity: 1
      });
      
      const particles = new THREE.Points(particleGeometry.clone(), material);
      this.scene.add(particles);
      particleSystems.push({
        points: particles,
        velocities: [...particleVelocities],
        material: material
      });
    });
    
    // Create explosion flash
    const flashGeometry = new THREE.SphereGeometry(1.5, 32, 32);
    const flashMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.position.copy(position);
    flash.position.y += 1.0; // Center on player body
    this.scene.add(flash);
    
    // Animate flash
    gsap.to(flash.scale, {
      x: 2.5,
      y: 2.5,
      z: 2.5,
      duration: 0.3,
      ease: "power2.out"
    });
    
    gsap.to(flashMaterial, {
      opacity: 0,
      duration: 0.5,
      ease: "power2.out",
      onComplete: () => {
        this.scene.remove(flash);
        flashGeometry.dispose();
        flashMaterial.dispose();
      }
    });
    
    // Create confetti (flat rectangles with random colors)
    const confetti = [];
    const confettiColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff5500, 0x55ff00];
    
    for (let i = 0; i < confettiCount; i++) {
      const confettiGeometry = new THREE.PlaneGeometry(0.15, 0.15); // Larger confetti
      const confettiMaterial = new THREE.MeshBasicMaterial({
        color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1
      });
      
      const confettiMesh = new THREE.Mesh(confettiGeometry, confettiMaterial);
      
      // Position confetti at player position with some randomness
      confettiMesh.position.set(
        position.x + (Math.random() - 0.5) * 1.5, // wider spread
        position.y + Math.random() * 2.5, // higher spread
        position.z + (Math.random() - 0.5) * 1.5  // wider spread
      );
      
      // Random rotation
      confettiMesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      // Random velocity - faster and more varied
      const confettiVelocity = {
        x: (Math.random() - 0.5) * 0.3,
        y: 0.1 + Math.random() * 0.2,
        z: (Math.random() - 0.5) * 0.3,
        rotX: (Math.random() - 0.5) * 0.15,
        rotY: (Math.random() - 0.5) * 0.15,
        rotZ: (Math.random() - 0.5) * 0.15
      };
      
      this.scene.add(confettiMesh);
      confetti.push({
        mesh: confettiMesh,
        velocity: confettiVelocity
      });
    }
    
    // Add some food items in the explosion
    const foodGeometries = [
      new THREE.SphereGeometry(0.2, 16, 16), // apple/tomato
      new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), // banana
      new THREE.BoxGeometry(0.3, 0.2, 0.3) // cake slice
    ];
    
    const foodItems = [];
    const foodCount = 10;
    
    for (let i = 0; i < foodCount; i++) {
      const geomIndex = Math.floor(Math.random() * foodGeometries.length);
      const foodGeometry = foodGeometries[geomIndex].clone();
      
      // Different colors for food items
      const foodColor = Math.random() < 0.5 ? 0xff4444 : 0xffcc00;
      
      const foodMaterial = new THREE.MeshBasicMaterial({
        color: foodColor,
        transparent: true,
        opacity: 1
      });
      
      const foodMesh = new THREE.Mesh(foodGeometry, foodMaterial);
      
      // Position food at player position
      foodMesh.position.set(
        position.x + (Math.random() - 0.5) * 1.0,
        position.y + 0.5 + Math.random() * 1.5,
        position.z + (Math.random() - 0.5) * 1.0
      );
      
      // Random rotation
      foodMesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );
      
      // Random velocity
      const foodVelocity = {
        x: (Math.random() - 0.5) * 0.3,
        y: 0.15 + Math.random() * 0.25,
        z: (Math.random() - 0.5) * 0.3,
        rotX: (Math.random() - 0.5) * 0.2,
        rotY: (Math.random() - 0.5) * 0.2,
        rotZ: (Math.random() - 0.5) * 0.2
      };
      
      this.scene.add(foodMesh);
      foodItems.push({
        mesh: foodMesh,
        velocity: foodVelocity,
        geometry: foodGeometry,
        material: foodMaterial
      });
    }
    
    // Animate particle explosion
    const startTime = Date.now();
    const explosionDuration = 3000; // Longer duration
    
    const animateExplosion = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / explosionDuration;
      
      // Apply gravity to all particles
      const gravity = 0.001;
      
      // Update particle positions
      particleSystems.forEach(system => {
        const positions = system.points.geometry.attributes.position.array;
        
        for (let i = 0; i < particleCount; i++) {
          // Apply velocity
          positions[i * 3] += system.velocities[i * 3];
          positions[i * 3 + 1] += system.velocities[i * 3 + 1];
          positions[i * 3 + 2] += system.velocities[i * 3 + 2];
          
          // Apply gravity to Y velocity
          system.velocities[i * 3 + 1] -= gravity;
        }
        
        system.points.geometry.attributes.position.needsUpdate = true;
        
        // Fade out
        system.material.opacity = 1 - progress;
      });
      
      // Update confetti
      confetti.forEach(c => {
        // Apply velocity
        c.mesh.position.x += c.velocity.x;
        c.mesh.position.y += c.velocity.y;
        c.mesh.position.z += c.velocity.z;
        
        // Apply rotation
        c.mesh.rotation.x += c.velocity.rotX;
        c.mesh.rotation.y += c.velocity.rotY;
        c.mesh.rotation.z += c.velocity.rotZ;
        
        // Apply gravity to Y velocity
        c.velocity.y -= gravity * 1.5;
        
        // Fade out
        c.mesh.material.opacity = 1 - progress;
      });
      
      // Update food items
      foodItems.forEach(food => {
        // Apply velocity
        food.mesh.position.x += food.velocity.x;
        food.mesh.position.y += food.velocity.y;
        food.mesh.position.z += food.velocity.z;
        
        // Apply rotation
        food.mesh.rotation.x += food.velocity.rotX;
        food.mesh.rotation.y += food.velocity.rotY;
        food.mesh.rotation.z += food.velocity.rotZ;
        
        // Apply gravity to Y velocity
        food.velocity.y -= gravity * 2.0;
        
        // Fade out
        food.material.opacity = 1 - progress;
      });
      
      if (elapsed < explosionDuration) {
        requestAnimationFrame(animateExplosion);
      } else {
        // Clean up after animation completes
        particleSystems.forEach(system => {
          this.scene.remove(system.points);
          system.points.geometry.dispose();
          system.material.dispose();
        });
        
        confetti.forEach(c => {
          this.scene.remove(c.mesh);
          c.mesh.geometry.dispose();
          c.mesh.material.dispose();
        });
        
        foodItems.forEach(food => {
          this.scene.remove(food.mesh);
          food.geometry.dispose();
          food.material.dispose();
        });
      }
    };
    
    animateExplosion();
  }
  
  /**
   * Create a custom hit marker effect for player death
   */
  createDeathHitMarker() {
    if (!this.model) return;
    
    const position = this.model.position.clone();
    position.y += 1.5; // Center on player body
    
    // Try to access the scene's camera or create a default direction
    let camera = null;
    if (this.scene.camera) {
      camera = this.scene.camera;
    }
    
    // Create custom death hit marker
    HitMarker.create({
      scene: this.scene,
      position: position,
      type: 'headshot', // Use the most dramatic effect type
      color: 0xff0000, // Red color for death
      camera: camera
    });
    
    // Show UI hit marker
    HitMarker.showUiHitMarker({
      size: 40, // Larger size
      color: '#ff0000', // Red
      duration: 1000, // Longer duration
      thickness: 3, // Thicker lines
      isHeadshot: true // Show headshot indicator text
    });
  }
  
  /**
   * Show a random death message above the player
   */
  showDeathMessage() {
    // Remove any existing message first
    this.removeDeathMessage();
    
    if (!this.model) return;
    
    // Get a random death message
    const message = deathMessages[Math.floor(Math.random() * deathMessages.length)];
    
    // Create a text sprite
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 256;
    
    // Style the text - more stylized
    context.fillStyle = '#000000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 0.7;

    // Add gradient background
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#ff3300');
    gradient.addColorStop(1, '#ffcc00');
    
    // Draw rounded rectangle background
    context.globalAlpha = 0.8;
    context.fillStyle = gradient;
    roundRect(context, 10, 10, canvas.width - 20, canvas.height - 20, 20, true);
    
    // Make text more comic-like
    context.globalAlpha = 1.0;
    context.font = 'bold 70px Impact, Arial Black, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Add text shadow for depth
    context.shadowColor = 'rgba(0, 0, 0, 0.8)';
    context.shadowBlur = 8;
    context.shadowOffsetX = 4;
    context.shadowOffsetY = 4;
    
    // White text
    context.fillStyle = '#FFFFFF';
    context.fillText(message.toUpperCase(), canvas.width/2, canvas.height/2);
    
    // Add yellow stroke to text
    context.lineWidth = 3;
    context.strokeStyle = '#FFCC00';
    context.strokeText(message.toUpperCase(), canvas.width/2, canvas.height/2);
    
    // Add explosion shapes around text
    context.fillStyle = '#FFFF00';
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const x = canvas.width/2 + Math.cos(angle) * 180;
      const y = canvas.height/2 + Math.sin(angle) * 80;
      const size = 20 + Math.random() * 15;
      
      context.beginPath();
      context.moveTo(x, y - size);
      context.lineTo(x + size/2, y - size/4);
      context.lineTo(x + size, y);
      context.lineTo(x + size/2, y + size/4);
      context.lineTo(x, y + size);
      context.lineTo(x - size/2, y + size/4);
      context.lineTo(x - size, y);
      context.lineTo(x - size/2, y - size/4);
      context.closePath();
      context.fill();
    }
    
    // Create sprite material from canvas
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.1 // Start with low opacity for fade-in
    });
    
    // Create sprite
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(4, 2, 1); // Larger text
    
    // Position above player
    sprite.position.copy(this.model.position);
    sprite.position.y += 4.0; // Higher above player
    
    // Add to scene
    this.scene.add(sprite);
    this.deathMessageObject = sprite;
    
    // Animate the message with bounce effect
    const startScale = { x: 0.5, y: 0.5 };
    const endScale = { x: 4, y: 2 };
    
    // Scaling animation
    gsap.fromTo(
      sprite.scale, 
      startScale,
      {
        ...endScale,
        duration: 0.5,
        ease: "elastic.out(1, 0.3)"
      }
    );
    
    // Opacity animation
    gsap.to(material, {
      opacity: 1,
      duration: 0.3,
      ease: "power2.out"
    });
    
    // Float and fade animation
    const startTime = Date.now();
    const messageDuration = 4000; // Longer duration
    
    const animateMessage = () => {
      const elapsed = Date.now() - startTime;
      const progress = elapsed / messageDuration;
      
      if (progress < 1 && this.deathMessageObject) {
        // Add some horizontal wave motion
        const wave = Math.sin(elapsed * 0.005) * 0.03;
        this.deathMessageObject.position.x += wave;
        
        // Float upward
        this.deathMessageObject.position.y += 0.01;
        
        // Start fading out after 2 seconds
        if (elapsed > 2000) {
          this.deathMessageObject.material.opacity = 1 - ((elapsed - 2000) / 2000);
        }
        
        requestAnimationFrame(animateMessage);
      } else {
        // Clean up
        this.removeDeathMessage();
      }
    };
    
    animateMessage();
  }
  
  /**
   * Remove death message from scene
   */
  removeDeathMessage() {
    if (this.deathMessageObject) {
      this.scene.remove(this.deathMessageObject);
      
      if (this.deathMessageObject.material) {
        this.deathMessageObject.material.map?.dispose();
        this.deathMessageObject.material.dispose();
      }
      
      this.deathMessageObject = null;
      this.hasShownDeathMessage = false; // Reset the flag when removing the message
    }
  }
  
  /**
   * Handle projectile collision with an object - since this needs to be fixed in Character.js, we should add a utility
   * method in NetworkedPlayer to help handle hits more gracefully.
   */
  handleProjectileHit(damage, itemType) {
    // Make sure we have a valid player ID
    if (!this.sessionId) {
      console.warn('Cannot handle hit: missing player session ID');
      return false;
    }
    
    // Now apply hit effect with animation
    const now = Date.now();
    
    // Immediate visual health update - don't wait for server response
    // Calculate estimated remaining health
    const estimatedRemainingHealth = Math.max(0, this.health - damage);
    
    // Store the predicted damage amount for reconciliation
    this.lastHitTime = now;
    this.lastHitDamage = damage;
    
    // Force an immediate health bar update with the hit effect
    this.updateState({
      health: estimatedRemainingHealth,
      x: this.currentPosition.x,
      y: this.currentPosition.y,
      z: this.currentPosition.z,
      rotationY: this.currentRotationY,
      name: this.playerData.name,
      state: this.playerState
    });
    
    // Play hit sound at this player's position
    if (window.mainCamera && AudioManager) {
      try {
        // Get local player position as the listener
        const listener = window.mainCamera.position.clone(); // Make sure to clone to avoid reference issues
        
        // Use this player's position as the source
        const source = this.currentPosition.clone(); // Clone to avoid reference issues
        
        // For extreme clarity, use console to show positions
        console.log("%c[HIT SOUND POSITIONS]", "background: #ff0000; color: white; font-size: 16px;");
        console.log("Player hit position:", {x: source.x, y: source.y, z: source.z});
        console.log("Camera/listener position:", {x: listener.x, y: listener.y, z: listener.z});
        
        // Apply SUPER extreme audio settings for testing
        AudioManager.playSpatial('hit', source, listener, {
          maxDistance: 20,              // Shorter distance for more noticeable falloff
          minDistance: 1,               // Only full volume when very close
          volumeMultiplier: 1.5,        // Boost volume for testing
          pitchMin: 0.4,                // Extremely low pitch possible
          pitchMax: 1.6,                // Extremely high pitch possible
          allowOverlap: true            // Allow sounds to overlap
        });
      } catch (error) {
        console.warn('Unable to play hit sound:', error);
      }
    }
  
    
    return true;
  }
  
  /**
   * Create a projectile thrown by this networked player
   * @param {Object} projectileData - Projectile data from the server
   * @param {THREE.Scene} scene - The scene to add the projectile to
   * @param {Function} onCollision - Callback for collision detection
   * @returns {Object} The created projectile
   */
  createProjectile(projectileData, scene, onCollision) {
    if (!projectileData || !scene) {
      console.warn('Invalid data for NetworkedPlayer.createProjectile');
      return null;
    }
    
    try {
      const { itemType, x, y, z, dirX, dirY, dirZ, speed, scale, gravity, arcHeight, lifetime } = projectileData;
      
      // Get model path from item registry
      const itemRegistry = window.itemRegistry;
      let modelPath = 'assets/models/food/tomato.glb'; // Default fallback
      let damage = 10; // Default damage
      
      if (itemRegistry && itemType) {
        const itemConfig = itemRegistry.getType(itemType);
        if (itemConfig) {
          modelPath = itemConfig.modelPath || modelPath;
          damage = itemConfig.damage || damage;
        }
      }
      
      // Create position and direction vectors
      const position = new THREE.Vector3(x, y, z);
      const direction = new THREE.Vector3(dirX, dirY, dirZ).normalize();
      
      // Import the FoodProjectile class
      const { FoodProjectile } = require('../projectiles/FoodProjectile.js');
      
      // Create the projectile
      const projectile = new FoodProjectile({
        scene: scene,
        position: position,
        direction: direction,
        path: modelPath,
        scale: scale || 1,
        speed: speed || 0.5,
        gravity: gravity || 0.01,
        arcHeight: arcHeight || 0.2,
        lifetime: lifetime || 5000,
        itemType: itemType || 'tomato',
        damage: damage,
        isOwnProjectile: false,
        isNetworked: true,
        onCollision: onCollision
      });
      
      // Register the projectile
      FoodProjectile.registerProjectile(projectile);
      
      return projectile;
    } catch (error) {
      console.error('Error creating networked projectile:', error);
      return null;
    }
  }
}

// Helper function to draw rounded rectangles
function roundRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  if (fill) {
    ctx.fill();
  }
  if (stroke) {
    ctx.stroke();
  }
} 