// PortalEntity.js
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { PortalRegistry } from '../registries/PortalRegistry.js';

export class PortalObject extends THREE.Group {
    // Static flag to prevent any portal from triggering while a redirect is in progress
    static isRedirectInProgress = false;

    /**
     * Create a new portal object
     * @param {string} portalId - Portal ID from registry
     * @param {THREE.Vector3} position - Initial position
     * @param {number} [instanceIndex] - Optional instance index, will use timestamp if not provided
     */
    constructor(portalId, position, instanceIndex) {
        super();

        // Store portal ID and type
        this.userData = {
            id: portalId,
            type: 'portal',
            instanceIndex: instanceIndex || Date.now() // Use provided index or timestamp as unique instance index
        };

        // Add flag to track if portal has been triggered
        this.hasTriggered = false;

        // Set position
        this.position.copy(position);

        // Get portal data from registry
        this.portalData = PortalRegistry.getPortalInfo(portalId);
        if (!this.portalData) {
            console.error(`Portal type ${portalId} not found in registry`);
            return;
        }

        console.log(`Creating portal ${portalId} with instanceIndex ${this.userData.instanceIndex}`);

        // Create portal visuals
        this.createPortalVisuals();

        // Create label text - use description if available
        const labelText = this.portalData.description || `Portal: ${portalId}`;
        this.createLabel(labelText);

        // Add collider for interaction
        this.createCollider();
    }

    /**
     * Create portal visual elements
     */
    createPortalVisuals() {
        // Get color from portalData or use default
        const portalColor = this.portalData && this.portalData.color ? this.portalData.color : 0x3366ff;
        
        // Create portal frame - rectangular shape
        const frameGeometry = new THREE.BoxGeometry(2, 3, 0.2);
        const frameMaterial = new THREE.MeshStandardMaterial({ 
            color: portalColor,
            roughness: 0.3,
            metalness: 0.8,
            transparent: true,
            opacity: 0.8
        });
        
        this.frame = new THREE.Mesh(frameGeometry, frameMaterial);
        this.add(this.frame);

        // Create portal effect - energy field
        const portalGeometry = new THREE.PlaneGeometry(1.8, 2.8);
        const portalMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(portalColor).multiplyScalar(1.5), // Brighter color for the field
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        
        this.portalField = new THREE.Mesh(portalGeometry, portalMaterial);
        this.portalField.position.z = 0.05;
        this.add(this.portalField);

        // Add particle effect
        this.createParticleEffect(portalColor);
    }

    /**
     * Create a text label for the portal
     * @param {string} labelText - Text to display
     */
    createLabel(labelText) {
        // Create text using troika-three-text
        this.label = new Text();
        this.label.text = labelText;
        this.label.fontSize = 0.2;
        this.label.color = 0xffffff;
        this.label.anchorX = 'center';
        this.label.anchorY = 'top';
        this.label.position.set(0, 1, 0.2);
        this.label.sync();
        
        this.add(this.label);
    }
    
    /**
     * Update the label text
     * @param {string} newText - New text to display
     */
    updateLabel(newText) {
        if (this.label) {
            this.label.text = newText;
            this.label.sync();
        }
    }

    /**
     * Create particle effect for portal
     * @param {number} color - The color for the particles
     */
    createParticleEffect(color) {
        // Create particles
        const particleCount = 100;
        const particles = new THREE.BufferGeometry();
        
        // Convert color to RGB components
        const colorObj = new THREE.Color(color);
        
        // Create random positions for particles around the portal frame
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            // Random position around portal edges
            const x = (Math.random() - 0.5) * 2;
            const y = (Math.random() - 0.5) * 3;
            const z = (Math.random() - 0.5) * 0.5;
            
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            
            // Base color with slight variation
            colors[i * 3] = colorObj.r * (0.8 + Math.random() * 0.4); // R
            colors[i * 3 + 1] = colorObj.g * (0.8 + Math.random() * 0.4); // G
            colors[i * 3 + 2] = colorObj.b * (0.8 + Math.random() * 0.4); // B
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        // Material with custom size and blending
        const particleMaterial = new THREE.PointsMaterial({
            size: 0.05,
            transparent: true,
            opacity: 0.8,
            vertexColors: true,
            blending: THREE.AdditiveBlending
        });
        
        // Create the particle system
        this.particles = new THREE.Points(particles, particleMaterial);
        this.add(this.particles);
    }

    /**
     * Create collider for portal interaction
     */
    createCollider() {
        // Create invisible collider
        const colliderGeometry = new THREE.BoxGeometry(1.8, 2.8, 1);
        const colliderMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.0
        });
        
        this.collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
        this.collider.userData.isPortalCollider = true;
        this.collider.userData.portalId = this.userData.id;
        this.collider.userData.parentPortal = this; // Store reference to parent portal instead
        
        // Position slightly in front of visual
        this.collider.position.z = 0.5;
        this.add(this.collider);
    }

    /**
     * Update the portal animation
     * @param {number} deltaTime - Time since last update
     */
    update(deltaTime) {
        // Rotate particles
        if (this.particles) {
            this.particles.rotation.z += deltaTime * 0.2;
        }
        
        // Pulse the portal field
        if (this.portalField) {
            const pulse = Math.sin(Date.now() * 0.003) * 0.1 + 0.9;
            this.portalField.scale.set(pulse, pulse, 1);
            
            // Update opacity based on pulse
            this.portalField.material.opacity = 0.4 + Math.sin(Date.now() * 0.002) * 0.2;
        }
    }

    /**
     * Handle player entering the portal
     */
    onPlayerEnter() {
        // Check both static and instance flags
        if (!PortalObject.isRedirectInProgress && !this.hasTriggered && 
            this.portalData && typeof this.portalData.onEnter === 'function') {
            
            console.log('Portal triggered - redirecting...');
            // Set both flags
            PortalObject.isRedirectInProgress = true;
            this.hasTriggered = true;
            
            // Remove the portal from the scene immediately
            if (this.parent) {
                this.parent.remove(this);
            }
            
            // Store the onEnter function
            const onEnterFn = this.portalData.onEnter;
            
            // Clear all references
            this.dispose();
            
            // Execute the redirect
            onEnterFn();
        }
    }

    /**
     * Set the portal material color
     * @param {number} color - Hex color
     */
    setColor(color) {
        if (this.frame) {
            this.frame.material.color.set(color);
        }
        if (this.portalField) {
            this.portalField.material.color.set(color);
        }
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        // Clean up geometries
        if (this.frame) {
            this.frame.geometry.dispose();
            this.frame.material.dispose();
        }
        
        if (this.portalField) {
            this.portalField.geometry.dispose();
            this.portalField.material.dispose();
        }
        
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
        
        if (this.collider) {
            this.collider.geometry.dispose();
            this.collider.material.dispose();
        }
        
        // Remove the label
        if (this.label) {
            this.label.dispose();
        }
    }
}
