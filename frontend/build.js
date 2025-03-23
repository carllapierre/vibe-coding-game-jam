const fs = require('fs');
const path = require('path');

console.log('Starting build process...');

// Source and destination paths for the world.json file
const sourceFile = path.join(__dirname, '..', 'backend', 'data', 'world.json');
const srcDataFile = path.join(__dirname, 'src', 'data', 'world.json');
const publicFile = path.join(__dirname, 'public', 'world.json');
const assetsDir = path.join(__dirname, 'public', 'assets');
const assetsFile = path.join(assetsDir, 'world.json');

console.log('Checking if source file exists:', sourceFile);
if (!fs.existsSync(sourceFile)) {
  console.error(`ERROR: Source file does not exist: ${sourceFile}`);
  process.exit(1);
}

// Ensure the source data directory exists
const srcDataDir = path.dirname(srcDataFile);
if (!fs.existsSync(srcDataDir)) {
  console.log(`Creating directory: ${srcDataDir}`);
  fs.mkdirSync(srcDataDir, { recursive: true });
}

// Ensure the public directory exists
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  console.log(`Creating directory: ${publicDir}`);
  fs.mkdirSync(publicDir, { recursive: true });
}

// Ensure the assets directory exists
if (!fs.existsSync(assetsDir)) {
  console.log(`Creating directory: ${assetsDir}`);
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Copy the world.json file to src/data for development
try {
  fs.copyFileSync(sourceFile, srcDataFile);
  console.log(`Successfully copied world.json to src/data for development: ${srcDataFile}`);
} catch (err) {
  console.error(`Error copying world.json to src/data: ${err.message}`);
  process.exit(1);
}

// Copy the world.json file to public for production build
try {
  fs.copyFileSync(sourceFile, publicFile);
  console.log(`Successfully copied world.json to public for production build: ${publicFile}`);
  
  // Verify the file is there
  if (fs.existsSync(publicFile)) {
    const stats = fs.statSync(publicFile);
    console.log(`Verified: ${publicFile} exists (${stats.size} bytes)`);
  } else {
    console.error(`ERROR: File not found after copy: ${publicFile}`);
  }
} catch (err) {
  console.error(`Error copying world.json to public: ${err.message}`);
  process.exit(1);
}

// Also copy to assets directory
try {
  fs.copyFileSync(sourceFile, assetsFile);
  console.log(`Successfully copied world.json to assets directory: ${assetsFile}`);
} catch (err) {
  console.error(`Error copying world.json to assets: ${err.message}`);
  process.exit(1);
}

// Copy to data directory in public
const dataDir = path.join(publicDir, 'data');
if (!fs.existsSync(dataDir)) {
  console.log(`Creating directory: ${dataDir}`);
  fs.mkdirSync(dataDir, { recursive: true });
}

const dataFile = path.join(dataDir, 'world.json');
try {
  fs.copyFileSync(sourceFile, dataFile);
  console.log(`Successfully copied world.json to data directory: ${dataFile}`);
} catch (err) {
  console.error(`Error copying world.json to data directory: ${err.message}`);
  process.exit(1);
}

// Swap the config files for production build
try {
  const configProdPath = path.join(__dirname, 'src', 'config-prod.js');
  const configPath = path.join(__dirname, 'src', 'config.js');
  
  // Check if config-prod.js exists
  if (!fs.existsSync(configProdPath)) {
    console.error(`ERROR: Production config not found: ${configProdPath}`);
    process.exit(1);
  }
  
  // Copy the production config over the regular config
  fs.copyFileSync(configProdPath, configPath);
  console.log('Switched to production config for the build.');
} catch (err) {
  console.error(`Error swapping config files: ${err.message}`);
  process.exit(1);
}

console.log('Build preparation completed successfully!');

// This script doesn't restore the backup since it runs before the build
// You would need a separate script to run after the build to restore it 