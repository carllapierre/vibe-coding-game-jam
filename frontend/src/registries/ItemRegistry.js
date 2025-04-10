import { Registry } from '../core/Registry.js';

export class ItemRegistry extends Registry {

    static items = [
        // Meats
        { id: 'turkey', model: 'turkey.glb', scale: 0.6, damage: 25 },
        { id: 'meat-cooked', model: 'meat-cooked.glb', scale: 0.7, damage: 20 },
        { id: 'meat-patty', model: 'meat-patty.glb', scale: 0.6, damage: 18 },
        { id: 'meat-raw', model: 'meat-raw.glb', scale: 0.6, damage: 15 },
        { id: 'meat-ribs', model: 'meat-ribs.glb', scale: 0.8, damage: 23 },
        { id: 'meat-sausage', model: 'meat-sausage.glb', scale: 0.7, damage: 17 },
        { id: 'sausage', model: 'sausage.glb', scale: 1.1, damage: 16 },
        { id: 'sausage-half', model: 'sausage-half.glb', scale: 0.6, damage: 10 },
        { id: 'whole-ham', model: 'whole-ham.glb', scale: 0.7, damage: 24 },
        { id: 'bacon-raw', model: 'bacon-raw.glb', scale: 0.6, damage: 14 },
        { id: 'beef-raw', model: 'beef-raw.glb', scale: 0.6, damage: 16 },
        { id: 'burger-cheese-double', model: 'burger-cheese-double.glb', scale: 0.6, damage: 22 },

        // Breads and Baked Goods
        { id: 'loaf-baguette', model: 'loaf-baguette.glb', scale: 0.6, damage: 15 },
        { id: 'loaf-round', model: 'loaf-round.glb', scale: 0.6, damage: 12 },
        { id: 'loaf', model: 'loaf.glb', scale: 0.6, damage: 14 },
        { id: 'muffin', model: 'muffin.glb', scale: 0.5, damage: 10 },
        { id: 'pancakes', model: 'pancakes.glb', scale: 0.6, damage: 13 },
        { id: 'pie', model: 'pie.glb', scale: 0.6, damage: 18 },
        { id: 'mincemeat-pie', model: 'mincemeat-pie.glb', scale: 0.6, damage: 20 },
        { id: 'waffle', model: 'waffle.glb', scale: 0.6, damage: 12 },
        { id: 'donut', model: 'donut.glb', scale: 0.6, damage: 11 },
        { id: 'donut-sprinkles', model: 'donut-sprinkles.glb', scale: 1.5, damage: 14 },

        // Fruits and Vegetables
        { id: 'tomato', model: 'tomato.glb', scale: 0.5, damage: 10 },
        { id: 'tomato-slice', model: 'tomato-slice.glb', scale: 0.5, damage: 5 },
        { id: 'watermelon', model: 'watermelon.glb', scale: 0.7, damage: 25 },
        { id: 'strawberry', model: 'strawberry.glb', scale: 0.4, damage: 8 },
        { id: 'pumpkin', model: 'pumpkin.glb', scale: 1, damage: 22 },
        { id: 'pumpkin-basic', model: 'pumpkin-basic.glb', scale: 0.6, damage: 22 },
        { id: 'pineapple', model: 'pineapple.glb', scale: 1, damage: 20 },
        { id: 'pear', model: 'pear.glb', scale: 0.5, damage: 12 },
        { id: 'pear-half', model: 'pear-half.glb', scale: 0.5, damage: 6 },
        { id: 'orange', model: 'orange.glb', scale: 0.5, damage: 12 },
        { id: 'onion', model: 'onion.glb', scale: 0.5, damage: 9 },
        { id: 'onion-half', model: 'onion-half.glb', scale: 0.5, damage: 5 },
        { id: 'mushroom', model: 'mushroom.glb', scale: 0.4, damage: 8 },
        { id: 'mushroom-half', model: 'mushroom-half.glb', scale: 0.4, damage: 4 },
        { id: 'paprika', model: 'paprika.glb', scale: 0.5, damage: 10 },
        { id: 'paprika-slice', model: 'paprika-slice.glb', scale: 0.5, damage: 5 },
        { id: 'radish', model: 'radish.glb', scale: 0.4, damage: 7 },
        { id: 'carrot', model: 'carrot.glb', scale: 0.8, damage: 15 },
        
        // Prepared Foods
        { id: 'pizza', model: 'pizza.glb', scale: 0.7, damage: 22 },
        { id: 'hot-dog', model: 'hot-dog.glb', scale: 1, damage: 17 },
        { id: 'sandwich', model: 'sandwich.glb', scale: 0.6, damage: 16 },
        { id: 'salad', model: 'salad.glb', scale: 0.6, damage: 12 },
        { id: 'sub', model: 'sub.glb', scale: 0.7, damage: 18 },
        { id: 'taco', model: 'taco.glb', scale: 1.1, damage: 15 },
        { id: 'rice-ball', model: 'rice-ball.glb', scale: 0.5, damage: 9 },

        // Sushi and Seafood
        { id: 'sushi-salmon', model: 'sushi-salmon.glb', scale: 0.5, damage: 12 },
        { id: 'sushi-egg', model: 'sushi-egg.glb', scale: 0.5, damage: 11 },
        { id: 'maki-roe', model: 'maki-roe.glb', scale: 0.5, damage: 10 },
        { id: 'maki-salmon', model: 'maki-salmon.glb', scale: 0.5, damage: 11 },
        { id: 'maki-vegetable', model: 'maki-vegetable.glb', scale: 0.5, damage: 9 },
        { id: 'mussel', model: 'mussel.glb', scale: 0.4, damage: 8 },
        { id: 'mussel-open', model: 'mussel-open.glb', scale: 0.4, damage: 9 },

        // Desserts and Sweets
        { id: 'ice-cream', model: 'ice-cream.glb', scale: 0.9, damage: 14 },
        { id: 'ice-cream-scoop-mint', model: 'ice-cream-scoop-mint.glb', scale: 0.4, damage: 9 },
        { id: 'sundae', model: 'sundae.glb', scale: 0.5, damage: 16 },
        { id: 'pudding', model: 'pudding.glb', scale: 0.5, damage: 12 },
        { id: 'lollypop', model: 'lollypop.glb', scale: 0.5, damage: 8 },
        { id: 'popsicle', model: 'popsicle.glb', scale: 1, damage: 11 },
        { id: 'popsicle-chocolate', model: 'popsicle-chocolate.glb', scale: 0.5, damage: 10 },
        { id: 'whipped-cream', model: 'whipped-cream.glb', scale: 0.5, damage: 7 },
        { id: 'honey', model: 'honey.glb', scale: 0.5, damage: 8 },
        { id: 'peanut-butter', model: 'peanut-butter.glb', scale: 0.5, damage: 9 },
        { id: 'cake', model: 'cake.glb', scale: 1, damage: 30 },
        // Beverages
        { id: 'wine-red', model: 'wine-red.glb', scale: 0.8, damage: 18 },
        { id: 'wine-white', model: 'wine-white.glb', scale: 0.8, damage: 17 },
        { id: 'soda', model: 'soda.glb', scale: 0.6, damage: 13 },
        { id: 'soda-bottle', model: 'soda-bottle.glb', scale: 0.7, damage: 16 },
        { id: 'soda-can', model: 'soda-can.glb', scale: 0.5, damage: 10 },
        { id: 'soda-glass', model: 'soda-glass.glb', scale: 0.6, damage: 12 },
        { id: 'cup-coffee', model: 'cup-coffee.glb', scale: 1, damage: 15, effect: { id: 'speed', duration: 5000, config: { multiplier: 1.8 } } },
        { id: 'beer-barrel', model: 'barrel.glb', scale: 0.8, damage: 50 },

        // Condiments
        { id: 'soy', model: 'soy.glb', scale: 0.5, damage: 8 },
        { id: 'shaker-pepper', model: 'shaker-pepper.glb', scale: 0.5, damage: 9 },
        { id: 'shaker-salt', model: 'shaker-salt.glb', scale: 0.5, damage: 9 },

        // Non-edible items (non-consumable)
        { id: 'pizza-box', model: 'pizza-box.glb', scale: 0.5, isConsumable: false, damage: 5 },
        { id: 'plate-deep', model: 'plate-deep.glb', scale: 0.5, isConsumable: false, damage: 5 },
        { id: 'utensil-fork', model: 'utensil-fork.glb', scale: 0.5, isConsumable: false, damage: 6 },
        { id: 'utensil-spoon', model: 'utensil-spoon.glb', scale: 0.5, isConsumable: false, damage: 10 },
        { id: 'utensil-knife', model: 'utensil-knife.glb', scale: 0.5, isConsumable: false, damage: 18 },
    ];
    
    /**
     * Update or add properties for specific items
     * @param {Array<string>} itemIds - Array of item IDs to update
     * @param {Object} properties - Properties to apply to the items
     */
    static updateItemProperties(itemIds, properties) {
        itemIds.forEach(id => {
            const item = this.items.find(item => item.id === id);
            if (item) {
                Object.assign(item, properties);
            }
        });
    }
}
