import * as THREE from 'three';
import { PointerLockControls } from './../../node_modules/three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from './../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { FoodProjectile } from '../projectiles/FoodProjectile.js';
import { assetPath } from '../utils/pathHelper.js';

export class Character {
    constructor(scene, camera, collidableObjects, _itemRegistry) {
        this.itemRegistry = _itemRegistry;
        this.scene = scene;
        this.camera = camera;
        this.collidableObjects = collidableObjects;
        this.enabled = true;
        
        // Movement variables
        this.moveSpeed = 0.15;
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            ' ': false
        };

        // Physics variables
        this.gravity = 0.01;
        this.jumpForce = 0.25;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.canJump = true;
        this.playerRadius = 0.5;
        
        // Surface tracking for stable standing
        this.lastSurfaceY = null;
        this.surfaceMemoryTimeout = 100; // ms to remember a surface
        this.lastSurfaceTime = 0;

        // Camera bobbing variables
        this.bobAmplitude = 0.25; // Reduced height of the bob for smoother motion
        this.bobFrequency = 2; // Speed of the bob
        this.bobTime = 0;
        this.lastBobPosition = 0;
        this.isMoving = false;
        this.smoothingFactor = 0.25; // Added smoothing factor for transitions

        // Initialize controls
        this.controls = new PointerLockControls(camera, document.body);
        
        // Hand setup
        this.setupHand();
        
        // Food throwing setup
        this.setupFoodThrowing();
        
        // Event listeners
        this.setupEventListeners();

