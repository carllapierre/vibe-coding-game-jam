import * as THREE from 'three';
import { SpawnerRegistry } from '../../registries/SpawnerRegistry.js';
import worldManagerService from '../../services/WorldManagerService.js';
import { createTextSprite } from '../../utils/UIUtils.js';
import { findObjectByName } from '../../utils/SceneUtils.js';

/**
 * Manages spawner creation and visualization in the editor
 */
export class SpawnerManager {
    /**
     * @param {THREE.Scene} scene - Three.js scene
     * @param {Object} changeManager - ChangeManager instance
     * @param {Object} transformControls - TransformControls instance
     * @param {HTMLElement} feedbackElement - Element for feedback messages
     */
    constructor(scene, changeManager, transformControls, feedbackElement) {
        this.scene = scene;
        this.changeManager = changeManager;
        this.transformControls = transformControls;
        this.feedbackElement = feedbackElement;
        
        // Track spawner visuals
        this.spawnerVisuals = new Map();
    }
    
    /**
     * Place a new spawner in the world at the specified position
     * @param {string} spawnerId - ID of the spawner to place
     * @param {THREE.Vector3} position - Position to place the spawner
     * @returns {boolean} Success status
     */
    placeSpawnerInWorld(spawnerId, position) {
        try {
            // Get spawner info from registry
            const spawnerInfo = SpawnerRegistry.items.find(item => item.id === spawnerId);
            if (!spawnerInfo) throw new Error(`Spawner ${spawnerId} not found in registry`);
            
            // Generate a unique instance index
            const timestamp = Date.now();
            const instanceIndex = timestamp % 1000000;

            // Create a visual indicator for the spawner
            const spawnerVisual = this.createSpawnerVisual(spawnerInfo);
            spawnerVisual.position.copy(position);
            
            // Add metadata for identification - store ID and instance index only
            // We don't store cooldown and items anymore as they come from registry
            spawnerVisual.userData.type = 'spawner';
            spawnerVisual.userData.id = spawnerId;
            spawnerVisual.userData.instanceIndex = instanceIndex;
            
            // Add a special name to find these visuals later
            spawnerVisual.name = `spawner-visual-${spawnerId}-${instanceIndex}`;
            
            // Add to scene
            this.scene.add(spawnerVisual);
            
            // Track this visual
            this.spawnerVisuals.set(`${spawnerId}-${instanceIndex}`, spawnerVisual);
            
            // Attach transform controls
            this.transformControls.detach();
            this.transformControls.attach(spawnerVisual);
            
            // Record this as a change
            this.changeManager.recordChange(spawnerVisual);
            
            return true;
        } catch (error) {
            console.error(`Error placing spawner ${spawnerId}:`, error);
            return false;
        }
    }
    
