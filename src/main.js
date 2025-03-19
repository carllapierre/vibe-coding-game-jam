import * as THREE from 'three';
import { WorldManager } from './world/WorldManager.js';
import { Character } from './character/Character.js';
import { FoodProjectile } from './projectiles/FoodProjectile.js';
import { Inventory } from './inventory/Inventory.js';
import { Hotbar } from './ui/Hotbar.js';
import { DebugManager } from './debug/DebugManager.js';

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
const hotbar = new Hotbar(inventory);
characterViewContainer.appendChild(hotbar.container);

// Initialize world manager
const worldManager = new WorldManager(scene);
let collidableObjects = [];

// Initialize character
const character = new Character(scene, camera, collidableObjects);

// Initialize debug manager
const debugManager = new DebugManager(scene, camera, renderer, character);

// Connect inventory to character
character.inventory = inventory;
inventory.onSelectionChange = (selectedIndex) => {
    character.currentFoodIndex = selectedIndex;
    character.updatePreviewModel();
};

// Load the world
worldManager.loadWalls().then(() => {
    collidableObjects = worldManager.getCollidableObjects();
    character.collidableObjects = collidableObjects;
    FoodProjectile.updateCollidableObjects(collidableObjects);
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

    renderer.render(scene, camera);
}

animate(); 