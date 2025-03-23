import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Custom saturation shader
const SaturationShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "saturation": { value: 1.3 },  // Default saturation value (1.0 is normal)
        "brightness": { value: 1.2 }   // Default brightness value (1.0 is normal)
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float saturation;
        uniform float brightness;
        varying vec2 vUv;
        
        void main() {
            vec4 texel = texture2D(tDiffuse, vUv);
            
            // Apply brightness adjustment
            vec3 brightened = texel.rgb * brightness;
            
            // Apply saturation adjustment
            float average = (brightened.r + brightened.g + brightened.b) / 3.0;
            vec3 saturated = mix(vec3(average), brightened, saturation);
            
            gl_FragColor = vec4(saturated, texel.a);
        }
    `
};

export class PostProcessingComposer {
    constructor(renderer, scene, camera, options = {}) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        // Set default values with options overrides
        this.brightness = options.brightness !== undefined ? options.brightness : 1.2;
        this.saturation = options.saturation !== undefined ? options.saturation : 1.3;
        
        // Bloom settings
        this.bloomParams = {
            strength: options.bloomStrength !== undefined ? options.bloomStrength : 0.6,
            radius: options.bloomRadius !== undefined ? options.bloomRadius : 0.5,
            threshold: options.bloomThreshold !== undefined ? options.bloomThreshold : 0.2
        };
        
        // Create composer
        this.composer = new EffectComposer(renderer);
        
        // Add render pass
        const renderPass = new RenderPass(scene, camera);
        this.composer.addPass(renderPass);
        
        // Add bloom pass
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            this.bloomParams.strength,
            this.bloomParams.radius,
            this.bloomParams.threshold
        );
        this.composer.addPass(this.bloomPass);
        
        // Add saturation and brightness pass
        this.saturationPass = new ShaderPass(SaturationShader);
        this.saturationPass.uniforms.saturation.value = this.saturation;
        this.saturationPass.uniforms.brightness.value = this.brightness;
        this.composer.addPass(this.saturationPass);
    }
    
    render() {
        this.composer.render();
    }
    
    resize(width, height) {
        this.composer.setSize(width, height);
    }
    
    // Optional: Methods to adjust effect parameters
    setBloomStrength(value) {
        this.bloomPass.strength = value;
    }
    
    setBloomRadius(value) {
        this.bloomPass.radius = value;
    }
    
    setBloomThreshold(value) {
        this.bloomPass.threshold = value;
    }
    
    setSaturation(value) {
        this.saturationPass.uniforms.saturation.value = value;
        this.saturation = value;
    }
    
    setBrightness(value) {
        this.saturationPass.uniforms.brightness.value = value;
        this.brightness = value;
    }
} 