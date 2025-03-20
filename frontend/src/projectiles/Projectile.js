import * as THREE from 'three';

export class Projectile {
    constructor({
        scene,
        position,
        direction,
        speed = 0.5,
        gravity = 0.01,
        arcHeight = 0.2,
        lifetime = 5000, // milliseconds
        onHit = () => {},
        collidableObjects = []
    }) {
        this.scene = scene;
        this.speed = speed;
        this.gravity = gravity;
        this.arcHeight = arcHeight;
        this.lifetime = lifetime;
        this.onHit = onHit;
        this.collidableObjects = collidableObjects;
        this.isActive = true;

        // Initialize time
        this.startTime = Date.now();
        this.elapsedTime = 0;

        // Initialize physics properties
        this.velocity = direction.normalize().multiplyScalar(speed);
        this.velocity.y = arcHeight; // Initial upward velocity for arc

        // Create a basic mesh (to be overridden by subclasses)
        this.mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.1),
            new THREE.MeshStandardMaterial({ color: 0xff0000 })
        );
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        // Create collision sphere
        this.collisionRadius = 0.1;
    }

    update() {
        if (!this.isActive) return;

        // Update elapsed time
        this.elapsedTime = Date.now() - this.startTime;

        // Check lifetime
        if (this.elapsedTime >= this.lifetime) {
            this.destroy();
            return;
        }

        // Update position
        this.velocity.y -= this.gravity;
        this.mesh.position.add(this.velocity);

        // Check collisions
        if (this.checkCollisions()) {
            this.handleCollision();
        }

        // Check if below ground
        if (this.mesh.position.y < 0) {
            this.handleCollision();
        }
    }

    checkCollisions() {
        const projectileSphere = new THREE.Sphere(this.mesh.position, this.collisionRadius);
        
        // Check collision with collidable objects
        for (const obj of this.collidableObjects) {
            if (obj.box.intersectsSphere(projectileSphere)) {
                return true;
            }
        }
        
        return false;
    }

    handleCollision() {
        this.onHit(this.mesh.position.clone());
        this.destroy();
    }

    destroy() {
        if (!this.isActive) return;
        this.isActive = false;
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
} 