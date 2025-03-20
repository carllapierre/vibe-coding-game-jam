import * as THREE from 'three';
import { GLTFLoader } from './../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { SpawnableRegistry } from './SpawnableRegistry.js';
import { ItemRegistry } from './ItemRegistry.js';

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
        
        // Get item configuration
        this.itemConfig = ItemRegistry.getItem(itemId);
        if (!this.itemConfig) {
            console.error(`Item with id ${itemId} not found in ItemRegistry, looking in SpawnableRegistry instead`);
            // Try to get the config from spawnable registry instead
        }
        
        // Get spawnable configuration - use the itemId as the spawnable type
        const config = SpawnableRegistry.getSpawnableType(itemId);
  
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
        console.log('Loading model from:', modelPath);
        
        loader.load(
            modelPath,
            (gltf) => {
                console.log('Model loaded successfully');
                this.model = gltf.scene;
                // Scale the model appropriately
                this.model.scale.set(this.config.scale, this.config.scale, this.config.scale);
                // Position the model
                this.model.position.copy(this.position);
                
                // Debug: Log model details
                console.log('Model position:', this.model.position);
                console.log('Model scale:', this.model.scale);
                console.log('Model rotation:', this.model.rotation);
                
                // If we already have a scene, add the model immediately
                if (this.scene) {
                    console.log('Adding model to existing scene');
                    this.scene.add(this.model);
                }
            },
            (progress) => {
                console.log('Loading progress:', (progress.loaded / progress.total * 100) + '%');
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
        console.log('Adding spawnable to scene');
        this.scene = scene;
        if (this.model) {
            console.log('Adding existing model to scene');
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
            this.itemConfig.onCollect(player, collectionData);
        }
        
        // Start collection animation/effects
        this.startCollectionAnimation().then(() => {
            // Clean up after animation completes
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
                particle.geometry.dispose();
                particle.material.dispose();
            });
        }
        this.collectionParticles = [];
    }

    despawn() {
        this.isDespawned = true;
        this.cleanup();
    }

    cleanup() {
        if (this.scene) {
            // Remove model and dispose its resources
            if (this.model) {
                this.scene.remove(this.model);
                this.model.traverse((child) => {
                    if (child.isMesh) {
                        child.geometry.dispose();
                        child.material.dispose();
                    }
                });
            }

            // Remove glow light
            if (this.glowLight) {
                this.scene.remove(this.glowLight);
            }

            // Remove glow mesh and dispose its resources
            if (this.glowMesh) {
                this.scene.remove(this.glowMesh);
                this.glowMesh.geometry.dispose();
                this.glowMesh.material.dispose();
            }

            // Remove shadow mesh and dispose its resources
            if (this.shadowMesh) {
                this.scene.remove(this.shadowMesh);
                this.shadowMesh.geometry.dispose();
                this.shadowMesh.material.dispose();
            }

            // Remove particles and dispose their resources
            if (this.particles) {
                this.scene.remove(this.particles);
                this.particles.geometry.dispose();
                this.particles.material.dispose();
            }

            // Clear scene reference
            this.scene = null;
        }
    }
} 