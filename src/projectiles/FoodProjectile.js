import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

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

    constructor({ scene, position, direction, foodModel, scale = 1, speed = 0.5, gravity = 0.01, arcHeight = 0.2, lifetime = 5000 }) {
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
        
        // Set initial velocity with arc
        this.velocity.copy(direction).multiplyScalar(speed);
        this.velocity.y += arcHeight;
        
        // Load the model
        const loader = new GLTFLoader();
        loader.load(`/public/assets/objects/${foodModel}`, (gltf) => {
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
        const hasCollision = FoodProjectile.collidableObjects.some(obj => obj.box.intersectsSphere(projectileSphere));

        if (hasCollision) {
            // Create particle effect at the current position before destroying
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
} 