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
        
        // Cache for rendered images by item type
        this.imageCache = {};
        
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
        
        this.update();
    }

    // Get cached image or generate a new one
    getItemImage(itemType) {
        // Return cached image if available
        if (this.imageCache[itemType]) {
            return this.imageCache[itemType];
        }
        
        // Create a new dataURL promise that will be resolved when the image is rendered
        const imagePromise = new Promise((resolve) => {
            const itemConfig = this.itemRegistry.getType(itemType);
            
            // Setup temporary scene and camera for rendering
            const tempScene = new THREE.Scene();
            const tempCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
            
            // Add lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            tempScene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
            directionalLight.position.set(1, 1, 1);
            tempScene.add(directionalLight);
            
            // Position camera
            tempCamera.position.set(0, 0.8, 2);
            tempCamera.lookAt(0, -0.2, 0);
            
            // Load 3D model
            this.loader.load(assetPath(`objects/${itemConfig.model}`), (gltf) => {
                const model = gltf.scene;
                model.scale.multiplyScalar(itemConfig.scale * 3);
                model.position.set(0, -0.3, 0);
                
                tempScene.add(model);
                
                // Create a temporary image to hold the rendering
                const tempImg = document.createElement('img');
                
                // Render to the temporary image - renderToImage doesn't use callbacks
                const dataUrl = sharedRenderer.renderToImage(
                    tempScene,
                    tempCamera,
                    tempImg,
                    64, 
                    64
                );
                
                // The image src is set by renderToImage, now resolve with the dataUrl
                resolve(dataUrl);
                
                // Clean up
                tempScene.remove(model);
            });
        });
        
        // Store promise in cache and return it
        this.imageCache[itemType] = imagePromise;
        return imagePromise;
    }

    updateSlot(index) {
        const slot = this.container.children[index];
        const itemData = this.inventory.getSlot(index);
        
        // Update amount display
        const amountDisplay = slot.children[2];
        amountDisplay.textContent = itemData.amount || '';
        
        // Get the image element
        const slotImg = this.slotImages[index];
        
        // Update preview
        if (itemData.item) {
            // Make sure the image is visible when there's an item
            slotImg.style.display = 'block';
            
            // Get or generate the image for this item type
            this.getItemImage(itemData.item).then(dataUrl => {
                // Directly assign the dataUrl to the image src
                slotImg.src = dataUrl;
            }).catch(err => {
                console.error("Error loading item image:", err);
            });
        } else {
            // Clear the image for empty slots
            slotImg.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Transparent 1x1 pixel
            slotImg.style.display = 'none'; // Hide the image for empty slots
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
        // Clean up models
        this.slotModels.forEach((model, index) => {
            if (model) {
                this.slotPreviewScenes[index].remove(model);
            }
        });
        
        // Clear cache
        this.imageCache = {};
        
        this.slotPreviewScenes = [];
        this.slotPreviewCameras = [];
        this.slotImages = [];
        this.slotModels = [];
    }
} 