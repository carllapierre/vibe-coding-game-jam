import * as THREE from 'three';
import { PosterRegistry } from '../registries/PosterRegistry.js';
import { assetPath } from '../utils/pathHelper.js';

export class PosterObject extends THREE.Group {
    /**
     * Create a new poster object
     * @param {string} posterId - Poster ID from registry
     * @param {THREE.Vector3} position - Initial position
     * @param {number} [instanceIndex] - Optional instance index, will use timestamp if not provided
     */
    constructor(posterId, position, instanceIndex) {
        super();

        // Store poster ID and type
        this.userData = {
            id: posterId,
            type: 'poster',
            instanceIndex: instanceIndex || Date.now() // Use provided index or timestamp as unique instance index
        };

        // Set position
        this.position.copy(position);

        // Get poster data from registry
        this.posterData = PosterRegistry.getPosterInfo(posterId);
        if (!this.posterData) {
            console.error(`Poster type ${posterId} not found in registry`);
            return;
        }

        console.log(`Creating poster ${posterId} with instanceIndex ${this.userData.instanceIndex}`);

        // Create poster visuals
        this.createPosterVisuals();

        // Add collider for interaction
        this.createCollider();
    }

    /**
     * Create poster visual elements with frame
     */
    createPosterVisuals() {
        // Get color from posterData or use default
        const frameColor = this.posterData && this.posterData.frameColor ? this.posterData.frameColor : 0x8B4513; // Default to brown
        
        // Create poster frame - rectangular shape
        const frameGeometry = new THREE.BoxGeometry(2, 3, 0.1);
        const frameMaterial = new THREE.MeshStandardMaterial({ 
            color: frameColor,
            roughness: 0.5,
            metalness: 0.2
        });
        
        this.frame = new THREE.Mesh(frameGeometry, frameMaterial);
        this.add(this.frame);

        // Create poster - load image texture
        const posterGeometry = new THREE.PlaneGeometry(1.8, 2.8);
        
        // Create a placeholder material first
        const placeholderMaterial = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            side: THREE.FrontSide
        });
        
        this.poster = new THREE.Mesh(posterGeometry, placeholderMaterial);
        this.poster.position.z = 0.06; // Slightly in front of frame
        this.add(this.poster);
        
        // Load the image texture
        this.loadPosterTexture();
    }

    /**
     * Load the poster image texture
     */
    loadPosterTexture() {
        if (!this.posterData) return;
        
        const imagePath = PosterRegistry.getImage(this.posterData.id);
        if (!imagePath) {
            console.warn(`No image path found for poster ${this.posterData.id}`);
            // Create fallback texture
            this.createFallbackTexture();
            return;
        }
        
        console.log(`Loading poster texture from path: ${imagePath}`);
        
        // Manually test if the image can be loaded
        const testImage = new Image();
        testImage.onload = () => {
            console.log(`TEST: Image loaded successfully for ${this.posterData.id} (${testImage.width}x${testImage.height})`);
            
            // Adapt frame to image aspect ratio
            this.adaptFrameToImageAspectRatio(testImage.width, testImage.height);
        };
        testImage.onerror = (err) => {
            console.error(`TEST: Image failed to load for ${this.posterData.id}:`, err);
        };
        testImage.src = imagePath;
        
        // Load image and process it to adjust brightness
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Needed for processing images from different origins
        
        img.onload = () => {
            // Create canvas to process the image
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            
            // Draw the original image
            ctx.drawImage(img, 0, 0);
            
            // Get image data to manipulate pixels directly
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // Brightness adjustment factor (1.0 = normal, >1.0 = brighter, <1.0 = darker)
            const brightnessAdjust = 1.5; // Increase brightness by 20%
            
            // Adjust brightness of each pixel
            for (let i = 0; i < data.length; i += 4) {
                data[i] = Math.min(255, data[i] * brightnessAdjust);     // R
                data[i + 1] = Math.min(255, data[i + 1] * brightnessAdjust); // G
                data[i + 2] = Math.min(255, data[i + 2] * brightnessAdjust); // B
                // data[i + 3] is alpha (we don't change it)
            }
            
            // Put the modified image data back on the canvas
            ctx.putImageData(imageData, 0, 0);
            
            // Create texture from the adjusted canvas
            const texture = new THREE.CanvasTexture(canvas);
            texture.encoding = THREE.sRGBEncoding;
            texture.colorSpace = THREE.SRGBColorSpace;
            
            // Get image dimensions
            const width = canvas.width;
            const height = canvas.height;
            
            // Create material with the processed texture
            const posterMaterial = new THREE.MeshStandardMaterial({
                map: texture,
                side: THREE.FrontSide,
                roughness: 0.3,
                metalness: 0.1,
                color: 0xffffff
            });
            
            // Apply material to poster
            this.poster.material.dispose();
            this.poster.material = posterMaterial;
            
            // Adapt the frame to the image aspect ratio
            this.adaptFrameToImageAspectRatio(width, height);
        };
        
        img.onerror = (error) => {
            console.error(`Error loading poster texture for ${this.posterData.id}:`, error);
            console.error(`Failed path: ${imagePath}`);
            
            // Create fallback texture on error
            this.createFallbackTexture();
        };
        
        // Start loading the image
        img.src = imagePath;
    }
    
    /**
     * Create a fallback checkerboard texture when image loading fails
     */
    createFallbackTexture() {
        // Create a canvas for the checkerboard pattern
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // Draw checkerboard pattern
        const tileSize = 64;
        const colors = ['#333333', '#666666'];
        
        for (let y = 0; y < canvas.height; y += tileSize) {
            for (let x = 0; x < canvas.width; x += tileSize) {
                const colorIndex = ((x / tileSize) + (y / tileSize)) % 2;
                context.fillStyle = colors[colorIndex];
                context.fillRect(x, y, tileSize, tileSize);
            }
        }
        
        // Add text to indicate it's a fallback
        context.font = '36px Arial';
        context.fillStyle = '#ffffff';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(`Poster ${this.posterData.id}`, canvas.width / 2, canvas.height / 2);
        context.fillText('(Image not found)', canvas.width / 2, canvas.height / 2 + 40);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create material with the texture
        const posterMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.FrontSide
        });
        
        // Apply material to poster
        if (this.poster) {
            this.poster.material.dispose();
            this.poster.material = posterMaterial;
        }
        
        console.log(`Created fallback texture for ${this.posterData.id}`);
    }

    /**
     * Create a text label for the poster
     * @param {string} labelText - Text to display
     */
    createLabel(labelText) {
        // Create a canvas texture for the text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128;
        
        // Set the background to transparent
        context.fillStyle = 'rgba(0, 0, 0, 0)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw text
        context.font = 'bold 48px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#ffffff';
        context.fillText(labelText, canvas.width / 2, canvas.height / 2);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        
        // Create material using the texture
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Create a plane geometry for the label
        const geometry = new THREE.PlaneGeometry(2, 0.5);
        
        // Create mesh and add to group
        this.label = new THREE.Mesh(geometry, material);
        this.label.position.set(0, -1.8, 0.1);
        this.label.userData.canvas = canvas; // Store reference to canvas for updates
        this.label.userData.text = labelText; // Store current text
        
        this.add(this.label);
    }
    
    /**
     * Update the label text
     * @param {string} newText - New text to display
     */
    updateLabel(newText) {
        if (this.label) {
            const canvas = this.label.userData.canvas;
            if (canvas) {
                const context = canvas.getContext('2d');
                
                // Clear canvas
                context.clearRect(0, 0, canvas.width, canvas.height);
                
                // Draw new text
                context.font = 'bold 48px Arial';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillStyle = '#ffffff';
                context.fillText(newText, canvas.width / 2, canvas.height / 2);
                
                // Update texture
                this.label.material.map.needsUpdate = true;
                
                // Store current text
                this.label.userData.text = newText;
            }
        }
    }

    /**
     * Create collider for poster interaction
     */
    createCollider() {
        // Create invisible collider
        const colliderGeometry = new THREE.BoxGeometry(2, 3, 0.5);
        const colliderMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            wireframe: true,
            transparent: true,
            opacity: 0.0
        });
        
        this.collider = new THREE.Mesh(colliderGeometry, colliderMaterial);
        this.collider.userData.isPosterCollider = true;
        this.collider.userData.posterId = this.userData.id;
        this.collider.userData.parentPoster = this; // Store reference to parent poster
        
        // Position slightly in front of visual
        this.collider.position.z = 0.25;
        this.add(this.collider);
    }

    /**
     * Set the poster frame color
     * @param {number} color - Hex color
     */
    setFrameColor(color) {
        if (this.frame && this.frame.material) {
            this.frame.material.color.set(color);
        }
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        // Clean up geometries
        if (this.frame) {
            this.frame.geometry.dispose();
            this.frame.material.dispose();
        }
        
        if (this.poster) {
            this.poster.geometry.dispose();
            this.poster.material.dispose();
        }
        
        if (this.collider) {
            this.collider.geometry.dispose();
            this.collider.material.dispose();
        }
        
        // Remove the label
        if (this.label) {
            this.label.geometry.dispose();
            if (this.label.material.map) {
                this.label.material.map.dispose();
            }
            this.label.material.dispose();
        }
    }

    /**
     * Adapt the frame and poster plane to match the image's aspect ratio
     * @param {number} imageWidth - Width of the loaded image
     * @param {number} imageHeight - Height of the loaded image
     */
    adaptFrameToImageAspectRatio(imageWidth, imageHeight) {
        // Calculate aspect ratio of the image
        const aspectRatio = imageWidth / imageHeight;
        
        // Fixed height for the poster (3 units)
        const posterHeight = 3;
        // Calculate width based on aspect ratio
        const posterWidth = posterHeight * aspectRatio;
        
        // Add small margins for the frame
        const frameMargin = 0.1;
        const frameWidth = posterWidth + frameMargin * 2;
        const frameHeight = posterHeight + frameMargin * 2;
        
        console.log(`Adapting frame to image aspect ratio: ${aspectRatio} (${imageWidth}x${imageHeight})`);
        console.log(`New dimensions - Frame: ${frameWidth}x${frameHeight}, Poster: ${posterWidth}x${posterHeight}`);
        
        // Update frame geometry
        if (this.frame) {
            this.frame.geometry.dispose();
            this.frame.geometry = new THREE.BoxGeometry(frameWidth, frameHeight, 0.1);
        }
        
        // Update poster plane geometry
        if (this.poster) {
            this.poster.geometry.dispose();
            this.poster.geometry = new THREE.PlaneGeometry(posterWidth, posterHeight);
        }
        
        // Update collider if it exists
        if (this.collider) {
            this.collider.geometry.dispose();
            this.collider.geometry = new THREE.BoxGeometry(frameWidth, frameHeight, 0.5);
        }
    }
} 