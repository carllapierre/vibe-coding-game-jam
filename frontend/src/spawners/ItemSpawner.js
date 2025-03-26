import { Spawner } from './Spawner.js';
import { Vector3 } from 'three';
import { Spawnable } from './Spawnable.js';
import { spawner as spawnerConfig } from '../config.js';

export class ItemSpawner extends Spawner {
    constructor(position, itemIds, cooldown = spawnerConfig.defaultCooldown, quantities = null) {
        super(position, new Vector3(0, 0, 0));
        
        // Support both single itemId (string) and array of itemIds
        this.itemIds = Array.isArray(itemIds) ? itemIds : [itemIds];
        
        // Quantities can now be objects with min/max or simple numbers
        this.quantities = quantities || this.itemIds.map(() => ({
            min: spawnerConfig.defaultQuantityMin,
            max: spawnerConfig.defaultQuantityMax
        }));
        
        this.cooldown = cooldown;
        this.lastSpawnTime = Date.now(); // Initialize to current time
        this.currentSpawnable = null;
        this.isRespawning = false;
        this.scene = null;
        this.active = true;
        this.respawnTimeoutId = null;
        this.isSpawning = false;
        this.cleanupTimeoutId = null;
    }

    clearTimeouts() {
        if (this.respawnTimeoutId) {
            clearTimeout(this.respawnTimeoutId);
            this.respawnTimeoutId = null;
        }
    }

    spawn() {
        // Multiple safety checks
        if (!this.active) {
            return;
        }
        
        if (this.isSpawning) {
            return;
        }
        
        if (this.currentSpawnable) {
            return;
        }

        this.clearTimeouts();
        
        const currentTime = Date.now();
        const timeSinceLastSpawn = currentTime - this.lastSpawnTime;
        
        if (this.isRespawning && timeSinceLastSpawn < this.cooldown) {
            const remainingTime = this.cooldown - timeSinceLastSpawn;
            return;
        }

        this.isSpawning = true;

        try {
            const randomIndex = Math.floor(Math.random() * this.itemIds.length);
            const selectedItemId = this.itemIds[randomIndex];
            
            // Get quantity for this item - can be a fixed number or an object with min/max
            let selectedQuantity;
            const quantityConfig = this.quantities[randomIndex];
            
            if (typeof quantityConfig === 'number') {
                // If it's a fixed number, use it
                selectedQuantity = quantityConfig;
            } else if (quantityConfig && typeof quantityConfig === 'object') {
                // If it's an object with min/max, generate a random number in that range
                const min = quantityConfig.min || spawnerConfig.defaultQuantityMin;
                const max = quantityConfig.max || spawnerConfig.defaultQuantityMax;
                selectedQuantity = Math.floor(Math.random() * (max - min + 1)) + min;
            } else {
                // Default fallback
                selectedQuantity = Math.floor(Math.random() * 
                    (spawnerConfig.defaultQuantityMax - spawnerConfig.defaultQuantityMin + 1)) + 
                    spawnerConfig.defaultQuantityMin;
            }
            

            this.currentSpawnable = new Spawnable(this.position, selectedItemId);
            this.currentSpawnable.quantity = selectedQuantity;
            
            if (this.scene) {
                this.currentSpawnable.addToScene(this.scene);
            }
            
            this.lastSpawnTime = currentTime;
            this.isRespawning = false;
        } catch (error) {
            console.error("Error spawning item:", error);
            this.isSpawning = false;
            this.isRespawning = false;
            
            // Reset state
            if (this.currentSpawnable) {
                try {
                    this.currentSpawnable.cleanup();
                } catch (e) {
                    console.error("Error cleaning up spawnable:", e);
                }
                this.currentSpawnable = null;
            }
        }

        this.isSpawning = false;
    }

    setActive(active) {
        this.active = active;
        
        // If being set to active and we don't have a spawnable, try to spawn
        if (active && !this.currentSpawnable && !this.isRespawning) {
            this.spawn();
        }
    }

    addToScene(scene) {
        this.scene = scene;
        if (this.currentSpawnable) {
            this.currentSpawnable.addToScene(scene);
        }
    }

    update() {
        if (!this.active) return;
        
        if (this.currentSpawnable) {
            this.currentSpawnable.update();
            return;
        }

        // Only spawn if we're in a clean state
        if (!this.isSpawning && !this.isRespawning && !this.currentSpawnable) {
            const currentTime = Date.now();
            const timeSinceLastSpawn = currentTime - this.lastSpawnTime;
            
            if (timeSinceLastSpawn >= this.cooldown) {
                this.spawn();
            }
        }
    }

    collect(player) {
        if (!this.currentSpawnable || this.isRespawning) {
            return;
        }

        
        try {
            this.isRespawning = true;
            
            // Call the collection callback
            this.currentSpawnable.collect(player);
            
            // Clean up the spawnable after collection animation - with safety measures
            // Use a shorter timeout to ensure cleanup happens quickly
            const cleanupTimeout = setTimeout(() => {
                if (this.currentSpawnable) {
                    try {
                        this.currentSpawnable.cleanup();
                    } catch (e) {
                        console.error("Error cleaning up spawnable during collection:", e);
                    } finally {
                        // Always set to null to avoid reference leaks
                        this.currentSpawnable = null;
                    }
                }
                // Clear the timeout reference
                if (this.cleanupTimeoutId === cleanupTimeout) {
                    this.cleanupTimeoutId = null;
                }
            }, 400);  // Reduced from 600ms for faster cleanup
            
            // Store timeout ID for later cancellation if needed
            this.cleanupTimeoutId = cleanupTimeout;
            
            this.lastSpawnTime = Date.now();
            
            // Clear any existing timeouts before setting new one
            this.clearTimeouts();
            
            // Set up a single respawn after the cooldown
            this.respawnTimeoutId = setTimeout(() => {
                this.isRespawning = false;
                if (!this.currentSpawnable) {
                    this.spawn();
                }
            }, this.cooldown);
            
        } catch (error) {
            console.error("Error during item collection:", error);
            
            // Reset state in case of error
            if (this.currentSpawnable) {
                try {
                    this.currentSpawnable.cleanup();
                } catch (e) {
                    console.error("Error cleaning up spawnable:", e);
                } finally {
                    this.currentSpawnable = null;
                }
            }
            
            this.isRespawning = false;
            this.isSpawning = false;
        }
    }

    // Add a method to completely clear all timeouts
    clearAllTimeouts() {
        this.clearTimeouts();
        if (this.cleanupTimeoutId) {
            clearTimeout(this.cleanupTimeoutId);
            this.cleanupTimeoutId = null;
        }
    }

    // Helper method to check if the spawner is ready to spawn
    isReadyToSpawn() {
        const ready = this.active && (!this.isRespawning || Date.now() - this.lastSpawnTime >= this.cooldown);
        return ready;
    }

    // Helper method to get remaining cooldown time
    getRemainingCooldown() {
        if (!this.isRespawning) return 0;
        return Math.max(0, this.cooldown - (Date.now() - this.lastSpawnTime));
    }

    checkCollection(character) {
        if (!this.currentSpawnable || !character) return;

        // Get the character's position
        const characterPosition = character.getPosition();
        if (!characterPosition) return;

        // Get the spawnable's position
        const spawnablePosition = this.currentSpawnable.position;
        
        // Calculate distance between character and spawnable
        const distance = characterPosition.distanceTo(spawnablePosition);
        
        // If within collection range (2 units)
        if (distance <= 2) {
            this.collect(character);
        }
    }
} 