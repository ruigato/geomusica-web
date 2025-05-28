// src/geometry/layerLink.js - Layer Link Feature
import * as THREE from 'three';

// Debug flag for layer link logging
const DEBUG_LAYER_LINK = false;

/**
 * Layer Link Manager - handles linking vertices between layers
 */
export class LayerLinkManager {
  constructor() {
    this.enabled = false;
    this.fromLayerId = 0;
    this.toLayerId = 1;
    this.traceEnabled = false;
    this.linkLines = [];
    this.midPoints = [];
    this.tracePaths = [];
    this.linkGroup = new THREE.Group();
    this.linkGroup.name = 'layer-links';
    this.maxTracePoints = 100; // Maximum number of trace points to keep
    
    // Materials for visualization
    this.linkLineMaterial = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.6,
      depthTest: false,
      depthWrite: false
    });
    
    this.midPointMaterial = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 1.0,
      depthTest: false,
      depthWrite: false
    });
    
    this.traceMaterial = new THREE.LineBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
      depthWrite: false,
      linewidth: 3
    });
    
    // Geometry for mid-point markers
    this.midPointGeometry = new THREE.CircleGeometry(5, 8);
  }
  
  /**
   * Set the enabled state of layer linking
   * @param {boolean} enabled - Whether layer linking is enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    this.linkGroup.visible = enabled;
    
    if (!enabled) {
      this.clearLinks();
      this.clearTraces();
    }
    
    if (DEBUG_LAYER_LINK) {
      console.log(`Layer Link ${enabled ? 'enabled' : 'disabled'}`);
    }
  }
  
  /**
   * Set the source layer for linking
   * @param {number} layerId - ID of the source layer
   */
  setFromLayer(layerId) {
    this.fromLayerId = layerId;
    if (this.enabled) {
      this.updateLinks();
    }
  }
  
  /**
   * Set the target layer for linking
   * @param {number} layerId - ID of the target layer
   */
  setToLayer(layerId) {
    this.toLayerId = layerId;
    if (this.enabled) {
      this.updateLinks();
    }
  }
  
  /**
   * Set the trace enabled state
   * @param {boolean} enabled - Whether trace visualization is enabled
   */
  setTraceEnabled(enabled) {
    this.traceEnabled = enabled;
    
    // Show/hide existing traces
    this.tracePaths.forEach(tracePath => {
      if (tracePath) {
        tracePath.visible = enabled;
      }
    });
    
    if (!enabled) {
      this.clearTraces();
    } else {
      // If enabling traces and we have mid-points, initialize trace paths
      if (this.midPoints.length > 0) {
        for (let i = 0; i < this.midPoints.length; i++) {
          if (!this.tracePaths[i]) {
            this.initializeTracePath(i);
          }
        }
      }
    }
  }
  
  /**
   * Get vertex positions from a layer's geometry
   * @param {Object} layer - The layer object
   * @returns {Array<THREE.Vector3>} Array of world vertex positions
   */
  getLayerVertexPositions(layer) {
    if (!layer || !layer.group || !layer.group.children) {
      return [];
    }
    
    const vertices = [];
    
    // Iterate through all copies in the layer
    layer.group.children.forEach((child, copyIndex) => {
      if (child.type === 'Group') {
        // This is a copy group, get vertices from its children
        child.children.forEach((mesh, vertexIndex) => {
          if (mesh.type === 'Mesh' && mesh.geometry && mesh.geometry.type === 'CircleGeometry') {
            // This is a vertex circle
            const worldPosition = new THREE.Vector3();
            mesh.getWorldPosition(worldPosition);
            
            vertices.push({
              position: worldPosition.clone(),
              copyIndex: copyIndex,
              vertexIndex: mesh.userData?.vertexIndex || vertexIndex,
              mesh: mesh
            });
          }
        });
      } else if (child.type === 'LineLoop' || child.type === 'LineSegments') {
        // Also check for line geometry vertices
        if (child.geometry && child.geometry.getAttribute('position')) {
          const positions = child.geometry.getAttribute('position');
          const vertexCount = positions.count;
          
          for (let i = 0; i < vertexCount; i++) {
            const localPos = new THREE.Vector3();
            localPos.fromBufferAttribute(positions, i);
            
            // Transform to world coordinates
            const worldPosition = localPos.clone();
            child.localToWorld(worldPosition);
            
            vertices.push({
              position: worldPosition,
              copyIndex: copyIndex,
              vertexIndex: i,
              mesh: child
            });
          }
        }
      }
    });
    
    return vertices;
  }
  
  /**
   * Update the links between layers
   * @param {Object} layerManager - The layer manager instance
   */
  updateLinks(layerManager) {
    if (!this.enabled || !layerManager) {
      return;
    }
    
    // Clear existing links
    this.clearLinks();
    
    // Get source and target layers
    const fromLayer = layerManager.layers[this.fromLayerId];
    const toLayer = layerManager.layers[this.toLayerId];
    
    if (!fromLayer || !toLayer || fromLayer === toLayer) {
      return;
    }
    
    // Get vertex positions from both layers
    const fromVertices = this.getLayerVertexPositions(fromLayer);
    const toVertices = this.getLayerVertexPositions(toLayer);
    
    if (fromVertices.length === 0 || toVertices.length === 0) {
      return;
    }
    
    // Create links between vertices
    this.createVertexLinks(fromVertices, toVertices);
    
    if (DEBUG_LAYER_LINK) {
      console.log(`Created ${this.linkLines.length} links between layer ${this.fromLayerId} and ${this.toLayerId}`);
    }
  }
  
  /**
   * Create links between vertex arrays
   * @param {Array} fromVertices - Source vertices
   * @param {Array} toVertices - Target vertices
   */
  createVertexLinks(fromVertices, toVertices) {
    const maxVertices = Math.max(fromVertices.length, toVertices.length);
    
    for (let i = 0; i < maxVertices; i++) {
      // Use modulo to cycle through vertices if counts differ
      const fromVertex = fromVertices[i % fromVertices.length];
      const toVertex = toVertices[i % toVertices.length];
      
      // Create link line
      const linkLine = this.createLinkLine(fromVertex.position, toVertex.position);
      this.linkLines.push(linkLine);
      this.linkGroup.add(linkLine);
      
      // Create mid-point marker
      const midPoint = this.createMidPoint(fromVertex.position, toVertex.position, i);
      this.midPoints.push(midPoint);
      this.linkGroup.add(midPoint);
      
      if (DEBUG_LAYER_LINK) {
        console.log(`[LAYER LINK] Created mid-point ${i} at (${midPoint.position.x.toFixed(2)}, ${midPoint.position.y.toFixed(2)})`);
      }
      
      // Initialize trace path for this link if tracing is enabled
      if (this.traceEnabled) {
        this.initializeTracePath(i);
      }
    }
  }
  
  /**
   * Create a segmented line between two points
   * @param {THREE.Vector3} start - Start position
   * @param {THREE.Vector3} end - End position
   * @returns {THREE.Line} The created line object
   */
  createLinkLine(start, end) {
    const segments = 10; // Number of segments for the line
    const points = [];
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const point = new THREE.Vector3().lerpVectors(start, end, t);
      points.push(point);
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, this.linkLineMaterial);
    line.userData.isLinkLine = true;
    
    return line;
  }
  
  /**
   * Create a mid-point marker between two positions
   * @param {THREE.Vector3} start - Start position
   * @param {THREE.Vector3} end - End position
   * @param {number} linkIndex - Index of this link
   * @returns {THREE.Mesh} The created mid-point marker
   */
  createMidPoint(start, end, linkIndex) {
    const midPosition = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    
    const midPoint = new THREE.Mesh(this.midPointGeometry, this.midPointMaterial.clone());
    midPoint.position.copy(midPosition);
    midPoint.userData.isLinkMidPoint = true;
    midPoint.userData.linkIndex = linkIndex;
    midPoint.userData.triggerData = {
      x: midPosition.x,
      y: midPosition.y,
      linkIndex: linkIndex,
      isLinkTrigger: true
    };
    
    return midPoint;
  }
  
  /**
   * Initialize a trace path for a link
   * @param {number} linkIndex - Index of the link
   */
  initializeTracePath(linkIndex) {
    const traceGeometry = new THREE.BufferGeometry();
    const traceLine = new THREE.Line(traceGeometry, this.traceMaterial);
    traceLine.userData.isTracePath = true;
    traceLine.userData.linkIndex = linkIndex;
    traceLine.userData.tracePoints = [];
    
    this.tracePaths[linkIndex] = traceLine;
    this.linkGroup.add(traceLine);
  }
  
    /**
   * Update trace paths with current mid-point positions
   */
  updateTraces() {
    if (!this.traceEnabled) {
      return;
    }

    this.midPoints.forEach((midPoint, index) => {
      if (this.tracePaths[index]) {
        const tracePath = this.tracePaths[index];
        const tracePoints = tracePath.userData.tracePoints;
        
        // Add current position to trace (only if position has changed significantly)
        const currentPos = midPoint.position.clone();
        const lastPos = tracePoints.length > 0 ? tracePoints[tracePoints.length - 1] : null;
        
        // Only add point if it's significantly different from the last one
        if (!lastPos || currentPos.distanceTo(lastPos) > 0.5) {
          tracePoints.push(currentPos);
          
          // Limit trace length
          if (tracePoints.length > this.maxTracePoints) {
            tracePoints.shift();
          }
          
          // Update trace geometry
          if (tracePoints.length > 1) {
            tracePath.geometry.setFromPoints(tracePoints);
            tracePath.geometry.computeBoundingSphere();
            tracePath.visible = true;
          }
        }
      }
    });
  }
  
  /**
   * Clear all link lines and mid-points
   */
  clearLinks() {
    // Dispose geometries and remove from group
    this.linkLines.forEach(line => {
      if (line.geometry) line.geometry.dispose();
      this.linkGroup.remove(line);
    });
    
    this.midPoints.forEach(midPoint => {
      if (midPoint.geometry) midPoint.geometry.dispose();
      if (midPoint.material) midPoint.material.dispose();
      this.linkGroup.remove(midPoint);
    });
    
    this.linkLines = [];
    this.midPoints = [];
  }
  
  /**
   * Clear all trace paths
   */
  clearTraces() {
    this.tracePaths.forEach(tracePath => {
      if (tracePath && tracePath.geometry) {
        tracePath.geometry.dispose();
        this.linkGroup.remove(tracePath);
      }
    });
    
    this.tracePaths = [];
  }
  
    /**
   * Update the layer links during animation
   * @param {Object} layerManager - The layer manager instance
   */
  update(layerManager) {
    if (!this.enabled || !layerManager) {
      return;
    }

    // Get source and target layers
    const fromLayer = layerManager.layers[this.fromLayerId];
    const toLayer = layerManager.layers[this.toLayerId];
    
    if (!fromLayer || !toLayer || fromLayer === toLayer) {
      return;
    }

    // Get current vertex positions from both layers
    const fromVertices = this.getLayerVertexPositions(fromLayer);
    const toVertices = this.getLayerVertexPositions(toLayer);
    
    if (fromVertices.length === 0 || toVertices.length === 0) {
      return;
    }

    // Update existing link lines and mid-points with current positions
    const maxVertices = Math.max(fromVertices.length, toVertices.length);
    
    for (let i = 0; i < Math.min(maxVertices, this.linkLines.length, this.midPoints.length); i++) {
      // Use modulo to cycle through vertices if counts differ
      const fromVertex = fromVertices[i % fromVertices.length];
      const toVertex = toVertices[i % toVertices.length];
      
      // Update link line geometry
      if (this.linkLines[i]) {
        const linkLine = this.linkLines[i];
        const segments = 10;
        const points = [];
        
        for (let j = 0; j <= segments; j++) {
          const t = j / segments;
          const point = new THREE.Vector3().lerpVectors(fromVertex.position, toVertex.position, t);
          points.push(point);
        }
        
        linkLine.geometry.setFromPoints(points);
      }
      
      // Update mid-point position and trigger data
      if (this.midPoints[i]) {
        const midPoint = this.midPoints[i];
        const midPosition = new THREE.Vector3().addVectors(fromVertex.position, toVertex.position).multiplyScalar(0.5);
        
        midPoint.position.copy(midPosition);
        
        // Update trigger data with new position
        if (midPoint.userData && midPoint.userData.triggerData) {
          midPoint.userData.triggerData.x = midPosition.x;
          midPoint.userData.triggerData.y = midPosition.y;
          
          if (DEBUG_LAYER_LINK && i === 0 && Math.random() < 0.01) { // Log first mid-point occasionally
            console.log(`[LAYER LINK] Updated mid-point ${i} to (${midPosition.x.toFixed(2)}, ${midPosition.y.toFixed(2)})`);
          }
        }
      }
    }

    // Update traces if enabled
    if (this.traceEnabled) {
      this.updateTraces();
    }
  }
  
  /**
   * Get the link group for adding to scene
   * @returns {THREE.Group} The link group
   */
  getLinkGroup() {
    return this.linkGroup;
  }
  
  /**
   * Get all mid-point trigger data for the trigger system
   * @returns {Array} Array of trigger data objects
   */
  getMidPointTriggers() {
    return this.midPoints.map(midPoint => midPoint.userData.triggerData).filter(Boolean);
  }
  
  /**
   * Get status information about the layer link system
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      enabled: this.enabled,
      fromLayerId: this.fromLayerId,
      toLayerId: this.toLayerId,
      traceEnabled: this.traceEnabled,
      linkCount: this.linkLines.length,
      midPointCount: this.midPoints.length,
      tracePathCount: this.tracePaths.length,
      midPointPositions: this.midPoints.map((mp, i) => ({
        index: i,
        x: mp.position.x.toFixed(2),
        y: mp.position.y.toFixed(2),
        hasTrace: !!this.tracePaths[i],
        tracePointCount: this.tracePaths[i]?.userData?.tracePoints?.length || 0
      }))
    };
  }
  
  /**
   * Dispose of all resources
   */
  dispose() {
    this.clearLinks();
    this.clearTraces();
    
    // Dispose materials
    if (this.linkLineMaterial) this.linkLineMaterial.dispose();
    if (this.midPointMaterial) this.midPointMaterial.dispose();
    if (this.traceMaterial) this.traceMaterial.dispose();
    if (this.midPointGeometry) this.midPointGeometry.dispose();
  }
}

