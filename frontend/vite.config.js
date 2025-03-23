import { defineConfig } from 'vite';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Get the environment mode
const environment = process.env.ENVIRONMENT || 'development';

export default defineConfig({
  // Use string replacement instead of process.env
  define: {
    // Replace __ENVIRONMENT__ with the actual environment string
    __ENVIRONMENT__: JSON.stringify(environment)
  },
  // Other Vite config options can go here
  server: {
    port: 8080,
    open: false,
    watch: {
      usePolling: true,
      useFsEvents: false
    }
  }
}); 