import * as THREE from 'three';
import { OrbitControls } from './../../node_modules/three/examples/jsm/controls/OrbitControls.js';

export class DebugManager {
    constructor(scene, camera, renderer, character) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.character = character;
        this.isDebugMode = false;
        
        // Store original camera position and rotation
        this.originalCameraPosition = new THREE.Vector3();
        this.originalCameraRotation = new THREE.Euler();
        
        // Create orbit controls for free roaming (disabled by default)
        this.orbitControls = new OrbitControls(camera, renderer.domElement);
        this.orbitControls.enabled = false;
        
        // Configure orbit controls
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.screenSpacePanning = false;
        this.orbitControls.minDistance = 1;
        this.orbitControls.maxDistance = 500;
        this.orbitControls.maxPolarAngle = Math.PI;
        
        // Movement settings
        this.moveSpeed = 1.0;
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            q: false,
            e: false,
            shift: false
        };
        
        // Create debug overlay
        this.createDebugOverlay();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    createDebugOverlay() {
        this.debugOverlay = document.createElement('div');
        this.debugOverlay.style.cssText = `
            position: fixed;
            top: 10px;
            left: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: #00ff00;
            padding: 10px;
            font-family: monospace;
            font-size: 14px;
            border-radius: 5px;
            display: none;
            z-index: 1000;
        `;
        this.debugOverlay.innerHTML = `
            <div>Editor Mode Active</div>
            <div>Press Shift+D to return to game</div>
            <div>Left Click + Drag: Rotate</div>
            <div>Right Click + Drag: Pan</div>
            <div>WASD: Move horizontally</div>
            <div>Q/E: Move up/down</div>
            <div>Hold Shift: Move faster</div>
            <div>Mouse Wheel: Zoom</div>
        `;
        document.body.appendChild(this.debugOverlay);
    }
    
    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'D' && event.shiftKey) {
                event.preventDefault();
                this.toggleDebugMode();
            }
            if (this.isDebugMode) {
                this.handleKeyDown(event);
            }
        });

        document.addEventListener('keyup', (event) => {
            if (this.isDebugMode) {
                this.handleKeyUp(event);
            }
        });
    }

    handleKeyDown(event) {
        const key = event.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            event.preventDefault();
            this.keys[key] = true;
        }
        if (event.shiftKey) {
            this.keys.shift = true;
        }
    }

    handleKeyUp(event) {
        const key = event.key.toLowerCase();
        if (this.keys.hasOwnProperty(key)) {
            this.keys[key] = false;
        }
        if (!event.shiftKey) {
            this.keys.shift = false;
        }
    }
    
    toggleDebugMode() {
        this.isDebugMode = !this.isDebugMode;
        
        if (this.isDebugMode) {
            // Store current camera state
            this.originalCameraPosition.copy(this.camera.position);
            this.originalCameraRotation.copy(this.camera.rotation);
            
            // Enable orbit controls
            this.orbitControls.enabled = true;
            
            // Show debug overlay
            this.debugOverlay.style.display = 'block';

            // Disable character
            this.character.setEnabled(false);
        } else {
            // Restore original camera state
            this.camera.position.copy(this.originalCameraPosition);
            this.camera.rotation.copy(this.originalCameraRotation);
            
            // Disable orbit controls
            this.orbitControls.enabled = false;
            
            // Hide debug overlay
            this.debugOverlay.style.display = 'none';

            // Re-enable character
            this.character.setEnabled(true);
        }
    }
    
    update() {
        if (!this.isDebugMode) return;

        // Update orbit controls
        this.orbitControls.update();

        // Handle keyboard movement
        const actualMoveSpeed = this.moveSpeed * (this.keys.shift ? 2 : 1);
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        const up = new THREE.Vector3(0, 1, 0);

        // Get forward and right vectors from camera
        this.camera.getWorldDirection(forward);
        forward.y = 0; // Keep movement horizontal
        forward.normalize();
        right.crossVectors(forward, up).normalize();

        // Apply movement
        if (this.keys.w) this.camera.position.addScaledVector(forward, actualMoveSpeed);
        if (this.keys.s) this.camera.position.addScaledVector(forward, -actualMoveSpeed);
        if (this.keys.d) this.camera.position.addScaledVector(right, actualMoveSpeed);
        if (this.keys.a) this.camera.position.addScaledVector(right, -actualMoveSpeed);
        if (this.keys.e) this.camera.position.y += actualMoveSpeed;
        if (this.keys.q) this.camera.position.y -= actualMoveSpeed;
    }
} 