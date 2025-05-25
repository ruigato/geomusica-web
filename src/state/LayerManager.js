// src/state/LayerManager.js - Manages multiple layers for the application
import { Layer } from './layer.js';
import * as THREE from 'three';
import { createPolygonGeometry, calculateBoundingSphere } from '../geometry/geometry.js';
import { updateGroup } from '../geometry/geometry.js';
import { detectLayerTriggers, clearLayerMarkers } from '../triggers/triggers.js';
import { resetTriggerSystem } from '../triggers/triggers.js';

// Debug flag to control logging
const DEBUG_LOGGING = false;

// Default layer colors (HSL values)
const DEFAULT_COLORS = [
  { h: 200, s: 100, l: 50 }, // Blue
  { h: 120, s: 100, l: 45 }, // Green
  { h: 0, s: 100, l: 50 },   // Red
  { h: 60, s: 100, l: 50 },  // Yellow
  { h: 300, s: 100, l: 50 }, // Purple
  { h: 30, s: 100, l: 50 },  // Orange
  { h: 270, s: 100, l: 50 }, // Violet
  { h: 160, s: 100, l: 50 }, // Teal
];

/**
 * Manages multiple layers in the application
 */
export class LayerManager {
  /**
   * Create a new layer manager
   * @param {THREE.Scene} scene The Three.js scene
   */
  constructor(scene) {
    this.layers = [];
    this.scene = scene;
    this.activeLayerId = null;
    
    // Add a collection to track external references to layers
    this.layerReferences = new Map();
    
    // Create a container for all layers
    this.layerContainer = new THREE.Group();
    this.layerContainer.name = 'layers';
    
    // IMPORTANT: Make sure the layerContainer is visible
    this.layerContainer.visible = true;
    
    // Copy camera and renderer from scene to layerContainer
    if (scene && scene.userData) {
      this.layerContainer.userData = { ...this.layerContainer.userData };
      
      // Copy camera and renderer references if they exist
      if (scene.userData.camera) {
        this.layerContainer.userData.camera = scene.userData.camera;
      }
      if (scene.userData.renderer) {
        this.layerContainer.userData.renderer = scene.userData.renderer;
      }
      if (scene.userData.globalState) {
        this.layerContainer.userData.globalState = scene.userData.globalState;
      }
      
      
    }
    
    // Add the container to the scene
    this.scene.add(this.layerContainer);
    
    // Initialize intersection tracking
    // DISABLED: Inter-layer intersections are disabled for performance reasons
    this.enableInterLayerIntersections = false; // Explicitly disabled - do not enable
    this.interLayerIntersections = {}; // Map layerId -> array of intersections with other layers
    
    // Track last time intersection calculations were performed
    this.lastIntersectionUpdate = 0;
    
    // Ensure the container is added to the scene and visible
    if (DEBUG_LOGGING) {
      
      
      
    }
    
    // Make manager available globally but via WeakRef to avoid memory leaks
    if (typeof WeakRef !== 'undefined' && typeof window !== 'undefined') {
      // Avoid direct global reference to prevent memory leaks
      const existingManagerRef = window._layersRef;
      if (!existingManagerRef || !(existingManagerRef instanceof WeakRef) || !existingManagerRef.deref()) {
        window._layersRef = new WeakRef(this);
        // Keep a direct reference for backwards compatibility, but can be cleaned up
        window._layers = this;
      }
    }
  }
  
  /**
   * Create a new layer
   * @param {Object} options Layer configuration options
   * @returns {Layer} The created layer
   */
  createLayer(options = {}) {
    const id = this.layers.length;
    
    // Ensure each layer gets a distinct color
    if (!options.color) {
      // Generate a distinct color based on layer ID
      const hue = (id * 60) % 360; // Each layer gets a 60-degree shift in hue
      options.color = new THREE.Color(`hsl(${hue}, 100%, 50%)`);
      if (DEBUG_LOGGING) {
        
      }
    }
    
    const layer = new Layer(id, options);
    
    // Set layer manager reference using WeakRef to prevent circular dependencies
    layer.setLayerManager(this);
    
    // Set initial state values to ensure there's something to render
    // IMPORTANT: Default to having at least 1 copy to make the layer visible
    if (layer.state.copies === 0) {
      layer.state.copies = 3; // Default to 3 copies so something is visible
    }
    
    // Set a distinct number of segments for each layer
    if (layer.state.segments === 3 && id > 0) {
      // First layer is triangle (3), second is square (4), etc.
      layer.state.segments = 3 + id;
      if (DEBUG_LOGGING) {
        
      }
      
      // Make sure the parameter change is registered
      layer.state.parameterChanges.segments = true;
    }
    
    // IMPORTANT: Ensure layer group is visible
    layer.group.visible = true;
    
    // Add the layer's group to the container
    this.layerContainer.add(layer.group);
    
    // Propagate camera and renderer references if available
    if (this.scene && this.scene.userData) {
      const camera = this.scene.userData.camera || this.layerContainer.userData?.camera;
      const renderer = this.scene.userData.renderer || this.layerContainer.userData?.renderer;
      
      if (camera && renderer && typeof layer.propagateCameraAndRenderer === 'function') {
        layer.propagateCameraAndRenderer(camera, renderer);
        if (DEBUG_LOGGING) {
          
        }
      }
    }
    
    // Log for debugging
    if (DEBUG_LOGGING) {
      
      
      
    }
    
    // Add to layer collection
    this.layers.push(layer);
    
    // If this is the first layer, make it active
    if (this.layers.length === 1) {
      this.setActiveLayer(id);
    }
    
    // Create initial geometry for the layer
    this.initializeLayerGeometry(layer);
    
    return layer;
  }
  
