export class ItemConfig {
    constructor({
        id,
        name,
        modelPath,
        spawnableTypeId = 'food',
        amount = 1,
        onCollect = null,
        properties = {},
        visualConfig = {}
    }) {
        this.id = id;
        this.name = name;
        this.modelPath = modelPath;
        this.spawnableTypeId = spawnableTypeId;
        this.amount = amount;
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
    static createInventoryItem(id, name, modelPath, amount = 1) {
        return new ItemConfig({
            id,
            name,
            modelPath,
            amount,
            onCollect: (player) => {
                player.addToInventory(id, amount);
            }
        });
    }
} 