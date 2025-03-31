import { gsap } from 'gsap';

/**
 * A sleek loading screen with subtle effects
 */
export class LoadingScreen {
    constructor() {
        this.container = null;
        this.progressBar = null;
        this.messageElement = null;
        this.progress = 0;
        this.isVisible = false;
        this.funnyMessages = [
            "TIP: Cakes do a looooot of damage!",
            "Creating good vibes...",
            "Shelving the food...",
            "Making sure the vibes are immaculate...",
            "Calibrating vibe levels...",
            "Loading digital snacks...",
            "TIP: Watermelons hurt!",
            "Tuning the virtual radio vibes on...",
            "Teaching NPCs how to vibe...",
            "Brewing digital vibe coffee..."
        ];
        this.activeParticles = [];
        this.animationFrameId = null;
        
        // Define UI elements to hide during loading
        this.uiElementSelectors = [
            { type: 'id', selector: 'character-view' },
            { type: 'id', selector: 'crosshair' },
            { type: 'class', selector: 'hotbar' },
            { type: 'class', selector: 'health-bar' }
        ];
        
        // Store for original element styles
        this.originalStyles = new Map();
        
        this.initialize();
    }
    
    /**
     * Add a UI element to hide during loading
     * @param {string} type - 'id' or 'class'
     * @param {string} selector - Element ID or class name
     */
    addElementToHide(type, selector) {
        this.uiElementSelectors.push({ type, selector });
    }
    
    /**
     * Get all UI elements to hide based on registered selectors
     * @returns {Array} - Array of DOM elements
     */
    getUIElements() {
        const elements = [];
        
        this.uiElementSelectors.forEach(({ type, selector }) => {
            let element;
            if (type === 'id') {
                element = document.getElementById(selector);
            } else if (type === 'class') {
                element = document.querySelector(`.${selector}`);
            }
            
            if (element) {
                elements.push(element);
            }
        });
        
        return elements;
    }

