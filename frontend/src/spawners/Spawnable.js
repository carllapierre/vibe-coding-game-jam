import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SpawnableRegistry } from '../registries/SpawnableRegistry.js';
import { ItemRegistry } from './../registries/ItemRegistry.js';

export class Spawnable {
    constructor(position, itemId) {
        this.position = position;
        this.isCollected = false;
        this.isDespawned = false;
        this.scene = null;
        this.model = null;
        this.glowLight = null;
        this.glowMesh = null;
        this.shadowMesh = null;
        this.particles = null;
        this.collectionParticles = [];
        this.quantity = 1; // Default quantity
        
        // Get spawnable configuration - use the itemId as the spawnable type
        const config = SpawnableRegistry.getSpawnableType(itemId);
        this.itemConfig = ItemRegistry.getType(itemId);
  
        // Store configuration
        this.config = {
            ...config,
            scale: config.scale * 1.25, // Increase configured scale by 25%
            glowIntensity: config.glowIntensity * 1.2, // Brighter glow
            glowRadius: config.glowRadius * 1.2, // Larger glow radius
            bobHeight: config.bobHeight * 1.2 // Higher bobbing
        };
        
        
        // Initialize animation state
        this.bobOffset = 0;
        this.rotation = 0;
        
        // Create glow effect
        this.createGlowEffect();
        
        // Create shadow effect
        this.createShadowEffect();
        
        // Create particle effect
        this.createParticleEffect();
        
        // Load the model
        this.loadModel();
    }

    loadModel() {
        const loader = new GLTFLoader();
        
        // Determine which path to use for the model
        const modelPath = this.itemConfig ? this.itemConfig.modelPath : this.config.modelPath;
        
        loader.load(
            modelPath,
            (gltf) => {
                this.model = gltf.scene;
                // Scale the model appropriately
                this.model.scale.set(this.config.scale, this.config.scale, this.config.scale);
                // Position the model
                this.model.position.copy(this.position);
                
                
                // If we already have a scene, add the model immediately
                if (this.scene) {
                    this.scene.add(this.model);
                }
            },
            (progress) => {
            },
            (error) => {
                console.error('Error loading food model:', error);
            }
        );
    }

