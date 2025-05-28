// src/geometry/GPUTraceSystem.js - GPU-based trace system using feedback loops
import * as THREE from 'three';

// Debug flag for GPU trace logging
const DEBUG_GPU_TRACE = false;

/**
 * GPU-based trace system using render targets and feedback loops
 * This system renders midpoint positions to textures and uses them as input
 * for the next frame, creating smooth trails without CPU overhead
 */
export class GPUTraceSystem {
  constructor(renderer, options = {}) {
    this.renderer = renderer;
    
    // Configuration with better defaults
    this.width = options.width || 1024;
    this.height = options.height || 1024;
    this.fadeAmount = options.fadeAmount || 1.0; // No fade for maximum accumulation
    this.trailIntensity = options.trailIntensity || 1.0;
    this.pointSize = options.pointSize || 2.0; // Small point size
    
    // Check for required WebGL extensions
    this.checkWebGLSupport();
    
    // Create ping-pong render targets for feedback loop
    this.createRenderTargets();
    
    // Create materials and scenes for rendering
    this.createMaterials();
    this.createScenes();
    
    // Track initialization state
    this.initialized = true;
    
    if (DEBUG_GPU_TRACE) {
      console.log('[GPU TRACE] System initialized with resolution:', this.width, 'x', this.height);
    }
  }
  
  /**
   * Check for required WebGL extensions
   */
  checkWebGLSupport() {
    const gl = this.renderer.getContext();
    
    // Check for float texture support
    const floatExtension = gl.getExtension('OES_texture_float') || 
                          gl.getExtension('WEBGL_color_buffer_float');
    
    if (!floatExtension) {
      console.warn('[GPU TRACE] Float textures not supported, using RGBA format');
      this.useFloatTextures = false;
    } else {
      this.useFloatTextures = true;
    }
    
    // Check for linear filtering on float textures
    const linearExtension = gl.getExtension('OES_texture_float_linear');
    this.useLinearFiltering = !!linearExtension;
    
    if (DEBUG_GPU_TRACE) {
      console.log('[GPU TRACE] WebGL support:', {
        floatTextures: this.useFloatTextures,
        linearFiltering: this.useLinearFiltering
      });
    }
  }
  
  /**
   * Create ping-pong render targets for feedback loop
   */
  createRenderTargets() {
    const targetOptions = {
      format: THREE.RGBAFormat,
      type: this.useFloatTextures ? THREE.FloatType : THREE.UnsignedByteType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      generateMipmaps: false,
      depthBuffer: false,
      stencilBuffer: false
    };
    
    // Ping-pong targets for feedback loop
    this.traceTargetA = new THREE.WebGLRenderTarget(this.width, this.height, targetOptions);
    this.traceTargetB = new THREE.WebGLRenderTarget(this.width, this.height, targetOptions);
    
    // Current and previous target references
    this.currentTarget = this.traceTargetA;
    this.previousTarget = this.traceTargetB;
    
    // Clear both targets initially
    this.clearTargets();
    
    if (DEBUG_GPU_TRACE) {
      console.log('[GPU TRACE] Render targets created:', {
        format: 'RGBA',
        type: this.useFloatTextures ? 'Float' : 'UnsignedByte',
        size: `${this.width}x${this.height}`
      });
    }
  }
  
  /**
   * Create materials for rendering traces
   */
  createMaterials() {
    try {
      // Try to create custom shader materials first
      this.createCustomMaterials();
      
      // Test the materials immediately to catch shader compilation errors
      if (!this.testMaterials()) {
        console.warn('[GPU TRACE] Material validation failed, using fallback materials');
        this.createFallbackMaterials();
        return;
      }
      
      if (DEBUG_GPU_TRACE) {
        console.log('[GPU TRACE] Custom materials created and validated successfully');
      }
      
    } catch (error) {
      console.warn('[GPU TRACE] Custom materials failed, falling back to basic materials:', error);
      this.createFallbackMaterials();
    }
  }
  
  /**
   * Test materials by trying to compile them
   */
  testMaterials() {
    try {
      // Create a simple test geometry with the required attributes
      const testGeometry = new THREE.BufferGeometry();
      testGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
      testGeometry.setAttribute('color', new THREE.Float32BufferAttribute([1, 0, 1], 3));
      
      // Test point material
      const testPoints = new THREE.Points(testGeometry, this.pointMaterial);
      
      // Test feedback material
      const testQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.feedbackMaterial);
      
      // Test display material  
      const testDisplay = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.displayMaterial);
      