// Export a singleton instance
export const layerLinkManager = new LayerLinkManager();

// Expose debug functions to global scope for console debugging
if (typeof window !== 'undefined') {
  window.debugLayerLink = () => {
    console.log('Layer Link Status:', layerLinkManager.getStatus());
  };
  
  window.enableLayerLinkTrace = () => {
    layerLinkManager.setTraceEnabled(true);
    console.log('Layer link trace enabled');
  };
  
  window.disableLayerLinkTrace = () => {
    layerLinkManager.setTraceEnabled(false);
    console.log('Layer link trace disabled');
  };
  
  window.debugLayerLinkTriggers = () => {
    const triggers = layerLinkManager.getMidPointTriggers();
    console.log('Layer Link Triggers:', triggers);
    
    // Check subframe engine state for each trigger
    if (window._subframeEngine) {
      triggers.forEach((trigger, i) => {
        const triggerId = `link_${trigger.linkIndex}_0`; // Assuming layer 0
        console.log(`Trigger ${i} (${triggerId}):`, {
          position: `(${trigger.x.toFixed(1)}, ${trigger.y.toFixed(1)})`,
          hasHistory: window._subframeEngine.vertexStates?.has(triggerId),
          historyLength: window._subframeEngine.vertexStates?.get(triggerId)?.length || 0
        });
      });
    }
  };
} 