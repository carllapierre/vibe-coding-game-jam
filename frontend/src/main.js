import * as THREE from 'three';
import { WorldManager } from './world/WorldManager.js';
import { Character } from './character/Character.js';
import { FoodProjectile } from './projectiles/FoodProjectile.js';
import { Inventory } from './inventory/Inventory.js';
import { Hotbar } from './ui/Hotbar.js';
import { HealthBar } from './ui/HealthBar.js';
import { SpawnableRegistry } from './registries/SpawnableRegistry.js';
import { ItemRegistry } from './registries/ItemRegistry.js';
import { assetPath } from './utils/pathHelper.js';
import { EditorCore } from './world/editor/EditorCore.js';
import { addInventory } from './spawners/collect-functions/addInventory.js';
import { consumeItem } from './spawners/collect-functions/consumeItem.js';
import { PostProcessingComposer } from './composers/PostProcessingComposer.js';
import { spawner as spawnerConfig } from './config.js';
import { NetworkManager } from './network/NetworkManager.js';
import { initWebGLTracker, logWebGLInfo, getActiveContextCount } from './utils/WebGLTracker.js';
import sharedRenderer from './utils/SharedRenderer.js';
import { initializeFromUrlParams, getUsername } from './utils/urlParams.js';
import { HitMarker } from './projectiles/HitMarker.js';
import { AudioManager } from './audio/AudioManager.js';
import { RadioPlayer } from './audio/RadioPlayer.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import assetManager from './utils/AssetManager.js';

// Enable THREE.Cache for efficient asset loading
// This will prevent duplicate loading of the same resources
THREE.Cache.enabled = true;
console.log('THREE.Cache enabled:', THREE.Cache.enabled);

// Create loading screen
const loadingScreen = new LoadingScreen();

// Initialize WebGL tracking
initWebGLTracker();

// Initialize URL parameters to get username
initializeFromUrlParams();

// Add keyboard listener for audio controls
document.addEventListener('keydown', (event) => {
    // Helper function to show mute/unmute notification
    const showMuteNotification = (type, isMuted) => {
        const muteStatus = document.createElement('div');
        muteStatus.textContent = `${type} ${isMuted ? 'Muted' : 'Unmuted'}`;
        muteStatus.style.position = 'fixed';
        muteStatus.style.top = '50%';
        muteStatus.style.left = '50%';
        muteStatus.style.transform = 'translate(-50%, -50%)';
        muteStatus.style.background = 'rgba(0, 0, 0, 0.7)';
        muteStatus.style.color = 'white';
        muteStatus.style.padding = '15px 20px';
        muteStatus.style.borderRadius = '8px';
        muteStatus.style.fontFamily = 'system-ui, sans-serif';
        muteStatus.style.fontSize = '18px';
        muteStatus.style.zIndex = '10001';
        
        document.body.appendChild(muteStatus);
        
        // Remove the status message after a short delay
        setTimeout(() => {
            document.body.removeChild(muteStatus);
        }, 1500);
    };

    // Toggle music mute with 'M' key
    if (event.key.toLowerCase() === 'm') {
        const newMutedState = !RadioPlayer.isMuted();
        RadioPlayer.setMuted(newMutedState);
        showMuteNotification('Music', newMutedState);
    }
    
    // Toggle SFX mute with 'N' key
    if (event.key.toLowerCase() === 'n') {
        const newMutedState = !AudioManager.isMuted();
        AudioManager.setMuted(newMutedState);
        showMuteNotification('Sound Effects', newMutedState);
    }
});

// Add this global variable to track multiple tabs
const MULTIPLAYER_TAB_ID = `tab_${Math.random().toString(36).substring(2, 15)}`;

// Flag to enable/disable multiplayer (default to disabled to prevent WebGL context issues)
const ENABLE_MULTIPLAYER = true; // Set to true only when testing multiplayer specifically

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

// Add skybox to the scene
function createSkybox() {
    // Try loading texture-based skybox
    try {
        const skyboxPaths = [
            'right.jpg', 'left.jpg',
            'top.jpg', 'bottom.jpg',
            'front.jpg', 'back.jpg'
        ];
        
        // Use AssetManager to load the skybox with caching
        assetManager.cubeTextureLoader.setPath(assetPath('skybox/'));
        const skyboxTexture = assetManager.loadCubeTexture(
            skyboxPaths,
            // Success callback
            (texture) => {
                scene.background = texture;
            },
            // Progress callback
            undefined,
            // Error callback - fallback to color skybox
            (err) => {
                console.warn('Failed to load skybox textures, using color skybox instead:', err);
                createColorSkybox();
            }
        );
    } catch (error) {
        console.warn('Error creating texture skybox, falling back to color skybox:', error);
        createColorSkybox();
    }
}

