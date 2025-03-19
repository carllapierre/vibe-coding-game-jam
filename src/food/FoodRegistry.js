export class FoodRegistry {
    static foodTypes = [
        { 
            id: 'turkey',
            model: 'turkey.glb', 
            scale: 0.6,
            // Add more properties as needed, like:
            // damage: 10,
            // speed: 0.5,
            // effects: ['splat', 'stain']
        },
        { 
            id: 'burger-cheese-double',
            model: 'burger-cheese-double.glb', 
            scale: 0.7 
        },
        { 
            id: 'loaf-baguette',
            model: 'loaf-baguette.glb', 
            scale: 0.6 
        },
        { 
            id: 'meat-ribs',
            model: 'meat-ribs.glb', 
            scale: 0.8 
        },
        { 
            id: 'pizza',
            model: 'pizza.glb', 
            scale: 0.7 
        },
        { 
            id: 'wine-red',
            model: 'wine-red.glb', 
            scale: 0.8 
        }
    ];

    static getFoodType(id) {
        return this.foodTypes.find(food => food.id === id);
    }

    static getFoodTypeByIndex(index) {
        return this.foodTypes[index];
    }

    static getFoodCount() {
        return this.foodTypes.length;
    }

    static registerFoodType(foodType) {
        if (!foodType.id || !foodType.model || !foodType.scale) {
            throw new Error('Food type must have id, model, and scale properties');
        }
        
        // Check for duplicate id
        if (this.foodTypes.some(food => food.id === foodType.id)) {
            throw new Error(`Food type with id ${foodType.id} already exists`);
        }

        this.foodTypes.push(foodType);
    }

    static removeFoodType(id) {
        const index = this.foodTypes.findIndex(food => food.id === id);
        if (index !== -1) {
            this.foodTypes.splice(index, 1);
        }
    }
} 