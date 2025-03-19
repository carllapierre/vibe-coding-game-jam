import { FoodRegistry } from '../food/FoodRegistry.js';

export class Inventory {
    constructor() {
        this.slots = [];
        this.selectedSlot = 0;
        this.onSelectionChange = null;
        this.onAmountChange = null;
        this.initializeHotbar();
    }

    initializeHotbar() {
        // Initialize all 9 slots
        const foodCount = FoodRegistry.getFoodCount();
        for (let i = 0; i < 9; i++) {
            if (i < foodCount) {
                // Fill with available food items
                const foodType = FoodRegistry.getFoodTypeByIndex(i);
                this.slots[i] = {
                    item: foodType,
                    amount: 5
                };
            } else {
                // Empty slots
                this.slots[i] = {
                    item: null,
                    amount: 0
                };
            }
        }
    }

    selectSlot(index) {
        if (index >= 0 && index < this.slots.length) {
            this.selectedSlot = index;
            if (this.onSelectionChange) {
                // Pass null for empty slots, otherwise pass the index
                this.onSelectionChange(this.slots[index].item ? index : null);
            }
            return true;
        }
        return false;
    }

    consumeSelectedItem() {
        const slot = this.slots[this.selectedSlot];
        if (slot.item && slot.amount > 0) {
            slot.amount--;
            
            // If we run out of items, clear the slot
            if (slot.amount === 0) {
                slot.item = null;
                if (this.onSelectionChange) {
                    this.onSelectionChange(null);
                }
            }

            // Notify UI to update
            if (this.onAmountChange) {
                this.onAmountChange(this.selectedSlot, slot.amount);
            }
            
            return true;
        }
        return false;
    }

    scrollHotbar(direction) {
        // direction: 1 for right, -1 for left
        const newSlot = (this.selectedSlot + direction + this.slots.length) % this.slots.length;
        this.selectSlot(newSlot);
    }

    getSelectedSlot() {
        return {
            index: this.selectedSlot,
            ...this.slots[this.selectedSlot]
        };
    }

    getSlot(index) {
        if (index >= 0 && index < this.slots.length) {
            return this.slots[index];
        }
        return null;
    }

    setAmount(index, amount) {
        if (index >= 0 && index < this.slots.length) {
            this.slots[index].amount = Math.max(0, amount);
            if (this.slots[index].amount === 0) {
                this.slots[index].item = null;
            }
        }
    }

    getAllSlots() {
        return this.slots;
    }

    // Add a new callback for amount changes
    setAmountChangeCallback(callback) {
        this.onAmountChange = callback;
    }
} 