  /**
   * Initialize the geometry for a layer
   * @param {Layer} layer The layer to initialize
   */
  initializeLayerGeometry(layer) {
    const state = layer.state;
    const layerId = layer.id;
    
    if (DEBUG_LOGGING) {
      
      
    }
    
    // Ensure we have some reasonable defaults
    state.radius = state.radius || 300;  // LARGER radius for visibility
    state.segments = state.segments || 2;
    state.copies = state.copies || 3;
    
    // Always create fresh geometry
    // Dispose old geometry if it exists
    if (layer.baseGeo && layer.baseGeo.dispose) {
      layer.baseGeo.dispose();
    }
    
    // Create new geometry using THIS LAYER'S state
    layer.baseGeo = createPolygonGeometry(
      state.radius,
      state.segments,
      state  // Use this specific layer's state
    );
    
    if (DEBUG_LOGGING) {
      
    }
    
    // Initialize the group with the geometry
    // IMPORTANT: Using the object parameter pattern for updateGroup - all params must be passed in an options object
    updateGroup({
      group: layer.group,
      state: state,
      layer: layer,
      scene: this.scene,
      baseGeo: layer.baseGeo,
      mat: layer.material,
      copies: state.copies,
      stepScale: state.stepScale,
      segments: state.segments,
      angle: state.angle,
      isLerping: false,
      justCalculatedIntersections: true
    });
    
    if (DEBUG_LOGGING) {
      
    }
  }
  
  /**
   * Set the active layer
   * @param {number} layerId ID of the layer to make active
   */
  setActiveLayer(layerId) {
    // Skip if this is already the active layer
    if (this.activeLayerId === layerId) {
      return;
    }
    
    if (DEBUG_LOGGING) {
      
    
      // Log the current state of the layer we're switching to before making it active
      if (this.layers[layerId]) {
        
      }
    }
    
    // Deactivate the current active layer
    if (this.activeLayerId !== undefined && this.layers[this.activeLayerId]) {
      const previousLayerId = this.activeLayerId;
      const previousLayer = this.layers[previousLayerId];
      
      previousLayer.deactivate();
      if (DEBUG_LOGGING) {
        
      }
    }
    
    // Make the new layer active
    this.layers[layerId].activate();
    this.activeLayerId = layerId;
    if (DEBUG_LOGGING) {
      
    }
    
    // Ensure window._appState is synchronized with the active layer
    this.syncWindowAppState();

    // Force UI update with the new layer's parameters
    const newLayerState = this.layers[layerId].state;
    
    // Force parameter changes to trigger UI updates
    if (newLayerState && newLayerState.parameterChanges) {
      // Mark all parameter changes to force UI updates
      Object.keys(newLayerState.parameterChanges).forEach(key => {
        newLayerState.parameterChanges[key] = true;
      });
      
      if (DEBUG_LOGGING) {
        
      }
    }
    
    // Try direct UI update approaches
    this.forceUIUpdate(layerId, newLayerState);
    
    return this.layers[layerId];
  }
  
  /**
   * Ensure window._appState is synchronized with the active layer
   * This should be called whenever layer structure changes or on regular intervals
   */
  syncWindowAppState() {
    const activeLayer = this.getActiveLayer();
    
    if (activeLayer) {
      // If window._appState doesn't exist or points to wrong state, update it
      if (!window._appState || window._appState !== activeLayer.state) {
        window._appState = activeLayer.state;
        if (DEBUG_LOGGING) {
          
        }
      }
    } else if (window._appState) {
      // If no active layer but window._appState exists, clear it
      window._appState = null;
      if (DEBUG_LOGGING) {
        
      }
    }
  }
  
