import * as THREE from 'three';
import { WorldManager } from './world/WorldManager.js';
import { Character } from './character/Character.js';
import { FoodProjectile } from './projectiles/FoodProjectile.js';
import { Inventory } from './inventory/Inventory.js';
import { Hotbar } from './ui/Hotbar.js';
import { SpawnableRegistry } from './spawners/SpawnableRegistry.js';
import { ItemRegistry } from './registries/ItemRegistry.js';
import { assetPath } from './utils/pathHelper.js';
import { DebugManager } from './debug/DebugManager.js';
import { addInventory } from './spawners/collect-functions/addInventory.js';
import { PostProcessingComposer } from './composers/PostProcessingComposer.js';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Initialize post-processing
const postProcessing = new PostProcessingComposer(renderer, scene, camera, {
    brightness: 4.5,  // Increase brightness (1.0 is normal)
    saturation: 1.1,  // Keep the default saturation
    bloomStrength: 0.6,
    bloomRadius: 0.8,
    bloomThreshold: 0.2
});

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(0, 10, 0);
scene.add(directionalLight);

// Ground
const groundGeometry = new THREE.PlaneGeometry(100, 100);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    side: THREE.DoubleSide
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

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
const hotbar = new Hotbar(inventory, ItemRegistry);

characterViewContainer.appendChild(hotbar.container);

ItemRegistry.forEach(item => {
    item.onCollect = addInventory;
    item.modelPath = assetPath(`objects/${item.model}`);
});

// all items are spawnables for now
SpawnableRegistry.initialize(ItemRegistry.items.map(item => ({
    ...item,
    scale: item.scale * 2.0,
})));

// Some customization for spawnables
SpawnableRegistry.updateSpawnableProperties(['carrot', 'cup-coffee'], {
    glowColor: 0x65e553, //green
    shadowColor: 0x65e553,
    particleColor: 0x65e553,
});


// 3. Initialize world manager (which now doesn't register items again)
const worldManager = new WorldManager(scene);
let collidableObjects = [];

// Initialize character
const character = new Character(scene, camera, collidableObjects, ItemRegistry);

// Create debug manager
const debugManager = new DebugManager(scene, camera, renderer, character);
debugManager.setWorldManager(worldManager);

// Connect inventory to character
character.inventory = inventory;
inventory.onSelectionChange = (selectedIndex, selectedItem) => {
    character.currentFoodIndex = selectedIndex;
    character.currentItem = selectedItem;  // This is the food item from the inventory
    character.updatePreviewModel();
};

// Load the world after all registries are initialized
console.log("Loading world...");
async function initializeWorld() {
    // Load all objects from the world
    await worldManager.loadObjects();
    collidableObjects = worldManager.getCollidableObjects();
    
    // Update character's collidable objects reference
    character.collidableObjects = collidableObjects;
    
    // Update FoodProjectile's static collidable objects
    FoodProjectile.updateCollidableObjects(collidableObjects);
    
    // Initialize spawners after objects are loaded
    await worldManager.initializeSpawners();
    
    console.log("World loaded successfully");
}

initializeWorld().catch(error => {
    console.error("Error initializing world:", error);
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    postProcessing.resize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (debugManager.isDebugMode) {
        // Editor view - hide character view
        characterViewContainer.style.display = 'none';
        debugManager.update();
    } else {
        // Character view - show character view
        characterViewContainer.style.display = 'block';
        character.update();
    }

    // Update all projectiles
    FoodProjectile.updateAll();

    // Update world (including spawners and check for item collection)
    worldManager.update(character, camera);

    // Render with post-processing effects
    postProcessing.render();
}

animate(); 