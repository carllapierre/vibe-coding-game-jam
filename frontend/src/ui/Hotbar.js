import * as THREE from 'three';
import { GLTFLoader } from './../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { assetPath } from '../utils/pathHelper.js';

export class Hotbar {
    constructor(inventory, _itemRegistry) {
        this.inventory = inventory;
        this.itemRegistry = _itemRegistry;
        this.slotPreviewScenes = [];
        this.slotPreviewCameras = [];
        this.slotPreviewRenderers = [];
        this.slotModels = new Array(9).fill(null);  // Store models for each slot
        
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

            // Create preview canvas
            const previewContainer = document.createElement('div');
            previewContainer.style.cssText = `
                width: 100%;
                height: 100%;
                position: absolute;
                top: 0;
                left: 0;
            `;
            
            // Setup Three.js for this slot
            const scene = new THREE.Scene();
            const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
            const renderer = new THREE.WebGLRenderer({ alpha: true });
            renderer.setSize(64, 64);
            previewContainer.appendChild(renderer.domElement);
            
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
            this.slotPreviewRenderers.push(renderer);
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

    updateSlot(index) {
        const slot = this.container.children[index];
        const itemData = this.inventory.getSlot(index);
        const itemConfig = this.itemRegistry.getType(itemData.item);
        // Update amount display
        const amountDisplay = slot.children[2];
        amountDisplay.textContent = itemData.amount || '';

        // Update preview
        if (itemConfig) {
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

                    // Start animation
                    const animate = () => {
                        if (this.slotModels[index] === model) {  // Only animate if this is still the current model
                            requestAnimationFrame(animate);
                            model.rotation.y += 0.01;
                            this.slotPreviewRenderers[index].render(scene, this.slotPreviewCameras[index]);
                        }
                    };
                    animate();
                });
            }
        } else {
            // Clear model if slot is empty
            const scene = this.slotPreviewScenes[index];
            if (this.slotModels[index]) {
                scene.remove(this.slotModels[index]);
                this.slotModels[index] = null;
            }
            this.slotPreviewRenderers[index].render(scene, this.slotPreviewCameras[index]);
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
} 