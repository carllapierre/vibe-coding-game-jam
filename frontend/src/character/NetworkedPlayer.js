import * as THREE from 'three';
import { Vector3, CanvasTexture, SpriteMaterial, Sprite } from 'three';
import { gsap } from 'gsap';

/**
 * NetworkedPlayer represents a remote player in the game world.
 * This is a completely standalone class separate from Character to avoid conflicts.
 */
export class NetworkedPlayer {
  // Static canvas for name tags to avoid creating new contexts
  static nameTagCanvas = null;
  static nameTagContext = null;
  
  /**
   * Initialize the shared canvas for name tags
   */
  static initNameTagCanvas() {
    if (!NetworkedPlayer.nameTagCanvas) {
      NetworkedPlayer.nameTagCanvas = document.createElement('canvas');
      NetworkedPlayer.nameTagCanvas.width = 256;
      NetworkedPlayer.nameTagCanvas.height = 64;
      NetworkedPlayer.nameTagContext = NetworkedPlayer.nameTagCanvas.getContext('2d');
    }
  }
  
  /**
   * @param {string} sessionId - The session ID of the remote player
   * @param {Object} playerData - The initial player data
   * @param {Object} scene - The Three.js scene
   */
  constructor(sessionId, playerData, scene) {
    // Initialize shared canvas
    NetworkedPlayer.initNameTagCanvas();
    
    if (!scene) {
      console.error('Scene is required for NetworkedPlayer');
      throw new Error('Scene is required for NetworkedPlayer');
    }
    
    this.scene = scene;
    this.sessionId = sessionId;
    this.playerData = playerData || { x: 0, y: 0, z: 0, rotationY: 0 };
    
    // Animation config for GSAP - improved settings
    this.animationDuration = 0.2; // Slightly faster base duration
    this.animationEase = "power3.out"; // More refined easing
    this.currentAnimation = null; // Track active animation
    
    // Motion smoothing and prediction properties
    this.velocity = new Vector3(0, 0, 0); // Track velocity for prediction
    this.lastUpdateTime = Date.now();
    this.positionBuffer = []; // Buffer for position smoothing
    this.positionBufferMaxSize = 3; // Keep last few positions for smoothing
    
    // Position and rotation for interpolation
    this.targetPosition = new Vector3(
      Number(this.playerData.x || 0), 
      Number(this.playerData.y || 0), 
      Number(this.playerData.z || 0)
    );
    
    this.currentPosition = new Vector3().copy(this.targetPosition);
    this.targetRotationY = Number(this.playerData.rotationY || 0);
    this.currentRotationY = this.targetRotationY;
    this.hasReceivedFirstUpdate = true; // Mark as received since we're setting it now
    
    try {
      // Create a model (simple box for now)
      this.createSimpleModel();
      this.addNameTag(this.playerData.name || "Player");
    } catch (error) {
      console.error('Error creating networked player model:', error);
      // Create a fallback model in case of error
      this.createFallbackModel();
    }
  }
  
