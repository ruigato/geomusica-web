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
   * Initialize layer geometry using current state parameters
   * @param {Layer} layer Layer to initialize geometry for
   */
  initializeLayerGeometry(layer) {
    const state = layer.state;
    const layerId = layer.id;
    
    console.log(`Initializing geometry for layer ${layerId} with radius=${state.radius}, copies=${state.copies}, segments=${state.segments}`);
    
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
    
    console.log(`Created geometry for layer ${layerId}, now updating group`);
    
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
    
    console.log(`Completed geometry initialization for layer ${layerId}`);
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
      console.log(`Activating layer ${layerId}`);
    }

    // Get the layer
    const layer = this.layers[layerId];
    if (!layer) {
      console.error(`Cannot activate layer ${layerId} - not found`);
      return;
    }

    // Deactivate current active layer
    if (this.activeLayerId !== null && this.layers[this.activeLayerId]) {
      this.layers[this.activeLayerId].active = false;
    }

    // Set new active layer
    this.activeLayerId = layerId;
    layer.active = true;

    // Sync state with window._appState for UI
    this.syncWindowAppState();

    // Trigger UI updates for this layer
    this.forceUIUpdate(layerId, layer.state);
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
   * Force UI update for a layer
   * @param {number} layerId Layer ID to update UI for
   * @param {Object} layerState Layer state object
   */
  forceUIUpdate(layerId, layerState) {
    // Skip if no layerState provided
    if (!layerState) {
      return;
    }

    // Try using the global updateUIFromState function
    if (window.updateUIFromState && typeof window.updateUIFromState === 'function') {
      try {
        window.updateUIFromState(layerState);
        if (DEBUG_LOGGING) {
          console.log(`Updated UI from state for layer ${layerId}`);
        }
      } catch (error) {
        console.error(`Error updating UI from state for layer ${layerId}:`, error);
      }
    }

    // Try using the global updateUIForActiveLayer function
    if (window.updateUIForActiveLayer && typeof window.updateUIForActiveLayer === 'function') {
      try {
        window.updateUIForActiveLayer(layerId);
        if (DEBUG_LOGGING) {
          console.log(`Updated UI for active layer ${layerId}`);
        }
      } catch (error) {
        console.error(`Error updating UI for active layer ${layerId}:`, error);
      }
    }

    // Try dispatching a custom event that UI components might listen for
    try {
      const event = new CustomEvent('layerActivated', { 
        detail: { layerId: layerId, state: layerState }
      });
      window.dispatchEvent(event);
      
      if (DEBUG_LOGGING) {
        console.log(`Dispatched layerActivated event for layer ${layerId}`);
      }
    } catch (error) {
      console.error(`Error dispatching layer activated event for layer ${layerId}:`, error);
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
   * Update all layers in the scene
   * @param {Object} animationParams Animation parameters
   * @returns {Promise} Promise that resolves when all layers are updated
   */
  async updateLayers(animationParams) {
    const { 
      scene, time, deltaTime, audioCallback 
    } = animationParams;
    
    // Skip if no layers
    if (!this.layers || this.layers.length === 0) {
      return;
    }
    
    // Add debug logging for animation parameters
    if (Math.random() < 0.01) {
      console.log(`updateLayers called with time=${time}, deltaTime=${deltaTime}`);
    }
    
    // First pass: Update all layers
    for (const layer of this.layers) {
      // Skip if layer is disabled
      if (!layer || !layer.visible) {
        continue;
      }
      
      // Record previous angle for trigger detection
      layer.previousAngle = layer.currentAngle || 0;
      
      // Update layer state - will update currentAngle
      if (typeof layer.update === 'function') {
        layer.update(time, deltaTime);
      } else {
        // If layer doesn't have an update method, just update the angle
        const globalState = layer.state?.globalState || window._globalState;
        
        // Get time subdivision multiplier for this layer
        const timeSubdivisionMultiplier = layer.state?.useTimeSubdivision ? 
          (layer.state.timeSubdivisionValue || 1) : 1;
        
        // Get angle data from global timing system if available
        if (globalState && typeof globalState.getLayerAngleData === 'function') {
          const angleData = globalState.getLayerAngleData(
            layer.id,
            timeSubdivisionMultiplier,
            time
          );
          
          // Set current angle
          layer.currentAngle = angleData.angleRadians;
        } else {
          // Fallback - simple rotation at 45 degrees per second
          layer.currentAngle = (layer.currentAngle || 0) + (Math.PI / 4) * deltaTime * (timeSubdivisionMultiplier || 1);
        }
      }
      
      // Update layer's camera and renderer references if needed
      this.ensureCameraAndRendererForLayers(
        scene?.userData?.camera || window.mainCamera,
        scene?.userData?.renderer || window.mainRenderer
      );
      
      // Skip trigger detection if layer isn't active
      if (!layer.active) {
        continue;
      }
      
      // Skip trigger detection if angle hasn't changed
      if (layer.currentAngle === layer.previousAngle && !layer.state?.isLerping) {
        continue;
      }
      
      // Detect triggers for this layer
      const triggeredPoints = detectLayerTriggers(
        layer,
        time,
        audioCallback
      );
      
      // Handle any triggers (currently handled by detectLayerTriggers internally)
      if (triggeredPoints && triggeredPoints.length > 0 && DEBUG_LOGGING) {
        console.log(`Layer ${layer.id} triggered ${triggeredPoints.length} points`);
      }
    }
    
    // Second pass: Check if we need to update camera position to fit all layers
    if (scene) {
      this.updateCameraForLayerBounds(scene);
    }
  }

  /**
   * Update camera position based on layer geometry bounds
   * @param {THREE.Scene} scene The Three.js scene
   */
  updateCameraForLayerBounds(scene) {
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
        if (DEBUG_LOGGING) {
          
        }
      }
      
      // Update camera with smooth lerping
      state.updateCameraLerp(16.67); // ~60fps time step
      
      // Apply updated camera distance
      camera.position.z = state.cameraDistance;
    }
  }

  /**
   * Recreate the geometry for a specific layer
   * @param {number} layerId ID of the layer to update
   * @returns {boolean} True if geometry was recreated
   */
  recreateLayerGeometry(layerId) {
    // Get the layer
    const layer = this.layers[layerId];
    if (!layer) {
      console.warn(`Cannot recreate geometry for layer ${layerId} - not found`);
      return false;
    }

    // Log layer state before recreation
    console.log(`Layer ${layerId} state before recreation - radius: ${layer.state.radius}, copies: ${layer.state.copies}, segments: ${layer.state.segments}`);

    // Recreate the geometry
    return layer.recreateGeometry(true);
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