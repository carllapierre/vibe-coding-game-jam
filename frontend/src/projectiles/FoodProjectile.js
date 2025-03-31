import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HitMarker } from './HitMarker.js';
import assetManager from '../utils/AssetManager.js';
import { ItemRegistry } from '../registries/ItemRegistry.js';
import { assetPath } from '../utils/pathHelper.js';

export class FoodProjectile {
    static activeProjectiles = [];
    static collidableObjects = [];
    static DEBUG = false; // Set to true to enable debug logs

    static registerProjectile(projectile) {
        FoodProjectile.activeProjectiles.push(projectile);
        if (FoodProjectile.DEBUG) console.log(`Projectile registered, total: ${FoodProjectile.activeProjectiles.length}`);
    }

    static updateCollidableObjects(objects) {
        FoodProjectile.collidableObjects = objects;
    }

    static updateAll() {
        for (let i = FoodProjectile.activeProjectiles.length - 1; i >= 0; i--) {
            const projectile = FoodProjectile.activeProjectiles[i];
            projectile.update();
            
            if (!projectile.active) {
                if (FoodProjectile.DEBUG) console.log(`Removing inactive projectile, remaining: ${FoodProjectile.activeProjectiles.length - 1}`);
                FoodProjectile.activeProjectiles.splice(i, 1);
            }
        }
    }

    constructor({ scene, position, direction, scale = 1, speed = 0.5, gravity = 0.01, arcHeight = 0.2, lifetime = 5000, onCollision = null, itemType = 'tomato', damage = 10, isOwnProjectile = false, isNetworked = false }) {
        this.scene = scene;
        this.position = position.clone();
        this.direction = direction.normalize();
        this.itemType = itemType;
        this.scale = scale;
        this.speed = speed;
        this.gravity = gravity;
        this.arcHeight = arcHeight;
        this.lifetime = lifetime;
        this.onCollision = onCollision;
        this.damage = damage;
        this.spawnTime = Date.now();
        this.velocity = this.direction.clone().multiplyScalar(this.speed);
        this.active = true;
        this.model = null;
        this.modelLoaded = false;
        this.collisionRadius = 0.25 * this.scale;
        this.isOwnProjectile = isOwnProjectile;
        this.isNetworked = isNetworked;
        
        // Set initial velocity with arc
        this.velocity.y += arcHeight;
        
        // Load the actual food model
        this.loadModel();
        
        // Register with projectile system
        FoodProjectile.registerProjectile(this);
    }

    loadModel() {
        const model = ItemRegistry.getType(this.itemType);
        assetManager.loadModel(assetPath(`objects/${model.model}`), (gltf) => {
            if (!this.active) return; // Skip if already destroyed
            
                this.model = gltf.scene.clone();
                this.model.scale.set(this.scale, this.scale, this.scale);
                this.model.position.copy(this.position);
                this.scene.add(this.model);
                this.modelLoaded = true;
        });
    }

