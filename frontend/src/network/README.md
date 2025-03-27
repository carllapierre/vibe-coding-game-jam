# Multiplayer Integration Guide

This guide explains how to integrate the multiplayer functionality into your existing game.

## Prerequisites

1. Make sure the Colyseus server is running at `localhost:2567`
2. The `colyseus.js` library is installed:
   ```
   npm install colyseus.js
   ```

## Simple Integration Steps

### 1. Import the necessary module

In your main game file (where you have access to your scene and player):

```javascript
import { initializeMultiplayer } from './network/index.js';
```

### 2. Initialize multiplayer when your game is ready

After your game scene and player are set up:

```javascript
// Your existing code to set up the scene and player
const scene = /* your Three.js scene */;
const player = /* your player object */;

// Initialize multiplayer
const networkManager = initializeMultiplayer(scene, player);

// Store the networkManager for cleanup later
this.networkManager = networkManager;
```

### 3. Update the network in your game loop

Add the network update to your existing game loop:

```javascript
// Your game update function
update(delta) {
  // Existing game update code
  // ...
  
  // Update network
  if (this.networkManager) {
    this.networkManager.update(delta);
  }
}
```

### 4. Clean up when the game is disposed

Add cleanup code when your game ends:

```javascript
dispose() {
  // Existing dispose code
  // ...
  
  // Clean up network
  if (this.networkManager) {
    this.networkManager.dispose();
    this.networkManager = null;
  }
}
```

## Testing

To test the multiplayer functionality:

1. Start the Colyseus server:
   ```
   cd multiplayer-server
   npm start
   ```

2. Open two browser tabs with your game
3. You should see players represented in both tabs
4. When you move in one tab, the player should move in the other tab

## Customization

You can customize the player representation by modifying the `NetworkedPlayer.js` file.

For server-side logic like combat, modify the `multiplayer-server/src/rooms/LobbyRoom.ts` file. 