// src/state/layer.js - Layer class for multi-layer architecture
import { createAppState } from './state.js';
import * as THREE from 'three';
import { createPolygonGeometry, updateGroup } from '../geometry/geometry.js';
import { getCurrentTime } from '../time/time.js';
import { clearLayerPointLabels } from '../ui/domLabels.js';

// Debug flag to control logging
const DEBUG_LOGGING = false;

/**
 * Get current time safely, falling back to performance timing if audio timing isn't ready
 * @returns {number} Current time in seconds
 */
function getSafeTime() {
  try {
    return getCurrentTime();
  } catch (e) {
    return performance.now() / 1000;
  }
}

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
    
    // Store layer ID instead of direct reference to avoid circular references
    this.state.layerId = id;
    // REMOVED: this.state.layerRef = this; // This line created circular reference
    
    // Use WeakRef for layer manager reference to avoid memory retention
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
      
      
    }
    
    // Override the setRadius, setSegments, and setCopies methods to add layer-specific logging
    const originalSetRadius = this.state.setRadius;
    this.state.setRadius = (value) => {
      if (DEBUG_LOGGING) {
        
      }
      return originalSetRadius.call(this.state, value);
    };
    
    const originalSetSegments = this.state.setSegments;
    this.state.setSegments = (value) => {
      if (DEBUG_LOGGING) {
        
      }
      return originalSetSegments.call(this.state, value);
    };
    
    const originalSetCopies = this.state.setCopies;
    this.state.setCopies = (value) => {
      if (DEBUG_LOGGING) {
        
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
    
    // Instead of storing a direct reference to state, store state ID
    // This prevents circular references while allowing state lookup when needed
    this.group.userData.stateId = this.id;
    // Make state accessible via a getter to avoid circular references
    Object.defineProperty(this.group.userData, 'state', {
      get: () => {
        // This creates a temporary reference only when needed
        return this.state;
      },
      configurable: true
    });
    
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
   * Activate this layer (make it the current active layer)
   */
  activate() {
    this.active = true;
    if (DEBUG_LOGGING) {
      
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
        
      }
      return this.state._originalMethods.setRadius.call(this.state, value);
    };
    
    this.state.setSegments = (value) => {
      if (DEBUG_LOGGING) {
        
      }
      return this.state._originalMethods.setSegments.call(this.state, value);
    };
    
    this.state.setCopies = (value) => {
      if (DEBUG_LOGGING) {
        
      }
      return this.state._originalMethods.setCopies.call(this.state, value);
    };
    
    // Mark all parameters as changed to force UI updates
    if (this.state.parameterChanges) {
      Object.keys(this.state.parameterChanges).forEach(key => {
        this.state.parameterChanges[key] = true;
      });
      
      if (DEBUG_LOGGING) {
        
      }
    }
    
    // Update window._appState to point to this layer's state
    if (window._appState !== this.state) {
      window._appState = this.state;
      if (DEBUG_LOGGING) {
        
      }
    }
    
    // FIXED: Initialize timing variables from centralized timing system
    // This prevents timing jumps when switching between layers
    const globalState = this.group?.userData?.globalState;
    if (globalState) {
      // Get the time subdivision multiplier for this layer
      const timeSubdivisionMultiplier = this.state.useTimeSubdivision ? 
        (this.state.timeSubdivisionValue || 1) : 1;
      
      // FIXED: Only initialize angle if not already set to prevent jumps when switching
      // Use existing values if available, only get new ones if this is first activation
      if (this.currentAngle === undefined) {
        // Use the global timing system to get initial angle data for this layer
        const angleData = globalState.getLayerAngleData(
          this.id,
          timeSubdivisionMultiplier
        );
        
        // Use the angle data directly
        this.currentAngle = angleData.angleRadians;
        this.previousAngle = this.currentAngle;
        this.accumulatedAngle = angleData.angleDegrees;
        this.lastUpdateTime = angleData.lastUpdateTime;
      }
      
      // Just update the multiplier in the global timing system
      // without changing the angle or timing
      globalState.getLayerAngleData(
        this.id,
        timeSubdivisionMultiplier
      );
    }
    
    // FIXED: Don't recreate geometry when activating a layer - only check if it's completely missing
    // Only call ensureValidGeometry if the layer has no geometry at all
    if (!this.baseGeo || !this.group || this.group.children.length === 0) {
      this.ensureValidGeometry();
    } else {
      // Just ensure the layer and group are visible
      this.visible = true;
      if (this.group) {
        this.group.visible = true;
      }
      
      // Ensure the baseGeo has proper userData for trigger detection
      if (this.baseGeo && !this.baseGeo.userData.layerId) {
        this.baseGeo.userData.layerId = this.id;
        this.baseGeo.userData.vertexCount = this.state.segments;
      }
    }
    
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
        
      }
    } else if (DEBUG_LOGGING) {
      
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
        
      }
      this.recreateGeometry();
    }
    
    // Ensure the geometry has the necessary userData for trigger detection
    if (this.baseGeo && !this.baseGeo.userData.layerId) {
      this.baseGeo.userData.layerId = this.id;
      this.baseGeo.userData.vertexCount = this.state.segments;
      if (DEBUG_LOGGING) {
        
      }
    }
    
    // Ensure the group has the state reference for trigger detection
    if (this.group) {
      // Don't set state directly since it's now a getter-only property
      // Instead, ensure stateId is set correctly which the getter uses
      this.group.userData.stateId = this.id;
      
      // Check if the state getter is working by reading it
      if (DEBUG_LOGGING && this.group.userData.state !== this.state) {
        console.warn(`[LAYER ${this.id}] State getter not working properly`);
      }
      
      // Make sure the group is visible
      if (!this.group.visible) {
        this.group.visible = true;
        if (DEBUG_LOGGING) {
          
        }
      }
    }
    
    // Initialize lastTrig set if it doesn't exist
    if (!this.state.lastTrig) {
      this.state.lastTrig = new Set();
      if (DEBUG_LOGGING) {
        
      }
    }
  }
  
  /**
   * Dispose of all resources and break all circular references
   */
  dispose() {
    // FIXED Phase 3: Clear this layer's point frequency labels
    try {
      if (this.id !== null && this.id !== undefined) {
        clearLayerPointLabels(this.id);
      }
    } catch (error) {
      console.error(`[LAYER] Error clearing labels for layer ${this.id}:`, error);
    }
    
    // Get a reference to the layer manager before we clear our reference to it
    const layerManager = this.getLayerManager();
    
    // Remove layer from parent scene properly
    if (this.group && this.group.parent) {
      this.group.parent.remove(this.group);
    }

    // Clean up Three.js materials and geometries in all traversed objects
    if (this.group) {
      this.group.traverse((child) => {
        // Dispose of geometries
        if (child.geometry && child.geometry.dispose) {
          child.geometry.dispose();
        }
        
        // Dispose of materials (handle both single materials and arrays)
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(material => {
              if (material && material.dispose) {
                // Dispose textures if present
                if (material.map) material.map.dispose();
                if (material.lightMap) material.lightMap.dispose();
                if (material.bumpMap) material.bumpMap.dispose();
                if (material.normalMap) material.normalMap.dispose();
                if (material.specularMap) material.specularMap.dispose();
                if (material.envMap) material.envMap.dispose();
                
                material.dispose();
              }
            });
          } else if (child.material.dispose) {
            // Dispose textures if present
            if (child.material.map) child.material.map.dispose();
            if (child.material.lightMap) child.material.lightMap.dispose();
            if (child.material.bumpMap) child.material.bumpMap.dispose();
            if (child.material.normalMap) child.material.normalMap.dispose();
            if (child.material.specularMap) child.material.specularMap.dispose();
            if (child.material.envMap) child.material.envMap.dispose();
            
            child.material.dispose();
          }
        }
        
        // Remove any event listeners
        if (child.userData && child.userData.eventListeners) {
          for (const [eventType, listener] of Object.entries(child.userData.eventListeners)) {
            child.removeEventListener(eventType, listener);
          }
          child.userData.eventListeners = null;
        }
        
        // Break any references to the state object in userData
        if (child.userData && child.userData.state === this.state) {
          // If we added a getter property for state, delete it
          if (Object.getOwnPropertyDescriptor(child.userData, 'state')?.get) {
            delete child.userData.state;
          } else {
            // Otherwise just null it out
            child.userData.state = null;
          }
        }
        
        // If stateId exists, null it out
        if (child.userData && child.userData.stateId === this.id) {
          child.userData.stateId = null;
        }
        
        // Clear all userData references
        if (child.userData) {
          for (const key in child.userData) {
            child.userData[key] = null;
          }
        }
      });
    }
    
    // Dispose base geometry if it exists
    if (this.baseGeo && this.baseGeo.dispose) {
      this.baseGeo.dispose();
    }
    
    // Dispose material if it exists
    if (this.material && this.material.dispose) {
      this.material.dispose();
    }
    
    // Clear all Map/Set collections
    if (this.prevWorldVertices instanceof Map) {
      this.prevWorldVertices.clear();
      this.prevWorldVertices = null;
    }
    
    if (this.lastTrig instanceof Set) {
      this.lastTrig.clear();
      this.lastTrig = null;
    }
    
    // Ensure _triggersTimestamps Map is cleared
    if (this._triggersTimestamps instanceof Map) {
      this._triggersTimestamps.clear();
      this._triggersTimestamps = null;
    }
    
    // Clean up state collections
    if (this.state) {
      // Remove circular references in state
      if (this.state.layerRef) {
        this.state.layerRef = null;
      }
      
      if (this.state.lastTrig instanceof Set) {
        this.state.lastTrig.clear();
        this.state.lastTrig = null;
      }
      
      if (this.state.prevWorldVertices instanceof Map) {
        this.state.prevWorldVertices.clear();
        this.state.prevWorldVertices = null;
      }
      
      // Clear any other collections in state
      for (const key in this.state) {
        if (this.state[key] instanceof Map || this.state[key] instanceof Set) {
          this.state[key].clear();
          this.state[key] = null;
        }
      }
      
      // Clear state references that might be circular
      this.state.layerId = null;
      
      // Remove this layer's state from global _appState if it's the same
      if (window._appState === this.state) {
        // Try to set _appState to another layer's state if available
        if (layerManager && layerManager.layers) {
          const otherLayer = layerManager.layers.find(l => l !== this && l.state);
          if (otherLayer) {
            window._appState = otherLayer.state;
          } else {
            window._appState = null;
          }
        } else {
          window._appState = null;
        }
      }
    }
    
    // Clear layer manager reference - must be done after the above uses of layerManager
    this._layerManagerRef = null;
    
    // Clear markers array
    if (this.markers && Array.isArray(this.markers)) {
      // Remove markers from scene if they have parents
      this.markers.forEach(marker => {
        if (marker.parent) {
          marker.parent.remove(marker);
        }
        
        // Dispose marker geometry and material
        if (marker.geometry) marker.geometry.dispose();
        if (marker.material) {
          if (Array.isArray(marker.material)) {
            marker.material.forEach(mat => mat.dispose());
          } else {
            marker.material.dispose();
          }
        }
      });
      
      this.markers.length = 0;
      this.markers = null;
    }
    
    // Clear other references that might cause circular dependencies
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
    // Try getting from WeakRef if available
    if (this._layerManagerRef) {
      // If using WeakRef, dereference it
      if (this._layerManagerRef instanceof WeakRef) {
        return this._layerManagerRef.deref();
      }
      // If direct reference, just return it (for backward compatibility)
      return this._layerManagerRef;
    }
    
    // Try getting from global window if available
    if (window._layers) {
      // Store a weak reference for future use
      this._layerManagerRef = new WeakRef(window._layers);
      return window._layers;
    }
    
    return null;
  }
  
  /**
   * Set layer manager reference using WeakRef to prevent memory leaks
   * @param {LayerManager} layerManager Layer manager instance
   */
  setLayerManager(layerManager) {
    if (!layerManager) {
      this._layerManagerRef = null;
      return;
    }
    
    // Use WeakRef if supported by the browser
    if (typeof WeakRef !== 'undefined') {
      this._layerManagerRef = new WeakRef(layerManager);
    } else {
      // Fallback for browsers without WeakRef support
      // Just store the ID to avoid circular references
      this._layerManagerRef = layerManager;
    }
  }
  
  /**
   * Recreate the geometry for this layer
   * This is used when geometry parameters change
   */
  recreateGeometry() {
    // FIXED: Skip recreation if we just switched to this layer
    if (this._justSwitchedTo) {
      if (DEBUG_LOGGING) {
        console.log(`[LAYER ${this.id}] Skipping geometry recreation after layer switch`);
      }
      return;
    }
    
    // Reset the trigger set to avoid false positives
    if (this.state.lastTrig) {
      this.state.lastTrig.clear();
    }
    
    // Create a dedicated THREE.Group for this layer if it doesn't exist
    if (!this.group) {
      this.group = new THREE.Group();
      this.group.name = `layer-${this.id}`;
      this.group.userData.layerId = this.id;
      
      // Set up state access via getter to avoid circular references
      this.group.userData.stateId = this.id;
      Object.defineProperty(this.group.userData, 'state', {
        get: () => this.state,
        configurable: true
      });
    }
    
    // Check for existing baseGeo and dispose if it exists
    if (this.baseGeo) {
      if (this.baseGeo.dispose) {
        this.baseGeo.dispose();
      }
      this.baseGeo = null;
    }
    
    // Ensure we have a material for this layer
    if (!this.material) {
      this.material = new THREE.LineBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 1.0,
        depthTest: false,
        depthWrite: false,
        linewidth: 2
      });
    }
    
    // Create new geometry
    this.baseGeo = createPolygonGeometry(
      this.state.radius,
      this.state.segments,
      this.state
    );
    
    // Store creation timestamp and layer ID in geometry userData
    this.baseGeo.userData = {
      createdAt: Date.now(),
      layerId: this.id,
      vertexCount: this.state.segments
    };
    
    // Clean up old geometry children from group
    if (this.group.children.length > 0) {
      // Store children we want to keep (not line objects)
      const childrenToKeep = this.group.children.filter(child => {
        // Keep specialized marker objects
        if (child.userData && (
          child.userData.isMarker ||
          child.userData.isIntersectionGroup ||
          child.userData.isAxisLabel
        )) {
          return true;
        }
        
        // Keep any other special objects (camera, lights, etc.)
        if (child.type !== 'Line' && 
            child.type !== 'LineLoop' && 
            child.type !== 'LineSegments') {
          return true;
        }
        
        // Otherwise dispose and remove
        if (child.geometry) {
          child.geometry.dispose();
        }
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
        return false;
      });
      
      // Replace group children with filtered list
      this.group.children.length = 0;
      childrenToKeep.forEach(child => this.group.add(child));
    }
    
    // Add debug sphere at center
    let debugSphere = this.group.children.find(
      child => child.type === 'Mesh' && child.geometry && child.geometry.type === 'SphereGeometry'
    );
    
    if (!debugSphere) {
      const sphereGeo = new THREE.SphereGeometry(5, 8, 8);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: this.color,
        transparent: true,
        opacity: 0.5,
        depthTest: false
      });
      debugSphere = new THREE.Mesh(sphereGeo, sphereMat);
      this.group.add(debugSphere);
    }
    
    if (DEBUG_LOGGING) {
      
    }
    
    // Force the state to update the group
    // DEPRECATED: needsIntersectionUpdate removed
    // this.state.needsIntersectionUpdate = true;
    
    // Log that geometry was recreated
    if (DEBUG_LOGGING) {
      
    }
    
    return this;
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
      
    }
    
    return this;
  }
  
  /**
   * Update the rotation angle for this layer
   * @param {number} currentTime Current time in seconds
   */
  updateAngle(currentTime) {
    // FIXED: Ensure we have a previous angle for continuity
    if (this.currentAngle === undefined) {
      this.currentAngle = 0;
    }
    
    // Store previous angle for marker hit detection
    this.previousAngle = this.currentAngle;
    
    // Get global state manager (which should be attached to the group)
    const globalState = this.group?.userData?.globalState;
    
    if (globalState) {
      // FIXED: Use the centralized timing system instead of our own calculations
      // Get the time subdivision multiplier for this layer
      const timeSubdivisionMultiplier = this.state.useTimeSubdivision ? 
        (this.state.timeSubdivisionValue || 1) : 1;
      
      // FIXED: Ensure we have a valid lastUpdateTime for continuous motion
      if (this.lastUpdateTime === undefined) {
        this.lastUpdateTime = currentTime - 0.016; // Add a small delta to ensure motion
      }
      
      // Use the global timing system to get angle data for this layer
      const angleData = globalState.getLayerAngleData(
        this.id,
        timeSubdivisionMultiplier
      );
      
      // Use the angleRadians directly from the global timing system
      this.currentAngle = angleData.angleRadians;
      
      // Also update our accumulated angle for consistency
      this.accumulatedAngle = angleData.angleDegrees;
    } else {
      // Fallback calculation if no global state is available
      if (DEBUG_LOGGING) {
        console.log('[LAYER] No global state available, using fallback timing');
      }
      
      const currentTime = getSafeTime();
      
      // NEW APPROACH: Use transport-based calculation even in fallback
      // This ensures consistency with the main timing system
      
      // Default BPM for fallback (can be overridden by state if available)
      const fallbackBPM = this.state?.bpm || 120;
      
      // Calculate rotations per second based on BPM
      // 120 BPM = 0.5 rotations per second (1 full revolution per 2 seconds)
      const rotationsPerSecond = fallbackBPM / 240;
      const totalRotations = currentTime * rotationsPerSecond;
      
      // Apply time subdivision to the transport position
      let subdivisionRotations = totalRotations;
      if (this.state && this.state.useTimeSubdivision && this.state.timeSubdivisionValue !== 1) {
        const subdivisionValue = this.state.timeSubdivisionValue;
        subdivisionRotations = totalRotations * subdivisionValue;
      }
      
      // Convert to radians and normalize to 0-2π
      this.currentAngle = (subdivisionRotations * 2 * Math.PI) % (2 * Math.PI);
    }
    
    // Store the time for future delta calculations
    this.lastUpdateTime = getSafeTime();
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
      
      return {
        camera: window.mainCamera,
        renderer: window.mainRenderer
      };
    }
    
    // Try scene direct properties as another fallback
    if (scene) {
      if (scene.mainCamera && scene.mainRenderer) {
        
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
        
        return {
          camera: cameraInScene,
          renderer: window.mainRenderer
        };
      }
    }
    
    
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
      
      this.cameraSetupLogged = true;
    }
    
    return true;
  }
} 