// src/state/layer.js - Layer class for multi-layer architecture
import { createAppState } from './state.js';
import * as THREE from 'three';
import { createPolygonGeometry } from '../geometry/geometry.js';

// Debug flag to control logging
const DEBUG_LOGGING = false;

/**
 * Layer class that encapsulates geometry, state, and rendering for a single layer
 */
export class Layer {
  /**
   * Create a new layer
   * @param {number} id Unique identifier for this layer
   * @param {Object} options Configuration options
   */
  constructor(id, options = {}) {
    this.id = id;
    this.name = options.name || `Layer ${id}`;
    this.active = options.active || false;
    
    // Create a dedicated state object for this layer
    this.state = createAppState();
    
    // Add a direct reference to this layer in the state object
    this.state.layerId = id;
    this.state.layerRef = this;
    
    // Generate a unique color for this layer based on its ID
    if (options.color) {
      // Use the provided color if supplied
      this.color = options.color;
    } else {
      // Generate a color with a distinct hue based on layer ID
      const hue = (id * 60) % 360; // 60-degree shift per layer
      this.color = new THREE.Color(`hsl(${hue}, 100%, 50%)`);
    }
    
    // Layer-specific rendering properties
    this.baseGeo = null;
    this.group = null;
    this.material = null;
    this.visible = true;
    
    // Last time this layer was updated
    this.lastUpdateTime = 0;
    
    // Initialize layer with default settings
    this.initialize(options);
    
    // Ensure we have some initial state values that will render something
    this.state.copies = this.state.copies || 3;
    this.state.segments = this.state.segments || 3;
    this.state.radius = this.state.radius || 100;
    this.state.stepScale = this.state.stepScale || 1.05;
    
    // Force parameter changes to ensure initial render
    this.state.parameterChanges.copies = true;
    this.state.parameterChanges.segments = true;
    this.state.parameterChanges.radius = true;
    this.state.parameterChanges.stepScale = true;
    
    if (DEBUG_LOGGING) {
      console.log(`Layer ${id} created with: copies=${this.state.copies}, segments=${this.state.segments}, radius=${this.state.radius}`);
      console.log(`Layer ${id} color:`, this.color);
    }
    
    // Override the setRadius, setSegments, and setCopies methods to add layer-specific logging
    const originalSetRadius = this.state.setRadius;
    this.state.setRadius = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Setting radius to ${value}`);
      }
      return originalSetRadius.call(this.state, value);
    };
    
    const originalSetSegments = this.state.setSegments;
    this.state.setSegments = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Setting segments to ${value}`);
      }
      return originalSetSegments.call(this.state, value);
    };
    
    const originalSetCopies = this.state.setCopies;
    this.state.setCopies = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Setting copies to ${value}`);
      }
      return originalSetCopies.call(this.state, value);
    };
    
    // Override hasParameterChanged to add layer-specific logging
    const originalHasParameterChanged = this.state.hasParameterChanged;
    this.state.hasParameterChanged = function() {
      const hasChanges = originalHasParameterChanged.call(this);
      if (hasChanges && DEBUG_LOGGING) {
        const changedParams = Object.entries(this.parameterChanges)
          .filter(([_, val]) => val)
          .map(([key, _]) => key)
          .join(", ");
        console.log(`[LAYER ${id}] Parameter changes detected: ${changedParams}`);
      }
      return hasChanges;
    };
  }
  
  /**
   * Initialize layer with settings
   * @param {Object} options Configuration options
   */
  initialize(options = {}) {
    // Create a THREE.Group for this layer
    this.group = new THREE.Group();
    this.group.name = `layer-${this.id}`;
    this.group.userData.layerId = this.id;
    
    // IMPORTANT: Ensure group is visible
    this.group.visible = true;
    
    // IMPORTANT: Set the state reference in the group userData
    // This fixes the "No valid state found for trigger detection" error
    this.group.userData.state = this.state;
    
    // Set global state reference if available from window
    if (window._globalState) {
      this.group.userData.globalState = window._globalState;
    }
    
    // Create layer-specific material with THIS LAYER'S COLOR
    this.material = new THREE.LineBasicMaterial({
      color: this.color,
      transparent: false,  
      opacity: 1.0,        
      depthTest: false,    
      depthWrite: false,   
      linewidth: 3,        // Thicker lines
      linecap: 'round',    // Rounded line caps
      linejoin: 'round'    // Rounded line joins
    });
    
    // Store the layer ID in the material's userData for debugging
    this.material.userData = {
      layerId: this.id,
      materialCreatedFor: `layer-${this.id}`
    };
    
    // Log material creation with color info
    if (DEBUG_LOGGING) {
      console.log(`[LAYER ${this.id}] Created material with color:`, {
        r: this.color.r,
        g: this.color.g,
        b: this.color.b,
        hex: '#' + this.color.getHexString()
      });
    }
    
    // Apply any state overrides from options
    if (options.state) {
      Object.assign(this.state, options.state);
    }
    
    // Force visibility
    this.visible = true;
    
    // Make sure layer has initial geometry
    if (!this.baseGeo) {
      this.state.radius = this.state.radius || 100;
      this.state.segments = this.state.segments || 3;
      this.state.copies = this.state.copies || 3;
      
      // Create initial geometry
      this.recreateGeometry();
    }
    
    if (DEBUG_LOGGING) {
      console.log(`Layer ${this.id} initialized, group visible: ${this.group.visible}, radius: ${this.state.radius}, segments: ${this.state.segments}, copies: ${this.state.copies}`);
    }
  }
  
  /**
   * Update the layer color
   * @param {THREE.Color|string} color New color for the layer
   */
  setColor(color) {
    if (typeof color === 'string') {
      this.color = new THREE.Color(color);
    } else {
      this.color = color;
    }
    
    // Update material color
    if (this.material) {
      this.material.color = this.color;
      this.material.needsUpdate = true; // Important! This forces Three.js to update the material
      
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Updated material color to:`, {
          r: this.color.r,
          g: this.color.g,
          b: this.color.b,
          hex: '#' + this.color.getHexString()
        });
      }
    }
  }
  
  /**
   * Set the visibility of this layer
   * @param {boolean} visible Whether the layer should be visible
   */
  setVisible(visible) {
    this.visible = visible;
    if (this.group) {
      this.group.visible = visible;
    }
  }
  
  /**
   * Activate this layer (make it the current editing target)
   */
  activate() {
    this.active = true;
    if (DEBUG_LOGGING) {
      console.log(`[LAYER] Layer ${this.id} activated with state:`, {
        radius: this.state.radius,
        segments: this.state.segments,
        copies: this.state.copies
      });
    }
    
    // Hook into state change methods to add debug logging for this layer
    const originalSetRadius = this.state.setRadius;
    this.state.setRadius = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Setting radius to ${value}`);
      }
      return originalSetRadius.call(this.state, value);
    };
    
    const originalSetSegments = this.state.setSegments;
    this.state.setSegments = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Setting segments to ${value}`);
      }
      return originalSetSegments.call(this.state, value);
    };
    
    const originalSetCopies = this.state.setCopies;
    this.state.setCopies = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Setting copies to ${value}`);
      }
      return originalSetCopies.call(this.state, value);
    };
    
    // Ensure this layer has valid geometry for trigger detection when activated
    this.ensureValidGeometry();
  }
  
  /**
   * Deactivate this layer
   */
  deactivate() {
    this.active = false;
    if (DEBUG_LOGGING) {
      console.log(`[LAYER] Layer ${this.id} deactivated`);
    }
    
    // Remove debug hooks from state methods when deactivating
    if (this.state._originalSetRadius) {
      this.state.setRadius = this.state._originalSetRadius;
    }
    
    if (this.state._originalSetSegments) {
      this.state.setSegments = this.state._originalSetSegments;
    }
    
    if (this.state._originalSetCopies) {
      this.state.setCopies = this.state._originalSetCopies;
    }
  }
  
  /**
   * Ensure this layer has valid geometry that can be used for trigger detection
   * This is essential for triggers to work correctly
   */
  ensureValidGeometry() {
    // If no geometry exists or it's invalid, recreate it
    if (!this.baseGeo || !this.baseGeo.getAttribute('position')) {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Ensuring valid geometry for trigger detection`);
      }
      this.recreateGeometry();
    }
    
    // Ensure the geometry has the necessary userData for trigger detection
    if (this.baseGeo && !this.baseGeo.userData.layerId) {
      this.baseGeo.userData.layerId = this.id;
      this.baseGeo.userData.vertexCount = this.state.segments;
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Added layerId and vertexCount to geometry userData`);
      }
    }
    
    // Ensure the group has the state reference for trigger detection
    if (this.group) {
      this.group.userData.state = this.state;
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Ensured group has state reference for trigger detection`);
      }
      
      // Make sure the group is visible
      if (!this.group.visible) {
        this.group.visible = true;
        if (DEBUG_LOGGING) {
          console.log(`[LAYER ${this.id}] Forced group visibility for trigger detection`);
        }
      }
    }
    
    // Initialize lastTrig set if it doesn't exist
    if (!this.state.lastTrig) {
      this.state.lastTrig = new Set();
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Initialized lastTrig set for trigger detection`);
      }
    }
  }
  
  /**
   * Dispose of layer resources to prevent memory leaks
   */
  dispose() {
    // Clean up Three.js objects
    if (this.baseGeo && this.baseGeo.dispose) {
      this.baseGeo.dispose();
    }
    
    if (this.material && this.material.dispose) {
      this.material.dispose();
    }
    
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
  
  /**
   * Force recreation of layer geometry with current parameters
   */
  recreateGeometry() {
    // Dispose old geometry if it exists
    if (this.baseGeo && this.baseGeo.dispose) {
      this.baseGeo.dispose();
    }
    
    // Create new geometry with current parameters
    this.baseGeo = createPolygonGeometry(
      this.state.radius,
      this.state.segments,
      this.state
    );
    
    // Force parameter changes to ensure render update
    this.state.parameterChanges.radius = true;
    this.state.parameterChanges.segments = true;
    this.state.parameterChanges.copies = true;
    
    if (DEBUG_LOGGING) {
      console.log(`[GEOMETRY UPDATE] Recreated geometry for layer ${this.id}: segments=${this.state.segments}, radius=${this.state.radius}, copies=${this.state.copies}`);
    }
    
    return this.baseGeo;
  }
  
  /**
   * Force layer to be fully visible with high contrast settings
   */
  forceVisibility() {
    // Ensure both layer and group are set to visible
    this.visible = true;
    if (this.group) {
      this.group.visible = true;
    }
    
    // Make material highly visible
    if (this.material) {
      this.material.transparent = false;
      this.material.opacity = 1.0;
      this.material.depthTest = false;
      this.material.depthWrite = false;
      this.material.linewidth = 5;
      this.material.needsUpdate = true;
      
      // Set to bright green for maximum visibility
      this.material.color = new THREE.Color(0x00FF00);
    }
    
    // Recreate geometry with large radius
    if (this.state) {
      this.state.radius = Math.max(this.state.radius, 300);
      this.state.parameterChanges.radius = true;
      
      // Force immediate camera update
      const boundingRadius = this.state.radius * Math.pow(this.state.stepScale, this.state.copies - 1) * 1.5;
      this.state.targetCameraDistance = boundingRadius * 2; // Set a distance that will capture all geometry
      this.state.cameraDistance = this.state.targetCameraDistance; // Immediate update
      
      // Apply to camera if available
      if (this.group && this.group.parent && this.group.parent.userData && this.group.parent.userData.camera) {
        this.group.parent.userData.camera.position.z = this.state.cameraDistance;
      }
    }
    
    // Force geometry recreation
    this.recreateGeometry();
    
    if (DEBUG_LOGGING) {
      console.log(`Forced visibility for layer ${this.id}`);
    }
    
    return this;
  }
  
  /**
   * Update the layer's angle for animation and marker detection.
   * This method ONLY calculates and tracks angles but DOES NOT apply rotation.
   * The actual rotation is applied by LayerManager.updateLayers to avoid double-application.
   * 
   * @param {number} currentTime Current time in seconds
   */
  updateAngle(currentTime) {
    // Store previous angle for marker hit detection
    this.previousAngle = this.currentAngle || 0;
    
    // Get global state manager (which should be attached to the group)
    const globalState = this.group?.userData?.globalState;
    
    if (globalState) {
      // Get base angle from global state (in degrees)
      const baseAngleInDegrees = globalState.lastAngle || 0;
      
      // Initialize tracking properties if they don't exist
      if (this.lastBaseAngle === undefined) {
        this.lastBaseAngle = baseAngleInDegrees;
        this.accumulatedAngle = baseAngleInDegrees;
      }
      
      // Calculate how much the base angle has changed since last frame
      let deltaAngle = baseAngleInDegrees - this.lastBaseAngle;
      
      // Handle wraparound from 359->0 degrees
      if (deltaAngle < -180) {
        deltaAngle += 360;
      } else if (deltaAngle > 180) {
        deltaAngle -= 360;
      }
      
      // Apply time subdivision multiplier to the delta if enabled
      if (this.state.useTimeSubdivision && this.state.timeSubdivisionValue !== 1) {
        const multiplier = this.state.timeSubdivisionValue;
        deltaAngle *= multiplier;
        
        // Log the effect occasionally, only if debug logging is enabled
        if (DEBUG_LOGGING && Math.random() < 0.003) {
          console.log(`[LAYER ${this.id}] Applied time subdivision: multiplier=${multiplier}, deltaAngle=${deltaAngle.toFixed(2)}°`);
        }
      }
      
      // Accumulate the angle continuously
      this.accumulatedAngle = (this.accumulatedAngle + deltaAngle) % 360;
      if (this.accumulatedAngle < 0) this.accumulatedAngle += 360;
      
      // Store the current base angle for next frame's calculation
      this.lastBaseAngle = baseAngleInDegrees;
      
      // Convert accumulated angle from degrees to radians
      this.currentAngle = (this.accumulatedAngle * Math.PI) / 180;
      
      // IMPORTANT: DO NOT apply rotation here!
      // LayerManager.updateLayers will handle applying rotation to the group.
    } else {
      // Fallback calculation if no global state is available
      // This shouldn't happen in normal operation
      if (DEBUG_LOGGING) {
        console.warn(`[LAYER ${this.id}] No global state available for angle update`);
      }
      
      // Default to a slow rotation (45 degrees per second)
      const lastUpdateTime = this.lastUpdateTime || (currentTime - 0.016);
      const deltaTime = currentTime - lastUpdateTime;
      const rotationSpeed = Math.PI / 4; // 45 degrees per second
      
      this.currentAngle = (this.currentAngle || 0) + rotationSpeed * deltaTime;
      
      // IMPORTANT: DO NOT apply rotation here!
      // LayerManager.updateLayers will handle applying rotation to the group.
    }
    
    // Store the time for future delta calculations
    this.lastUpdateTime = currentTime;
  }
} 