// src/state/LayerManager.js - Manages multiple layers for the application
import { Layer } from './layer.js';
import * as THREE from 'three';
import { createPolygonGeometry, calculateBoundingSphere } from '../geometry/geometry.js';
import { updateGroup } from '../geometry/geometry.js';
import { detectTriggers } from '../triggers/triggers.js';

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
    console.log("Layer container created with visible =", this.layerContainer.visible);
    console.log("Layer container added to scene, scene child count =", this.scene.children.length);
    console.log("Scene children:", this.scene.children.map(child => child.name || 'unnamed'));
  }
  
  /**
   * Create a new layer
   * @param {Object} options Layer configuration options
   * @returns {Layer} The created layer
   */
  createLayer(options = {}) {
    const id = this.layers.length;
    const layer = new Layer(id, options);
    
    // Set initial state values to ensure there's something to render
    // IMPORTANT: Default to having at least 1 copy to make the layer visible
    if (layer.state.copies === 0) {
      layer.state.copies = 3; // Default to 3 copies so something is visible
    }
    
    // IMPORTANT: Ensure layer group is visible
    layer.group.visible = true;
    
    // Add the layer's group to the container
    this.layerContainer.add(layer.group);
    
    // Log for debugging
    console.log(`Created layer ${id}, added to container. Container has ${this.layerContainer.children.length} children`);
    console.log(`Layer ${id} visibility:`, layer.visible, "Group visibility:", layer.group.visible);
    
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
    
    // Ensure we have some reasonable defaults
    state.radius = state.radius || 300;  // LARGER radius for visibility
    state.segments = state.segments || 3;
    state.copies = state.copies || 3;
    
    // Always create fresh geometry
    // Dispose old geometry if it exists
    if (layer.baseGeo && layer.baseGeo.dispose) {
      layer.baseGeo.dispose();
    }
    
    // Create new geometry
    layer.baseGeo = createPolygonGeometry(
      state.radius,
      state.segments,
      state
    );
    
    console.log(`Created geometry for layer ${layer.id} with ${state.segments} segments and ${state.copies} copies`);
    
    // Initialize the group with the geometry
    updateGroup(
      layer.group,
      state.copies,
      state.stepScale,
      layer.baseGeo,
      layer.material,
      state.segments,
      state.angle,
      state,
      false,
      true  // Force intersection recalculation
    );
    
    console.log(`Initialized group for layer ${layer.id}, group now has ${layer.group.children.length} children`);
  }
  
  /**
   * Set the active layer
   * @param {number} layerId ID of the layer to make active
   */
  setActiveLayer(layerId) {
    // Deactivate current active layer
    if (this.activeLayerId !== null && this.layers[this.activeLayerId]) {
      this.layers[this.activeLayerId].deactivate();
    }
    
    // Set new active layer
    this.activeLayerId = layerId;
    
    // Activate the new layer
    if (this.layers[layerId]) {
      this.layers[layerId].activate();
      
      // Call syncStateAcrossSystems if it exists
      if (typeof window.syncStateAcrossSystems === 'function') {
        window.syncStateAcrossSystems();
      } else {
        console.warn('syncStateAcrossSystems not available');
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
  updateLayers(animationParams) {
    const { 
      scene, 
      tNow, 
      dt, 
      angle, 
      lastAngle, 
      triggerAudioCallback 
    } = animationParams;

    // Add frame counter to control logging frequency
    this.frameCounter = (this.frameCounter || 0) + 1;
    const shouldLog = this.frameCounter % 300 === 0;

    // Add camera update based on layer geometry
    this.updateCameraForLayerBounds(scene, shouldLog);

    // Update each layer
    for (const layer of this.layers) {
      // Only update if the layer is visible
      if (layer.visible) {
        const state = layer.state;
        
        // Update state time
        state.lastTime = tNow;
        
        // Debug output for active layer to verify parameter changes
        if (layer.id === this.activeLayerId && shouldLog) {
          console.log(`Layer ${layer.id} (active): copies=${state.copies}, segments=${state.segments}, radius=${state.radius}`);
          
          // Check for parameter changes that would affect rendering
          if (state.hasParameterChanged()) {
            console.log("Parameter changes detected:", 
              Object.entries(state.parameterChanges)
                .filter(([_, val]) => val)
                .map(([key, _]) => key)
                .join(", ")
            );
          }
        }
        
        // Update lerped values
        state.updateLerp(dt);
        
        // Create geometry if it doesn't exist or if parameters have changed
        if (!layer.baseGeo || state.hasParameterChanged()) {
          // Dispose old geometry
          if (layer.baseGeo && layer.baseGeo.dispose) {
            layer.baseGeo.dispose();
          }
          
          // Create new geometry
          layer.baseGeo = createPolygonGeometry(
            state.radius,
            state.segments,
            state
          );
          
          // Log geometry recreation
          if (shouldLog || state.hasParameterChanged()) {
            console.log(`Updated geometry for layer ${layer.id}: radius=${state.radius}, segments=${state.segments}`);
          }
        }
        
        // Detect triggers if this layer has copies
        if (state.copies > 0) {
          detectTriggers(
            layer.baseGeo,
            lastAngle,
            angle,
            state.copies,
            layer.group,
            state.lastTrig,
            tNow,
            (note) => {
              // Add layer ID to the note for routing to correct instrument
              const layerNote = { ...note, layerId: layer.id };
              return triggerAudioCallback(layerNote);
            }
          );
        }
        
        // IMPORTANT: Apply the rotation directly to the entire layer group
        // Convert angle from degrees to radians
        const angleInRadians = (angle * Math.PI) / 180;
        layer.group.rotation.z = angleInRadians;
        
        // Update the group with current parameters - angle here is for cumulative angle between copies
        updateGroup(
          layer.group,
          state.copies,
          state.stepScale,
          layer.baseGeo,
          layer.material,
          state.segments,
          state.angle, // Use the fixed angle between copies, not the animation angle
          state,
          state.isLerping(),
          state.justCalculatedIntersections
        );
        
        // Reset parameter change flags
        state.resetParameterChanges();
      }
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
} 