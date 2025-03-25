import { ColyseusManager } from './ColyseusManager.js';
import { NetworkedPlayer } from '../character/NetworkedPlayer.js';

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
    
    /** @type {Object.<string, NetworkedPlayer>} */
    this.networkedPlayers = {};
    
    this.isConnected = false;
    this.sessionId = null;
    
    // Bind methods
    this.update = this.update.bind(this);
    this.onPlayerJoined = this.onPlayerJoined.bind(this);
    this.onPlayerLeft = this.onPlayerLeft.bind(this);
    this.onPlayerChanged = this.onPlayerChanged.bind(this);
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
        Object.values(this.networkedPlayers).forEach(player => {
          player.remove();
        });
        this.networkedPlayers = {};
      });
      
      // Set up player event listeners
      this.colyseusManager.on('playerJoined', this.onPlayerJoined);
      this.colyseusManager.on('playerLeft', this.onPlayerLeft);
      this.colyseusManager.on('playerChanged', this.onPlayerChanged);
      
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
        let position, rotation;
        
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
        
        // Get rotation from camera
        if (this.localPlayer.camera) {
          rotation = this.localPlayer.camera.rotation;
        } else {
          rotation = { y: 0 };
        }
        
        if (!position) return;
        
        // Send to server
        this.colyseusManager.sendPosition(
          position.x,
          position.y,
          position.z,
          rotation?.y || 0
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
      
      // Check if player already exists, remove it first
      if (this.networkedPlayers[sessionId]) {
        this.networkedPlayers[sessionId].remove();
        delete this.networkedPlayers[sessionId];
      }
      
      // Create a new networked player immediately
      if (this.scene) {
        const networkedPlayer = new NetworkedPlayer(sessionId, player, this.scene);
        this.networkedPlayers[sessionId] = networkedPlayer;
      }
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
      
      if (this.networkedPlayers[sessionId]) {
        this.networkedPlayers[sessionId].remove();
        delete this.networkedPlayers[sessionId];
      }
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
      
      // If we have this player, update their state
      if (this.networkedPlayers[sessionId]) {
        const networkedPlayer = this.networkedPlayers[sessionId];
        // Call the GSAP-enabled updateState method
        networkedPlayer.updateState(player);
      }
    } catch (error) {
      console.error('Error handling player change:', error);
    }
  }
  
  /**
   * Update method to be called in the game loop
   * @param {number} delta - Time delta
   */
  update(delta) {
    // Skip if not connected
    if (!this.isConnected) return;
    
    try {
      // Call update on all networked players for prediction between network updates
      Object.values(this.networkedPlayers).forEach(player => {
        if (player && typeof player.update === 'function') {
          player.update(delta);
        }
      });
      
      // Check if we need to restart the update interval
      if (!this.updateInterval) {
        this.startSendingUpdates();
      }
    } catch (error) {
      console.error('Error in network manager update:', error);
    }
  }
  
  /**
   * Clean up resources when shutting down
   */
  dispose() {
    try {
      console.log('Disposing network manager');

      // Clear update interval
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
        this.updateInterval = null;
      }
      
      // Remove all networked players
      Object.values(this.networkedPlayers).forEach(player => {
        try {
          if (player && typeof player.remove === 'function') {
            player.remove();
          }
        } catch (error) {
          console.error('Error removing networked player during cleanup:', error);
        }
      });
      this.networkedPlayers = {};
      
      // Remove event listeners
      this.colyseusManager.off('playerJoined', this.onPlayerJoined);
      this.colyseusManager.off('playerLeft', this.onPlayerLeft);
      this.colyseusManager.off('playerChanged', this.onPlayerChanged);
      
      // Disconnect from server
      this.colyseusManager.disconnect();
      
      this.isConnected = false;
      this.sessionId = null;
      
      console.log('Network manager disposed');
    } catch (error) {
      console.error('Error disposing network manager:', error);
    }
  }
} 