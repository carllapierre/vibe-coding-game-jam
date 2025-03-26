import * as THREE from 'three';
import { ColyseusManager } from './ColyseusManager.js';
import { NetworkedPlayerManager } from '../character/NetworkedPlayer.js';
import { NetworkedProjectile } from '../projectiles/NetworkedProjectile.js';

/**
 * NetworkManager integrates multiplayer functionality into the game.
 * It manages the connection to the server and handles the spawning and updating of remote players.
 */
export class NetworkManager {
  /**
   * @param {Object} scene - The Three.js scene
   * @param {Object} localPlayer - Reference to the local player
   */
  constructor(scene, localPlayer) {
    this.scene = scene;
    this.localPlayer = localPlayer;
    this.colyseusManager = ColyseusManager.getInstance();
    
    // Create the player manager
    this.playerManager = new NetworkedPlayerManager(scene);
    
    this.isConnected = false;
    this.sessionId = null;
    
    // Enable projectile functionality since server now supports it
    this.isServerReadyForProjectiles = true;
    
    // Tracking for projectiles
    this.lastProjectileId = 0;
    
    // Bind methods
    this.update = this.update.bind(this);
    this.onPlayerJoined = this.onPlayerJoined.bind(this);
    this.onPlayerLeft = this.onPlayerLeft.bind(this);
    this.onPlayerChanged = this.onPlayerChanged.bind(this);
    this.onProjectileCreated = this.onProjectileCreated.bind(this);
    this.onPlayerDamaged = this.onPlayerDamaged.bind(this);
    this.onPlayerRespawned = this.onPlayerRespawned.bind(this);
  }
  
  /**
   * Initialize the network connection
   * @param {string} playerName - Player's display name
   * @param {string} characterModel - Character model ID
   * @returns {Promise<void>}
   */
  async initialize(playerName = 'Player', characterModel = 'character-1') {
    try {
      console.log('Initializing network manager...');
      
      // Set up event listeners
      this.colyseusManager.on('connected', (sessionId) => {
        console.log('Connected to server with session ID:', sessionId);
        this.isConnected = true;
        this.sessionId = sessionId;
      });

      this.colyseusManager.on('error', (error) => {
        console.error('Network error:', error);
        this.isConnected = false;
        // Don't throw here, just log the error
      });

      this.colyseusManager.on('disconnected', () => {
        console.log('Disconnected from server');
        this.isConnected = false;
        this.sessionId = null;
        
        // Clean up networked players
        this.playerManager.dispose();
      });
      
      // Set up player event listeners
      this.colyseusManager.on('playerJoined', this.onPlayerJoined);
      this.colyseusManager.on('playerLeft', this.onPlayerLeft);
      this.colyseusManager.on('playerChanged', this.onPlayerChanged);
      
      // Set up projectile event listeners
      this.colyseusManager.on('projectileCreated', this.onProjectileCreated);
      this.colyseusManager.on('playerDamaged', this.onPlayerDamaged);
      this.colyseusManager.on('playerRespawned', this.onPlayerRespawned);
      
      // Connect to the server
      const room = await this.colyseusManager.connect(playerName, characterModel);
      
      if (!room) {
        throw new Error('Failed to join room');
      }
      
      console.log('Network manager initialized with session ID:', this.sessionId);
      
      // Start sending local player updates only after successful connection
      if (this.isConnected) {
        this.startSendingUpdates();
      }
      
      // Make NetworkManager globally available for projectile sending
      window.networkManager = this;
      
    } catch (error) {
      console.error('Failed to initialize network manager:', error);
      this.isConnected = false;
      throw error;
    }
  }
  
