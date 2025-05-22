// src/state/LayerManager.js - Manages multiple layers for the application
import { Layer } from './layer.js';
import * as THREE from 'three';
import { createPolygonGeometry, calculateBoundingSphere } from '../geometry/geometry.js';
import { updateGroup } from '../geometry/geometry.js';
import { detectLayerTriggers } from '../triggers/triggers.js';

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
    
    // Create a container for all layers
    this.layerContainer = new THREE.Group();
    this.layerContainer.name = 'layers';
    
    // IMPORTANT: Make sure the layerContainer is visible
    this.layerContainer.visible = true;
    
    // Add the container to the scene
    this.scene.add(this.layerContainer);
    
    // Ensure the container is added to the scene and visible
    if (DEBUG_LOGGING) {
      console.log("Layer container created with visible =", this.layerContainer.visible);
      console.log("Layer container added to scene, scene child count =", this.scene.children.length);
      console.log("Scene children:", this.scene.children.map(child => child.name || 'unnamed'));
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
        console.log(`[LAYER MANAGER] Created distinct color for layer ${id}: hue=${hue}`);
      }
    }
    
    const layer = new Layer(id, options);
    
    // FIXED: Set layer manager reference to prevent circular dependencies
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
        console.log(`[LAYER MANAGER] Set distinct segments for layer ${id}: ${layer.state.segments}`);
      }
      
      // Make sure the parameter change is registered
      layer.state.parameterChanges.segments = true;
    }
    
    // IMPORTANT: Ensure layer group is visible
    layer.group.visible = true;
    
    // Add the layer's group to the container
    this.layerContainer.add(layer.group);
    
    // Log for debugging
    if (DEBUG_LOGGING) {
      console.log(`Created layer ${id}, added to container. Container has ${this.layerContainer.children.length} children`);
      console.log(`Layer ${id} visibility:`, layer.visible, "Group visibility:", layer.group.visible);
      console.log(`Layer ${id} color:`, layer.color);
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
      console.log(`[LAYER MANAGER] Initializing geometry for layer ${layerId}`);
      console.log(`[LAYER MANAGER] Layer ${layerId} state:`, {
        radius: state.radius,
        segments: state.segments,
        copies: state.copies,
        stepScale: state.stepScale
      });
    }
    
    // Ensure we have some reasonable defaults
    state.radius = state.radius || 300;  // LARGER radius for visibility
    state.segments = state.segments || 3;
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
      console.log(`[GEOMETRY INIT] Created geometry for layer ${layerId} with ${state.segments} segments and ${state.copies} copies`);
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
      console.log(`[LAYER MANAGER] Initialized group for layer ${layerId}, group now has ${layer.group.children.length} children`);
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
      console.log(`[LAYER MANAGER] Changing active layer from ${this.activeLayerId} to ${layerId}`);
    
      // Log the current state of the layer we're switching to before making it active
      if (this.layers[layerId]) {
        console.log(`[LAYER MANAGER] Layer ${layerId} state before activation:`, {
          radius: this.layers[layerId].state.radius,
          segments: this.layers[layerId].state.segments,
          copies: this.layers[layerId].state.copies
        });
        
        // Log the parameter changes flags for both the previous and new layer
        const previousLayer = this.layers[this.activeLayerId];
        const newLayer = this.layers[layerId];
        
        if (previousLayer && previousLayer.state.parameterChanges) {
          console.log(`[LAYER MANAGER] Previous layer ${this.activeLayerId} parameter change flags:`, 
            Object.entries(previousLayer.state.parameterChanges)
              .filter(([_, val]) => val)
              .map(([key, _]) => key)
              .join(", ") || "none");
        }
        
        if (newLayer && newLayer.state.parameterChanges) {
          console.log(`[LAYER MANAGER] New layer ${layerId} parameter change flags:`, 
            Object.entries(newLayer.state.parameterChanges)
              .filter(([_, val]) => val)
              .map(([key, _]) => key)
              .join(", ") || "none");
        }
      }
    }
    
    // Deactivate the current active layer
    if (this.activeLayerId !== undefined && this.layers[this.activeLayerId]) {
      const previousLayerId = this.activeLayerId;
      const previousLayer = this.layers[previousLayerId];
      
      previousLayer.deactivate();
      if (DEBUG_LOGGING) {
        console.log(`[LAYER MANAGER] Deactivated layer ${previousLayerId}`);
      }
      
      // Explicitly reset parameter changes for the previous layer
      if (typeof previousLayer.state.resetParameterChanges === 'function') {
        previousLayer.state.resetParameterChanges();
        if (DEBUG_LOGGING) {
          console.log(`[LAYER MANAGER] Reset parameter changes for previous layer ${previousLayerId}`);
        }
      }
    }
    
    // Make the new layer active
    this.layers[layerId].activate();
    this.activeLayerId = layerId;
    if (DEBUG_LOGGING) {
      console.log(`[LAYER MANAGER] Activated layer ${layerId}, state:`, {
        radius: this.layers[layerId].state.radius,
        segments: this.layers[layerId].state.segments,
        copies: this.layers[layerId].state.copies
      });
    }
    
    // Force an immediate UI update by directly updating the global state reference
    if (window._appState) {
      const previousAppStateId = window._appState.layerId !== undefined ? window._appState.layerId : 'unknown';
      window._appState = this.layers[layerId].state;
      if (DEBUG_LOGGING) {
        console.log(`[LAYER MANAGER] Updated global _appState reference from layer ${previousAppStateId} to layer ${layerId}`);
      }
    }
    
    // Explicitly reset parameter changes for the new layer
    if (typeof this.layers[layerId].state.resetParameterChanges === 'function') {
      this.layers[layerId].state.resetParameterChanges();
      if (DEBUG_LOGGING) {
        console.log(`[LAYER MANAGER] Reset parameter changes for new active layer ${layerId}`);
      }
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
    layer.dispose();
    
    // Remove from array
    this.layers.splice(layerId, 1);
    
    // Update IDs for remaining layers
    for (let i = layerId; i < this.layers.length; i++) {
      this.layers[i].id = i;
      this.layers[i].group.name = `layer-${i}`;
      this.layers[i].group.userData.layerId = i;
    }
    
    // Update active layer if needed
    if (this.activeLayerId === layerId) {
      // Select another layer if available
      if (this.layers.length > 0) {
        this.setActiveLayer(Math.min(layerId, this.layers.length - 1));
      } else {
        this.activeLayerId = null;
      }
    } else if (this.activeLayerId > layerId) {
      // Adjust active layer ID if it's after the removed one
      this.activeLayerId--;
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
      activeLayerId // This is now passed from animation.js
    } = animationParams;

    // Ensure we're working with the correct active layer
    if (activeLayerId !== undefined && this.activeLayerId !== activeLayerId) {
      console.warn(`[LAYER MANAGER] Active layer mismatch! LayerManager: ${this.activeLayerId}, Animation: ${activeLayerId}`);
      // Force sync to the one from animation params
      this.activeLayerId = activeLayerId;
    }

    // Add frame counter to control logging frequency
    this.frameCounter = (this.frameCounter || 0) + 1;
    const shouldLog = DEBUG_LOGGING && (this.frameCounter % 900 === 0);

    // Add camera update based on layer geometry
    this.updateCameraForLayerBounds(scene, shouldLog);

    // Debug log all layers' key parameters if logging is enabled
    if (shouldLog) {
      console.log(`[LAYER MANAGER] Updating layers. Active layer ID: ${this.activeLayerId}`);
      this.layers.forEach(layer => {
        console.log(`[LAYER MANAGER] Layer ${layer.id} state: radius=${layer.state.radius}, segments=${layer.state.segments}, copies=${layer.state.copies}, active=${layer.active}`);
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
      
      // Reset intersection update flag to prevent constant recalculation
      if (state.justCalculatedIntersections) {
        state.justCalculatedIntersections = false;
      }
      
      // Check if any parameters have changed
      const hasParameterChanges = state.hasParameterChanged();
      
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
          console.log(`[GEOMETRY UPDATE] Updated geometry for layer ${layerId}${isActiveLayer ? ' (ACTIVE)' : ''}: radius=${state.radius}, segments=${state.segments}, copies=${state.copies}`);
        }
      }
      
      // Ensure group has state reference for trigger detection
      if (layer.group) {
        layer.group.userData.state = state;
        // Also add layerId to the group's userData for trigger system to identify
        layer.group.userData.layerId = layerId;
      }
      
      // Only update the group if there are parameter changes, we're lerping, or it's the first few frames
      const shouldUpdateGroup = 
        hasParameterChanges || 
        state.isLerping() || 
        state.justCalculatedIntersections ||
        this.frameCounter < 10; // Always update during first few frames for stability
      
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
          console.log(`[LAYER MANAGER] Updated group for layer ${layerId}: reason=${hasParameterChanges ? 'parameter changes' : (state.isLerping() ? 'lerping' : 'initialization')}`);
        }
      }
      
      // IMPORTANT: Update the layer's angle with time subdivision applied
      // This is the fix for time subdivision not working
      if (typeof layer.updateAngle === 'function') {
        // Current time in seconds (convert from ms)
        const currentTimeInSeconds = tNow / 1000;
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
          console.log(`[LAYER ${layerId}] Rotation: ${(rotationAngle * 180 / Math.PI).toFixed(1)}°, ` + 
                      `Time subdivision: ${hasTimeSubdivision ? state.timeSubdivisionValue + 'x' : 'disabled'}`);
        }
      }
      
      // Detect triggers if this layer has copies
      if (state.copies > 0) {
        // Use direct layer trigger detection with the imported function
        detectLayerTriggers(
          layer,
          tNow,
          (note) => {
            // Add layer ID to the note for routing to correct instrument
            const layerNote = { ...note, layerId: layerId };
            return triggerAudioCallback(layerNote);
          }
        );
      }
      
      // Reset parameter change flags
      state.resetParameterChanges();
    }
    
    // Log which layers had geometry updates in this frame (if any)
    if (updatedGeometryForLayers.length > 0 && DEBUG_LOGGING) {
      console.log(`[LAYER MANAGER] Updated geometry for layers: ${updatedGeometryForLayers.join(', ')}`);
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
      if (shouldLog) console.warn("Cannot update camera: No camera reference in scene userData");
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
          console.log(`Updating camera distance: ${previousDistance.toFixed(0)} → ${targetDistance.toFixed(0)} (max radius: ${maxBoundingRadius.toFixed(0)})`);
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
    console.log(`Forcing geometry recreation for layer ${layerId}`);
    
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
      console.log(`[LAYER MANAGER] Forcing synchronization of all layer colors`);
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
          console.log(`[LAYER MANAGER] Updated layer ${layer.id} material color from #${oldColor} to #${layer.color.getHexString()}`);
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
      console.log(`[LAYER MANAGER] Layer color synchronization complete`);
    }
  }

  /**
   * Debug the active layer and state references
   * Use this to verify that the active layer's state is correctly referenced
   * and all global references point to the same object
   */
  debugActiveLayerState() {
    console.log('------- LAYER STATE DEBUG -------');
    const activeLayer = this.getActiveLayer();
    
    if (!activeLayer) {
      console.error('No active layer found! activeLayerId =', this.activeLayerId);
      return;
    }
    
    console.log(`Active layer ID: ${this.activeLayerId}`);
    console.log(`Active layer's state.layerId: ${activeLayer.state.layerId}`);
    
    // Check if the state's layer ID matches the actual layer ID
    if (activeLayer.state.layerId !== this.activeLayerId) {
      console.error(`MISMATCH: Active layer ID (${this.activeLayerId}) does not match state.layerId (${activeLayer.state.layerId})`);
    } else {
      console.log('MATCH: Active layer ID matches state.layerId reference');
    }
    
    // Check if window._appState points to the active layer's state
    if (window._appState === activeLayer.state) {
      console.log('CORRECT: window._appState points to the active layer state');
    } else {
      console.error('INCORRECT: window._appState does NOT point to the active layer state');
      console.log('window._appState.layerId =', window._appState.layerId);
      console.log('activeLayer.state.layerId =', activeLayer.state.layerId);
    }
    
    // Check if getActiveState returns the active layer's state
    if (typeof window.getActiveState === 'function') {
      const activeState = window.getActiveState();
      if (activeState === activeLayer.state) {
        console.log('CORRECT: getActiveState() returns the active layer state');
      } else {
        console.error('INCORRECT: getActiveState() does NOT return the active layer state');
        console.log('getActiveState().layerId =', activeState.layerId);
        console.log('activeLayer.state.layerId =', activeLayer.state.layerId);
      }
    }
    
    console.log('------ END LAYER STATE DEBUG ------');
  }
} 