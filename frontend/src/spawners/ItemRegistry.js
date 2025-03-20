export class ItemRegistry {
    static items = new Map();

    static registerItem(itemConfig) {
        if (!itemConfig.id) {
            throw new Error('Item must have an id');
        }
        if (this.items.has(itemConfig.id)) {
            throw new Error(`Item with id ${itemConfig.id} already exists`);
        }
        this.items.set(itemConfig.id, itemConfig);
    }

    static getItem(id) {
        return this.items.get(id);
    }

    static getAllItems() {
        return Array.from(this.items.values());
    }

    static removeItem(id) {
        this.items.delete(id);
    }
} 