  /**
   * Start sending local player position updates to the server
   */
  startSendingUpdates() {
    // Higher frequency updates for smoother networking
    const updateInterval = 50; // milliseconds (increased from 100ms)
    
    // Clear any existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.updateInterval = setInterval(() => {
      if (!this.isConnected) return;
      
      try {
        // Check if local player exists
        if (!this.localPlayer) return;
        
        // Character class uses camera position for the player position
        let position, rotationY;
        
        if (typeof this.localPlayer.getPosition === 'function') {
          position = this.localPlayer.getPosition();
        }
        else if (this.localPlayer.camera) {
          position = this.localPlayer.camera.position;
        }
        else if (this.localPlayer.position) {
          position = this.localPlayer.position;
        }
        else {
          return;
        }
        
        // Get rotation from camera - compute proper heading angle
        if (this.localPlayer.camera) {
          // Extract the forward direction vector from the camera
          const direction = new THREE.Vector3(0, 0, -1);
          direction.applyQuaternion(this.localPlayer.camera.quaternion);
          
          // Calculate the angle in the XZ plane (heading/yaw)
          rotationY = Math.atan2(-direction.x, -direction.z);
          
        } else {
          rotationY = 0;
        }
        
        if (!position) return;
        
        // Send to server
        this.colyseusManager.sendPosition(
          position.x,
          position.y,
          position.z,
          rotationY || 0
        );
      } catch (error) {
        console.error('Error sending position updates:', error);
      }
    }, updateInterval);
  }
  
  /**
   * Handle player join event
   * @param {Object} data - Player join data
   */
  onPlayerJoined({ sessionId, player }) {
    try {
      // Skip if it's our own session ID
      if (sessionId === this.sessionId) return;
      
      // Add the player using the manager
      this.playerManager.addPlayer(sessionId, player);
    } catch (error) {
      console.error('Error in onPlayerJoined:', error);
    }
  }
  
  /**
   * Handle player leave event
   * @param {Object} data - Player leave data
   */
  onPlayerLeft({ sessionId }) {
    try {
      console.log('Removing player:', sessionId);
      
      // Remove the player using the manager
      this.playerManager.removePlayer(sessionId);
    } catch (error) {
      console.error('Error in onPlayerLeft:', error);
    }
  }
  
  /**
   * Handle player change event
   * @param {Object} player - Player data from the server
   */
  onPlayerChanged(player) {
    try {
      const sessionId = player.sessionId;
      
      // Skip our own player
      if (sessionId === this.colyseusManager.sessionId) return;
      
      // Update the player using the manager
      this.playerManager.updatePlayer(sessionId, player);
    } catch (error) {
      console.error('Error handling player change:', error);
    }
  }
  
  /**
   * Send a projectile update to the server
   * @param {Object} projectileData - Projectile data
   */
  sendProjectile(projectileData) {
    if (!this.isConnected) return;
    
    try {
      // Safety check - don't send projectiles if server might not be ready
      if (!this.isServerReadyForProjectiles) {
        console.log('Server not ready for projectiles yet. Skipping network send.');
        return;
      }
      
      // Add a unique ID for this projectile
      const projectileId = `${this.sessionId}_${Date.now()}_${this.lastProjectileId++}`;
      
      // Send projectile data to server
      this.colyseusManager.sendProjectile({
        id: projectileId,
        ...projectileData
      });
    } catch (error) {
      console.error('Error sending projectile:', error);
    }
  }
  
  /**
   * Send player state over the network
   * @param {string} state - The player's current state (idle, walking, jumping)
   */
  sendPlayerState(state) {
    if (!this.isConnected) return;
    
    try {
      this.colyseusManager.sendPlayerState(state);
    } catch (error) {
      console.error('Error sending player state:', error);
    }
  }
  
  /**
   * Handle a projectile created by another player
   * @param {Object} data - Projectile data
   */
  onProjectileCreated(data) {
    try {
      // Skip projectiles from our own player
      if (data.playerId === this.sessionId) return;
      
      // Create a networked projectile
      const projectile = new NetworkedProjectile({
        scene: this.scene,
        data: data,
        onHitPlayer: (sourcePlayerId, itemType) => {
          // Handle player hit
          this.handleProjectileHit(sourcePlayerId, itemType);
        }
      });
      
      // Register for updates
      NetworkedProjectile.registerProjectile(projectile);
    } catch (error) {
      console.error('Error handling projectile creation:', error);
    }
  }
  
  /**
   * Handle a projectile hit on local player
   * @param {string} sourcePlayerId - ID of player who threw the projectile
   * @param {string} itemType - Type of item that hit
   */
  handleProjectileHit(sourcePlayerId, itemType) {
    try {
      // Calculate damage based on item type
      const damageAmount = this.getDamageForItemType(itemType);
      
      // When hit by a projectile, we don't apply damage locally
      // The server will handle this and broadcast the damage event
      // which will then be processed in onPlayerDamaged
      
      // Just notify server that we were hit by this player's projectile
      this.colyseusManager.sendDamage(sourcePlayerId, damageAmount);
      
      // Visual feedback immediately (don't wait for server response)
      this.showDamageEffect();
      
      console.log(`Hit by projectile from ${sourcePlayerId}, reporting damage of ${damageAmount}`);
    } catch (error) {
      console.error('Error handling projectile hit:', error);
    }
  }
  
  /**
   * Get damage amount for an item type
   * @param {string} itemType - The item type
   * @returns {number} The damage amount
   */
  getDamageForItemType(itemType) {
    // Different food items can do different damage
    const damageMap = {
      'tomato': 10,
      'apple': 15,
      'banana': 8,
      'watermelon': 25,
      'pineapple': 20,
      'cake': 30
    };
    
    return damageMap[itemType] || 10; // Default damage if item type not found
  }
  
  /**
   * Show a damage effect when the player is hit
   */
  showDamageEffect() {
    try {
      // Create a red flash effect
      const damageOverlay = document.createElement('div');
      damageOverlay.style.position = 'fixed';
      damageOverlay.style.top = '0';
      damageOverlay.style.left = '0';
      damageOverlay.style.width = '100%';
      damageOverlay.style.height = '100%';
      damageOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
      damageOverlay.style.pointerEvents = 'none';
      damageOverlay.style.zIndex = '1000';
      document.body.appendChild(damageOverlay);
      
      // Fade out and remove
      setTimeout(() => {
        damageOverlay.style.transition = 'opacity 0.5s';
        damageOverlay.style.opacity = '0';
        setTimeout(() => {
          document.body.removeChild(damageOverlay);
        }, 500);
      }, 100);
    } catch (error) {
      console.error('Error showing damage effect:', error);
    }
  }
  
  /**
   * Show a hit marker when the player hits another player
   */
  showHitMarker() {
    try {
      // Create a hit marker in the center of the screen
      const hitMarker = document.createElement('div');
      hitMarker.style.position = 'fixed';
      hitMarker.style.top = '50%';
      hitMarker.style.left = '50%';
      hitMarker.style.transform = 'translate(-50%, -50%)';
      hitMarker.style.width = '20px';
      hitMarker.style.height = '20px';
      hitMarker.style.color = '#fff';
      hitMarker.style.fontSize = '20px';
      hitMarker.style.fontWeight = 'bold';
      hitMarker.style.textAlign = 'center';
      hitMarker.style.lineHeight = '20px';
      hitMarker.style.pointerEvents = 'none';
      hitMarker.style.zIndex = '1001';
      hitMarker.innerHTML = '✓';
      document.body.appendChild(hitMarker);
      
      // Remove after a short time
      setTimeout(() => {
        document.body.removeChild(hitMarker);
      }, 300);
    } catch (error) {
      console.error('Error showing hit marker:', error);
    }
  }
  
  /**
   * Handle player respawn events
   * @param {Object} data - Respawn data
   */
  onPlayerRespawned(data) {
    try {
      const { playerId } = data;
      
      // If it's our player, reset health and position
      if (playerId === this.sessionId && this.localPlayer) {
        if (this.localPlayer.healthManager) {
          this.localPlayer.healthManager.setHealth(100);
        }
        
        // Player position will be updated by the server
        console.log('You have respawned!');
        
        // You can add visual effects here
        // For example, a screen fade-in effect
      }
    } catch (error) {
      console.error('Error handling player respawn:', error);
    }
  }
  
  /**
   * Handle a player damaged event
   * @param {Object} data - Damage data including remaining health
   */
  onPlayerDamaged(data) {
    try {
      const { targetId, sourceId, amount, remainingHealth } = data;
      
      // If we're the target, update our health
      if (targetId === this.sessionId) {
        if (this.localPlayer && this.localPlayer.healthManager) {
          this.localPlayer.healthManager.setHealth(remainingHealth);
        }
        
        console.log(`You were hit for ${amount} damage! Health: ${remainingHealth}`);
        
        // Add hit effect
        this.showDamageEffect();
      }
      
      // If we're the source, we can show a hit marker or similar
      if (sourceId === this.sessionId) {
        console.log(`Hit player ${targetId} for ${amount} damage!`);
        // Add hit marker
        this.showHitMarker();
      }
    } catch (error) {
      console.error('Error handling player damaged:', error);
    }
  }
  
  /**
   * Update loop
   * @param {number} delta - Time since last frame (in seconds)
   */
  update(delta) {
    try {
      // Update remote player animations
      this.playerManager.update(delta);
      
      // Update networked projectiles
      if (this.isServerReadyForProjectiles) {
        NetworkedProjectile.updateAll(this.localPlayer);
      }
      
      // Perform periodic garbage collection
      this.performGarbageCollection();
    } catch (error) {
      console.error('Error in NetworkManager.update:', error);
    }
  }
  
  /**
   * Perform garbage collection to clean up stale resources
   * Called periodically from update to ensure cleanup
   */
  performGarbageCollection() {
    // Run garbage collection less frequently (roughly every 5 seconds)
    if (!this._lastGC || Date.now() - this._lastGC > 5000) {
      this._lastGC = Date.now();
      
      try {
        // Check for stale remote players
        if (this.colyseusManager && this.colyseusManager.remotePlayers) {
          const remotePlayerIds = Object.keys(this.colyseusManager.remotePlayers);
          
          // Verify each player in playerManager exists in remotePlayers
          this.playerManager.validatePlayers(remotePlayerIds);
          
          console.log(`GC: ${remotePlayerIds.length} active remote players`);
        }
        
        // Log active projectiles count
        if (NetworkedProjectile.activeProjectiles) {
          console.log(`GC: ${NetworkedProjectile.activeProjectiles.length} active projectiles`);
        }
      } catch (error) {
        console.error('Error during garbage collection:', error);
      }
    }
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    try {
      // Clear networking update interval
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      // Force clean up any remaining projectiles
      if (NetworkedProjectile.activeProjectiles) {
        NetworkedProjectile.activeProjectiles.forEach(projectile => {
          if (projectile && projectile.destroy) {
            projectile.destroy();
          }
        });
        NetworkedProjectile.activeProjectiles = [];
      }
      
      // Dispose of player manager
      if (this.playerManager) {
        this.playerManager.dispose();
      }
      
      // Disconnect from server
      if (this.colyseusManager) {
        this.colyseusManager.disconnect();
      }
      
      // Remove global reference
      if (window.networkManager === this) {
        delete window.networkManager;
      }
      
      // Clear references
      this.scene = null;
      this.localPlayer = null;
      this.isConnected = false;
      this.sessionId = null;
      
      console.log('NetworkManager disposed');
    } catch (error) {
      console.error('Error disposing NetworkManager:', error);
    }
  }
} 