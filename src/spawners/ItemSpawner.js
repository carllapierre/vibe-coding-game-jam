import { Spawner } from './Spawner.js';
import { Vector3 } from 'three';
import { Spawnable } from './Spawnable.js';
import { ItemRegistry } from './ItemRegistry.js';
import { SpawnableRegistry } from './SpawnableRegistry.js';

export class ItemSpawner extends Spawner {
    constructor(position, itemIds, cooldown = 5000, quantities = null) {
        super(position, new Vector3(0, 0, 0));
        
        // Support both single itemId (string) and array of itemIds
        this.itemIds = Array.isArray(itemIds) ? itemIds : [itemIds];
        this.quantities = quantities || this.itemIds.map(() => 1);
        this.cooldown = cooldown;
        this.lastSpawnTime = 0;
        this.currentSpawnable = null;
        this.isRespawning = false;
        this.scene = null;
        this.active = true;
        this.respawnTimeoutId = null;
        
        console.log(`Created ItemSpawner with cooldown: ${cooldown}ms, items: ${this.itemIds.join(', ')}`);
    }

    spawn() {
        if (!this.active) {
            console.log('Spawner is not active, skipping spawn');
            return;
        }
        
        // Clear any existing respawn timeout
        if (this.respawnTimeoutId) {
            clearTimeout(this.respawnTimeoutId);
            this.respawnTimeoutId = null;
        }
        
        const currentTime = Date.now();
        const timeSinceLastSpawn = currentTime - this.lastSpawnTime;
        
        if (this.isRespawning && timeSinceLastSpawn < this.cooldown) {
            const remainingTime = this.cooldown - timeSinceLastSpawn;
            console.log(`Still respawning, ${remainingTime}ms remaining`);
            
            // Set up a timeout to spawn after the remaining time
            this.respawnTimeoutId = setTimeout(() => {
                console.log("Respawn timeout triggered");
                this.isRespawning = false;
                this.spawn();
            }, remainingTime);
            
            return;
        }

        // Select a random item ID from the available options
        const randomIndex = Math.floor(Math.random() * this.itemIds.length);
        const selectedItemId = this.itemIds[randomIndex];
        const selectedQuantity = this.quantities[randomIndex];
        
        console.log(`Spawning item: ${selectedItemId} with quantity: ${selectedQuantity}`);

        try {
            // Create a new spawnable with the randomly selected item
            this.currentSpawnable = new Spawnable(this.position, selectedItemId);
            // Store the quantity in the spawnable for collection
            this.currentSpawnable.quantity = selectedQuantity;
            
            // If we already have a scene, add the spawnable to it
            if (this.scene) {
                this.currentSpawnable.addToScene(this.scene);
            }
            
            this.lastSpawnTime = currentTime;
            this.isRespawning = false;
        } catch (error) {
            console.error("Error spawning item:", error);
            
            // Try again with a different item in 1 second
            setTimeout(() => {
                if (this.itemIds.length > 1) {
                    // Remove the problematic item from the list
                    const index = this.itemIds.indexOf(selectedItemId);
                    this.itemIds.splice(index, 1);
                    this.quantities.splice(index, 1);
                    console.log(`Removed problematic item ${selectedItemId}, trying with remaining items: ${this.itemIds.join(', ')}`);
                }
                this.spawn();
            }, 1000);
        }
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
        
        // Update current spawnable if it exists
        if (this.currentSpawnable) {
            this.currentSpawnable.update();
        }

        // Check if we should spawn a new item
        if (!this.currentSpawnable && !this.isRespawning) {
            console.log('No current spawnable and not respawning, spawning new item');
            this.spawn();
        }
        // Check if we should respawn
        else if (this.isRespawning) {
            const currentTime = Date.now();
            const timeSinceLastSpawn = currentTime - this.lastSpawnTime;
            
            if (timeSinceLastSpawn >= this.cooldown) {
                console.log(`Respawn cooldown complete (${timeSinceLastSpawn}ms elapsed), spawning new item`);
                this.spawn();
            }
        }
    }

    collect(player) {
        if (!this.currentSpawnable) {
            return;
        }

        console.log('Item collected, starting respawn timer');
        
        try {
            // Call the collection callback
            this.currentSpawnable.collect(player);
            
            // Clean up the spawnable (this will remove it from the scene)
            setTimeout(() => {
                if (this.currentSpawnable) {
                    this.currentSpawnable.cleanup();
                    this.currentSpawnable = null;
                }
            }, 600); // Wait for collection animation to finish
            
            // Start respawn timer
            this.isRespawning = true;
            this.lastSpawnTime = Date.now();
            
            // Set up a guaranteed respawn after the cooldown
            this.respawnTimeoutId = setTimeout(() => {
                console.log(`Forced respawn after cooldown of ${this.cooldown}ms`);
                this.isRespawning = false;
                this.currentSpawnable = null;
                this.spawn();
            }, this.cooldown);
            
            console.log(`Respawn timer started, will respawn in ${this.cooldown}ms`);
        } catch (error) {
            console.error("Error during item collection:", error);
            
            // Force a reset of the spawner in case of error
            if (this.currentSpawnable) {
                try {
                    this.currentSpawnable.cleanup();
                } catch (e) {
                    console.error("Error cleaning up spawnable:", e);
                }
                this.currentSpawnable = null;
            }
            
            // Start respawn timer to try again
            this.isRespawning = true;
            this.lastSpawnTime = Date.now();
            
            // Set a shorter timeout to try again
            this.respawnTimeoutId = setTimeout(() => {
                this.isRespawning = false;
                this.spawn();
            }, 2000);
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
} 