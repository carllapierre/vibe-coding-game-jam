export const consumeItem = (player, item) => {
    if (!player || !item) return false;
    
    // Add health to player - ensure it works by using default value if hpBonus is undefined
    if (player.healthManager) {
        const hpBonus = item.hpBonus !== undefined ? item.hpBonus : 100;
        player.healthManager.addHealth(hpBonus);
    }
    
    // Start consume animation
    player.isConsumeAnimating = true;
    player.consumeAnimationStartTime = Date.now();
    
    // Remove item from inventory
    if (player.inventory) {
        const consumed = player.inventory.consumeSelectedItem();
        
        // Update preview model if needed
        if (consumed) {
            // Check if we still have items in the current slot
            const currentSlot = player.inventory.getSelectedSlot();
            if (currentSlot && currentSlot.item) {
                player.updatePreviewModel();
            } else {
                player.clearPreviewModel();
            }
        }
        
        return consumed;
    }
    
    return false;
} 