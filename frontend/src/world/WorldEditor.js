import * as THREE from 'three';
import { OrbitControls } from './../../node_modules/three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from './../../node_modules/three/examples/jsm/controls/TransformControls.js';
import { ObjectRegistry } from '../registries/ObjectRegistry.js';
import { SpawnerRegistry } from '../registries/SpawnerRegistry.js';
import { GLTFLoader } from './../../node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import worldManagerService from '../services/WorldManagerService.js';

export class WorldEditor {
    constructor(scene, camera, renderer, character) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.character = character;
        
        this.objectsContainer = document.getElementById('debug-objects-container');
        this.categorySelect = document.getElementById('debug-category-filter');
        this.objectSelect = document.getElementById('debug-object-select');
        this.debugCatalog = document.getElementById('debug-catalog');
        this.objectFilter = document.getElementById('debug-filter');
        this.transformControlsMode = document.getElementById('transform-controls-mode');
        this.catalogScrollArea = document.getElementById('catalog-scroll-area');
        this.debugModeIndicator = document.getElementById('debug-mode-indicator');
        this.saveFeedback = document.getElementById('save-feedback');
        
        this.debugMode = false;
        this.objectCategories = {};
        this.objectCatalogItems = {};
        this.loadedPreviews = {};
        this.pendingChanges = new Map();
        this.largeIndexMapping = new Map(); // Map to track large timestamp indices to actual instance indices
        this.changeCount = 0;
        
        this.transformControls = new TransformControls(camera, renderer.domElement);
        this.scene.add(this.transformControls);
        
        this.selectedObject = null;
        this.worldManager = null;
        this.spawnerVisuals = new Map();
        
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
        
        // Add section title for objects
        const objectsTitle = document.createElement('div');
        objectsTitle.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            padding: 5px;
            margin: 10px 0 5px 0;
            border-bottom: 1px solid #555;
        `;
        objectsTitle.textContent = 'Objects';
        this.itemsContainer.appendChild(objectsTitle);
        
        // Add each object from the registry
        ObjectRegistry.items.forEach(item => {
            
            const itemElement = document.createElement('div');
            itemElement.classList.add('catalog-item');
            itemElement.dataset.id = item.id;
            itemElement.dataset.type = 'object';
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
        
        // Add section title for spawners
        const spawnersTitle = document.createElement('div');
        spawnersTitle.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            padding: 5px;
            margin: 15px 0 5px 0;
            border-bottom: 1px solid #555;
        `;
        spawnersTitle.textContent = 'Spawners';
        this.itemsContainer.appendChild(spawnersTitle);
        
