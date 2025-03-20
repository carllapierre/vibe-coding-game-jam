import * as THREE from 'three';
import { WorldManager } from './world/WorldManager.js';
import { Character } from './character/Character.js';
import { FoodProjectile } from './projectiles/FoodProjectile.js';
import { Inventory } from './inventory/Inventory.js';
import { Hotbar } from './ui/Hotbar.js';
import { SpawnableRegistry } from './spawners/SpawnableRegistry.js';
import { ItemRegistry } from './spawners/ItemRegistry.js';
import { FoodRegistry } from './food/FoodRegistry.js';
import { assetPath } from './utils/pathHelper.js';
// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

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

// Camera setup
camera.position.y = 2;
camera.position.z = 5;

// Initialize inventory system
const inventory = new Inventory();
const hotbar = new Hotbar(inventory);

// Register food items with ItemRegistry if they don't already exist
FoodRegistry.foodTypes.forEach(food => {
    // Only register if the item doesn't already exist
    if (!ItemRegistry.getItem(food.id)) {
        ItemRegistry.registerItem({
            id: food.id,
            name: food.id.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
            modelPath: assetPath(`objects/${food.model}`), 
            scale: food.scale * 2.0,
            onCollect: (player) => {
                console.log(`Player collected ${food.id}`);
                if (player.inventory) {
                    player.inventory.addItem(food.id);
                }
            }
        });
    }
});

// 2. Then initialize SpawnableRegistry which depends on food registry and items
SpawnableRegistry.initialize();
// 3. Initialize world manager (which now doesn't register items again)
const worldManager = new WorldManager(scene);
let collidableObjects = [];

// Initialize character (we'll update its collidable objects after world loads)
const character = new Character(scene, camera, collidableObjects);

// Connect inventory to character
character.inventory = inventory;
inventory.onSelectionChange = (selectedIndex) => {
    character.currentFoodIndex = selectedIndex;
    character.updatePreviewModel();
};

// Load the world after all registries are initialized
console.log("Loading world...");
async function initializeWorld() {
    // First load walls
    await worldManager.loadWalls();
    collidableObjects = worldManager.getCollidableObjects();
    
    // Update character's collidable objects reference
    character.collidableObjects = collidableObjects;
    
    // Update FoodProjectile's static collidable objects
    FoodProjectile.updateCollidableObjects(collidableObjects);
    
    // Initialize spawners after walls are loaded
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
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    // Update character
    character.update();

    // Update all projectiles
    FoodProjectile.updateAll();

    // Update world (including spawners and check for item collection)
    worldManager.update(character);

    renderer.render(scene, camera);
}

animate(); 