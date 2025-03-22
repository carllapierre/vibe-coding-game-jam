import * as THREE from 'three';

/**
 * Creates a text sprite for 3D labels
 * @param {string} message - The text to display
 * @param {Object} parameters - Configuration options
 * @returns {THREE.Sprite} Text sprite
 */
export function createTextSprite(message, parameters = {}) {
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
    roundRect(context, borderThickness/2, borderThickness/2, 
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

/**
 * Helper function to draw rounded rectangles
 */
export function roundRect(ctx, x, y, width, height, radius) {
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

/**
 * Shows a temporary feedback notification
 * @param {HTMLElement} element - The notification element
 * @param {string} message - Message to display
 * @param {string} bgColor - Background color in rgba format
 * @param {number} duration - Duration in milliseconds
 */
export function showFeedback(element, message, bgColor = 'rgba(0, 255, 0, 0.7)', duration = 1500) {
    element.textContent = message;
    element.style.background = bgColor;
    element.style.display = 'block';
    element.style.opacity = '1';
    
    setTimeout(() => {
        element.style.opacity = '0';
        setTimeout(() => {
            element.style.display = 'none';
        }, 300); // Wait for fade out animation
    }, duration);
}

/**
 * Creates a styled UI button
 * @param {string} text - Button text
 * @param {Function} onClick - Click handler
 * @param {Object} styles - Optional additional styles
 * @returns {HTMLButtonElement} The created button
 */
export function createButton(text, onClick, styles = {}) {
    const button = document.createElement('button');
    button.textContent = text;
    button.addEventListener('click', onClick);
    
    // Default styles
    const defaultStyles = {
        padding: '8px 12px',
        margin: '5px',
        borderRadius: '4px',
        border: 'none',
        background: '#444',
        color: '#fff',
        cursor: 'pointer',
        fontFamily: 'Arial, sans-serif',
        fontSize: '14px'
    };
    
    // Apply default and custom styles
    Object.assign(button.style, defaultStyles, styles);
    
    return button;
} 