// Create a simple color gradient skybox as fallback
function createColorSkybox() {
    // Set a nice sky blue color as background
    scene.background = new THREE.Color(0xe3b152);
}

// Make camera globally accessible for hit markers
window.camera = camera;

// Set initial camera position and rotation before creating controls
// Position it at a higher y value and with some z offset to ensure it's facing the right direction
camera.position.set(3, 3, 8);  // Start at z=10 looking toward negative z
camera.lookAt(0, 3.5, 0);  // Look toward the origin at the same height

// Use the shared renderer service instead of creating a new one
const renderer = sharedRenderer.getMainRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Detect any Three.js errors
window.addEventListener('error', function(event) {
  console.error('Global error caught:', event.error || event.message);
  
  // Check if it's a THREE.js related error
  if (event.error && (
    event.error.toString().includes('THREE') ||
    event.error.stack && event.error.stack.includes('three.module.js')
  )) {
    console.error('THREE.js error detected:', event.error);
  }
});

// Track tab visibility state
let documentHidden = false;
let animationFrameId = null;
let lastFrameTime = null;

// Add page visibility change handler
document.addEventListener('visibilitychange', function() {
  documentHidden = document.hidden;
  
  if (!documentHidden && !animationFrameId) {
    animationFrameId = requestAnimationFrame(animate);
  }
});

// Initialize post-processing
const postProcessing = new PostProcessingComposer(renderer, scene, camera, {
    brightness: 4.5,  // Increase brightness (1.0 is normal)
    saturation: 1.1,  // Keep the default saturation
    bloomStrength: 0.35,
    bloomRadius: 0.4,
    bloomThreshold: 0.2
});

// Disable context menu on right-click to enable right-click for consuming items
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
}, false);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 10, 0);
scene.add(directionalLight);

// Create views containers
const characterViewContainer = document.createElement('div');
characterViewContainer.id = 'character-view';
document.body.appendChild(characterViewContainer);

// Move UI elements into character view
const crosshair = document.createElement('div');
crosshair.id = 'crosshair';
crosshair.textContent = '+';
characterViewContainer.appendChild(crosshair);

// Initialize inventory system
const inventory = new Inventory();
let collidableObjects = [];
// Initialize character
const character = new Character(scene, camera, collidableObjects, ItemRegistry);

// NOW initialize Hotbar, since character and its effectsManager exist
const hotbar = new Hotbar(inventory, ItemRegistry, character.effectsManager);
characterViewContainer.appendChild(hotbar.container);

// Setup item properties and functions
ItemRegistry.forEach(item => {
    // Default actions
    item.onCollect = addInventory;
    item.modelPath = assetPath(`objects/${item.model}`);
    
    // Set consumable property (default: true, except for non-food items)
    if (item.isConsumable === undefined) {
        item.isConsumable = true;
    }
    
    // Set up default right-click handler for consumable items
    if (item.isConsumable !== false && !item.onRightClick) {
        item.onRightClick = consumeItem;
    }
});

// convert all items to spawnables
SpawnableRegistry.initialize(ItemRegistry.items.map(item => ({
    ...item,
    scale: item.scale * 2.0,
    quantityMin: 1,
    quantityMax: 5, 
})));

// Some customization for spawnables
SpawnableRegistry.updateSpawnableProperties(['carrot', 'cup-coffee'], {
    quantityMin: 1,  // Only 1 for boost items
    quantityMax: 1,
    glowColor: spawnerConfig.colors.boost, //green
    shadowColor: spawnerConfig.colors.boost,
    particleColor: spawnerConfig.colors.boost,
});


SpawnableRegistry.updateSpawnableProperties(['wine-white', 'wine-red', 'peanut-butter', 'honey'], {
    glowColor: spawnerConfig.colors.debuff, //red
    shadowColor: spawnerConfig.colors.debuff,
    particleColor: spawnerConfig.colors.debuff,
});


