import * as THREE from 'three';
import { gsap } from 'gsap';

/**
 * HitMarker class for creating fancy visual effects when projectiles hit targets
 */
export class HitMarker {
    static effects = [];
    
    /**
     * Create a hit marker at the specified position
     * @param {Object} options - Options for creating the hit marker
     * @param {THREE.Scene} options.scene - The scene to add the hit marker to
     * @param {THREE.Vector3} options.position - The position of the hit
     * @param {string} options.type - The type of hit ('player', 'environment', etc.)
     * @param {Object} options.color - Custom color options
     * @param {THREE.Camera} [options.camera] - Optional camera to orient the hit marker towards
     * @returns {Object} The created hit marker object
     */
    static create(options) {
        const { scene, position, type = 'default', color, camera } = options;
        
        // Get the camera from options, scene, or use a default position
        const cameraPosition = camera ? 
            camera.position : 
            (scene.camera ? scene.camera.position : new THREE.Vector3(0, 10, 0));
        
        // Choose hit marker type
        switch (type) {
            case 'player':
                return HitMarker.createPlayerHit(scene, position, color, cameraPosition);
            case 'headshot':
                return HitMarker.createHeadshotHit(scene, position, color, cameraPosition);
            case 'environment':
                return HitMarker.createEnvironmentHit(scene, position, color, cameraPosition);
            default:
                return HitMarker.createDefaultHit(scene, position, color, cameraPosition);
        }
    }
    
