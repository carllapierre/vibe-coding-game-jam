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
} 