import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FoodProjectile } from '../projectiles/FoodProjectile.js';
import { api, character } from '../config.js';
import assetManager from '../utils/AssetManager.js';
import { AudioManager } from '../audio/AudioManager.js';

// Health Manager class for handling character health
class HealthManager {
    constructor(maxHealth = 100, character) {
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.character = character;
        this.callbacks = [];
        this.isResettingHealthFromRespawn = false; // Flag to track respawn-triggered health resets
    }

    getHealth() {
        return this.currentHealth;
    }

    getMaxHealth() {
        return this.maxHealth;
    }

    getHealthPercentage() {
        return this.currentHealth / this.maxHealth;
    }

    addHealth(amount) {
        // Don't add health during death state
        if (this.character && this.character.isInDeathState) {
            console.log("Ignoring health addition during death state");
            return this.currentHealth;
        }
        
        const prevHealth = this.currentHealth;
        this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
        if (prevHealth !== this.currentHealth) {
            this.notifyHealthChange();
        }
        return this.currentHealth;
    }

    removeHealth(amount) {
        const prevHealth = this.currentHealth;
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        
        if (prevHealth !== this.currentHealth) {
            this.notifyHealthChange();
            
            // Trigger hit state when taking damage
            if (this.character) {
                this.character.setHitState();
            }
            
            // Check for death condition
            if (this.currentHealth <= 0 && this.character && !this.character.isInDeathState) {
                console.log("Health reached zero, triggering death state");
                this.character.setDeathState();
        }
        }
        
        return this.currentHealth;
    }

    /**
     * Set health to a specific value (used for server-authoritative updates)
     * @param {number} amount - The new health amount
     * @returns {number} The current health
     */
    setHealth(amount) {
        // Block ALL health updates during death state UNLESS we're explicitly resetting from respawn
        if (this.character && this.character.isInDeathState && !this.isResettingHealthFromRespawn) {
            console.log("Blocking health update during death state:", amount);
            return this.currentHealth;
        }
        
        const prevHealth = this.currentHealth;
        this.currentHealth = Math.max(0, Math.min(this.maxHealth, amount));
        if (prevHealth !== this.currentHealth) {
            this.notifyHealthChange();
        }
        
        // Reset the respawn flag if it was set
        this.isResettingHealthFromRespawn = false;
        
        return this.currentHealth;
    }
    
    /**
     * Reset health to max during respawn - this bypasses death state checks
     */
    resetHealthFromRespawn() {
        console.log("Resetting health from respawn function");
        this.isResettingHealthFromRespawn = true;
        this.setHealth(this.maxHealth);
    }

    registerHealthChangeCallback(callback) {
        this.callbacks.push(callback);
    }

    notifyHealthChange() {
        this.callbacks.forEach(callback => callback(this.currentHealth, this.maxHealth));
    }
}

export class Character {
    constructor(scene, camera, collidableObjects, _itemRegistry) {
        this.itemRegistry = _itemRegistry;
        this.scene = scene;
        this.camera = camera;
        this.collidableObjects = collidableObjects;
        this.enabled = true;
        
        // Initialize health manager with reference to this character
        this.healthManager = new HealthManager(100, this);
        
        // Player state tracking
        this.playerState = 'idle';
        this.lastPlayerState = 'idle';
        
        // Movement variables
        this.moveSpeed = 0.14;
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            ' ': false
        };

        // Physics variables
        this.gravity = 0.012;
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

        // Initialize controls - this will use the camera's current orientation
        this.controls = new PointerLockControls(camera, document.body);
        
        // Show loading screen
        this.showLoadingScreen();
        
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
        
        // Create the bounding box for projectile collisions
        this.createBoundingBox();
        
