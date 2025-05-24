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
   * This is the CENTRAL place where rotation is applied to the layer group.
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
        this.lastAngleUpdateTime = currentTime;
      }
      
      // Calculate angle delta since last update (in degrees)
      const angleDelta = baseAngleInDegrees - this.lastBaseAngle;
      
      // Update tracking properties
      this.lastBaseAngle = baseAngleInDegrees;
      this.lastAngleUpdateTime = currentTime;
      
      // Setup debug counter if not already defined
      if (typeof window.__layerAngleDebugCounter === 'undefined') {
        window.__layerAngleDebugCounter = 0;
      }
      window.__layerAngleDebugCounter++;
      
      if (window.__layerAngleDebugCounter % 30 === 0) {
        console.log(`[ROTATION CRITICAL] Layer ${this.id} baseAngleInDegrees=${baseAngleInDegrees.toFixed(2)}°, angleDelta=${angleDelta.toFixed(4)}°`);
      }
      
      // Apply time subdivision if enabled
      let finalAngleInDegrees = baseAngleInDegrees;
      if (this.state && this.state.useTimeSubdivision && this.state.timeSubdivisionValue !== 1) {
        finalAngleInDegrees = baseAngleInDegrees * this.state.timeSubdivisionValue;
        
        if (window.__layerAngleDebugCounter % 30 === 0) {
          console.log(`[ROTATION CRITICAL] Layer ${this.id} time subdivision ${this.state.timeSubdivisionValue}x applied, finalAngleInDegrees=${finalAngleInDegrees.toFixed(2)}°`);
        }
      }
      
      // Convert to radians for Three.js
      this.currentAngle = (finalAngleInDegrees * Math.PI) / 180;
      
      // CENTRALIZED ROTATION APPLICATION:
      // This is the ONE place where rotation should be applied to the layer group
      if (this.group) {
        // Record previous rotation to check if something is overriding it
        const previousRotation = this.group.rotation.z;
        
        // CRITICAL FIX: Explicitly enable matrixAutoUpdate to ensure rotation propagates
        this.group.matrixAutoUpdate = true;
        
        // Apply the rotation directly to the group
        this.group.rotation.z = this.currentAngle;
        
        // IMPORTANT: Check every child in the group to ensure they are properly handling parent transformations
        if (window.__layerAngleDebugCounter % 300 === 0) {
          // Every 300 frames, do a deep check of all children
          console.log(`[ROTATION DEEP CHECK] Layer ${this.id} has ${this.group.children.length} direct children`);
          
          this.group.traverse(child => {
            if (child !== this.group) {
              // Check if this child has matrixAutoUpdate disabled
              if (child.matrixAutoUpdate === false) {
                console.warn(`[ROTATION ISSUE] Child of layer ${this.id} has matrixAutoUpdate=false, enabling it`);
                child.matrixAutoUpdate = true;
              }
              
              // Log one child's world matrix to verify rotation is propagating
              if (child.type === 'Group' && this.group.children.indexOf(child) === 0) {
                console.log(`[ROTATION PROPAGATION] First copy group world matrix:`, 
                  child.matrixWorld.elements.slice(0, 4).map(v => v.toFixed(3)),
                  child.matrixWorld.elements.slice(4, 8).map(v => v.toFixed(3))
                );
              }
            }
          });
        }
        
        // Force immediate matrix update
        this.group.updateMatrix();
        this.group.updateMatrixWorld(true);
        
        // Also validate by checking quaternion
        const expectedQuaternion = new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 0, 1), this.currentAngle
        );
        
        // Check if rotation was immediately overridden
        if (this.group.rotation.z !== this.currentAngle) {
          console.error(`[ROTATION OVERRIDE] Layer ${this.id} rotation was overridden immediately! Set to ${this.currentAngle.toFixed(6)} but now ${this.group.rotation.z.toFixed(6)}`);
        }
        
        if (window.__layerAngleDebugCounter % 30 === 0) {
          console.log(`[ROTATION CENTRAL] Layer ${this.id} rotation.z=${this.group.rotation.z.toFixed(6)} radians (${(this.group.rotation.z * 180 / Math.PI).toFixed(2)}°)`);
          console.log(`[ROTATION VALIDATION] Current quaternion: [${this.group.quaternion.x.toFixed(4)}, ${this.group.quaternion.y.toFixed(4)}, ${this.group.quaternion.z.toFixed(4)}, ${this.group.quaternion.w.toFixed(4)}]`);
          
          // Check if rotation changed since last update
          if (Math.abs(previousRotation - this.group.rotation.z) < 0.0001) {
            console.warn(`[ROTATION STALLED] Layer ${this.id} rotation hasn't changed significantly!`);
          }
        }
      }
    }
  }

  /**
   * Make sure camera and renderer are attached to this layer
   * @returns {Object} Object with camera and renderer
   */
  ensureCameraAndRenderer() {
    // Try to find the scene by traversing up the hierarchy
    let currentParent = this.group?.parent;
    let scene = null;
    
    // Traverse up to find the scene object
    while (currentParent && !scene) {
      if (currentParent.type === 'Scene' || currentParent.isScene) {
        scene = currentParent;
        break;
      }
      // Check if this parent has camera/renderer (might be layerContainer)
      if (currentParent.userData?.camera && currentParent.userData?.renderer) {
        return {
          camera: currentParent.userData.camera,
          renderer: currentParent.userData.renderer
        };
      }
      currentParent = currentParent.parent;
    }
    
    // If we found the scene, check for camera/renderer
    if (scene && scene.userData?.camera && scene.userData?.renderer) {
      return {
        camera: scene.userData.camera,
        renderer: scene.userData.renderer
      };
    }
    
    // Try global window references as fallback
    if (window.mainCamera && window.mainRenderer) {
      console.log(`[LAYER ${this.id}] Using global camera and renderer references`);
      return {
        camera: window.mainCamera,
        renderer: window.mainRenderer
      };
    }
    
    // Try scene direct properties as another fallback
    if (scene) {
      if (scene.mainCamera && scene.mainRenderer) {
        console.log(`[LAYER ${this.id}] Using scene direct properties for camera and renderer`);
        return {
          camera: scene.mainCamera,
          renderer: scene.mainRenderer
        };
      }
      
      // Look for camera in scene children
      const cameraInScene = scene.children.find(child => 
        child instanceof THREE.Camera || 
        child.type === 'PerspectiveCamera' || 
        child.type === 'OrthographicCamera'
      );
      
      if (cameraInScene && window.mainRenderer) {
        console.log(`[LAYER ${this.id}] Found camera in scene children, using with global renderer`);
        return {
          camera: cameraInScene,
          renderer: window.mainRenderer
        };
      }
    }
    
    console.warn(`[LAYER ${this.id}] Cannot find camera or renderer in scene hierarchy`);
    return { camera: null, renderer: null };
  }

  /**
   * Update the layer with animation parameters
   * @param {number} currentTime Current time in seconds
   * @param {number} deltaTime Time elapsed since last frame in seconds
   */
  update(currentTime, deltaTime) {
    // Mark initialization as complete after first update
    this.initializationComplete = true;
    
    // Update rotation angle based on time
    this.updateAngle(currentTime);
    
    // Check if we need to fix camera/renderer references
    // Only try to fix if there's a pending check or they're missing
    if (this.cameraPendingCheck || !this.cameraChecked) {
      this.cameraPendingCheck = false;
      this.cameraChecked = true;
      
      // Get references through the hierarchy - try group first
      if (this.group) {
        let cameraRef = null;
        let rendererRef = null;
        
        // Check group userData first
        if (this.group.userData?.camera && this.group.userData?.renderer) {
          cameraRef = this.group.userData.camera;
          rendererRef = this.group.userData.renderer;
        } 
        // Then check parent chain
        else {
          const { camera, renderer } = this.ensureCameraAndRenderer();
          cameraRef = camera;
          rendererRef = renderer;
        }
        
        // If we found references, store them at multiple levels for redundancy
        if (cameraRef && rendererRef) {
          // Store at group level
          this.group.userData = this.group.userData || {};
          this.group.userData.camera = cameraRef;
          this.group.userData.renderer = rendererRef;
          
          // Store at parent level if available
          if (this.group.parent) {
            this.group.parent.userData = this.group.parent.userData || {};
            this.group.parent.userData.camera = cameraRef;
            this.group.parent.userData.renderer = rendererRef;
          }
          
          // Log success only on first setup
          if (!this.cameraSetupLogged) {
            console.log(`[LAYER ${this.id}] Camera and renderer references established`);
            this.cameraSetupLogged = true;
          }
        }
      }
    }
  }

  /**
   * Propagate camera and renderer references to this layer
   * @param {THREE.Camera} camera The camera
   * @param {THREE.Renderer} renderer The renderer
   * @returns {boolean} True if references were successfully set
   */
  propagateCameraAndRenderer(camera, renderer) {
    if (!camera || !renderer) {
      return false;
    }
    
    // Store at group level
    if (this.group) {
      this.group.userData = this.group.userData || {};
      this.group.userData.camera = camera;
      this.group.userData.renderer = renderer;
      
      // Also propagate to all children
      this.group.traverse(child => {
        if (child !== this.group) {
          child.userData = child.userData || {};
          child.userData.camera = camera;
          child.userData.renderer = renderer;
        }
      });
    }
    
    // Store at baseGeo level
    if (this.baseGeo) {
      this.baseGeo.userData = this.baseGeo.userData || {};
      this.baseGeo.userData.camera = camera;
      this.baseGeo.userData.renderer = renderer;
    }
    
    // Mark as checked and set up
    this.cameraChecked = true;
    this.cameraPendingCheck = false;
    
    // Log success only on first setup
    if (!this.cameraSetupLogged) {
      console.log(`[LAYER ${this.id}] Camera and renderer references explicitly set`);
      this.cameraSetupLogged = true;
    }
    
    return true;
  }
} 