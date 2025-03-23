import { defineConfig } from 'vite';
import dotenv from 'dotenv';

// Load environment variables from .env file for local development
dotenv.config();

export default defineConfig({
  // No need to define environment variables as they're now in config.js
  server: {
    port: 8080,
    open: false,
    watch: {
      usePolling: true,
      useFsEvents: false
    }
  }
}); 