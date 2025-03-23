import { Registry } from '../core/Registry.js';

export class ItemRegistry extends Registry {

    static items = [
        // Meats
        { id: 'turkey', model: 'turkey.glb', scale: 0.6, },
        { id: 'meat-cooked', model: 'meat-cooked.glb', scale: 0.7 },
        { id: 'meat-patty', model: 'meat-patty.glb', scale: 0.6 },
        { id: 'meat-raw', model: 'meat-raw.glb', scale: 0.6 },
        { id: 'meat-ribs', model: 'meat-ribs.glb', scale: 0.8 },
        { id: 'meat-sausage', model: 'meat-sausage.glb', scale: 0.7 },
        { id: 'sausage', model: 'sausage.glb', scale: 0.6 },
        { id: 'sausage-half', model: 'sausage-half.glb', scale: 0.6 },
        { id: 'whole-ham', model: 'whole-ham.glb', scale: 0.7 },
        { id: 'bacon-raw', model: 'bacon-raw.glb', scale: 0.6 },
        { id: 'beef-raw', model: 'beef-raw.glb', scale: 0.6 },
        { id: 'burger-cheese-double', model: 'burger-cheese-double.glb', scale: 0.6 },

        // Breads and Baked Goods
        { id: 'loaf-baguette', model: 'loaf-baguette.glb', scale: 0.6 },
        { id: 'loaf-round', model: 'loaf-round.glb', scale: 0.6 },
        { id: 'loaf', model: 'loaf.glb', scale: 0.6 },
        { id: 'muffin', model: 'muffin.glb', scale: 0.5 },
        { id: 'pancakes', model: 'pancakes.glb', scale: 0.6 },
        { id: 'pie', model: 'pie.glb', scale: 0.6 },
        { id: 'mincemeat-pie', model: 'mincemeat-pie.glb', scale: 0.6 },
        { id: 'waffle', model: 'waffle.glb', scale: 0.6 },

        // Fruits and Vegetables
        { id: 'tomato', model: 'tomato.glb', scale: 0.5 },
        { id: 'tomato-slice', model: 'tomato-slice.glb', scale: 0.5 },
        { id: 'watermelon', model: 'watermelon.glb', scale: 0.7 },
        { id: 'strawberry', model: 'strawberry.glb', scale: 0.4 },
        { id: 'pumpkin', model: 'pumpkin.glb', scale: 0.6 },
        { id: 'pumpkin-basic', model: 'pumpkin-basic.glb', scale: 0.6 },
        { id: 'pineapple', model: 'pineapple.glb', scale: 0.6 },
        { id: 'pear', model: 'pear.glb', scale: 0.5 },
        { id: 'pear-half', model: 'pear-half.glb', scale: 0.5 },
        { id: 'orange', model: 'orange.glb', scale: 0.5 },
        { id: 'onion', model: 'onion.glb', scale: 0.5 },
        { id: 'onion-half', model: 'onion-half.glb', scale: 0.5 },
        { id: 'mushroom', model: 'mushroom.glb', scale: 0.4 },
        { id: 'mushroom-half', model: 'mushroom-half.glb', scale: 0.4 },
        { id: 'paprika', model: 'paprika.glb', scale: 0.5 },
        { id: 'paprika-slice', model: 'paprika-slice.glb', scale: 0.5 },
        { id: 'radish', model: 'radish.glb', scale: 0.4 },
        { id: 'carrot', model: 'carrot.glb', scale: 0.8 },
        // Prepared Foods
        { id: 'pizza', model: 'pizza.glb', scale: 0.7 },
        { id: 'hot-dog', model: 'hot-dog.glb', scale: 1 },
        { id: 'sandwich', model: 'sandwich.glb', scale: 0.6 },
        { id: 'salad', model: 'salad.glb', scale: 0.6 },
        { id: 'sub', model: 'sub.glb', scale: 0.7 },
        { id: 'taco', model: 'taco.glb', scale: 0.6 },
        { id: 'rice-ball', model: 'rice-ball.glb', scale: 0.5 },

        // Sushi and Seafood
        { id: 'sushi-salmon', model: 'sushi-salmon.glb', scale: 0.5 },
        { id: 'sushi-egg', model: 'sushi-egg.glb', scale: 0.5 },
        { id: 'maki-roe', model: 'maki-roe.glb', scale: 0.5 },
        { id: 'maki-salmon', model: 'maki-salmon.glb', scale: 0.5 },
        { id: 'maki-vegetable', model: 'maki-vegetable.glb', scale: 0.5 },
        { id: 'mussel', model: 'mussel.glb', scale: 0.4 },
        { id: 'mussel-open', model: 'mussel-open.glb', scale: 0.4 },

        // Desserts and Sweets
        { id: 'ice-cream', model: 'ice-cream.glb', scale: 0.5 },
        { id: 'ice-cream-scoop-mint', model: 'ice-cream-scoop-mint.glb', scale: 0.4 },
        { id: 'sundae', model: 'sundae.glb', scale: 0.5 },
        { id: 'pudding', model: 'pudding.glb', scale: 0.5 },
        { id: 'lollypop', model: 'lollypop.glb', scale: 0.5 },
        { id: 'popsicle', model: 'popsicle.glb', scale: 0.5 },
        { id: 'popsicle-chocolate', model: 'popsicle-chocolate.glb', scale: 0.5 },
        { id: 'whipped-cream', model: 'whipped-cream.glb', scale: 0.5 },
        { id: 'honey', model: 'honey.glb', scale: 0.5 },
        { id: 'peanut-butter', model: 'peanut-butter.glb', scale: 0.5 },

        // Beverages
        { id: 'wine-red', model: 'wine-red.glb', scale: 0.8 },
        { id: 'wine-white', model: 'wine-white.glb', scale: 0.8 },
        { id: 'soda', model: 'soda.glb', scale: 0.6 },
        { id: 'soda-bottle', model: 'soda-bottle.glb', scale: 0.7 },
        { id: 'soda-can', model: 'soda-can.glb', scale: 0.5 },
        { id: 'soda-glass', model: 'soda-glass.glb', scale: 0.6 },
        { id: 'cup-coffee', model: 'cup-coffee.glb', scale: 1 },

        // Condiments
        { id: 'soy', model: 'soy.glb', scale: 0.5 },
        { id: 'peanut-butter', model: 'peanut-butter.glb', scale: 0.5 },
        { id: 'shaker-pepper', model: 'shaker-pepper.glb', scale: 0.5 },
        { id: 'shaker-salt', model: 'shaker-salt.glb', scale: 0.5 },


        // Non-edible items
        { id: 'pizza-box', model: 'pizza-box.glb', scale: 0.5 },
        { id: 'plate-deep', model: 'plate-deep.glb', scale: 0.5 },
        { id: 'utensil-fork', model: 'utensil-fork.glb', scale: 0.5 },
        { id: 'utensil-spoon', model: 'utensil-spoon.glb', scale: 0.5 },
        { id: 'utensil-knife', model: 'utensil-knife.glb', scale: 0.5 },

    ];
}
