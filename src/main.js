import * as THREE from 'three';
import { WorldManager } from './world/WorldManager.js';
import { Character } from './character/Character.js';
import { FoodProjectile } from './projectiles/FoodProjectile.js';

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

// Initialize world manager
const worldManager = new WorldManager(scene);
let collidableObjects = [];

// Initialize character (we'll update its collidable objects after world loads)
const character = new Character(scene, camera, collidableObjects);

// Load the world
worldManager.loadWalls().then(() => {
    collidableObjects = worldManager.getCollidableObjects();
    // Update character's collidable objects reference
    character.collidableObjects = collidableObjects;
    // Update FoodProjectile's static collidable objects
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

    // Update character
    character.update();

    // Update all projectiles
    FoodProjectile.updateAll();

    renderer.render(scene, camera);
}

animate(); 