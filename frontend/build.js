const fs = require('fs');
const path = require('path');

// Source and destination paths
const sourceFile = path.join(__dirname, '..', 'backend', 'data', 'world.json');
const destFile = path.join(__dirname, 'src', 'data', 'world.json');

// Ensure the destination directory exists
const destDir = path.dirname(destFile);
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy the file
try {
  fs.copyFileSync(sourceFile, destFile);
  console.log(`Successfully copied world.json from backend to frontend.`);
} catch (err) {
  console.error(`Error copying file: ${err.message}`);
  process.exit(1);
} 