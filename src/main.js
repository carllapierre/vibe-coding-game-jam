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
// Hand model setup
const handGeometry = new THREE.BoxGeometry(0.003, 0.009, 0.003, 1, 1, 1).toNonIndexed();
// Bevel the edges by moving vertices slightly inward
const positionAttribute = handGeometry.getAttribute('position');
const positions = positionAttribute.array;
for (let i = 0; i < positions.length; i += 3) {
    const vertex = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
    const direction = vertex.normalize();
    positions[i] = vertex.x * 0.3; // Scale down X
    positions[i + 1] = vertex.y * 0.3; // Scale down Y
    positions[i + 2] = vertex.z * 0.3; // Scale down Z
}
handGeometry.computeVertexNormals();

const handMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffdbac,
    roughness: 0.7,
    metalness: 0.0
}); 
const handMesh = new THREE.Mesh(handGeometry, handMaterial);
scene.add(handMesh);

let isThrowAnimating = false;
let throwAnimationStartTime = 0;
const throwAnimationDuration = 300; // milliseconds

// Projectile management
const activeProjectiles = [];
const foodTypes = [
    { model: 'tomato.glb', scale: 1 },
    { model: 'apple.glb', scale: 1 },
    { model: 'orange.glb', scale: 1 },
    { model: 'sandwich.glb', scale: 0.8 },
    { model: 'pizza.glb', scale: 0.8 },
    { model: 'sushi-salmon.glb', scale: 0.8 }
];
let currentFoodIndex = 0;

// Preview model for currently selected food
let previewModel = null;
const loader = new GLTFLoader();
let previewGrowStartTime = 0;
const growDuration = 500; // milliseconds

function createSpawnParticles(position) {
    const particleCount = 15;
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    
    for (let i = 0; i < particleCount; i++) {
        // Start particles in a small sphere around spawn point
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.1;
        positions.push(
            position.x + Math.cos(angle) * radius,
            position.y,
            position.z + Math.sin(angle) * radius
        );
        
        // Particles move outward and up
        velocities.push(
            (Math.random() - 0.5) * 0.02,
            Math.random() * 0.02,
            (Math.random() - 0.5) * 0.02
        );
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0x00ff00,
        size: 0.02,
        transparent: true,
        opacity: 1
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // Animate particles
    const startTime = Date.now();
    const particleDuration = 500;

    const animateParticles = () => {
        const elapsed = Date.now() - startTime;
        const positions = geometry.attributes.position.array;

        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] += velocities[i * 3];
            positions[i * 3 + 1] += velocities[i * 3 + 1];
            positions[i * 3 + 2] += velocities[i * 3 + 2];
        }

        geometry.attributes.position.needsUpdate = true;
        material.opacity = 1 - (elapsed / particleDuration);

        if (elapsed < particleDuration) {
            requestAnimationFrame(animateParticles);
        } else {
            scene.remove(particles);
            geometry.dispose();
            material.dispose();
        }
    };

    animateParticles();
}

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
        // Increase the base scale by 1.5x
        const baseScale = foodType.scale * 1.5;
        previewModel.scale.set(0.001, 0.001, 0.001); // Start tiny
        previewModel.baseScale = baseScale; // Store the target scale
        scene.add(previewModel);
        
        // Start grow animation
        previewGrowStartTime = Date.now();
        
        // Create spawn particles at the preview model's position
        const handTipOffset = new THREE.Vector3(0.5, -0.65, -1.5);
        handTipOffset.applyQuaternion(camera.quaternion);
        const spawnPosition = camera.position.clone().add(handTipOffset);
        createSpawnParticles(spawnPosition);
    });
}

// Initialize preview model
updatePreviewModel();

// Mouse click for throwing
document.addEventListener('mousedown', (event) => {
    if (controls.isLocked && event.button === 0 && !isThrowAnimating) { // Left click
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

        // Start throw animation
        isThrowAnimating = true;
        throwAnimationStartTime = Date.now();
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

        // Update hand and preview model position
        if (handMesh && previewModel) {
            // Get camera direction and position
            const direction = new THREE.Vector3();
            camera.getWorldDirection(direction);
            
            // Position the hand
            const handOffset = new THREE.Vector3(0.6, -0.8, -1.1);
            handOffset.applyQuaternion(camera.quaternion);
            handMesh.position.copy(camera.position).add(handOffset);
            
            // Update hand rotation
            handMesh.quaternion.copy(camera.quaternion);
            handMesh.rotateX(Math.PI / -6.5);
            handMesh.rotateY(-Math.PI / 8);
            handMesh.rotateZ(Math.PI / 10);

            // Handle throw animation and preview model
            if (isThrowAnimating) {
                const elapsed = Date.now() - throwAnimationStartTime;
                const progress = Math.min(elapsed / throwAnimationDuration, 1);
                
                // Animate hand rotation
                const rotationAngle = Math.sin(progress * Math.PI) * (Math.PI / 3);
                handMesh.rotateX(-rotationAngle);

                // Hide preview model during throw
                if (previewModel) {
                    previewModel.visible = false;
                }
                
                if (progress === 1) {
                    isThrowAnimating = false;
                    // Show new preview model after throw
                    updatePreviewModel();
                }
            } else {
                // Position preview model at hand tip when not throwing
                if (previewModel) {
                    previewModel.visible = true;
                    // Calculate hand tip position (adjusted more to the left)
                    const handTipOffset = new THREE.Vector3(0.5, -0.65, -1.5);
                    handTipOffset.applyQuaternion(camera.quaternion);
                    previewModel.position.copy(camera.position).add(handTipOffset);
                    
                    // Update preview model rotation to look more natural
                    previewModel.quaternion.copy(camera.quaternion);
                    previewModel.rotateX(Math.PI / 4);
                    previewModel.rotateY(Math.PI / 4);

                    // Handle grow animation if active
                    const growElapsed = Date.now() - previewGrowStartTime;
                    if (growElapsed < growDuration) {
                        const growProgress = growElapsed / growDuration;
                        // Smooth easing function
                        const scale = previewModel.baseScale * (1 - Math.pow(1 - growProgress, 3));
                        previewModel.scale.set(scale, scale, scale);
                    } else {
                        // Ensure final scale is set
                        previewModel.scale.set(previewModel.baseScale, previewModel.baseScale, previewModel.baseScale);
                    }
                }
            }
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