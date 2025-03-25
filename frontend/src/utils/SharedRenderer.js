import * as THREE from 'three';

/**
 * Singleton service that provides shared WebGL renderers to avoid creating 
 * multiple WebGL contexts across the application
 */
class SharedRendererService {
    constructor() {
        // Main renderer for the scene
        this.mainRenderer = null;
        
        // Shared renderer for UI elements, previews, etc.
        this.sharedRenderer = null;
        
        // Shared canvas for the UI renderer
        this.sharedCanvas = document.createElement('canvas');
        this.sharedCanvas.width = 256;
        this.sharedCanvas.height = 256;
    }
    
    /**
     * Get the main renderer (creates it if it doesn't exist)
     * @param {Object} options - Renderer options
     * @returns {THREE.WebGLRenderer} The main renderer
     */
    getMainRenderer(options = {}) {
        if (!this.mainRenderer) {
            this.mainRenderer = new THREE.WebGLRenderer({
                antialias: options.antialias !== undefined ? options.antialias : true,
                powerPreference: options.powerPreference || "high-performance",
                alpha: options.alpha || false
            });
            
            // Set default properties
            this.mainRenderer.setSize(
                options.width || window.innerWidth, 
                options.height || window.innerHeight
            );
            
            console.log('Main WebGL renderer created');
        }
        
        return this.mainRenderer;
    }
    
    /**
     * Get the shared renderer for UI elements (creates it if it doesn't exist)
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     * @returns {THREE.WebGLRenderer} The shared renderer
     */
    getSharedRenderer(width = 256, height = 256) {
        if (!this.sharedRenderer) {
            // Update canvas size if needed
            if (this.sharedCanvas.width !== width || this.sharedCanvas.height !== height) {
                this.sharedCanvas.width = width;
                this.sharedCanvas.height = height;
            }
            
            // Create renderer
            this.sharedRenderer = new THREE.WebGLRenderer({ 
                canvas: this.sharedCanvas,
                alpha: true,
                antialias: true
            });
            this.sharedRenderer.setClearColor(0x000000, 0);
            this.sharedRenderer.setSize(width, height);
            
            console.log('Shared WebGL renderer created');
        } else {
            // Just update size if renderer exists
            if (width !== this.sharedCanvas.width || height !== this.sharedCanvas.height) {
                this.sharedCanvas.width = width;
                this.sharedCanvas.height = height;
                this.sharedRenderer.setSize(width, height);
            }
        }
        
        return this.sharedRenderer;
    }
    
    /**
     * Render a scene to an image element
     * @param {THREE.Scene} scene - The scene to render
     * @param {THREE.Camera} camera - The camera to use
     * @param {HTMLImageElement} imgElement - The image element to update
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    renderToImage(scene, camera, imgElement, width = 256, height = 256) {
        const renderer = this.getSharedRenderer(width, height);
        renderer.render(scene, camera);
        
        // Update the image src with the new render
        if (imgElement) {
            imgElement.src = this.sharedCanvas.toDataURL('image/png');
        }
        
        return this.sharedCanvas.toDataURL('image/png');
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        if (this.mainRenderer) {
            this.mainRenderer.dispose();
            this.mainRenderer = null;
        }
        
        if (this.sharedRenderer) {
            this.sharedRenderer.dispose();
            this.sharedRenderer = null;
        }
        
        console.log('SharedRendererService disposed');
    }
}

// Create and export singleton instance
const sharedRenderer = new SharedRendererService();
export default sharedRenderer; 