    createParticleEffect(position) {
        const particleCount = 20;
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const velocities = [];
        
        for (let i = 0; i < particleCount; i++) {
            // Random position around the impact point
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2
            );
            positions.push(...position.clone().add(offset).toArray());
            
            // Random velocity
            velocities.push(
                (Math.random() - 0.5) * 0.1,
                Math.random() * 0.1,
                (Math.random() - 0.5) * 0.1
            );
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.05,
            transparent: true,
            opacity: 1
        });

        const particles = new THREE.Points(geometry, material);
        this.scene.add(particles);

        // Animate and remove particles
        const startTime = Date.now();
        const duration = 1000; // 1 second

        const animateParticles = () => {
            const elapsed = Date.now() - startTime;
            const positions = geometry.attributes.position.array;
            
            // Update positions and opacity
            for (let i = 0; i < particleCount; i++) {
                positions[i * 3] += velocities[i * 3];
                positions[i * 3 + 1] += velocities[i * 3 + 1] - 0.001; // Add gravity
                positions[i * 3 + 2] += velocities[i * 3 + 2];
            }

            geometry.attributes.position.needsUpdate = true;
            material.opacity = 1 - (elapsed / duration);

            if (elapsed < duration) {
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
     * Create a hit effect based on what was hit
     * @param {Object} collidable - The object that was hit
     */
    createHitEffect(collidable) {
        if (!this.model) return;
        
        const hitPosition = this.model.position.clone();
        
        if (collidable.type === 'player') {
            if (collidable.player) {
                if (FoodProjectile.DEBUG) console.log(`Hit networked player: ${collidable.player.sessionId}`);
                
                // Create a 3D hit marker at the collision point
                HitMarker.create({
                    scene: this.scene,
                    position: hitPosition,
                    type: 'player',
                    color: 0xff3333, // Red color for player hits
                    camera: window.camera // Pass the main camera
                });
                
                // Enhance UI hit marker to make sure it's visible
                this.showUiHitmarker();
            } 
            else if (collidable.isLocalPlayer) {
                if (FoodProjectile.DEBUG) console.log('Hit local player!');
                
                // Create player hit flash effect
                this.createPlayerHitEffect();
            }
        } else {
            // Environment hit
            HitMarker.create({
                scene: this.scene,
                position: hitPosition,
                type: 'environment',
                camera: window.camera
            });
        }
        
        // Always create particle effect
        this.createParticleEffect(hitPosition);
    }

    /**
     * Update the projectile position and check for collisions
     */
    update() {
        // Skip if inactive
        if (!this.active) return;
        
        // Check lifetime
        if (Date.now() - this.spawnTime > this.lifetime) {
            if (FoodProjectile.DEBUG) console.log("Projectile lifetime expired");
            this.destroy();
            return;
        }
        
        // Update position based on velocity
        this.position.add(this.velocity);
        
        // Apply gravity
        this.velocity.y -= this.gravity;
        
        // Update model position
        if (this.model) {
            this.model.position.copy(this.position);
            
            // Update rotation for visual effect
            this.model.rotation.x += 0.1;
            this.model.rotation.z += 0.1;
            
            // Check for collisions when model exists
            if (this.checkCollisions()) {
                if (FoodProjectile.DEBUG) console.log("Projectile collision detected");
                this.destroy();
                return;
            }
        }
        
        // Check if this projectile has fallen below the floor
        if (this.position.y < -5) {
            this.destroy();
        }
    }

    destroy() {
        if (!this.active) return;
        
        if (FoodProjectile.DEBUG) console.log("Destroying projectile");
        this.active = false;
        
        if (this.model) {
            this.scene.remove(this.model);
            
            // Dispose of resources
            this.model.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
            
            this.model = null;
        }
    }

    /**
     * Create a red flash effect when player is hit
     */
    createPlayerHitEffect() {
        // Create a full-screen flash overlay
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

    /**
     * Show a UI hitmarker in the center of the screen
     */
    showUiHitmarker() {
        // Create container if it doesn't exist
        let container = document.getElementById('hitmarker-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'hitmarker-container';
            container.style.position = 'fixed';
            container.style.top = '0';
            container.style.left = '0';
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.pointerEvents = 'none';
            container.style.zIndex = '10000'; // Very high z-index to ensure visibility
            document.body.appendChild(container);
        }
        
        const words = ['Hit!', 'Oooof!', 'Vibes', 'Heck Yeah!', 'Vibin!']
        // Create text-based hitmarker
        const hitmarker = document.createElement('div');
        hitmarker.className = 'hitmarker';
        hitmarker.style.position = 'absolute';
        hitmarker.style.color = '#ffa500'; //pastel orange;
        hitmarker.style.fontFamily = 'Arial, sans-serif';
        hitmarker.style.fontSize = '16px';
        hitmarker.style.fontWeight = 'bold';
        hitmarker.style.textShadow = '0 0 3px rgba(0, 0, 0, 1)';
        hitmarker.style.userSelect = 'none';
        hitmarker.textContent = words[Math.floor(Math.random() * words.length)];
        
        // Position in random location near center
        // Get viewport dimensions
        const vpWidth = window.innerWidth;
        const vpHeight = window.innerHeight;
        
        // Center coordinates
        const centerX = vpWidth / 2;
        const centerY = vpHeight / 2;
        
        // Random offset from center (limited to a small area around crosshair)
        const offsetX = (Math.random() - 0.5) * 100; // +/- 50px from center
        const offsetY = (Math.random() - 0.5) * 100; // +/- 50px from center
        
        // Set position
        hitmarker.style.left = `${centerX + offsetX}px`;
        hitmarker.style.top = `${centerY + offsetY}px`;
        hitmarker.style.transform = 'translate(-50%, -50%)'; // Center the text on its position
        
        // Add to container
        container.appendChild(hitmarker);
        
        // Animate the hitmarker
        setTimeout(() => {
            // Random slight rotation for dynamic feel
            const randomRotation = (Math.random() - 0.5) * 10; // +/- 5 degrees
            
            hitmarker.style.transition = 'all 0.15s ease-out';
            hitmarker.style.transform = `translate(-50%, -50%) scale(1.5) rotate(${randomRotation}deg)`;
            hitmarker.style.opacity = '1';
            
            // Then fade out
            setTimeout(() => {
                hitmarker.style.transition = 'all 0.5s ease-in';
                hitmarker.style.opacity = '0';
                hitmarker.style.transform = `translate(-50%, -50%) scale(1) rotate(${randomRotation}deg)`;
                
                // Remove after animation
                setTimeout(() => {
                    if (container.contains(hitmarker)) {
                        container.removeChild(hitmarker);
                    }
                    
                    // Remove container if empty
                    if (container.children.length === 0) {
                        if (document.body.contains(container)) {
                            document.body.removeChild(container);
                        }
                    }
                }, 500);
            }, 200);
        }, 0);
        
        // Show a second "Hit!" for visual emphasis (staggered timing)
        if (Math.random() > 0.5) { // 50% chance for a second hit marker
            setTimeout(() => {
                const words = ['Hit!', 'Oooof!', 'Vibes', 'Gotcha', 'Vibin!']

                // Create a second hit marker
                const secondHit = document.createElement('div');
                secondHit.className = 'hitmarker';
                secondHit.style.position = 'absolute';
                secondHit.style.color = '#ffa500'; 
                secondHit.style.fontFamily = 'Arial, sans-serif';
                secondHit.style.fontSize = '20px';
                secondHit.style.fontWeight = 'bold';
                secondHit.style.textShadow = '0 0 3px rgba(0, 0, 0, 1)';
                secondHit.style.userSelect = 'none';
                secondHit.textContent = words[Math.floor(Math.random() * words.length)];
                
                // Different random position
                const offset2X = (Math.random() - 0.5) * 150; // Wider spread
                const offset2Y = (Math.random() - 0.5) * 150;
                
                secondHit.style.left = `${centerX + offset2X}px`;
                secondHit.style.top = `${centerY + offset2Y}px`;
                secondHit.style.transform = 'translate(-50%, -50%)';
                secondHit.style.opacity = '0.8'; // Start slightly more transparent
                
                container.appendChild(secondHit);
                
                // Animate with different timing
                const randomRotation2 = (Math.random() - 0.8) * 15; // More rotation
                
                secondHit.style.transition = 'all 0.4s ease-out';
                secondHit.style.transform = `translate(-50%, -50%) scale(1.3) rotate(${randomRotation2}deg)`;
                
                setTimeout(() => {
                    secondHit.style.transition = 'all 0.6s ease-in';
                    secondHit.style.opacity = '0';
                    secondHit.style.transform = `translate(-50%, -50%) scale(0.9) rotate(${randomRotation2}deg)`;
                    
                    setTimeout(() => {
                        if (container.contains(secondHit)) {
                            container.removeChild(secondHit);
                        }
                    }, 400);
                }, 150);
            }, 70); // Slight delay from the first hit
        }
    }

    /**
     * Check for collisions with objects in the scene
     * @returns {boolean} true if collision occurred
     */
    checkCollisions() {
        // Skip if no collidable objects or collision disabled or model not loaded
        if (!this.active || !this.modelLoaded || !this.model || 
            !FoodProjectile.collidableObjects || FoodProjectile.collidableObjects.length === 0) {
            return false;
        }
        
        // Create a sphere for collision detection
        const projectileSphere = new THREE.Sphere(this.model.position, this.collisionRadius);
        
        // We need to rotate the trajectory direction based on the initial direction
        const collisionVelocity = this.velocity.clone();
        
        // Check against all collidable objects
        for (const collidable of FoodProjectile.collidableObjects) {
            // Skip if invalid object
            if (!collidable || !collidable.box) continue;
            
            // Skip collision with own player if this is the player's projectile
            if (this.isOwnProjectile && collidable.isLocalPlayer) continue;
            
            // First do a quick bounding box check
            if (!collidable.box.intersectsSphere(projectileSphere)) {
                continue;
            }
            
            // Then do more detailed mesh checks if meshes are available
            if (collidable.meshes && collidable.meshes.length > 0) {
                const collided = collidable.meshes.some(mesh => {
                    if (!mesh) return false;
                    
                    // Create ray pointing in the direction of travel
                    const raycaster = new THREE.Raycaster();
                    const rayOrigin = this.model.position.clone().sub(collisionVelocity.clone().multiplyScalar(0.2));
                    raycaster.set(rayOrigin, collisionVelocity.normalize());
                    
                    // Check for intersection
                    const intersects = raycaster.intersectObject(mesh);
                    return intersects.length > 0 && intersects[0].distance < this.collisionRadius * 2;
                });
                
                if (collided) {
                    if (FoodProjectile.DEBUG) console.log(`Collision detected with: ${collidable.type}${collidable.isLocalPlayer ? ' (local player)' : ''}`);
                    
                    // For networked projectiles hitting local player, apply damage via handleHit callback
                    if (this.isNetworked && collidable.isLocalPlayer && collidable.handleHit) {
                        collidable.handleHit(this.damage);
                    }
                    
                    // Pass all necessary item data including isOwnProjectile flag
                    if (this.onCollision) {
                        this.onCollision(collidable, {
                            id: this.itemType,
                            damage: this.damage,
                            scale: this.scale,
                            isOwnProjectile: this.isOwnProjectile,
                            isNetworked: this.isNetworked
                        });
                    }
                    
                    // Create hit effect at the collision point
                    this.createHitEffect(collidable);
                    
                    return true;
                }
            } else {
                // No meshes to check, just use the box - this is a simplification for performance
                if (FoodProjectile.DEBUG) console.log(`Simple box collision with: ${collidable.type}${collidable.isLocalPlayer ? ' (local player)' : ''}`);
                
                // For networked projectiles hitting local player, apply damage via handleHit callback
                if (this.isNetworked && collidable.isLocalPlayer && collidable.handleHit) {
                    collidable.handleHit(this.damage);
                }
                
                // Pass all necessary item data including isOwnProjectile flag
                if (this.onCollision) {
                    this.onCollision(collidable, {
                        id: this.itemType,
                        damage: this.damage,
                        scale: this.scale,
                        isOwnProjectile: this.isOwnProjectile,
                        isNetworked: this.isNetworked
                    });
                }
                
                // Create hit effect at the collision point
                this.createHitEffect(collidable);
                
                return true;
            }
        }
        
        return false;
    }
} 