SpawnableRegistry.updateSpawnableProperties(['cake', 'beer-barrel'], {
    glowColor: spawnerConfig.colors.rare, //purple
    shadowColor: spawnerConfig.colors.rare,
    particleColor: spawnerConfig.colors.rare,
});

SpawnableRegistry.updateSpawnableProperties(['beer-barrel'], {
    quantityMin: 1, 
    quantityMax: 1,
});


// 3. Initialize world manager (which now doesn't register items again)
const worldManager = new WorldManager(scene);


// Create debug manager
const worldEditor = new EditorCore(scene, camera, renderer, character);
worldEditor.setWorldManager(worldManager);

// Initialize health bar and add to character view
const healthBar = new HealthBar(character);
characterViewContainer.appendChild(healthBar.container);

// Connect inventory to character
character.inventory = inventory;
inventory.onSelectionChange = (selectedIndex, selectedItem) => {
    character.currentFoodIndex = selectedIndex;
    character.currentItem = selectedItem;  // This is the food item from the inventory
    character.updatePreviewModel();
};

// Reference to store the network manager
let networkManager = null;

// Call this from the initializeMultiplayer function
async function initializeMultiplayer(character) {
  try {
    
    if (!ENABLE_MULTIPLAYER) {
      return;
    }
    
    if (!networkManager) {
      networkManager = new NetworkManager(scene, character);
      
      // Use the username from URL params or generate a random one
      const playerName = getUsername() || `Player-${Math.floor(Math.random() * 10000)}`;
      
      await networkManager.initialize(playerName, 'character-1');
      
      // The server now supports projectiles, so no warning needed
    }
  } catch (error) {
    console.error('Failed to initialize multiplayer:', error);
  }
}

// Load the world after all registries are initialized
async function initializeWorld() {
    try {
        // Show loading screen
        loadingScreen.show();
        loadingScreen.updateProgress(5);
        
        // Create skybox
        await new Promise(resolve => {
            setTimeout(() => {
                createSkybox();
                loadingScreen.updateProgress(15);
                resolve();
            }, 100);
        });
        
        // Load all objects from the world
        loadingScreen.updateProgress(20);
        await worldManager.loadObjects();
        loadingScreen.updateProgress(50);
        
        collidableObjects = worldManager.getCollidableObjects();
        // Update character's collidable objects reference
        character.collidableObjects = collidableObjects;
        // Update FoodProjectile's static collidable objects
        FoodProjectile.updateCollidableObjects(collidableObjects);
        
        loadingScreen.updateProgress(60);
        
        // Initialize spawners after objects are loaded
        await worldManager.initializeSpawners(character);
        loadingScreen.updateProgress(75);
        
        // Load posters
        await worldManager.loadPosters();
        loadingScreen.updateProgress(90);
        
        // Initialize the radio player
        RadioPlayer.initialize();
        // Set initial volumes
        RadioPlayer.setVolume(0.25); // Start at low volume for background music
        AudioManager.setSfxVolume(0.25); // Start at 70% volume for sound effects
        
        loadingScreen.updateProgress(95);
        
        // Initialize multiplayer only if enabled
        if (ENABLE_MULTIPLAYER) {
            try {
                await initializeMultiplayer(character);
            } catch (error) {
                console.error('Failed to initialize multiplayer:', error);
                console.warn('Continuing in single-player mode due to multiplayer error');
            }
        } 
        
        loadingScreen.updateProgress(100);
        
        // Give a brief moment to see 100% before hiding
        setTimeout(() => {
            // Hide loading screen
            loadingScreen.hide();
            
            // Start animation loop after world and multiplayer are initialized
            animationFrameId = requestAnimationFrame(animate);
        }, 500);
    } catch (error) {
        console.error("Error initializing world:", error);
        // Hide loading screen in case of error
        loadingScreen.hide();
        
        // Show error to user
        const errorOverlay = document.createElement('div');
        errorOverlay.style.position = 'fixed';
        errorOverlay.style.top = '10px';
        errorOverlay.style.left = '10px';
        errorOverlay.style.backgroundColor = 'rgba(200, 0, 0, 0.8)';
        errorOverlay.style.color = 'white';
        errorOverlay.style.padding = '10px';
        errorOverlay.style.zIndex = '10000';
        errorOverlay.textContent = 'Error loading world: ' + error.message + '. Please refresh.';
        document.body.appendChild(errorOverlay);
    }
}

// Animation loop with better error handling and frame rate capping
const frameRateTarget = 60; // Target 60 FPS
const frameTimeTarget = 1000 / frameRateTarget; // Target frame time in ms

