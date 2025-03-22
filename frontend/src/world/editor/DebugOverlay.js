import * as THREE from 'three';

/**
 * Debug overlay component that shows performance metrics and scene information
 */
export class DebugOverlay {
    /**
     * @param {THREE.Scene} scene - The Three.js scene
     * @param {THREE.Camera} camera - The Three.js camera
     * @param {THREE.WebGLRenderer} renderer - The Three.js renderer
     */
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // Create DOM elements
        this.createOverlay();
        
        // Tracking stats
        this.stats = {
            fps: 0,
            drawCalls: 0,
            triangles: 0,
            objectCount: 0,
            textureCount: 0,
            memoryUsage: 0
        };
        
        // Ray for object identification
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Track update timing
        this.lastUpdateTime = performance.now();
        this.frameCount = 0;
        this.updateInterval = 500; // ms
        
        // Set up event listeners
        this.setupEventListeners();
    }
    
    /**
     * Create the debug overlay DOM elements
     */
    createOverlay() {
        // Main container
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: #00ff00;
            padding: 10px;
            font-family: monospace;
            font-size: 14px;
            border-radius: 5px;
            display: none;
            z-index: 1000;
            max-width: 300px;
            pointer-events: none;
        `;
        document.body.appendChild(this.container);
        
        // Performance info
        this.performanceInfo = document.createElement('div');
        this.performanceInfo.innerHTML = `
            <div>FPS: <span id="fps">0</span></div>
            <div>Draw Calls: <span id="drawCalls">0</span></div>
            <div>Triangles: <span id="triangles">0</span>k</div>
            <div>Objects: <span id="objectCount">0</span></div>
            <div>Textures: <span id="textureCount">0</span></div>
            <div>Memory: <span id="memoryUsage">0</span> MB</div>
        `;
        this.container.appendChild(this.performanceInfo);
        
        // Object info
        this.objectInfo = document.createElement('div');
        this.objectInfo.style.marginTop = '10px';
        this.objectInfo.innerHTML = `
            <div>Hovered Object:</div>
            <div id="objectName">None</div>
        `;
        this.container.appendChild(this.objectInfo);
        
        // Store references to spans for quick updates
        this.fpsSpan = document.getElementById('fps');
        this.drawCallsSpan = document.getElementById('drawCalls');
        this.trianglesSpan = document.getElementById('triangles');
        this.objectCountSpan = document.getElementById('objectCount');
        this.textureCountSpan = document.getElementById('textureCount');
        this.memoryUsageSpan = document.getElementById('memoryUsage');
        this.objectNameDiv = document.getElementById('objectName');
    }
    
    /**
     * Set up event listeners for mouse movement
     */
    setupEventListeners() {
        window.addEventListener('mousemove', (event) => {
            // Convert mouse position to normalized device coordinates
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });
    }
    
    /**
     * Show the debug overlay
     */
    show() {
        this.container.style.display = 'block';
    }
    
    /**
     * Hide the debug overlay
     */
    hide() {
        this.container.style.display = 'none';
    }
    
    /**
     * Toggle visibility of the debug overlay
     */
    toggle() {
        if (this.container.style.display === 'none') {
            this.show();
        } else {
            this.hide();
        }
    }
    
    /**
     * Update performance metrics and object info
     * Called every frame from the main render loop
     */
    update() {
        this.frameCount++;
        const currentTime = performance.now();
        const elapsed = currentTime - this.lastUpdateTime;
        
        // Only update stats every interval
        if (elapsed >= this.updateInterval) {
            // Calculate FPS
            this.stats.fps = Math.round((this.frameCount * 1000) / elapsed);
            this.frameCount = 0;
            this.lastUpdateTime = currentTime;
            
            // Get renderer stats
            const rendererInfo = this.renderer.info;
            this.stats.drawCalls = rendererInfo.render.calls;
            this.stats.triangles = Math.round(rendererInfo.render.triangles / 1000);
            
            // Count objects
            let objectCount = 0;
            this.scene.traverse(() => { objectCount++; });
            this.stats.objectCount = objectCount;
            
            // Count textures
            this.stats.textureCount = rendererInfo.memory.textures;
            
            // Get memory usage (non-standard, may not work in all browsers)
            if (window.performance && window.performance.memory) {
                this.stats.memoryUsage = Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024));
            }
            
            // Update DOM elements
            this.updateStatsDisplay();
        }
        
        // Update hovered object info every frame
        this.updateHoveredObjectInfo();
    }
    
    /**
     * Update the DOM elements with current stats
     */
    updateStatsDisplay() {
        this.fpsSpan.textContent = this.stats.fps;
        this.drawCallsSpan.textContent = this.stats.drawCalls;
        this.trianglesSpan.textContent = this.stats.triangles;
        this.objectCountSpan.textContent = this.stats.objectCount;
        this.textureCountSpan.textContent = this.stats.textureCount;
        this.memoryUsageSpan.textContent = this.stats.memoryUsage;
    }
    
    /**
     * Update information about currently hovered object
     */
    updateHoveredObjectInfo() {
        // Cast ray from mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        
        // Update object info if we hit something
        if (intersects.length > 0) {
            const object = intersects[0].object;
            
            let infoHTML = '';
            
            // Basic object info
            infoHTML += `<div>Name: ${object.name || 'unnamed'}</div>`;
            
            // Type info from userData
            if (object.userData.id) {
                infoHTML += `<div>ID: ${object.userData.id}</div>`;
                
                if (object.userData.instanceIndex !== undefined) {
                    infoHTML += `<div>Instance: ${object.userData.instanceIndex}</div>`;
                }
                
                if (object.userData.type) {
                    infoHTML += `<div>Type: ${object.userData.type}</div>`;
                }
            }
            
            // Position info
            infoHTML += `<div>Position: (${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)})</div>`;
            
            this.objectNameDiv.innerHTML = infoHTML;
        } else {
            this.objectNameDiv.textContent = 'None';
        }
    }
    
    /**
     * Clean up resources and event listeners
     */
    dispose() {
        window.removeEventListener('mousemove', this.handleMouseMove);
        document.body.removeChild(this.container);
    }
} 