  /**
   * Create a simple box model for the networked player
   */
  createSimpleModel() {
    // Create a more visually appealing model for the networked player
    const geometry = new THREE.BoxGeometry(1.2, 2.2, 1.2);
    
    // Use a bright color with some transparency
    const material = new THREE.MeshBasicMaterial({ 
      color: 0x00ffff,  // Bright cyan color
      transparent: true,
      opacity: 0.8
    });
    
    this.model = new THREE.Mesh(geometry, material);
    
    // Add a subtle glow effect
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.3
    });
    
    const glowGeometry = new THREE.BoxGeometry(1.3, 2.3, 1.3);
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    this.model.add(glowMesh);
    
    // Set initial position
    this.model.position.copy(this.currentPosition);
    this.model.rotation.y = this.currentRotationY;
    
    // Add to scene
    this.scene.add(this.model);
    
    // Start subtle hover animation for more lively appearance
    this.startHoverAnimation();
  }
  
  /**
   * Create a fallback model in case of errors
   */
  createFallbackModel() {
    try {
      // Even simpler emergency model
      const geometry = new THREE.SphereGeometry(0.5, 8, 8);
      const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      this.model = new THREE.Mesh(geometry, material);
      
      this.model.position.copy(this.currentPosition);
      this.scene.add(this.model);
      console.log('Created fallback model for networked player');
    } catch (error) {
      console.error('Failed to create even a fallback model:', error);
      // Give up on creating a visual model
      this.model = null;
    }
  }
  
  /**
   * Add a name tag above the player
   */
  addNameTag(playerName) {
    if (!this.model) return;
    
    try {
      // Use the shared canvas
      const canvas = NetworkedPlayer.nameTagCanvas;
      const context = NetworkedPlayer.nameTagContext;
      
      // Clear the canvas
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      // Background with rounded corners
      const cornerRadius = 10;
      
      // Draw rounded rectangle
      context.beginPath();
      context.moveTo(cornerRadius, 0);
      context.lineTo(canvas.width - cornerRadius, 0);
      context.quadraticCurveTo(canvas.width, 0, canvas.width, cornerRadius);
      context.lineTo(canvas.width, canvas.height - cornerRadius);
      context.quadraticCurveTo(canvas.width, canvas.height, canvas.width - cornerRadius, canvas.height);
      context.lineTo(cornerRadius, canvas.height);
      context.quadraticCurveTo(0, canvas.height, 0, canvas.height - cornerRadius);
      context.lineTo(0, cornerRadius);
      context.quadraticCurveTo(0, 0, cornerRadius, 0);
      context.closePath();
      
      // Fill with gradient
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(50, 150, 50, 0.7)');
      gradient.addColorStop(1, 'rgba(30, 100, 30, 0.7)');
      context.fillStyle = gradient;
      context.fill();
      
      // Add border
      context.lineWidth = 2;
      context.strokeStyle = 'rgba(200, 255, 200, 0.7)';
      context.stroke();
      
      // Draw the text with shadow
      context.shadowColor = 'rgba(0, 0, 0, 0.7)';
      context.shadowBlur = 5;
      context.font = 'bold 24px Arial, Helvetica, sans-serif';
      context.fillStyle = 'white';
      context.textAlign = 'center';
      context.fillText(playerName, canvas.width / 2, canvas.height / 2);
      
      // Create a texture from the canvas
      const texture = new CanvasTexture(canvas);
      texture.anisotropy = 16; // Sharper text
      texture.needsUpdate = true;
      
      // Create a sprite material with the texture
      const material = new SpriteMaterial({ 
        map: texture,
        transparent: true,
        depthTest: false 
      });
      
      // Create the sprite
      const nameSprite = new Sprite(material);
      nameSprite.position.set(0, 2.5, 0); // Position above the player
      nameSprite.scale.set(2, 0.5, 1);
      
      // Add the sprite to the player model
      this.model.add(nameSprite);
      
      // Store it for later disposal
      this.nameSprite = nameSprite;
    } catch (error) {
      console.error('Failed to create name tag:', error);
      // Continue without a name tag
    }
  }
  
  /**
   * Start a subtle hover animation for the player model
   */
  startHoverAnimation() {
    // Create a very subtle hover animation (reduced amount)
    gsap.to(this.model.position, {
      y: "+=0.05", // Reduced amount
      duration: 1.5, // Slower
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
      
      // Store a reference to the animation
      onStart: (tween) => {
        this.hoverAnimation = tween;
      }
    });
    
    // Add subtle glow animation if we have a glow mesh
    if (this.model.children[0]) {
      gsap.to(this.model.children[0].material, {
        opacity: 0.4,
        duration: 2.2, // Slower animation
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1
      });
    }
  }
  
  /**
   * Update state with improved motion smoothing
   * @param {Object} state - New player state from server
   */
  updateState(state) {
    try {
      // Calculate time since last update for velocity calculation
      const now = Date.now();
      const timeDelta = (now - this.lastUpdateTime) / 1000; // in seconds
      this.lastUpdateTime = now;
      
      // Update target position if it changed
      const newPosition = new Vector3(
        Number(state.x) || 0,
        Number(state.y) || 0,
        Number(state.z) || 0
      );
      
      // Calculate distance to new position
      const distanceToNewTarget = this.currentPosition.distanceTo(newPosition);
      
      // Calculate velocity (if time delta is reasonable)
      if (timeDelta > 0.001 && timeDelta < 1.0 && this.positionBuffer.length > 0) {
        // Get previous position from buffer
        const prevPos = this.positionBuffer[this.positionBuffer.length - 1];
        
        // Calculate new velocity
        this.velocity.subVectors(newPosition, prevPos).divideScalar(timeDelta);
        
        // Cap extreme velocity values that might be caused by teleportation
        const maxVelocity = 20;
        if (this.velocity.length() > maxVelocity) {
          this.velocity.normalize().multiplyScalar(maxVelocity);
        }
      }
      
      // Update rotation
      if (state.rotationY !== undefined) {
        this.targetRotationY = Number(state.rotationY);
      }
      
      // Add to position buffer for smoothing
      this.positionBuffer.push(newPosition.clone());
      
      // Keep buffer at max size
      while (this.positionBuffer.length > this.positionBufferMaxSize) {
        this.positionBuffer.shift();
      }
      
      // Update the player model's position using enhanced GSAP animation
      this.animateToNewPosition(newPosition, distanceToNewTarget);
      
      // If name is provided and different, update it
      if (state.name && (!this.nameSprite || state.name !== this.playerName)) {
        this.addNameTag(state.name);
      }
    } catch (error) {
      console.error('Error updating networked player state:', error);
    }
  }
  
  /**
   * Animate the player to a new position using enhanced GSAP
   * @param {Vector3} newPosition - Target position to animate towards
   * @param {number} distance - Distance to the new position
   */
  animateToNewPosition(newPosition, distance) {
    // Store new target position
    this.targetPosition = newPosition.clone();
    
    // If we have an existing animation, kill it to avoid conflicts
    if (this.currentAnimation) {
      this.currentAnimation.kill();
    }
    
    // Choose animation parameters based on distance and context
    let duration, ease;
    
    if (distance > 5) {
      // For teleports or very large jumps
      duration = 0.15; // Very quick transition
      ease = "power1.out"; // Simple ease for teleports
    } else if (distance > 2) {
      // For large movements
      duration = 0.25;
      ease = "power2.out"; // Medium easing
    } else if (distance > 0.5) {
      // For medium movements
      duration = 0.3;
      ease = "power3.out"; // More refined easing
    } else {
      // For small, precise movements
      duration = Math.min(0.4, Math.max(0.2, distance * 0.6));
      ease = "sine.out"; // Smoothest easing for small movements
    }
    
    // Apply prediction by estimating where the player will be at the end of animation
    // This helps smooth out network updates by anticipating movement
    const predictedPosition = newPosition.clone();
    
    // Only use prediction for small to medium movements (not for teleports)
    if (distance < 3 && this.velocity.lengthSq() > 0.01) {
      // Add velocity-based prediction (scaled by duration)
      predictedPosition.add(
        this.velocity.clone().multiplyScalar(duration * 0.5) // 50% prediction factor
      );
    }
    
    // Update current position to match model (in case it was altered)
    this.currentPosition.copy(this.model.position);
    
    // Create the animation using GSAP with enhanced settings
    this.currentAnimation = gsap.to(this.model.position, {
      x: predictedPosition.x,
      y: predictedPosition.y,
      z: predictedPosition.z,
      duration: duration,
      ease: ease,
      onUpdate: () => {
        // Update our tracking position to match the model
        this.currentPosition.copy(this.model.position);
      },
      onComplete: () => {
        // Clear animation reference when done
        this.currentAnimation = null;
      }
    });
    
    // Animate rotation with appropriate easing
    gsap.to(this.model.rotation, {
      y: this.targetRotationY,
      duration: Math.min(duration * 1.2, 0.4), // Slightly longer for rotation
      ease: "sine.out", // Smoother rotation
      onUpdate: () => {
        this.currentRotationY = this.model.rotation.y;
      }
    });
  }
  
  /**
   * Update method for game loop integration
   * Will perform prediction between network updates
   */
  update(delta = 0.016) {
    // If we're not currently animating but have velocity,
    // apply predictive movement between network updates
    if (!this.currentAnimation && this.velocity.lengthSq() > 0.01) {
      // Reduce velocity over time (simulate friction)
      this.velocity.multiplyScalar(0.95);
      
      // Apply predicted movement based on velocity
      if (this.model) {
        this.model.position.add(this.velocity.clone().multiplyScalar(delta));
        this.currentPosition.copy(this.model.position);
      }
    }
  }
  
  /**
   * Remove the player model from the scene
   */
  remove() {
    try {
      if (this.model) {
        // Dispose of materials and textures
        if (this.nameSprite) {
          this.nameSprite.material.map.dispose();
          this.nameSprite.material.dispose();
        }
        
        // Remove from scene
        this.scene.remove(this.model);
        this.model = null;
        
        console.log(`Removed NetworkedPlayer ${this.sessionId} from scene`);
      }
    } catch (error) {
      console.error('Error removing networked player:', error);
    }
  }

  /**
   * Clean up resources when player disconnects
   */
  dispose() {
    try {
      // Kill any active GSAP animations
      if (this.currentAnimation) {
        this.currentAnimation.kill();
      }
      
      if (this.hoverAnimation) {
        this.hoverAnimation.kill();
      }
      
      // Kill any other GSAP animations targeting this model or its children
      gsap.killTweensOf(this.model.position);
      gsap.killTweensOf(this.model.rotation);
      
      if (this.model && this.model.children[0]) {
        gsap.killTweensOf(this.model.children[0].material);
      }
      
      // Remove from scene
      if (this.model) {
        this.scene.remove(this.model);
        // Clean up geometries and materials
        if (this.model.geometry) this.model.geometry.dispose();
        if (this.model.material) this.model.material.dispose();
        
        // Clean up any child objects
        if (this.model.children.length > 0) {
          this.model.children.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
        }
      }
      
      // Clean up name tag
      if (this.nameSprite) {
        this.scene.remove(this.nameSprite);
        if (this.nameSprite.material) this.nameSprite.material.dispose();
        if (this.nameSprite.material.map) this.nameSprite.material.map.dispose();
      }
    } catch (error) {
      console.error('Error disposing NetworkedPlayer:', error);
    }
  }
} 