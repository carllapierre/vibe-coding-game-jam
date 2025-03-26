import * as THREE from 'three';
import { CanvasTexture, SpriteMaterial, Sprite } from 'three';

/**
 * NameTag class for displaying player names above their models
 */
export class NameTag {
  /**
   * Create a new NameTag
   * @param {string} playerName - The name to display
   */
  constructor() {
    // Create shared canvas for all name tags
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 64;
    this.context = this.canvas.getContext('2d');
    
    // Store references
    this.sprite = null;
    this.texture = null;
    this.playerName = "";
  }
  
  /**
   * Create and attach a name tag to a model
   * @param {THREE.Object3D} model - The model to attach the name tag to
   * @param {string} playerName - The name to display
   */
  create(model, playerName) {
    if (!model) return;
    
    try {
      // Create a texture using the canvas
      this.texture = new CanvasTexture(this.canvas);
      this.texture.needsUpdate = true;
      
      // Draw the name on the canvas
      this.draw(playerName);
      
      // Create sprite material with the texture
      const material = new SpriteMaterial({ 
        map: this.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false // Prevent writing to depth buffer to avoid bloom effects
      });
      
      // Create the sprite
      this.sprite = new Sprite(material);
      this.sprite.position.set(0, 1, 0); // Position directly above character's head
      this.sprite.scale.set(1.8, 0.45, 1); // Smaller scale
      this.sprite.renderOrder = 9999; // Ensure it renders on top of everything else
      
      // Add the sprite to the model
      model.add(this.sprite);
      
      // Store the player name
      this.playerName = playerName;
      
      // Debug log to confirm name tag creation
      console.log(`Created name tag for player: ${playerName}`);
    } catch (error) {
      console.error('Failed to create name tag:', error);
    }
  }
  
  /**
   * Draw the name tag on the canvas
   * @param {string} playerName - The name to display
   */
  draw(playerName) {
    if (!this.context) return;
    
    // Clear the canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Simple clean design without background
    this.context.font = '20px Arial, Helvetica, sans-serif';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    
    // Draw white text with thicker black outline for readability and anti-bloom
    this.context.strokeStyle = 'black';
    this.context.lineWidth = 4; // Thicker outline
    this.context.strokeText(playerName, this.canvas.width / 2, this.canvas.height / 2);
    
    this.context.fillStyle = '#787878';
    this.context.fillText(playerName, this.canvas.width / 2, this.canvas.height / 2);
    
    // Update the texture
    if (this.texture) {
      this.texture.needsUpdate = true;
    }
  }
  
  /**
   * Update the name tag with a new name
   * @param {string} playerName - The new name to display
   */
  update(playerName) {
    if (playerName && playerName !== this.playerName) {
      this.draw(playerName);
      this.playerName = playerName;
    }
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    if (this.texture) {
      this.texture.dispose();
    }
    if (this.sprite && this.sprite.material) {
      this.sprite.material.dispose();
    }
    this.sprite = null;
  }
} 