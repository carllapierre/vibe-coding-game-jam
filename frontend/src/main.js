import * as THREE from 'three';
import { WorldManager } from './world/WorldManager.js';
import { Character } from './character/Character.js';
import { FoodProjectile } from './projectiles/FoodProjectile.js';
import { Inventory } from './inventory/Inventory.js';
import { Hotbar } from './ui/Hotbar.js';
import { SpawnableRegistry } from './registries/SpawnableRegistry.js';
import { ItemRegistry } from './registries/ItemRegistry.js';
import { assetPath } from './utils/pathHelper.js';
import { WorldEditor } from './world/WorldEditor.js';
import { addInventory } from './spawners/collect-functions/addInventory.js';
import { PostProcessingComposer } from './composers/PostProcessingComposer.js';
import { spawner as spawnerConfig } from './config.js';

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



// 3. Initialize world manager (which now doesn't register items again)
const worldManager = new WorldManager(scene);
let collidableObjects = [];

// Initialize character
const character = new Character(scene, camera, collidableObjects, ItemRegistry);

// Create debug manager
const worldEditor = new WorldEditor(scene, camera, renderer, character);
worldEditor.setWorldManager(worldManager);

// Connect inventory to character
character.inventory = inventory;
inventory.onSelectionChange = (selectedIndex, selectedItem) => {
    character.currentFoodIndex = selectedIndex;
    character.currentItem = selectedItem;  // This is the food item from the inventory
    character.updatePreviewModel();
};

// Load the world after all registries are initialized
async function initializeWorld() {
    // Load all objects from the world
    await worldManager.loadObjects();
    collidableObjects = worldManager.getCollidableObjects();
    
    // Update character's collidable objects reference
    character.collidableObjects = collidableObjects;
    
    // Update FoodProjectile's static collidable objects
    FoodProjectile.updateCollidableObjects(collidableObjects);
    
    // Initialize spawners after objects are loaded
    await worldManager.initializeSpawners(character);
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

    if (worldEditor.isDebugMode) {
        // Editor view - hide character view
        characterViewContainer.style.display = 'none';
        worldEditor.update();
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