  /**
   * Force UI update when changing layers using multiple approaches
   * @param {number} layerId ID of the layer
   * @param {Object} layerState The layer's state object
   * @private
   */
  forceUIUpdate(layerId, layerState) {
    // First try using global UI update function
    if (window.updateUIFromState && typeof window.updateUIFromState === 'function') {
      try {
        window.updateUIFromState(layerState);
        if (DEBUG_LOGGING) {
          
        }
      } catch (error) {
        console.error(`[LAYER MANAGER] Error updating UI from state:`, error);
      }
    }
    
    // Also try layer-specific UI update function
    if (window.updateUIForActiveLayer && typeof window.updateUIForActiveLayer === 'function') {
      try {
        window.updateUIForActiveLayer(layerId);
        if (DEBUG_LOGGING) {
          
        }
      } catch (error) {
        console.error(`[LAYER MANAGER] Error updating UI for active layer:`, error);
      }
    }
    
    // Try to dispatch custom event that UI might be listening for
    try {
      const event = new CustomEvent('layerChanged', { 
        detail: { layerId, state: layerState }
      });
      window.dispatchEvent(event);
      if (DEBUG_LOGGING) {
        
      }
    } catch (error) {
      console.error(`[LAYER MANAGER] Error dispatching layer change event:`, error);
    }
  }
  
  /**
   * Get the currently active layer
   * @returns {Layer|null} The active layer or null if none
   */
  getActiveLayer() {
    if (this.activeLayerId !== null && this.activeLayerId < this.layers.length) {
      return this.layers[this.activeLayerId];
    }
    return null;
  }
  
  /**
   * Get active layer state
   * @returns {Object|null} The active layer's state or null
   */
  getActiveLayerState() {
    const activeLayer = this.getActiveLayer();
    return activeLayer ? activeLayer.state : null;
  }
  
  /**
   * Update the number of layers (add or remove as needed)
   * @param {number} count Desired number of layers
   */
  updateLayerCount(count) {
    const currentCount = this.layers.length;
    
    // If we need to add layers
    if (count > currentCount) {
      for (let i = currentCount; i < count; i++) {
        this.createLayer();
      }
    }
    // If we need to remove layers
    else if (count < currentCount) {
      // Remove layers from the end
      for (let i = currentCount - 1; i >= count; i--) {
        this.removeLayer(i);
      }
      
      // Ensure we have a valid active layer
      if (this.activeLayerId >= count) {
        this.setActiveLayer(Math.max(0, count - 1));
      }
    }
  }
  
