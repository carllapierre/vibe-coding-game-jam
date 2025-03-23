# Deployment Guide

## Local Build and Deployment

1. Install dependencies:
   ```
   cd frontend && npm install
   ```

2. Build the project:
   ```
   cd frontend && npm run build
   ```
   This will:
   - Copy the world.json map from backend/data to frontend/src/data
   - Build the frontend application with Vite

3. Preview the built site locally:
   ```
   cd frontend && npm run preview
   ```

## Deploying to Netlify

### Option 1: Netlify CLI

1. Install Netlify CLI:
   ```
   npm install -g netlify-cli
   ```

2. Build the project:
   ```
   cd frontend && npm run build
   ```

3. Deploy to Netlify:
   ```
   cd frontend && netlify deploy
   ```
   Follow the prompts. Use `dist` as the publish directory when asked.

4. To deploy to production:
   ```
   cd frontend && netlify deploy --prod
   ```

### Option 2: Netlify Web Interface

1. Push your code to a Git repository (GitHub, GitLab, etc.)

2. Log in to [Netlify](https://app.netlify.com/)

3. Click "New site from Git"

4. Select your repository and configure:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `dist`

5. Click "Deploy site"

The site will be built and deployed automatically. Netlify will also rebuild and redeploy whenever you push changes to your repository. 