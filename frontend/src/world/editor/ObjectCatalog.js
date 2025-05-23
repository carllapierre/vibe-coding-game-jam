import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ObjectRegistry } from '../../registries/ObjectRegistry.js';
import { SpawnerRegistry } from '../../registries/SpawnerRegistry.js';
import { PortalRegistry } from '../../registries/PortalRegistry.js';
import { PosterRegistry } from '../../registries/PosterRegistry.js';
import { getPositionInFrontOfCamera } from '../../utils/SceneUtils.js';
import { showFeedback } from '../../utils/UIUtils.js';
import sharedRenderer from '../../utils/SharedRenderer.js';

/**
 * Handles the object catalog UI for the editor
 */
export class ObjectCatalog {
    /**
     * @param {Function} placeObjectCallback - Callback to place objects in the world
     * @param {Function} placeSpawnerCallback - Callback to place spawners in the world
     * @param {Function} placePortalCallback - Callback to place portals in the world
     * @param {Function} placePosterCallback - Callback to place posters in the world
     * @param {THREE.Camera} camera - Three.js camera for placing objects
     * @param {HTMLElement} feedbackElement - Element for feedback messages
     */
    constructor(placeObjectCallback, placeSpawnerCallback, placePortalCallback, placePosterCallback, camera, feedbackElement) {
        this.placeObjectCallback = placeObjectCallback;
        this.placeSpawnerCallback = placeSpawnerCallback;
        this.placePortalCallback = placePortalCallback;
        this.placePosterCallback = placePosterCallback;
        this.camera = camera;
        this.feedbackElement = feedbackElement;
        
        this.catalogContainer = null;
        this.itemsContainer = null;
        this.isCatalogOpen = false;
        this.previewsLoaded = false;
        this.previewModels = {};
        
        this.createCatalog();
    }
    
    /**
     * Create the catalog UI
     */
    createCatalog() {
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
            this.filterItems(searchInput.value.toLowerCase());
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
    }
    