  /**
   * Remove a layer by ID
   * @param {number} layerId ID of the layer to remove
   */
  removeLayer(layerId) {
    if (layerId < 0 || layerId >= this.layers.length) {
      return;
    }
    
    // Get the layer and dispose its resources
    const layer = this.layers[layerId];
    
    // First remove from the scene to prevent further processing
    if (layer.group && layer.group.parent) {
      layer.group.parent.remove(layer.group);
    }
    
    // Clear intersection data before disposing the layer
    if (typeof layer.clearIntersections === 'function') {
      layer.clearIntersections();
    }
    
    // Clean up any intersection-related data in the scene
    if (this.scene) {
      // Remove intersection markers associated with this layer
      const layerIdStr = layerId.toString();
      this.scene.traverse(object => {
        // Check for intersection marker groups for this layer
        if (object.userData && 
            (object.userData.isIntersectionGroup || object.userData.isIntersectionMarker) && 
            object.userData.layerId === layerId) {
          
          // Dispose of resources
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(m => m && m.dispose && m.dispose());
            } else if (object.material && object.material.dispose) {
              object.material.dispose();
            }
          }
          
          // Remove from parent
          if (object.parent) {
            object.parent.remove(object);
          }
        }
      });
    }
    
    // Clear any manager-specific references to this layer
    // This must happen before layer.dispose() to break circular references
    this.cleanupLayerReferences(layerId);
    
    // Now dispose the layer's resources
    layer.dispose();
    
    // Remove from array
    this.layers.splice(layerId, 1);
    
    // Track layer ID remapping for external references
    const idRemapping = {};
    
    // Update IDs for remaining layers
    for (let i = layerId; i < this.layers.length; i++) {
      // Store the ID remapping (oldId -> newId)
      idRemapping[i + 1] = i;
      
      // Update the layer ID
      this.layers[i].id = i;
      this.layers[i].name = `Layer ${i}`;
      this.layers[i].group.name = `layer-${i}`;
      this.layers[i].group.userData.layerId = i;
      
      // Update the state layerId to match
      if (this.layers[i].state) {
        this.layers[i].state.layerId = i;
      }
    }
    
    // Update active layer if needed
    if (this.activeLayerId === layerId) {
      // Select another layer if available
      if (this.layers.length > 0) {
        this.setActiveLayer(Math.min(layerId, this.layers.length - 1));
      } else {
        this.activeLayerId = null;
        // Clear window._appState if no layers remain
        if (window._appState) {
          window._appState = null;
        }
      }
    } else if (this.activeLayerId > layerId) {
      // Adjust active layer ID if it's after the removed one
      this.activeLayerId--;
    }
    
    // Dispatch an event for other parts of the system to update their references
    this.dispatchLayerRemovalEvent(layerId, idRemapping);
    
    // Reset the trigger system to prevent false triggers
    resetTriggerSystem();
    
    // Force garbage collection if supported by the browser
    if (window.gc) {
      try {
        window.gc();
      } catch (e) {
        // Ignore errors in garbage collection
      }
    }
  }
  
  /**
   * Clean up any manager-specific references to a layer that is being removed
   * @param {number} layerId ID of the layer being removed
   * @private
   */
  cleanupLayerReferences(layerId) {
    // Remove from layerReferences map if present
    this.layerReferences.delete(layerId);
    
    // Clear any scene references to this layer
    if (this.scene && this.scene.userData && this.scene.userData.layers) {
      if (Array.isArray(this.scene.userData.layers)) {
        const index = this.scene.userData.layers.findIndex(l => 
          (l && l.id === layerId) || (l && l.userData && l.userData.layerId === layerId)
        );
        if (index >= 0) {
          this.scene.userData.layers.splice(index, 1);
        }
      } else if (typeof this.scene.userData.layers === 'object') {
        delete this.scene.userData.layers[layerId];
      }
    }
    
    // Clear any global references to this layer
    if (window._activeLayer && window._activeLayer.id === layerId) {
      window._activeLayer = null;
    }
    
    // Update _appState if it was pointing to this layer's state
    if (window._appState && window._appState.layerId === layerId) {
      // Find a new layer to use for _appState
      if (this.layers.length > 0 && this.activeLayerId !== null) {
        window._appState = this.layers[this.activeLayerId].state;
      } else {
        window._appState = null;
      }
    }
  }
  
  /**
   * Dispatch an event to notify the system that layer IDs have changed
   * @param {number} removedLayerId The ID of the removed layer
   * @param {Object} idRemapping Map of old IDs to new IDs
   * @private
   */
  dispatchLayerRemovalEvent(removedLayerId, idRemapping) {
    try {
      const event = new CustomEvent('layerRemoved', {
        detail: {
          removedLayerId,
          idRemapping,
          remainingLayers: this.layers.map(layer => layer.id)
        }
      });
      window.dispatchEvent(event);
      
      if (DEBUG_LOGGING) {
        
      }
    } catch (error) {
      console.error(`[LAYER MANAGER] Error dispatching layer removal event:`, error);
    }
  }
  
  /**
   * Update all layers
   * @param {Object} animationParams Animation parameters from main.js
   */
  async updateLayers(animationParams) {
    const { 
      scene, 
      tNow, 
      dt, 
      angle, 
      lastAngle, 
      triggerAudioCallback,
      activeLayerId, // This is now passed from animation.js
      camera,        // Add camera from animation params
      renderer       // Add renderer from animation params
    } = animationParams;
    
    // Ensure we have the global previous angle for subframe precision
    const previousAngle = animationParams.previousAngle || lastAngle;

    // Ensure all layers have camera and renderer access
    if (camera && renderer) {
      // Use our dedicated method to propagate camera and renderer references
      this.ensureCameraAndRendererForLayers(camera, renderer);
      
      // Set global window references as a fallback
      if (!window.mainCamera) window.mainCamera = camera;
      if (!window.mainRenderer) window.mainRenderer = renderer;
      if (!window.mainScene) window.mainScene = scene;
    } else {
      
    }

    // Ensure we're working with the correct active layer
    if (activeLayerId !== undefined && this.activeLayerId !== activeLayerId) {
      
      // Force sync to the one from animation params
      this.setActiveLayer(activeLayerId);
    }

    // Add frame counter to control logging frequency
    this.frameCounter = (this.frameCounter || 0) + 1;
    const shouldLog = DEBUG_LOGGING && (this.frameCounter % 900 === 0);

    // Check if window._appState is pointing to the correct layer state
    // This handles cases where _appState might have been reassigned elsewhere
    this.syncWindowAppState();

    // Add camera update based on layer geometry
    this.updateCameraForLayerBounds(scene, shouldLog);

    // Debug log all layers' key parameters if logging is enabled
    if (shouldLog) {
      
      this.layers.forEach(layer => {
        
      });
    }

    // Track which layer's geometry was updated this frame for debugging
    const updatedGeometryForLayers = [];
    
    // Track layers that need intersection updates
    const layersNeedingIntersectionUpdates = [];

    // Process each layer
    for (let layerId = 0; layerId < this.layers.length; layerId++) {
      const layer = this.layers[layerId];
      
      // Skip if layer is invalid
      if (!layer) continue;
      
      // Get direct reference to the layer's state
      const state = layer.state;
      
      // Skip processing if state is undefined
      if (!state) continue;
      
      // Check if this is the active layer
      const isActiveLayer = layerId === this.activeLayerId;
      
      // Skip if invisible and not the active layer (active layer should always process)
      if (!layer.visible && !isActiveLayer) {
        continue;
      }
      
      // FIXED: Update lerp values for this layer's state
      // This is required for the Lag parameter to work correctly
      if (state.updateLerp && typeof state.updateLerp === 'function') {
        // Convert ms to seconds for the lerp update
        const dtSeconds = dt / 1000;
        state.updateLerp(dtSeconds);
        
        // Debugging for lerp updates
        if (state.useLerp && shouldLog) {
          
        }
      }
      
      // Reset intersection update flag to prevent constant recalculation
      if (state.justCalculatedIntersections) {
        state.justCalculatedIntersections = false;
      }
      
      // Check if any parameters have changed
      const hasParameterChanges = state.hasParameterChanged();
      
      // Check if we need to update intersections based on parameter changes
      // that would affect geometry (radius, segments, copies, etc.)
      if (hasParameterChanges) {
        // Parameters that affect intersection calculation
        const intersectionRelevantParams = [
          'radius', 'segments', 'copies', 'stepScale', 'angle',
          'useStars', 'starSkip', 'useCuts'
        ];
        
        // Check if any of these parameters changed
        const needsIntersectionUpdate = Object.entries(state.parameterChanges)
          .some(([param, changed]) => changed && intersectionRelevantParams.includes(param));
        
        if (needsIntersectionUpdate) {
          layer.needsIntersectionUpdate = true;
          layersNeedingIntersectionUpdates.push(layerId);
        }
      }
      
      // CRITICAL FIX: Create geometry ONLY for this layer when it's needed
      // This ensures we're updating the correct layer's geometry
      if (!layer.baseGeo || hasParameterChanges) {
        // Dispose old geometry
        if (layer.baseGeo && layer.baseGeo.dispose) {
          layer.baseGeo.dispose();
        }
        
        // Create new geometry using THIS LAYER'S state values (not the active layer)
        layer.baseGeo = createPolygonGeometry(
          state.radius,
          state.segments,
          state  // Use this specific layer's state
        );
        
        // Add necessary userData for trigger detection
        layer.baseGeo.userData.layerId = layerId;
        layer.baseGeo.userData.vertexCount = state.segments;
        
        updatedGeometryForLayers.push(layerId);
        
        // Log geometry recreation for debugging
        if (DEBUG_LOGGING) {
          
        }
      }
      
      // Ensure group has state reference for trigger detection
      if (layer.group) {
        // Don't set state directly since it's now a getter-only property
        // Instead, ensure stateId is set correctly for the getter to use
        layer.group.userData.stateId = layerId;
        
        // Also add layerId to the group's userData for trigger system to identify
        layer.group.userData.layerId = layerId;
      }
      
      // Only update the group if there are parameter changes, we're lerping, or it's the first few frames
      const shouldUpdateGroup = 
        hasParameterChanges || 
        state.isLerping() || 
        state.justCalculatedIntersections ||
        layer.needsIntersectionUpdate || // Add check for layer-specific intersection updates
        this.frameCounter < 10 || // Always update during first few frames for stability
        // Force update if angle is different from target
        (state.useLerp && Math.abs(state.angle - state.targetAngle) > 0.01);
      
      if (shouldUpdateGroup) {
        // Update the group with current parameters - angle here is for cumulative angle between copies
        // IMPORTANT: Using the object parameter pattern for updateGroup - all params must be passed in an options object
        updateGroup({
          group: layer.group,
          state: state,
          layer: layer,
          scene: this.scene,
          baseGeo: layer.baseGeo,
          mat: layer.material,
          copies: state.copies,
          stepScale: state.stepScale,
          segments: state.segments,
          angle: state.angle, // Use the fixed angle between copies, not the animation angle
          isLerping: state.isLerping && typeof state.isLerping === 'function' ? state.isLerping() : false,
          justCalculatedIntersections: state.justCalculatedIntersections
        });
        
        // Check if the layer still needs intersection updates after the updateGroup call
        // If the updateGroup handled the intersections, we can remove it from the pending list
        if (!layer.needsIntersectionUpdate) {
          const index = layersNeedingIntersectionUpdates.indexOf(layerId);
          if (index !== -1) {
            layersNeedingIntersectionUpdates.splice(index, 1);
          }
        }
        
        if ((shouldLog || hasParameterChanges) && DEBUG_LOGGING) {
          
        }
      }
      
      // IMPORTANT: Update the layer's angle with time subdivision applied
      // This is the fix for time subdivision not working
      if (typeof layer.updateAngle === 'function') {
        // Current time in seconds (convert from ms)
        const currentTimeInSeconds = tNow / 1000;
        
        // Store the previous angle before updating
        layer.previousAngle = layer.currentAngle || 0;
        
        // Update with high precision timing
        layer.updateAngle(currentTimeInSeconds);
      }
      
      // IMPORTANT: Apply the rotation using the layer's calculated angle (which includes time subdivision)
      // instead of directly using the global angle
      if (layer.group) {
        // If the layer has a calculated angle (from updateAngle), use it
        // Otherwise fall back to the global angle
        const rotationAngle = (layer.currentAngle !== undefined) ? 
          layer.currentAngle : // This value already includes time subdivision
          ((angle * Math.PI) / 180); // Convert from degrees to radians
          
        layer.group.rotation.z = rotationAngle;
        
        // Occasionally log rotation info for debugging
        if (DEBUG_LOGGING && Math.random() < 0.001) {
          const hasTimeSubdivision = state.useTimeSubdivision && state.timeSubdivisionValue !== 1;
          
        }
      }
      
      // Detect triggers if this layer has copies
      if (state.copies > 0) {
        // Use direct layer trigger detection with the imported function
        detectLayerTriggers(
          layer,
          tNow / 1000, // Convert milliseconds to seconds for subframe trigger system
          (note) => {
            // Add layer ID to the note for routing to correct instrument
            const layerNote = { ...note, layerId: layerId };
            return triggerAudioCallback(layerNote);
          }
        );
      }
      
      // IMPORTANT: Clean up expired markers to allow fading
      clearLayerMarkers(layer);
      
      // Reset parameter change flags
      state.resetParameterChanges();
      
      // Update the layer's lastUpdateTime
      layer.lastUpdateTime = tNow / 1000;
    }
    
    // Process any remaining layers that need intersection updates
    // This is done separately to avoid blocking the main layer update loop
    if (layersNeedingIntersectionUpdates.length > 0) {
      // Use a small delay to avoid blocking the main thread
      setTimeout(() => {
        for (const layerId of layersNeedingIntersectionUpdates) {
          const layer = this.getLayerById(layerId);
          if (layer && layer.needsIntersectionUpdate) {
            this.updateLayerIntersections(layerId);
          }
        }
      }, 0);
    }
    
    // Optional: Calculate inter-layer intersections if needed
    // This is a more advanced feature and might be computationally expensive
    // DISABLED: Inter-layer intersections are explicitly disabled for performance reasons
    // To re-enable, set this.enableInterLayerIntersections to true in the constructor
    if (false && this.enableInterLayerIntersections && this.frameCounter % 30 === 0) {
      // Only calculate every 30 frames to avoid performance impact
      this.detectInterLayerIntersections();
    }
    
    // Log which layers had geometry updates in this frame (if any)
    if (updatedGeometryForLayers.length > 0 && DEBUG_LOGGING) {
      
    }
  }

  /**
   * Update camera position based on layer geometry bounds
   * @param {THREE.Scene} scene The Three.js scene
   * @param {boolean} shouldLog Whether to log debug information
   */
  updateCameraForLayerBounds(scene, shouldLog = false) {
    // Get camera and renderer references from scene userData
    const camera = scene.userData?.camera;
    if (!camera) {
      
      return;
    }

    // Calculate maximum bounding sphere radius from all visible layers
    let maxBoundingRadius = 0;
    let visibleLayerCount = 0;

    for (const layer of this.layers) {
      if (layer.visible && layer.group && layer.state && layer.state.copies > 0) {
        // Calculate bounding radius for this layer
        const boundingRadius = calculateBoundingSphere(layer.group, layer.state);
        maxBoundingRadius = Math.max(maxBoundingRadius, boundingRadius);
        visibleLayerCount++;
      }
    }

    // Use default if no visible layers or invalid calculation
    if (visibleLayerCount === 0 || maxBoundingRadius <= 0) {
      maxBoundingRadius = 500; // Default value
    }

    // Calculate appropriate camera distance (add margin for better view)
    const aspect = camera.aspect || 1;
    const fov = camera.fov || 60;
    const fovRadians = (fov * Math.PI) / 180;
    
    // Calculate distance needed to view the entire bounding sphere
    // Use the smaller dimension (usually height) to ensure everything fits
    const distanceFactor = 1 / Math.tan(fovRadians / 2);
    const margin = 1.2; // 20% margin for better view
    
    // Calculate target distance
    const targetDistance = maxBoundingRadius * distanceFactor * margin;
    
    // Get active layer state for camera control
    const activeLayer = this.getActiveLayer();
    const state = activeLayer?.state;

    if (state) {
      // If target distance is significantly different, update it
      if (Math.abs(state.targetCameraDistance - targetDistance) > 10) {
        // Store previous value for logging
        const previousDistance = state.targetCameraDistance;
        
        // Update target distance
        state.targetCameraDistance = targetDistance;
        
        // Log camera update if requested
        if (shouldLog) {
          
        }
      }
      
      // Update camera with smooth lerping
      state.updateCameraLerp(16.67); // ~60fps time step
      
      // Apply updated camera distance
      camera.position.z = state.cameraDistance;
    }
  }

  /**
   * Force recreation of geometry for a layer
   * @param {number} layerId ID of the layer to recreate geometry for
   */
  recreateLayerGeometry(layerId) {
    if (layerId < 0 || layerId >= this.layers.length) {
      console.error(`Invalid layer ID: ${layerId}`);
      return;
    }
    
    const layer = this.layers[layerId];
    
    // Reset the trigger system to avoid false triggers after geometry change
    resetTriggerSystem();
    
    // Recreate the geometry
    this.initializeLayerGeometry(layer);
    
    return layer;
  }

  /**
   * Force all layers to use their correct colors
   * This can help fix any material color inconsistencies
   */
  forceSyncLayerColors() {
    if (DEBUG_LOGGING) {
      
    }
    
    for (const layer of this.layers) {
      // Make sure the color property is set correctly
      if (!layer.color) {
        // Generate a color based on layer ID
        const hue = (layer.id * 60) % 360;
        layer.color = new THREE.Color(`hsl(${hue}, 100%, 50%)`);
      }
      
      // If material exists, update its color to match the layer's color
      if (layer.material) {
        const oldColor = layer.material.color.getHexString();
        layer.material.color = layer.color;
        layer.material.needsUpdate = true;
        
        // Log the color change
        if (DEBUG_LOGGING) {
          
        }
      }
      
      // Force color update on all children in the group
      if (layer.group) {
        layer.group.traverse(child => {
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                mat.color = layer.color;
                mat.needsUpdate = true;
              });
            } else {
              child.material.color = layer.color;
              child.material.needsUpdate = true;
            }
          }
        });
      }
    }
    
    if (DEBUG_LOGGING) {
      
    }
  }

  /**
   * Debug the active layer and state references
   * Use this to verify that the active layer's state is correctly referenced
   * and all global references point to the same object
   */
  debugActiveLayerState() {
    
    const activeLayer = this.getActiveLayer();
    
    if (!activeLayer) {
      console.error('No active layer found! activeLayerId =', this.activeLayerId);
      return;
    }
    
    
    
    
    // Check if the state's layer ID matches the actual layer ID
    if (activeLayer.state.layerId !== this.activeLayerId) {
      console.error(`MISMATCH: Active layer ID (${this.activeLayerId}) does not match state.layerId (${activeLayer.state.layerId})`);
    } else {
      
    }
    
    // Check if window._appState points to the active layer's state
    if (window._appState === activeLayer.state) {
      
    } else {
      console.error('INCORRECT: window._appState does NOT point to the active layer state');
      
      
    }
    
    // Check if getActiveState returns the active layer's state
    if (typeof window.getActiveState === 'function') {
      const activeState = window.getActiveState();
      if (activeState === activeLayer.state) {
        
      } else {
        console.error('INCORRECT: getActiveState() does NOT return the active layer state');
        
        
      }
    }
    
    
  }

  /**
   * Update a layer's color and ensure it's reflected in all UI and geometry
   * @param {number} layerId ID of the layer to update
   * @param {THREE.Color|string} color The new color
   */
  updateLayerColor(layerId, color) {
    if (layerId < 0 || layerId >= this.layers.length) {
      console.error(`Invalid layer ID for color update: ${layerId}`);
      return;
    }
    
    const layer = this.layers[layerId];
    if (!layer) return;
    
    // Set the new color
    layer.setColor(color);
    
    // Force material update for all children
    if (layer.group) {
      layer.group.traverse(child => {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.color = layer.color;
              mat.needsUpdate = true;
            });
          } else {
            child.material.color = layer.color;
            child.material.needsUpdate = true;
          }
        }
      });
    }
    
    // Update any UI elements if needed
    if (window.updateLayersUI && typeof window.updateLayersUI === 'function') {
      try {
        window.updateLayersUI(this);
      } catch (error) {
        console.error(`Error updating layers UI after color change: ${error.message}`);
      }
    }
    
    // If this is the active layer, force a UI update
    if (layerId === this.activeLayerId) {
      // Update color picker in the UI if it exists
      const colorPicker = document.getElementById('layerColorPicker');
      if (colorPicker) {
        const hexColor = '#' + layer.color.getHexString();
        colorPicker.value = hexColor;
      }
      
      // Update layer buttons
      const updateLayerButtons = window.updateLayerButtons;
      if (typeof updateLayerButtons === 'function') {
        updateLayerButtons(this);
      }
    }
    
    return layer;
  }

  /**
   * Ensure all layers have access to camera and renderer
   * @param {THREE.Camera} camera Camera instance
   * @param {THREE.WebGLRenderer} renderer Renderer instance
   */
  ensureCameraAndRendererForLayers(camera, renderer) {
    if (!camera || !renderer) return;
    
    // Store in scene userData
    if (this.scene) {
      this.scene.userData = this.scene.userData || {};
      this.scene.userData.camera = camera;
      this.scene.userData.renderer = renderer;
      
      // Also set direct properties on scene for older code paths
      this.scene.mainCamera = camera;
      this.scene.mainRenderer = renderer;
    }
    
    // Store in layerContainer userData
    if (this.layerContainer) {
      this.layerContainer.userData = this.layerContainer.userData || {};
      this.layerContainer.userData.camera = camera;
      this.layerContainer.userData.renderer = renderer;
    }
    
    // Store in each layer using the dedicated propagation method
    let successCount = 0;
    for (const layer of this.layers) {
      if (layer) {
        // Use the layer's propagation method if available
        if (typeof layer.propagateCameraAndRenderer === 'function') {
          const success = layer.propagateCameraAndRenderer(camera, renderer);
          if (success) successCount++;
        }
        // Fallback to direct assignment
        else if (layer.group) {
          layer.group.userData = layer.group.userData || {};
          layer.group.userData.camera = camera;
          layer.group.userData.renderer = renderer;
          successCount++;
        }
      }
    }
    
    // Log success
    
    
    return { camera, renderer };
  }

  /**
   * Update intersections for a specific layer
   * @param {number} layerId ID of the layer to update intersections for
   * @returns {boolean} True if the update was successful
   */
  updateLayerIntersections(layerId) {
    console.log(`[LAYER MANAGER] updateLayerIntersections called for layer ${layerId}`);
    
    // Find the layer
    const layer = this.getLayerById(layerId);
    if (!layer) {
      console.warn(`[LAYER MANAGER] Layer ${layerId} not found for intersection update`);
      return false;
    }
    
    // Trigger intersection update
    if (typeof layer.updateIntersections === 'function') {
      console.log(`[LAYER MANAGER] Calling updateIntersections on layer ${layerId}`);
      layer.updateIntersections();
      
      // For star cuts, ensure the state's needsIntersectionUpdate flag is set
      if (layer.state && layer.state.useStars && layer.state.useCuts && layer.state.starSkip > 1) {
        layer.state.needsIntersectionUpdate = true;
        console.log(`[LAYER MANAGER] Set needsIntersectionUpdate for star cuts on layer ${layerId}`);
      }
      
      return true;
    }
    
    console.warn(`[LAYER MANAGER] Layer ${layerId} does not have updateIntersections method`);
    return false;
  }
  
  /**
   * Clear intersections for all layers
   */
  clearAllIntersections() {
    for (const layer of this.layers) {
      if (layer && typeof layer.clearIntersections === 'function') {
        layer.clearIntersections();
      }
      
      // Reset state flags if present
      if (layer.state) {
        layer.state.needsIntersectionUpdate = false;
        layer.state.justCalculatedIntersections = false;
      }
    }
  }
  
  /**
   * Get intersection points for a specific layer
   * @param {number} layerId ID of the layer to get intersections for
   * @returns {Array<Object>|null} Array of intersection points or null if layer not found
   */
  getLayerIntersections(layerId) {
    const layer = this.getLayerById(layerId);
    if (!layer) {
      return null;
    }
    
    // Return a copy of the intersections array to prevent unintended modifications
    return layer.intersectionPoints ? [...layer.intersectionPoints] : [];
  }
  
  /**
   * Find layer by ID
   * @param {number} id Layer ID to find
   * @returns {Layer|null} Layer object or null if not found
   */
  getLayerById(id) {
    return this.layers.find(layer => layer.id === id) || null;
  }
  
  /**
   * Detect and calculate intersections between layers
   * @param {Array<number>} layerIds IDs of layers to find intersections between (defaults to all visible layers)
   * @returns {Object} Object mapping layer IDs to arrays of intersection points with other layers
   */
  detectInterLayerIntersections(layerIds = null) {
    // If no layer IDs provided, use all visible layers
    const targetLayers = layerIds 
      ? layerIds.map(id => this.getLayerById(id)).filter(layer => layer && layer.visible)
      : this.layers.filter(layer => layer && layer.visible);
    
    // Early return if we don't have at least 2 layers to check
    if (targetLayers.length < 2) {
      return {};
    }
    
    const interLayerIntersections = {};
    
    // Initialize result object
    for (const layer of targetLayers) {
      interLayerIntersections[layer.id] = [];
    }
    
    // For each pair of layers, find intersections
    for (let i = 0; i < targetLayers.length; i++) {
      const layerA = targetLayers[i];
      
      for (let j = i + 1; j < targetLayers.length; j++) {
        const layerB = targetLayers[j];
        
        // Skip if either layer doesn't have geometry
        if (!layerA.baseGeo || !layerB.baseGeo) {
          continue;
        }
        
        // In a real implementation, we would calculate actual intersections between the layers here
        // For now, we just create placeholder code that would be filled in with actual intersection detection
        
        // Store that these layers were processed
        if (!interLayerIntersections[layerA.id]) {
          interLayerIntersections[layerA.id] = [];
        }
        if (!interLayerIntersections[layerB.id]) {
          interLayerIntersections[layerB.id] = [];
        }
        
        // The actual intersection calculation would happen here
        // This would analyze the geometry of both layers and find intersection points
      }
    }
    
    return interLayerIntersections;
  }
} 