        // Initialize movement state
        this.movementState = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false
        };
        
        // Auto-lock controls after a short delay to allow page to fully load
        setTimeout(() => {
            if (this.enabled) {
                this.controls.lock();
                this.hideLoadingScreen();
            }
        }, 500);

        // Network players hit detection
        this.networkedPlayers = [];
        this.hitCooldowns = new Map(); // Map to track cooldowns for hits
        this.hitCooldownTime = 1000; // 1 second cooldown between hits on the same player

        // Add hit state tracking
        this.isInHitState = false;
        this.hitStateStartTime = 0;

        // Add death state tracking
        this.isInDeathState = false;
        this.deathStateStartTime = 0;
        this.respawnCountdown = 0;
        this.deathOverlay = null;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled) {
            // Reset all movement keys when disabled
            Object.keys(this.keys).forEach(key => this.keys[key] = false);
            // Unlock controls when disabled but NOT when in death state
            if (!this.isInDeathState) {
            this.controls.unlock();
            }
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
        // Add hand model to the scene
        this.setupHand();
        
        // Add animation properties
        this.isThrowAnimating = false;
        this.throwAnimationStartTime = 0;
        this.throwAnimationDuration = 500;
        
        // Add consume animation properties
        this.isConsumeAnimating = false;
        this.consumeAnimationStartTime = 0;
        this.consumeAnimationDuration = 500;
        
        this.currentFoodIndex = null;  // Start with no food selected
        this.currentItem = null;   // Start with no food item
        this.previewModel = null;
        // Remove the local loader instance since we're using AssetManager now
        // this.loader = new GLTFLoader();
    }

    setupEventListeners() {

        // only if in development mode
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
        
        // Simple click handler to lock controls
        document.addEventListener('click', () => {
            if (!this.enabled) return;
            if (!this.controls.isLocked) {
                this.requestPointerLock();
            }
        });
        
        // Add pointer lock change event to handle when user exits pointer lock
        document.addEventListener('pointerlockchange', () => {
            if (!document.pointerLockElement && this.enabled) {
                // Don't show the lock message if loading screen is visible
                const loadingScreen = document.getElementById('loading-screen');
                if (loadingScreen && !loadingScreen.style.opacity === '0') return;
                
            } 
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
        if (!this.controls.isLocked || !this.currentItem || !this.inventory) return;
        
        const slot = this.inventory.getSelectedSlot();
        if (!slot.item || slot.amount <= 0) return;
        
        const itemConfig = this.itemRegistry.getType(this.currentItem);
        if (!itemConfig) return;
        
        // If any animation is playing, don't allow new actions
        if (this.isThrowAnimating || this.isConsumeAnimating) return;
        
        // Left click (not already animating)
        if (event.button === 0) {
            // Use custom onLeftClick function if it exists, otherwise use the default throw behavior
            if (itemConfig.onLeftClick) {
                itemConfig.onLeftClick(this, itemConfig);
            } else {
                this.throwItem(itemConfig);
            }
        }
        
        // Right click (not already animating)
        else if (event.button === 2) {
            // Skip consumption for non-consumable items
            if (itemConfig.isConsumable === false) return;
            
            // Use custom onRightClick function if it exists, otherwise use the default consume behavior
            if (itemConfig.onRightClick) {
                itemConfig.onRightClick(this, itemConfig);
            } else {
                this.consumeItem(itemConfig);
            }
        }
    }
    
    // Default throw method
    throwItem(itemConfig) {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        
        console.log("Throwing item", itemConfig);
        // Create local projectile
        const position = this.camera.position.clone().add(direction.clone().multiplyScalar(2));
        const projectile = new FoodProjectile({
            scene: this.scene,
            position: position,
            direction: direction,
            path: itemConfig.modelPath,
            scale: itemConfig.scale,
            speed: 0.5,
            gravity: 0.01,
            arcHeight: 0.2,
            lifetime: 5000,
            itemType: itemConfig.id || 'tomato',
            damage: itemConfig.damage || 10,
            isOwnProjectile: true, // Mark as player's own projectile
            onCollision: (collidedObject, itemConfig) => this.handleProjectileCollision(collidedObject, itemConfig)
        });
        
        FoodProjectile.registerProjectile(projectile);

        // Send projectile info over network if NetworkManager is available and server is ready
        if (window.networkManager && window.networkManager.isConnected && 
            window.networkManager.isServerReadyForProjectiles) {
            try {
                window.networkManager.sendProjectile({
                    itemType: itemConfig.id || 'tomato',
                    x: position.x,
                    y: position.y,
                    z: position.z,
                    dirX: direction.x,
                    dirY: direction.y,
                    dirZ: direction.z,
                    speed: 0.5,
                    scale: itemConfig.scale || 1,
                    gravity: 0.01,
                    arcHeight: 0.2,
                    lifetime: 5000
                });
            } catch (error) {
                console.error('Error sending projectile over network:', error);
                // Don't let network errors break the local projectile throw
            }
        }

        this.isThrowAnimating = true;
        this.throwAnimationStartTime = Date.now();

        // Notify inventory that an item was consumed
        const consumed = this.inventory.consumeSelectedItem();
        if (!consumed) {
            // If we couldn't consume (ran out), clear the preview
            this.clearPreviewModel();
        }
    }
    
    /**
     * Handle projectile collision with an object
     * @param {Object} collidedObject - The object the projectile collided with
     * @param {Object} itemConfig - The configuration of the thrown item
     */
    handleProjectileCollision(collidedObject, itemConfig) {
        // Check if this is a hit on our own character
        if (collidedObject && collidedObject.type === 'player') {
            if (collidedObject.isLocalPlayer) {
                // If we're hit by a remote player's projectile, handle self damage
                // This is for projectiles from other players, not our own
                if (!itemConfig.isOwnProjectile) {
                    console.log("Local player hit by remote projectile");
                    const damage = itemConfig.damage || 10;
                    
                    // Use the handleHit callback on the collision object
                    if (collidedObject.handleHit) {
                        collidedObject.handleHit(damage);
                    }
                }
                return;
            }
            
            // Handle hit on remote player below (existing code)
            const playerSessionId = collidedObject.sessionId || collidedObject.targetPlayerId;
            
            if (!playerSessionId) {
                console.warn('Cannot send hit: missing player session ID');
                return;
            }
            
            // Get direct reference to player object - allow multiple ways to access player
            const player = collidedObject.player || 
                           (window.networkManager && window.networkManager.playerManager?.players.get(playerSessionId));
            
            if (!player) {
                console.warn(`Cannot send hit: missing player reference for ID ${playerSessionId}`);
                return;
            }
            
            // Log successful hit detection for debugging
            console.log(`[HIT DEBUG] Hit detected on player ${playerSessionId}`);
            
            // Check if we're still in cooldown for this player
            const now = Date.now();
            const cooldownTime = 300; // Shorter cooldown to allow multiple successive hits
            
            // Check cooldown - skip if we're hitting too rapidly
            if (this.hitCooldowns.has(playerSessionId)) {
                const cooldownEndTime = this.hitCooldowns.get(playerSessionId);
                if (now < cooldownEndTime) {
                    return; // Still in cooldown, skip this hit
                }
            }
            
            // Calculate damage based on item properties - should match server-side calculation
            const damage = itemConfig.damage || 10;
            
            // Set cooldown for this player
            this.hitCooldowns.set(playerSessionId, now + cooldownTime);
            
            // Track hit count for this player to show more dramatic effects for multiple hits
            if (!this.playerHitCounts) this.playerHitCounts = new Map();
            
            let consecutiveHits = 1;
            let lastHitTime = 0;
            
            if (this.playerHitCounts.has(playerSessionId)) {
                const hitData = this.playerHitCounts.get(playerSessionId);
                lastHitTime = hitData.time;
                
                // If hits are within 2 seconds of each other, consider them consecutive
                if (now - lastHitTime < 2000) {
                    consecutiveHits = hitData.count + 1;
                } else {
                    consecutiveHits = 1;
                }
            }
            
            // Update consecutive hit count tracking
            this.playerHitCounts.set(playerSessionId, {
                count: consecutiveHits,
                time: now
            });
            
            // Create hit effect on the player - more particles for consecutive hits
            this.createHitEffect(collidedObject, consecutiveHits);
            
            // Always assume the hit is accepted - for more reliable hit detection
            let hitAccepted = true;
            
            // Use the new utility method to handle the hit directly on the NetworkedPlayer if available
            if (typeof player.handleProjectileHit === 'function') {
                player.handleProjectileHit(damage, itemConfig.id || 'tomato');
            }
            
            // Only send to server if the hit was accepted by the player object
            if (hitAccepted && window.networkManager && window.networkManager.isConnected) {
                try {
                    console.log(`[HIT DEBUG] Sending hit to server for player ${playerSessionId}, damage: ${damage}`);
                    window.networkManager.sendPlayerHit({
                        targetPlayerId: playerSessionId,
                        damage: damage,
                        itemType: itemConfig.id || 'tomato',
                        hitCount: consecutiveHits  // Send consecutive hit count to server
                    });
                    
                    // If we hit the remote player, play hitmarker sound locally for thrower
                    // The server will notify other players through the network
                    try {
                        if (AudioManager) {
                            AudioManager.play('hit', { 
                                volume: 1.0,                // Full volume
                                pitchMin: 0.4,              // Extremely low pitch possible
                                pitchMax: 1.6,              // Extremely high pitch possible
                                allowOverlap: true          // Allow sounds to overlap
                            });
                        }
                    } catch (error) {
                        console.warn('Unable to play hit sound:', error);
                    }
                } catch (error) {
                    console.error('Error sending player hit over network:', error);
                }
            }
        }
    }
    
    /**
     * Create a visual hit effect on the player
     * @param {Object} playerObject - The player object that was hit
     * @param {number} hitCount - The consecutive hit count for this player
     */
    createHitEffect(playerObject, hitCount = 1) {
        if (!playerObject || !playerObject.position) return;
        
        // Create particle effect at hit location
        const particleCount = 10 + (hitCount * 5); // More particles for consecutive hits
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];
        
        // Use the player's position for the hit effect
        const position = new THREE.Vector3(
            playerObject.position.x,
            playerObject.position.y + 1.5, // Aim for mid-body
            playerObject.position.z
        );
        
        // Different colors for consecutive hits
        let particleColor = 0xff0000; // Red for first hit
        
        // Change colors for consecutive hits
        if (hitCount >= 3) {
            particleColor = 0xffff00; // Yellow for 3+ hits
        } else if (hitCount >= 2) {
            particleColor = 0xff6600; // Orange for 2 hits
        }
        
        for (let i = 0; i < particleCount; i++) {
            // Random position around the hit point
            positions.push(
                position.x + (Math.random() - 0.5) * 0.5,
                position.y + (Math.random() - 0.5) * 0.5,
                position.z + (Math.random() - 0.5) * 0.5
            );
            
            // Random velocity outward - faster for consecutive hits
            const speedMultiplier = 1 + (hitCount * 0.2);
            velocities.push(
                (Math.random() - 0.5) * 0.08 * speedMultiplier,
                Math.random() * 0.08 * speedMultiplier,
                (Math.random() - 0.5) * 0.08 * speedMultiplier
            );
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        // Particles for hit effect
        const material = new THREE.PointsMaterial({
            color: particleColor,
            size: 0.05 + (hitCount * 0.01), // Larger particles for consecutive hits
            transparent: true,
            opacity: 1
        });
        
        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);
        
        const startTime = Date.now();
        const particleDuration = 500 + (hitCount * 100); // Longer duration for consecutive hits
        
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
    
    /**
     * Set the networked players for hit detection
     * @param {Array} players - Array of networked players
     */
    setNetworkedPlayers(players) {
        this.networkedPlayers = players;
    }

    // Default consume method
    consumeItem(itemConfig) {
        // Get default or custom health bonus
        const hpBonus = itemConfig.hpBonus !== undefined ? itemConfig.hpBonus : 100;
        
        // Add health and ensure the UI updates
        if (this.healthManager) {
            this.healthManager.addHealth(hpBonus);
        }
        
        // Start consume animation - always do this BEFORE consuming the item
        this.isConsumeAnimating = true;
        this.consumeAnimationStartTime = Date.now();
        
        // Important: For the last item in a stack, make sure we have a valid model
        // to animate with, even after the item is removed from inventory
        const isLastItem = this.inventory.getSelectedSlot().amount === 1;
        
        // If this is the last item, make sure the model is fully loaded before consuming
        if (isLastItem && !this.previewModel) {
            this.updatePreviewModel();
            // Add a small delay before consuming the item to let the model load
            setTimeout(() => {
                this.inventory.consumeSelectedItem();
            }, 50);
            return true; // Consider it consumed successfully
        }
        
        // For all other cases, consume immediately
        return this.inventory.consumeSelectedItem();
    }

    /**
     * Clean up preview model completely, ensuring it's removed from the scene
     */
    clearPreviewModel() {
        if (this.previewModel) {
            // First, make sure it's removed from the scene
            this.scene.remove(this.previewModel);
            
            // Clean up all materials and geometries
            this.previewModel.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    
                    if (child.material) {
                        // Handle array of materials
                        if (Array.isArray(child.material)) {
                            child.material.forEach(material => {
                                if (material.map) material.map.dispose();
                                material.dispose();
                            });
                        } else {
                            // Handle single material
                            if (child.material.map) child.material.map.dispose();
                            child.material.dispose();
                        }
                    }
                }
            });
            
            // Nullify the reference
            this.previewModel = null;
            
            // Reset preview growth timing
            this.previewGrowStartTime = 0;
        }
    }

    updatePreviewModel() {
        this.clearPreviewModel();

        // Only show preview if we have a valid food item
        if (this.currentItem) {
            const itemConfig = this.itemRegistry.getType(this.currentItem);
            // Use AssetManager instead of this.loader
            assetManager.loadModel(itemConfig.modelPath, (gltf) => {
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
        // Skip most functionality if player is dead, but don't return entirely
        // We need to keep checking for respawn and showing UI elements
        if (this.isInDeathState) {
            // Still update hand position for proper rendering
            this.updateHandPosition();
            return;
        }
        
        // Update collision sphere position
        this.collisionSphere.position.copy(this.camera.position);
        
        // Always process physics regardless of lock state
        this.updatePhysics();
        
        // Update bounding box position
        this.updateBoundingBoxPosition();
        
        // If controls aren't locked, update hand position after physics
        if (!this.enabled || !this.controls.isLocked) {
            this.updateHandPosition();
            return;
        }

        // For locked controls, process regular gameplay
        // Check for portal collisions
        this.checkPortalCollisions();
        
        // Update movement
        this.updateMovement();
        
        // Update hand position AFTER all camera movement is complete
        this.updateHandPosition();
        
        // Now handle animations
        this.updateHandAnimations();
    }

    // Split physics from input-based movement
    updatePhysics() {
        // Apply gravity
        this.velocity.y -= this.gravity;
        
        // Check if we're standing on something
        const isOnGround = this.camera.position.y <= 2.001;
        const isOnObject = this.checkStandingOnObject();
        
        // Update jump flag - only if we're actually on a surface
        if (isOnGround || isOnObject) {
            this.canJump = true;
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
            const currentPosition = this.camera.position.clone();
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
        
        // Hand position is now updated after all movements are complete
    }

    // Update basic hand position to follow camera
    updateHandPosition() {
        if (!this.handMesh) return;
        
        // Remove unnecessary direction calculation
        
        // Use a simpler approach: Fixed offsets relative to camera
        // The hand should be fixed in the bottom right corner of the view
        
        // Create a matrix to represent the camera's transformation
        const matrix = new THREE.Matrix4();
        matrix.makeRotationFromQuaternion(this.camera.quaternion);
        
        // Define fixed local position (relative to camera view)
        const localHandPosition = new THREE.Vector3(0.6, -0.8, -1.1);
        
        // Transform local coordinates to world coordinates
        localHandPosition.applyMatrix4(matrix);
        
        // Position hand at camera position + offset
        this.handMesh.position.copy(this.camera.position).add(localHandPosition);
        
        // Set hand rotation directly from camera
        this.handMesh.quaternion.copy(this.camera.quaternion);
        
        // Apply fixed rotational offsets that won't change with camera movement
        this.handMesh.rotateX(Math.PI / -6.5);
        this.handMesh.rotateY(-Math.PI / 8);
        this.handMesh.rotateZ(Math.PI / 10);
        
        // Update preview model using the same approach
        if (this.previewModel && !this.isThrowAnimating && !this.isConsumeAnimating) {
            // Ensure model is visible (might have been made invisible during animations)
            this.previewModel.visible = true;
            
            // Define fixed local position for preview model
            const localPreviewPosition = new THREE.Vector3(0.5, -0.65, -1.5);
            
            // Transform to world coordinates using same matrix
            localPreviewPosition.applyMatrix4(matrix);
            
            // Position preview model
            this.previewModel.position.copy(this.camera.position).add(localPreviewPosition);
            
            // Set rotation directly from camera
            this.previewModel.quaternion.copy(this.camera.quaternion);
            this.previewModel.rotateX(Math.PI / 4);
            this.previewModel.rotateY(Math.PI / 4);
            
            // Reset opacity in case it was changed during animations
            this.previewModel.traverse((child) => {
                if (child.isMesh && child.material) {
                    if (child.material.transparent) {
                        child.material.opacity = 1;
                    }
                }
            });
        }
    }

    // Only handle animations when controls are locked
    updateHandAnimations() {
        if (!this.handMesh) return;

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
        } 
        else if (this.isConsumeAnimating) {
            const elapsed = Date.now() - this.consumeAnimationStartTime;
            const progress = Math.min(elapsed / this.consumeAnimationDuration, 1);
            
            // Moving the hand toward the mouth animation
            const mouthDistance = Math.sin(progress * Math.PI) * 0.3;
            this.handMesh.position.z += mouthDistance;
            this.handMesh.position.y += mouthDistance * 0.5;
            
            // Only animate if we have a preview model
            if (this.previewModel) {
                // Keep the preview model visible but make it shrink and move toward the camera
                this.previewModel.visible = true;
                
                // Calculate shrink factor - start at original size and shrink to 10% at the end
                const shrinkFactor = 1 - (progress * 0.9);
                const originalScale = this.previewModel.baseScale;
                const scale = originalScale * shrinkFactor;
                
                // Update scale to create shrinking effect
                this.previewModel.scale.set(scale, scale, scale);
                
                // Move the item closer to the camera/mouth as animation progresses
                const handTipOffset = new THREE.Vector3(0.5, -0.65, -1.5);
                
                // Modified animation: Move item toward the bottom-center (player's mouth)
                // instead of just toward the center of the screen
                handTipOffset.x -= progress * 0.5; // Move toward center horizontally (more centered)
                handTipOffset.y -= progress * 0.2; // Move downward toward mouth instead of upward
                handTipOffset.z += progress * 0.7; // Move closer to camera
                
                handTipOffset.applyQuaternion(this.camera.quaternion);
                this.previewModel.position.copy(this.camera.position).add(handTipOffset);
                
                // Add a slight rotation as if the item is being oriented for eating
                this.previewModel.quaternion.copy(this.camera.quaternion);
                const eatRotationX = Math.PI / 4 - (progress * Math.PI / 4); // More rotation to align with mouth
                const eatRotationY = Math.PI / 4 + (progress * Math.PI / 16);
                this.previewModel.rotateX(eatRotationX);
                this.previewModel.rotateY(eatRotationY);
                
                // Make the item fully transparent at the very end
                if (progress > 0.8) {
                    const finalOpacity = 1 - ((progress - 0.8) * 5); // Fade out in the last 20% of animation
                    this.previewModel.traverse((child) => {
                        if (child.isMesh && child.material) {
                            // If the material isn't already set up for transparency
                            if (!child.material.transparent) {
                                child.material.transparent = true;
                                child.material.needsUpdate = true;
                            }
                            child.material.opacity = finalOpacity;
                        }
                    });
                    
                    // When fully transparent, remove from scene to prevent lingering models
                    if (progress >= 0.99) {
                        // Remove the model completely when we're at the end of the animation
                        // and it's fully transparent
                        this.scene.remove(this.previewModel);
                    }
                }
            }
            
            if (progress === 1) {
                this.isConsumeAnimating = false;
                
                // Force cleanup of the preview model - this is the most important fix
                this.clearPreviewModel();
                
                // Now check if we need to show a new model
                if (this.inventory) {
                    const currentSlot = this.inventory.getSelectedSlot();
                    if (currentSlot && currentSlot.item) {
                        this.updatePreviewModel();
                    }
                }
            }
        }
        else if (this.previewModel) {
            // Handle preview model growth animation
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

    updateMovement() {
        const currentPosition = this.camera.position.clone();
        
        // Check if we're in hit state
        if (this.isInHitState) {
            const elapsed = (Date.now() - this.hitStateStartTime) / 1000; // Convert to seconds
            if (elapsed >= character.states.hit.duration) {
                this.isInHitState = false;
                // Reset to idle state after hit state
                this.playerState = 'idle';
            } else {
                // Don't process movement while in hit state
                return;
            }
        }
        
        // Process jump input
        if (this.keys[' ']) {
            // If we can jump or were recently able to jump (small grace period for more responsive jumping)
            if (this.canJump) {
                this.velocity.y = this.jumpForce;
                this.canJump = false;
                this.lastSurfaceY = null; // Clear surface memory when jumping
                
                // Small upward boost to clear objects more reliably
                this.camera.position.y += 0.1;
                
                // Update player state to jumping
                this.playerState = 'jumping';
            }
        }

        // Horizontal movement
        const moveForward = this.keys.w ? 1 : (this.keys.s ? -1 : 0);
        const moveRight = this.keys.d ? 1 : (this.keys.a ? -1 : 0);
        
        // Check if character is moving horizontally
        this.isMoving = moveForward !== 0 || moveRight !== 0;
        
        // Update player state based on movement
        if (this.velocity.y > 0.01 || !this.canJump) {
            this.playerState = 'jumping';
        } else if (this.isMoving) {
            this.playerState = 'walking';
        } else {
            this.playerState = 'idle';
        }
        
        // Send player state updates over network if it changed
        if (this.playerState !== this.lastPlayerState && window.networkManager && window.networkManager.isConnected) {
            this.lastPlayerState = this.playerState;
            window.networkManager.sendPlayerState(this.playerState);
        }
        
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

    getPosition() {
        return this.camera.position;
    }

    // Create a loading screen that doesn't fully block the view
    showLoadingScreen() {
        const loadingScreen = document.createElement('div');
        loadingScreen.id = 'loading-screen';
        loadingScreen.style.position = 'absolute';
        loadingScreen.style.top = '0';
        loadingScreen.style.left = '0';
        loadingScreen.style.width = '100%';
        loadingScreen.style.height = '100%';
        loadingScreen.style.display = 'flex';
        loadingScreen.style.flexDirection = 'column';
        loadingScreen.style.justifyContent = 'center';
        loadingScreen.style.alignItems = 'center';
        loadingScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
        loadingScreen.style.zIndex = '1000';
        
        // Create message container with glassy background
        const messageContainer = document.createElement('div');
        messageContainer.style.backgroundColor = 'rgba(30, 30, 30, 0.7)';
        messageContainer.style.padding = '20px 40px';
        messageContainer.style.borderRadius = '8px';
        messageContainer.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
        messageContainer.style.backdropFilter = 'blur(5px)';
        messageContainer.style.display = 'flex';
        messageContainer.style.flexDirection = 'column';
        messageContainer.style.alignItems = 'center';
        messageContainer.style.gap = '15px';
        
        // Create loading text
        const loadingText = document.createElement('div');
        loadingText.textContent = 'Loading Game...';
        loadingText.style.color = 'white';
        loadingText.style.fontSize = '24px';
        loadingText.style.fontWeight = 'bold';
        
        // Create loading spinner
        const spinner = document.createElement('div');
        spinner.style.width = '30px';
        spinner.style.height = '30px';
        spinner.style.border = '4px solid rgba(255, 255, 255, 0.3)';
        spinner.style.borderTop = '4px solid white';
        spinner.style.borderRadius = '50%';
        spinner.style.animation = 'spin 1s linear infinite';
        
        // Add spinning animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
        
        // Add elements to the DOM
        messageContainer.appendChild(loadingText);
        messageContainer.appendChild(spinner);
        loadingScreen.appendChild(messageContainer);
        document.body.appendChild(loadingScreen);
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                loadingScreen.remove();
            }, 500);
        }
    }

    /**
     * Check if the player is colliding with any portals
     */
    checkPortalCollisions() {
        // Create a sphere representing the player's position
        const playerPosition = this.camera.position.clone();
        const playerSphere = new THREE.Sphere(playerPosition, this.playerRadius);
        
        // Find all portal objects in the scene
        const portals = [];
        this.scene.traverse(object => {
            if (object.userData && object.userData.type === 'portal') {
                portals.push(object);
            }
        });
        
        // Check collision with each portal
        for (const portal of portals) {
            // Skip if the portal has no collider
            if (!portal.collider) continue;
            
            // Get portal world position (account for parent transformations)
            const portalPosition = new THREE.Vector3();
            const colliderWorldPosition = new THREE.Vector3();
            
            portal.getWorldPosition(portalPosition);
            portal.collider.getWorldPosition(colliderWorldPosition);
            
            // Create a box for the portal's collider
            const colliderSize = new THREE.Vector3(1.8, 2.8, 1); // Same as in PortalObject.createCollider
            const halfSize = colliderSize.clone().multiplyScalar(0.5);
            
            // Create a box3 for collision detection
            const box = new THREE.Box3().setFromCenterAndSize(
                colliderWorldPosition,
                colliderSize
            );
            
            // Check for collision
            if (box.intersectsSphere(playerSphere)) {
                
                // Call portal's onPlayerEnter
                if (typeof portal.onPlayerEnter === 'function') {
                    portal.onPlayerEnter();
                }
                
                // Execute the onEnter callback directly if no method available
                if (portal.portalData && typeof portal.portalData.onEnter === 'function') {
                    portal.portalData.onEnter();
                }
                
                // Also check collider userData for onEnter function
                if (portal.collider && portal.collider.userData && 
                    typeof portal.collider.userData.onEnter === 'function') {
                    portal.collider.userData.onEnter();
                }
                
                // Add a slight delay before checking again to prevent multiple triggers
                // for the same portal
                portal.lastTriggered = Date.now();
            }
        }
    }

    // Request pointer lock with error handling and debouncing
    requestPointerLock() {
        // Check if we're already processing a lock request
        if (this.lockInProgress) return;
        
        // Set flag to prevent multiple lock requests
        this.lockInProgress = true;
        
        // Add a short delay to avoid race conditions
        setTimeout(() => {
            try {
                // Only request if we're not already locked
                if (!document.pointerLockElement) {
                    
                    // Direct request on user action - try to request immediately first
                    try {
                        this.controls.lock();
                    } catch (err) {
                        
                        // Create a click-to-continue overlay that will trigger the lock
                        // This ensures a direct connection between user gesture and lock request
                        const overlay = document.createElement('div');
                        overlay.id = 'click-to-lock-overlay';
                        overlay.style.position = 'absolute';
                        overlay.style.top = '0';
                        overlay.style.left = '0';
                        overlay.style.width = '100%';
                        overlay.style.height = '100%';
                        overlay.style.cursor = 'pointer';
                        overlay.style.zIndex = '2000';
                        overlay.style.backgroundColor = 'rgba(0,0,0,0.3)';
                        overlay.style.display = 'flex';
                        overlay.style.justifyContent = 'center';
                        overlay.style.alignItems = 'center';
                        overlay.style.color = 'white';
                        overlay.style.fontSize = '24px';
                        overlay.style.fontWeight = 'bold';
                        overlay.textContent = 'Click to continue';
                        
                        // Handle the click on the overlay
                        const handleOverlayClick = () => {
                            // Remove the overlay
                            document.body.removeChild(overlay);
                            
                            // Now that we have a direct user gesture, request the lock
                            try {
                                this.controls.lock();
                            } catch (lockErr) {
                                console.error("Failed to lock even after click:", lockErr);
                            }
                            
                            // Hide loading screen if it's visible
                            this.hideLoadingScreen();
                        };
                        
                        overlay.addEventListener('click', handleOverlayClick, { once: true });
                        document.body.appendChild(overlay);
                    }
                    
                    // Also show the lock message underneath the overlay
                    this.showLockMessage();
                } else {
                    // Already locked, release the flag
                    this.lockInProgress = false;
                }
            } catch (error) {
                console.warn("Error requesting pointer lock:", error);
                // Show message indicating user needs to click
                // Clear the lock in progress flag
                this.lockInProgress = false;
            }
            
            // Clear the lock in progress flag after a delay
            setTimeout(() => {
                this.lockInProgress = false;
            }, 500);
        }, 100); // Short delay to avoid race conditions
    }

    /**
     * Create a bounding box around the character for projectile collision detection
     */
    createBoundingBox() {
        // Create a visible box helper (for debugging, can be made invisible in production)
        // Create dimensions similar to NetworkedPlayer
        const width = 1.80;
        const height = 3.0;
        const depth = 1.80;
        
        // Create an invisible mesh as the base object
        const boxGeometry = new THREE.BoxGeometry(width, height, depth);
        const invisibleMaterial = new THREE.MeshBasicMaterial({ 
            visible: false 
        });
        this.boxMesh = new THREE.Mesh(boxGeometry, invisibleMaterial);
        
        // Position the mesh to follow camera (will be updated in update method)
        this.boxMesh.position.copy(this.camera.position);
        // Adjust Y to center the box on the character (camera is at eye level)
        this.boxMesh.position.y -= height / 3; 
        
        // Create a BoxHelper around the mesh - this makes a wireframe
        this.boundingBox = new THREE.BoxHelper(this.boxMesh, 0xff0000);
        
        // Store the box dimensions
        this.boundingBoxSize = new THREE.Vector3(width, height, depth);
        
        // Make the box and helper invisible in normal gameplay
        this.boundingBox.visible = false;
        
        // Add both to the scene
        this.scene.add(this.boxMesh);
        this.scene.add(this.boundingBox);
        
        console.log('Created character bounding box for projectile collisions');
    }

    /**
     * Update the bounding box position to follow the camera
     */
    updateBoundingBoxPosition() {
        if (!this.boundingBox || !this.boxMesh) return;
        
        // Update position to follow camera
        this.boxMesh.position.x = this.camera.position.x;
        this.boxMesh.position.z = this.camera.position.z;
        
        // For Y, position the box so it extends from feet upward
        // Camera is at eye level (2 units from ground)
        const boxHeight = this.boundingBoxSize.y;
        this.boxMesh.position.y = this.camera.position.y - (boxHeight / 3);
        
        // Update the helper
        this.boundingBox.update();
    }

    /**
     * Get meshes that can be used for collision detection
     * @returns {Array} Array of meshes for collision
     */
    getCollisionMeshes() {
        return [this.boxMesh];
    }

    /**
     * Get the collision box for character and handle self-hit detection
     * This needs to check for own projectile collisions
     */
    getCollisionBox() {
        return {
            box: new THREE.Box3().setFromObject(this.boxMesh),
            meshes: this.getCollisionMeshes(),
            type: 'player',
            isLocalPlayer: true,
            handleHit: (damage) => this.handleSelfHit(damage)
        };
    }

    /**
     * Handle this player being hit by a projectile
     * @param {number} damage - The amount of damage taken
     */
    handleSelfHit(damage) {
        // Only show visual effects - actual health changes come from server
        console.log(`Character taking ${damage} damage from hit`);
        
        // Create a hit effect
        this.createHitEffect();
        
        // We don't modify health directly - server will send health update
    }

    /**
     * Create visual effect when hit by projectile
     */
    createHitEffect() {
        // Flash the screen red
        const hitOverlay = document.createElement('div');
        hitOverlay.style.position = 'fixed';
        hitOverlay.style.top = '0';
        hitOverlay.style.left = '0';
        hitOverlay.style.width = '100%';
        hitOverlay.style.height = '100%';
        hitOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        hitOverlay.style.pointerEvents = 'none';
        hitOverlay.style.zIndex = '1000';
        hitOverlay.style.opacity = '0.7';
        
        // Add to document
        document.body.appendChild(hitOverlay);
        
        // Fade out and remove
        setTimeout(() => {
            hitOverlay.style.transition = 'opacity 0.5s ease-out';
            hitOverlay.style.opacity = '0';
            
            // Remove from DOM after fade completes
            setTimeout(() => {
                if (hitOverlay.parentNode) {
                    document.body.removeChild(hitOverlay);
                }
            }, 500);
        }, 50);
    }


    set playerState(playerState) {
        if (this._playerState === 'death') return;

        this._playerState = playerState;
    }

    get playerState() {
        return this._playerState;
    }

    /**
     * Set the character to death state
     * @param {string} killerName - Name of the player who killed this character
     * @param {string} weaponType - Type of weapon that killed the character
     * @param {string} killerId - ID of the player who killed this character
     */
    setDeathState(killerName = null, weaponType = null, killerId = null) {
        console.log("Setting death state for character");
        // Don't set if already in death state
        if (this.isInDeathState) {
            console.log("Already in death state, ignoring duplicate call");
            return;
        }
        
        this.isInDeathState = true;
        this.isRespawning = false; // Track respawn state
        this.deathStateStartTime = Date.now();
        this.playerState = 'death';
        this.respawnCountdown = character.states.death.respawnTime;
        this.killerName = killerName;
        this.weaponType = weaponType;
        this.killerId = killerId; // Store killer ID
        
        // Send kill attribution to server if we have a killer ID
        if (killerId && window.networkManager && window.networkManager.isConnected) {
            console.log(`Sending kill attribution to server: ${killerId} killed local player`);
            window.networkManager.sendKillAttribution(killerId);
        }
        
        // Play death sound (non-spatial for local player)
        try {
            if (AudioManager) {
                console.log("%c[LOCAL PLAYER DEATH SOUND]", "background: #ff0000; color: white; font-size: 16px;");
                AudioManager.play('death', { 
                    volume: 1.0,           // Full volume
                    pitchMin: 0.9,         // Less variation for death
                    pitchMax: 1.1,
                    allowOverlap: false    // Don't allow multiple death sounds
                });
            }
        } catch (error) {
            console.warn('Unable to play death sound:', error);
        }
        
        // Lock controls when dead
        this.setEnabled(false);
        
        // Force camera to freeze in place
        this.controls.unlock();
        
        // Create a flash effect when dying
        this.createDeathEffect();
        
        // Create death overlay
        this.createDeathOverlay();
        
        // Start respawn countdown
        this.startRespawnCountdown();
        
        // Send player state update over network
        if (window.networkManager && window.networkManager.isConnected) {
            window.networkManager.sendPlayerState(this.playerState);
        }
    }
    
    /**
     * Create a flash and visual effects when the player dies
     */
    createDeathEffect() {
        // Apply a screen shake effect
        const originalPosition = this.camera.position.clone();
        const shakeIntensity = 0.1;
        const shakeDuration = 500; // ms
        const startTime = Date.now();
        
        const shakeEffect = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed < shakeDuration) {
                // Apply random offset based on intensity and decreasing over time
                const factor = 1 - (elapsed / shakeDuration);
                const offsetX = (Math.random() * 2 - 1) * shakeIntensity * factor;
                const offsetY = (Math.random() * 2 - 1) * shakeIntensity * factor;
                
                // Apply shake to camera view (not position)
                this.camera.rotation.x += offsetY * 0.01;
                this.camera.rotation.y += offsetX * 0.01;
                
                requestAnimationFrame(shakeEffect);
            }
        };
        
        // Start shake animation
        shakeEffect();
    }
    
    /**
     * Create red tinted death overlay with respawn text
     */
    createDeathOverlay() {
        // Remove any existing overlay first
        this.removeDeathOverlay();
        
        // Create overlay container
        this.deathOverlay = document.createElement('div');
        this.deathOverlay.id = 'death-overlay';
        this.deathOverlay.style.position = 'absolute';
        this.deathOverlay.style.top = '0';
        this.deathOverlay.style.left = '0';
        this.deathOverlay.style.width = '100%';
        this.deathOverlay.style.height = '100%';
        this.deathOverlay.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
        this.deathOverlay.style.display = 'flex';
        this.deathOverlay.style.flexDirection = 'column';
        this.deathOverlay.style.justifyContent = 'center';
        this.deathOverlay.style.alignItems = 'center';
        this.deathOverlay.style.zIndex = '1000';
        this.deathOverlay.style.pointerEvents = 'none'; // Allow clicks to pass through
        
        // Add a "YOU DIED" message
        const deathMessage = document.createElement('div');
        deathMessage.style.color = 'white';
        deathMessage.style.fontSize = '64px';
        deathMessage.style.fontWeight = 'bold';
        deathMessage.style.textShadow = '0 0 10px black';
        deathMessage.style.marginBottom = '30px';
        deathMessage.textContent = 'YOU DIED';
        deathMessage.style.opacity = '0';
        deathMessage.style.transform = 'scale(0.5)';
        deathMessage.style.transition = 'all 0.5s ease-out';
        
        // Add custom death message if killer info is available
        let deathDescriptionText = '';
        if (this.killerName && this.weaponType) {
            // Get a random funny message from deathMessages
            const messages = [
                `${this.killerName} turned you into a snack with a ${this.weaponType}!`,
                `${this.killerName} put the food in food fight with their ${this.weaponType}!`,
                `That ${this.weaponType} from ${this.killerName} was served extra spicy!`,
                `${this.killerName} just food-KO'd you with a ${this.weaponType}!`,
                `${this.killerName}'s ${this.weaponType} had your name on it!`
            ];
            deathDescriptionText = messages[Math.floor(Math.random() * messages.length)];
        }
        
        // Create killer description if available
        if (deathDescriptionText) {
            const killerDescription = document.createElement('div');
            killerDescription.style.color = '#ffcc00';
            killerDescription.style.fontSize = '24px';
            killerDescription.style.fontWeight = 'bold';
            killerDescription.style.textShadow = '0 0 5px black';
            killerDescription.style.marginBottom = '20px';
            killerDescription.style.textAlign = 'center';
            killerDescription.style.maxWidth = '80%';
            killerDescription.textContent = deathDescriptionText;
            killerDescription.style.opacity = '0';
            killerDescription.style.transition = 'opacity 0.5s ease-out';
            
            // Add to overlay after death message
            this.deathOverlay.appendChild(deathMessage);
            this.deathOverlay.appendChild(killerDescription);
            
            // Fade in with delay
            setTimeout(() => {
                killerDescription.style.opacity = '1';
            }, 700);
        } else {
            // Just add the death message
            this.deathOverlay.appendChild(deathMessage);
        }
        
        // Create countdown text element
        this.respawnText = document.createElement('div');
        this.respawnText.style.color = 'white';
        this.respawnText.style.fontSize = '32px';
        this.respawnText.style.fontWeight = 'bold';
        this.respawnText.style.textShadow = '0 0 10px black';
        this.respawnText.textContent = `Respawning in ${this.respawnCountdown} seconds`;
        this.respawnText.style.opacity = '0';
        this.respawnText.style.transition = 'opacity 0.5s ease-out';
        
        // Add respawn text to overlay
        this.deathOverlay.appendChild(this.respawnText);
        
        // Add overlay to DOM
        document.body.appendChild(this.deathOverlay);
        
        // Trigger animations after a short delay
        setTimeout(() => {
            // Fade in the death message with animation
            deathMessage.style.opacity = '1';
            deathMessage.style.transform = 'scale(1)';
            
            // Fade in the respawn text
            setTimeout(() => {
                this.respawnText.style.opacity = '1';
            }, 500);
        }, 100);
        
        // Add vignette effect (darkened corners)
        const vignette = document.createElement('div');
        vignette.style.position = 'absolute';
        vignette.style.top = '0';
        vignette.style.left = '0';
        vignette.style.width = '100%';
        vignette.style.height = '100%';
        vignette.style.boxShadow = 'inset 0 0 150px 60px rgba(0, 0, 0, 0.8)';
        vignette.style.pointerEvents = 'none';
        vignette.style.zIndex = '999';
        document.body.appendChild(vignette);
        
        // Store vignette reference for cleanup
        this.vignetteEffect = vignette;
    }
    
    /**
     * Remove death overlay from DOM
     */
    removeDeathOverlay() {
        if (this.deathOverlay && this.deathOverlay.parentNode) {
            this.deathOverlay.parentNode.removeChild(this.deathOverlay);
            this.deathOverlay = null;
        }
        
        if (this.vignetteEffect && this.vignetteEffect.parentNode) {
            this.vignetteEffect.parentNode.removeChild(this.vignetteEffect);
            this.vignetteEffect = null;
        }
    }
    
    /**
     * Start the countdown to respawn
     */
    startRespawnCountdown() {
        if (!this.respawnCountdown) {
            console.error("No respawn countdown set");
            return;
        }
        
        console.log(`Starting respawn countdown: ${this.respawnCountdown} seconds`);
        
        // Clear any existing countdown
        if (this.respawnCountdownInterval) {
            clearInterval(this.respawnCountdownInterval);
        }
        
        // Initialize last update time
        let lastUpdate = Date.now();
        
        const updateCountdown = () => {
            const now = Date.now();
            const deltaTime = (now - lastUpdate) / 1000; // Convert to seconds
            lastUpdate = now;
            
            // Decrease countdown
            this.respawnCountdown -= deltaTime;
            
            // Update UI
            if (this.respawnText) {
                this.respawnText.textContent = `Respawning in ${Math.ceil(this.respawnCountdown)} seconds`;
            }
            
            // Check if countdown is complete
            if (this.respawnCountdown <= 0) {
                // Clear interval
                clearInterval(this.respawnCountdownInterval);
                
                console.log("Respawn countdown complete, respawning now...");
                
                // Actually respawn the player
                this.respawn();
            }
        };
        
        // Start a precise countdown that accounts for frame rate variations
        this.respawnCountdownInterval = setInterval(updateCountdown, 100);
    }
    
    /**
     * Respawn the player after death
     */
    respawn() {
        console.log("Respawning player");
        
        // Prevent premature respawn
        if (this.isRespawning) {
            console.log("Already respawning, ignoring duplicate call");
            return;
        }
        
        // Mark as respawning to prevent duplicate respawns
        this.isRespawning = true;
        
        // Remove death overlay with fade out effect
        if (this.deathOverlay) {
            this.deathOverlay.style.opacity = '0';
            this.deathOverlay.style.transition = 'opacity 0.5s ease-in';
            
            if (this.vignetteEffect) {
                this.vignetteEffect.style.opacity = '0';
                this.vignetteEffect.style.transition = 'opacity 0.5s ease-in';
            }
            
            // Wait for fade out before removing
            setTimeout(() => {
                this.removeDeathOverlay();
            }, 500);
        } else {
            this.removeDeathOverlay();
        }
        
        // Reset health
        this.healthManager.resetHealthFromRespawn();
        
        // Reset player state
        this.isInDeathState = false;
        this._playerState = 'idle';
        
        // Teleport to respawn position
        const respawnPos = character.states.death.defaultRespawnPosition;
        this.camera.position.set(respawnPos.x, respawnPos.y, respawnPos.z);
        
        // Reset velocity
        this.velocity.set(0, 0, 0);
        
        // Re-enable controls
        this.setEnabled(true);
        this.controls.lock();
        
        // Create respawn effect
        this.createRespawnEffect();
        
        // Send updated player state over network
        if (window.networkManager && window.networkManager.isConnected) {
            window.networkManager.sendPlayerState(this.playerState);
        }
        
        // Allow new deaths to happen
        setTimeout(() => {
            this.isRespawning = false;
        }, 1000); // Small buffer time to prevent immediate re-deaths
    }
    
    /**
     * Create a visual effect when respawning
     */
    createRespawnEffect() {
        // Flash the screen white
        const flashOverlay = document.createElement('div');
        flashOverlay.style.position = 'absolute';
        flashOverlay.style.top = '0';
        flashOverlay.style.left = '0';
        flashOverlay.style.width = '100%';
        flashOverlay.style.height = '100%';
        flashOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        flashOverlay.style.zIndex = '999';
        flashOverlay.style.pointerEvents = 'none';
        flashOverlay.style.transition = 'opacity 1s ease-out';
        document.body.appendChild(flashOverlay);
        
        // Fade out
        setTimeout(() => {
            flashOverlay.style.opacity = '0';
            setTimeout(() => {
                if (flashOverlay.parentNode) {
                    flashOverlay.parentNode.removeChild(flashOverlay);
                }
            }, 1000);
        }, 50);
    }

    /**
     * Set the character to the hit state
     */
    setHitState() {
        if (!this.isInHitState) {
            this.isInHitState = true;
            this.hitStateStartTime = Date.now();
            this.playerState = 'hit';
            
            // Send player state update over network
            if (window.networkManager && window.networkManager.isConnected) {
                window.networkManager.sendPlayerState(this.playerState);
            }
        }
    }
} 