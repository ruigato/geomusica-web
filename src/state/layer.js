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
    
    // FIXED: Remove circular references that could cause memory leaks
    // Instead of storing direct references, just store the layer ID
    this.state.layerId = id;
    // Remove this.state.layerRef = this; as it creates circular reference
    
    // Store a weak reference to layer manager if available
    // This allows the layer to find itself without creating circular references
    this._layerManagerRef = null;
    
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
    
    // IMPORTANT: Initialize markers array for trigger markers
    this.markers = [];
    
    // Last time this layer was updated
    this.lastUpdateTime = 0;
    
    // Initialize layer with default settings
    this.initialize(options);
    
    // Ensure we have some initial state values that will render something
    this.state.copies = this.state.copies || 3;
    this.state.segments = this.state.segments || 2;
    this.state.radius = this.state.radius || 100;
    this.state.stepScale = this.state.stepScale || 1.05;
    
    // Initialize axis frequency labels setting to true by default
    this.state.showAxisFreqLabels = this.state.showAxisFreqLabels !== undefined ? this.state.showAxisFreqLabels : true;
    
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
      this.state.segments = this.state.segments || 2;
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
    
    // Update color for all children in the group
    if (this.group) {
      this.group.traverse(child => {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.color = this.color;
              mat.needsUpdate = true;
            });
          } else {
            child.material.color = this.color;
            child.material.needsUpdate = true;
          }
        }
      });
    }
    
    // Mark parameters as changed to force render updates
    if (this.state && this.state.parameterChanges) {
      // Set a special flag for color changes
      this.state.parameterChanges.color = true;
      
      // Force geometry recreation to update vertex dots with new color
      this.recreateGeometry();
    }
    
    // Return this for method chaining
    return this;
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
    
    // Store original methods if they haven't been stored already
    // and ensure we're not overriding them if they already exist
    if (!this.state._originalMethods) {
      this.state._originalMethods = {
        setRadius: this.state.setRadius,
        setSegments: this.state.setSegments,
        setCopies: this.state.setCopies,
        hasParameterChanged: this.state.hasParameterChanged
      };
    }
    
    // Hook into state change methods to add debug logging for this layer
    this.state.setRadius = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Setting radius to ${value}`);
      }
      return this.state._originalMethods.setRadius.call(this.state, value);
    };
    
    this.state.setSegments = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Setting segments to ${value}`);
      }
      return this.state._originalMethods.setSegments.call(this.state, value);
    };
    
    this.state.setCopies = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Setting copies to ${value}`);
      }
      return this.state._originalMethods.setCopies.call(this.state, value);
    };
    
    // Mark all parameters as changed to force UI updates
    if (this.state.parameterChanges) {
      Object.keys(this.state.parameterChanges).forEach(key => {
        this.state.parameterChanges[key] = true;
      });
      
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Marked all parameters as changed during activation`);
      }
    }
    
    // Update window._appState to point to this layer's state
    if (window._appState !== this.state) {
      window._appState = this.state;
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Updated window._appState reference to this layer's state`);
      }
    }
    
    // Ensure this layer has valid geometry for trigger detection when activated
    this.ensureValidGeometry();
    
    // Trigger UI updates for this layer
    this.forceUIUpdate();
  }
  
  /**
   * Force UI updates for this layer using all available methods
   */
  forceUIUpdate() {
    // Try using the global updateUIFromState function
    if (window.updateUIFromState && typeof window.updateUIFromState === 'function') {
      try {
        window.updateUIFromState(this.state);
        if (DEBUG_LOGGING) {
          console.log(`[LAYER ${this.id}] Called updateUIFromState to update UI`);
        }
      } catch (error) {
        console.error(`[LAYER ${this.id}] Error updating UI from state:`, error);
      }
    }
    
    // Try using the global updateUIForActiveLayer function
    if (window.updateUIForActiveLayer && typeof window.updateUIForActiveLayer === 'function') {
      try {
        window.updateUIForActiveLayer(this.id);
        if (DEBUG_LOGGING) {
          console.log(`[LAYER ${this.id}] Called updateUIForActiveLayer to update UI`);
        }
      } catch (error) {
        console.error(`[LAYER ${this.id}] Error updating UI for active layer:`, error);
      }
    }
    
    // Try dispatching a custom event that UI components might listen for
    try {
      const event = new CustomEvent('layerActivated', { 
        detail: { layerId: this.id, state: this.state }
      });
      window.dispatchEvent(event);
      
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Dispatched layerActivated event`);
      }
    } catch (error) {
      console.error(`[LAYER ${this.id}] Error dispatching layer activated event:`, error);
    }
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
    // Only restore original methods if they were properly saved
    if (this.state._originalMethods) {
      // Restore all original methods from the stored object
      this.state.setRadius = this.state._originalMethods.setRadius;
      this.state.setSegments = this.state._originalMethods.setSegments;
      this.state.setCopies = this.state._originalMethods.setCopies;
      
      if (this.state._originalMethods.hasParameterChanged) {
        this.state.hasParameterChanged = this.state._originalMethods.hasParameterChanged;
      }
      
      if (DEBUG_LOGGING) {
        console.log(`[LAYER] Layer ${this.id} original methods restored`);
      }
    } else if (DEBUG_LOGGING) {
      console.warn(`[LAYER] Layer ${this.id} has no stored original methods to restore`);
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
    
    // FIXED: Clean up references to prevent memory leaks
    // Clear any circular references
    if (this.group && this.group.userData) {
      this.group.userData.state = null;
      this.group.userData.globalState = null;
    }
    
    // Clear layer manager reference
    this._layerManagerRef = null;
    
    // Clear state references that might be circular
    if (this.state) {
      // Don't dispose the state itself as it might be shared
      // Just clear any potential circular references
      this.state.layerId = null;
    }
    
    // Clear object references
    this.baseGeo = null;
    this.material = null;
    this.group = null;
    this.state = null;
  }
  
  /**
   * Safely get layer manager reference without creating circular dependencies
   * @returns {LayerManager|null} Layer manager instance or null if not available
   */
  getLayerManager() {
    // Try getting from weak reference first
    if (this._layerManagerRef) {
      return this._layerManagerRef;
    }
    
    // Try getting from global window if available
    if (window._layers) {
      this._layerManagerRef = window._layers;
      return this._layerManagerRef;
    }
    
    return null;
  }
  
  /**
   * Set layer manager reference (should be called by LayerManager)
   * @param {LayerManager} layerManager Layer manager instance
   */
  setLayerManager(layerManager) {
    this._layerManagerRef = layerManager;
  }
  
  /**
   * Force recreation of layer geometry with current parameters
   */
  recreateGeometry() {
    // FIXED: Get layer manager reference at the start for use throughout the function
    const layerManager = this.getLayerManager();
    
    // FIXED: Enhanced geometry disposal with reference checking
    let oldGeometry = null;
    if (this.baseGeo) {
      oldGeometry = this.baseGeo;
      
      // Check if the old geometry is still in use by other objects
      let isGeometryInUse = false;
      
      // Check if the geometry is being used by any children in the group
      if (this.group) {
        this.group.traverse((child) => {
          if (child.geometry === oldGeometry) {
            isGeometryInUse = true;
          }
        });
      }
      
      // Check if other layers might be using this geometry
      if (layerManager && layerManager.layers) {
        for (const layer of layerManager.layers) {
          if (layer !== this && layer.baseGeo === oldGeometry) {
            isGeometryInUse = true;
            break;
          }
          
          // Check if any of the layer's group children use this geometry
          if (layer.group) {
            layer.group.traverse((child) => {
              if (child.geometry === oldGeometry) {
                isGeometryInUse = true;
              }
            });
          }
          
          if (isGeometryInUse) break;
        }
      }
      
      // Only dispose if not in use
      if (!isGeometryInUse && oldGeometry.dispose) {
        if (DEBUG_LOGGING) {
          console.log(`[LAYER ${this.id}] Disposing old geometry safely`);
        }
        oldGeometry.dispose();
      } else if (isGeometryInUse && DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Skipping geometry disposal - still in use by other objects`);
      }
    }
    
    // FIXED: Clear previous vertex positions to prevent false triggers after geometry changes
    // This prevents false positive axis crossings when comparing old vertex positions with new ones
    if (this.prevWorldVertices) {
      this.prevWorldVertices.clear();
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Cleared previous vertex positions to prevent false triggers`);
      }
    }
    
    // FIXED: Clear last triggered set to prevent stale trigger state
    if (this.lastTrig) {
      this.lastTrig.clear();
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Cleared last trigger set after geometry recreation`);
      }
    }
    
    try {
      // Create new geometry with current parameters
      this.baseGeo = createPolygonGeometry(
        this.state.radius,
        this.state.segments,
        this.state
      );
      
      // FIXED: Ensure the new geometry has proper metadata
      if (this.baseGeo) {
        this.baseGeo.userData = this.baseGeo.userData || {};
        this.baseGeo.userData.layerId = this.id;
        this.baseGeo.userData.vertexCount = this.state.segments;
        this.baseGeo.userData.createdAt = Date.now();
        
        if (DEBUG_LOGGING) {
          console.log(`[LAYER ${this.id}] Created new geometry with ${this.state.segments} segments`);
        }
      }
      
      // FIXED: Force parameter changes to ensure render update with validation
      if (this.state && this.state.parameterChanges) {
        this.state.parameterChanges.radius = true;
        this.state.parameterChanges.segments = true;
        this.state.parameterChanges.copies = true;
        
        // FIXED: Ensure state synchronization across all systems
        // Update UI elements to reflect the active state
        if (this.active && window.updateUIFromState) {
          try {
            window.updateUIFromState(this.state);
          } catch (uiError) {
            console.warn(`[LAYER ${this.id}] Failed to update UI from state:`, uiError);
          }
        }
        
        // FIXED: Trigger a more robust approach to get the active state
        if (layerManager && layerManager.activeLayerId === this.id) {
          // Ensure the layer manager knows about the geometry change
          if (layerManager.onActiveLayerGeometryChanged) {
            try {
              layerManager.onActiveLayerGeometryChanged(this);
            } catch (managerError) {
              console.warn(`[LAYER ${this.id}] Failed to notify layer manager of geometry change:`, managerError);
            }
          }
        }
      }
      
      if (DEBUG_LOGGING) {
        console.log(`[GEOMETRY UPDATE] Recreated geometry for layer ${this.id}: segments=${this.state.segments}, radius=${this.state.radius}, copies=${this.state.copies}`);
      }
      
    } catch (error) {
      console.error(`[LAYER ${this.id}] Error creating new geometry:`, error);
      
      // FIXED: Fallback - restore old geometry if new creation fails
      if (oldGeometry && !this.baseGeo) {
        console.warn(`[LAYER ${this.id}] Restoring old geometry due to creation failure`);
        this.baseGeo = oldGeometry;
      }
      
      // Re-throw to let calling code handle the error
      throw error;
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
   * This method calculates and tracks angles with time subdivision applied if enabled.
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
        
        // Store original delta for logging
        const originalDelta = deltaAngle;
        
        // Apply the time subdivision multiplier
        deltaAngle *= multiplier;
        
        // Enhanced logging for debugging time subdivision
        if (DEBUG_LOGGING && Math.random() < 0.003) {
          console.log(`[LAYER ${this.id}] Time subdivision: ${multiplier}x speed`);
          console.log(`[LAYER ${this.id}] Delta angle: ${originalDelta.toFixed(2)}° → ${deltaAngle.toFixed(2)}° (${multiplier}x)`);
          console.log(`[LAYER ${this.id}] Current accumulated angle: ${this.accumulatedAngle.toFixed(2)}°`);
        }
      } else if (DEBUG_LOGGING && Math.random() < 0.001) {
        // Log when time subdivision is disabled occasionally
        console.log(`[LAYER ${this.id}] Time subdivision disabled, normal speed (1x)`);
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
      if (DEBUG_LOGGING) {
        console.warn(`[LAYER ${this.id}] No global state available for angle update`);
      }
      
      // Default to a slow rotation (45 degrees per second)
      const lastUpdateTime = this.lastUpdateTime || (currentTime - 0.016);
      const deltaTime = currentTime - lastUpdateTime;
      const rotationSpeed = Math.PI / 4; // 45 degrees per second
      
      // Check if time subdivision should be applied to this fallback
      if (this.state && this.state.useTimeSubdivision && this.state.timeSubdivisionValue !== 1) {
        const multiplier = this.state.timeSubdivisionValue;
        this.currentAngle = (this.currentAngle || 0) + rotationSpeed * deltaTime * multiplier;
        
        if (DEBUG_LOGGING && Math.random() < 0.003) {
          console.log(`[LAYER ${this.id}] Applied time subdivision in fallback: ${multiplier}x`);
        }
      } else {
        this.currentAngle = (this.currentAngle || 0) + rotationSpeed * deltaTime;
      }
    }
    
    // Store the time for future delta calculations
    this.lastUpdateTime = currentTime;
  }

  /**
   * Make sure camera and renderer are attached to this layer
   * @returns {Object} Object with camera and renderer
   */
  ensureCameraAndRenderer() {
    const scene = this.group?.parent;
    
    if (!scene) {
      console.warn(`[LAYER ${this.id}] Cannot find parent scene for renderer and camera access`);
      return { camera: null, renderer: null };
    }
    
    // Try to get camera and renderer from scene userData (set in main.js)
    if (!scene.userData.camera || !scene.userData.renderer) {
      console.warn(`[LAYER ${this.id}] Scene is missing camera or renderer in userData`);
      return { camera: null, renderer: null };
    }
    
    return {
      camera: scene.userData.camera,
      renderer: scene.userData.renderer
    };
  }

  /**
   * Update the layer with animation parameters
   * @param {number} currentTime Current time in seconds
   * @param {number} deltaTime Time elapsed since last frame in seconds
   */
  update(currentTime, deltaTime) {
    // Update rotation angle based on time
    this.updateAngle(currentTime);
    
    // Update any other time-dependent properties
    
    // Make sure camera and renderer are accessible through scene
    const scene = this.group?.parent;
    if (scene && !scene.userData.camera && !scene.userData.renderer) {
      const { camera, renderer } = this.ensureCameraAndRenderer();
      if (camera && renderer) {
        scene.userData.camera = camera;
        scene.userData.renderer = renderer;
      }
    }
  }
} 