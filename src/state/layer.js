// src/state/layer.js - Layer class for multi-layer architecture
import { createAppState } from './state.js';
import * as THREE from 'three';

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
    
    // Layer-specific rendering properties
    this.color = options.color || new THREE.Color(`hsl(${(id * 60) % 360}, 100%, 50%)`);
    this.baseGeo = null;
    this.group = null;
    this.material = null;
    this.visible = true;
    
    // Last time this layer was updated
    this.lastUpdateTime = 0;
    
    // Initialize layer with default settings
    this.initialize(options);
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
    
    // IMPORTANT: Set the state reference in the group userData
    // This fixes the "No valid state found for trigger detection" error
    this.group.userData.state = this.state;
    
    // Create layer-specific material
    this.material = new THREE.LineBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.8,
    });
    
    // Apply any state overrides from options
    if (options.state) {
      Object.assign(this.state, options.state);
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
  }
  
  /**
   * Deactivate this layer
   */
  deactivate() {
    this.active = false;
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
} 