    /**
     * Create a default hit marker
     */
    static createDefaultHit(scene, position, customColor, cameraPosition) {
        // Particle burst effect
        const particleCount = 25;
        const particles = HitMarker.createParticleBurst({
            scene, 
            position, 
            count: particleCount,
            color: customColor || 0xffffff,
            size: 0.05,
            speed: 0.15,
            lifetime: 800
        });
        
        // Central flash
        const flashSize = 0.25;
        const flashGeometry = new THREE.PlaneGeometry(flashSize, flashSize);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: customColor || 0xffffff,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        
        // Make the flash always face the camera
        flash.lookAt(cameraPosition);
        
        scene.add(flash);
        
        // Animate the flash
        gsap.to(flash.scale, {
            x: 2.5,
            y: 2.5,
            duration: 0.3,
            ease: "power2.out"
        });
        
        gsap.to(flashMaterial, {
            opacity: 0,
            duration: 0.4,
            ease: "power2.out",
            onComplete: () => {
                scene.remove(flash);
                flashGeometry.dispose();
                flashMaterial.dispose();
            }
        });
        
        // Add hit marker ring
        const ringGeometry = new THREE.RingGeometry(flashSize * 0.8, flashSize, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: customColor || 0xffffff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(position);
        ring.lookAt(cameraPosition);
        
        scene.add(ring);
        
        // Animate the ring
        gsap.to(ring.scale, {
            x: 3,
            y: 3,
            duration: 0.7,
            ease: "power2.out"
        });
        
        gsap.to(ringMaterial, {
            opacity: 0,
            duration: 0.7,
            ease: "power2.out",
            onComplete: () => {
                scene.remove(ring);
                ringGeometry.dispose();
                ringMaterial.dispose();
            }
        });
        
        return { particles, flash, ring };
    }
    
    /**
     * Create a player hit marker with red color and more intense effects
     */
    static createPlayerHit(scene, position, customColor, cameraPosition) {
        // Use red color for player hits
        const playerHitColor = customColor || 0xff3333;
        
        // More particles for player hits
        const particleCount = 35;
        const particles = HitMarker.createParticleBurst({
            scene, 
            position, 
            count: particleCount,
            color: playerHitColor,
            size: 0.06,
            speed: 0.2,
            lifetime: 1000
        });
        
        // Create X-shaped hit marker for player hits
        const crossSize = 0.3;
        const thickness = 0.07;
        
        // Create first line of X
        const line1Geometry = new THREE.PlaneGeometry(thickness, crossSize);
        const line1Material = new THREE.MeshBasicMaterial({
            color: playerHitColor,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const line1 = new THREE.Mesh(line1Geometry, line1Material);
        line1.position.copy(position);
        line1.lookAt(cameraPosition);
        line1.rotateZ(Math.PI / 4); // 45 degrees rotation
        
        // Create second line of X
        const line2Geometry = new THREE.PlaneGeometry(thickness, crossSize);
        const line2Material = new THREE.MeshBasicMaterial({
            color: playerHitColor,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const line2 = new THREE.Mesh(line2Geometry, line2Material);
        line2.position.copy(position);
        line2.lookAt(cameraPosition);
        line2.rotateZ(-Math.PI / 4); // -45 degrees rotation
        
        scene.add(line1);
        scene.add(line2);
        
        // Animate the X marker
        gsap.to(line1.scale, {
            x: 1.5,
            y: 1.5,
            duration: 0.2,
            ease: "power2.out"
        });
        
        gsap.to(line2.scale, {
            x: 1.5,
            y: 1.5,
            duration: 0.2,
            ease: "power2.out"
        });
        
        // After expanding, start shrinking and fading out
        gsap.to(line1.scale, {
            x: 0.8,
            y: 0.8,
            delay: 0.2,
            duration: 0.5,
            ease: "power2.in"
        });
        
        gsap.to(line2.scale, {
            x: 0.8,
            y: 0.8,
            delay: 0.2,
            duration: 0.5,
            ease: "power2.in"
        });
        
        gsap.to(line1Material, {
            opacity: 0,
            delay: 0.3,
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
                scene.remove(line1);
                line1Geometry.dispose();
                line1Material.dispose();
            }
        });
        
        gsap.to(line2Material, {
            opacity: 0,
            delay: 0.3,
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
                scene.remove(line2);
                line2Geometry.dispose();
                line2Material.dispose();
            }
        });
        
        // Add ripple effect
        const rippleGeometry = new THREE.RingGeometry(0.1, 0.15, 32);
        const rippleMaterial = new THREE.MeshBasicMaterial({
            color: playerHitColor,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial);
        ripple.position.copy(position);
        ripple.lookAt(cameraPosition);
        
        scene.add(ripple);
        
        // Animate ripple
        gsap.to(ripple.scale, {
            x: 5,
            y: 5,
            duration: 0.8,
            ease: "power2.out"
        });
        
        gsap.to(rippleMaterial, {
            opacity: 0,
            duration: 0.8,
            ease: "power2.out",
            onComplete: () => {
                scene.remove(ripple);
                rippleGeometry.dispose();
                rippleMaterial.dispose();
            }
        });
        
        return { particles, line1, line2, ripple };
    }
    
    /**
     * Create a more dramatic headshot hit marker
     */
    static createHeadshotHit(scene, position, customColor, cameraPosition) {
        // Use yellow/gold color for headshots
        const headshotColor = customColor || 0xffcc00;
        
        // Create base hit first
        const baseHit = HitMarker.createPlayerHit(scene, position, headshotColor, cameraPosition);
        
        // Add additional effects for headshots
        
        // Create starburst effect
        const starburstCount = 8; // Number of lines in the starburst
        const starburstLength = 0.5;
        const starburstWidth = 0.05;
        const starbursts = [];
        
        for (let i = 0; i < starburstCount; i++) {
            const angle = (i / starburstCount) * Math.PI * 2;
            
            const lineGeometry = new THREE.PlaneGeometry(starburstWidth, starburstLength);
            const lineMaterial = new THREE.MeshBasicMaterial({
                color: headshotColor,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            line.position.copy(position);
            line.lookAt(cameraPosition);
            line.rotateZ(angle);
            
            scene.add(line);
            starbursts.push({ mesh: line, material: lineMaterial, geometry: lineGeometry });
            
            // Animate starburst lines
            gsap.to(line.scale, {
                x: 2,
                y: 2,
                duration: 0.4,
                ease: "power2.out"
            });
            
            gsap.to(lineMaterial, {
                opacity: 0,
                delay: 0.2,
                duration: 0.5,
                ease: "power3.out",
                onComplete: () => {
                    scene.remove(line);
                    lineGeometry.dispose();
                    lineMaterial.dispose();
                }
            });
        }
        
        // Add pulsing circle
        const pulseGeometry = new THREE.CircleGeometry(0.15, 32);
        const pulseMaterial = new THREE.MeshBasicMaterial({
            color: headshotColor,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
        pulse.position.copy(position);
        pulse.lookAt(cameraPosition);
        
        scene.add(pulse);
        
        // Create pulsing animation
        gsap.to(pulse.scale, {
            x: 1.5,
            y: 1.5,
            duration: 0.2,
            repeat: 1,
            yoyo: true,
            ease: "power2.inOut",
            onComplete: () => {
                gsap.to(pulseMaterial, {
                    opacity: 0,
                    duration: 0.3,
                    ease: "power2.out",
                    onComplete: () => {
                        scene.remove(pulse);
                        pulseGeometry.dispose();
                        pulseMaterial.dispose();
                    }
                });
            }
        });
        
        return { ...baseHit, starbursts, pulse };
    }
    
    /**
     * Create an environment hit marker (smaller and less intense)
     */
    static createEnvironmentHit(scene, position, customColor, cameraPosition) {
        // Use gray color for environment hits
        const envColor = customColor || 0xaaaaaa;
        
        // Simple particle burst with fewer particles
        return HitMarker.createParticleBurst({
            scene, 
            position, 
            count: 15,
            color: envColor,
            size: 0.04,
            speed: 0.12,
            lifetime: 600
        });
    }
    
    /**
     * Helper method to create a particle burst effect
     */
    static createParticleBurst(options) {
        const { 
            scene, 
            position, 
            count = 20, 
            color = 0xffffff,
            size = 0.05,
            speed = 0.1,
            lifetime = 800 
        } = options;
        
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const velocities = [];
        
        for (let i = 0; i < count; i++) {
            // Random position very close to the impact point
            vertices.push(
                position.x,
                position.y,
                position.z
            );
            
            // Random velocity in all directions
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 2;
            const speed_modifier = speed * (0.5 + Math.random() * 0.5);
            
            velocities.push(
                Math.sin(phi) * Math.cos(theta) * speed_modifier,
                Math.sin(phi) * Math.sin(theta) * speed_modifier,
                Math.cos(phi) * speed_modifier
            );
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        
        const material = new THREE.PointsMaterial({
            color: color,
            size: size,
            transparent: true,
            opacity: 1,
            depthWrite: false
        });
        
        const particles = new THREE.Points(geometry, material);
        scene.add(particles);
        
        // Track start time for animation
        const startTime = Date.now();
        
        // Add to effects array for animation
        const effect = {
            particles,
            geometry,
            material,
            startTime,
            lifetime,
            velocities,
            update: function() {
                const elapsed = Date.now() - this.startTime;
                if (elapsed >= this.lifetime) {
                    // Remove effect when lifetime is over
                    scene.remove(this.particles);
                    this.geometry.dispose();
                    this.material.dispose();
                    return true; // return true to indicate effect should be removed
                }
                
                // Animate particles
                const positions = this.geometry.attributes.position.array;
                const progress = elapsed / this.lifetime;
                const count = positions.length / 3;
                
                for (let i = 0; i < count; i++) {
                    // Update positions
                    positions[i * 3] += this.velocities[i * 3] * (1 - progress * 0.8); // Slow down as progress increases
                    positions[i * 3 + 1] += this.velocities[i * 3 + 1] * (1 - progress * 0.8); 
                    positions[i * 3 + 2] += this.velocities[i * 3 + 2] * (1 - progress * 0.8);
                }
                
                this.geometry.attributes.position.needsUpdate = true;
                
                // Fade out particles
                this.material.opacity = 1 - progress;
                
                return false; // effect should continue
            }
        };
        
        HitMarker.effects.push(effect);
        
        return particles;
    }
    
    /**
     * Update all active hit marker effects
     * Call this in the animation loop
     */
    static update() {
        // Update all active effects
        for (let i = HitMarker.effects.length - 1; i >= 0; i--) {
            const shouldRemove = HitMarker.effects[i].update();
            if (shouldRemove) {
                HitMarker.effects.splice(i, 1);
            }
        }
    }
    
    /**
     * Show a UI hit marker in the center of the screen
     * @param {Object} options - Configuration options
     */
    static showUiHitMarker(options = {}) {
        const {
            size = 20,
            color = '#ffffff',
            duration = 800,
            thickness = 2,
            isHeadshot = false
        } = options;
        
        // Create container if it doesn't exist
        let container = document.getElementById('hitmarker-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'hitmarker-container';
            container.style.position = 'fixed';
            container.style.top = '50%';
            container.style.left = '50%';
            container.style.transform = 'translate(-50%, -50%)';
            container.style.pointerEvents = 'none';
            container.style.zIndex = '1000';
            document.body.appendChild(container);
        }
        
        // Create hit marker element
        const hitmarker = document.createElement('div');
        hitmarker.className = 'hitmarker';
        hitmarker.style.position = 'relative';
        hitmarker.style.width = `${size}px`;
        hitmarker.style.height = `${size}px`;
        
        // Create lines for X shape
        const createLine = (rotation) => {
            const line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.width = `${size}px`;
            line.style.height = `${thickness}px`;
            line.style.backgroundColor = color;
            line.style.top = '50%';
            line.style.left = '0';
            line.style.transform = `translateY(-50%) rotate(${rotation}deg)`;
            return line;
        };
        
        const line1 = createLine(45);
        const line2 = createLine(-45);
        
        hitmarker.appendChild(line1);
        hitmarker.appendChild(line2);
        
        container.appendChild(hitmarker);
        
        // Optional headshot indicator
        if (isHeadshot) {
            const headshotIndicator = document.createElement('div');
            headshotIndicator.textContent = 'HEADSHOT';
            headshotIndicator.style.position = 'absolute';
            headshotIndicator.style.color = '#ffcc00';
            headshotIndicator.style.fontFamily = 'Arial, sans-serif';
            headshotIndicator.style.fontSize = '14px';
            headshotIndicator.style.fontWeight = 'bold';
            headshotIndicator.style.textShadow = '0 0 3px rgba(0,0,0,0.5)';
            headshotIndicator.style.top = `${size + 10}px`;
            headshotIndicator.style.left = '50%';
            headshotIndicator.style.transform = 'translateX(-50%)';
            headshotIndicator.style.opacity = '0';
            
            hitmarker.appendChild(headshotIndicator);
            
            // Animate headshot text
            gsap.to(headshotIndicator, {
                opacity: 1,
                duration: 0.2,
                ease: "power2.out",
                onComplete: () => {
                    gsap.to(headshotIndicator, {
                        opacity: 0,
                        duration: 0.4,
                        delay: 0.3,
                        ease: "power2.in"
                    });
                }
            });
        }
        
        // Animate the hit marker
        gsap.to(hitmarker, {
            scale: 1.3,
            duration: 0.15,
            ease: "power2.out",
            onComplete: () => {
                gsap.to(hitmarker, {
                    scale: 1,
                    opacity: 0,
                    duration: 0.4,
                    ease: "power2.in",
                    onComplete: () => {
                        container.removeChild(hitmarker);
                        // Clean up container if empty
                        if (container.children.length === 0) {
                            document.body.removeChild(container);
                        }
                    }
                });
            }
        });
    }
} 