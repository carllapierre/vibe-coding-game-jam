import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetPath } from '../utils/pathHelper.js';
import sharedRenderer from '../utils/SharedRenderer.js';

export class Hotbar {
    constructor(inventory, _itemRegistry) {
        this.inventory = inventory;
        this.itemRegistry = _itemRegistry;
        this.slotPreviewScenes = [];
        this.slotPreviewCameras = [];
        this.slotModels = new Array(9).fill(null);  // Store models for each slot
        this.slotImages = new Array(9).fill(null);  // Store image elements
        
        // Track which slot is currently being rendered (for animation)
        this.currentlyRendering = -1;
        this.animationFrameId = null;
        
        // Register for amount updates
        this.inventory.setAmountChangeCallback((index, amount) => {
            this.updateSlot(index);
        });
        
        this.createHotbarUI();
    }

    createHotbarUI() {
        // Create the main hotbar container
        this.container = document.createElement('div');
        this.container.className = 'hotbar';
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 4px;
            padding: 4px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 8px;
            z-index: 1000;
        `;

        const slots = this.inventory.getAllSlots();
        this.loader = new GLTFLoader();

        // Create slots for each available item
        slots.forEach((slotData, i) => {
            const slot = document.createElement('div');
            slot.style.cssText = `
                width: 64px;
                height: 64px;
                background: rgba(255, 255, 255, 0.1);
                border: 2px solid #ffffff40;
                border-radius: 4px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                position: relative;
                overflow: hidden;
            `;

            // Add slot number
            const slotNumber = document.createElement('div');
            slotNumber.textContent = (i + 1).toString();
            slotNumber.style.cssText = `
                position: absolute;
                top: 2px;
                left: 2px;
                color: white;
                font-size: 12px;
                text-shadow: 1px 1px 1px black;
                z-index: 1;
            `;
            slot.appendChild(slotNumber);

            // Create preview container with img element
            const previewContainer = document.createElement('div');
            previewContainer.style.cssText = `
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
            `;
            
            // Create an img element to hold the rendered output
            const previewImg = document.createElement('img');
            previewImg.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: contain;
            `;
            
            // Initialize with empty slot (hidden img)
            if (!slotData.item) {
                previewImg.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
                previewImg.style.display = 'none';
            }
            
            previewContainer.appendChild(previewImg);
            
            // Store the image element for later updates
            this.slotImages[i] = previewImg;
            
            // Setup Three.js scene for this slot
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
            
            // Add lighting to the preview
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
            directionalLight.position.set(1, 1, 1);
            scene.add(directionalLight);

            // Position camera
            camera.position.set(0, 0.8, 2);
            camera.lookAt(0, -0.2, 0);

            slot.appendChild(previewContainer);

            // Add amount display
            const amountDisplay = document.createElement('div');
            amountDisplay.style.cssText = `
                position: absolute;
                bottom: 2px;
                right: 2px;
                color: white;
                font-size: 14px;
                text-shadow: 1px 1px 1px black;
                font-weight: bold;
                z-index: 1;
            `;
            amountDisplay.textContent = slotData.amount || '';
            slot.appendChild(amountDisplay);

            this.container.appendChild(slot);
            
            // Store the Three.js objects
            this.slotPreviewScenes.push(scene);
            this.slotPreviewCameras.push(camera);
        });

        // Add wheel listener for scrolling through slots
        window.addEventListener('wheel', (e) => {
            if (document.pointerLockElement) {  // Only scroll when in game
                const direction = e.deltaY > 0 ? 1 : -1;
                this.inventory.scrollHotbar(direction);
                this.update();
            }
        });

        // Start a single animation loop for the selected slot
        this.animateSelectedSlot();
        
        this.update();
    }
    
    // Shared animation loop for all slots
    animateSelectedSlot() {
        // Track which frame we're on to spread out rendering of non-selected slots
        let frameCount = 0;
        
        const animate = () => {
            this.animationFrameId = requestAnimationFrame(animate);
            frameCount++;
            
            // Always render the selected slot on every frame for smooth animation
            const selectedIndex = this.inventory.selectedSlot;
            
            if (this.slotModels[selectedIndex]) {
                // Rotate all models to maintain consistency when switching slots
                this.slotModels.forEach(model => {
                    if (model) model.rotation.y += 0.01;
                });
                
                // Render the selected slot
                sharedRenderer.renderToImage(
                    this.slotPreviewScenes[selectedIndex],
                    this.slotPreviewCameras[selectedIndex],
                    this.slotImages[selectedIndex],
                    64,
                    64
                );
            }
            
            // Every 30 frames (about 0.5 seconds), render one non-selected slot with an item
            // This ensures all slots get rendered periodically without overloading the renderer
            if (frameCount % 30 === 0) {
                // Find which slot to render next
                const slotToRender = (frameCount / 30) % this.slotModels.length;
                
                // Only render if it's not the selected slot and has a model
                if (slotToRender !== selectedIndex && this.slotModels[slotToRender]) {
                    sharedRenderer.renderToImage(
                        this.slotPreviewScenes[slotToRender],
                        this.slotPreviewCameras[slotToRender],
                        this.slotImages[slotToRender],
                        64,
                        64
                    );
                }
            }
        };
        
        // Start the animation loop
        animate();
    }

    updateSlot(index) {
        const slot = this.container.children[index];
        const itemData = this.inventory.getSlot(index);
        const itemConfig = this.itemRegistry.getType(itemData.item);
        
        // Update amount display
        const amountDisplay = slot.children[2];
        amountDisplay.textContent = itemData.amount || '';
        
        // Get the image element
        const slotImg = this.slotImages[index];
        
        // Update preview
        if (itemConfig) {
            // Make sure the image is visible when there's an item
            if (slotImg) {
                slotImg.style.display = 'block';
            }
            
            if (!this.slotModels[index]) {
                // Load new model
                this.loader.load(assetPath(`objects/${itemConfig.model}`), (gltf) => {
                    const model = gltf.scene;
                    model.scale.multiplyScalar(itemConfig.scale * 3);
                    model.position.set(0, -0.3, 0);
                    
                    // Remove old model if it exists
                    const scene = this.slotPreviewScenes[index];
                    if (this.slotModels[index]) {
                        scene.remove(this.slotModels[index]);
                    }
                    
                    scene.add(model);
                    this.slotModels[index] = model;
                    
                    // Always render immediately when a new item is loaded
                    sharedRenderer.renderToImage(
                        scene,
                        this.slotPreviewCameras[index],
                        slotImg,
                        64,
                        64
                    );
                });
            } else {
                // Render this slot immediately since it has an item
                // This ensures items are visible without waiting for the animation loop
                sharedRenderer.renderToImage(
                    this.slotPreviewScenes[index],
                    this.slotPreviewCameras[index],
                    slotImg,
                    64,
                    64
                );
            }
        } else {
            // Clear model if slot is empty
            const scene = this.slotPreviewScenes[index];
            if (this.slotModels[index]) {
                scene.remove(this.slotModels[index]);
                this.slotModels[index] = null;
            }
            
            // Clear the image for empty slots
            if (slotImg) {
                slotImg.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Transparent 1x1 pixel
                slotImg.style.display = 'none'; // Hide the image for empty slots
            }
        }

        // Update selection highlight
        const isSelected = index === this.inventory.selectedSlot;
        slot.style.border = isSelected ? '2px solid #ffffff' : '2px solid #ffffff40';
        slot.style.background = isSelected ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)';
    }

    update() {
        const slots = this.container.children;
        for (let i = 0; i < slots.length; i++) {
            this.updateSlot(i);
        }
    }
    
    // Clean up resources
    dispose() {
        // Cancel animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        // Clean up models
        this.slotModels.forEach((model, index) => {
            if (model) {
                this.slotPreviewScenes[index].remove(model);
            }
        });
        
        this.slotPreviewScenes = [];
        this.slotPreviewCameras = [];
        this.slotImages = [];
        this.slotModels = [];
    }
} 