        // Add a debug collision sphere
        const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff0000,
            transparent: true,
            opacity: 0.3
        });
        this.collisionSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.scene.add(this.collisionSphere);
        
        // Initialize movement state
        this.movementState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            // Reset all movement keys when disabled
            Object.keys(this.keys).forEach(key => this.keys[key] = false);
            // Unlock controls when disabled
            this.controls.unlock();
        }
    }

    setupHand() {
        const handGeometry = new THREE.BoxGeometry(0.003, 0.009, 0.003, 1, 1, 1).toNonIndexed();
        const positionAttribute = handGeometry.getAttribute('position');
        const positions = positionAttribute.array;
        
        for (let i = 0; i < positions.length; i += 3) {
            const vertex = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
            const direction = vertex.normalize();
            positions[i] = vertex.x * 0.3;
            positions[i + 1] = vertex.y * 0.3;
            positions[i + 2] = vertex.z * 0.3;
        }
        handGeometry.computeVertexNormals();

        const handMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffdbac,
            roughness: 0.7,
            metalness: 0.0
        }); 
        
        this.handMesh = new THREE.Mesh(handGeometry, handMaterial);
        this.scene.add(this.handMesh);
    }

    setupFoodThrowing() {
        this.isThrowAnimating = false;
        this.throwAnimationStartTime = 0;
        this.throwAnimationDuration = 300;
        this.previewGrowStartTime = 0;
        this.growDuration = 500;
        
        this.currentFoodIndex = null;  // Start with no food selected
        this.currentItem = null;   // Start with no food item
        this.previewModel = null;
        this.loader = new GLTFLoader();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (!this.enabled) return;
            // Don't handle character controls if Shift+D is pressed (debug mode toggle)
            if (event.key === 'D' && event.shiftKey) {
                return;
            }
            this.handleKeyDown(event);
        });
        document.addEventListener('keyup', (event) => {
            if (!this.enabled) return;
            this.handleKeyUp(event);
        });
        document.addEventListener('mousedown', (event) => {
            if (!this.enabled) return;
            this.handleMouseDown(event);
        });
        document.addEventListener('click', () => {
            if (!this.enabled) return;
            this.controls.lock();
        });
    }

    handleKeyDown(event) {
        if (this.keys.hasOwnProperty(event.key)) {
            this.keys[event.key] = true;
        }

        // Number keys now just select inventory slots
        const num = parseInt(event.key);
        if (num >= 1 && num <= 9) {
            if (this.inventory) {
                this.inventory.selectSlot(num - 1);
            }
        }
    }

    handleKeyUp(event) {
        if (this.keys.hasOwnProperty(event.key)) {
            this.keys[event.key] = false;
        }
    }

    handleMouseDown(event) {
        if (this.controls.isLocked && event.button === 0 && !this.isThrowAnimating) {
            // Only throw if we have a valid food item and items in inventory
            if (this.currentItem && this.inventory) {
                const slot = this.inventory.getSelectedSlot();
                if (slot.item && slot.amount > 0) {
                    const direction = new THREE.Vector3();
                    this.camera.getWorldDirection(direction);
                    

                    const itemConfig = this.itemRegistry.getType(this.currentItem);
                    const projectile = new FoodProjectile({
                        scene: this.scene,
                        position: this.camera.position.clone().add(direction.multiplyScalar(2)),
                        direction: direction,
                        path: itemConfig.modelPath,
                        scale: itemConfig.scale,
                        speed: 0.5,
                        gravity: 0.01,
                        arcHeight: 0.2,
                        lifetime: 5000
                    });
                    
                    FoodProjectile.registerProjectile(projectile);

                    this.isThrowAnimating = true;
                    this.throwAnimationStartTime = Date.now();

                    // Notify inventory that an item was consumed
                    const consumed = this.inventory.consumeSelectedItem();
                    if (!consumed) {
                        // If we couldn't consume (ran out), clear the preview
                        this.clearPreviewModel();
                    }
                }
            }
        }
    }

    clearPreviewModel() {
        if (this.previewModel) {
            this.scene.remove(this.previewModel);
            this.previewModel.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
            this.previewModel = null;
        }
    }

    updatePreviewModel() {
        this.clearPreviewModel();

        // Only show preview if we have a valid food item
        if (this.currentItem) {
            const itemConfig = this.itemRegistry.getType(this.currentItem);
            this.loader.load(itemConfig.modelPath, (gltf) => {
                this.previewModel = gltf.scene;
                const baseScale = itemConfig.scale * 1.5;
                this.previewModel.scale.set(0.001, 0.001, 0.001);
                this.previewModel.baseScale = baseScale;
                this.scene.add(this.previewModel);
                
                this.previewGrowStartTime = Date.now();
                
                const handTipOffset = new THREE.Vector3(0.5, -0.65, -1.5);
                handTipOffset.applyQuaternion(this.camera.quaternion);
                const spawnPosition = this.camera.position.clone().add(handTipOffset);
                this.createSpawnParticles(spawnPosition);
            });
        }
    }

    createSpawnParticles(position) {
        const particleCount = 15;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const radius = 0.1;
            positions.push(
                position.x + Math.cos(angle) * radius,
                position.y,
                position.z + Math.sin(angle) * radius
            );
            
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
        this.scene.add(particles);

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
                this.scene.remove(particles);
                geometry.dispose();
                material.dispose();
            }
        };

        animateParticles();
    }

    checkCollision(nextPosition) {
        const playerSphere = new THREE.Sphere(nextPosition, this.playerRadius);
        const raycaster = new THREE.Raycaster();
        
        // Check collision with each collidable object's meshes
        return this.collidableObjects.some(obj => {
            // Skip invalid objects
            if (!obj || !obj.box || !obj.meshes) {
                return false;
            }
            
            // First do a quick bounding box check
            if (!obj.box.intersectsSphere(playerSphere)) {
                return false;
            }
            
            // If the bounding box intersects, do precise mesh collision detection
            return obj.meshes.some(mesh => {
                if (!mesh || !mesh.isMesh) return false;
                
                // Focus on the most important directions for movement collision detection
                // Use fewer rays for more predictable collision
                const directions = [
                    new THREE.Vector3(1, 0, 0),          // Right
                    new THREE.Vector3(-1, 0, 0),         // Left
                    new THREE.Vector3(0, 0, 1),          // Forward
                    new THREE.Vector3(0, 0, -1),         // Backward
                    new THREE.Vector3(0, 1, 0),          // Up
                    new THREE.Vector3(0, -1, 0),         // Down
                ];
                
                // Calculate distance from the bottom of the player to the object's top
                const playerBottom = nextPosition.y - 2.0; // Player's feet position
                
                // Check if there's a vertical collision when falling onto an object
                if (this.velocity.y < 0) {
                    const verticalRay = new THREE.Raycaster(
                        new THREE.Vector3(nextPosition.x, nextPosition.y - 1.0, nextPosition.z), 
                        new THREE.Vector3(0, -1, 0)
                    );
                    const verticalHits = verticalRay.intersectObject(mesh);
                    
                    // If we're about to land on an object
                    if (verticalHits.length > 0 && verticalHits[0].distance < 1.1) {
                        return true;
                    }
                }
                
                return directions.some(dir => {
                    raycaster.set(nextPosition, dir);
                    const intersects = raycaster.intersectObject(mesh);
                    
                    // Only consider intersections within the player radius
                    return intersects.some(intersect => {
                        // For upward movement, we need a bit more clearance to prevent getting stuck
                        if (dir.y > 0) {
                            return intersect.distance < this.playerRadius * 0.9;
                        }
                        return intersect.distance < this.playerRadius * 0.9;
                    });
                });
            });
        });
    }

    checkStandingOnObject() {
        const raycaster = new THREE.Raycaster();
        const rayOrigin = this.camera.position.clone();
        const rayDirection = new THREE.Vector3(0, -1, 0);
        
        // Reduced offset size to prevent false detections
        const offsets = [
            new THREE.Vector3(0, 0, 0),                    // Center
            new THREE.Vector3(this.playerRadius*0.4, 0, 0),           // Right
            new THREE.Vector3(-this.playerRadius*0.4, 0, 0),          // Left
            new THREE.Vector3(0, 0, this.playerRadius*0.4),           // Front
            new THREE.Vector3(0, 0, -this.playerRadius*0.4),          // Back
        ];
        
        // Track the closest valid surface
        let closestDistance = Infinity;
        let foundSurface = false;
        let surfaceY = null;
        
        // Test each ray
        for (const offset of offsets) {
            const testOrigin = rayOrigin.clone().add(offset);
            raycaster.set(testOrigin, rayDirection);
            
            const intersects = [];
            this.collidableObjects.forEach(obj => {
                if (obj && obj.object) {
                    const intersectResults = raycaster.intersectObject(obj.object, true);
                    // Stricter filtering of valid intersections - only consider very close ones
                    const validIntersects = intersectResults.filter(intersect => 
                        testOrigin.y - intersect.point.y >= 0 && 
                        intersect.distance < 2.05  // Reduced from 2.1 to be more precise
                    );
                    intersects.push(...validIntersects);
                }
            });
            
            if (intersects.length > 0) {
                // Sort by distance to find closest
                intersects.sort((a, b) => a.distance - b.distance);
                if (intersects[0].distance < closestDistance) {
                    closestDistance = intersects[0].distance;
                    foundSurface = true;
                    surfaceY = testOrigin.y - intersects[0].distance;
                }
            }
        }
        
        // Update surface memory - only remember surfaces we're very close to
        if (foundSurface && closestDistance < 2.05) {
            this.lastSurfaceY = surfaceY;
            this.lastSurfaceTime = Date.now();
        } else if (this.lastSurfaceY !== null) {
            // Check if we're still near the last detected surface
            const timeSinceLastSurface = Date.now() - this.lastSurfaceTime;
            if (timeSinceLastSurface < this.surfaceMemoryTimeout && 
                Math.abs(this.camera.position.y - (this.lastSurfaceY + 2.0)) < 0.1) { // Stricter tolerance
                // We're still close to the last surface and time hasn't expired
                return true;
            } else if (timeSinceLastSurface >= this.surfaceMemoryTimeout) {
                // Memory expired, clear it
                this.lastSurfaceY = null;
            }
        }
        
        return foundSurface;
    }

    update() {
        // Update collision sphere position
        this.collisionSphere.position.copy(this.camera.position);
        
        if (!this.enabled || !this.controls.isLocked) return;

        this.updateMovement();
        this.updateHandAndPreviewModel();
    }

    updateMovement() {
        const currentPosition = this.camera.position.clone();
        
        // Check if we're standing on something first - but be more precise with ground checks
        const isOnGround = this.camera.position.y <= 2.001;
        const isOnObject = this.checkStandingOnObject();
        
        // Apply gravity first
        this.velocity.y -= this.gravity;
        
        // Handle jumping logic separately from ground detection to make it more reliable
        const wasOnGroundLastFrame = this.canJump;
        
        // Update jump flag - only if we're actually on a surface
        if (isOnGround || isOnObject) {
            this.canJump = true;
        }
        
        // Process jump input with more lenient jumping conditions
        if (this.keys[' ']) {
            // If we can jump or were recently able to jump (small grace period for more responsive jumping)
            if (this.canJump || wasOnGroundLastFrame) {
                this.velocity.y = this.jumpForce;
                this.canJump = false;
                this.lastSurfaceY = null; // Clear surface memory when jumping
                
                // Small upward boost to clear objects more reliably
                this.camera.position.y += 0.1;
            }
        }
        
        // Vertical movement with improved positioning
        if (isOnGround || isOnObject) {
            // If we're on ground or an object, zero out velocity and prevent sinking
            // Only zero out negative velocity to allow jumps to work
            if (this.velocity.y < 0) {
                this.velocity.y = 0;
            }
            
            if (isOnGround) {
                // On the main ground level
                this.camera.position.y = 2.0;
            } else if (isOnObject && this.lastSurfaceY !== null) {
                // Maintain exact position above the surface to prevent sinking or jerking
                this.camera.position.y = this.lastSurfaceY + 2.0;
            }
        } else {
            // We're in the air - apply normal physics
            const nextPositionY = currentPosition.clone();
            nextPositionY.y += this.velocity.y;
            
            if (this.checkCollision(nextPositionY)) {
                if (this.velocity.y < 0) {
                    // We're falling and hit something - find the exact surface
                    const raycaster = new THREE.Raycaster();
                    const rayOrigin = currentPosition.clone();
                    const rayDirection = new THREE.Vector3(0, -1, 0);
                    raycaster.set(rayOrigin, rayDirection);
                    
                    const intersects = [];
                    this.collidableObjects.forEach(obj => {
                        if (obj && obj.meshes && obj.meshes.length > 0) {
                            obj.meshes.forEach(mesh => {
                                if (mesh && mesh.isMesh) {
                                    const intersectResults = raycaster.intersectObject(mesh);
                                    intersects.push(...intersectResults);
                                }
                            });
                        }
                    });
                    
                    // Find the closest intersection
                    if (intersects.length > 0) {
                        // Sort by distance
                        intersects.sort((a, b) => a.distance - b.distance);
                        // Set position exactly at the standing height above the surface
                        const surfaceY = rayOrigin.y - intersects[0].distance;
                        this.camera.position.y = surfaceY + 2.0;
                        this.lastSurfaceY = surfaceY; // Remember this surface
                        this.lastSurfaceTime = Date.now();
                    }
                    
                    this.velocity.y = 0;
                    this.canJump = true;
                } else if (this.velocity.y > 0) {
                    // Hit ceiling
                    this.velocity.y = 0;
                }
            } else {
                // No collision, normal movement
                this.camera.position.y += this.velocity.y;
            }
        }

        // Horizontal movement
        const moveForward = this.keys.w ? 1 : (this.keys.s ? -1 : 0);
        const moveRight = this.keys.d ? 1 : (this.keys.a ? -1 : 0);
        
        // Check if character is moving horizontally
        this.isMoving = moveForward !== 0 || moveRight !== 0;
        
        const potentialPosition = this.camera.position.clone();
        
        if (moveForward !== 0) {
            this.controls.moveForward(moveForward * this.moveSpeed);
            if (this.checkCollision(this.camera.position)) {
                this.camera.position.copy(potentialPosition);
            } else {
                potentialPosition.copy(this.camera.position);
            }
        }
        
        if (moveRight !== 0) {
            this.controls.moveRight(moveRight * this.moveSpeed);
            if (this.checkCollision(this.camera.position)) {
                this.camera.position.copy(potentialPosition);
            }
        }

        // Update camera bobbing
        if (this.isMoving && this.canJump) {  // Only bob when moving and on ground
            this.bobTime += this.moveSpeed * this.bobFrequency;
            const targetBobPosition = Math.sin(this.bobTime) * this.bobAmplitude;
            
            // Smooth interpolation between current and target position
            const bobDifference = targetBobPosition - this.lastBobPosition;
            this.lastBobPosition += bobDifference * this.smoothingFactor;
            
            this.camera.position.y += bobDifference * this.smoothingFactor;
        } else {
            // Gradually return to neutral position when not moving
            if (Math.abs(this.lastBobPosition) > 0.001) {
                this.lastBobPosition *= 0.9; // Slower decay for smoother stop
                this.camera.position.y -= this.lastBobPosition * this.smoothingFactor;
            } else {
                this.lastBobPosition = 0;
                this.bobTime = 0;
            }
        }
    }

    updateHandAndPreviewModel() {
        if (!this.handMesh) return;  // Remove previewModel check since we might not have one

        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        // Position the hand
        const handOffset = new THREE.Vector3(0.6, -0.8, -1.1);
        handOffset.applyQuaternion(this.camera.quaternion);
        this.handMesh.position.copy(this.camera.position).add(handOffset);
        
        // Update hand rotation
        this.handMesh.quaternion.copy(this.camera.quaternion);
        this.handMesh.rotateX(Math.PI / -6.5);
        this.handMesh.rotateY(-Math.PI / 8);
        this.handMesh.rotateZ(Math.PI / 10);

        if (this.isThrowAnimating) {
            const elapsed = Date.now() - this.throwAnimationStartTime;
            const progress = Math.min(elapsed / this.throwAnimationDuration, 1);
            
            const rotationAngle = Math.sin(progress * Math.PI) * (Math.PI / 3);
            this.handMesh.rotateX(-rotationAngle);

            if (this.previewModel) {
                this.previewModel.visible = false;
            }
            
            if (progress === 1) {
                this.isThrowAnimating = false;
                if (this.inventory) {
                    // Check if we still have items in the current slot
                    const currentSlot = this.inventory.getSelectedSlot();
                    if (currentSlot.item) {
                        this.updatePreviewModel();
                    } else {
                        this.clearPreviewModel();
                    }
                }
            }
        } else if (this.previewModel) {
            this.previewModel.visible = true;
            const handTipOffset = new THREE.Vector3(0.5, -0.65, -1.5);
            handTipOffset.applyQuaternion(this.camera.quaternion);
            this.previewModel.position.copy(this.camera.position).add(handTipOffset);
            
            this.previewModel.quaternion.copy(this.camera.quaternion);
            this.previewModel.rotateX(Math.PI / 4);
            this.previewModel.rotateY(Math.PI / 4);

            const growElapsed = Date.now() - this.previewGrowStartTime;
            if (growElapsed < this.growDuration) {
                const growProgress = growElapsed / this.growDuration;
                const scale = this.previewModel.baseScale * (1 - Math.pow(1 - growProgress, 3));
                this.previewModel.scale.set(scale, scale, scale);
            } else {
                this.previewModel.scale.set(
                    this.previewModel.baseScale,
                    this.previewModel.baseScale,
                    this.previewModel.baseScale
                );
            }
        }
    }

    getPosition() {
        return this.camera.position;
    }
} 