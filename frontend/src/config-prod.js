/**
 * Production configuration file for game settings
 */

// API configuration - static deployment mode
export const api = {
    // Empty host for production (static deployment)
    host: '',
    environment: 'production',
    multiplayerHost: 'wss://food-vibers.onrender.com' 
};

// Inventory settings
export const inventory = {
    stackLimit: 32,     // Maximum number of items in a stack
};

export const character = {
    states: {
        hit: {
            duration: 0.2, // Duration in seconds for hit state
            animationSpeed: 2.2 // Speed multiplier for hit animation
        },
        death: {
            respawnTime: 5, // Respawn time in seconds
            defaultRespawnPosition: { x: 0, y: 2, z: 0 } // Default respawn position
        }
    }
};

export const spawner = {
    colors: {
        boost: 0x00ff00, //green
        debuff: 0xff0000, //red
        misc: 0x0000ff, //blue
        rare: 0xffff00, //yellow
    }
}; 