import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

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

// Collection of collidable objects
const collidableObjects = [];
const boundingBoxHelpers = [];
const playerRadius = 0.5;

// Show hitboxes toggle
let showHitboxes = true;

// Initialize controls
const controls = new PointerLockControls(camera, document.body);

// GLTF loader for wall models
const loader = new GLTFLoader();

// Scaling factor for models
const scaleFactor = 3.5;

// Load wall models
const wallModels = [
    { 
        path: 'public/assets/scene/wall.glb',
        positions: [
            { x: -10, y: 0, z: -10, rotationY: 0 },
            { x: -10, y: 0, z: -6, rotationY: 0 },
            { x: -10, y: 0, z: -2, rotationY: 0 },
            { x: 10, y: 0, z: -10, rotationY: Math.PI },
            { x: 10, y: 0, z: -6, rotationY: Math.PI },
            { x: 10, y: 0, z: -2, rotationY: Math.PI }
        ]
    },
    { 
        path: 'public/assets/scene/wall-window.glb',
        positions: [
            { x: -10, y: 0, z: 2, rotationY: 0 },
            { x: 10, y: 0, z: 2, rotationY: Math.PI }
        ]
    },
    { 
        path: 'public/assets/scene/wall-corner.glb',
        positions: [
            { x: -10, y: 0, z: 6, rotationY: 0 },
            { x: 10, y: 0, z: 6, rotationY: Math.PI/2 }
        ]
    },
    { 
        path: 'public/assets/scene/wall-door-rotate.glb',
        positions: [
            { x: 0, y: 0, z: -10, rotationY: Math.PI/2 },
            { x: 6, y: 0, z: 6, rotationY: Math.PI }
        ]
    }
];

// Debug helper for visualizing bounding boxes
function createBoundingBoxHelper(object) {
    const box = new THREE.Box3().setFromObject(object);
    const helper = new THREE.Box3Helper(box, 0xff0000);
    helper.visible = showHitboxes;
    scene.add(helper);
    boundingBoxHelpers.push(helper);
    return { box, helper };
}

// Toggle hitbox visibility
function toggleHitboxes() {
    showHitboxes = !showHitboxes;
    boundingBoxHelpers.forEach(helper => {
        helper.visible = showHitboxes;
    });
}

// Load all the wall models
wallModels.forEach(model => {
    loader.load(model.path, (gltf) => {
        // Create instances at each position
        model.positions.forEach(pos => {
            const instance = gltf.scene.clone();
            
            // Scale the model
            instance.scale.set(scaleFactor, scaleFactor, scaleFactor);
            
            // Position and rotate the wall
            instance.position.set(pos.x, pos.y, pos.z);
            instance.rotation.y = pos.rotationY;
            
            // Add to the scene
            scene.add(instance);
            
            // Update matrices for proper bounding box calculation
            instance.updateMatrixWorld(true);
            
            // Create a bounding box for collision detection
            const boxInfo = createBoundingBoxHelper(instance);
            collidableObjects.push({
                object: instance,
                box: boxInfo.box
            });
        });
    }, undefined, (error) => {
        console.error('Error loading model:', error);
    });
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
        toggleHitboxes();
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
    // Create a sphere representing the player
    const playerSphere = new THREE.Sphere(nextPosition, playerRadius);
    
    // Check for collision with each object
    for (const obj of collidableObjects) {
        if (obj.box.intersectsSphere(playerSphere)) {
            return true;
        }
    }
    
    return false;
}

// Check if the player is standing on top of an object
function checkStandingOnObject() {
    // Create a ray pointing downward from the player
    const raycaster = new THREE.Raycaster();
    const rayOrigin = camera.position.clone();
    const rayDirection = new THREE.Vector3(0, -1, 0);
    raycaster.set(rayOrigin, rayDirection);
    
    // Check if ray intersects with any collidable object within the standing distance
    const intersects = [];
    for (const obj of collidableObjects) {
        const intersectResults = raycaster.intersectObject(obj.object, true);
        intersects.push(...intersectResults);
    }
    
    // If there's an intersection close enough, player is standing on an object
    const standingDistance = 2.1; // Slightly more than camera height
    return intersects.some(intersect => intersect.distance < standingDistance);
}

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
    }

    renderer.render(scene, camera);
}

animate(); 