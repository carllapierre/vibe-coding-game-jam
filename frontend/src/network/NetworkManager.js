import * as THREE from 'three';
import { ColyseusManager } from './ColyseusManager.js';
import { NetworkedPlayerManager } from '../character/NetworkedPlayer.js';
import { NetworkedProjectile } from '../projectiles/NetworkedProjectile.js';
import { FoodProjectile } from '../projectiles/FoodProjectile.js';
import { AudioManager } from '../audio/AudioManager.js';

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
      
      // Register NetworkedPlayerManager with the FoodProjectile system for collision detection
      this.playerManager.registerWithProjectileSystem(FoodProjectile);
      
      // Connect local player with NetworkedPlayerManager
      if (this.localPlayer) {
        this.localPlayer.setNetworkedPlayers(this.playerManager.players);
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
      
      console.log(`Received projectile from player ${data.playerId}, type: ${data.itemType || 'unknown'}`);
      
      // Create a networked projectile
      const projectile = new NetworkedProjectile({
        scene: this.scene,
        data: data,
        onHitPlayer: (sourcePlayerId, itemType, damage) => {
          // When hit by a networked projectile, report damage to server
          this.handleProjectileHit(sourcePlayerId, itemType, damage);
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
   * @param {number} damage - Amount of damage
   */
  handleProjectileHit(sourcePlayerId, itemType, damage) {
    try {
      console.log(`RECEIVED HIT - Hit by projectile from ${sourcePlayerId} with ${itemType}, damage=${damage}`);
      
      // Only send network message if connected
      if (this.isConnected && this.colyseusManager) {
        // As a receiver, we trust the thrower's hit detection
        // Simply send playerHit to server with source as the thrower
        this.colyseusManager.send('playerHit', {
          targetId: this.sessionId,   // We're the target
          sourceId: sourcePlayerId,   // Player who threw the projectile
          damage: damage,
          itemType: itemType          // Include item type for death messages
        });
      } else {
        console.warn('Not connected to server, cannot send hit information');
      }
      
      // Show visual feedback immediately
      this.showDamageEffect();
      
      // Play hitmarker sound - no proximity needed for local player hit
      // since we're at the hit position
      try {
        if (AudioManager) {
          console.log("%c[PLAYING LOCAL PLAYER HIT SOUND]", "background: #ff00ff; color: white; font-size: 16px;");
          AudioManager.play('hit', { 
            volume: 1.0,                // Full volume for direct hits
            pitchMin: 0.4,              // Extremely low pitch possible  
            pitchMax: 1.6,              // Extremely high pitch possible
            allowOverlap: true          // Allow sounds to overlap
          });
        }
      } catch (error) {
        console.warn('Unable to play hit sound:', error);
      }
      
      // No damage prediction - wait for server to confirm damage
    } catch (error) {
      console.error('Error handling projectile hit:', error);
    }
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
      const { playerId, position } = data;
      
      // If it's our player, we only want to handle server-initiated respawns
      // and ignore our own local respawn signals
      if (playerId === this.sessionId && this.localPlayer) {
        // Only handle respawn from server if the server is sending a position
        // // Otherwise, our local respawn timer is the source of truth
        // if (position && this.localPlayer.isInDeathState) {
        //   console.log("Server initiated respawn with position:", position);
          
        //   // Let local player handle the respawn timing
        //   if (this.localPlayer.respawn) {
        //     // Use setTimeout to ensure we don't interrupt any ongoing death animations
        //     setTimeout(() => {
        //       this.localPlayer.respawn();
        //     }, 100);
        //   }
        // } else {
        //   console.log("Ignoring respawn signal - using local respawn timing");
        // }
      } 
      // If it's another player, update their health bar to 100%
      else {
        const player = this.playerManager.players.get(playerId);
        if (player) {
          console.log(`Remote player ${playerId} respawned`);
          
          // Update player state to respawned with full health
          // player.updateState({
          //   health: 100,
            // Include other state data to avoid overwriting it
            // x: player.currentPosition.x,
            // y: player.currentPosition.y, 
            // z: player.currentPosition.z,
            // rotationY: player.currentRotationY,
            // name: player.playerData.name,
            // state: 'idle' // Reset state to idle after respawn
          //});
          
          // Force update the health bar
          player.playerData.health = 100;
          player.health = 100;
          player.updateHealthBar(false);
          
          // Make sure model is visible again
          // if (player.model && !player.model.visible) {
          //   player.model.visible = true;
          // }
          
          // Remove any death message
          // player.removeDeathMessage();
        }
      }
    } catch (error) {
      console.error('Error handling player respawn:', error);
    }
  }
  
  /**
   * Handle a player damaged event - the authoritative update from server
   * @param {Object} data - Damage data from server
   */
  onPlayerDamaged(data) {
    try {
      const { targetId, sourceId, damage, remainingHealth, itemType } = data;
      
      console.log(`SERVER DAMAGE EVENT: target=${targetId}, source=${sourceId}, damage=${damage}, health=${remainingHealth}, item=${itemType || 'unknown'}`);
      
      // If we're the target, update our health
      if (targetId === this.sessionId) {
        if (this.localPlayer && this.localPlayer.healthManager) {
          // If player is already in death state, don't update health
          if (this.localPlayer.isInDeathState) {
            console.log("Player already in death state, ignoring health update");
          } else {
            // Apply the server's authority on health value
            this.localPlayer.healthManager.setHealth(remainingHealth);
            
            // Visual effects for taking damage
            this.showDamageEffect();
            
            // If health is zero, trigger death state with appropriate death message
            if (remainingHealth <= 0 && this.localPlayer.setDeathState) {
              // Get the item type that killed the player for a customized message
              const killerWeapon = itemType || 'tomato';
              const killerName = this.getPlayerNameById(sourceId) || 'Someone';
              
              // Trigger death state with the killer's name and weapon
              this.localPlayer.setDeathState(killerName, killerWeapon);
            }
          }
        }
        
        console.log(`You were hit for ${damage} damage! Health: ${remainingHealth}`);
      } 
      // If it's another player, update their health in the player manager
      else {
        const targetPlayer = this.playerManager.players.get(targetId);
        if (targetPlayer) {
          console.log(`Updating player ${targetId} health to ${remainingHealth}`);
          
          // Don't update health for players in death state (isDead)
          if (targetPlayer.isDead && remainingHealth > 0) {
            console.log(`Player ${targetId} is in death state, ignoring health update`);
          } else {
            // Update with server values
            targetPlayer.updateState({
              health: remainingHealth,
              // Include other state data to avoid overwriting it
              x: targetPlayer.currentPosition.x,
              y: targetPlayer.currentPosition.y, 
              z: targetPlayer.currentPosition.z,
              rotationY: targetPlayer.currentRotationY,
              name: targetPlayer.playerData.name,
              state: remainingHealth <= 0 ? 'death' : 'hit' // Set state based on health
            });
            
            // Show hit effect
            if (targetPlayer.healthBar) {
              targetPlayer.healthBar.showHitEffect();
            }
          }
        }
      }
      
      // If we're the source, show hit confirmation
      if (sourceId === this.sessionId) {
        console.log(`Server confirmed your hit on player ${targetId} for ${damage} damage!`);
        this.showHitMarker();
      }
    } catch (error) {
      console.error('Error handling player damaged:', error);
    }
  }
  
  /**
   * Get a player's name by their session ID
   * @param {string} playerId - The player's session ID
   * @returns {string} The player's name or "Unknown Player" if not found
   */
  getPlayerNameById(playerId) {
    try {
      // Check if it's a remote player
      if (this.playerManager && this.playerManager.players) {
        const player = this.playerManager.players.get(playerId);
        if (player && player.playerData && player.playerData.name) {
          return player.playerData.name;
        }
      }
      
      // Check if it's in the Colyseus manager's remote players
      if (this.colyseusManager && this.colyseusManager.remotePlayers) {
        const player = this.colyseusManager.remotePlayers[playerId];
        if (player && player.name) {
          return player.name;
        }
      }
      
      return "Unknown Player";
    } catch (error) {
      console.error('Error getting player name:', error);
      return "Unknown Player";
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
      
      // Sync networked players with local character for hit detection
      if (this.localPlayer && typeof this.localPlayer.setNetworkedPlayers === 'function') {
        this.localPlayer.setNetworkedPlayers(this.playerManager.getCollisionBoxes());
      }
      
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
  
  /**
   * Send player hit information to server
   * @param {Object} data - Hit data with targetPlayerId, damage and itemType
   */
  sendPlayerHit(data) {
    if (!this.isConnected) {
      console.warn('Cannot send player hit: not connected to server');
      return;
    }
    
    if (!data || !data.targetPlayerId) {
      console.warn('Cannot send player hit: missing target player ID');
      return;
    }
    
    try {
      // Send hit data to server
      this.colyseusManager.send('playerHit', {
        targetId: data.targetPlayerId,
        damage: data.damage || 10,
        itemType: data.itemType || 'tomato',
        sourceId: this.sessionId  // We are the source
      });
      
      console.log(`Sent hit report to server - target: ${data.targetPlayerId}, damage: ${data.damage}`);
      
      // Show hit marker UI immediately
      this.showHitMarker();
      
      // Play hit sound for the thrower
      try {
        if (AudioManager) {
          console.log('[AUDIO] Playing hit confirmation sound for network hit');
          AudioManager.play('hit', { 
            volume: 0.7,
            pitchMin: 0.7,
            pitchMax: 1.3,
            allowOverlap: true,
            debug: true
          });
        }
      } catch (error) {
        console.warn('Unable to play hit sound:', error);
      }
      
    } catch (error) {
      console.error('Error sending player hit:', error);
    }
  }
} 