export class ItemConfig {
    constructor({
        id,
        name,
        modelPath,
        spawnableTypeId = 'food',
        quantity = 1,
        onCollect = null,
        properties = {},
        visualConfig = {}
    }) {
        this.id = id;
        this.name = name;
        this.modelPath = modelPath;
        this.spawnableTypeId = spawnableTypeId;
        this.quantity = quantity;
        this.onCollect = onCollect;
        this.properties = properties;
        this.visualConfig = visualConfig;
    }

    // Helper method to create a buff item
    static createBuffItem(id, name, modelPath, buffType, duration, strength) {
        return new ItemConfig({
            id,
            name,
            modelPath,
            onCollect: (player) => {
                player.addBuff(buffType, duration, strength);
            }
        });
    }

    // Helper method to create an inventory item
    static createInventoryItem(id, name, modelPath, quantity = 1) {
        return new ItemConfig({
            id,
            name,
            modelPath,
            quantity,
            onCollect: (player, collectionData) => {
                if (player.inventory) {
                    // Find first empty slot or slot with same item
                    const slot = player.inventory.slots.findIndex(slot => 
                        slot.item === null || (slot.item && slot.item.id === id)
                    );
                    
                    if (slot !== -1) {
                        const foodItem = FoodRegistry.getFoodType(id);
                        if (!foodItem) {
                            console.error(`Food item ${id} not found in registry`);
                            return;
                        }

                        // If slot is empty, set the item
                        if (player.inventory.slots[slot].item === null) {
                            player.inventory.slots[slot].item = foodItem;
                            player.inventory.slots[slot].amount = collectionData.quantity;
                        } else {
                            // Add to existing stack
                            player.inventory.slots[slot].amount += collectionData.quantity;
                        }

                        // Notify of amount change if callback exists
                        if (player.inventory.onAmountChange) {
                            player.inventory.onAmountChange(slot, player.inventory.slots[slot].amount);
                        }

                        // If this is the only item in inventory, select it
                        if (player.inventory.slots.every((s, i) => i === slot || s.item === null)) {
                            player.inventory.selectSlot(slot);
                        }
                    }
                }
            }
        });
    }
} 