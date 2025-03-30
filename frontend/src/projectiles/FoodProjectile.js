import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HitMarker } from './HitMarker.js';
import assetManager from '../utils/AssetManager.js';

export class FoodProjectile {
    static activeProjectiles = [];
    static collidableObjects = [];

    static registerProjectile(projectile) {
        FoodProjectile.activeProjectiles.push(projectile);
    }

    static updateCollidableObjects(objects) {
        FoodProjectile.collidableObjects = objects;
    }

    static updateAll() {
        for (let i = FoodProjectile.activeProjectiles.length - 1; i >= 0; i--) {
            const projectile = FoodProjectile.activeProjectiles[i];
            projectile.update();
            
            if (!projectile.isActive) {
                FoodProjectile.activeProjectiles.splice(i, 1);
            }
        }
    }

    constructor({ scene, position, direction, path, scale = 1, speed = 0.5, gravity = 0.01, arcHeight = 0.2, lifetime = 5000, onCollision = null }) {
        this.scene = scene;
        this.position = position;
        this.direction = direction;
        this.speed = speed;
        this.gravity = gravity;
        this.arcHeight = arcHeight;
        this.lifetime = lifetime;
        this.isActive = true;
        this.spawnTime = Date.now();
        this.velocity = new THREE.Vector3();
        this.scale = scale;
        this.onCollision = onCollision;
        
        // Set initial velocity with arc
        this.velocity.copy(direction).multiplyScalar(speed);
        this.velocity.y += arcHeight;
        
        // Load the model using AssetManager
        assetManager.loadModel(path, (gltf) => {
            this.model = gltf.scene;
            this.model.scale.set(scale, scale, scale);
            this.model.position.copy(position);
            this.scene.add(this.model);
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

    update() {
        if (!this.isActive || !this.model) return;

        // Check lifetime
        if (Date.now() - this.spawnTime > this.lifetime) {
            this.destroy();
            return;
        }

        // Apply gravity
        this.velocity.y -= this.gravity;

        // Update position
        const nextPosition = this.model.position.clone().add(this.velocity);
        
        // Check for collisions with static collidable objects
        const projectileSphere = new THREE.Sphere(nextPosition, 0.2 * this.scale);
        const raycaster = new THREE.Raycaster();
        
        // Check collision with each collidable object's meshes
        let collision = null;
        for (const obj of FoodProjectile.collidableObjects) {
            // First do a quick bounding box check
            if (!obj.box.intersectsSphere(projectileSphere)) {
                continue;
            }
            
            // If the bounding box intersects, do precise mesh collision detection
            for (const mesh of obj.meshes) {
                raycaster.set(this.model.position, this.velocity.clone().normalize());
                const intersects = raycaster.intersectObject(mesh);
                
                if (intersects.some(intersect => intersect.distance < this.velocity.length())) {
                    // We found a collision
                    collision = {
                        object: obj,
                        position: this.model.position.clone()
                    };
                    break;
                }
            }
            
            if (collision) break;
        }

        if (collision) {
            // If we have a collision callback, call it with the collided object
            if (this.onCollision && typeof this.onCollision === 'function') {
                this.onCollision(collision.object);
            }
            
            // Create the appropriate hit marker effect based on what was hit
            if (collision.object.type === 'player') {
                if (collision.object.player) {
                    console.log('Hit networked player:', collision.object.player.sessionId);
                    
                    // Create a 3D hit marker at the collision point
                    HitMarker.create({
                        scene: this.scene,
                        position: this.model.position.clone(),
                        type: 'player',
                        color: 0xff3333, // Red color for player hits
                        camera: window.camera // Pass the main camera
                    });
                    
                    // Enhance UI hit marker to make sure it's visible
                    this.showUiHitmarker();
                    
                    // We could add player hit effects or damage here for networked players
                    // Example: collision.object.player.onHit(this);
                } 
                else if (collision.object.isLocalPlayer) {
                    console.log('Hit local player!');
                    
                    // If we hit the local character, trigger health reduction
                    // Get the main character instance from window
                    const mainCharacter = window.character || character;
                    
                    if (mainCharacter && mainCharacter.healthManager) {
                        // Standard damage amount (could be customized based on projectile type)
                        const damageAmount = 5;
                        
                        // Apply damage to the local player
                        mainCharacter.healthManager.removeHealth(damageAmount);
                        
                        // Visual hit effect
                        this.createPlayerHitEffect();
                    }
                }
            } else {
                // Environment hit
                HitMarker.create({
                    scene: this.scene,
                    position: this.model.position.clone(),
                    type: 'environment',
                    camera: window.camera
                });
            }
            
            // Still create the particle effect
            this.createParticleEffect(this.model.position);
            
            this.destroy();
            return;
        }

        // Update model position
        this.model.position.copy(nextPosition);
        
        // Update rotation for visual effect
        this.model.rotation.x += 0.1;
        this.model.rotation.z += 0.1;
    }

    destroy() {
        if (!this.isActive) return;
        
        this.isActive = false;
        if (this.model) {
            this.scene.remove(this.model);
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.dispose();
                    child.material.dispose();
                }
            });
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
                document.body.removeChild(hitOverlay);
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
} 