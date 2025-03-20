import { Spawner } from './Spawner.js';
import { Vector3 } from 'three';
import { Spawnable } from './Spawnable.js';

export class ItemSpawner extends Spawner {
    constructor(position, itemIds, cooldown = 5000, quantities = null) {
        super(position, new Vector3(0, 0, 0));
        
        // Support both single itemId (string) and array of itemIds
        this.itemIds = Array.isArray(itemIds) ? itemIds : [itemIds];
        this.quantities = quantities || this.itemIds.map(() => 1);
        this.cooldown = cooldown;
        this.lastSpawnTime = Date.now(); // Initialize to current time
        this.currentSpawnable = null;
        this.isRespawning = false;
        this.scene = null;
        this.active = true;
        this.respawnTimeoutId = null;
        this.isSpawning = false;
        
        console.log(`Created ItemSpawner with cooldown: ${cooldown}ms, items: ${this.itemIds.join(', ')}`);
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
            console.log('Spawner is not active, skipping spawn');
            return;
        }
        
        if (this.isSpawning) {
            console.log('Already spawning, skipping spawn request');
            return;
        }
        
        if (this.currentSpawnable) {
            console.log('Spawnable already exists, skipping spawn');
            return;
        }

        this.clearTimeouts();
        
        const currentTime = Date.now();
        const timeSinceLastSpawn = currentTime - this.lastSpawnTime;
        
        if (this.isRespawning && timeSinceLastSpawn < this.cooldown) {
            const remainingTime = this.cooldown - timeSinceLastSpawn;
            console.log(`Still respawning, ${remainingTime}ms remaining`);
            return;
        }

        this.isSpawning = true;
        console.log('Starting spawn process...');

        try {
            const randomIndex = Math.floor(Math.random() * this.itemIds.length);
            const selectedItemId = this.itemIds[randomIndex];
            const selectedQuantity = this.quantities[randomIndex];
            
            console.log(`Spawning item: ${selectedItemId} with quantity: ${selectedQuantity}`);

            this.currentSpawnable = new Spawnable(this.position, selectedItemId);
            this.currentSpawnable.quantity = selectedQuantity;
            
            if (this.scene) {
                this.currentSpawnable.addToScene(this.scene);
            }
            
            this.lastSpawnTime = currentTime;
            this.isRespawning = false;
            console.log('Spawn successful');
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
        console.log(`Spawner active state set to: ${active}`);
        
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

        console.log('Item collected, starting respawn timer');
        
        try {
            this.isRespawning = true;
            
            // Call the collection callback
            this.currentSpawnable.collect(player);
            
            // Clean up the spawnable after collection animation
            setTimeout(() => {
                if (this.currentSpawnable) {
                    this.currentSpawnable.cleanup();
                    this.currentSpawnable = null;
                }
            }, 600);
            
            this.lastSpawnTime = Date.now();
            
            // Clear any existing timeouts before setting new one
            this.clearTimeouts();
            
            // Set up a single respawn after the cooldown
            this.respawnTimeoutId = setTimeout(() => {
                console.log('Respawn cooldown complete');
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
                }
                this.currentSpawnable = null;
            }
            
            this.isRespawning = false;
            this.isSpawning = false;
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
            console.log('Item in collection range, collecting...');
            this.collect(character);
        }
    }
} 