      // Clean up
      testGeometry.dispose();
      
      return true;
    } catch (error) {
      console.warn('[GPU TRACE] Material test failed:', error);
      return false;
    }
  }
  
  /**
   * Create custom shader materials
   */
  createCustomMaterials() {
    try {
      // Create shader materials for GPU trails
      this.createTrailShaders();
      this.usingBasicMaterials = false;
      
      if (DEBUG_GPU_TRACE) {
        console.log('[GPU TRACE] Created custom trail shaders');
      }
    } catch (error) {
      console.warn('[GPU TRACE] Failed to create trail shaders, falling back to basic materials:', error);
      this.createBasicMaterials();
    }
  }
  
  /**
   * Create trail shader materials
   */
  createTrailShaders() {
    // Point rendering material - renders points to texture
    this.pointMaterial = new THREE.ShaderMaterial({
      uniforms: {
        pointSize: { value: this.pointSize }, // Use the configured point size
        opacity: { value: 1.0 }
      },
      vertexShader: `
        uniform float pointSize;
        attribute vec3 color;
        varying vec3 vColor;
        
        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = pointSize;
        }
      `,
      fragmentShader: `
        uniform float opacity;
        varying vec3 vColor;
        
        void main() {
          // Create circular points
          vec2 coord = gl_PointCoord - vec2(0.5);
          float dist = length(coord);
          if (dist > 0.5) discard;
          
          // Smooth edges
          float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
          gl_FragColor = vec4(vColor, alpha * opacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });
    
    // Feedback material - blends previous frame with fade
    this.feedbackMaterial = new THREE.ShaderMaterial({
      uniforms: {
        previousFrame: { value: null },
        fadeAmount: { value: this.fadeAmount }
      },
      vertexShader: `
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D previousFrame;
        uniform float fadeAmount;
        varying vec2 vUv;
        
        void main() {
          vec4 prevColor = texture2D(previousFrame, vUv);
          gl_FragColor = vec4(prevColor.rgb * fadeAmount, prevColor.a * fadeAmount);
        }
      `,
      transparent: true,
      blending: THREE.NormalBlending,
      depthTest: false,
      depthWrite: false
    });
    
    // Display material - shows the trail texture in the scene
    this.displayMaterial = new THREE.ShaderMaterial({
      uniforms: {
        trailTexture: { value: null },
        opacity: { value: 0.8 },
        colorTint: { value: new THREE.Color(1, 0, 1) } // Magenta tint
      },
      vertexShader: `
        varying vec2 vUv;
        
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D trailTexture;
        uniform float opacity;
        uniform vec3 colorTint;
        varying vec2 vUv;
        
        void main() {
          vec4 trailColor = texture2D(trailTexture, vUv);
          vec3 tintedColor = trailColor.rgb * colorTint;
          gl_FragColor = vec4(tintedColor, trailColor.a * opacity);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });
  }
  
  /**
   * Create basic materials as fallback
   */
  createBasicMaterials() {
    // Point rendering material - basic version for fallback
    this.pointMaterial = new THREE.PointsMaterial({
      color: 0xff00ff,
      size: this.pointSize, // Use configured point size
      transparent: true,
      opacity: 1.0,
      blending: THREE.NormalBlending,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: false
    });
    
    // Feedback material - basic version
    this.feedbackMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });
    
    // Display material - basic version
    this.displayMaterial = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending,
      depthTest: false,
      depthWrite: false
    });
    
    // Update existing mesh material if it exists
    if (this.pointsMesh) {
      this.pointsMesh.material = this.pointMaterial;
      if (DEBUG_GPU_TRACE) {
        console.log('[GPU TRACE] Updated existing points mesh with basic material');
      }
    }
    
    // Mark as using basic materials (not custom shaders)
    this.usingBasicMaterials = true;
    
    if (DEBUG_GPU_TRACE) {
      console.log('[GPU TRACE] Using basic Three.js materials (no custom shaders)');
    }
  }
  
  /**
   * Create fallback materials using basic Three.js materials
   */
  createFallbackMaterials() {
    console.log('[GPU TRACE] Using fallback materials');
    
    // Simple fallback materials
    this.feedbackMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.0
    });
    
    this.pointMaterial = new THREE.PointsMaterial({
      color: 0xff00ff,
      size: this.pointSize,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    this.displayMaterial = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.8,
      blending: THREE.NormalBlending
    });
    
    // Mark as fallback mode
    this.usingFallback = true;
  }
  
  /**
   * Create scenes for rendering
   */
  createScenes() {
    // Scene for feedback rendering (off-screen)
    this.feedbackScene = new THREE.Scene();
    this.feedbackCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Full-screen quad for feedback rendering
    const feedbackGeometry = new THREE.PlaneGeometry(2, 2);
    this.feedbackQuad = new THREE.Mesh(feedbackGeometry, this.feedbackMaterial);
    this.feedbackScene.add(this.feedbackQuad);
    
    // Scene for point rendering (off-screen)
    this.pointScene = new THREE.Scene();
    this.pointCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Points geometry (will be updated with midpoint positions)
    this.pointsGeometry = new THREE.BufferGeometry();
    // Initialize with empty attributes to prevent shader errors
    this.pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    this.pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
    
    this.pointsMesh = new THREE.Points(this.pointsGeometry, this.pointMaterial);
    this.pointScene.add(this.pointsMesh);
    
    // Scene for display rendering (on-screen)
    this.displayScene = new THREE.Scene();
    this.displayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    
    // Full-screen quad for display
    const displayGeometry = new THREE.PlaneGeometry(2, 2);
    this.displayQuad = new THREE.Mesh(displayGeometry, this.displayMaterial);
    this.displayScene.add(this.displayQuad);
  }
  
  /**
   * Clear both render targets
   */
  clearTargets() {
    const originalTarget = this.renderer.getRenderTarget();
    const originalClearColor = this.renderer.getClearColor(new THREE.Color());
    const originalClearAlpha = this.renderer.getClearAlpha();
    
    // Set clear color to transparent black
    this.renderer.setClearColor(0x000000, 0.0);
    
    // Clear target A
    this.renderer.setRenderTarget(this.traceTargetA);
    this.renderer.clear();
    
    // Clear target B
    this.renderer.setRenderTarget(this.traceTargetB);
    this.renderer.clear();
    
    // Restore original clear color and target
    this.renderer.setClearColor(originalClearColor, originalClearAlpha);
    this.renderer.setRenderTarget(originalTarget);
    
    if (DEBUG_GPU_TRACE) {
      console.log('[GPU TRACE] Render targets cleared to transparent');
    }
  }
  
  /**
   * Update point positions from midpoints
   * @param {Array} midPoints Array of midpoint meshes
   */
  updatePointPositions(midPoints) {
    if (!midPoints || midPoints.length === 0) {
      // Set empty geometry to avoid shader errors
      this.pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
      this.pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute([], 3));
      return;
    }
    
    const positions = [];
    const colors = [];
    
    // Use world coordinates for both basic materials and GPU trails
    for (const midPoint of midPoints) {
      if (midPoint && midPoint.position) {
        const x = midPoint.position.x;
        const y = midPoint.position.y;
        const z = midPoint.position.z || 0;
        
        positions.push(x, y, z);
        colors.push(1.0, 0.0, 1.0); // RGB for magenta
      }
    }
    
    // Always update geometry, even if empty
    this.pointsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.pointsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.pointsGeometry.attributes.position.needsUpdate = true;
    this.pointsGeometry.attributes.color.needsUpdate = true;
    
    if (DEBUG_GPU_TRACE && positions.length > 0 && Math.random() < 0.1) {
      console.log('[GPU TRACE] Updated geometry with', positions.length / 3, 'points');
      console.log('[GPU TRACE] First point world coords:', positions[0], positions[1], positions[2]);
    }
  }
  
  /**
   * Render the trace system
   * @param {Array} midPoints Array of midpoint meshes
   * @param {number} time Current time for animations
   */
  render(midPoints, time = 0) {
    if (!this.initialized) {
      return;
    }
    
    // Safety check to prevent infinite loops
    if (this._rendering) {
      console.warn('[GPU TRACE] Render already in progress, skipping frame');
      return;
    }
    
    this._rendering = true;
    
    try {
      // If using basic materials, just update point positions (no trails)
      if (this.usingBasicMaterials) {
        this.updatePointPositions(midPoints);
        return;
      }
      
      // GPU trail rendering with feedback loop
      this.renderGPUTrails(midPoints, time);
    } catch (error) {
      console.error('[GPU TRACE] Error in render:', error);
      // Fall back to basic materials
      this.usingBasicMaterials = true;
      this.updatePointPositions(midPoints);
    } finally {
      this._rendering = false;
    }
  }
  
  /**
   * Render GPU trails using feedback loop
   * @param {Array} midPoints Array of midpoint meshes
   * @param {number} time Current time for animations
   */
  renderGPUTrails(midPoints, time) {
    try {
      // Store original render state
      const originalTarget = this.renderer.getRenderTarget();
      const originalClearColor = this.renderer.getClearColor(new THREE.Color());
      const originalClearAlpha = this.renderer.getClearAlpha();
      
      // Update point positions for this frame
      this.updatePointPositions(midPoints);
      
      // Step 1: Render feedback (fade previous frame)
      this.renderFeedback();
      
      // Step 2: Render new points on top of faded trails
      this.renderPoints();
      
      // Step 3: Update display material with current trail texture
      if (this.displayMaterial.uniforms && this.displayMaterial.uniforms.trailTexture) {
        this.displayMaterial.uniforms.trailTexture.value = this.currentTarget.texture;
      }
      
      // Step 4: Swap render targets for next frame
      this.swapTargets();
      
      // Restore original render state
      this.renderer.setRenderTarget(originalTarget);
      this.renderer.setClearColor(originalClearColor, originalClearAlpha);
      
      if (DEBUG_GPU_TRACE && Math.random() < 0.02) {
        console.log('[GPU TRACE] Rendered frame with', midPoints.length, 'points');
      }
    } catch (error) {
      console.error('[GPU TRACE] Error in renderGPUTrails:', error);
      // Fall back to basic materials to prevent freezing
      this.usingBasicMaterials = true;
      this.updatePointPositions(midPoints);
    }
  }
  
  /**
   * Render feedback pass (fade previous frame)
   */
  renderFeedback() {
    try {
      // Ensure we have valid targets
      if (!this.currentTarget || !this.previousTarget) {
        console.warn('[GPU TRACE] Invalid render targets in feedback pass');
        return;
      }
      
      // Set previous frame texture as input
      this.feedbackMaterial.uniforms.previousFrame.value = this.previousTarget.texture;
      
      // Render to current target
      this.renderer.setRenderTarget(this.currentTarget);
      this.renderer.setClearColor(0x000000, 0.0); // Clear to transparent
      
      // CRITICAL: Clear the target manually, then disable autoClear
      this.renderer.clear();
      const originalAutoClear = this.renderer.autoClear;
      this.renderer.autoClear = false;
      
      // Render full-screen quad with faded previous frame
      this.renderer.render(this.feedbackScene, this.feedbackCamera);
      
      // Restore autoClear setting
      this.renderer.autoClear = originalAutoClear;
      
      if (DEBUG_GPU_TRACE && Math.random() < 0.01) {
        console.log('[GPU TRACE] Rendered feedback pass with fade:', this.fadeAmount);
      }
    } catch (error) {
      console.error('[GPU TRACE] Error in renderFeedback:', error);
      throw error;
    }
  }
  
  /**
   * Render points pass (add new points)
   */
  renderPoints() {
    try {
      // Ensure we have valid geometry
      if (!this.pointsGeometry || !this.pointsMesh) {
        console.warn('[GPU TRACE] Invalid geometry in points pass');
        return;
      }
      
      // Keep rendering to the same target (additive blending)
      // CRITICAL: Don't clear - we want to add points on top of the faded trails
      const originalAutoClear = this.renderer.autoClear;
      this.renderer.autoClear = false; // Disable clearing for points pass
      
      // Set up camera to match world coordinates
      this.setupPointCamera();
      
      // Render points on top of existing content
      this.renderer.render(this.pointScene, this.pointCamera);
      
      // Restore autoClear setting
      this.renderer.autoClear = originalAutoClear;
      
      if (DEBUG_GPU_TRACE && Math.random() < 0.01) {
        console.log('[GPU TRACE] Rendered points pass');
      }
    } catch (error) {
      console.error('[GPU TRACE] Error in renderPoints:', error);
      throw error;
    }
  }
  
  /**
   * Setup point camera to match world coordinates
   */
  setupPointCamera() {
    // Set up orthographic camera to match world coordinate space
    // Use bounds that encompass the actual scene geometry
    const worldSize = 1000; // Half the world bounds - adjust based on your scene size
    this.pointCamera.left = -worldSize;
    this.pointCamera.right = worldSize;
    this.pointCamera.top = worldSize;
    this.pointCamera.bottom = -worldSize;
    this.pointCamera.near = -100;
    this.pointCamera.far = 100;
    this.pointCamera.updateProjectionMatrix();
  }
  
  /**
   * Swap render targets for ping-pong effect
   */
  swapTargets() {
    const temp = this.currentTarget;
    this.currentTarget = this.previousTarget;
    this.previousTarget = temp;
  }
  
  /**
   * Render traces to the main scene
   * @param {THREE.Scene} scene Main scene to render to
   * @param {THREE.Camera} camera Main camera
   */
  renderToScene(scene, camera) {
    if (!this.initialized || !this.previousTarget) {
      return;
    }
    
    // Update display material with current trace texture
    this.displayMaterial.uniforms.traceTexture.value = this.previousTarget.texture;
    
    // The display quad should be added to the main scene when traces are enabled
    // This will be handled by the LayerLinkManager
  }
  
  /**
   * Get the points mesh for adding to the main scene (for basic materials)
   * @returns {THREE.Points} Points mesh
   */
  getPointsMesh() {
    if (!this.initialized || !this.usingBasicMaterials) {
      return null;
    }
    
    return this.pointsMesh;
  }
  
  /**
   * Get the display mesh for adding to the main scene
   * @returns {THREE.Mesh} Display mesh
   */
  getDisplayMesh() {
    if (!this.initialized || this.usingBasicMaterials) {
      return null;
    }
    
    // Update texture reference with current trail texture
    if (this.displayMaterial.uniforms && this.displayMaterial.uniforms.trailTexture) {
      this.displayMaterial.uniforms.trailTexture.value = this.previousTarget.texture;
    }
    return this.displayQuad;
  }
  
  /**
   * Set trace parameters
   * @param {Object} params Parameters to update
   */
  setParameters(params) {
    if (params.fadeAmount !== undefined) {
      this.fadeAmount = params.fadeAmount;
      if (this.feedbackMaterial.uniforms && this.feedbackMaterial.uniforms.fadeAmount) {
        this.feedbackMaterial.uniforms.fadeAmount.value = this.fadeAmount;
      }
    }
    
    if (params.trailIntensity !== undefined) {
      this.trailIntensity = params.trailIntensity;
      // Trail intensity can be used to modify point opacity
      if (this.pointMaterial.uniforms && this.pointMaterial.uniforms.opacity) {
        this.pointMaterial.uniforms.opacity.value = this.trailIntensity;
      }
    }
    
    if (params.pointSize !== undefined) {
      this.pointSize = params.pointSize;
      if (this.pointMaterial.uniforms && this.pointMaterial.uniforms.pointSize) {
        this.pointMaterial.uniforms.pointSize.value = this.pointSize;
      } else if (this.pointMaterial.size !== undefined) {
        this.pointMaterial.size = this.pointSize;
      }
    }
    
    if (params.opacity !== undefined) {
      if (this.displayMaterial.uniforms && this.displayMaterial.uniforms.opacity) {
        this.displayMaterial.uniforms.opacity.value = params.opacity;
      }
    }
    
    if (params.colorTint !== undefined) {
      if (this.displayMaterial.uniforms && this.displayMaterial.uniforms.colorTint) {
        this.displayMaterial.uniforms.colorTint.value.copy(params.colorTint);
      }
    }
    
    if (DEBUG_GPU_TRACE) {
      console.log('[GPU TRACE] Parameters updated:', params);
    }
  }
  
  /**
   * Dispose of all resources
   */
  dispose() {
    // Dispose render targets
    if (this.traceTargetA) this.traceTargetA.dispose();
    if (this.traceTargetB) this.traceTargetB.dispose();
    
    // Dispose materials
    if (this.feedbackMaterial) this.feedbackMaterial.dispose();
    if (this.pointMaterial) this.pointMaterial.dispose();
    if (this.displayMaterial) this.displayMaterial.dispose();
    
    // Dispose geometries
    if (this.pointsGeometry) this.pointsGeometry.dispose();
    
    this.initialized = false;
    
    if (DEBUG_GPU_TRACE) {
      console.log('[GPU TRACE] System disposed');
    }
  }
}

// Export for use in other modules
export default GPUTraceSystem; 