    initialize() {
        // Create container
        this.container = document.createElement('div');
        this.container.className = 'loading-screen';
        this.container.style.position = 'fixed';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.backgroundColor = '#000';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.justifyContent = 'center';
        this.container.style.alignItems = 'center';
        this.container.style.zIndex = '10001'; // Higher than any other UI element
        this.container.style.fontFamily = 'Arial, sans-serif';
        this.container.style.color = 'white';
        this.container.style.overflow = 'hidden';

        // Create title
        const title = document.createElement('h1');
        title.textContent = 'VIBEMART';
        title.style.fontSize = '48px';
        title.style.marginBottom = '50px';
        title.style.letterSpacing = '6px';
        title.style.fontWeight = '300';
        title.style.textShadow = '0 0 15px rgba(255, 255, 255, 0.7)';
        this.container.appendChild(title);

        // Create message element
        this.messageElement = document.createElement('div');
        this.messageElement.style.fontSize = '18px';
        this.messageElement.style.marginBottom = '40px';
        this.messageElement.style.opacity = '0.7';
        this.messageElement.style.textAlign = 'center';
        this.messageElement.style.maxWidth = '80%';
        this.messageElement.style.fontWeight = '300';
        this.messageElement.style.letterSpacing = '1px';
        this.container.appendChild(this.messageElement);

        // Create loading bar container
        const loadingBarContainer = document.createElement('div');
        loadingBarContainer.style.position = 'relative';
        loadingBarContainer.style.width = '400px';
        loadingBarContainer.style.height = '2px';
        loadingBarContainer.style.marginBottom = '40px';
        this.container.appendChild(loadingBarContainer);

        // Create glow element
        const glow = document.createElement('div');
        glow.style.position = 'absolute';
        glow.style.top = '0';
        glow.style.left = '0';
        glow.style.width = '0%';
        glow.style.height = '100%';
        glow.style.background = 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0) 100%)';
        glow.style.filter = 'blur(5px)';
        glow.style.zIndex = '1';
        loadingBarContainer.appendChild(glow);
        this.glowElement = glow;

        // Create loading bar
        this.progressBar = document.createElement('div');
        this.progressBar.style.position = 'absolute';
        this.progressBar.style.top = '0';
        this.progressBar.style.left = '0';
        this.progressBar.style.width = '0%';
        this.progressBar.style.height = '100%';
        this.progressBar.style.backgroundColor = '#fff';
        this.progressBar.style.transition = 'width 0.5s cubic-bezier(0.23, 1, 0.32, 1)';
        this.progressBar.style.zIndex = '2';
        loadingBarContainer.appendChild(this.progressBar);

        // Create particle container
        this.particleContainer = document.createElement('div');
        this.particleContainer.style.position = 'absolute';
        this.particleContainer.style.top = '0';
        this.particleContainer.style.left = '0';
        this.particleContainer.style.width = '100%';
        this.particleContainer.style.height = '100%';
        this.particleContainer.style.pointerEvents = 'none';
        this.particleContainer.style.zIndex = '0';
        this.container.appendChild(this.particleContainer);

        // Hide initially
        this.container.style.display = 'none';
    }

    /**
     * Store original styles for an element
     * @param {Element} element - DOM element
     */
    storeElementStyle(element) {
        if (!element) return;
        
        // Store style information with a unique key
        this.originalStyles.set(element, {
            display: element.style.display,
            cssText: element.style.cssText
        });
    }

    /**
     * Restore original styles for an element
     * @param {Element} element - DOM element
     */
    restoreElementStyle(element) {
        if (!element || !this.originalStyles.has(element)) return;
        
        const originalStyle = this.originalStyles.get(element);
        
        // First, restore the full cssText to get all styles back
        if (originalStyle.cssText) {
            element.style.cssText = originalStyle.cssText;
        }
        
        // Handle special case for the hotbar
        if (element.classList && element.classList.contains('hotbar')) {
            // Ensure correct display mode for hotbar
            element.style.display = 'flex';
        } 
        // For other elements, make sure they're visible if they should be
        else if (element.style.display === 'none') {
            if (originalStyle.display && originalStyle.display !== 'none') {
                element.style.display = originalStyle.display;
            } else {
                element.style.display = '';
            }
        }
    }

    /**
     * Show the loading screen
     */
    show() {
        // Clear previous style storage
        this.originalStyles.clear();
        
        // Get all UI elements to hide
        const elements = this.getUIElements();
        
        // Store original styles and hide each element
        elements.forEach(element => {
            this.storeElementStyle(element);
            element.style.display = 'none';
        });

        document.body.appendChild(this.container);
        this.container.style.display = 'flex';
        this.isVisible = true;
        this.showRandomMessage();
        this.startParticleEffect();
        this.startMessageAnimation();
    }

    /**
     * Hide the loading screen
     */
    hide() {
        this.isVisible = false;
        
        // Get all UI elements to restore
        const elements = this.getUIElements();
        
        // Restore original styles for each element
        elements.forEach(element => {
            this.restoreElementStyle(element);
        });
        
        // Apply a fade-out animation
        gsap.to(this.container, {
            opacity: 0,
            duration: 0.5,
            ease: 'power2.out',
            onComplete: () => {
                this.stopParticleEffect();
                if (this.container.parentNode) {
                    document.body.removeChild(this.container);
                }
                this.container.style.opacity = '1';
            }
        });
    }

    /**
     * Update progress value (0-100)
     * @param {number} value - Progress percentage (0-100)
     */
    updateProgress(value) {
        this.progress = Math.min(100, Math.max(0, value));
        this.progressBar.style.width = `${this.progress}%`;
        this.glowElement.style.width = `${this.progress}%`;
        
        // Animate the glow effect
        gsap.to(this.glowElement, {
            x: this.progress / 100 * 400, // Move to end of progress
            duration: 0.5,
            ease: 'power2.out'
        });
        
        // Add subtle particles at milestones
        if (this.progress % 20 < 1 && this.progress > 0) {
            this.createParticleBurst(5);
        }
    }

    /**
     * Display a random message from the funny messages list
     */
    showRandomMessage() {
        const randomIndex = Math.floor(Math.random() * this.funnyMessages.length);
        this.messageElement.textContent = this.funnyMessages[randomIndex];
    }

    /**
     * Start cycling through messages at intervals
     */
    startMessageAnimation() {
        // Clear any existing timer
        if (this.messageTimer) {
            clearInterval(this.messageTimer);
        }
        
        // Set up message cycling
        this.messageTimer = setInterval(() => {
            if (this.isVisible) {
                gsap.to(this.messageElement, {
                    opacity: 0,
                    duration: 0.5,
                    onComplete: () => {
                        this.showRandomMessage();
                        gsap.to(this.messageElement, {
                            opacity: 0.7,
                            duration: 0.5
                        });
                    }
                });
            } else {
                clearInterval(this.messageTimer);
            }
        }, 3000);
    }

    /**
     * Create a particle element
     */
    createParticle() {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = '1px';
        particle.style.height = '20px';
        particle.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
        particle.style.pointerEvents = 'none';
        
        // Start particles from the loading bar position
        const y = window.innerHeight / 2; // Approximate center
        const x = Math.random() * window.innerWidth;
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        
        // Vertical velocity only
        const vy = -0.5 - Math.random() * 0.5; // Move upward slowly
        const vx = 0;
        
        // Add to DOM
        this.particleContainer.appendChild(particle);
        
        // Add to active particles array
        this.activeParticles.push({
            element: particle,
            x, y, vx, vy,
            lifetime: 0,
            maxLifetime: 3000 + Math.random() * 2000
        });
        
        return particle;
    }

    /**
     * Create a burst of particles
     * @param {number} count - Number of particles to create
     */
    createParticleBurst(count = 5) {
        for (let i = 0; i < count; i++) {
            this.createParticle();
        }
    }

    /**
     * Start the particle animation effect
     */
    startParticleEffect() {
        // Initial particles - just a few subtle ones
        for (let i = 0; i < 10; i++) {
            this.createParticle();
        }
        
        // Start animation loop
        this.stopParticleEffect(); // Clear any existing animation
        this.animateParticles();
    }

    /**
     * Stop the particle animation effect
     */
    stopParticleEffect() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Clean up any remaining particles
        this.activeParticles.forEach(p => {
            if (p.element.parentNode) {
                p.element.parentNode.removeChild(p.element);
            }
        });
        this.activeParticles = [];
    }

    /**
     * Animate particles
     */
    animateParticles() {
        if (!this.isVisible) return;
        
        // Update particle positions
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const p = this.activeParticles[i];
            
            // Update position
            p.x += p.vx;
            p.y += p.vy;
            p.element.style.left = `${p.x}px`;
            p.element.style.top = `${p.y}px`;
            
            // Update lifetime
            p.lifetime += 16; // Approximately 16ms per frame at 60fps
            
            // Fade out based on lifetime
            const opacity = 0.2 * (1 - (p.lifetime / p.maxLifetime));
            p.element.style.opacity = opacity;
            
            // Remove if lifetime exceeded or out of bounds
            if (p.lifetime > p.maxLifetime || 
                p.x < -20 || p.x > window.innerWidth + 20 || 
                p.y < -20 || p.y > window.innerHeight + 20) {
                if (p.element.parentNode) {
                    p.element.parentNode.removeChild(p.element);
                }
                this.activeParticles.splice(i, 1);
            }
        }
        
        // Add new particles occasionally - very sparse
        if (this.activeParticles.length < 20 && Math.random() < 0.05) {
            this.createParticle();
        }
        
        this.animationFrameId = requestAnimationFrame(() => this.animateParticles());
    }
} 