import * as THREE from 'three';

export class EffectsDisplay {
    /**
     * @param {EffectsManager} effectsManager - The manager tracking active effects.
     * @param {Hotbar} hotbar - The hotbar instance (used for item image generation).
     */
    constructor(effectsManager, hotbar) {
        if (!effectsManager || !hotbar) {
            console.error("EffectsDisplay requires an EffectsManager and Hotbar instance.");
            return;
        }
        this.effectsManager = effectsManager;
        this.hotbar = hotbar; // Store hotbar to use its getItemImage method
        this.effectElements = new Map(); // Map effectId -> { iconElement, cooldownElement }

        this.container = document.createElement('div');
        this.container.className = 'effects-display';
        this.container.style.cssText = `
            position: fixed;
            bottom: 95px; /* Position above the default hotbar */
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 6px;
            padding: 5px;
            /* Optional background for debugging */
            /* background: rgba(255, 0, 0, 0.1); */
            z-index: 999; /* Below hotbar but above most game elements */
            pointer-events: none; /* Allow clicks to pass through */
        `;
        document.body.appendChild(this.container);

        this._injectStyles(); // Add necessary CSS
    }

    _injectStyles() {
        const styleId = 'effects-display-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .effect-icon-container {
                width: 48px;
                height: 48px;
                position: relative;
                border-radius: 8px;
                overflow: hidden;
                background: rgba(0, 0, 0, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.3);
                box-shadow: 0 2px 5px rgba(0,0,0,0.5);
                transition: opacity 0.3s ease, transform 0.3s ease;
                opacity: 0;
                transform: scale(0.5) translateY(10px);
            }
            .effect-icon-container.visible {
                opacity: 1;
                transform: scale(1) translateY(0);
            }
            .effect-icon-image {
                width: 100%;
                height: 100%;
                object-fit: contain;
                image-rendering: pixelated; /* Keep icons crisp if low-res */
            }
            .effect-cooldown-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.4); /* Reduced alpha from 0.7 to 0.4 */
                /* Using clip-path for the radial wipe */
                clip-path: polygon(50% 50%, 50% 0%, 0% 0%, 0% 100%, 100% 100%, 100% 0%); /* Default: full overlay */
                transition: clip-path 0.1s linear; /* Smooth transition for cooldown */
            }
             /* Add keyframes for the appear animation */
            @keyframes effectAppear {
                0% { opacity: 0; transform: scale(0.5) translateY(10px); }
                70% { transform: scale(1.1) translateY(-2px); }
                100% { opacity: 1; transform: scale(1) translateY(0); }
            }
        `;
        document.head.appendChild(style);
    }

    update() {
        const activeEffectsData = this.effectsManager.getActiveEffectsData();
        const activeEffectIds = new Set(activeEffectsData.map(data => data.id));

        // Remove icons for effects that are no longer active
        this.effectElements.forEach((elements, effectId) => {
            if (!activeEffectIds.has(effectId)) {
                elements.container.classList.remove('visible');
                // Remove element after transition
                setTimeout(() => {
                    if (elements.container.parentElement) {
                         elements.container.parentElement.removeChild(elements.container);
                    }
                }, 300);
                this.effectElements.delete(effectId);
            }
        });

        // Add or update icons for active effects
        activeEffectsData.forEach(async (effectData, index) => {
            const { id, effectInstance, itemId } = effectData;

            if (!itemId) {
                // console.warn(`Effect ${id} has no associated itemId, cannot display icon.`);
                return; // Cannot display without an item ID
            }

            let elements = this.effectElements.get(id);

            // Create elements if this is a new effect
            if (!elements) {
                const container = document.createElement('div');
                container.className = 'effect-icon-container';

                const iconImg = document.createElement('img');
                iconImg.className = 'effect-icon-image';
                iconImg.src = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='; // Placeholder

                const cooldownOverlay = document.createElement('div');
                cooldownOverlay.className = 'effect-cooldown-overlay';

                container.appendChild(iconImg);
                container.appendChild(cooldownOverlay);
                this.container.appendChild(container);

                elements = { container, iconImg, cooldownOverlay };
                this.effectElements.set(id, elements);

                // Fetch and set the item image
                try {
                    const dataUrl = await this.hotbar.getItemImage(itemId);
                    iconImg.src = dataUrl;
                    // Trigger appear animation
                    requestAnimationFrame(() => {
                         container.style.animation = `effectAppear 0.3s ease-out forwards`;
                         container.classList.add('visible');
                    });

                } catch (error) {
                    console.error(`EffectsDisplay: Failed to get image for item ${itemId}:`, error);
                    // Maybe remove the element or show a default error icon?
                    if (container.parentElement) {
                       container.parentElement.removeChild(container);
                    }
                    this.effectElements.delete(id);
                    return;
                }
            }

            // Update cooldown overlay
            const { startTime, duration } = effectInstance;
            let progress = 0; // 0 = full duration remaining, 1 = finished
            if (duration > 0 && startTime !== null) {
                const elapsedTime = Date.now() - startTime;
                progress = Math.min(1, elapsedTime / duration);
            }

            this.updateCooldownVisual(elements.cooldownOverlay, progress);
        });
    }

    /**
     * Updates the clip-path of the cooldown overlay element.
     * @param {HTMLElement} overlayElement The overlay div.
     * @param {number} progress Completion progress (0 to 1).
     */
    updateCooldownVisual(overlayElement, progress) {
        if (progress >= 1) {
            // Fully elapsed, hide overlay (or use 100% clip)
            overlayElement.style.clipPath = 'polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%, 50% 50%)';
            return;
        }

        const angle = progress * 360; // 0 to 360 degrees
        const rad = (angle - 90) * Math.PI / 180; // Convert to radians, offset by -90deg to start at the top

        let points = ['50% 50%']; // Start from center
        points.push('50% 0%'); // Always include the top point to start the wipe

        // Calculate points along the arc
        if (angle <= 45) {
            points.push(`${50 + 50 * Math.tan(rad + Math.PI/2)}% 0%`); // Top edge
        } else if (angle <= 135) {
            points.push('100% 0%'); // Top-right corner
            points.push(`100% ${50 + 50 * Math.tan(rad)}%`); // Right edge
        } else if (angle <= 225) {
            points.push('100% 0%');
            points.push('100% 100%'); // Bottom-right corner
            points.push(`${50 - 50 * Math.tan(rad + Math.PI/2)}% 100%`); // Bottom edge
        } else if (angle <= 315) {
            points.push('100% 0%');
            points.push('100% 100%');
            points.push('0% 100%'); // Bottom-left corner
            points.push(`0% ${50 - 50 * Math.tan(rad)}%`); // Left edge
        } else { // angle > 315
            points.push('100% 0%');
            points.push('100% 100%');
            points.push('0% 100%');
            points.push('0% 0%'); // Top-left corner
            points.push(`${50 + 50 * Math.tan(rad + Math.PI/2)}% 0%`); // Top edge again
        }

        overlayElement.style.clipPath = `polygon(${points.join(', ')})`;
    }

    dispose() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.effectElements.clear();
        // Remove styles if needed
        const styleElement = document.getElementById('effects-display-styles');
        if (styleElement && styleElement.parentNode) {
            styleElement.parentNode.removeChild(styleElement);
        }
    }
}
