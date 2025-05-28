// src/state/LayerManager.js - Manages multiple layers for the application
import { Layer } from './layer.js';
import * as THREE from 'three';
import { createPolygonGeometry, calculateBoundingSphere } from '../geometry/geometry.js';
import { updateGroup } from '../geometry/geometry.js';
// Plain intersection processing now happens in updateGroup after copies are created
import { detectLayerTriggers, clearLayerMarkers } from '../triggers/triggers.js';
import { resetTriggerSystem } from '../triggers/triggers.js';
import { generateSineWaveColorPalette } from '../utils/colorPalette.js';

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
    
    // Note: Plain intersection processing now happens AFTER copies are created in updateGroup
    // This ensures intersections are calculated between actual transformed copies
    
    if (DEBUG_LOGGING) {
      
    }
    
    // Initialize the group with the geometry
    updateGroup(
      layer.group,
      state.copies,
      state.stepScale,
      layer.baseGeo,
      layer.material,
      state.segments,
      state.angle,
      state,  // Use this specific layer's state
      false,
      true  // Force intersection recalculation
    );
    
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
   * Remove a layer by ID with proper cleanup to prevent memory leaks
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
      
      // Check if parameters that affect layer links have changed
      const layerLinkAffectingChanges = hasParameterChanges && (
        state.parameterChanges.copies ||
        state.parameterChanges.segments ||
        state.parameterChanges.radius ||
        state.parameterChanges.stepScale ||
        state.parameterChanges.angle
      );
      
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
        
        // Note: Plain intersection processing now happens AFTER copies are created in updateGroup
        // This ensures intersections are calculated between actual transformed copies
        
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
        this.frameCounter < 10 || // Always update during first few frames for stability
        // Force update if angle is different from target
        (state.useLerp && Math.abs(state.angle - state.targetAngle) > 0.01);
      
      if (shouldUpdateGroup) {
        // Update the group with current parameters - angle here is for cumulative angle between copies
        updateGroup(
          layer.group,
          state.copies,
          state.stepScale,
          layer.baseGeo,
          layer.material,
          state.segments,
          state.angle, // Use the fixed angle between copies, not the animation angle
          state,  // Use this specific layer's state
          state.isLerping(),
          state.justCalculatedIntersections
        );
        
        if ((shouldLog || hasParameterChanges) && DEBUG_LOGGING) {
          
        }
        
        // Update layer links if this layer is involved in linking and parameters affecting links changed
        if (layerLinkAffectingChanges) {
          // Import and update layer link manager if parameters that affect vertex positions changed
          import('../geometry/layerLink.js').then(module => {
            if (module.layerLinkManager.enabled && 
                (layerId === module.layerLinkManager.fromLayerId || layerId === module.layerLinkManager.toLayerId)) {
              module.layerLinkManager.updateLinks(this);
            }
          }).catch(error => {
            // Silently ignore if layer link module is not available
          });
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
   * Apply sine wave color palette to all layers
   * @param {Object} options - Palette configuration options
   */
  applySineWaveColors(options = {}) {
    try {
      // Handle edge case of no layers
      if (this.layers.length === 0) {
        console.warn('applySineWaveColors: No layers to apply colors to');
        return;
      }

      const colors = generateSineWaveColorPalette(
        this.layers.length,
        options.offset || 0.125,
        options.brightness || 1.0,
        options.saturation || 1.0
      );
      
      // Apply colors to each layer
      this.layers.forEach((layer, index) => {
        if (layer && typeof layer.setColor === 'function') {
          layer.setColor(colors[index]);
          
          // Force material update for all children in the layer's group
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
        } else {
          console.warn(`applySineWaveColors: Layer ${index} does not have a setColor method`);
        }
      });
      
      // Force UI update
      if (typeof window.updateLayersUI === 'function') {
        window.updateLayersUI(this);
      }
      
      // Update layer buttons
      if (typeof window.updateLayerButtons === 'function') {
        window.updateLayerButtons(this);
      }
      
      // Update color picker if active layer changed
      const activeLayer = this.getActiveLayer();
      if (activeLayer) {
        const colorPicker = document.getElementById('layerColorPicker');
        if (colorPicker) {
          const hexColor = '#' + activeLayer.color.getHexString();
          colorPicker.value = hexColor;
        }
      }
      
      console.log(`Applied sine wave colors to ${this.layers.length} layers`);
    } catch (error) {
      console.error('Error applying sine wave colors:', error);
    }
  }

  /**
   * Reset a single layer to default values while preserving its color
   * @param {number} layerId The ID of the layer to reset
   * @returns {boolean} True if successful, false otherwise
   */
  resetLayerToDefaults(layerId) {
    if (layerId < 0 || layerId >= this.layers.length) {
      console.error(`[LayerManager] Invalid layer ID: ${layerId}`);
      return false;
    }

    const layer = this.layers[layerId];
    if (!layer || !layer.state) {
      console.error(`[LayerManager] Layer ${layerId} not found or has no state`);
      return false;
    }

    console.log(`[LayerManager] Resetting layer ${layerId} to defaults`);

    // Store the current color
    const currentColor = layer.color.clone();
    console.log(`[LayerManager] Preserving color: ${currentColor.getHexString()}`);

    // Reset the layer's state to defaults
    this.resetLayerStateToDefaults(layer.state);

    // Set uniform base values for all layers
    layer.state.copies = 0;
    layer.state.segments = 3; // Keep segments as triangle for base shape
    layer.state.radius = 432; // Standard radius
    layer.state.stepScale = 1;
    layer.state.angle = 15;
    layer.state.startingAngle = 0;

    // Set note parameters to modulo 1
    layer.state.durationMode = 'modulo';
    layer.state.durationModulo = 1;
    layer.state.velocityMode = 'modulo';
    layer.state.velocityModulo = 1;

    console.log(`[LayerManager] Set uniform defaults: copies=${layer.state.copies}, segments=${layer.state.segments}, radius=${layer.state.radius}, angle=${layer.state.angle}, stepScale=${layer.state.stepScale}`);

    // Restore the original color
    layer.setColor(currentColor);
    console.log(`[LayerManager] Restored color: ${layer.color.getHexString()}`);

    // Force parameter changes to update
    layer.state.parameterChanges.copies = true;
    layer.state.parameterChanges.segments = true;
    layer.state.parameterChanges.radius = true;
    layer.state.parameterChanges.stepScale = true;
    layer.state.parameterChanges.angle = true;
    layer.state.parameterChanges.startingAngle = true;
    layer.state.parameterChanges.durationMode = true;
    layer.state.parameterChanges.durationModulo = true;
    layer.state.parameterChanges.velocityMode = true;
    layer.state.parameterChanges.velocityModulo = true;

    // Force geometry recreation
    this.initializeLayerGeometry(layer);

    // Force UI update to reflect the reset
    if (typeof window.syncStateAcrossSystems === 'function') {
      window.syncStateAcrossSystems(true);
    }

    console.log(`[LayerManager] Layer ${layerId} reset to uniform defaults with preserved color`);

    return true;
  }

  /**
   * Reset all layers to their default configurations
   * @returns {boolean} True if successful, false otherwise
   */
  resetAllLayersToDefaults() {
    if (DEBUG_LOGGING) {
      console.log('[LayerManager] Resetting all layers to defaults');
    }

    // Clear existing layers except keep the structure
    this.layers.forEach(layer => {
      if (layer.group && layer.group.parent) {
        layer.group.parent.remove(layer.group);
      }
      if (layer.baseGeo && layer.baseGeo.dispose) {
        layer.baseGeo.dispose();
      }
    });
    
    // Clear the layers array
    this.layers = [];
    
    // Clear the layer container
    this.layerContainer.clear();
    
    // Recreate the default layers as defined in createDefaultLayers
    
    // Create the first layer (triangle)
    const layer0 = this.createLayer({
      visible: true,
      radius: 200,
      segments: 3,  // Triangle
      copies: 3
    });
    
    // Configure first layer with all default values
    layer0.state.copies = 3;
    layer0.state.segments = 3;
    layer0.state.radius = 80;
    layer0.state.stepScale = 1.5;
    layer0.state.angle = 0;
    layer0.state.startingAngle = 0;
    
    // Reset all other state properties to defaults
    this.resetLayerStateToDefaults(layer0.state);
    
    layer0.setColor(new THREE.Color(0x00ff00)); // Green
    
    // Force parameter changes to update for layer 0
    layer0.state.parameterChanges.copies = true;
    layer0.state.parameterChanges.segments = true;
    layer0.state.parameterChanges.radius = true;
    layer0.state.parameterChanges.stepScale = true;
    
    // Create the second layer (square)
    const layer1 = this.createLayer({
      visible: true,
      radius: 180,
      segments: 4,  // Square
      copies: 4
    });
    
    // Configure second layer with all default values
    layer1.state.copies = 4;
    layer1.state.segments = 4;
    layer1.state.radius = 180;
    layer1.state.stepScale = 1.3;
    layer1.state.angle = 0;
    layer1.state.startingAngle = 0;
    
    // Reset all other state properties to defaults
    this.resetLayerStateToDefaults(layer1.state);
    
    layer1.setColor(new THREE.Color(0x0088ff)); // Blue
    
    // Force parameter changes to update for layer 1
    layer1.state.parameterChanges.copies = true;
    layer1.state.parameterChanges.segments = true;
    layer1.state.parameterChanges.radius = true;
    layer1.state.parameterChanges.stepScale = true;
    
    // Create the third layer (pentagon)
    const layer2 = this.createLayer({
      visible: true,
      radius: 160,
      segments: 5,  // Pentagon
      copies: 5
    });
    
    // Configure third layer with all default values
    layer2.state.copies = 5;
    layer2.state.segments = 5;
    layer2.state.radius = 160;
    layer2.state.stepScale = 1.2;
    layer2.state.angle = 0;
    layer2.state.startingAngle = 0;
    
    // Reset all other state properties to defaults
    this.resetLayerStateToDefaults(layer2.state);
    
    layer2.setColor(new THREE.Color(0xff5500)); // Orange
    
    // Force parameter changes to update for layer 2
    layer2.state.parameterChanges.copies = true;
    layer2.state.parameterChanges.segments = true;
    layer2.state.parameterChanges.radius = true;
    layer2.state.parameterChanges.stepScale = true;
    
    // Set the first layer as active
    this.setActiveLayer(0);
    
    // Ensure visibility of all layers
    layer0.setVisible(true);
    layer1.setVisible(true);
    layer2.setVisible(true);
    
    // Force UI update to reflect the reset
    if (typeof window.syncStateAcrossSystems === 'function') {
      window.syncStateAcrossSystems(true);
    }
    
    // Update layer UI if it exists
    if (typeof window.updateLayerButtons === 'function') {
      window.updateLayerButtons(this);
    }
    
    if (DEBUG_LOGGING) {
      console.log('[LayerManager] Reset complete - created 3 default layers');
    }
    
    return true;
  }

  /**
   * Reset a layer's state to default values
   * @param {Object} state The layer state to reset
   */
  resetLayerStateToDefaults(state) {
    // Define fallback default values in case import fails
    const fallbackDefaults = {
      DELETE_MIN: 1,
      DELETE_MAX: 4,
      DELETE_SEED: 0,
      DELETE_MODE: 'pattern',
      DELETE_TARGET: 'points',
      MODULUS_VALUE: 2,
      TIME_SUBDIVISION_VALUE: 1,
      QUANTIZATION_VALUE: 4,
      ALT_SCALE: 1.0,
      ALT_STEP_N: 2,
      LERP_TIME: 1.0,
      SHOW_AXIS_FREQ_LABELS: false,
      SHOW_POINTS_FREQ_LABELS: false
    };

    // Reset all boolean flags to false
    state.useFractal = false;
    state.useEuclid = false;
    state.useStars = false;
    state.useDelete = false;
    state.useCuts = false;
    state.useTesselation = false;
    state.useModulus = false;
    state.useTimeSubdivision = false;
    state.useQuantization = false;
    state.useAltScale = false;
    state.useLerp = false;
    state.useIntersections = false;
    state.usePlainIntersections = false;
    
    // Reset numeric values to defaults (using fallbacks first)
    state.fractalValue = 1;
    state.euclidValue = 3;
    state.starSkip = 1;
    state.deleteMin = fallbackDefaults.DELETE_MIN;
    state.deleteMax = fallbackDefaults.DELETE_MAX;
    state.deleteSeed = fallbackDefaults.DELETE_SEED;
    state.deleteMode = fallbackDefaults.DELETE_MODE;
    state.deleteTarget = fallbackDefaults.DELETE_TARGET;
    state.modulusValue = fallbackDefaults.MODULUS_VALUE;
    state.timeSubdivisionValue = fallbackDefaults.TIME_SUBDIVISION_VALUE;
    state.quantizationValue = fallbackDefaults.QUANTIZATION_VALUE;
    state.altScale = fallbackDefaults.ALT_SCALE;
    state.altStepN = fallbackDefaults.ALT_STEP_N;
    state.lerpTime = fallbackDefaults.LERP_TIME;
    
    // Reset duration and velocity parameters
    state.durationMode = 'modulo';
    state.durationModulo = 3;
    state.minDuration = 0.1;
    state.maxDuration = 0.5;
    state.velocityMode = 'modulo';
    state.velocityModulo = 4;
    state.minVelocity = 0.3;
    state.maxVelocity = 0.9;
    
    // Reset shape type
    state.shapeType = 'regular';
    state.forceRegularStarPolygon = false;
    
    // Reset frequency label settings
    state.showAxisFreqLabels = fallbackDefaults.SHOW_AXIS_FREQ_LABELS;
    state.showPointsFreqLabels = fallbackDefaults.SHOW_POINTS_FREQ_LABELS;
    
    // Clear arrays and sets
    state.lastTrig = new Set();
    state.markers = [];
    state.pointFreqLabels = [];
    state.intersectionPoints = [];
    
    // Reset flags
    state.needsIntersectionUpdate = false;
    state.needsPointFreqLabelsUpdate = false;
    state.justCalculatedIntersections = false;
    state.debug = false;
    
    // Reset all parameter change flags
    if (typeof state.resetParameterChanges === 'function') {
      state.resetParameterChanges();
    }

    // Try to import DEFAULT_VALUES to override with actual defaults
    import('../config/constants.js').then(({ DEFAULT_VALUES }) => {
      // Override with actual default values if available
      state.deleteMin = DEFAULT_VALUES.DELETE_MIN || fallbackDefaults.DELETE_MIN;
      state.deleteMax = DEFAULT_VALUES.DELETE_MAX || fallbackDefaults.DELETE_MAX;
      state.deleteSeed = DEFAULT_VALUES.DELETE_SEED || fallbackDefaults.DELETE_SEED;
      state.deleteMode = DEFAULT_VALUES.DELETE_MODE || fallbackDefaults.DELETE_MODE;
      state.deleteTarget = DEFAULT_VALUES.DELETE_TARGET || fallbackDefaults.DELETE_TARGET;
      state.modulusValue = DEFAULT_VALUES.MODULUS_VALUE || fallbackDefaults.MODULUS_VALUE;
      state.timeSubdivisionValue = DEFAULT_VALUES.TIME_SUBDIVISION_VALUE || fallbackDefaults.TIME_SUBDIVISION_VALUE;
      state.quantizationValue = DEFAULT_VALUES.QUANTIZATION_VALUE || fallbackDefaults.QUANTIZATION_VALUE;
      state.altScale = DEFAULT_VALUES.ALT_SCALE || fallbackDefaults.ALT_SCALE;
      state.altStepN = DEFAULT_VALUES.ALT_STEP_N || fallbackDefaults.ALT_STEP_N;
      state.lerpTime = DEFAULT_VALUES.LERP_TIME || fallbackDefaults.LERP_TIME;
      state.showAxisFreqLabels = DEFAULT_VALUES.SHOW_AXIS_FREQ_LABELS || fallbackDefaults.SHOW_AXIS_FREQ_LABELS;
      state.showPointsFreqLabels = DEFAULT_VALUES.SHOW_POINTS_FREQ_LABELS || fallbackDefaults.SHOW_POINTS_FREQ_LABELS;
      
      if (DEBUG_LOGGING) {
        console.log('[LayerManager] Applied actual DEFAULT_VALUES to layer state');
      }
    }).catch(error => {
      if (DEBUG_LOGGING) {
        console.warn('Could not import DEFAULT_VALUES for state reset, using fallbacks:', error);
      }
    });
  }
} 