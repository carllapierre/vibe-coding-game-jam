export const addInventory = (player, collectionData) => {
    if (player.inventory) {
        // Find first empty slot or slot with same item
        const slot = player.inventory.slots.findIndex(slot => 
            slot.item === null || (slot.item && slot.item.id === collectionData.itemId)
        );
        
        if (slot !== -1) {
            const wasEmpty = player.inventory.slots[slot].item === null;
            
            // If slot is empty, set the item
            if (wasEmpty) {
                player.inventory.slots[slot].item = collectionData.itemId;
                player.inventory.slots[slot].amount = collectionData.quantity;
            } else {
                // Add to existing stack
                player.inventory.slots[slot].amount += collectionData.quantity;
            }

            // Notify of amount change if callback exists
            if (player.inventory.onAmountChange) {
                player.inventory.onAmountChange(slot, player.inventory.slots[slot].amount);
            }

            // If this was the selected slot, update the preview
            if (slot === player.inventory.selectedSlot) {
                player.currentItem = collectionData.itemId;
                player.updatePreviewModel();
            }
            
            // If this was the first item collected, select it
            if (wasEmpty && player.inventory.slots.every((s, i) => i === slot || s.item === null)) {
                player.inventory.selectSlot(slot);
            }
        }
    }
}