    /**
     * Populate the catalog with items from registry
     */
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
            this.createObjectItem(item);
        });
        
        // Add section title for portals
        const portalsTitle = document.createElement('div');
        portalsTitle.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            padding: 5px;
            margin: 15px 0 5px 0;
            border-bottom: 1px solid #555;
        `;
        portalsTitle.textContent = 'Portals';
        this.itemsContainer.appendChild(portalsTitle);
        
        // Add each portal from the registry
        PortalRegistry.items.forEach(item => {
            this.createPortalItem(item);
        });
        
        // Add section title for posters
        const postersTitle = document.createElement('div');
        postersTitle.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            padding: 5px;
            margin: 15px 0 5px 0;
            border-bottom: 1px solid #555;
        `;
        postersTitle.textContent = 'Posters';
        this.itemsContainer.appendChild(postersTitle);
        
        // Add each poster from the registry
        PosterRegistry.items.forEach(item => {
            this.createPosterItem(item);
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
            this.createSpawnerItem(item);
        });
    }
    
    /**
     * Create an item element for an object
     * @param {Object} item - Object data from registry
     */
    createObjectItem(item) {
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
            this.placeObject(item.id);
        });
        
        // Hover effect
        itemElement.addEventListener('mouseenter', () => {
            itemElement.style.background = 'rgba(80, 80, 80, 0.8)';
        });
        
        itemElement.addEventListener('mouseleave', () => {
            itemElement.style.background = 'rgba(60, 60, 60, 0.8)';
        });
        
        this.itemsContainer.appendChild(itemElement);
    }
    
    /**
     * Create an item element for a portal
     * @param {Object} item - Portal data from registry
     */
    createPortalItem(item) {
        const itemElement = document.createElement('div');
        itemElement.classList.add('catalog-item');
        itemElement.dataset.id = item.id;
        itemElement.dataset.type = 'portal';
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
        
        // Portal preview container
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
        
        // Create a simple preview for the portal
        const portalPreview = document.createElement('div');
        portalPreview.style.cssText = `
            width: 60px;
            height: 80px;
            background: #${item.color ? item.color.toString(16).padStart(6, '0') : '3366ff'};
            border-radius: 5px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 15px #${item.color ? item.color.toString(16).padStart(6, '0') : '3366ff'};
        `;
        
        // Portal icon
        const portalIcon = document.createElement('div');
        portalIcon.style.cssText = `
            color: #ffffff;
            font-size: 32px;
            text-align: center;
        `;
        portalIcon.textContent = '🌀';
        
        portalPreview.appendChild(portalIcon);
        previewContainer.appendChild(portalPreview);
        
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
        
        // Item description
        const descElement = document.createElement('div');
        descElement.textContent = item.description || 'Portal';
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
        
        // Add click event for portal placement
        itemElement.addEventListener('click', () => {
            this.placePortal(item.id);
        });
        
        // Hover effect
        itemElement.addEventListener('mouseenter', () => {
            itemElement.style.background = 'rgba(80, 80, 80, 0.8)';
        });
        
        itemElement.addEventListener('mouseleave', () => {
            itemElement.style.background = 'rgba(60, 60, 60, 0.8)';
        });
        
        this.itemsContainer.appendChild(itemElement);
    }
    
    /**
     * Create an item element for a poster
     * @param {Object} item - Poster data from registry
     */
    createPosterItem(item) {
        const itemElement = document.createElement('div');
        itemElement.classList.add('catalog-item');
        itemElement.dataset.id = item.id;
        itemElement.dataset.type = 'poster';
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
        
        // Poster preview container
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
        
        // Create a simple preview for the poster
        const posterPreview = document.createElement('div');
        posterPreview.style.cssText = `
            width: 60px;
            height: 80px;
            background: #${item.frameColor ? item.frameColor.toString(16).padStart(6, '0') : '8B4513'};
            border-radius: 2px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // Poster icon
        const posterIcon = document.createElement('div');
        posterIcon.style.cssText = `
            color: #ffffff;
            font-size: 32px;
            text-align: center;
        `;
        posterIcon.textContent = '🖼️';
        
        posterPreview.appendChild(posterIcon);
        previewContainer.appendChild(posterPreview);
        
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
        
        // Item description
        const descElement = document.createElement('div');
        descElement.textContent = item.description || 'Poster';
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
        
        // Add click event for poster placement
        itemElement.addEventListener('click', () => {
            this.placePoster(item.id);
        });
        
        // Hover effect
        itemElement.addEventListener('mouseenter', () => {
            itemElement.style.background = 'rgba(80, 80, 80, 0.8)';
        });
        
        itemElement.addEventListener('mouseleave', () => {
            itemElement.style.background = 'rgba(60, 60, 60, 0.8)';
        });
        
        this.itemsContainer.appendChild(itemElement);
    }
    
    /**
     * Create an item element for a spawner
     * @param {Object} item - Spawner data from registry
     */
    createSpawnerItem(item) {
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
            this.placeSpawner(item.id);
        });
        
        // Hover effect
        itemElement.addEventListener('mouseenter', () => {
            itemElement.style.background = 'rgba(80, 80, 80, 0.8)';
        });
        
        itemElement.addEventListener('mouseleave', () => {
            itemElement.style.background = 'rgba(60, 60, 60, 0.8)';
        });
        
        this.itemsContainer.appendChild(itemElement);
    }
    
    /**
     * Toggle catalog visibility
     * @param {boolean} show - Whether to show the catalog 
     */
    toggleCatalog(show = null) {
        // If show is null, toggle the current state
        const shouldShow = show !== null ? show : !this.isCatalogOpen;
        
        this.catalogContainer.style.left = shouldShow ? '0px' : '-350px';
        this.isCatalogOpen = shouldShow;
        
        if (shouldShow && !this.previewsLoaded) {
            this.loadPreviews();
        }
    }
    
    /**
     * Filter catalog items by search term
     * @param {string} searchTerm - Term to filter by
     */
    filterItems(searchTerm) {
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
    
    /**
     * Place an object in the world
     * @param {string} objectId - ID of the object to place 
     */
    placeObject(objectId) {
        try {
            // Get position in front of camera
            const position = getPositionInFrontOfCamera(this.camera);
            
            // Call the callback with the object ID and position
            this.placeObjectCallback(objectId, position);
            
            // Show feedback
            showFeedback(
                this.feedbackElement,
                `Placed ${objectId}`,
                'rgba(0, 255, 0, 0.7)'
            );
        } catch (error) {
            console.error(`Error placing object ${objectId}:`, error);
            
            showFeedback(
                this.feedbackElement,
                `Error: ${error.message}`,
                'rgba(255, 0, 0, 0.7)'
            );
        }
    }
    
    /**
     * Place a spawner in the world
     * @param {string} spawnerId - ID of the spawner to place
     */
    placeSpawner(spawnerId) {
        try {
            // Get position in front of camera
            const position = getPositionInFrontOfCamera(this.camera);
            
            // Call the callback with the spawner ID and position
            this.placeSpawnerCallback(spawnerId, position);
            
            // Show feedback
            showFeedback(
                this.feedbackElement,
                `Placed ${spawnerId} spawner`,
                'rgba(0, 255, 0, 0.7)'
            );
        } catch (error) {
            console.error(`Error placing spawner ${spawnerId}:`, error);
            
            showFeedback(
                this.feedbackElement,
                `Error: ${error.message}`,
                'rgba(255, 0, 0, 0.7)'
            );
        }
    }
    
    /**
     * Place a portal in the world
     * @param {string} portalId - ID of the portal to place
     */
    placePortal(portalId) {
        try {
            // Get position in front of camera
            const position = getPositionInFrontOfCamera(this.camera);
            
            // Call the callback with the portal ID and position
            this.placePortalCallback(portalId, position);
            
            // Show feedback
            showFeedback(
                this.feedbackElement,
                `Placed ${portalId} portal`,
                'rgba(0, 255, 0, 0.7)'
            );
        } catch (error) {
            console.error(`Error placing portal ${portalId}:`, error);
            
            showFeedback(
                this.feedbackElement,
                `Error: ${error.message}`,
                'rgba(255, 0, 0, 0.7)'
            );
        }
    }
    
    /**
     * Place a poster in the world
     * @param {string} posterId - ID of the poster to place
     */
    placePoster(posterId) {
        try {
            // Get position in front of camera
            const position = getPositionInFrontOfCamera(this.camera);
            
            // Call the callback with the poster ID and position
            this.placePosterCallback(posterId, position);
            
            // Show feedback
            showFeedback(
                this.feedbackElement,
                `Placed ${posterId} poster`,
                'rgba(0, 255, 0, 0.7)'
            );
        } catch (error) {
            console.error(`Error placing poster ${posterId}:`, error);
            
            showFeedback(
                this.feedbackElement,
                `Error: ${error.message}`,
                'rgba(255, 0, 0, 0.7)'
            );
        }
    }
    
    /**
     * Load preview thumbnails for catalog items
     */
    async loadPreviews() {
        // Set fallback previews first to ensure something is shown
        const items = this.itemsContainer.querySelectorAll('.catalog-item');
        
        // Set loaded flag to prevent duplicate loading
        this.previewsLoaded = true;
        
        try {
            // Load model previews one by one
            for (const item of ObjectRegistry.items) {
                try {
                    // Get preview container
                    const previewContainer = this.itemsContainer.querySelector(`[data-preview-for="${item.id}"]`);
                    if (!previewContainer) continue;
                    
                    // Use assetPath helper to get the correct path
                    const modelPath = ObjectRegistry.getModelPath(item.id);
                    
                    // Create a new scene for this preview
                    const scene = new THREE.Scene();
                    
                    // Add lighting
                    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
                    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                    directionalLight.position.set(5, 10, 7);
                    scene.add(ambientLight);
                    scene.add(directionalLight);
                    
                    // Create a camera for this preview
                    const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 1000);
                    
                    // Load the model
                    await new Promise(resolve => {
                        try {
                            const loader = new GLTFLoader();
                            loader.load(modelPath, (gltf) => {
                                try {
                                    const model = gltf.scene.clone();
                                    
                                    // Apply scale
                                    model.scale.multiplyScalar(item.scale || 1.0);
                                    
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
                                    
                                    // Create a new image element
                                    const img = document.createElement('img');
                                    
                                    // Use the shared renderer to render the scene
                                    sharedRenderer.renderToImage(scene, camera, img, 200, 120);
                                    
                                    img.style.cssText = `
                                        width: 100%;
                                        height: 100%;
                                        object-fit: contain;
                                    `;
                                    
                                    // Clear container and add image
                                    previewContainer.innerHTML = '';
                                    previewContainer.appendChild(img);
                                    
                                    // Clean up to avoid memory leaks
                                    scene.remove(model);
                                    model.traverse(child => {
                                        if (child.geometry) child.geometry.dispose();
                                        if (child.material) {
                                            if (Array.isArray(child.material)) {
                                                child.material.forEach(material => material.dispose());
                                            } else {
                                                child.material.dispose();
                                            }
                                        }
                                    });
                                    
                                    resolve();
                                } catch (error) {
                                    console.error(`Error processing model for ${item.id}:`, error);
                                    // Set a default placeholder
                                    previewContainer.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:32px;">📦</div>`;
                                    resolve();
                                }
                            }, 
                            // Progress callback
                            undefined, 
                            // Error callback
                            (error) => {
                                console.error(`Error loading preview for ${item.id}:`, error);
                                // Set a default placeholder
                                previewContainer.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:32px;">📦</div>`;
                                resolve();
                            });
                        } catch (error) {
                            console.error(`Loader error for ${item.id}:`, error);
                            // Set a default placeholder
                            previewContainer.innerHTML = `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:32px;">📦</div>`;
                            resolve();
                        }
                    });
                } catch (error) {
                    console.error(`Error setting up preview for ${item.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Error initializing preview renderer:', error);
        }
    }
    
    /**
     * Clean up the catalog
     */
    dispose() {
        if (this.catalogContainer && this.catalogContainer.parentNode) {
            this.catalogContainer.parentNode.removeChild(this.catalogContainer);
        }
    }
} 