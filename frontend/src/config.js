/**
 * Production configuration file for game settings
 */

// API configuration - static deployment mode
export const api = {
    // Empty host for production (static deployment)
    host: 'http://127.0.0.1:5000',
    environment: 'development',
    multiplayerHost: 'ws://127.0.0.1:2567'
    //multiplayerHost: 'wss://food-vibers.onrender.com'
};

// Inventory settings
export const inventory = {
    stackLimit: 32,     // Maximum number of items in a stack
};

export const spawner = {
    colors: {
        boost: 0x00ff00, //green
        debuff: 0xff0000, //red
        misc: 0x0000ff, //blue
        rare: 0xffff00, //yellow
    }
}; 