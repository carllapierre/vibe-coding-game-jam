import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Projectile } from './Projectile.js';

export class FoodProjectile extends Projectile {
    constructor({
        scene,
        position,
        direction,
        foodModel, // Path to the food GLB file
        scale = 1,
        ...projectileOptions
    }) {
        super({
            scene,
            position,
            direction,
            ...projectileOptions
        });

        // Hide the default mesh until the model is loaded
        this.mesh.visible = false;

        // Load the food model
        const loader = new GLTFLoader();
        loader.load(`/public/assets/objects/${foodModel}`, (gltf) => {
            // Remove the default mesh
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();

            // Set up the food model
            this.mesh = gltf.scene;
            this.mesh.scale.set(scale, scale, scale);
            this.mesh.position.copy(position);
            
            // Add random rotation for more interesting throws
            this.rotationSpeed = {
                x: (Math.random() - 0.5) * 0.1,
                y: (Math.random() - 0.5) * 0.1,
                z: (Math.random() - 0.5) * 0.1
            };

            this.scene.add(this.mesh);
        }, undefined, (error) => {
            console.error('Error loading food model:', error);
        });
    }

    update() {
        if (!this.isActive) return;

        super.update();

        // Add rotation to the food model
        if (this.mesh && this.rotationSpeed) {
            this.mesh.rotation.x += this.rotationSpeed.x;
            this.mesh.rotation.y += this.rotationSpeed.y;
            this.mesh.rotation.z += this.rotationSpeed.z;
        }
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

    handleCollision() {
        this.createParticleEffect(this.mesh.position);
        super.handleCollision();
    }
} 