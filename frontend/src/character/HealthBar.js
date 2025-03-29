import * as THREE from 'three';
import { CanvasTexture, SpriteMaterial, Sprite } from 'three';

/**
 * HealthBar class for displaying player health above their models
 */
export class HealthBar {
  /**
   * Create a new HealthBar
   */
  constructor() {
    // Create shared canvas for health bar
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 32;
    this.context = this.canvas.getContext('2d');
    
    // Store references
    this.sprite = null;
    this.texture = null;
    this.currentHealth = 100;
    this.maxHealth = 100;
  }
  
  /**
   * Create and attach a health bar to a model
   * @param {THREE.Object3D} model - The model to attach the health bar to
   * @param {number} currentHealth - The current health value
   * @param {number} maxHealth - The maximum health value
   */
  create(model, currentHealth = 100, maxHealth = 100) {
    if (!model) return;
    
    try {
      // Store health values
      this.currentHealth = currentHealth;
      this.maxHealth = maxHealth;
      
      // Create a texture using the canvas
      this.texture = new CanvasTexture(this.canvas);
      this.texture.needsUpdate = true;
      
      // Draw the health bar on the canvas
      this.draw(currentHealth, maxHealth);
      
      // Create sprite material with the texture
      const material = new SpriteMaterial({ 
        map: this.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false // Prevent writing to depth buffer to avoid bloom effects
      });
      
      // Create the sprite
      this.sprite = new Sprite(material);
      
      // Position below the name tag (not above)
      this.sprite.position.set(0, 0.8, 0); // Lower position
      this.sprite.scale.set(0.7, 0.07, 1); // Even thinner and smaller width
      this.sprite.renderOrder = 9999; // Ensure it renders on top of everything else
      
      // Add the sprite to the model
      model.add(this.sprite);
      
    } catch (error) {
      console.error('Failed to create health bar:', error);
    }
  }
  
  /**
   * Draw the health bar on the canvas
   * @param {number} currentHealth - Current health value
   * @param {number} maxHealth - Maximum health value
   */
  draw(currentHealth, maxHealth) {
    if (!this.context) return;
    
    // Store health values
    this.currentHealth = currentHealth;
    this.maxHealth = maxHealth;
    
    // Clear the canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw background (dark gray)
    this.context.fillStyle = 'rgba(40, 40, 40, 0.8)';
    this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Calculate health percentage
    const healthPercentage = Math.max(0, Math.min(1, currentHealth / maxHealth));
    const barWidth = Math.floor(this.canvas.width * healthPercentage);
    
    // Determine color based on health percentage
    let barColor;
    if (healthPercentage > 0.6) {
      barColor = 'rgba(50, 255, 50, 0.9)'; // Green for high health
    } else if (healthPercentage > 0.3) {
      barColor = 'rgba(255, 255, 50, 0.9)'; // Yellow for medium health
    } else {
      barColor = 'rgba(255, 50, 50, 0.9)'; // Red for low health
    }
    
    // Draw health bar
    this.context.fillStyle = barColor;
    this.context.fillRect(0, 0, barWidth, this.canvas.height);
    
    // Add a more prominent border
    this.context.strokeStyle = 'rgba(0, 0, 0, 1)'; // Solid black
    this.context.lineWidth = 3;
    this.context.strokeRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Update the texture
    if (this.texture) {
      this.texture.needsUpdate = true;
    }
  }
  
  /**
   * Update the health bar with new health values
   * @param {number} currentHealth - Current health value
   * @param {number} maxHealth - Maximum health value (optional)
   * @param {boolean} showHitEffect - Whether to show a hit effect
   */
  update(currentHealth, maxHealth = this.maxHealth, showHitEffect = false) {
    const healthChanged = currentHealth !== this.currentHealth || maxHealth !== this.maxHealth;
    
    if (healthChanged) {
      // Store previous health to detect damage
      const previousHealth = this.currentHealth;
      
      // Draw updated health bar
      this.draw(currentHealth, maxHealth);
      
      // Show hit effect if requested or if health decreased
      if (showHitEffect || (previousHealth > currentHealth)) {
        this.showHitEffect();
      }
    }
  }
  
  /**
   * Show a visual effect when the player takes damage
   */
  showHitEffect() {
    if (!this.sprite || !this.sprite.material) return;
    
    // Store original material properties
    const originalOpacity = this.sprite.material.opacity || 1.0;
    
    // Flash the health bar red
    this.sprite.material.opacity = 1.0;
    
    // Create a temporary overlay sprite for the flash effect
    const flashMaterial = new SpriteMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false
    });
    
    const flashSprite = new Sprite(flashMaterial);
    flashSprite.position.copy(this.sprite.position);
    flashSprite.scale.copy(this.sprite.scale);
    flashSprite.renderOrder = this.sprite.renderOrder + 1;
    
    // Add to the same parent as the health bar
    if (this.sprite.parent) {
      this.sprite.parent.add(flashSprite);
    }
    
    // Animate flash effect
    let startTime = Date.now();
    const duration = 500; // Flash duration in ms
    
    const animateFlash = () => {
      const elapsed = Date.now() - startTime;
      const t = Math.min(1.0, elapsed / duration);
      
      // Fade out flash
      if (flashSprite && flashSprite.material) {
        flashSprite.material.opacity = 0.6 * (1.0 - t);
      }
      
      if (t < 1.0) {
        requestAnimationFrame(animateFlash);
      } else {
        // Clean up flash sprite
        if (flashSprite.parent) {
          flashSprite.parent.remove(flashSprite);
        }
        flashMaterial.dispose();
        
        // Restore original opacity
        if (this.sprite && this.sprite.material) {
          this.sprite.material.opacity = originalOpacity;
        }
      }
    };
    
    // Start animation
    animateFlash();
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