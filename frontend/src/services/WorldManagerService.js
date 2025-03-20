class WorldManagerService {
    constructor() {
        // Default API host
        this.apiHost = 'http://127.0.0.1:5000';
        
        // // Try to get from Vite env if available
        // try {
        //     if (import.meta.env && import.meta.env.VITE_API_HOST) {
        //         this.apiHost = import.meta.env.VITE_API_HOST;
        //     }
        // } catch (error) {
        //     console.warn('Using default API host:', this.apiHost);
        // }
    }

    async getWorldData() {
        try {
            const response = await fetch(`${this.apiHost}/api/world`);
            if (!response.ok) {
                throw new Error(`Failed to fetch world data: ${response.statusText}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching world data:', error);
            throw error;
        }
    }

    async saveWorldData(worldData) {
        try {
            const response = await fetch(`${this.apiHost}/api/world`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(worldData, null, 4)
            });

            if (!response.ok) {
                throw new Error(`Failed to save world data: ${response.statusText}`);
            }

            const result = await response.json();
            console.log(result.message);
            return true;
        } catch (error) {
            console.error('Error saving world data:', error);
            throw error;
        }
    }
}

// Create a singleton instance
const worldManagerService = new WorldManagerService();
export default worldManagerService; 