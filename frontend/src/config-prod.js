/**
 * Production configuration file for game settings
 */

// API configuration - static deployment mode
export const api = {
    // Empty host for production (static deployment)
    host: '',
    environment: 'production'
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
    }
}; 