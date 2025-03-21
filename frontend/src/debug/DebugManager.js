import * as THREE from 'three';
import { OrbitControls } from './../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from './../../node_modules/three/examples/jsm/controls/TransformControls.js';
import { ObjectRegistry } from '../registries/ObjectRegistry.js';
import { GLTFLoader } from './../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { assetPath } from '../utils/pathHelper.js';

export class DebugManager {
    constructor(scene, camera, renderer, character) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.character = character;
        this.isDebugMode = false;
        this.worldManager = null;
        
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

        // Initialize model loader
        this.modelLoader = new GLTFLoader();

        // Add change tracking
        this.pendingChanges = new Map(); // Map<objectId, {model, index, originalState, currentState}>
        this.changeCount = 0;
        this.deletedObjects = new Set(); // Track deleted objects by their changeId
        
        // Create transform controls
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.scene.add(this.transformControls);
        
        // Add transform controls event listeners
        this.transformControls.addEventListener('dragging-changed', (event) => {
            // Disable orbit controls while dragging
            this.orbitControls.enabled = !event.value;
            
            // When dragging ends, record the change
            if (!event.value && this.transformControls.object) {
                this.recordChange(this.transformControls.object);
            }
        });

        // Listen for changes during transform
        this.transformControls.addEventListener('objectChange', () => {
            if (this.transformControls.object) {
                this.recordChange(this.transformControls.object);
            }
        });
        
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
        
        // Create object catalog
        this.createObjectCatalog();
        
        // Setup event listeners
        this.setupEventListeners();

        // Listen for transform save events
        document.addEventListener('transformSave', this.handleTransformSave.bind(this));
        
        // Track preview models
        this.previewModels = {};
        
