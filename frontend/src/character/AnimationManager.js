import * as THREE from 'three';
import { character } from '../config.js';

/**
 * AnimationManager handles the animation state of a character based on its state.
 * It extracts animations from GLTF models and plays the appropriate animation.
 */
export class AnimationManager {
  /**
   * Create a new AnimationManager
   * @param {THREE.Object3D} model - The character model
   * @param {Array} externalAnimations - Optional external animations to use
   */
  constructor(model, externalAnimations = null) {
    this.model = model;
    this.mixer = null;
    this.actions = {};
    this.currentAction = null;
    this.currentState = 'idle';
    this.isInHitState = false;
    this.hitStateStartTime = 0;
    
    // Simple direct mapping from states to animation names
    this.stateAnimationMap = {
      'idle': 'idle',
      'walking': 'walk',
      'jumping': 'jump',
      'hit': 'emote-no'
    };
    
    // Animation speeds for each state (1.0 is normal speed)
    this.animationSpeeds = {
      'idle': 0.3,    // Slower idle for a more relaxed look
      'walking': 1, // Slightly faster walking to look more energetic
      'jumping': 0.9, // Slightly slower jump for more weight
      'hit': character.states.hit.animationSpeed // Use configured hit animation speed
    };
    
    // Default animation if the specific one isn't found
    this.fallbackAnimation = 'idle';
    
    // Initialize if model is provided
    if (model) {
      this.init(model, externalAnimations);
    }
  }
  
  /**
   * Initialize the animation manager with a model
   * @param {THREE.Object3D} model - The character model
   * @param {Array} externalAnimations - Optional external animations
   */
  init(model, externalAnimations = null) {
    this.model = model;
    this.mixer = new THREE.AnimationMixer(model);
    
    // Use provided animations
    if (externalAnimations && externalAnimations.length > 0) {
      this.extractAnimations(externalAnimations);
    } else {
      console.warn('No animations provided to the animation manager');
    }
  }
  
  /**
   * Extract animations from the model and create actions
   * @param {Array} animations - Array of AnimationClips
   */
  extractAnimations(animations) {
    if (!animations || animations.length === 0) {
      console.warn('No animations provided to extract');
      return;
    }
    
    animations.forEach(clip => {
      
      // Create action for this animation
      const action = this.mixer.clipAction(clip);
      action.enabled = true;
      
      // Store in actions map
      this.actions[clip.name] = action;
    });
    
    // Play idle animation by default if available
    if (this.actions['idle']) {
      this.setState('idle');
    }
  }
  
  /**
   * Update animation state based on player state
   * @param {string} state - Current player state ('idle', 'walking', 'jumping', 'hit')
   */
  setState(state) {
    // If we're in hit state, don't allow state changes until hit animation is complete
    if (this.isInHitState) {
      const elapsed = (Date.now() - this.hitStateStartTime) / 1000; // Convert to seconds
      if (elapsed < character.states.hit.duration) {
        return; // Don't change state while hit animation is playing
      } else {
        this.isInHitState = false;
      }
    }

    // Don't change if it's the same state
    if (state === this.currentState) return;
    
    // Get animation name for this state
    const animationName = this.stateAnimationMap[state] || this.fallbackAnimation;
    
    // Check if we have this animation
    const targetAction = this.actions[animationName];
    if (!targetAction) {
      console.warn(`Animation "${animationName}" not found for state "${state}"`);
      return;
    }
    
    // Get the animation speed for this state (default to 1.0 if not specified)
    const speed = this.animationSpeeds[state] || 1.0;
    
    // Apply animation speed
    targetAction.timeScale = speed;
    
    // Special handling for hit state
    if (state === 'hit') {
      this.isInHitState = true;
      this.hitStateStartTime = Date.now();
      // For hit animation, we want to play it immediately without crossfade
      console.log('Playing hit animation (emote-no)');
      targetAction.reset().play();
    } else {
      // Normal crossfade for other states
      if (this.currentAction && this.currentAction !== targetAction) {
        this.currentAction.fadeOut(0.5);
        targetAction.reset().fadeIn(0.5).play();
      } else {
        targetAction.play();
      }
    }
    
    // Update current state and action
    this.currentState = state;
    this.currentAction = targetAction;
  }
  
  /**
   * Update animation mixer
   * @param {number} deltaTime - Time since last frame in seconds
   */
  update(deltaTime) {
    if (this.mixer) {
      this.mixer.update(deltaTime);
      
      // Check if hit animation is complete
      if (this.isInHitState) {
        const elapsed = (Date.now() - this.hitStateStartTime) / 1000;
        if (elapsed >= character.states.hit.duration) {
          this.isInHitState = false;
          // Reset to idle state
          this.setState('idle');
        }
      }
    }
  }
} 