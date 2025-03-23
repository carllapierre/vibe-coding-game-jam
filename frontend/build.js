const fs = require('fs');
const path = require('path');

// Source and destination paths for the world.json file
const sourceFile = path.join(__dirname, '..', 'backend', 'data', 'world.json');
const srcDataFile = path.join(__dirname, 'src', 'data', 'world.json');
const publicFile = path.join(__dirname, 'public', 'world.json');

// Ensure the source data directory exists
const srcDataDir = path.dirname(srcDataFile);
if (!fs.existsSync(srcDataDir)) {
  fs.mkdirSync(srcDataDir, { recursive: true });
}

// Ensure the public directory exists
const publicDir = path.dirname(publicFile);
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy the world.json file to src/data for development
try {
  fs.copyFileSync(sourceFile, srcDataFile);
  console.log(`Successfully copied world.json to src/data for development.`);
} catch (err) {
  console.error(`Error copying world.json to src/data: ${err.message}`);
  process.exit(1);
}

// Copy the world.json file to public for production build
try {
  fs.copyFileSync(sourceFile, publicFile);
  console.log(`Successfully copied world.json to public for production build.`);
} catch (err) {
  console.error(`Error copying world.json to public: ${err.message}`);
  process.exit(1);
}

// Swap the config files for production build
try {
  const configProdPath = path.join(__dirname, 'src', 'config-prod.js');
  const configPath = path.join(__dirname, 'src', 'config.js');
  
  // Copy the production config over the regular config
  fs.copyFileSync(configProdPath, configPath);
  console.log('Switched to production config for the build.');
} catch (err) {
  console.error(`Error swapping config files: ${err.message}`);
  process.exit(1);
}

// The build process will now use the production environment

// This script doesn't restore the backup since it runs before the build
// You would need a separate script to run after the build to restore it 