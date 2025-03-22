export const addInventory = (player, collectionData) => {
    if (player.inventory) {
        // Use the new addItem method which handles stack limits
        const added = player.inventory.addItem(collectionData.itemId, collectionData.quantity);
        
        if (added) {
            console.log(`Added ${collectionData.quantity} of ${collectionData.itemId} to inventory`);
            
            // If the currently selected slot has this item, make sure the preview is updated
            const selectedSlot = player.inventory.getSelectedSlot();
            if (selectedSlot && selectedSlot.item === collectionData.itemId) {
                player.currentItem = collectionData.itemId;
                player.updatePreviewModel();
            }
        } else {
            console.log(`Couldn't add ${collectionData.itemId} to inventory - it might be full`);
        }
        
        return added;
    }
    
    return false;
}