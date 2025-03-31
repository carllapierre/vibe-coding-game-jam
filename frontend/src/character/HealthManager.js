/**
 * Set the health value
 * @param {number} health - New health value
 */
setHealth(health) {
    // Clamp health between 0 and max
    const newHealth = Math.max(0, Math.min(this.maxHealth, health));
    
    // Only update if value changed
    if (newHealth !== this.health) {
        const oldHealth = this.health;
        this.health = newHealth;
        
        // Update bar display
        if (typeof this.onHealthChanged === 'function') {
            this.onHealthChanged(this.health, oldHealth);
        }
        
        // Check if player died
        if (oldHealth > 0 && this.health <= 0) {
            if (typeof this.onDeath === 'function') {
                this.onDeath();
            }
        }
    }
    
    return this.health;
}