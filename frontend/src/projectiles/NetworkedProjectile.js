import * as THREE from 'three';
import { FoodProjectile } from './FoodProjectile.js';
import { assetPath } from '../utils/pathHelper.js';

/**
 * NetworkedProjectile represents a projectile thrown by a remote player.
 * It extends FoodProjectile to reuse the same animation and physics logic.
 */
export class NetworkedProjectile {
    static activeProjectiles = [];
    
    /**
     * Register a networked projectile for tracking
     * @param {NetworkedProjectile} projectile - The projectile to register
     */
    static registerProjectile(projectile) {
        NetworkedProjectile.activeProjectiles.push(projectile);
    }
    
    /**
     * Update all registered networked projectiles
     * @param {Object} localPlayer - The local player to check for collisions
     */
    static updateAll(localPlayer) {
        for (let i = NetworkedProjectile.activeProjectiles.length - 1; i >= 0; i--) {
            const projectile = NetworkedProjectile.activeProjectiles[i];
            projectile.update(localPlayer);
            
            if (!projectile.foodProjectile && !projectile.foodProjectile.isActive) {
                NetworkedProjectile.activeProjectiles.splice(i, 1);
            }
        }
    }
    
    /**
     * Create a new networked projectile
     * @param {Object} params - Projectile parameters
     * @param {THREE.Scene} params.scene - THREE.js scene
     * @param {Object} params.data - Projectile data from server
     * @param {Object} params.onHitPlayer - Callback for when projectile hits player
     */
    constructor({ scene, data, onHitPlayer }) {
        this.scene = scene;
        this.projectileId = data.id;
        this.sourcePlayerId = data.playerId;
        this.position = new THREE.Vector3(data.x, data.y, data.z);
        this.direction = new THREE.Vector3(data.dirX, data.dirY, data.dirZ).normalize();
        this.itemType = data.itemType || 'tomato';
        this.onHitPlayer = onHitPlayer;
        this.localPlayer = null;
        
        // Use the path format the FoodProjectile expects
        const modelPath = assetPath(`objects/${this.itemType}.glb`);
        
        console.log(`Creating networked projectile: ${this.itemType} using FoodProjectile`);
        
        // Create FoodProjectile instance to handle visual and physics
        this.foodProjectile = new FoodProjectile({
            scene: scene,
            position: this.position,
            direction: this.direction,
            path: modelPath,
            scale: data.scale || 1,
            speed: data.speed || 0.5,
            gravity: data.gravity || 0.01,
            arcHeight: data.arcHeight || 0.2,
            lifetime: data.lifetime || 5000
        });
        
        // Let FoodProjectile handle basic registration
        // We'll handle networked-specific updates in our update method
    }
    
    /**
     * Update projectile position and check for collisions with local player
     * @param {Object} localPlayer - Local player to check collisions with
     */
    update(localPlayer) {
        if (!this.foodProjectile || !this.foodProjectile.isActive) return;
        
        this.localPlayer = localPlayer;
        
        // Let FoodProjectile handle physics, visuals, and collision with environment
        this.foodProjectile.update();
        
        // We'll handle player collision ourselves since FoodProjectile doesn't know about the local player
        if (localPlayer && this.foodProjectile.model) {
            const playerPos = localPlayer.getPosition();
            const playerRadius = 1.0; // Increased collision radius for better hit detection
            
            const distanceToPlayer = this.foodProjectile.model.position.distanceTo(playerPos);
            
            if (distanceToPlayer < playerRadius) {
                // Hit player!
                if (this.onHitPlayer) {
                    this.onHitPlayer(this.sourcePlayerId, this.itemType);
                }
                
                // Create particle effect
                if (typeof this.foodProjectile.createParticleEffect === 'function') {
                    this.foodProjectile.createParticleEffect(this.foodProjectile.model.position);
                }
                
                // Destroy projectile
                this.destroy();
            }
        }
    }
    
    /**
     * Destroy the projectile and clean up resources
     */
    destroy() {
        if (this.foodProjectile) {
            this.foodProjectile.destroy();
            this.foodProjectile = null;
        }
    }
} 