export class Registry {
    static items = [];

    static getType(id) {
        return this.items.find(item => item.id === id);
    }

    static getTypeByIndex(index) {
        return this.items[index];
    }

    static getCount() {
        return this.items.length;
    }

    static registerType(item) {
        if (!item.id || !item.model || !item.scale) {
            throw new Error('Item must have id, model, and scale properties');
        }
        
        if (this.items.some(existing => existing.id === item.id)) {
            throw new Error(`Item with id ${item.id} already exists`);
        }

        this.items.push(item);
    }

    static removeType(id) {
        const index = this.items.findIndex(item => item.id === id);
        if (index !== -1) {
            this.items.splice(index, 1);
        }
    }

    static forEach(callback) {
        this.items.forEach(callback);
    }
}
