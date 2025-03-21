
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
} 