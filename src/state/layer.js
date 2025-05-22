// src/state/layer.js - Layer class for multi-layer architecture
import { createAppState } from './state.js';
import * as THREE from 'three';
import { createPolygonGeometry } from '../geometry/geometry.js';

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
    
    console.log(`Layer ${id} created with: copies=${this.state.copies}, segments=${this.state.segments}, radius=${this.state.radius}`);
    console.log(`Layer ${id} color:`, this.color);
    
    // Override the setRadius, setSegments, and setCopies methods to add layer-specific logging
    const originalSetRadius = this.state.setRadius;
    this.state.setRadius = (value) => {
      console.log(`[LAYER ${this.id}] Setting radius to ${value}`);
      return originalSetRadius.call(this.state, value);
    };
    
    const originalSetSegments = this.state.setSegments;
    this.state.setSegments = (value) => {
      console.log(`[LAYER ${this.id}] Setting segments to ${value}`);
      return originalSetSegments.call(this.state, value);
    };
    
    const originalSetCopies = this.state.setCopies;
    this.state.setCopies = (value) => {
      console.log(`[LAYER ${this.id}] Setting copies to ${value}`);
      return originalSetCopies.call(this.state, value);
    };
    
    // Override hasParameterChanged to add layer-specific logging
    const originalHasParameterChanged = this.state.hasParameterChanged;
    this.state.hasParameterChanged = function() {
      const hasChanges = originalHasParameterChanged.call(this);
      if (hasChanges) {
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
    console.log(`[LAYER ${this.id}] Created material with color:`, {
      r: this.color.r,
      g: this.color.g,
      b: this.color.b,
      hex: '#' + this.color.getHexString()
    });
    
    // Apply any state overrides from options
    if (options.state) {
      Object.assign(this.state, options.state);
    }
    
    console.log(`Layer ${this.id} initialized, group visible: ${this.group.visible}`);
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
      
      console.log(`[LAYER ${this.id}] Updated material color to:`, {
        r: this.color.r,
        g: this.color.g,
        b: this.color.b,
        hex: '#' + this.color.getHexString()
      });
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
    console.log(`[LAYER] Layer ${this.id} activated with state:`, {
      radius: this.state.radius,
      segments: this.state.segments,
      copies: this.state.copies
    });
    
    // Hook into state change methods to add debug logging for this layer
    const originalSetRadius = this.state.setRadius;
    this.state.setRadius = (value) => {
      console.log(`[LAYER ${this.id}] Setting radius to ${value}`);
      return originalSetRadius.call(this.state, value);
    };
    
    const originalSetSegments = this.state.setSegments;
    this.state.setSegments = (value) => {
      console.log(`[LAYER ${this.id}] Setting segments to ${value}`);
      return originalSetSegments.call(this.state, value);
    };
    
    const originalSetCopies = this.state.setCopies;
    this.state.setCopies = (value) => {
      console.log(`[LAYER ${this.id}] Setting copies to ${value}`);
      return originalSetCopies.call(this.state, value);
    };
  }
  
  /**
   * Deactivate this layer
   */
  deactivate() {
    this.active = false;
    console.log(`[LAYER] Layer ${this.id} deactivated`);
    
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
    
    console.log(`[GEOMETRY UPDATE] Recreated geometry for layer ${this.id}: segments=${this.state.segments}, radius=${this.state.radius}, copies=${this.state.copies}`);
    
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
    
    console.log(`Forced visibility for layer ${this.id}`);
    
    return this;
  }
} 