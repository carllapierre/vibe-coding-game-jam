import * as THREE from 'three';
import { GLTFLoader } from './../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { assetPath } from '../utils/pathHelper.js';
export class Hotbar {
    constructor(inventory) {
        this.inventory = inventory;
        this.slotPreviewScenes = [];
        this.slotPreviewCameras = [];
        this.slotPreviewRenderers = [];
        
        // Register for amount updates
        this.inventory.setAmountChangeCallback((index, amount) => {
            this.update();
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
        const loader = new GLTFLoader();

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

            // Only load model if slot has an item
            if (slotData.item) {
                loader.load(assetPath(`objects/${slotData.item.model}`), (gltf) => {
                    const model = gltf.scene;
                    model.scale.multiplyScalar(slotData.item.scale * 3);
                    // Center the model
                    model.position.set(0, -0.3, 0); // Move down slightly
                    scene.add(model);

                    // Position camera to look at the model from slightly above
                    camera.position.set(0, 0.8, 2);
                    camera.lookAt(0, -0.2, 0); // Look at the model's new position

                    // Auto-rotate animation
                    const animate = () => {
                        requestAnimationFrame(animate);
                        model.rotation.y += 0.01;
                        renderer.render(scene, camera);
                    };
                    animate();
                }, undefined, (error) => {
                    console.error('Error loading model:', error);
                });
            }

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

        document.body.appendChild(this.container);

        // Add keyboard listeners for slot selection
        document.addEventListener('keydown', (e) => {
            const num = parseInt(e.key);
            if (num >= 1 && num <= slots.length) {
                this.inventory.selectSlot(num - 1);
                this.update();
            }
        });

        // Add wheel listener for scrolling through slots
        document.addEventListener('wheel', (e) => {
            const direction = e.deltaY > 0 ? 1 : -1;
            this.inventory.scrollHotbar(direction);
            this.update();
        });

        this.update();
    }

    update() {
        const slots = this.container.children;
        const selectedSlot = this.inventory.getSelectedSlot().index;

        for (let i = 0; i < slots.length; i++) {
            const slot = slots[i];
            const itemData = this.inventory.getSlot(i);
            
            // Reset slot style
            slot.style.border = '2px solid #ffffff40';
            
            // Update amount
            const amountDisplay = slot.children[2]; // Now the third child after preview container
            amountDisplay.textContent = itemData.amount || '';

            // Clear preview if item is gone
            if (!itemData.item) {
                const scene = this.slotPreviewScenes[i];
                while(scene.children.length > 0) {
                    const child = scene.children[0];
                    if (child.type === 'Mesh') {
                        child.geometry.dispose();
                        child.material.dispose();
                    }
                    scene.remove(child);
                }
                // Keep lights in the scene
                const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
                directionalLight.position.set(1, 1, 1);
                scene.add(ambientLight);
                scene.add(directionalLight);
                // Render empty scene
                this.slotPreviewRenderers[i].render(scene, this.slotPreviewCameras[i]);
            }

            // Highlight selected slot
            if (i === selectedSlot) {
                slot.style.border = '2px solid #ffffff';
                slot.style.background = 'rgba(255, 255, 255, 0.2)';
            } else {
                slot.style.background = 'rgba(255, 255, 255, 0.1)';
            }
        }
    }
} 