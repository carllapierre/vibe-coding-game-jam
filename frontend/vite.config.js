import { defineConfig } from 'vite';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
  // Expose environment variables to the browser
  define: {
    'process.env': process.env
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