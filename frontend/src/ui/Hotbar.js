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
        
        // Track the last selected slot to detect changes
        this.lastSelectedSlot = -1;
        
        // Create UI elements first
        this.createHotbarUI();
        this.createItemDisplay();
        
        // Now that UI is fully initialized, register for amount updates
        this.inventory.setAmountChangeCallback((index, amount) => {
            this.updateSlot(index);
        });
        
        // Perform initial UI update
        this.update();
    }

    // Format item name from ID (remove hyphens, capitalize first letters)
    formatItemName(itemId) {
        if (!itemId) return '';
        return itemId
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    createItemDisplay() {
        // Create the item display container
        this.itemDisplay = document.createElement('div');
        this.itemDisplay.className = 'item-display';
        this.itemDisplay.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 120px;
            background: linear-gradient(135deg, #6b9ac4 0%, #486f9d 100%);
            border: 2px solid #ffffffa0;
            border-radius: 12px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            z-index: 1000;
            color: white;
            font-family: sans-serif;
            box-shadow: 0 4px 15px rgba(72, 111, 157, 0.3);
            transform-origin: top left;
            opacity: 0;
            transform: scale(0.8);
            transition: opacity 0.3s ease, transform 0.3s ease;
        `;

        // Create preview container
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = `
            width: 90px;
            height: 90px;
            background: rgba(255, 255, 255, 0.25);
            border-radius: 8px;
            position: relative;
            margin-bottom: 10px;
            box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.3);
            overflow: hidden;
        `;

        // Create image element for the preview
        this.itemPreviewImg = document.createElement('img');
        this.itemPreviewImg.style.cssText = `
            width: 100%;
            height: 100%;
            object-fit: contain;
        `;
        previewContainer.appendChild(this.itemPreviewImg);
        this.itemDisplay.appendChild(previewContainer);

        // Create item name display
        this.itemNameDisplay = document.createElement('div');
        this.itemNameDisplay.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 5px;
            text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.6);
            color: #fff;
        `;
        this.itemDisplay.appendChild(this.itemNameDisplay);

        // Create damage display container
        const damageContainer = document.createElement('div');
        damageContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 5px;
            margin-top: 5px;
            background: rgba(255, 255, 255, 0.25);
            padding: 5px 10px;
            border-radius: 12px;
        `;

        // Create damage value display
        this.damageDisplay = document.createElement('div');
        this.damageDisplay.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: #fff;
            text-shadow: 0px 0px 4px rgba(0, 0, 0, 0.7);
        `;
        damageContainer.appendChild(this.damageDisplay);
        
        // Add DMG text
        const dmgText = document.createElement('div');
        dmgText.textContent = 'DMG';
        dmgText.style.cssText = `
            font-size: 14px;
            color: #ffffffcc;
            text-shadow: 0px 0px 3px rgba(0, 0, 0, 0.7);
        `;
        damageContainer.appendChild(dmgText);
        
        this.itemDisplay.appendChild(damageContainer);

        document.body.appendChild(this.itemDisplay);
        
        // Initial update
        this.updateItemDisplay();
    }

    updateItemDisplay() {
        // Safety check - make sure the item display elements exist
        if (!this.itemPreviewImg || !this.itemNameDisplay || !this.damageDisplay) {
            return;
        }
        
        const selectedIndex = this.inventory.selectedSlot;
        const itemData = this.inventory.getSlot(selectedIndex);
        
        if (itemData && itemData.item) {
            // Check if display is currently hidden
            const wasHidden = this.itemDisplay.style.display === 'none' || this.itemDisplay.style.opacity === '0';
            
            // Show the display
            this.itemDisplay.style.display = 'flex';
            this.itemDisplay.style.opacity = '1';
            this.itemDisplay.style.transform = 'scale(1)';
            
            // Apply animation only when transitioning from hidden to shown
            if (wasHidden) {
                // Remove existing animation if any
                this.itemDisplay.style.animation = '';
                
                // Force a reflow to restart animation
                void this.itemDisplay.offsetWidth;
                
                // Add bounce and shake animation
                this.itemDisplay.style.animation = 'itemAppear 0.5s ease-out';
                
                // Add animation keyframes if not already added
                if (!document.getElementById('hotbarAnimations')) {
                    const style = document.createElement('style');
                    style.id = 'hotbarAnimations';
                    style.textContent = `
                        @keyframes itemAppear {
                            0% {
                                transform: scale(0.5);
                                opacity: 0;
                            }
                            50% {
                                transform: scale(1.1) rotate(2deg);
                            }
                            70% {
                                transform: scale(0.95) rotate(-1deg);
                            }
                            85% {
                                transform: scale(1.05) rotate(1deg);
                            }
                            100% {
                                transform: scale(1) rotate(0);
                                opacity: 1;
                            }
                        }
                    `;
                    document.head.appendChild(style);
                }
            }
            
            // Update image
            this.getItemImage(itemData.item).then(dataUrl => {
                this.itemPreviewImg.src = dataUrl;
                this.itemPreviewImg.style.display = 'block';
            });
            
            // Get item config to access damage
            const itemConfig = this.itemRegistry.getType(itemData.item);
            
            // Update name
            this.itemNameDisplay.textContent = this.formatItemName(itemData.item);
            
            // Update damage
            if (itemConfig && itemConfig.damage !== undefined) {
                this.damageDisplay.textContent = itemConfig.damage;
            } else {
                this.damageDisplay.textContent = '-';
            }
        } else {
            // Hide display when no item is selected
            this.itemDisplay.style.opacity = '0';
            this.itemDisplay.style.transform = 'scale(0.8)';
            
            // Actually hide after transition
            setTimeout(() => {
                if (this.itemDisplay.style.opacity === '0') {
                    this.itemDisplay.style.display = 'none';
                }
            }, 300);
        }
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
                this.update();  // Add this back to update the UI when scrolling
            }
        });
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
                
                // Add rotation to the model for a more dynamic view
                model.rotation.x = Math.PI * 0.1; // slight tilt forward
                model.rotation.y = Math.PI * 0.25; // rotate to show more sides
                
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
        
        // Update item display if this is the selected slot
        if (isSelected) {
            this.updateItemDisplay();
        }
    }

    update() {
        // Check if selected slot has changed
        if (this.lastSelectedSlot !== this.inventory.selectedSlot) {
            this.lastSelectedSlot = this.inventory.selectedSlot;
            // Update item display when selection changes
            this.updateItemDisplay();
        }
        
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
        
        // Remove the item display from DOM
        if (this.itemDisplay && this.itemDisplay.parentNode) {
            this.itemDisplay.parentNode.removeChild(this.itemDisplay);
        }
        
        this.slotPreviewScenes = [];
        this.slotPreviewCameras = [];
        this.slotImages = [];
        this.slotModels = [];
    }
} 