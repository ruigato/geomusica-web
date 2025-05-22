// src/state/LayerManager.js - Manages multiple layers for the application
import { Layer } from './layer.js';
import * as THREE from 'three';
import { createPolygonGeometry } from '../geometry/geometry.js';
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
    this.scene.add(this.layerContainer);
  }
  
  /**
   * Create a new layer
   * @param {Object} options Layer configuration options
   * @returns {Layer} The created layer
   */
  createLayer(options = {}) {
    const id = this.layers.length;
    const layer = new Layer(id, options);
    
    // Add the layer's group to the container
    this.layerContainer.add(layer.group);
    
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
    
    // Create geometry if it doesn't exist
    if (!layer.baseGeo) {
      layer.baseGeo = createPolygonGeometry(
        state.radius,
        state.segments,
        state
      );
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
      state,
      false,
      false
    );
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

    // Update each layer
    for (const layer of this.layers) {
      // Only update if the layer is visible
      if (layer.visible) {
        const state = layer.state;
        
        // Update state time
        state.lastTime = tNow;
        
        // Update lerped values
        state.updateLerp(dt);
        
        // Check if we need to update the geometry
        const needsGeometryUpdate = 
          !layer.baseGeo || 
          state.parameterChanges.segments || 
          state.parameterChanges.radius ||
          state.parameterChanges.fractal ||
          state.parameterChanges.useFractal ||
          state.parameterChanges.starSkip ||
          state.parameterChanges.useStars;
        
        if (needsGeometryUpdate) {
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
        
        // Update the group with current parameters
        updateGroup(
          layer.group,
          state.copies,
          state.stepScale,
          layer.baseGeo,
          layer.material,
          state.segments,
          angle,
          state,
          state.isLerping(),
          state.justCalculatedIntersections
        );
        
        // Reset parameter change flags
        state.resetParameterChanges();
      }
    }
  }
} 