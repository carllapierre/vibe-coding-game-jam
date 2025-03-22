import { Registry } from '../core/Registry.js';

export class SpawnerRegistry extends Registry {
    
    static items = [
        { id: 'boosts-1', cooldown: 10000, items: ['cup-coffee', 'carrot'],  },
        { id: 'bakery-1', cooldown: 10000, items: ['loaf', 'loaf-baguette', 'loaf-round', 'muffin', 'pancakes', 'mincemeat-pie', 'waffle'] },
        { id: 'bottles-1', cooldown: 5000, items: ['wine-white', 'wine-red', 'soda-can', 'soda-bottle'] },
        { id: 'meat-1', cooldown: 5000, items: ['burger-cheese-double', 'turkey', 'whole-ham'] },
        { id: 'miscellaneous-1', cooldown: 5000, items: ['pizza', 'salad', 'watermelon', 'hot-dog', 'sub'] },
        { id: 'debuffs-1', cooldown: 20000, items: ['peanut-butter', 'honey'] },
    ];

}