function animate() {
    try {
        if (!documentHidden) {
            // Always request next frame immediately to avoid sluggishness
            animationFrameId = requestAnimationFrame(animate);
            
            // Calculate current time
            const now = performance.now();
            
            // Calculate delta time with rate limiting for consistency
            // but don't delay frames which would cause sluggishness
            const rawDelta = now - (lastFrameTime || now - frameTimeTarget);
            
            // Only process a new frame if enough time has elapsed or if it's the first frame
            if (!lastFrameTime || rawDelta >= 8) { // Allow up to ~120 FPS for smoother experience
                frameStep(now);
            }
        } else {
            animationFrameId = null;
            return; // Don't continue rendering when hidden
        }
    } catch (error) {
        console.error('Error in animation loop:', error);
        cancelAnimationFrame(animationFrameId);
        
        // Show error to user
        const errorOverlay = document.createElement('div');
        errorOverlay.style.position = 'fixed';
        errorOverlay.style.top = '10px';
        errorOverlay.style.left = '10px';
        errorOverlay.style.backgroundColor = 'rgba(200, 0, 0, 0.8)';
        errorOverlay.style.color = 'white';
        errorOverlay.style.padding = '10px';
        errorOverlay.style.zIndex = '10000';
        errorOverlay.textContent = 'Error in game loop: ' + error.message + '. Please refresh.';
        document.body.appendChild(errorOverlay);
    }
}

// The actual frame update logic, separated from the timing control
function frameStep(currentTime) {
    // Calculate delta time for smooth animation
    const deltaTime = Math.min(0.1, (currentTime - (lastFrameTime || currentTime)) / 1000);
    lastFrameTime = currentTime;

    if (worldEditor.isDebugMode) {
        // Editor view - hide character view
        characterViewContainer.style.display = 'none';
        worldEditor.update();
    } else {
        // Character view - show character view
        characterViewContainer.style.display = 'block';
        character.update(deltaTime);
        
        // Update network
        if (networkManager && networkManager.isConnected) {
            networkManager.update(deltaTime);
        }
    }

    // Get all networked players and add them as collidable objects for projectiles
    if (networkManager && networkManager.isConnected && networkManager.playerManager) {
        const playerCollidables = [];
        
        // Process each networked player
        networkManager.playerManager.players.forEach(player => {
            if (player.model && player.boxMesh) {
                // Create a THREE.Box3 from the player's bounding box for quick collision tests
                const box = new THREE.Box3().setFromObject(player.boxMesh);
                
                // Get all meshes from the player model for precise collision
                const meshes = [];
                player.model.traverse(child => {
                    if (child.isMesh) {
                        meshes.push(child);
                    }
                });
                
                // Only add as collidable if we have meshes
                if (meshes.length > 0) {
                    playerCollidables.push({ 
                        box, 
                        meshes,
                        type: 'player',
                        player // Reference to the player for potential hit handling
                    });
                }
            }
        });
        
        // Add the local character to the collidable list
        if (character && character.boxMesh) {
            const characterCollisionBox = character.getCollisionBox();
            // Don't add local character if we're viewing through editor
            if (!worldEditor.isDebugMode) {
                playerCollidables.push(characterCollisionBox);
            }
        }
        
        // Combine world collidable objects with player collidables
        const allCollidables = [...collidableObjects, ...playerCollidables];
        
        // Update the FoodProjectile collidable objects
        FoodProjectile.updateCollidableObjects(allCollidables);
    }

    // Update all projectiles
    FoodProjectile.updateAll();
    
    // Update all hit marker effects
    HitMarker.update();

    // Update world (including spawners and check for item collection)
    worldManager.update(character, camera);

    // Update UI elements that need per-frame updates
    hotbar.update();

    // Render with post-processing effects
    postProcessing.render();
}

// Show loading screen immediately
loadingScreen.show();
loadingScreen.updateProgress(2);

// Start initialization after a small delay to ensure loading screen is visible
setTimeout(() => {
    initializeWorld().catch(error => {
        console.error("Error in initializeWorld:", error);
        loadingScreen.hide();
    });
}, 100);

// Add cleanup on window unload
window.addEventListener('beforeunload', () => {
    if (networkManager) {
        networkManager.dispose();
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    postProcessing.resize(window.innerWidth, window.innerHeight);
}); 