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

        // Default world data structure
        this.defaultWorldData = {
            settings: {
                modelBasePath: '/public/assets/scene/',
                scaleFactor: 3.5
            },
            objects: [],
            spawners: []
        };
    }

    async getWorldData() {
        try {
            const response = await fetch(`${this.apiHost}/api/world`);
            if (!response.ok) {
                throw new Error(`Failed to fetch world data: ${response.statusText}`);
            }
            let data = await response.json();

            // Ensure the world data has the required structure
            return {
                settings: data.settings || this.defaultWorldData.settings,
                objects: data.objects || [],
                spawners: data.spawners || []
            };
        } catch (error) {
            console.error('Error fetching world data:', error);
            // Return default world data if fetch fails
            return { ...this.defaultWorldData };
        }
    }

    async saveWorldData(worldData) {
        try {
            // Ensure the world data has the required structure before saving
            const dataToSave = {
                settings: worldData.settings || this.defaultWorldData.settings,
                objects: worldData.objects || [],
                spawners: worldData.spawners || []
            };

            console.log('Attempting to save world data:', dataToSave);

            const response = await fetch(`${this.apiHost}/api/world`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToSave, null, 4)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response not OK:', {
                    status: response.status,
                    statusText: response.statusText,
                    responseText: errorText
                });
                throw new Error(`Failed to save world data: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result = await response.json();
            console.log('Save response:', result);
            return true;
        } catch (error) {
            console.error('Error saving world data:', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
}

// Create a singleton instance
const worldManagerService = new WorldManagerService();
export default worldManagerService; 