import { Client } from 'colyseus.js';
import { EventEmitter } from '../utils/EventEmitter.js';

// Constants
const COLYSEUS_SERVER_URL = 'ws://localhost:2567';

/**
 * Generate a unique client ID for this browser tab
 * @returns {string} Unique ID
 */
function generateClientId() {
  return 'client_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * ColyseusManager handles the connection and communication with the Colyseus server.
 * It follows the Singleton pattern to ensure only one connection exists.
 */
export class ColyseusManager extends EventEmitter {
  static instance = null;
  
  /** @type {Client} */
  client = null;
  
  /** @type {import('colyseus.js').Room} */
  room = null;
  
  /** @type {Object.<string, any>} */
  remotePlayers = {};
  
  /** @type {string} */
  clientId = generateClientId();
  
  /**
   * Get the singleton instance of ColyseusManager
   * @returns {ColyseusManager}
   */
  static getInstance() {
    if (!ColyseusManager.instance) {
      ColyseusManager.instance = new ColyseusManager();
    }
    return ColyseusManager.instance;
  }
  
  /**
   * Connect to the Colyseus server
   * @param {string} playerName - Player's display name
   * @param {string} characterModel - ID of the character model to use
   * @returns {Promise<void>}
   */
  async connect(playerName = 'Player', characterModel = 'character-1') {
    try {
      // Clean up any previous connection
      this.disconnect();
      
      this.client = new Client(COLYSEUS_SERVER_URL);
      
      // Join the lobby room with clientId to differentiate between browser tabs
      this.room = await this.client.joinOrCreate('lobby', {
        name: playerName,
        characterModel,
        clientId: this.clientId
      });
      
      console.log('Connected to Colyseus server:', this.room.sessionId);
      
      // Set up event listeners for room state changes
      this.setupRoomListeners();
      
      // Emit connected event
      this.emit('connected', this.room.sessionId);
      
      return this.room;
    } catch (error) {
      console.error('Failed to connect to Colyseus server:', error);
      this.emit('error', error);
      throw error;
    }
  }
  
  /**
   * Set up listeners for room state changes
   */
  setupRoomListeners() {
    if (!this.room) {
      console.error('Room is not initialized');
      return;
    }

    // Clear existing remote players
    this.remotePlayers = {};

    // Wait for the state to be synchronized
    this.room.onStateChange((state) => {
      // Set up player listeners only after state is synchronized
      if (state && state.players) {
        // Handle existing players
        state.players.forEach((player, sessionId) => {
          // Skip if it's the local player
          if (sessionId === this.room.sessionId) {
            this.emit('currentPlayer', player);
            return;
          }
          
          // Add to remote players and emit join event
          this.remotePlayers[sessionId] = player;
          this.emit('playerJoined', { sessionId, player });
          this.setupPlayerListeners(player, sessionId);
        });
        
        // Listen for changes in the players collection
        state.players.onAdd = (player, sessionId) => {
          // Skip if it's the local player
          if (sessionId === this.room.sessionId) {
            this.emit('currentPlayer', player);
            return;
          }
          
          // Add to remote players and emit join event
          this.remotePlayers[sessionId] = player;
          this.emit('playerJoined', { sessionId, player });
          this.setupPlayerListeners(player, sessionId);
        };
        
        state.players.onRemove = (player, sessionId) => {
          delete this.remotePlayers[sessionId];
          this.emit('playerLeft', { sessionId, player });
        };
      }
    });

    // Listen for room errors
    this.room.onError((code, message) => {
      console.error('Room error:', code, message);
      this.emit('error', new Error(`Room error: ${message}`));
    });

    // Listen for room leave
    this.room.onLeave((code) => {
      console.log('Left Colyseus room:', code);
      this.emit('disconnected');
    });
    
    // Set up message handlers for custom events
    this.setupMessageHandlers();
  }
  
  /**
   * Set up message handlers for custom events
   * like projectiles, damage, etc.
   */
  setupMessageHandlers() {
    if (!this.room) return;
    
    // Listen for projectile creation events
    this.room.onMessage('projectile', (data) => {
      // Forward to listeners with playerId added
      this.emit('projectileCreated', {
        ...data,
        playerId: data.playerId // Ensure playerId is passed
      });
    });
    
    // Listen for damage events
    this.room.onMessage('damage', (data) => {
      this.emit('playerDamaged', data);
    });
    
    // Listen for player respawn events
    this.room.onMessage('playerRespawned', (data) => {
      this.emit('playerRespawned', data);
    });
  }
  
  /**
   * Set up listeners for individual player state changes
   * @param {any} player - Player object from Colyseus
   * @param {string} sessionId - Player's session ID
   */
  setupPlayerListeners(player, sessionId) {
    // Track accumulated changes to reduce update frequency
    let changeTimeout = null;
    let positionChanged = false;
    let stateChanged = false;
    
    // Function to emit accumulated changes
    const emitChanges = () => {
      if (positionChanged || stateChanged) {
        // Create a player state object with the sessionId included
        const playerState = {
          sessionId,
          x: player.x,
          y: player.y,
          z: player.z,
          rotationY: player.rotationY,
          name: player.name,
          state: player.state
        };
        
        // Emit the change with the full player state
        this.emit('playerChanged', playerState);
        
        // Reset flags
        positionChanged = false;
        stateChanged = false;
      }
      
      changeTimeout = null;
    };
    
    // Check if the player object is coming from a Colyseus schema
    if (typeof player.listen === 'function') {
      // Listen for any position or rotation changes
      ['x', 'y', 'z', 'rotationY'].forEach(prop => {
        player.listen(prop, (newValue, previousValue) => {
          // Mark as changed
          positionChanged = true;
          
          // Debounce updates to avoid too many events
          // But not too long to ensure smoothness
          if (!changeTimeout) {
            changeTimeout = setTimeout(emitChanges, 16); // ~60fps rate
          }
        });
      });
      
      // Listen for player state changes
      player.listen("state", (newValue, previousValue) => {
        if (newValue !== previousValue) {
          stateChanged = true;
          
          if (!changeTimeout) {
            changeTimeout = setTimeout(emitChanges, 16);
          }
        }
      });
      
      // Handle name changes immediately
      player.listen("name", (newValue, previousValue) => {
        if (newValue !== previousValue) {
          const playerState = {
            sessionId,
            name: newValue,
            x: player.x,
            y: player.y,
            z: player.z,
            rotationY: player.rotationY,
            state: player.state
          };
          
          this.emit('playerChanged', playerState);
        }
      });
    }
  }
  
  /**
   * Send player position and rotation to the server
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   * @param {number} rotationY - Y rotation
   */
  sendPosition(x, y, z, rotationY) {
    if (!this.room) return;
    
    // Ensure all values are numbers
    const position = {
      x: Number(x),
      y: Number(y),
      z: Number(z),
      rotationY: Number(rotationY)
    };
    
    // Send to server
    this.room.send('move', position);
  }
  
  /**
   * Send projectile data to the server
   * @param {Object} projectileData - Projectile data
   */
  sendProjectile(projectileData) {
    if (!this.room) return;
    
    this.room.send('projectile', projectileData);
  }
  
  /**
   * Send damage event to the server
   * @param {string} targetId - Target player's session ID
   * @param {number} amount - Amount of damage
   */
  sendDamage(targetId, amount) {
    if (!this.room) return;
    
    this.room.send('damage', { targetId, amount });
  }
  
  /**
   * Send player state to the server
   * @param {string} state - Player state ('idle', 'walking', 'jumping')
   */
  sendPlayerState(state) {
    if (!this.room) return;
    
    this.room.send('playerState', { state });
  }
  
  /**
   * Send equip item event to the server
   * @param {string} itemId - ID of the item to equip
   */
  sendEquipItem(itemId) {
    if (!this.room) return;
    
    this.room.send('equip', { itemId });
  }
  
  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.room) {
      try {
        this.room.leave();
      } catch (error) {
        console.error('Error leaving room:', error);
      }
      this.room = null;
    }
    
    if (this.client) {
      this.client = null;
    }
    
    this.remotePlayers = {};
    this.emit('disconnected');
  }
} 