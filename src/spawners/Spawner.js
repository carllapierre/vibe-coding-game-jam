import { Vector3 } from 'three';

export class Spawner {
    constructor(position, rotation = new Vector3(0, 0, 0)) {
        this.position = position;
        this.rotation = rotation;
        this.spawnCooldown = 0; // Time between spawns in milliseconds
        this.lastSpawnTime = 0;
    }

    // Base method to be overridden by child classes
    spawn() {
        throw new Error('Spawn method must be implemented by child class');
    }

    // Check if enough time has passed since last spawn
    canSpawn() {
        const currentTime = Date.now();
        return currentTime - this.lastSpawnTime >= this.spawnCooldown;
    }

    // Set spawner position
    setPosition(position) {
        this.position = position;
    }

    // Set spawner rotation
    setRotation(rotation) {
        this.rotation = rotation;
    }

    // Set spawn cooldown
    setSpawnCooldown(cooldown) {
        this.spawnCooldown = cooldown;
    }
} 