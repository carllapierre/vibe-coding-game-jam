export const addInventory = (player, collectionData) => {
    if (player.inventory) {
        // Use the new addItem method which handles stack limits
        const added = player.inventory.addItem(collectionData.itemId, collectionData.quantity);
        
        if (added) {
            
            // If the currently selected slot has this item, make sure the preview is updated
            const selectedSlot = player.inventory.getSelectedSlot();
            if (selectedSlot && selectedSlot.item === collectionData.itemId) {
                player.currentItem = collectionData.itemId;
                player.updatePreviewModel();
            }
        }
        return added;
    }
    
    return false;
}