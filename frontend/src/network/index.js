import { NetworkManager } from './NetworkManager.js';

/**
 * Initialize multiplayer functionality in the existing game.
 * 
 * @param {Object} scene - The Three.js scene
 * @param {Object} player - The local player object
 * @returns {NetworkManager} The network manager instance
 */
export function initializeMultiplayer(scene, player) {
  const networkManager = new NetworkManager(scene, player);
  
  // Generate a random player name for testing
  const playerName = `Player_${Math.floor(Math.random() * 1000)}`;
  
  // Initialize with the local player information
  networkManager.initialize(playerName, 'character-1')
    .then(() => {
      console.log('Multiplayer initialized successfully');
    })
    .catch(error => {
      console.error('Failed to initialize multiplayer:', error);
    });
  
  // Return the network manager for further use
  return networkManager;
}

/**
 * Add this to your game update loop to handle network updates.
 * 
 * Example usage:
 * // In your game loop
 * function update(delta) {
 *   // Update your game logic
 *   ...
 *   
 *   // Update network
 *   if (networkManager) {
 *     networkManager.update(delta);
 *   }
 * }
 */ 