// src/state/layer.js - Layer class for multi-layer architecture
import { createAppState } from './state.js';
import * as THREE from 'three';
import { createPolygonGeometry } from '../geometry/geometry.js';

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
    
    // Ensure we have some initial state values that will render something
    this.state.copies = this.state.copies || 3;
    this.state.segments = this.state.segments || 3;
    this.state.radius = this.state.radius || 100;
    this.state.stepScale = this.state.stepScale || 1.05;
    
    // Force parameter changes to ensure initial render
    this.state.parameterChanges.copies = true;
    this.state.parameterChanges.segments = true;
    this.state.parameterChanges.radius = true;
    this.state.parameterChanges.stepScale = true;
    
    console.log(`Layer ${id} created with: copies=${this.state.copies}, segments=${this.state.segments}, radius=${this.state.radius}`);
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
    
    // Create layer-specific material - MORE VISIBLE VERSION
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
    
    // Apply any state overrides from options
    if (options.state) {
      Object.assign(this.state, options.state);
    }
    
    console.log(`Layer ${this.id} initialized, group visible: ${this.group.visible}`);
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
  
  /**
   * Force recreation of layer geometry with current parameters
   */
  recreateGeometry() {
    // Dispose old geometry if it exists
    if (this.baseGeo && this.baseGeo.dispose) {
      this.baseGeo.dispose();
    }
    
    // Create new geometry with current parameters
    this.baseGeo = createPolygonGeometry(
      this.state.radius,
      this.state.segments,
      this.state
    );
    
    // Force parameter changes to ensure render update
    this.state.parameterChanges.radius = true;
    this.state.parameterChanges.segments = true;
    this.state.parameterChanges.copies = true;
    
    console.log(`Recreated geometry for layer ${this.id}: segments=${this.state.segments}, radius=${this.state.radius}, copies=${this.state.copies}`);
    
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
    
    console.log(`Forced visibility for layer ${this.id}`);
    
    return this;
  }
} 