        // Preview renderer for catalog items
        this.previewRenderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            antialias: true 
        });
        this.previewRenderer.setSize(130, 80);
        this.previewRenderer.setClearColor(0x000000, 0);
        
        // Base path for model assets
        this.modelBasePath = 'scene/';
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
            <div style="margin-top: 10px;">Transform Controls:</div>
            <div>1: Move Mode</div>
            <div>2: Rotate Mode</div>
            <div>3: Scale Mode</div>
            <div>4: Uniform Scale Mode</div>
            <div>5: Snap Rotate (90°)</div>
            <div>Space: Duplicate Object</div>
            <div>X: Cancel Transform</div>
            <div>L: Delete Selected Object</div>
            <div>K: Save Transform</div>
        `;
        document.body.appendChild(this.debugOverlay);

        // Create transform mode indicator
        this.transformModeIndicator = document.createElement('div');
        this.transformModeIndicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.7);
            color: #00ff00;
            padding: 10px;
            font-family: monospace;
            font-size: 14px;
            border-radius: 5px;
            display: none;
            z-index: 1000;
        `;
        document.body.appendChild(this.transformModeIndicator);

        // Create save feedback overlay
        this.saveFeedback = document.createElement('div');
        this.saveFeedback.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 255, 0, 0.7);
            color: white;
            padding: 15px 20px;
            font-family: monospace;
            font-size: 16px;
            border-radius: 5px;
            display: none;
            z-index: 1000;
            pointer-events: none;
            transition: all 0.3s ease;
        `;
        this.saveFeedback.textContent = 'Changes Saved!';
        document.body.appendChild(this.saveFeedback);
    }

    createObjectCatalog() {
        // Create main catalog container
        this.catalogContainer = document.createElement('div');
        this.catalogContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: -350px;
            width: 350px;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            transition: left 0.3s ease;
            z-index: 1001;
            font-family: 'Arial', sans-serif;
            display: flex;
            flex-direction: column;
        `;
        document.body.appendChild(this.catalogContainer);
        
        // Create catalog header
        const catalogHeader = document.createElement('div');
        catalogHeader.style.cssText = `
            padding: 15px;
            font-size: 18px;
            font-weight: bold;
            background: rgba(50, 50, 50, 0.8);
            border-bottom: 1px solid #555;
        `;
        catalogHeader.textContent = 'Object Catalog';
        this.catalogContainer.appendChild(catalogHeader);
        
        // Create search input
        const searchContainer = document.createElement('div');
        searchContainer.style.cssText = `
            padding: 10px 15px;
            background: rgba(40, 40, 40, 0.8);
        `;
        
        const searchInput = document.createElement('input');
        searchInput.style.cssText = `
            width: 100%;
            padding: 8px;
            border: none;
            border-radius: 4px;
            background: #333;
            color: #fff;
        `;
        searchInput.id = 'catalog-search-input';
        searchInput.placeholder = 'Search objects...';
        searchInput.addEventListener('input', () => {
            this.filterCatalogItems(searchInput.value.toLowerCase());
        });
        
        // Prevent keydown events from bubbling
        searchInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
        });
        
        searchContainer.appendChild(searchInput);
        this.catalogContainer.appendChild(searchContainer);
        
        // Create items container (scrollable)
        this.itemsContainer = document.createElement('div');
        this.itemsContainer.style.cssText = `
            flex: 1;
            overflow-y: auto;
            padding: 10px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            scrollbar-width: none; /* Firefox */
            box-sizing: border-box;
        `;
        // Hide scrollbar for Chrome/Safari/Edge
        this.itemsContainer.innerHTML = '<style>::-webkit-scrollbar { display: none; }</style>';
        this.catalogContainer.appendChild(this.itemsContainer);
        
        // Populate catalog with items
        this.populateCatalog();
        
        // Close button
        const closeButton = document.createElement('button');
        closeButton.style.cssText = `
            position: absolute;
            top: 15px;
            right: 15px;
            width: 30px;
            height: 30px;
            background: none;
            border: none;
            color: #fff;
            font-size: 20px;
            cursor: pointer;
        `;
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => {
            this.toggleCatalog(false);
        });
        this.catalogContainer.appendChild(closeButton);
        
        // Instructions footer
        const instructionsFooter = document.createElement('div');
        instructionsFooter.style.cssText = `
            padding: 15px;
            font-size: 14px;
            background: rgba(50, 50, 50, 0.8);
            border-top: 1px solid #555;
        `;
        instructionsFooter.textContent = 'Click an item to place it in front of the camera';
        this.catalogContainer.appendChild(instructionsFooter);
        
        // Catalog state
        this.isCatalogOpen = false;
    }
    
    populateCatalog() {
        // Clear previous items
        this.itemsContainer.innerHTML = '';
        this.itemsContainer.innerHTML = '<style>::-webkit-scrollbar { display: none; }</style>';
        
        // Add each object from the registry
        ObjectRegistry.items.forEach(item => {
            console.log(`Adding catalog item: ${item.id}`);
            
            const itemElement = document.createElement('div');
            itemElement.classList.add('catalog-item');
            itemElement.dataset.id = item.id;
            itemElement.style.cssText = `
                background: rgba(60, 60, 60, 0.8);
                border-radius: 4px;
                padding: 10px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                transition: background 0.2s;
                margin-bottom: 0;
                width: 100%;
                box-sizing: border-box;
            `;
            
            // Preview container (will be filled with THREE.js preview later)
            const previewContainer = document.createElement('div');
            previewContainer.style.cssText = `
                width: 100%;
                height: 100px;
                background: rgba(30, 30, 30, 0.5);
                margin-bottom: 8px;
                border-radius: 3px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            `;
            
            // Placeholder emoji until we load the preview
            const placeholderText = document.createElement('div');
            placeholderText.style.cssText = `
                color: #aaa;
                font-size: 32px;
                text-align: center;
            `;
            
            // Get category icon
            const category = item.id.split('-')[0];
            let icon = '📦'; // Default box icon
            
            // Assign appropriate emoji based on category
            switch(category) {
                case 'wall': icon = '🧱'; break;
                case 'floor': icon = '⬜'; break;
                case 'column': icon = '🏛️'; break;
                case 'fence': icon = '🚧'; break;
                case 'freezer': icon = '❄️'; break;
                case 'shelf': icon = '📚'; break;
                case 'display': icon = '🛒'; break;
                case 'bottle': icon = '🍾'; break;
                case 'cash': icon = '💰'; break;
                case 'shopping': icon = '🛒'; break;
            }
            
            placeholderText.textContent = icon;
            previewContainer.appendChild(placeholderText);
            
            // Store the preview container reference for later updating
            previewContainer.dataset.previewFor = item.id;
            
            // Item name
            const nameElement = document.createElement('div');
            nameElement.textContent = item.id
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            nameElement.style.cssText = `
                font-size: 12px;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
            `;
            
            itemElement.appendChild(previewContainer);
            itemElement.appendChild(nameElement);
            
            // Add click event for item placement
            itemElement.addEventListener('click', () => {
                this.placeObjectInWorld(item.id);
            });
            
            // Hover effect
            itemElement.addEventListener('mouseenter', () => {
                itemElement.style.background = 'rgba(80, 80, 80, 0.8)';
            });
            
            itemElement.addEventListener('mouseleave', () => {
                itemElement.style.background = 'rgba(60, 60, 60, 0.8)';
            });
            
            this.itemsContainer.appendChild(itemElement);
        });
        
        console.log(`Populated catalog with ${this.itemsContainer.children.length} items`);
    }
    
    toggleCatalog(show = null) {
        // If show is null, toggle the current state
        const shouldShow = show !== null ? show : !this.isCatalogOpen;
        
        this.catalogContainer.style.left = shouldShow ? '0px' : '-350px';
        this.isCatalogOpen = shouldShow;
        
        if (shouldShow && !this.previewsLoaded) {
            this.loadPreviews();
        }
    }
    
    filterCatalogItems(searchTerm) {
        const items = this.itemsContainer.querySelectorAll('.catalog-item');
        
        items.forEach(item => {
            const id = item.dataset.id;
            const name = id.replace(/-/g, ' ');
            
            if (name.toLowerCase().includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }
    
    async loadPreviews() {
        // Set fallback previews first
        const items = this.itemsContainer.querySelectorAll('.catalog-item');
        
        items.forEach(item => {
            const id = item.dataset.id;
            const previewContainer = item.querySelector(`[data-preview-for="${id}"]`);
            
            if (previewContainer) {
                // Clear loading text
                previewContainer.innerHTML = '';
                
                // Create fallback preview with item name and icon
                const previewContent = document.createElement('div');
                previewContent.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: 100%;
                `;
                
                // Get category icon
                const category = id.split('-')[0];
                let icon = '📦'; // Default box icon
                
                // Assign appropriate emoji based on category
                switch(category) {
                    case 'wall': icon = '🧱'; break;
                    case 'floor': icon = '⬜'; break;
                    case 'column': icon = '🏛️'; break;
                    case 'fence': icon = '🚧'; break;
                    case 'freezer': icon = '❄️'; break;
                    case 'shelf': icon = '📚'; break;
                    case 'display': icon = '🛒'; break;
                    case 'bottle': icon = '🍾'; break;
                    case 'cash': icon = '💰'; break;
                    case 'shopping': icon = '🛒'; break;
                }
                
                const iconElement = document.createElement('div');
                iconElement.textContent = icon;
                iconElement.style.fontSize = '32px';
                
                const idElement = document.createElement('div');
                idElement.textContent = id.split('-').map(part => 
                    part.charAt(0).toUpperCase() + part.slice(1)
                ).join(' ');
                idElement.style.cssText = `
                    font-size: 10px;
                    margin-top: 5px;
                    text-align: center;
                `;
                
                previewContent.appendChild(iconElement);
                previewContent.appendChild(idElement);
                previewContainer.appendChild(previewContent);
            }
        });
        
        this.previewsLoaded = true;
        
        // Create canvas once for all previews
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 120;
        const renderer = new THREE.WebGLRenderer({ 
            canvas,
            alpha: true, 
            antialias: true 
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setSize(200, 120);
        
        // Now try to load actual previews from model files
        try {
            // Common lights for all previews
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(5, 10, 7);
            
            // Process each item
            for (const item of ObjectRegistry.items) {
                try {
                    // Get preview container
                    const previewContainer = this.itemsContainer.querySelector(`[data-preview-for="${item.id}"]`);
                    if (!previewContainer) continue;
                    
                    // Use assetPath helper to get the correct path
                    const modelPath = assetPath(this.modelBasePath + item.model);
                    console.log(`Loading preview for ${item.id} from: ${modelPath}`);
                    
                    // Create a new scene for this preview
                    const scene = new THREE.Scene();
                    scene.add(ambientLight.clone());
                    scene.add(directionalLight.clone());
                    
                    // Create a camera for this preview
                    const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 1000);
                    
                    // Load the model
                    this.modelLoader.load(modelPath, (gltf) => {
                        try {
                            const model = gltf.scene.clone();
                            
                            // Get world scale factor if available
                            const scaleFactor = this.worldManager && this.worldManager.scaleFactor ? 
                                this.worldManager.scaleFactor : 1.0;
                            
                            // Apply scale
                            model.scale.multiplyScalar((item.scale || 1.0) * scaleFactor);
                            
                            // Add to scene
                            scene.add(model);
                            
                            // Calculate bounding box to center the model
                            const bbox = new THREE.Box3().setFromObject(model);
                            const center = bbox.getCenter(new THREE.Vector3());
                            const size = bbox.getSize(new THREE.Vector3());
                            const maxDim = Math.max(size.x, size.y, size.z);
                            
                            // Position camera based on bounding box
                            camera.position.set(
                                center.x + maxDim * 1.5, 
                                center.y + maxDim * 0.8, 
                                center.z + maxDim * 1.5
                            );
                            camera.lookAt(center);
                            
                            // Render and create image
                            renderer.render(scene, camera);
                            
                            // Create a new image from canvas
                            const img = document.createElement('img');
                            img.src = canvas.toDataURL('image/png');
                            img.style.cssText = `
                                width: 100%;
                                height: 100%;
                                object-fit: contain;
                            `;
                            
                            // Clear container and add image
                            previewContainer.innerHTML = '';
                            previewContainer.appendChild(img);
                            
                            // Store model for reuse
                            this.previewModels[item.id] = {
                                scene: scene,
                                camera: camera,
                                model: model
                            };
                            
                            console.log(`Preview loaded for ${item.id}`);
                        } catch (error) {
                            console.error(`Error processing model for ${item.id}:`, error);
                        }
                    }, 
                    // Progress callback
                    (xhr) => {
                        // Optional: Add loading progress
                    }, 
                    // Error callback
                    (error) => {
                        console.error(`Error loading preview for ${item.id}:`, error);
                    });
                    
                } catch (error) {
                    console.error(`Error setting up preview for ${item.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error loading previews:', error);
        }
    }
    
    async placeObjectInWorld(objectId) {
        
        try {
            // Get model info from registry
            const itemInfo = ObjectRegistry.items.find(item => item.id === objectId);
            if (!itemInfo) throw new Error(`Item ${objectId} not found in registry`);
            
            // Placement location - in front of camera
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            cameraDirection.applyQuaternion(this.camera.quaternion);
            
            // Place the object 5 units in front of the camera
            const position = new THREE.Vector3().copy(this.camera.position).add(
                cameraDirection.multiplyScalar(5)
            );
            
            // Place on the ground if possible
            position.y = 0;
            
            const rotation = new THREE.Euler(0, 0, 0);
            
            // Get the accurate world scale factor
            const worldScaleFactor = this.getWorldScaleFactor();
            
            // Get base scale from the registry item
            const baseScale = itemInfo.scale || 1.0;
                
            // Apply world scale factor to the object's scale
            const scale = new THREE.Vector3(
                baseScale * worldScaleFactor, 
                baseScale * worldScaleFactor, 
                baseScale * worldScaleFactor
            );
            
            console.log(`Placing object ${objectId} with scale:`, scale);
            console.log(`Base item scale: ${baseScale}, World scale factor: ${worldScaleFactor}, Combined: ${baseScale * worldScaleFactor}`);
            
            // Generate a unique instance index
            const timestamp = Date.now();
            const instanceIndex = timestamp % 1000000;

            // Create the object instance
            const success = await this.worldManager.createObjectInstance(
                objectId,
                instanceIndex,
                position,
                rotation,
                scale
            );
            
            if (success) {
                // Get the created object and attach transform controls
                this.scene.traverse((object) => {
                    if (object.userData.id === objectId && 
                        object.userData.instanceIndex === instanceIndex) {
                        
                        console.log(`Found created object with scale:`, object.scale);
                        
                        this.transformControls.detach();
                        this.transformControls.attach(object);
                        
                        // Record this as a change
                        this.recordChange(object);
                        
                        // Show feedback
                        this.saveFeedback.style.background = 'rgba(0, 255, 0, 0.7)';
                        this.saveFeedback.textContent = `Added ${objectId} - Press K to save`;
                        this.showSaveFeedback();
                    }
                });
            } else {
                throw new Error('Failed to create object instance');
            }
        } catch (error) {
            console.error(`Error placing object ${objectId}:`, error);
            this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
            this.saveFeedback.textContent = `Error: ${error.message}`;
            this.showSaveFeedback();
        }
    }

    setupEventListeners() {
        document.addEventListener('keydown', async (event) => {
            // Skip if we're typing in search
            if (document.activeElement && document.activeElement.id === 'catalog-search-input') {
                return;
            }
            
            // Handle existing movement keys
            if (this.isDebugMode) {
                switch(event.key.toLowerCase()) {
                    case 'w': this.keys.w = true; break;
                    case 'a': this.keys.a = true; break;
                    case 's': this.keys.s = true; break;
                    case 'd': this.keys.d = true; break;
                    case 'q': this.keys.q = true; break;
                    case 'e': this.keys.e = true; break;
                    case 'shift': this.keys.shift = true; break;
                    // Transform mode keys
                    case '1': 
                        this.transformControls.setMode('translate');
                        this.transformControls.showX = true;
                        this.transformControls.showY = true;
                        this.transformControls.showZ = true;
                        this.updateTransformModeIndicator('Move');
                        break;
                    case '2': 
                        this.transformControls.setMode('rotate');
                        this.transformControls.showX = true;
                        this.transformControls.showY = true;
                        this.transformControls.showZ = true;
                        this.updateTransformModeIndicator('Rotate');
                        break;
                    case '3': 
                        this.transformControls.setMode('scale');
                        this.transformControls.showX = true;
                        this.transformControls.showY = true;
                        this.transformControls.showZ = true;
                        this.updateTransformModeIndicator('Scale');
                        break;
                    case '4': 
                        this.transformControls.setMode('scale');
                        // For uniform scaling, show only Y axis for simpler scaling
                        this.transformControls.showX = false;
                        this.transformControls.showY = true;
                        this.transformControls.showZ = false;
                        this.updateTransformModeIndicator('Uniform Scale');
                        
                        // Add a change listener for uniform scaling
                        const object = this.transformControls.object;
                        if (object) {
                            const onObjectChange = () => {
                                // Use Y axis scale as the uniform scale factor
                                const scale = object.scale.y;
                                // Apply uniform scale to all axes
                                object.scale.set(scale, scale, scale);
                            };
                            
                            // Remove previous event listener first
                            this.transformControls.removeEventListener('objectChange', onObjectChange);
                            this.transformControls.addEventListener('objectChange', onObjectChange);
                            
                            // Remove the listener when switching modes
                            const clearListener = (event) => {
                                if (event.key >= '1' && event.key <= '5' && event.key !== '4') {
                                    this.transformControls.removeEventListener('objectChange', onObjectChange);
                                    document.removeEventListener('keydown', clearListener);
                                }
                            };
                            document.addEventListener('keydown', clearListener);
                        }
                        break;
                    case '5': 
                        this.transformControls.setMode('rotate');
                        this.transformControls.showX = false;
                        this.transformControls.showY = true;
                        this.transformControls.showZ = false;
                        this.updateTransformModeIndicator('Snap Rotate (90°)');
                        
                        // Add a change listener for snap rotation
                        const rotObject = this.transformControls.object;
                        if (rotObject) {
                            const onSnapRotate = () => {
                                // Get current Y rotation
                                const currentY = rotObject.rotation.y;
                                // Snap to nearest 90 degrees (π/2 radians)
                                const snapAngle = Math.PI / 2;
                                const snappedY = Math.round(currentY / snapAngle) * snapAngle;
                                // Apply snapped rotation
                                rotObject.rotation.y = snappedY;
                            };
                            
                            // Remove previous event listener first
                            this.transformControls.removeEventListener('objectChange', onSnapRotate);
                            this.transformControls.addEventListener('objectChange', onSnapRotate);
                            
                            // Remove the listener when switching modes
                            const clearSnapListener = (event) => {
                                if (event.key >= '1' && event.key <= '5' && event.key !== '5') {
                                    this.transformControls.removeEventListener('objectChange', onSnapRotate);
                                    document.removeEventListener('keydown', clearSnapListener);
                                }
                            };
                            document.addEventListener('keydown', clearSnapListener);
                        }
                        break;
                    case 'k': 
                        console.log('K pressed, saving all changes...');
                        await this.saveAllChanges();
                        break;
                    case 'delete':
                        if (this.transformControls.object) {
                            this.deleteSelectedObject();
                        }
                        break;
                    case 'n':
                        this.toggleCatalog();
                        break;
                    case ' ': // Space key
                        if (this.transformControls.object) {
                            this.duplicateSelectedObject();
                        }
                        break;
                }
            }

            // Toggle debug mode with Shift+D
            if (event.shiftKey && event.key.toLowerCase() === 'd') {
                this.toggleDebugMode();
            }
        });

        document.addEventListener('keyup', (event) => {
            // Skip if we're typing in search
            if (document.activeElement && document.activeElement.id === 'catalog-search-input') {
                return;
            }
            
            if (this.isDebugMode) {
                switch(event.key.toLowerCase()) {
                    case 'w': this.keys.w = false; break;
                    case 'a': this.keys.a = false; break;
                    case 's': this.keys.s = false; break;
                    case 'd': this.keys.d = false; break;
                    case 'q': this.keys.q = false; break;
                    case 'e': this.keys.e = false; break;
                    case 'shift': this.keys.shift = false; break;
                }
            }
        });

        // Add click handler for object selection
        this.renderer.domElement.addEventListener('click', (event) => {
            if (this.isDebugMode && !this.transformControls.isDragging) {
                this.handleObjectSelection(event);
            }
        });
    }

    handleObjectSelection(event) {
        const mouse = new THREE.Vector2();
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // Get all objects in the scene that can be selected
        const objects = [];
        this.scene.traverse((object) => {
            // Only add meshes that aren't part of the transform controls
            if (object.isMesh && !object.parent?.isTransformControls) {
                objects.push(object);
            }
        });

        const intersects = raycaster.intersectObjects(objects, false);
        
        if (intersects.length > 0) {
            // Find the root object (the parent that represents the full model)
            let selectedObject = intersects[0].object;
            while (selectedObject.parent && selectedObject.parent !== this.scene) {
                selectedObject = selectedObject.parent;
            }
            
            // Prevent selecting the transform controls itself
            if (!selectedObject.isTransformControls) {
                this.transformControls.detach(); // Detach first to prevent any potential issues
                this.transformControls.attach(selectedObject);
            }
        } else {
            this.transformControls.detach();
        }
    }

    updateTransformModeIndicator(mode) {
        this.transformModeIndicator.textContent = `Transform Mode: ${mode}`;
    }

    showSaveFeedback() {
        this.saveFeedback.style.display = 'block';
        this.saveFeedback.style.opacity = '1';
        setTimeout(() => {
            this.saveFeedback.style.opacity = '0';
            setTimeout(() => {
                this.saveFeedback.style.display = 'none';
            }, 300); // Wait for fade out animation
        }, 1500);
    }

    async handleTransformSave(event) {
        if (this.worldManager && event.detail.object) {
            const object = event.detail.object;
            const objectId = object.userData.id;
            const index = object.userData.instanceIndex;

            if (objectId !== undefined && index !== undefined) {
                try {
                    const success = await this.worldManager.updateObjectInstance(
                        objectId,
                        index,
                        object.position,
                        object.rotation,
                        object.scale
                    );
                    
                    if (success) {
                        this.saveFeedback.style.background = 'rgba(0, 255, 0, 0.7)';
                        this.saveFeedback.textContent = 'Changes Saved!';
                        this.showSaveFeedback();
                        console.log('Saved transform changes for', objectId, 'instance', index);
                    } else {
                        // Show error feedback
                        this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
                        this.saveFeedback.textContent = 'Failed to Save Changes';
                        this.showSaveFeedback();
                    }
                } catch (error) {
                    console.error('Error saving transform:', error);
                    // Show error feedback
                    this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
                    this.saveFeedback.textContent = 'Error Saving Changes';
                    this.showSaveFeedback();
                }
            }
        }
    }
    
    setWorldManager(worldManager) {
        this.worldManager = worldManager;
        
        // Ensure the worldManager has all required methods for editor functionality
        this.initializeWorldManagerMethods();
    }
    
    initializeWorldManagerMethods() {
        if (!this.worldManager) return;
        
        // If createObjectInstance doesn't exist, create it
        if (typeof this.worldManager.createObjectInstance !== 'function') {
            console.log('Creating createObjectInstance method');
            
            // Ensure world manager has model loader
            if (!this.worldManager.modelLoader) {
                console.log('Setting modelLoader on worldManager');
                this.worldManager.modelLoader = this.modelLoader;
            }
            
            // Store basePath if not set
            if (!this.worldManager.modelBasePath) {
                console.log('Setting modelBasePath on worldManager');
                this.worldManager.modelBasePath = this.modelBasePath;
            }
            
            // Backup the worldManager for debugging
            if (this.worldManager.worldData && this.worldManager.worldData.settings) {
                console.log('World data settings available:', this.worldManager.worldData.settings);
            }
            
            // Create a new method on worldManager for creating object instances
            this.worldManager.createObjectInstance = async (objectId, instanceIndex, position, rotation, scale) => {
                try {
                    console.log(`Creating object ${objectId} at index ${instanceIndex}`);
                    console.log(`Position:`, position);
                    console.log(`Rotation:`, rotation);
                    console.log(`Scale:`, scale);
                    
                    // Find the model path based on objectId
                    const modelInfo = ObjectRegistry.items.find(item => item.id === objectId);
                    if (!modelInfo) {
                        console.error(`Model ${objectId} not found in registry`);
                        return false;
                    }
                    
                    // Get the full path to the model using assetPath helper
                    const modelPath = assetPath(this.modelBasePath + modelInfo.model);
                    console.log(`Loading model from: ${modelPath}`);
                    
                    return new Promise((resolve, reject) => {
                        this.modelLoader.load(
                            modelPath,
                            (gltf) => {
                                const model = gltf.scene.clone();
                                
                                // Log original model scale before changes
                                console.log(`Original model scale:`, model.scale.clone());
                                
                                // Apply position, rotation, and scale
                                model.position.copy(position);
                                model.rotation.copy(rotation);
                                
                                // Get the base scale for this object type from registry
                                const baseScale = modelInfo && modelInfo.scale ? modelInfo.scale : 1.0;
                                
                                // Apply scale, ensuring we account for the baseScale and worldScaleFactor
                                if (scale) {
                                    // If scale is provided directly (e.g. from duplication)
                                    model.scale.copy(scale);
                                } else {
                                    // If creating from scratch, apply all scaling factors
                                    const worldScaleFactor = this.getWorldScaleFactor();
                                    model.scale.set(
                                        baseScale * worldScaleFactor,
                                        baseScale * worldScaleFactor,
                                        baseScale * worldScaleFactor
                                    );
                                }
                                
                                // Log final model scale after changes
                                console.log(`Final model scale:`, model.scale);
                                
                                // Add metadata for identification
                                model.userData.id = objectId;
                                model.userData.instanceIndex = instanceIndex;
                                model.userData.model = modelInfo.model;
                                
                                // Add to scene
                                this.scene.add(model);
                                
                                resolve(true);
                            },
                            // Progress callback
                            (xhr) => {
                                console.log(`${objectId} loading: ${Math.round(xhr.loaded / xhr.total * 100)}%`);
                            },
                            (error) => {
                                console.error(`Error loading model ${objectId}: ${error.message}`);
                                reject(error);
                            }
                        );
                    });
                } catch (error) {
                    console.error(`Error creating object instance: ${error.message}`);
                    return false;
                }
            };
        }
        
        // Add delete method if it doesn't exist
        if (typeof this.worldManager.deleteObjectInstance !== 'function') {
            this.worldManager.deleteObjectInstance = async (objectId, instanceIndex) => {
                try {
                    // Find the object in the scene
                    let objectToRemove = null;
                    this.scene.traverse(object => {
                        if (object.userData.id === objectId && 
                            object.userData.instanceIndex === parseInt(instanceIndex)) {
                            objectToRemove = object;
                        }
                    });
                    
                    if (objectToRemove) {
                        this.scene.remove(objectToRemove);
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error(`Error deleting object: ${error.message}`);
                    return false;
                }
            };
        }
        
        // Add update method if it doesn't exist
        if (typeof this.worldManager.updateObjectInstance !== 'function') {
            this.worldManager.updateObjectInstance = async (objectId, instanceIndex, position, rotation, scale) => {
                try {
                    // Find the object in the scene
                    let objectToUpdate = null;
                    this.scene.traverse(object => {
                        if (object.userData.id === objectId && 
                            object.userData.instanceIndex === parseInt(instanceIndex)) {
                            objectToUpdate = object;
                        }
                    });
                    
                    if (objectToUpdate) {
                        console.log(`Updating object ${objectId} instance ${instanceIndex}`);
                        console.log(`New scale:`, scale);
                        
                        objectToUpdate.position.copy(position);
                        objectToUpdate.rotation.copy(rotation);
                        // Explicitly set scale values
                        objectToUpdate.scale.set(scale.x, scale.y, scale.z);
                        return true;
                    }
                    return false;
                } catch (error) {
                    console.error(`Error updating object: ${error.message}`);
                    return false;
                }
            };
        }
        
        // Helper method to get model path
        if (typeof this.worldManager.getModelPathForItem !== 'function') {
            this.worldManager.getModelPathForItem = (objectId) => {
                const modelInfo = ObjectRegistry.items.find(item => item.id === objectId);
                if (!modelInfo) return null;
                return assetPath(this.modelBasePath + modelInfo.model);
            };
        }
    }

    toggleDebugMode() {
        if (this.isDebugMode && (this.pendingChanges.size > 0 || this.deletedObjects.size > 0)) {
            const shouldExit = confirm('You have unsaved changes. Exit debug mode anyway?');
            if (!shouldExit) {
                return;
            }
            // Restore visibility of deleted objects
            this.deletedObjects.forEach(changeId => {
                const [objectId, instanceIndex] = changeId.split('-');
                const object = this.scene.getObjectByProperty('userData', { 
                    id: objectId, 
                    instanceIndex: parseInt(instanceIndex) 
                });
                if (object) {
                    object.visible = true;
                }
            });
            this.pendingChanges.clear();
            this.deletedObjects.clear();
            this.changeCount = 0;
        }
        
        this.isDebugMode = !this.isDebugMode;
        
        if (this.isDebugMode) {
            // Make sure all required worldManager methods are available
            this.initializeWorldManagerMethods();
            
            // Store current camera state
            this.originalCameraPosition.copy(this.camera.position);
            this.originalCameraRotation.copy(this.camera.rotation);
            
            // Enable orbit controls
            this.orbitControls.enabled = true;
            
            // Disable character controls
            if (this.character) {
                this.character.enabled = false;
                this.character.controls.unlock();
            }

            // Show debug UI
            this.debugOverlay.style.display = 'block';
            this.transformModeIndicator.style.display = 'block';
            this.updateTransformModeIndicator('Move');
            
            // Add info about catalog to the debug overlay
            const catalogInfo = document.createElement('div');
            catalogInfo.textContent = 'Press N: Open Object Catalog';
            this.debugOverlay.appendChild(catalogInfo);
        } else {
            // Restore camera state
            this.camera.position.copy(this.originalCameraPosition);
            this.camera.rotation.copy(this.originalCameraRotation);
            
            // Disable orbit controls
            this.orbitControls.enabled = false;
            
            // Enable character controls
            if (this.character) {
                this.character.enabled = true;
            }

            // Hide debug UI
            this.debugOverlay.style.display = 'none';
            this.transformModeIndicator.style.display = 'none';
            
            // Close catalog if open
            this.toggleCatalog(false);

            // Clear transform selection
            this.transformControls.detach();
        }

        // Toggle hitbox visibility
        if (this.worldManager) {
            this.worldManager.toggleHitboxes(this.isDebugMode);
        }
    }

    update() {
        if (!this.isDebugMode) return;

        // Update orbit controls
        this.orbitControls.update();

        // Only handle movement if we're not dragging an object
        if (!this.transformControls.dragging) {
            // Handle keyboard movement
            const moveSpeed = this.keys.shift ? this.moveSpeed * 2 : this.moveSpeed;
            
            if (this.keys.w) this.camera.position.z -= moveSpeed;
            if (this.keys.s) this.camera.position.z += moveSpeed;
            if (this.keys.a) this.camera.position.x -= moveSpeed;
            if (this.keys.d) this.camera.position.x += moveSpeed;
            if (this.keys.q) this.camera.position.y -= moveSpeed;
            if (this.keys.e) this.camera.position.y += moveSpeed;
        }
    }

    dispose() {
        // Remove event listeners and clean up
        this.transformControls.dispose();
        this.orbitControls.dispose();
        document.body.removeChild(this.debugOverlay);
        document.body.removeChild(this.transformModeIndicator);
        document.body.removeChild(this.saveFeedback);
        document.body.removeChild(this.catalogContainer);
    }

    recordChange(object) {
        const objectId = object.userData.id;
        const instanceIndex = object.userData.instanceIndex;
        
        if (objectId === undefined || instanceIndex === undefined) {
            return;
        }

        const changeId = `${objectId}-${instanceIndex}`;
        
        if (!this.pendingChanges.has(changeId)) {
            // Store the original state when first modifying an object
            this.pendingChanges.set(changeId, {
                id: objectId,
                index: instanceIndex,
                originalState: {
                    position: object.position.clone(),
                    rotation: object.rotation.clone(),
                    scale: object.scale.clone()
                },
                currentState: {
                    position: object.position.clone(),
                    rotation: object.rotation.clone(),
                    scale: object.scale.clone()
                }
            });
        } else {
            // Update current state
            const change = this.pendingChanges.get(changeId);
            change.currentState.position.copy(object.position);
            change.currentState.rotation.copy(object.rotation);
            change.currentState.scale.copy(object.scale);
        }

        this.changeCount = this.pendingChanges.size;
        this.updateChangeIndicator();
    }

    updateChangeIndicator() {
        if (this.changeCount > 0) {
            this.saveFeedback.style.background = 'rgba(255, 165, 0, 0.7)';
            this.saveFeedback.textContent = `${this.changeCount} Unsaved Changes - Press K to Save`;
            this.saveFeedback.style.display = 'block';
            this.saveFeedback.style.opacity = '1';
        } else {
            this.saveFeedback.style.opacity = '0';
            setTimeout(() => {
                this.saveFeedback.style.display = 'none';
            }, 300);
        }
    }

    async saveAllChanges() {
        const totalChanges = this.pendingChanges.size + this.deletedObjects.size;
        
        if (totalChanges === 0) {
            this.saveFeedback.style.background = 'rgba(255, 165, 0, 0.7)';
            this.saveFeedback.textContent = 'No Changes to Save';
            this.showSaveFeedback();
            return;
        }

        let successCount = 0;
        let failCount = 0;

        // Save transform changes
        for (const [changeId, change] of this.pendingChanges) {
            // Skip if object is marked for deletion
            if (this.deletedObjects.has(changeId)) continue;

            try {
                const success = await this.worldManager.updateObjectInstance(
                    change.id,
                    change.index,
                    change.currentState.position,
                    change.currentState.rotation,
                    change.currentState.scale
                );
                
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`Failed to save changes for ${changeId}:`, error);
                failCount++;
            }
        }

        // Process deletions
        for (const changeId of this.deletedObjects) {
            // Split at the last hyphen to handle IDs with hyphens
            const lastHyphenIndex = changeId.lastIndexOf('-');
            if (lastHyphenIndex === -1) {
                console.error(`Invalid changeId format (no hyphen): ${changeId}`);
                failCount++;
                continue;
            }
            
            const objectId = changeId.substring(0, lastHyphenIndex);
            const instanceIndexStr = changeId.substring(lastHyphenIndex + 1);
            const instanceIndex = parseInt(instanceIndexStr);
            
            // Skip if we couldn't parse a valid instance index
            if (isNaN(instanceIndex)) {
                console.error(`Invalid instance index in changeId: ${changeId}`);
                failCount++;
                continue;
            }
            
            try {
                const success = await this.worldManager.deleteObjectInstance(
                    objectId,
                    instanceIndex
                );
                
                if (success) {
                    successCount++;
                    // Remove the object from the scene
                    const object = this.scene.getObjectByProperty('userData', { 
                        id: objectId, 
                        instanceIndex: instanceIndex 
                    });
                    if (object) {
                        this.scene.remove(object);
                    }
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`Failed to delete object ${changeId}:`, error);
                failCount++;
            }
        }

        // Clear pending changes
        this.pendingChanges.clear();
        this.deletedObjects.clear();
        this.changeCount = 0;

        // Show appropriate feedback
        if (failCount === 0) {
            this.saveFeedback.style.background = 'rgba(0, 255, 0, 0.7)';
            this.saveFeedback.textContent = `Saved ${successCount} Changes Successfully`;
        } else if (successCount === 0) {
            this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
            this.saveFeedback.textContent = `Failed to Save ${failCount} Changes`;
        } else {
            this.saveFeedback.style.background = 'rgba(255, 165, 0, 0.7)';
            this.saveFeedback.textContent = `Saved ${successCount}, Failed ${failCount}`;
        }
        
        this.showSaveFeedback();
        setTimeout(() => this.updateChangeIndicator(), 1500);
    }

    deleteSelectedObject() {
        const object = this.transformControls.object;
        const objectId = object.userData.id;
        const instanceIndex = object.userData.instanceIndex;
        
        if (objectId === undefined || instanceIndex === undefined || isNaN(instanceIndex)) {
            console.error('Cannot delete object with invalid ID or instance index', {
                objectId,
                instanceIndex
            });
            return;
        }

        // Ensure consistent changeId format
        const changeId = `${objectId}-${instanceIndex}`;
        console.log(`Marking object for deletion: ${changeId}`);
        
        // Add to deleted objects set
        this.deletedObjects.add(changeId);
        
        // Hide the object but don't remove it yet (will be removed on save)
        object.visible = false;
        
        // Detach transform controls
        this.transformControls.detach();
        
        // Update change count and indicator
        this.changeCount = this.pendingChanges.size + this.deletedObjects.size;
        this.updateChangeIndicator();
        
        // Show deletion feedback
        this.saveFeedback.style.background = 'rgba(255, 165, 0, 0.7)';
        this.saveFeedback.textContent = 'Object marked for deletion - Press K to save';
        this.showSaveFeedback();
    }

    // Add a method to ensure we get the correct scale factor
    getWorldScaleFactor() {
        return this.worldManager.scaleFactor;
    }

    duplicateSelectedObject() {
        // Get the currently selected object
        const originalObject = this.transformControls.object;
        if (!originalObject) return;
        
        // Ensure the worldManager has required methods
        this.initializeWorldManagerMethods();
        
        const objectId = originalObject.userData.id;
        const instanceIndex = originalObject.userData.instanceIndex;
        
        if (objectId === undefined || instanceIndex === undefined) {
            console.error('Cannot duplicate object with invalid ID or instance index');
            return;
        }
        
        try {
            // Generate a new instance index based on timestamp
            const newInstanceIndex = Date.now() % 1000000;
            
            // Create a duplicate with a slight offset
            const positionOffset = 1; // 1 unit offset
            const newPosition = originalObject.position.clone();
            newPosition.x += positionOffset;
            
            // Use the original rotation and scale
            const rotation = originalObject.rotation.clone();
            const scale = originalObject.scale.clone();
            
            console.log(`Duplicating ${objectId} from instance ${instanceIndex} to ${newInstanceIndex}`);
            console.log(`Original position: ${originalObject.position.x}, ${originalObject.position.y}, ${originalObject.position.z}`);
            console.log(`New position: ${newPosition.x}, ${newPosition.y}, ${newPosition.z}`);
            console.log(`Original scale being copied: ${scale.x}, ${scale.y}, ${scale.z}`);
            
            // Create a new instance using the worldManager
            this.worldManager.createObjectInstance(
                objectId, 
                newInstanceIndex, 
                newPosition, 
                rotation, 
                scale
            ).then(success => {
                if (success) {
                    // Find and select the newly created object
                    this.scene.traverse((object) => {
                        if (object.userData.id === objectId && 
                            object.userData.instanceIndex === newInstanceIndex) {
                            
                            // Select the new object
                            this.transformControls.detach();
                            this.transformControls.attach(object);
                            
                            // Record this as a change
                            this.recordChange(object);
                            
                            // Show feedback
                            this.saveFeedback.style.background = 'rgba(0, 255, 0, 0.7)';
                            this.saveFeedback.textContent = `Duplicated ${objectId} - Press K to save`;
                            this.showSaveFeedback();
                        }
                    });
                } else {
                    throw new Error('Failed to create duplicate object');
                }
            }).catch(error => {
                console.error('Error duplicating object:', error);
                this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
                this.saveFeedback.textContent = `Error: ${error.message}`;
                this.showSaveFeedback();
            });
            
        } catch (error) {
            console.error(`Error duplicating object ${objectId}:`, error);
            this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
            this.saveFeedback.textContent = `Error: ${error.message}`;
            this.showSaveFeedback();
        }
    }
} 