    /**
     * Create a visual representation of a spawner
     * @param {Object} spawnerInfo - Spawner information from registry
     * @returns {THREE.Group} Visual representation
     */
    createSpawnerVisual(spawnerInfo) {
        // Create a group to hold all visual elements
        const group = new THREE.Group();
        
        // Create a base (cylinder) for the spawner
        const baseGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
        const baseMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x3366ff,
            transparent: true,
            opacity: 0.7
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.05; // Half the height
        group.add(base);
        
        // Create a vertical beam
        const beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
        const beamMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x3366ff,
            transparent: true,
            opacity: 0.5
        });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.position.y = 1; // Half the beam height
        group.add(beam);
        
        // Create a top emitter
        const emitterGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const emitterMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7
        });
        const emitter = new THREE.Mesh(emitterGeometry, emitterMaterial);
        emitter.position.y = 2; // At the top of the beam
        group.add(emitter);
        
        // Add particles for visual effect
        const particleCount = 20;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const radius = 0.4;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            positions[i3] = Math.sin(theta) * Math.cos(phi) * radius;
            positions[i3 + 1] = 2 + Math.random() * 0.3; // Position near emitter
            positions[i3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x00ffff,
            size: 0.05,
            transparent: true,
            opacity: 0.7
        });
        
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        group.add(particles);
        
        // Add spawner info as text
        const spawnerLabel = createTextSprite(
            spawnerInfo.id,
            { fontsize: 80, fontface: 'Arial', borderColor: { r:0, g:0, b:0, a:1.0 } }
        );
        spawnerLabel.position.set(0, 2.3, 0);
        group.add(spawnerLabel);
        
        // Animate particles
        const animateParticles = () => {
            if (!group.parent) {
                // If group was removed from scene, stop animation
                return;
            }
            
            const positions = particles.geometry.attributes.position.array;
            
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                // Move particles upward
                positions[i3 + 1] += 0.01;
                
                // Reset particles that go too high
                if (positions[i3 + 1] > 2.5) {
                    positions[i3 + 1] = 2;
                }
            }
            
            particles.geometry.attributes.position.needsUpdate = true;
            
            requestAnimationFrame(animateParticles);
        };
        
        // Start animation
        animateParticles();
        
        return group;
    }
    
    /**
     * Create visual indicators for all existing spawners in the world
     */
    createSpawnerVisuals() {
        // Check if worldManagerService is available and has loaded spawners
        if (!worldManagerService || !worldManagerService.loadedSpawners) {
            return;
        }
        
        
        // Remove any existing visualizers first
        this.removeSpawnerVisuals();
        
        // For each spawner in the world, create a visual indicator
        worldManagerService.loadedSpawners.forEach(spawner => {
            try {
                if (!spawner || !spawner.position) {
                    console.warn('Invalid spawner found, skipping visualization');
                    return;
                }
                
                // Get spawner info from registry
                let spawnerInfo = SpawnerRegistry.items.find(item => item.id === spawner.id);
                if (!spawnerInfo) {
                    console.warn(`Spawner type ${spawner.id} not found in registry, using default`);
                    // Create a default dummy info if not found
                    spawnerInfo = {
                        id: spawner.id || 'unknown-spawner',
                        cooldown: spawner.cooldown || 5000,
                        items: spawner.itemIds || []
                    };
                }
                
                // Create visual representation
                const visual = this.createSpawnerVisual(spawnerInfo);
                
                // Position at the spawner's location
                visual.position.copy(spawner.position);
                
                // Add metadata for identification
                visual.userData.type = 'spawner';
                visual.userData.id = spawner.id;
                visual.userData.instanceIndex = spawner.instanceIndex;
                visual.userData.cooldown = spawner.cooldown;
                visual.userData.items = spawner.itemIds || spawnerInfo.items;
                visual.userData.isExistingSpawner = true;
                visual.userData.spawnerReference = spawner;
                
                // Add a special name to find these visuals later
                visual.name = 'spawner-visual-' + spawner.id + '-' + spawner.instanceIndex;
                
                // Track this visual
                this.spawnerVisuals.set(`${spawner.id}-${spawner.instanceIndex}`, visual);
                
                // Add to scene
                this.scene.add(visual);
                
                // If the spawner has a current spawnable, hide it
                if (spawner.currentSpawnable && spawner.currentSpawnable.model) {
                    spawner.currentSpawnable.model.visible = false;
                }
                
            } catch (error) {
                console.error(`Error creating visual for spawner:`, error);
            }
        });
    }

    /**
     * Remove all spawner visual indicators
     */
    removeSpawnerVisuals() {
        // Find all spawner visuals by prefix
        const visualsToRemove = [];
        
        this.scene.traverse(object => {
            if (object.name && object.name.startsWith('spawner-visual-')) {
                visualsToRemove.push(object);
                
                // If this visual has a reference to an actual spawner
                if (object.userData.spawnerReference && object.userData.spawnerReference.currentSpawnable) {
                    // Make the spawnable visible again
                    const spawnable = object.userData.spawnerReference.currentSpawnable;
                    if (spawnable.model) {
                        spawnable.model.visible = true;
                    }
                }
            }
        });
        
        // Remove all found visuals
        visualsToRemove.forEach(visual => {
            this.scene.remove(visual);
        });
        
        // Clear the tracking map
        this.spawnerVisuals.clear();
        
    }
    
    /**
     * Find a spawner visual by ID and instance index
     * @param {string} id - Spawner ID
     * @param {number} instanceIndex - Instance index
     * @returns {THREE.Object3D|null} The spawner visual or null
     */
    findSpawnerVisual(id, instanceIndex) {
        return findObjectByName(this.scene, `spawner-visual-${id}-${instanceIndex}`);
    }
} 