import * as THREE from 'three';
import { createPolygonGeometry } from './geometry.js';

export class LayerManager {
  constructor(scene) {
    this.scene = scene;
    this.layers = new Map(); // Maps layerId to { mesh, group, material, _lastGeometryState }
  }

  /**
   * Creates a new layer in the scene
   * @param {Object} layerState - The layer state
   * @returns {Object} The created layer data
   */
  createLayer(layerState) {
    // Create a group for this layer
    const group = new THREE.Group();
    group.name = `layer-${layerState.id}`;
    group.visible = layerState.visible;
    group.renderOrder = layerState.zIndex;
    
    // Create the mesh for this layer
    const geometry = this.createGeometry(layerState);
    const material = this.createMaterial(layerState);
    const mesh = new THREE.Mesh(geometry, material);
    
    group.add(mesh);
    this.scene.add(group);
    
    // Store layer data
    const layerData = {
      id: layerState.id,
      group,
      mesh,
      material,
      _lastGeometryState: this.getGeometryState(layerState)
    };
    
    this.layers.set(layerState.id, layerData);
    return layerData;
  }

  /**
   * Updates an existing layer
   * @param {Object} layerState - The updated layer state
   */
  updateLayer(layerState) {
    const layerData = this.layers.get(layerState.id);
    if (!layerData) return;

    // Update visibility and z-index
    if (layerData.group) {
      layerData.group.visible = layerState.visible;
      layerData.group.renderOrder = layerState.zIndex;
    }

    // Update material properties
    if (layerData.material) {
      layerData.material.color.set(layerState.color);
      layerData.material.opacity = layerState.opacity;
      layerData.material.transparent = layerState.opacity < 1.0;
      layerData.material.wireframe = layerState.wireframe;
    }

    // Check if geometry needs to be regenerated
    if (this.needsGeometryUpdate(layerData, layerState)) {
      const newGeometry = this.createGeometry(layerState);
      layerData.mesh.geometry.dispose();
      layerData.mesh.geometry = newGeometry;
      layerData._lastGeometryState = this.getGeometryState(layerState);
    }
  }

  /**
   * Removes a layer from the scene
   * @param {string} layerId - The ID of the layer to remove
   */
  removeLayer(layerId) {
    const layerData = this.layers.get(layerId);
    if (!layerData) return;

    // Clean up Three.js objects
    if (layerData.mesh) {
      if (layerData.mesh.geometry) {
        layerData.mesh.geometry.dispose();
      }
      if (layerData.mesh.parent) {
        layerData.mesh.parent.remove(layerData.mesh);
      }
    }
    
    if (layerData.group) {
      if (layerData.group.parent) {
        layerData.group.parent.remove(layerData.group);
      }
      layerData.group = null;
    }
    
    if (layerData.material) {
      layerData.material.dispose();
    }
    
    this.layers.delete(layerId);
  }

  /**
   * Creates a material for a layer
   * @private
   */
  createMaterial(layerState) {
    return new THREE.MeshBasicMaterial({
      color: layerState.color,
      wireframe: layerState.wireframe,
      transparent: true,
      opacity: layerState.opacity,
      side: THREE.DoubleSide
    });
  }

  /**
   * Creates geometry for a layer
   * @private
   */
  createGeometry(layerState) {
    return createPolygonGeometry(
      layerState.radius,
      layerState.segments,
      {
        useFractal: layerState.useFractal,
        fractalValue: layerState.fractalValue,
        useStars: layerState.useStars,
        starSkip: layerState.starSkip,
        useEuclid: layerState.useEuclid,
        euclidValue: layerState.euclidValue
      }
    );
  }

  /**
   * Gets the current geometry state for comparison
   * @private
   */
  getGeometryState(layerState) {
    return {
      radius: layerState.radius,
      segments: layerState.segments,
      stepScale: layerState.stepScale,
      angle: layerState.angle,
      copies: layerState.copies,
      useFractal: layerState.useFractal,
      fractalValue: layerState.fractalValue,
      useStars: layerState.useStars,
      starSkip: layerState.starSkip,
      useEuclid: layerState.useEuclid,
      euclidValue: layerState.euclidValue
    };
  }

  /**
   * Checks if a layer's geometry needs to be updated
   * @private
   */
  needsGeometryUpdate(layerData, newState) {
    const oldState = layerData._lastGeometryState || {};
    const propsToCheck = Object.keys(this.getGeometryState(newState));

    return propsToCheck.some(prop => 
      newState[prop] !== oldState[prop]
    );
  }

  /**
   * Get a layer by ID
   * @param {string} layerId - The ID of the layer to get
   * @returns {Object|null} The layer data or null if not found
   */
  getLayer(layerId) {
    return this.layers.get(layerId) || null;
  }

  /**
   * Get all layers
   * @returns {Array<Object>} Array of layer data objects
   */
  getAllLayers() {
    return Array.from(this.layers.values());
  }
}
