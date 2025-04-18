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
    
    // Create the leaderboard
    this.leaderboard = null;
    
    // Bind methods
    this.update = this.update.bind(this);
    this.onPlayerJoined = this.onPlayerJoined.bind(this);
    this.onPlayerLeft = this.onPlayerLeft.bind(this);
    this.onPlayerChanged = this.onPlayerChanged.bind(this);
    this.onProjectileCreated = this.onProjectileCreated.bind(this);
    this.onPlayerDamaged = this.onPlayerDamaged.bind(this);
    this.onPlayerRespawned = this.onPlayerRespawned.bind(this);
    this.onLeaderboardUpdate = this.onLeaderboardUpdate.bind(this);
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
      
      // Set up leaderboard event listener
      this.colyseusManager.on('leaderboardUpdate', this.onLeaderboardUpdate);
      
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
      
      // Initialize the leaderboard
      this.initializeLeaderboard();
      
      // Make NetworkManager globally available for projectile sending
      window.networkManager = this;
      
    } catch (error) {
      console.error('Failed to initialize network manager:', error);
      this.isConnected = false;
      throw error;
    }
  }
  
  /**
   * Initialize the leaderboard UI
   */
  initializeLeaderboard() {
    try {
      // Import dynamically to prevent issues with circular dependencies
      import('../ui/Leaderboard.js').then(module => {
        const Leaderboard = module.Leaderboard;
        this.leaderboard = new Leaderboard();
        
        // Request initial leaderboard data
        this.requestLeaderboardData();
        
        // Also request a leaderboard update from the server
        if (this.isConnected && this.colyseusManager && this.colyseusManager.room) {
          this.colyseusManager.room.send('requestLeaderboard');
        }
      });
    } catch (error) {
      console.error('Failed to initialize leaderboard:', error);
    }
  }
  
  /**
   * Request leaderboard data from the server
   */
  requestLeaderboardData() {
    if (!this.isConnected) return;
    
    // For now, we'll use the initial state of all players
    const players = [];
    
    // Add all remote players to the leaderboard
    for (const [sessionId, player] of Object.entries(this.colyseusManager.remotePlayers)) {
      players.push({
        id: sessionId,
        name: player.name || `Player ${sessionId.substring(0, 4)}`,
        score: player.score || 0
      });
    }
    
    // Add local player to the leaderboard
    if (this.sessionId) {
      const localPlayerData = this.colyseusManager.room.state.players.get(this.sessionId);
      if (localPlayerData) {
        players.push({
          id: this.sessionId,
          name: localPlayerData.name || `Player ${this.sessionId.substring(0, 4)}`,
          score: localPlayerData.score || 0
        });
      }
    }
    
    // Update the leaderboard
    if (this.leaderboard) {
      this.leaderboard.updateLeaderboard(players);
    }
  }
  
  /**
   * Handle leaderboard update from server
   * @param {Array} players - Updated player data for the leaderboard
   */
  onLeaderboardUpdate(players) {
    if (!this.leaderboard) return;
    
    console.log('Received leaderboard update:', players);
    this.leaderboard.updateLeaderboard(players);
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

      } 
      // If it's another player, update their health bar to 100%
      else {
        const player = this.playerManager.players.get(playerId);
        if (player) {
          
          // Force update the health bar
          player.playerData.health = 100;
          player.health = 100;
          player.updateHealthBar(false);
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
      const { targetId, sourceId, damage, remainingHealth, itemType, hitId } = data;
      
      console.log(`[DAMAGE DEBUG] Received damage event: ID: ${hitId}, Target: ${targetId}, Source: ${sourceId}, Damage: ${damage}, RemainingHealth: ${remainingHealth}`);
      
      // If we're the target, update our health
      if (targetId === this.sessionId) {
        console.log(`[DAMAGE DEBUG] I am the target! Current health: ${this.localPlayer?.healthManager?.currentHealth}`);
        
        if (this.localPlayer && this.localPlayer.healthManager) {
          // If player is already in death state, don't update health
          if (this.localPlayer.isInDeathState) {
            console.log("[DAMAGE DEBUG] Already in death state, ignoring health update");
          } else {
            // Apply the server's authority on health value
            console.log(`[DAMAGE DEBUG] Updating local health to ${remainingHealth}`);
            this.localPlayer.healthManager.setHealth(remainingHealth);
            
            // Visual effects for taking damage (in case we missed the hit effect)
            this.showDamageEffect();
            
            // If health is zero, trigger death state with appropriate death message
            if (remainingHealth <= 0 && this.localPlayer.setDeathState) {
              console.log("[DAMAGE DEBUG] Health is zero, triggering death state");
              // Get the item type that killed the player for a customized message
              const killerWeapon = itemType || 'tomato';
              const killerName = this.getPlayerNameById(sourceId) || 'Someone';
              
              // Trigger death state with the killer's name, weapon, and ID
              this.localPlayer.setDeathState(killerName, killerWeapon, sourceId);
            }
          }
        } else {
          console.log("[DAMAGE DEBUG] Cannot update health: localPlayer or healthManager is null");
        }
      } 
      // If it's another player, update their health in the player manager
      else {
        const targetPlayer = this.playerManager.players.get(targetId);
        if (targetPlayer) {
          console.log(`[DAMAGE DEBUG] Updating remote player ${targetId} health from ${targetPlayer.health} to ${remainingHealth}`);
          
          // Always forcefully update health
          if (typeof targetPlayer.forceHealthUpdate === 'function') {
            // Use the new force update method for reliable health bar updates
            targetPlayer.forceHealthUpdate(remainingHealth);
          } else {
            // Fallback to direct property setting
            targetPlayer.health = remainingHealth;
            targetPlayer.playerData.health = remainingHealth;
            targetPlayer.updateHealthBar(true);
          }
          
          // Don't update health for players in death state (isDead) but do allow resurrections
          if (targetPlayer.isDead && remainingHealth > 0) {
            console.log(`[DAMAGE DEBUG] Player ${targetId} is resurrecting`);
            targetPlayer.isDead = false;
            if (targetPlayer.model) {
              targetPlayer.model.visible = true;
            }
          }
          
          // Update with server values, including health
          targetPlayer.updateState({
            health: remainingHealth,
            x: targetPlayer.currentPosition.x,
            y: targetPlayer.currentPosition.y, 
            z: targetPlayer.currentPosition.z,
            rotationY: targetPlayer.currentRotationY,
            name: targetPlayer.playerData.name,
            state: remainingHealth <= 0 ? 'death' : 'hit'
          });
          
          // If health reaches 0, trigger death
          if (remainingHealth <= 0 && !targetPlayer.isDead) {
            console.log(`[DAMAGE DEBUG] Player ${targetId} health is zero, triggering death`);
            targetPlayer.triggerDeath();
          }
        } else {
          console.log(`[DAMAGE DEBUG] Cannot update health: Remote player ${targetId} not found`);
        }
      }
      
      // If we're the source, show hit confirmation
      if (sourceId === this.sessionId) {
        console.log(`[DAMAGE DEBUG] I am the source! Hit confirmed on player ${targetId} for ${damage} damage!`);
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
      
      // Show hit marker UI immediately
      this.showHitMarker();
      
      // Play hit sound for the thrower
      try {
        if (AudioManager) {
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
  
  /**
   * Send kill attribution to the server when a player is killed
   * @param {string} killerId - ID of the player who got the kill
   */
  sendKillAttribution(killerId) {
    if (!this.isConnected || !killerId) return;
    
    try {
      // Send kill data to server
      this.colyseusManager.room.send('killAttribution', {
        killerId: killerId
      });
    } catch (error) {
      console.error('Error sending kill attribution:', error);
    }
  }
} 