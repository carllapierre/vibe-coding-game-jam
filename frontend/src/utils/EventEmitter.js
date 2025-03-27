/**
 * Basic EventEmitter implementation for event-based communication
 */
export class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * Subscribe to an event
   * @param {string} event - Event name
   * @param {Function} listener - Callback function
   */
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    
    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} listener - Callback to remove
   */
  off(event, listener) {
    if (!this.events[event]) return;
    
    this.events[event] = this.events[event].filter(l => l !== listener);
    
    // Clean up empty event arrays
    if (this.events[event].length === 0) {
      delete this.events[event];
    }
  }

  /**
   * Emit an event with data
   * @param {string} event - Event name
   * @param {any} data - Data to pass to listeners
   */
  emit(event, data) {
    if (!this.events[event]) return;
    
    this.events[event].forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Subscribe to an event that will be triggered only once
   * @param {string} event - Event name
   * @param {Function} listener - Callback function
   */
  once(event, listener) {
    const onceListener = (data) => {
      listener(data);
      this.off(event, onceListener);
    };
    
    return this.on(event, onceListener);
  }

  /**
   * Remove all listeners for an event, or all events
   * @param {string} [event] - Event name (optional)
   */
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
} 