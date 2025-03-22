export class HealthBar {
    constructor(character) {
        this.character = character;
        this.healthManager = character.healthManager;
        this.createHealthBarUI();
        
        // Register for health updates
        this.healthManager.registerHealthChangeCallback((currentHealth, maxHealth) => {
            this.updateHealthBar(currentHealth, maxHealth);
        });
    }
    
    createHealthBarUI() {
        // Create the main healthbar container
        this.container = document.createElement('div');
        this.container.className = 'healthbar';
        this.container.style.cssText = `
            position: fixed;
            top: 20px; /* Position at the top of the screen */
            left: 50%;
            transform: translateX(-50%);
            width: 616px; /* Match hotbar width (9 slots × 64px + 8 gaps × 4px + 2 × 4px padding) */
            height: 24px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 8px;
            z-index: 1000;
            padding: 2px;
            display: flex;
            align-items: center;
        `;
        
        // Create the health fill element
        this.healthFill = document.createElement('div');
        this.healthFill.style.cssText = `
            height: 20px;
            background: linear-gradient(to right, #ff3030, #ff5050);
            border-radius: 6px;
            width: 100%;
            transition: width 0.3s ease;
        `;
        this.container.appendChild(this.healthFill);
        
        // Create health text display
        this.healthText = document.createElement('div');
        this.healthText.style.cssText = `
            position: absolute;
            width: 100%;
            text-align: center;
            color: white;
            font-size: 12px;
            text-shadow: 1px 1px 1px black;
            font-weight: bold;
        `;
        this.container.appendChild(this.healthText);
        
        // Initialize with current health
        this.updateHealthBar(
            this.healthManager.getHealth(),
            this.healthManager.getMaxHealth()
        );
    }
    
    updateHealthBar(currentHealth, maxHealth) {
        const healthPercentage = (currentHealth / maxHealth) * 100;
        this.healthFill.style.width = `${healthPercentage}%`;
        this.healthText.textContent = `${currentHealth}/${maxHealth}`;
        
        // Update color based on health percentage
        if (healthPercentage <= 25) {
            this.healthFill.style.background = 'linear-gradient(to right, #ff0000, #ff3030)';
        } else if (healthPercentage <= 50) {
            this.healthFill.style.background = 'linear-gradient(to right, #ff7700, #ffa030)';
        } else {
            this.healthFill.style.background = 'linear-gradient(to right, rgba(32, 200, 32, 0.8), rgba(80, 220, 80, 0.7))';
        }
    }
} 