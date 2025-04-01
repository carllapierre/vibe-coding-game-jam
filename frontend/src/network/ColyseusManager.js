import { Client } from 'colyseus.js';
import { EventEmitter } from '../utils/EventEmitter.js';
import { api } from '../config.js';

// Constants
const COLYSEUS_SERVER_URL = api.multiplayerHost;

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
  
  /** @type {boolean} */
  _hasSetupPlayerHandlers = false;
  
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
        // Create a set of current players to track removed ones
        const currentPlayers = new Set();
        
        // Handle existing players
        state.players.forEach((player, sessionId) => {
          currentPlayers.add(sessionId);
          
          // Skip if it's the local player
          if (sessionId === this.room.sessionId) {
            this.emit('currentPlayer', player);
            return;
          }
          
          // Add to remote players and emit join event
          if (!this.remotePlayers[sessionId]) {
            this.remotePlayers[sessionId] = player;
            this.emit('playerJoined', { sessionId, player });
            this.setupPlayerListeners(player, sessionId);
          }
        });
        
        // Check for players that have been removed from state but still in remotePlayers
        Object.keys(this.remotePlayers).forEach(sessionId => {
          if (!currentPlayers.has(sessionId) && sessionId !== this.room.sessionId) {
            this.emit('playerLeft', { sessionId, player: this.remotePlayers[sessionId] });
            delete this.remotePlayers[sessionId];
          }
        });
        
        // Listen for changes in the players collection
        // Only set this up once to avoid duplicate handlers
        if (!this._hasSetupPlayerHandlers) {
          this._hasSetupPlayerHandlers = true;
          
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
      }
    });

    // Listen for room errors
    this.room.onError((code, message) => {
      console.error('Room error:', code, message);
      this.emit('error', new Error(`Room error: ${message}`));
    });

    // Listen for room leave
    this.room.onLeave((code) => {
      this.emit('disconnected');
      
      // Try to reconnect if unexpected disconnect
      if (code >= 1000 && code < 1003) {
        // Normal closure, don't reconnect
        console.log('Normal disconnection, not attempting reconnect');
      } else {
        console.log('Unexpected disconnection, attempting reconnect...');
        // Try to reconnect after a short delay
        setTimeout(() => {
          this.reconnect();
        }, 2000);
      }
    });
    
    // Set up message handlers for custom events
    this.setupMessageHandlers();
  }
  
  /**
   * Attempt to reconnect to the server
   */
  async reconnect() {
    try {
      
      // Only attempt to reconnect if we're not already connected
      if (this.room) {
        console.log('Already connected, skipping reconnect');
        return;
      }
      
      // Connect with the same parameters as before
      const result = await this.connect('Player', 'character-1');
      
      if (result) {
        console.log('Successfully reconnected to server');
      }
    } catch (error) {
      console.error('Failed to reconnect:', error);
      
      // Try again after a delay
      setTimeout(() => {
        this.reconnect();
      }, 5000);
    }
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
      console.log(`Received projectile from server, source: ${data.playerId}`);
      this.emit('projectileCreated', {
        ...data,
        playerId: data.playerId // Ensure playerId is passed
      });
    });
    
    // Listen for damage events
    this.room.onMessage('damage', (data) => {
      console.log(`Received damage event from server: target=${data.targetId}, source=${data.sourceId}, amount=${data.amount}`);
      this.emit('playerDamaged', data);
    });
    
    // Listen for player respawn events
    this.room.onMessage('playerRespawned', (data) => {
      console.log(`Received player respawn event: ${data.playerId}`);
      this.emit('playerRespawned', data);
    });
    
    // Listen for player damaged events
    this.room.onMessage('playerDamaged', (data) => {
      console.log(`Received playerDamaged event: target=${data.targetId}, source=${data.sourceId}, damage=${data.damage}`);
      this.emit('playerDamaged', data);
    });
    
    // Listen for player hit events (direct hit reports)
    this.room.onMessage('playerHit', (data) => {
      console.log(`Received playerHit event: target=${data.targetId}, source=${data.sourceId}, damage=${data.damage}`);
      this.emit('playerHit', data);
    });
    
    // Listen for leaderboard updates
    this.room.onMessage('leaderboardUpdate', (data) => {
      console.log(`Received leaderboard update`);
      this.emit('leaderboardUpdate', data);
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
    let lastEmitTime = Date.now();
    
    // Debugger - log player properties
    console.log(`Setting up listeners for player ${sessionId}`, {
      hasListen: typeof player.listen === 'function',
      properties: Object.keys(player)
    });
    
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
        
        // Debug log position changes
        console.log(`Player ${sessionId} position update:`, {
          position: `(${player.x.toFixed(2)}, ${player.y.toFixed(2)}, ${player.z.toFixed(2)})`,
          rotation: player.rotationY.toFixed(2),
          elapsedMs: Date.now() - lastEmitTime
        });
        
        lastEmitTime = Date.now();
        
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
          if (Math.abs(newValue - previousValue) > 0.001) {
            // Mark as changed
            positionChanged = true;
            
            // Debounce updates to avoid too many events
            // But not too long to ensure smoothness
            if (!changeTimeout) {
              changeTimeout = setTimeout(emitChanges, 16); // ~60fps rate
            }
          }
        });
      });
      
      // Listen for player state changes
      player.listen("state", (newValue, previousValue) => {
        if (newValue !== previousValue) {
          console.log(`Player ${sessionId} state changed: ${previousValue} -> ${newValue}`);
          stateChanged = true;
          
          if (!changeTimeout) {
            changeTimeout = setTimeout(emitChanges, 16);
          }
        }
      });
      
      // Handle name changes immediately
      player.listen("name", (newValue, previousValue) => {
        if (newValue !== previousValue) {
          console.log(`Player ${sessionId} name changed: ${previousValue} -> ${newValue}`);
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
      
      // Emit initial state immediately to ensure player appears
      setTimeout(() => {
        const playerState = {
          sessionId,
          name: player.name,
          x: player.x,
          y: player.y,
          z: player.z,
          rotationY: player.rotationY,
          state: player.state
        };
        
        console.log(`Emitting initial state for player ${sessionId}:`, {
          position: `(${player.x.toFixed(2)}, ${player.y.toFixed(2)}, ${player.z.toFixed(2)})`
        });
        
        this.emit('playerChanged', playerState);
      }, 50);
    } else {
      console.warn(`Player ${sessionId} doesn't have listen method. Using polling instead.`);
      
      // Fallback to polling for changes if listen method is not available
      let lastState = {
        x: player.x,
        y: player.y,
        z: player.z,
        rotationY: player.rotationY,
        state: player.state,
        name: player.name
      };
      
      // Poll for changes every 100ms
      const pollInterval = setInterval(() => {
        if (!this.room || !this.remotePlayers[sessionId]) {
          clearInterval(pollInterval);
          return;
        }
        
        const hasPositionChanged = 
          player.x !== lastState.x || 
          player.y !== lastState.y || 
          player.z !== lastState.z ||
          player.rotationY !== lastState.rotationY;
          
        const hasStateChanged = player.state !== lastState.state;
        const hasNameChanged = player.name !== lastState.name;
        
        if (hasPositionChanged || hasStateChanged || hasNameChanged) {
          const playerState = {
            sessionId,
            name: player.name,
            x: player.x,
            y: player.y,
            z: player.z,
            rotationY: player.rotationY,
            state: player.state
          };
          
          this.emit('playerChanged', playerState);
          
          // Update last state
          lastState = { ...playerState };
        }
      }, 100);
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
   * Send a general message to the server
   * @param {string} type - Message type
   * @param {Object} data - Message data
   */
  send(type, data) {
    if (!this.room) {
      console.error(`Cannot send ${type}: not connected to room`);
      return;
    }
    
    try {
      this.room.send(type, data);
    } catch (error) {
      console.error(`Error sending ${type} message:`, error);
    }
  }
  
  /**
   * Disconnect from the Colyseus server and clean up
   */
  disconnect() {
    // Clean up room resources
    if (this.room) {
      // Clear all event listeners from the EventEmitter
      this.removeAllListeners();
      
      // Leave the room
      this.room.leave();
      this.room = null;
    }
    
    // Clear remote players
    this.remotePlayers = {};
    
    // Close the client if it exists
    if (this.client) {
      this.client = null;
    }
    
    console.log('Disconnected from Colyseus server');
  }
} 