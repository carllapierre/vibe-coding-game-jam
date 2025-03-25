/**
 * Utility to track WebGL context creation and count active contexts
 */

// Track all active WebGL contexts
const activeContexts = new Set();
let originalGetContext = HTMLCanvasElement.prototype.getContext;

// Hook into the getContext method to track WebGL context creation
export function initWebGLTracker() {
  // Only patch once
  if (HTMLCanvasElement.prototype._getContextPatched) {
    return;
  }

  // Store the original method
  HTMLCanvasElement.prototype._getContextPatched = true;
  
  // Override getContext
  HTMLCanvasElement.prototype.getContext = function(contextType, contextAttributes) {
    const ctx = originalGetContext.call(this, contextType, contextAttributes);
    
    // Track only WebGL contexts
    if (ctx && (contextType === 'webgl' || contextType === 'webgl2' || contextType === 'experimental-webgl')) {
      const id = Date.now() + '_' + Math.random().toString(36).substring(2, 10);
      
      // Store the context with a unique ID
      ctx._webglContextId = id;
      activeContexts.add(id);
      
      console.log(`WebGL context created: ${contextType} (ID: ${id}), total contexts: ${activeContexts.size}`);
      
      // Track when context is lost
      this.addEventListener('webglcontextlost', function(event) {
        console.log(`WebGL context lost: ${contextType} (ID: ${ctx._webglContextId})`);
        activeContexts.delete(ctx._webglContextId);
      }, false);
      
      // Log when context is released (may not always fire)
      ctx.addEventListener && ctx.addEventListener('dispose', function() {
        console.log(`WebGL context disposed: ${contextType} (ID: ${ctx._webglContextId})`);
        activeContexts.delete(ctx._webglContextId);
      });
    }
    
    return ctx;
  };

  console.log('WebGL context tracking initialized');
}

/**
 * Get the count of active WebGL contexts
 * @returns {number} The number of active contexts
 */
export function getActiveContextCount() {
  return activeContexts.size;
}

/**
 * Log information about active WebGL contexts
 */
export function logWebGLInfo() {
  console.log(`Active WebGL contexts: ${activeContexts.size}`);
  console.log('Context IDs:', Array.from(activeContexts));
  
  // Log additional information about WebGL capabilities
  if (typeof document !== 'undefined') {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    
    if (gl) {
      console.log('WebGL Info:');
      console.log('- Renderer:', gl.getParameter(gl.RENDERER));
      console.log('- Vendor:', gl.getParameter(gl.VENDOR));
      console.log('- Version:', gl.getParameter(gl.VERSION));
      console.log('- Shading Language Version:', gl.getParameter(gl.SHADING_LANGUAGE_VERSION));
      console.log('- Max Texture Size:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
      console.log('- Max Viewport Dimensions:', gl.getParameter(gl.MAX_VIEWPORT_DIMS));
      console.log('- Max Render Buffer Size:', gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
    }
  }
} 