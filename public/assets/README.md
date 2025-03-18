# Assets Directory Structure

This directory contains all the static assets for the Three.js FPS sandbox project.

## Directory Structure

```
assets/
├── objects/     # 3D models for interactive objects and props
├── characters/  # Character models, animations, and related assets
└── scene/       # Environment assets like textures, skyboxes, and terrain
```

## Usage Guidelines

### objects/
- Place 3D models for interactive objects (e.g., weapons, items, props)
- Supported formats: .glb, .gltf, .obj, .fbx
- Include any associated textures and materials
- Recommended to keep file sizes optimized for web use

### characters/
- Store character models and their animations
- Include rigged models and animation files
- Place character-specific textures and materials
- Consider organizing by character type or role

### scene/
- Environment textures and materials
- Skybox assets
- Terrain data
- Lighting maps
- Post-processing effects

## File Naming Conventions

- Use lowercase letters
- Separate words with hyphens
- Include version numbers if applicable
- Example: `player-character-v1.glb`

## Asset Optimization

- Compress textures when possible
- Optimize 3D models for web use
- Keep file sizes reasonable for quick loading
- Consider using texture atlases for better performance 