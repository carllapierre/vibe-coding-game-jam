const fs = require('fs');
const path = require('path');

// Source and destination paths for the world.json file
const sourceFile = path.join(__dirname, '..', 'backend', 'data', 'world.json');
const destFile = path.join(__dirname, 'src', 'data', 'world.json');

// Ensure the destination directory exists
const destDir = path.dirname(destFile);
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy the world.json file
try {
  fs.copyFileSync(sourceFile, destFile);
  console.log(`Successfully copied world.json from backend to frontend.`);
} catch (err) {
  console.error(`Error copying world.json: ${err.message}`);
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