/**
 * Global configuration file for game settings
 */

// API configuration
export const api = {
    host: process.env.API_HOST || 'http://localhost:5000',
    environment: process.env.ENVIRONMENT || 'development'
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