        // Add each spawner from the registry
        SpawnerRegistry.items.forEach(item => {
            
            const itemElement = document.createElement('div');
            itemElement.classList.add('catalog-item');
            itemElement.dataset.id = item.id;
            itemElement.dataset.type = 'spawner';
            itemElement.style.cssText = `
                background: rgba(60, 60, 60, 0.8);
                border-radius: 4px;
                padding: 10px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                transition: background 0.2s;
                margin-bottom: 8px;
                width: 100%;
                box-sizing: border-box;
            `;
            
            // Preview container for spawner
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
                position: relative;
            `;
            
            // Spawner icon
            const placeholderText = document.createElement('div');
            placeholderText.style.cssText = `
                color: #aaa;
                font-size: 32px;
                text-align: center;
            `;
            placeholderText.textContent = '✨'; // Sparkles for spawner
            
            // Add cooldown info
            const cooldownInfo = document.createElement('div');
            cooldownInfo.style.cssText = `
                color: #aaa;
                font-size: 12px;
                text-align: center;
                position: absolute;
                bottom: 5px;
                width: 100%;
            `;
            cooldownInfo.textContent = `Cooldown: ${item.cooldown/1000}s`;
            
            previewContainer.appendChild(placeholderText);
            previewContainer.appendChild(cooldownInfo);
            
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
            
            // Item description (what it spawns)
            const descElement = document.createElement('div');
            descElement.textContent = `Spawns: ${item.items.map(i => i.split('-')[0]).join(', ')}`;
            descElement.style.cssText = `
                font-size: 10px;
                color: #aaa;
                text-align: center;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                margin-top: 2px;
            `;
            
            itemElement.appendChild(previewContainer);
            itemElement.appendChild(nameElement);
            itemElement.appendChild(descElement);
            
            // Add click event for spawner placement
            itemElement.addEventListener('click', () => {
                this.placeSpawnerInWorld(item.id);
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
                    const modelPath = ObjectRegistry.getModelPath(item.id);
                    
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
            
            // Get the current world data to determine next available instance index
            let instanceIndex;
            try {
                const worldData = await worldManagerService.getWorldData();
                const objectData = worldData.objects.find(obj => obj.id === objectId);
                
                if (objectData && objectData.instances) {
                    // Find the next available index by looking for gaps or using the next number
                    let maxIndex = -1;
                    const usedIndices = new Set();
                    
                    objectData.instances.forEach((instance, idx) => {
                        if (instance !== null) {
                            usedIndices.add(idx);
                            maxIndex = Math.max(maxIndex, idx);
                        }
                    });
                    
                    // Look for the first unused index
                    for (let i = 0; i <= maxIndex + 1; i++) {
                        if (!usedIndices.has(i)) {
                            instanceIndex = i;
                            break;
                        }
                    }
                    
                    console.log(`Using next available index ${instanceIndex} for ${objectId}`);
                } else {
                    // If object doesn't exist yet, start with index 0
                    instanceIndex = 0;
                    console.log(`Object ${objectId} not found, using index 0`);
                }
            } catch (error) {
                // Fallback to simple incrementing index if we can't get world data
                console.warn("Couldn't determine next instance index, using fallback:", error);
                instanceIndex = 0;
            }

            console.log(`Creating new instance of ${objectId} with index ${instanceIndex}`);

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
                        
                        console.log(`Found created object, attaching transform controls:`, object);
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
            
            // Log what was hit for debugging
            console.log('Selected object in raycaster:', selectedObject);
            
            // Find the parent object with userData.id and userData.instanceIndex
            while (selectedObject && selectedObject !== this.scene) {
                if (selectedObject.userData && 
                    selectedObject.userData.id !== undefined && 
                    selectedObject.userData.instanceIndex !== undefined) {
                    break; // Found an identifiable parent
                }
                if (selectedObject.parent) {
                    selectedObject = selectedObject.parent;
                } else {
                    break;
                }
            }
            
            // If we couldn't find a proper parent with ID and instance index,
            // try to find it by traversing up from the hit object's parents and siblings
            if (!selectedObject.userData || 
                selectedObject.userData.id === undefined || 
                selectedObject.userData.instanceIndex === undefined) {
                
                console.warn('Selected object does not have required userData properties, trying to find parent...');
                
                // Start from the original hit and walk up the tree
                let parent = intersects[0].object;
                while (parent && parent !== this.scene) {
                    // Check siblings
                    if (parent.parent) {
                        for (const sibling of parent.parent.children) {
                            if (sibling.userData && 
                                sibling.userData.id !== undefined && 
                                sibling.userData.instanceIndex !== undefined) {
                                selectedObject = sibling;
                                console.log('Found sibling with valid data:', selectedObject);
                                break;
                            }
                        }
                    }
                    
                    // Move up to parent
                    if (parent.parent) {
                        parent = parent.parent;
                    } else {
                        break;
                    }
                }
            }
            
            // Log the final selected object
            console.log('Final selected object:', selectedObject, 'userData:', selectedObject.userData);
            
            // Prevent selecting the transform controls itself
            if (!selectedObject.isTransformControls && 
                selectedObject.userData && 
                selectedObject.userData.id !== undefined &&
                selectedObject.userData.instanceIndex !== undefined) {
                this.transformControls.detach(); // Detach first to prevent any potential issues
                this.transformControls.attach(selectedObject);
            } else {
                console.warn('Could not select a valid object');
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
                    const modelPath = ObjectRegistry.getModelPath(objectId);
                    console.log(`Loading model from: ${modelPath}`);
                    
                    // First, update the worldData to include this new instance
                    // This ensures it gets saved later
                    try {
                        // Get world data and ensure object exists
                        if (!this.worldManager.worldData) {
                            await this.worldManager.loadWorld();
                        }
                        
                        let worldData = this.worldManager.worldData;
                        let objectData = worldData.objects.find(obj => obj.id === objectId);
                        
                        if (!objectData) {
                            console.log(`Creating new object entry for ${objectId} in world data`);
                            objectData = {
                                id: objectId,
                                instances: []
                            };
                            worldData.objects.push(objectData);
                        }
                        
                        // Ensure instances array exists
                        if (!objectData.instances) {
                            objectData.instances = [];
                        }
                        
                        // Calculate normalized scale (divided by world scale factor)
                        const worldScaleFactor = this.worldManager.scaleFactor || 1;
                        const normalizedScale = {
                            x: scale.x / worldScaleFactor,
                            y: scale.y / worldScaleFactor,
                            z: scale.z / worldScaleFactor
                        };
                        
                        // Make sure array is big enough
                        while (objectData.instances.length <= instanceIndex) {
                            objectData.instances.push(null);
                        }
                        
                        // Create new instance data
                        objectData.instances[instanceIndex] = {
                            x: position.x,
                            y: position.y,
                            z: position.z,
                            rotationX: rotation.x,
                            rotationY: rotation.y,
                            rotationZ: rotation.z,
                            scaleX: normalizedScale.x,
                            scaleY: normalizedScale.y,
                            scaleZ: normalizedScale.z
                        };
                        
                        console.log(`Added instance to world data at index ${instanceIndex}`);
                    } catch (error) {
                        console.error('Error updating world data:', error);
                        // Continue anyway to create the visual object
                    }
                    
                    return new Promise((resolve, reject) => {
                        this.modelLoader.load(
                            modelPath,
                            (gltf) => {
                                const model = gltf.scene.clone();
                                
                                // Apply position, rotation, and scale
                                model.position.copy(position);
                                model.rotation.copy(rotation);
                                model.scale.copy(scale);
                                
                                // Store metadata for later reference
                                model.userData.id = objectId;
                                model.userData.instanceIndex = instanceIndex;
                                model.userData.type = 'object';
                                
                                // Add to scene
                                this.scene.add(model);
                                console.log(`Added object to scene with ID ${objectId} and instance ${instanceIndex}`);
                                
                                resolve(true);
                            },
                            (progress) => {
                                // Loading progress
                                console.log(`Loading ${objectId}: ${Math.round(progress.loaded / progress.total * 100)}%`);
                            },
                            (error) => {
                                console.error(`Error loading model ${objectId}:`, error);
                                reject(error);
                            }
                        );
                    });
                } catch (error) {
                    console.error(`Error creating object instance:`, error);
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
            
            // Create visual indicators for existing spawners
            this.createSpawnerVisuals();
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
            
            // Remove spawner visual indicators
            this.removeSpawnerVisuals();
        }

        // Toggle hitbox visibility
        if (this.worldManager) {
            this.worldManager.toggleHitboxes(this.isDebugMode);
        }
    }

    // New method to create visual indicators for existing spawners
    createSpawnerVisuals() {
        // Check if worldManagerService is available and has loaded spawners
        if (!worldManagerService || !worldManagerService.loadedSpawners) {
            console.log('No spawners available to visualize');
            return;
        }
        
        console.log(`Creating visual indicators for ${worldManagerService.loadedSpawners.length} spawners`);
        
        // Remove any existing visualizers first
        this.removeSpawnerVisuals();
        
        // For each spawner in the world, create a visual indicator
        worldManagerService.loadedSpawners.forEach(spawner => {
            try {
                if (!spawner || !spawner.position) {
                    console.warn('Invalid spawner found, skipping visualization');
                    return;
                }
                
                // Get spawner info from registry
                let spawnerInfo = SpawnerRegistry.items.find(item => item.id === spawner.id);
                if (!spawnerInfo) {
                    console.warn(`Spawner type ${spawner.id} not found in registry, using default`);
                    // Create a default dummy info if not found
                    spawnerInfo = {
                        id: spawner.id || 'unknown-spawner',
                        cooldown: spawner.cooldown || 5000,
                        items: spawner.itemIds || []
                    };
                }
                
                // Create visual representation
                const visual = this.createSpawnerVisual(spawnerInfo);
                
                // Position at the spawner's location
                visual.position.copy(spawner.position);
                
                // Add metadata for identification
                visual.userData.type = 'spawner';
                visual.userData.id = spawner.id;
                visual.userData.instanceIndex = spawner.instanceIndex;
                visual.userData.cooldown = spawner.cooldown;
                visual.userData.items = spawner.itemIds || spawnerInfo.items;
                visual.userData.isExistingSpawner = true;
                visual.userData.spawnerReference = spawner;
                
                // Add a special name to find these visuals later
                visual.name = 'spawner-visual-' + spawner.id + '-' + spawner.instanceIndex;
                
                // Add to scene
                this.scene.add(visual);
                
                // If the spawner has a current spawnable, hide it
                if (spawner.currentSpawnable && spawner.currentSpawnable.model) {
                    spawner.currentSpawnable.model.visible = false;
                }
                
                console.log(`Created visual for spawner ${spawner.id} at`, spawner.position);
            } catch (error) {
                console.error(`Error creating visual for spawner:`, error);
            }
        });
    }

    // New method to remove spawner visual indicators
    removeSpawnerVisuals() {
        // Find all objects with the spawner-visual name prefix
        const visualsToRemove = [];
        
        this.scene.traverse(object => {
            if (object.name && object.name.startsWith('spawner-visual-')) {
                visualsToRemove.push(object);
                
                // If this visual has a reference to an actual spawner
                if (object.userData.spawnerReference && object.userData.spawnerReference.currentSpawnable) {
                    // Make the spawnable visible again
                    const spawnable = object.userData.spawnerReference.currentSpawnable;
                    if (spawnable.model) {
                        spawnable.model.visible = true;
                    }
                }
            }
        });
        
        // Remove all found visuals
        visualsToRemove.forEach(visual => {
            this.scene.remove(visual);
        });
        
        console.log(`Removed ${visualsToRemove.length} spawner visuals`);
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
            console.warn('Cannot record change for object without ID or instance index', object);
            return;
        }

        const changeId = `${objectId}-${instanceIndex}`;
        console.log(`Recording transform change for ${objectId} [${instanceIndex}]`);
        
        if (!this.pendingChanges.has(changeId)) {
            // Store original and current state when first modifying an object
            const change = {
                id: objectId,
                type: 'transform',
                userData: { ...object.userData },
                position: object.position.clone(),
                rotation: object.rotation.clone(),
                scale: object.scale.clone()
            };
            
            this.pendingChanges.set(changeId, change);
            console.log(`New transform change recorded: ${objectId} [${instanceIndex}]`, {
                position: object.position.toArray(),
                rotation: object.rotation.toArray(),
                scale: object.scale.toArray()
            });
        } else {
            // Update current state if it's not a delete operation
            const change = this.pendingChanges.get(changeId);
            if (change.type !== 'delete') {
                change.position = object.position.clone();
                change.rotation = object.rotation.clone();
                change.scale = object.scale.clone();
                console.log(`Updated transform change: ${objectId} [${instanceIndex}]`, {
                    position: object.position.toArray(),
                    rotation: object.rotation.toArray(), 
                    scale: object.scale.toArray()
                });
            }
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
        try {
            console.log('Saving all debug changes...');
            
            // Process all pending changes
            const pendingChanges = this.pendingChanges;
            if (pendingChanges.size === 0) {
                console.log('No changes to save');
                return true;
            }
            
            // Get world manager instance
            const worldManager = this.worldManager;
            
            // Get current world data - this will be updated as we process changes
            let worldData = await worldManagerService.getWorldData();
            
            // Ensure the spawners array exists
            if (!worldData.spawners) {
                worldData.spawners = [];
            }
            
            // Convert Map to array for processing
            const allChanges = Array.from(pendingChanges.values());
            console.log(`Processing ${allChanges.length} changes`);
            
            let successCount = 0;
            let failCount = 0;
            
            // First process all deletes to avoid conflicts
            const deleteChanges = allChanges.filter(change => change.type === 'delete');
            const transformChanges = allChanges.filter(change => change.type !== 'delete');
            
            // Process all deletions first
            for (const change of deleteChanges) {
                if (change.userData && change.userData.type === 'spawner') {
                    // Handle spawner deletion
                    console.log('Deleting spawner:', change.id, change.userData);
                    try {
                        // Find and remove the spawner from worldData
                        const spawnerIndex = worldData.spawners.findIndex(
                            s => s.id === change.id && s.instanceIndex === change.userData.instanceIndex
                        );
                        
                        if (spawnerIndex !== -1) {
                            console.log(`Removing spawner ${change.id} at index ${spawnerIndex} from world data`);
                            worldData.spawners.splice(spawnerIndex, 1);
                            
                            // Clean up the actual spawner if it exists
                            if (worldManagerService.loadedSpawners) {
                                const spawnerKey = `${change.id}-${change.userData.instanceIndex}`;
                                if (worldManagerService.loadedSpawners[spawnerKey]) {
                                    console.log(`Cleaning up spawner instance ${spawnerKey}`);
                                    
                                    // Get the spawner that needs to be removed
                                    const spawner = worldManagerService.loadedSpawners[spawnerKey];
                                    
                                    // If spawner has a cleanup method, call it
                                    if (spawner.clearTimeouts) {
                                        spawner.clearTimeouts();
                                    }
                                    
                                    // If spawner has a current spawnable, clean it up
                                    if (spawner.currentSpawnable) {
                                        spawner.currentSpawnable.cleanup();
                                    }
                                    
                                    // Remove from loadedSpawners
                                    delete worldManagerService.loadedSpawners[spawnerKey];
                                    
                                    // Remove the visual from the scene (important!)
                                    const visualName = `spawner-visual-${change.id}-${change.userData.instanceIndex}`;
                                    const visual = this.scene.getObjectByName(visualName);
                                    if (visual) {
                                        console.log(`Removing spawner visual from scene: ${visualName}`);
                                        this.scene.remove(visual);
                                    }
                                    
                                    // Remove any actual spawner models from the scene
                                    if (spawner.model) {
                                        console.log(`Removing spawner model from scene`);
                                        this.scene.remove(spawner.model);
                                    }
                                }
                            }
                            
                            // Also remove the object that was marked for deletion
                            const objectToDelete = this.findObjectWithUserData({
                                id: change.id,
                                instanceIndex: change.userData.instanceIndex,
                                type: 'spawner'
                            });
                            
                            if (objectToDelete) {
                                console.log(`Removing marked spawner object from scene`);
                                this.scene.remove(objectToDelete);
                            }
                            
                            successCount++;
                        } else {
                            console.warn(`Could not find spawner ${change.id} (${change.userData.instanceIndex}) in world data`);
                            failCount++;
                        }
                    } catch (error) {
                        console.error(`Error deleting spawner: ${error.message}`);
                        failCount++;
                    }
                } else {
                    // Handle regular object deletion
                    console.log('Deleting regular object:', change.id, change.userData.instanceIndex);
                    try {
                        // First delete from world data via the service
                        const result = await worldManagerService.deleteObjectFromWorldData(change.id, change.userData.instanceIndex);
                        
                        if (result) {
                            console.log(`Successfully removed object ${change.id} from world data`);
                            
                            // Then remove from scene if successful
                            const objectToDelete = this.findObjectWithUserData({
                                id: change.id,
                                instanceIndex: change.userData.instanceIndex
                            });
                            
                            if (objectToDelete) {
                                console.log(`Removing object from scene:`, objectToDelete);
                                this.scene.remove(objectToDelete);
                                successCount++;
                            } else {
                                console.warn(`Object to delete not found in scene: ${change.id}:${change.userData.instanceIndex}`);
                                // Still count as success since world data was updated
                                successCount++;
                            }
                            
                            // Get fresh world data after each deletion
                            worldData = await worldManagerService.getWorldData();
                        } else {
                            console.error(`Failed to delete object ${change.id} from world data`);
                            failCount++;
                        }
                    } catch (error) {
                        console.error(`Failed to delete ${change.id}:`, error);
                        failCount++;
                    }
                }
            }
            
            // Skip saving world data again if we've just processed deletions
            // The deleteObjectFromWorldData method already saved the changes
            if (deleteChanges.length > 0 && transformChanges.length === 0) {
                // Clear changes after saving
                this.pendingChanges.clear();
                
                // Show success message
                this.saveFeedback.style.background = 'rgba(0, 255, 0, 0.7)';
                this.saveFeedback.textContent = `Saved ${successCount} Changes Successfully`;
                this.showSaveFeedback();
                console.log('All changes saved successfully');
                return true;
            }
            
            // Then process all transform changes
            for (const change of transformChanges) {
                if (change.type === 'transform' && change.userData && change.userData.type === 'spawner') {
                    // Handle spawner transform update
                    console.log('Updating spawner position:', change.id, change.userData);
                    try {
                        // Find if this spawner already exists
                        const existingIndex = worldData.spawners.findIndex(
                            s => s.id === change.id && s.instanceIndex === change.userData.instanceIndex
                        );
                        
                        // Create spawner data object - only save ID, instance index and position
                        const spawnerData = {
                            id: change.id,
                            instanceIndex: change.userData.instanceIndex,
                            position: {
                                x: change.position.x,
                                y: change.position.y,
                                z: change.position.z
                            }
                        };
                        
                        // Update or add to world data
                        if (existingIndex >= 0) {
                            console.log(`Updating existing spawner at index ${existingIndex}`, spawnerData);
                            worldData.spawners[existingIndex] = spawnerData;
                        } else {
                            console.log('Adding new spawner to world data', spawnerData);
                            worldData.spawners.push(spawnerData);
                        }
                        
                        // Update the actual spawner if it exists
                        if (worldManagerService.loadedSpawners) {
                            const spawnerKey = `${change.id}-${change.userData.instanceIndex}`;
                            const spawner = worldManagerService.loadedSpawners[spawnerKey];
                            if (spawner) {
                                console.log(`Updating position of loaded spawner ${spawnerKey}`, change.position);
                                spawner.position.copy(change.position);
                            }
                        }
                        
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to update spawner ${change.id}:`, error);
                        failCount++;
                    }
                } 
                else if (change.type === 'transform') {
                    // Handle regular object transform update
                    console.log('Updating object transform:', change.id, change.userData.instanceIndex);
                    try {
                        // Find the object in the world data
                        let objectData = worldData.objects.find(obj => obj.id === change.id);
                        
                        // If object doesn't exist yet, create it
                        if (!objectData) {
                            console.log(`Creating new object entry for ${change.id}`);
                            objectData = {
                                id: change.id,
                                instances: []
                            };
                            worldData.objects.push(objectData);
                        }
                        
                        // Ensure instances array exists
                        if (!objectData.instances) {
                            objectData.instances = [];
                        }
                        
                        const instanceIndex = parseInt(change.userData.instanceIndex, 10);
                        let actualIndex = instanceIndex;
                        
                        // For objects with very large timestamp-based indices (from newly placed objects)
                        // we need to handle them specially
                        if (instanceIndex > 100000) { // Threshold for timestamp-based indices
                            console.log(`Large timestamp index detected: ${instanceIndex}`);
                            
                            // Check if we already have a mapping for this large index
                            const mappingKey = `${change.id}-${instanceIndex}`;
                            
                            // If we don't have this object in our large index mapping, add it
                            if (!this.largeIndexMapping) {
                                this.largeIndexMapping = new Map();
                            }
                            
                            if (this.largeIndexMapping.has(mappingKey)) {
                                // Use the previously mapped index
                                actualIndex = this.largeIndexMapping.get(mappingKey);
                                console.log(`Using existing mapped index ${actualIndex} for large index ${instanceIndex}`);
                            } else {
                                // Create a new instance at the end of the array
                                actualIndex = objectData.instances.length;
                                this.largeIndexMapping.set(mappingKey, actualIndex);
                                console.log(`Mapped large index ${instanceIndex} to new index ${actualIndex}`);
                                
                                // Add an empty object at this index
                                objectData.instances.push({});
                                
                                // Find the object in the scene with this large index
                                const sceneObject = this.findObjectWithUserData({
                                    id: change.id,
                                    instanceIndex: instanceIndex
                                });
                                
                                // Update the object's userData to use the new, smaller index
                                if (sceneObject) {
                                    console.log(`Updating scene object's instanceIndex from ${instanceIndex} to ${actualIndex}`);
                                    sceneObject.userData.instanceIndex = actualIndex;
                                    
                                    // Also update the change object to use the new index
                                    change.userData.instanceIndex = actualIndex;
                                    
                                    // Update the pendingChanges map key
                                    const oldChangeId = `${change.id}-${instanceIndex}`;
                                    const newChangeId = `${change.id}-${actualIndex}`;
                                    if (this.pendingChanges.has(oldChangeId)) {
                                        const changeObj = this.pendingChanges.get(oldChangeId);
                                        changeObj.userData.instanceIndex = actualIndex;
                                        this.pendingChanges.delete(oldChangeId);
                                        this.pendingChanges.set(newChangeId, changeObj);
                                    }
                                }
                            }
                        }
                        else if (instanceIndex >= objectData.instances.length || !objectData.instances[instanceIndex]) {
                            // For more normal indices, create new instances as needed
                            console.log(`Instance ${instanceIndex} not found in array, creating new instance`);
                            
                            // Ensure array is large enough and instance exists
                            while (objectData.instances.length <= instanceIndex) {
                                objectData.instances.push(null);
                            }
                            objectData.instances[instanceIndex] = {};
                        }
                        
                        console.log(`Updating object ${change.id} instance ${actualIndex}`);
                        
                        // Update position
                        objectData.instances[actualIndex].x = change.position.x;
                        objectData.instances[actualIndex].y = change.position.y;
                        objectData.instances[actualIndex].z = change.position.z;
                        
                        // Update rotation
                        objectData.instances[actualIndex].rotationX = change.rotation.x;
                        objectData.instances[actualIndex].rotationY = change.rotation.y;
                        objectData.instances[actualIndex].rotationZ = change.rotation.z;
                        
                        // Update scale - apply the world scale factor
                        if (change.scale) {
                            const scaleFactor = this.getWorldScaleFactor();
                            objectData.instances[actualIndex].scaleX = change.scale.x / scaleFactor;
                            objectData.instances[actualIndex].scaleY = change.scale.y / scaleFactor;
                            objectData.instances[actualIndex].scaleZ = change.scale.z / scaleFactor;
                        }
                        
                        console.log(`Updated object transform: ${change.id} [${actualIndex}]`, 
                            objectData.instances[actualIndex]);
                        
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to update transform for ${change.id}:`, error);
                        failCount++;
                    }
                }
            }
            
            // Save the updated world data only if there are transform changes
            if (transformChanges.length > 0) {
                await worldManagerService.saveWorldData(worldData);
            }
            
            // Clear changes after saving
            this.pendingChanges.clear();
            
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
            console.log('All changes saved successfully');
            return true;
        } catch (error) {
            console.error('Failed to save debug changes:', error);
            
            // Show error feedback
            this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
            this.saveFeedback.textContent = `Error: ${error.message}`;
            this.showSaveFeedback();
            
            return false;
        }
    }

    deleteSelectedObject() {
        const object = this.transformControls.object;
        if (!object) return;
        
        const objectId = object.userData.id;
        const instanceIndex = object.userData.instanceIndex;
        
        if (objectId === undefined || instanceIndex === undefined) {
            console.error('Cannot delete object with invalid ID or instance index', {
                objectId,
                instanceIndex
            });
            return;
        }

        // Create a consistent change ID format
        const changeId = `${objectId}-${instanceIndex}`;
        console.log(`Marking object for deletion: ${changeId}`, object);
        
        // Create a delete type change and add to pending changes
        const deleteChange = {
            id: objectId,
            type: 'delete',
            userData: {
                ...object.userData,
                instanceIndex: instanceIndex
            }
        };
        
        // Log details of the object being deleted
        console.log('Object being deleted:', {
            id: objectId,
            instanceIndex: instanceIndex,
            position: object.position.toArray(),
            scale: object.scale.toArray()
        });
        
        // Add to pending changes
        this.pendingChanges.set(changeId, deleteChange);
        
        // Remove object from scene immediately for visual feedback
        this.scene.remove(object);
        
        // Detach transform controls
        this.transformControls.detach();
        
        // Update change indicator
        this.changeCount = this.pendingChanges.size;
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

    // Add a new method for placing spawners
    placeSpawnerInWorld(spawnerId) {
        try {
            // Get spawner info from registry
            const spawnerInfo = SpawnerRegistry.items.find(item => item.id === spawnerId);
            if (!spawnerInfo) throw new Error(`Spawner ${spawnerId} not found in registry`);
            
            // Placement location - in front of camera
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            cameraDirection.applyQuaternion(this.camera.quaternion);
            
            // Place the spawner 5 units in front of the camera
            const position = new THREE.Vector3().copy(this.camera.position).add(
                cameraDirection.multiplyScalar(5)
            );
            
            // Place on the ground if possible
            position.y = 0;
            
            // Generate a unique instance index
            const timestamp = Date.now();
            const instanceIndex = timestamp % 1000000;

            // Create a visual indicator for the spawner
            const spawnerVisual = this.createSpawnerVisual(spawnerInfo);
            spawnerVisual.position.copy(position);
            
            // Add metadata for identification - store ID and instance index only
            // We don't store cooldown and items anymore as they come from registry
            spawnerVisual.userData.type = 'spawner';
            spawnerVisual.userData.id = spawnerId;
            spawnerVisual.userData.instanceIndex = instanceIndex;
            
            // Add to scene
            this.scene.add(spawnerVisual);
            
            // Attach transform controls
            this.transformControls.detach();
            this.transformControls.attach(spawnerVisual);
            
            // Record this as a change
            this.recordChange(spawnerVisual);
            
            // Show feedback
            this.saveFeedback.style.background = 'rgba(0, 255, 0, 0.7)';
            this.saveFeedback.textContent = `Added ${spawnerId} spawner - Press K to save`;
            this.showSaveFeedback();
            
            return true;
        } catch (error) {
            console.error(`Error placing spawner ${spawnerId}:`, error);
            this.saveFeedback.style.background = 'rgba(255, 0, 0, 0.7)';
            this.saveFeedback.textContent = `Error: ${error.message}`;
            this.showSaveFeedback();
            return false;
        }
    }

    // Helper method to create a visual representation of a spawner
    createSpawnerVisual(spawnerInfo) {
        // Create a group to hold all visual elements
        const group = new THREE.Group();
        
        // Create a base (cylinder) for the spawner
        const baseGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 32);
        const baseMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x3366ff,
            transparent: true,
            opacity: 0.7
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.05; // Half the height
        group.add(base);
        
        // Create a vertical beam
        const beamGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 8);
        const beamMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x3366ff,
            transparent: true,
            opacity: 0.5
        });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.position.y = 1; // Half the beam height
        group.add(beam);
        
        // Create a top emitter
        const emitterGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const emitterMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff,
            transparent: true,
            opacity: 0.7
        });
        const emitter = new THREE.Mesh(emitterGeometry, emitterMaterial);
        emitter.position.y = 2; // At the top of the beam
        group.add(emitter);
        
        // Add particles for visual effect
        const particleCount = 20;
        const particleGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            const radius = 0.4;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            positions[i3] = Math.sin(theta) * Math.cos(phi) * radius;
            positions[i3 + 1] = 2 + Math.random() * 0.3; // Position near emitter
            positions[i3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;
        }
        
        particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0x00ffff,
            size: 0.05,
            transparent: true,
            opacity: 0.7
        });
        
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        group.add(particles);
        
        // Add spawner info as text
        const spawnerLabel = this.createTextSprite(
            spawnerInfo.id,
            { fontsize: 80, fontface: 'Arial', borderColor: { r:0, g:0, b:0, a:1.0 } }
        );
        spawnerLabel.position.set(0, 2.3, 0);
        group.add(spawnerLabel);
        
        // Animate particles
        const animateParticles = () => {
            if (!group.parent) {
                // If group was removed from scene, stop animation
                return;
            }
            
            const positions = particles.geometry.attributes.position.array;
            
            for (let i = 0; i < particleCount; i++) {
                const i3 = i * 3;
                // Move particles upward
                positions[i3 + 1] += 0.01;
                
                // Reset particles that go too high
                if (positions[i3 + 1] > 2.5) {
                    positions[i3 + 1] = 2;
                }
            }
            
            particles.geometry.attributes.position.needsUpdate = true;
            
            requestAnimationFrame(animateParticles);
        };
        
        // Start animation
        animateParticles();
        
        return group;
    }

    // Helper function to create text sprites for labels
    createTextSprite(message, parameters) {
        if (parameters === undefined) parameters = {};
        
        const fontface = parameters.fontface || 'Arial';
        const fontsize = parameters.fontsize || 70;
        const borderThickness = parameters.borderThickness || 4;
        const borderColor = parameters.borderColor || { r:0, g:0, b:0, a:1.0 };
        const backgroundColor = parameters.backgroundColor || { r:255, g:255, b:255, a:1.0 };
        const textColor = parameters.textColor || { r:0, g:0, b:255, a:1.0 };
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = "Bold " + fontsize + "px " + fontface;
        
        // Get text metrics
        const metrics = context.measureText(message);
        const textWidth = metrics.width;
        
        // Canvas dimensions
        canvas.width = textWidth + borderThickness * 2;
        canvas.height = fontsize * 1.4 + borderThickness * 2;
        
        // Background color
        context.fillStyle = "rgba(" + backgroundColor.r + "," + backgroundColor.g + ","
                          + backgroundColor.b + "," + backgroundColor.a + ")";
        
        // Border color
        context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + ","
                            + borderColor.b + "," + borderColor.a + ")";
        
        context.lineWidth = borderThickness;
        
        // Draw rounded rectangle
        this.roundRect(context, borderThickness/2, borderThickness/2, 
                     canvas.width - borderThickness, canvas.height - borderThickness, 6);
        
        // Text color
        context.fillStyle = "rgba(" + textColor.r + "," + textColor.g + ","
                          + textColor.b + "," + textColor.a + ")";
        
        context.font = "Bold " + fontsize + "px " + fontface;
        context.fillText(message, borderThickness, fontsize + borderThickness);
        
        // Create texture
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(1.0, 0.5, 1.0);
        
        return sprite;
    }

    // Helper function to draw rounded rectangles
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    // Find objects by property - replace all getObjectByProperty calls with this helper function
    findObjectWithUserData(criteria) {
        let foundObject = null;
        
        // Recursively check all objects in the scene
        this.scene.traverse(object => {
            if (foundObject) return; // Already found
            
            // Check if this object's userData matches all criteria
            const matches = Object.entries(criteria).every(([key, value]) => {
                return object.userData[key] === value;
            });
            
            if (matches) {
                foundObject = object;
            }
        });
        
        return foundObject;
    }
} 