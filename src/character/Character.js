import * as THREE from 'three';
import { PointerLockControls } from './../../node_modules/three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from './../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { FoodProjectile } from '../projectiles/FoodProjectile.js';
import { FoodRegistry } from '../food/FoodRegistry.js';
import { assetPath } from '../utils/pathHelper.js';

export class Character {
    constructor(scene, camera, collidableObjects) {
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
        this.currentFoodItem = null;   // Start with no food item
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
            if (this.currentFoodItem && this.inventory) {
                const slot = this.inventory.getSelectedSlot();
                if (slot.item && slot.amount > 0) {
                    const direction = new THREE.Vector3();
                    this.camera.getWorldDirection(direction);
                    
                    const projectile = new FoodProjectile({
                        scene: this.scene,
                        position: this.camera.position.clone().add(direction.multiplyScalar(2)),
                        direction: direction,
                        foodModel: this.currentFoodItem.model,
                        scale: this.currentFoodItem.scale,
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
        if (this.currentFoodItem) {
            this.loader.load(assetPath(`objects/${this.currentFoodItem.model}`), (gltf) => {
                this.previewModel = gltf.scene;
                const baseScale = this.currentFoodItem.scale * 1.5;
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
            // First do a quick bounding box check
            if (!obj.box.intersectsSphere(playerSphere)) {
                return false;
            }
            
            // If the bounding box intersects, do precise mesh collision detection
            return obj.meshes.some(mesh => {
                // Cast rays in multiple directions from the player's position
                const directions = [
                    new THREE.Vector3(1, 0, 0),
                    new THREE.Vector3(-1, 0, 0),
                    new THREE.Vector3(0, 0, 1),
                    new THREE.Vector3(0, 0, -1),
                    new THREE.Vector3(1, 0, 1).normalize(),
                    new THREE.Vector3(1, 0, -1).normalize(),
                    new THREE.Vector3(-1, 0, 1).normalize(),
                    new THREE.Vector3(-1, 0, -1).normalize()
                ];
                
                return directions.some(dir => {
                    raycaster.set(nextPosition, dir);
                    const intersects = raycaster.intersectObject(mesh);
                    return intersects.some(intersect => intersect.distance < this.playerRadius);
                });
            });
        });
    }

    checkStandingOnObject() {
        const raycaster = new THREE.Raycaster();
        const rayOrigin = this.camera.position.clone();
        const rayDirection = new THREE.Vector3(0, -1, 0);
        raycaster.set(rayOrigin, rayDirection);
        
        const intersects = [];
        this.collidableObjects.forEach(obj => {
            const intersectResults = raycaster.intersectObject(obj.object, true);
            intersects.push(...intersectResults);
        });
        
        const standingDistance = 2.1;
        return intersects.some(intersect => intersect.distance < standingDistance);
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
        
        // Apply gravity
        this.velocity.y -= this.gravity;
        
        // Handle jump
        if (this.keys[' '] && this.canJump) {
            this.velocity.y = this.jumpForce;
            this.canJump = false;
        }
        
        // Vertical movement
        const nextPositionY = currentPosition.clone();
        nextPositionY.y += this.velocity.y;
        
        if (this.checkCollision(nextPositionY)) {
            if (this.velocity.y < 0) {
                this.velocity.y = 0;
                this.canJump = true;
            } else if (this.velocity.y > 0) {
                this.velocity.y = 0;
            }
        } else {
            this.camera.position.y += this.velocity.y;
        }
        
        // Ground check
        if (this.camera.position.y < 2 || this.checkStandingOnObject()) {
            if (this.camera.position.y < 2) {
                this.camera.position.y = 2;
            }
            this.velocity.y = 0;
            this.canJump = true;
        }

        // Horizontal movement
        const moveForward = this.keys.w ? 1 : (this.keys.s ? -1 : 0);
        const moveRight = this.keys.d ? 1 : (this.keys.a ? -1 : 0);
        
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
} 