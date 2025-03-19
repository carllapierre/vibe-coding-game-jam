import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FoodProjectile } from './projectiles/FoodProjectile.js';
import { WorldManager } from './world/WorldManager.js';

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

// Movement variables
const moveSpeed = 0.15;
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    ' ': false, // Space bar for jumping
    h: false    // Toggle hitboxes
};

// Physics variables
const gravity = 0.01;
const jumpForce = 0.25;
let velocity = new THREE.Vector3(0, 0, 0);
let canJump = true;
const playerRadius = 0.5;

// Initialize world manager
const worldManager = new WorldManager(scene);
let collidableObjects = [];


// Initialize controls
const controls = new PointerLockControls(camera, document.body);


// Load the world
worldManager.loadWalls().then(() => {
    collidableObjects = worldManager.getCollidableObjects();
});

// Click to start
document.addEventListener('click', () => {
    controls.lock();
});

// Movement
document.addEventListener('keydown', (event) => {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = true;
    }
    
    // Toggle hitboxes on 'h' key press
    if (event.key === 'h') {
        worldManager.toggleHitboxes();
    }

    // Number keys 1-6 for food selection
    const num = parseInt(event.key);
    if (num >= 1 && num <= foodTypes.length) {
        currentFoodIndex = num - 1;
        updatePreviewModel();
    }
});

document.addEventListener('keyup', (event) => {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = false;
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Collision detection
function checkCollision(nextPosition) {
    const playerSphere = new THREE.Sphere(nextPosition, playerRadius);
    return collidableObjects.some(obj => obj.box.intersectsSphere(playerSphere));
}

// Check if the player is standing on top of an object
function checkStandingOnObject() {
    const raycaster = new THREE.Raycaster();
    const rayOrigin = camera.position.clone();
    const rayDirection = new THREE.Vector3(0, -1, 0);
    raycaster.set(rayOrigin, rayDirection);
    
    const intersects = [];
    collidableObjects.forEach(obj => {
        const intersectResults = raycaster.intersectObject(obj.object, true);
        intersects.push(...intersectResults);
    });
    
    const standingDistance = 2.1;
    return intersects.some(intersect => intersect.distance < standingDistance);
}

// Add after scene setup
// Projectile management
const activeProjectiles = [];
const foodTypes = [
    { model: 'tomato.glb', scale: 0.5 },
    { model: 'apple.glb', scale: 0.5 },
    { model: 'orange.glb', scale: 0.5 },
    { model: 'sandwich.glb', scale: 0.5 },
    { model: 'pizza.glb', scale: 0.3 },
    { model: 'sushi-salmon.glb', scale: 0.5 }
];
let currentFoodIndex = 0;

// Preview model for currently selected food
let previewModel = null;
const loader = new GLTFLoader();

function updatePreviewModel() {
    // Remove existing preview model if it exists
    if (previewModel) {
        scene.remove(previewModel);
        previewModel.traverse((child) => {
            if (child.isMesh) {
                child.geometry.dispose();
                child.material.dispose();
            }
        });
    }

    // Load new preview model
    const foodType = foodTypes[currentFoodIndex];
    loader.load(`/public/assets/objects/${foodType.model}`, (gltf) => {
        previewModel = gltf.scene;
        previewModel.scale.set(foodType.scale, foodType.scale, foodType.scale);
        scene.add(previewModel);
    });
}

// Initialize preview model
updatePreviewModel();

// Mouse click for throwing
document.addEventListener('mousedown', (event) => {
    if (controls.isLocked && event.button === 0) { // Left click
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        
        const foodType = foodTypes[currentFoodIndex];
        const projectile = new FoodProjectile({
            scene,
            position: camera.position.clone().add(direction.multiplyScalar(2)),
            direction: direction,
            foodModel: foodType.model,
            scale: foodType.scale,
            speed: 0.5,
            gravity: 0.01,
            arcHeight: 0.2,
            lifetime: 5000,
            collidableObjects
        });
        
        activeProjectiles.push(projectile);
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (controls.isLocked) {
        // Store current position
        const currentPosition = camera.position.clone();
        
        // Apply gravity
        velocity.y -= gravity;
        
        // Handle jump
        if (keys[' '] && canJump) {
            velocity.y = jumpForce;
            canJump = false;
        }
        
        // Calculate potential new position for vertical movement
        const nextPositionY = currentPosition.clone();
        nextPositionY.y += velocity.y;
        
        // Check for vertical collision
        if (checkCollision(nextPositionY)) {
            // If collision while moving down, we hit the top of something
            if (velocity.y < 0) {
                velocity.y = 0;
                canJump = true;
            } 
            // If collision while moving up, we hit the bottom of something
            else if (velocity.y > 0) {
                velocity.y = 0;
            }
        } else {
            // Apply vertical movement if no collision
            camera.position.y += velocity.y;
        }
        
        // Ground check
        if (camera.position.y < 2 || checkStandingOnObject()) {
            if (camera.position.y < 2) {
                camera.position.y = 2;
            }
            velocity.y = 0;
            canJump = true;
        }

        // Calculate movement
        const moveForward = keys.w ? 1 : (keys.s ? -1 : 0);
        const moveRight = keys.d ? 1 : (keys.a ? -1 : 0);
        
        // Create potential new position for horizontal movement
        const potentialPosition = camera.position.clone();
        
        // Test forward/backward movement
        if (moveForward !== 0) {
            controls.moveForward(moveForward * moveSpeed);
            if (checkCollision(camera.position)) {
                // If collision, revert to previous position
                camera.position.copy(potentialPosition);
            } else {
                // If no collision, update potential position
                potentialPosition.copy(camera.position);
            }
        }
        
        // Test right/left movement
        if (moveRight !== 0) {
            controls.moveRight(moveRight * moveSpeed);
            if (checkCollision(camera.position)) {
                // If collision, revert to previous position
                camera.position.copy(potentialPosition);
            }
        }

        // Update preview model position
        if (previewModel) {
            // Get camera direction and position
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            
            // Position the preview model in front and slightly to the right of the camera
            const offset = new THREE.Vector3(0.5, -0.3, -1); // Adjust these values to position the model where you want it
            offset.applyQuaternion(camera.quaternion);
            previewModel.position.copy(camera.position).add(offset);
            
            // Make the preview model face the same direction as the camera
            previewModel.quaternion.copy(camera.quaternion);
            // Add a slight tilt
            previewModel.rotateX(Math.PI / 6);
            previewModel.rotateY(Math.PI / 6);
        }

        // Update projectiles
        for (let i = activeProjectiles.length - 1; i >= 0; i--) {
            const projectile = activeProjectiles[i];
            projectile.update();
            
            if (!projectile.isActive) {
                activeProjectiles.splice(i, 1);
            }
        }
    }

    renderer.render(scene, camera);
}

animate(); 