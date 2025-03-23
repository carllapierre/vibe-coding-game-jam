/**
 * Global configuration file for game settings
 */

// In production builds, ENVIRONMENT will be replaced by Vite with 'production'
// We use this approach to avoid any reference to process
const ENVIRONMENT = '__ENVIRONMENT__';
const isProduction = ENVIRONMENT === 'production';

// API configuration
export const api = {
    // Use localhost for development, but for production we'll load data locally
    host: isProduction ? '' : 'http://localhost:5000',
    environment: ENVIRONMENT || 'development'
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