    createGlowEffect() {
        // Create a point light for the glow
        this.glowLight = new THREE.PointLight(
            this.config.glowColor,
            this.config.glowIntensity,
            this.config.glowRadius
        );
        this.glowLight.position.copy(this.position);
        
        // Only create the glow mesh if configured to show it
        if (this.config.showGlowMesh) {
            const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: this.config.glowColor,
                transparent: true,
                opacity: 0.3
            });
            this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
            this.glowMesh.position.copy(this.position);
        }
    }

    createShadowEffect() {
        // Create a circular shadow plane with gradient
        const shadowGeometry = new THREE.CircleGeometry(1, 32);
        const gradientTexture = this.createGradientTexture();
        const shadowMaterial = new THREE.MeshBasicMaterial({
            map: gradientTexture,
            transparent: true,
            opacity: this.config.shadowOpacity,
            side: THREE.DoubleSide
        });
        
        this.shadowMesh = new THREE.Mesh(shadowGeometry, shadowMaterial);
        this.shadowMesh.rotation.x = -Math.PI / 2; // Lay flat on the ground
        this.shadowMesh.position.copy(this.position);
        this.shadowMesh.position.y = 0.01; // Slightly above ground to prevent z-fighting
        this.shadowMesh.scale.set(this.config.shadowScale, this.config.shadowScale, this.config.shadowScale);
    }

    createGradientTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(
            canvas.width / 2, 0, 0,
            canvas.width / 2, 0, canvas.width / 2
        );
        
        gradient.addColorStop(0, 'rgba(173, 216, 230, 0.3)'); // Light blue with opacity
        gradient.addColorStop(1, 'rgba(173, 216, 230, 0)');   // Transparent
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    createParticleEffect() {
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.config.particleCount * 3);
        const velocities = new Float32Array(this.config.particleCount * 3);
        
        // Initialize particles in a sphere around the spawnable
        for (let i = 0; i < this.config.particleCount; i++) {
            const i3 = i * 3;
            const radius = this.config.particleRadius;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 2;
            
            positions[i3] = Math.sin(theta) * Math.cos(phi) * radius;
            positions[i3 + 1] = Math.sin(theta) * Math.sin(phi) * radius;
            positions[i3 + 2] = Math.cos(theta) * radius;
            
            // Random velocities
            velocities[i3] = (Math.random() - 0.5) * this.config.particleSpeed;
            velocities[i3 + 1] = (Math.random() - 0.5) * this.config.particleSpeed;
            velocities[i3 + 2] = (Math.random() - 0.5) * this.config.particleSpeed;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: this.config.particleColor,
            size: this.config.particleSize,
            transparent: true,
            opacity: 0.6
        });
        
        this.particles = new THREE.Points(particleGeometry, particleMaterial);
        this.particles.position.copy(this.position);
        this.particleVelocities = velocities;
    }

    addToScene(scene) {
        this.scene = scene;
        if (this.model) {
            scene.add(this.model);
        }
        scene.add(this.glowLight);
        if (this.glowMesh) {
            scene.add(this.glowMesh);
        }
        if (this.shadowMesh) {
            scene.add(this.shadowMesh);
        }
        if (this.particles) {
            scene.add(this.particles);
        }
    }

    update() {
        if (!this.scene || this.isCollected || this.isDespawned) return;

        // Update bobbing motion
        this.bobOffset += this.config.bobSpeed;
        const bobY = Math.sin(this.bobOffset) * this.config.bobHeight;
        
        // Update rotation
        this.rotation += this.config.rotationSpeed;

        // Update model position and rotation
        if (this.model) {
            this.model.position.y = this.position.y + bobY;
            this.model.rotation.y = this.rotation;
        }

        // Update glow position
        this.glowLight.position.y = this.position.y + bobY;
        if (this.glowMesh) {
            this.glowMesh.position.y = this.position.y + bobY;
        }

        // Update shadow opacity based on height
        if (this.shadowMesh) {
            const maxHeight = this.config.bobHeight;
            const currentHeight = bobY;
            const shadowOpacity = this.config.shadowOpacity * (1 - (currentHeight / maxHeight));
            this.shadowMesh.material.opacity = shadowOpacity;
        }

        // Update particles
        if (this.particles) {
            const positions = this.particles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += this.particleVelocities[i];
                positions[i + 1] += this.particleVelocities[i + 1];
                positions[i + 2] += this.particleVelocities[i + 2];

                // Keep particles within bounds
                const distance = Math.sqrt(
                    positions[i] ** 2 + 
                    positions[i + 1] ** 2 + 
                    positions[i + 2] ** 2
                );

                if (distance > this.config.particleRadius) {
                    // Reset particle to center with new random velocity
                    positions[i] = 0;
                    positions[i + 1] = 0;
                    positions[i + 2] = 0;
                    this.particleVelocities[i] = (Math.random() - 0.5) * this.config.particleSpeed;
                    this.particleVelocities[i + 1] = (Math.random() - 0.5) * this.config.particleSpeed;
                    this.particleVelocities[i + 2] = (Math.random() - 0.5) * this.config.particleSpeed;
                }
            }
            this.particles.geometry.attributes.position.needsUpdate = true;
        }
    }

    collect(player) {
        if (this.isCollected) return;
        
        this.isCollected = true;
        
        if (this.itemConfig && this.itemConfig.onCollect) {
            // Pass the quantity to the onCollect callback through a custom object
            const collectionData = {
                quantity: this.quantity,
                itemId: this.itemConfig.id
            };

            try {
                this.itemConfig.onCollect(player, collectionData);
            } catch (error) {
                console.error('Error in onCollect handler:', error);
                // Continue with animation even if the callback fails
            }
        }
        
        // Start collection animation/effects
        this.startCollectionAnimation().then(() => {
            // Clean up after animation completes
            this.cleanup();
        }).catch(error => {
            console.error('Error during collection animation:', error);
            // Force cleanup anyway to prevent stuck items
            this.cleanup();
        });
    }

    startCollectionAnimation() {
        return new Promise((resolve) => {
            if (!this.scene) {
                resolve();
                return;
            }
            
            const duration = 500; // Animation duration in ms
            const startTime = Date.now();
            const startScale = this.model ? this.model.scale.x : this.config.scale;
            
            // Create collection particles
            const particleCount = 20;
            this.collectionParticles = [];
            
            for (let i = 0; i < particleCount; i++) {
                const geometry = new THREE.SphereGeometry(0.05, 8, 8);
                const material = new THREE.MeshBasicMaterial({
                    color: this.config.glowColor,
                    transparent: true,
                    opacity: 0.8
                });
                const particle = new THREE.Mesh(geometry, material);
                
                // Position particle around the item
                const angle = (i / particleCount) * Math.PI * 2;
                const radius = 0.3;
                particle.position.set(
                    this.position.x + Math.cos(angle) * radius,
                    this.position.y,
                    this.position.z + Math.sin(angle) * radius
                );
                
                // Store initial position and random velocity
                particle.userData.startPos = particle.position.clone();
                particle.userData.velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    Math.random() * 0.1,
                    (Math.random() - 0.5) * 0.1
                );
                
                if (this.scene) {
                    this.scene.add(particle);
                    this.collectionParticles.push(particle);
                }
            }
            
            const animate = () => {
                if (!this.scene) {
                    this.cleanupCollectionParticles();
                    resolve();
                    return;
                }
                
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Shrink the model
                if (this.model) {
                    const scale = startScale * (1 - progress);
                    this.model.scale.set(scale, scale, scale);
                }
                
                // Update glow
                if (this.glowLight) {
                    this.glowLight.intensity = this.config.glowIntensity * (1 - progress);
                }
                if (this.glowMesh) {
                    this.glowMesh.material.opacity = 0.3 * (1 - progress);
                }
                
                // Update shadow
                if (this.shadowMesh) {
                    this.shadowMesh.material.opacity = this.config.shadowOpacity * (1 - progress);
                }
                
                // Update particles
                this.collectionParticles.forEach(particle => {
                    particle.position.add(particle.userData.velocity);
                    particle.userData.velocity.y += 0.001;
                    particle.material.opacity = 0.8 * (1 - progress);
                    const particleScale = 1 - progress * 0.5;
                    particle.scale.set(particleScale, particleScale, particleScale);
                });
                
                if (progress < 1 && this.scene) {
                    requestAnimationFrame(animate);
                } else {
                    this.cleanupCollectionParticles();
                    resolve();
                }
            };
            
            animate();
        });
    }
    
    cleanupCollectionParticles() {
        // Safely remove particles and dispose resources
        if (this.scene) {
            this.collectionParticles.forEach(particle => {
                this.scene.remove(particle);
                if (particle.geometry) particle.geometry.dispose();
                if (particle.material) {
                    if (Array.isArray(particle.material)) {
                        particle.material.forEach(mat => mat.dispose());
                    } else {
                        particle.material.dispose();
                    }
                }
            });
        }
        this.collectionParticles = [];
    }

    despawn() {
        this.isDespawned = true;
        this.cleanup();
    }

    cleanup() {
        if (!this.scene) return; // Already cleaned up

        try {
            // Remove model and dispose its resources
            if (this.model) {
                this.scene.remove(this.model);
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(mat => {
                                    if (mat.map) mat.map.dispose();
                                    mat.dispose();
                                });
                            } else {
                                if (child.material.map) child.material.map.dispose();
                                child.material.dispose();
                            }
                        }
                    }
                });
                this.model = null;
            }

            // Remove glow light
            if (this.glowLight) {
                this.scene.remove(this.glowLight);
                this.glowLight = null;
            }

            // Remove glow mesh and dispose its resources
            if (this.glowMesh) {
                this.scene.remove(this.glowMesh);
                if (this.glowMesh.geometry) this.glowMesh.geometry.dispose();
                if (this.glowMesh.material) {
                    if (this.glowMesh.material.map) this.glowMesh.material.map.dispose();
                    this.glowMesh.material.dispose();
                }
                this.glowMesh = null;
            }

            // Remove shadow mesh and dispose its resources
            if (this.shadowMesh) {
                this.scene.remove(this.shadowMesh);
                if (this.shadowMesh.geometry) this.shadowMesh.geometry.dispose();
                if (this.shadowMesh.material) {
                    if (this.shadowMesh.material.map) this.shadowMesh.material.map.dispose();
                    this.shadowMesh.material.dispose();
                }
                this.shadowMesh = null;
            }

            // Remove particles and dispose their resources
            if (this.particles) {
                this.scene.remove(this.particles);
                if (this.particles.geometry) this.particles.geometry.dispose();
                if (this.particles.material) this.particles.material.dispose();
                this.particles = null;
            }

            // Clean up collection particles
            this.cleanupCollectionParticles();
            
            // Force garbage collection hint
            if (window.gc) window.gc();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }

        // Clear references
        this.scene = null;
        this.isCollected = true;
        this.isDespawned = true;
    }
} 