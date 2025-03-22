import { inventory as inventoryConfig } from '../config.js';

export class Inventory {
    constructor() {
        this.slots = [];
        this.selectedSlot = 0;
        this.onSelectionChange = null;
        this.onAmountChange = null;
        this.initializeHotbar();
    }

    initializeHotbar() {
        // Initialize all 9 slots as empty
        for (let i = 0; i < 9; i++) {
            this.slots[i] = {
                item: null,
                amount: 0
            };
        }
    }

    selectSlot(index) {
        if (index >= 0 && index < this.slots.length) {
            this.selectedSlot = index;
            if (this.onSelectionChange) {
                const slot = this.slots[index];
                this.onSelectionChange(index, slot.item);
            }
            return true;
        }
        return false;
    }

    getSelectedSlot() {
        return this.slots[this.selectedSlot];
    }

    consumeSelectedItem() {
        const slot = this.slots[this.selectedSlot];
        if (slot.item && slot.amount > 0) {
            slot.amount--;
            
            // If we run out of items, clear the slot
            if (slot.amount === 0) {
                slot.item = null;
                if (this.onSelectionChange) {
                    this.onSelectionChange(null, null);
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
                // If this was the selected slot, notify of change
                if (index === this.selectedSlot && this.onSelectionChange) {
                    this.onSelectionChange(null, null);
                }
            }
            // Always notify of amount change
            if (this.onAmountChange) {
                this.onAmountChange(index, this.slots[index].amount);
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

    // New method to add an item to inventory respecting stack limit
    addItem(itemId, quantity) {
        if (!itemId || quantity <= 0) return false;
        
        console.log(`Adding ${quantity} of ${itemId} to inventory`);
        
        // First try to add to existing stacks
        let remainingQuantity = quantity;
        let itemAdded = false;
        
        // First pass: fill existing stacks of the same item
        for (let i = 0; i < this.slots.length && remainingQuantity > 0; i++) {
            const slot = this.slots[i];
            
            if (slot.item === itemId && slot.amount < inventoryConfig.stackLimit) {
                // Calculate how much we can add to this slot
                const spaceAvailable = inventoryConfig.stackLimit - slot.amount;
                const amountToAdd = Math.min(spaceAvailable, remainingQuantity);
                
                // Add to this slot
                slot.amount += amountToAdd;
                remainingQuantity -= amountToAdd;
                itemAdded = true;
                
                // Notify UI about the amount change
                if (this.onAmountChange) {
                    this.onAmountChange(i, slot.amount);
                }
                
                console.log(`Added ${amountToAdd} to existing stack in slot ${i}, stack now ${slot.amount}`);
            }
        }
        
        // Second pass: place in empty slots if we still have remaining quantity
        if (remainingQuantity > 0) {
            for (let i = 0; i < this.slots.length && remainingQuantity > 0; i++) {
                const slot = this.slots[i];
                
                if (slot.item === null) {
                    // Calculate how much to put in this slot
                    const amountToAdd = Math.min(inventoryConfig.stackLimit, remainingQuantity);
                    
                    // Fill this slot
                    slot.item = itemId;
                    slot.amount = amountToAdd;
                    remainingQuantity -= amountToAdd;
                    itemAdded = true;
                    
                    // If this is the first item in inventory, select it
                    if (this.slots.every((s, index) => index === i || !s.item)) {
                        this.selectSlot(i);
                    }
                    
                    // Notify UI about the change
                    if (this.onAmountChange) {
                        this.onAmountChange(i, slot.amount);
                    }
                    
                    console.log(`Added ${amountToAdd} to new stack in slot ${i}`);
                }
            }
        }
        
        // Return true if we added any items, false if inventory was full
        return itemAdded;
    }
} 