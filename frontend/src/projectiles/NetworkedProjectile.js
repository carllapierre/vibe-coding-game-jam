import * as THREE from 'three';

/**
 * NetworkedProjectile represents a projectile thrown by a remote player.
 * Uses simple spheres for visuals for reliability.
 */
export class NetworkedProjectile {
    static activeProjectiles = [];
    static MAX_LIFETIME = 10000; // 10 seconds maximum lifetime
    
    /**
     * Register a networked projectile for tracking
     * @param {NetworkedProjectile} projectile - The projectile to register
     */
    static registerProjectile(projectile) {
        projectile.createdAt = Date.now();
        NetworkedProjectile.activeProjectiles.push(projectile);
    }
    
    /**
     * Update all registered networked projectiles
     * @param {Object} localPlayer - The local player to check for collisions
     */
    static updateAll(localPlayer) {
        const currentTime = Date.now();
        
        for (let i = NetworkedProjectile.activeProjectiles.length - 1; i >= 0; i--) {
            const projectile = NetworkedProjectile.activeProjectiles[i];
            
            // Skip invalid projectiles
            if (!projectile) {
                NetworkedProjectile.activeProjectiles.splice(i, 1);
                continue;
            }
            
            // Force cleanup projectiles that exceed maximum lifetime
            if (currentTime - projectile.createdAt > NetworkedProjectile.MAX_LIFETIME) {
                console.log('Forcing cleanup of stale projectile');
                projectile.destroy();
                NetworkedProjectile.activeProjectiles.splice(i, 1);
                continue;
            }
            
            try {
                projectile.update(localPlayer);
                
                // Check if projectile should be removed from active list
                if (!projectile.active) {
                    NetworkedProjectile.activeProjectiles.splice(i, 1);
                }
            } catch (error) {
                console.error('Error updating projectile:', error);
                // Remove problematic projectile
                if (projectile.destroy) {
                    projectile.destroy();
                }
                NetworkedProjectile.activeProjectiles.splice(i, 1);
            }
        }
    }
    
    /**
     * Create a new networked projectile
     * @param {Object} params - Projectile parameters
     * @param {THREE.Scene} params.scene - THREE.js scene
     * @param {Object} params.data - Projectile data from server
     * @param {Function} params.onHitPlayer - Callback for when projectile hits player
     */
    constructor({ scene, data, onHitPlayer }) {
        this.scene = scene;
        this.projectileId = data.id;
        this.sourcePlayerId = data.playerId;
        this.position = new THREE.Vector3(data.x, data.y, data.z);
        this.direction = new THREE.Vector3(data.dirX, data.dirY, data.dirZ).normalize();
        this.itemType = data.itemType || 'tomato';
        this.onHitPlayer = onHitPlayer;
        this.active = true;
        this.speed = data.speed || 0.5;
        this.gravity = data.gravity || 0.01;
        this.scale = data.scale || 1.0;
        this.damage = this.getDamageForItemType(this.itemType);
        this.velocity = this.direction.clone().multiplyScalar(this.speed);
        
        // Add arc to trajectory
        this.velocity.y += data.arcHeight || 0.2;
        
        // Create simple sphere for reliable visualization
        this.createProjectileModel();
    }
    
    /**
     * Create a simple sphere model for the projectile
     */
    createProjectileModel() {
        // Simple colored sphere based on item type
        const geometry = new THREE.SphereGeometry(0.15 * this.scale, 16, 16);
        
        // Color based on item type
        const colors = {
            'tomato': 0xff3333,
            'apple': 0xff0000,
            'banana': 0xffff00,
            'watermelon': 0x33aa33,
            'pineapple': 0xffaa00,
            'cake': 0xeeaa88,
            'soda-bottle': 0x3333ff,
            'loaf-baguette': 0xddbb66
        };
        
        const color = colors[this.itemType] || 0xff5555;
        
        const material = new THREE.MeshBasicMaterial({
            color: color,
            wireframe: false
        });
        
        this.model = new THREE.Mesh(geometry, material);
        this.model.position.copy(this.position);
        this.scene.add(this.model);
        
        // Create collision sphere for hit detection
        this.collisionRadius = 0.25 * this.scale;
    }
    
    /**
     * Get damage amount for an item type
     * @param {string} itemType - The item type
     * @returns {number} The damage amount
     */
    getDamageForItemType(itemType) {
        // Different food items can do different damage
        const damageMap = {
            'tomato': 10,
            'apple': 15,
            'banana': 8,
            'watermelon': 25,
            'pineapple': 20,
            'cake': 30,
            'soda-bottle': 10,
            'loaf-baguette': 12
        };
        
        return damageMap[itemType] || 10; // Default damage if item type not found
    }
    
    /**
     * Create particle effect at impact point
     * @param {THREE.Vector3} position - Impact position
     */
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
        const duration = 500; // 0.5 seconds

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
     * Update projectile position and check for collisions with local player
     * @param {Object} localPlayer - Local player to check collisions with
     */
    update(localPlayer) {
        if (!this.active || !this.model) return;
        
        // Update position based on velocity
        this.position.add(this.velocity);
        
        // Apply gravity
        this.velocity.y -= this.gravity;
        
        // Update model position
        this.model.position.copy(this.position);
        
        // Add a rotation to make it feel more dynamic
        this.model.rotation.x += 0.1;
        this.model.rotation.z += 0.1;
        
        // Check for collisions with local player
        if (localPlayer) {
            const playerPos = localPlayer.getPosition ? localPlayer.getPosition() : localPlayer.position;
            
            if (playerPos) {
                const distance = this.position.distanceTo(playerPos);
                
                // Check collision with player (using a larger radius for better hit detection)
                if (distance < this.collisionRadius + 0.8) {
                    console.log(`Direct hit on local player by ${this.itemType} from ${this.sourcePlayerId}`);
                    
                    // Create hit effect
                    this.createParticleEffect(this.position.clone());
                    
                    // Call the hit callback to notify about the hit
                    if (this.onHitPlayer) {
                        this.onHitPlayer(this.sourcePlayerId, this.itemType, this.damage);
                    }
                    
                    // Destroy the projectile after hit
                    this.destroy();
                    return;
                }
            }
        }
        
        // Check for collisions with floor (simple Y-based check)
        if (this.position.y < 0.1) {
            console.log('Projectile hit floor');
            this.createParticleEffect(this.position.clone());
            this.destroy();
            return;
        }
    }
    
    /**
     * Destroy the projectile and clean up resources
     */
    destroy() {
        this.active = false;
        
        if (this.model) {
            this.scene.remove(this.model);
            
            if (this.model.geometry) {
                this.model.geometry.dispose();
            }
            
            if (this.model.material) {
                this.model.material.dispose();
            }
            
            this.model = null;
        }
    }
} 