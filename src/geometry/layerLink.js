// src/geometry/layerLink.js - Layer Link Feature
import * as THREE from 'three';
import { GPUTraceSystem } from './GPUTraceSystem.js';

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
    this.linkGroup = new THREE.Group();
    this.linkGroup.name = 'layer-links';
    
    // GPU trace system (will be initialized when renderer is available)
    this.gpuTraceSystem = null;
    this.gpuTraceInitializing = false;
    this.renderer = null;
    this.traceDisplayMesh = null;
    
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
    
    // Geometry for mid-point markers
    this.midPointGeometry = new THREE.CircleGeometry(5, 8);
  }
  
  /**
   * Initialize GPU trace system with renderer
   * @param {THREE.WebGLRenderer} renderer The WebGL renderer
   */
  initializeGPUTraces(renderer) {
    if (!renderer || this.gpuTraceSystem || this.gpuTraceInitializing) {
      return;
    }
    
    this.gpuTraceInitializing = true;
    this.renderer = renderer;
    
    try {
      this.gpuTraceSystem = new GPUTraceSystem(renderer, {
        width: 1024,
        height: 1024,
        fadeAmount: 1.0, // No fade for maximum accumulation
        trailIntensity: 1.0,
        pointSize: 1.0, // 1 pixel for pixel-perfect trails
        useLines: true, // Enable line-based rendering for smooth trails
        trailLength: 500 // Long trails for pixel-perfect line rendering (equivalent to 0.999 fade)
      });
      
      if (DEBUG_LAYER_LINK) {
        console.log('[LAYER LINK] GPU trace system initialized with pixel-perfect line trails (default mode)');
      }
    } catch (error) {
      console.error('[LAYER LINK] Failed to initialize GPU trace system:', error);
      this.gpuTraceSystem = null;
    } finally {
      this.gpuTraceInitializing = false;
    }
  }
  
  /**
   * Set the enabled state of layer linking
   * @param {boolean} enabled - Whether layer linking is enabled
   * @param {Object} layerManager - Optional layer manager instance for creating initial links
   */
  setEnabled(enabled, layerManager = null) {
    this.enabled = enabled;
    this.linkGroup.visible = enabled;
    
    if (!enabled) {
      this.clearLinks();
      this.clearTraces();
    } else if (layerManager) {
      // When enabling, create initial links if layerManager is provided
      this.updateLinks(layerManager);
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
    
    if (!enabled) {
      this.clearTraces();
    } else {
      try {
        // Initialize GPU traces if not already done and we have a renderer
        if (this.renderer && !this.gpuTraceSystem) {
          this.initializeGPUTraces(this.renderer);
        }
        
        // For line-based trails (pixel-perfect), always use basic materials mode
        if (this.gpuTraceSystem && this.gpuTraceSystem.useLines) {
          // Force basic materials mode for line trails
          this.gpuTraceSystem.usingBasicMaterials = true;
          
          // Get the appropriate mesh (line or points)
          if (!this.tracePointsMesh) {
            this.tracePointsMesh = this.gpuTraceSystem.getPointsMesh();
            if (this.tracePointsMesh) {
              this.tracePointsMesh.renderOrder = 10; // Render on top
              this.linkGroup.add(this.tracePointsMesh);
              console.log('[LAYER LINK] Added pixel-perfect line trails to scene');
              console.log('[LAYER LINK] Trail mesh details:', {
                geometry: !!this.tracePointsMesh.geometry,
                material: this.tracePointsMesh.material.type,
                isLineSegments: this.tracePointsMesh.type === 'LineSegments',
                visible: this.tracePointsMesh.visible,
                parent: !!this.tracePointsMesh.parent
              });
            } else {
              console.warn('[LAYER LINK] Failed to get line mesh from GPU trace system');
            }
          }
        }
        // For legacy point trails, use GPU feedback system
        else if (this.gpuTraceSystem && !this.gpuTraceSystem.useLines && !this.gpuTraceSystem.usingBasicMaterials) {
          // Add GPU feedback display mesh for legacy point trails
          if (!this.traceDisplayMesh) {
            this.traceDisplayMesh = this.gpuTraceSystem.getDisplayMesh();
            if (this.traceDisplayMesh) {
              // Position the display mesh to match world coordinates
              const worldSize = 1000; // Should match the worldSize in GPUTraceSystem camera setup
              
              this.traceDisplayMesh.position.set(0, 0, 10); // Position in front for visibility
              this.traceDisplayMesh.scale.set(worldSize, worldSize, 1); // Scale to match world bounds exactly
              this.traceDisplayMesh.renderOrder = 1000; // Render on top of everything
              this.traceDisplayMesh.material.transparent = true;
              this.traceDisplayMesh.material.depthTest = false;
              this.traceDisplayMesh.material.depthWrite = false;
              
              // Ensure good visibility settings
              if (this.traceDisplayMesh.material.uniforms) {
                if (this.traceDisplayMesh.material.uniforms.opacity) {
                  this.traceDisplayMesh.material.uniforms.opacity.value = 0.9;
                }
                if (this.traceDisplayMesh.material.uniforms.colorTint) {
                  this.traceDisplayMesh.material.uniforms.colorTint.value.setRGB(1.2, 0.8, 1.2);
                }
              }
              
              this.linkGroup.add(this.traceDisplayMesh);
              console.log('[LAYER LINK] Added GPU feedback trail display mesh to scene (legacy mode)');
              console.log('[LAYER LINK] Display mesh scale:', this.traceDisplayMesh.scale);
            }
          }
        }
        // Fallback: use basic materials for any other case
        else if (this.gpuTraceSystem && !this.tracePointsMesh) {
          this.tracePointsMesh = this.gpuTraceSystem.getPointsMesh();
          if (this.tracePointsMesh) {
            this.tracePointsMesh.renderOrder = 10; // Render on top
            this.linkGroup.add(this.tracePointsMesh);
            console.log('[LAYER LINK] Added basic trail mesh to scene (fallback mode)');
          }
        }
      } catch (error) {
        console.error('[LAYER LINK] Error enabling traces, falling back to basic mode:', error);
        // Force basic materials mode
        if (this.gpuTraceSystem) {
          this.gpuTraceSystem.usingBasicMaterials = true;
        }
      }
    }
    
    // Show/hide trace display mesh (legacy GPU feedback)
    if (this.traceDisplayMesh) {
      this.traceDisplayMesh.visible = enabled;
    }
    
    // Show/hide trace points/line mesh (pixel-perfect or basic)
    if (this.tracePointsMesh) {
      this.tracePointsMesh.visible = enabled;
      console.log('[LAYER LINK] Set trace mesh visibility to', enabled);
    }
    
    if (DEBUG_LAYER_LINK) {
      console.log(`Layer Link trace ${enabled ? 'enabled' : 'disabled'}`);
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
    if (this.traceDisplayMesh) {
      this.traceDisplayMesh.visible = false;
      this.traceDisplayMesh.geometry.dispose();
      this.linkGroup.remove(this.traceDisplayMesh);
      this.traceDisplayMesh = null;
    }
    
    if (this.tracePointsMesh) {
      this.linkGroup.remove(this.tracePointsMesh);
      this.tracePointsMesh = null;
    }
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

    // Initialize GPU traces if we have a renderer but haven't initialized yet
    if (!this.gpuTraceSystem && this.renderer && this.traceEnabled) {
      this.initializeGPUTraces(this.renderer);
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

    // Update GPU traces if enabled and available
    if (this.traceEnabled && this.gpuTraceSystem && this.midPoints.length > 0) {
      const currentTime = performance.now() * 0.001; // Convert to seconds
      this.gpuTraceSystem.render(this.midPoints, currentTime);
    }
  }
  
  /**
   * Set renderer reference for GPU trace initialization
   * @param {THREE.WebGLRenderer} renderer The WebGL renderer
   */
  setRenderer(renderer) {
    this.renderer = renderer;
    
    // Initialize GPU traces immediately if traces are enabled
    if (this.traceEnabled && !this.gpuTraceSystem) {
      this.initializeGPUTraces(renderer);
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
      gpuTraceSystemAvailable: !!this.gpuTraceSystem,
      rendererAvailable: !!this.renderer,
      midPointPositions: this.midPoints.map((mp, i) => ({
        index: i,
        x: mp.position.x.toFixed(2),
        y: mp.position.y.toFixed(2),
        hasGPUTrace: !!this.gpuTraceSystem
      })),
      displayMesh: {
        exists: !!this.traceDisplayMesh,
        visible: this.traceDisplayMesh?.visible,
        position: this.traceDisplayMesh?.position,
        scale: this.traceDisplayMesh?.scale,
        material: this.traceDisplayMesh?.material?.type,
        blending: this.traceDisplayMesh?.material?.blending
      },
      pointsMesh: {
        exists: !!this.tracePointsMesh,
        visible: this.tracePointsMesh?.visible,
        pointCount: this.tracePointsMesh?.geometry?.attributes?.position?.count || 0,
        material: this.tracePointsMesh?.material?.type
      }
    };
  }
  
  /**
   * Dispose of all resources
   */
  dispose() {
    this.clearLinks();
    this.clearTraces();
    
    // Dispose GPU trace system
    if (this.gpuTraceSystem) {
      this.gpuTraceSystem.dispose();
      this.gpuTraceSystem = null;
    }
    
    // Dispose materials
    if (this.linkLineMaterial) this.linkLineMaterial.dispose();
    if (this.midPointMaterial) this.midPointMaterial.dispose();
    if (this.midPointGeometry) this.midPointGeometry.dispose();
    
    // Clear renderer reference
    this.renderer = null;
  }
  
  /**
   * Handle parameter changes that affect layer links
   * @param {number} layerId - ID of the layer that changed
   * @param {string} parameterName - Name of the parameter that changed
   * @param {Object} layerManager - The layer manager instance
   */
  onParameterChange(layerId, parameterName, layerManager) {
    if (!this.enabled || !layerManager) {
      return;
    }
    
    // Check if this parameter affects layer links
    const linkAffectingParams = ['copies', 'segments', 'radius', 'stepScale', 'angle'];
    if (!linkAffectingParams.includes(parameterName)) {
      return;
    }
    
    // Check if this layer is involved in the current link
    if (layerId === this.fromLayerId || layerId === this.toLayerId) {
      // Update links immediately
      this.updateLinks(layerManager);
      
      if (DEBUG_LAYER_LINK) {
        console.log(`[LAYER LINK] Updated links due to ${parameterName} change in layer ${layerId}`);
      }
    }
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
    console.log('Layer link GPU trace enabled');
  };
  
  window.disableLayerLinkTrace = () => {
    layerLinkManager.setTraceEnabled(false);
    console.log('Layer link GPU trace disabled');
  };
  
  window.debugGPUTrace = () => {
    if (layerLinkManager.gpuTraceSystem) {
      console.log('GPU Trace System:', {
        initialized: layerLinkManager.gpuTraceSystem.initialized,
        width: layerLinkManager.gpuTraceSystem.width,
        height: layerLinkManager.gpuTraceSystem.height,
        fadeAmount: layerLinkManager.gpuTraceSystem.fadeAmount,
        trailIntensity: layerLinkManager.gpuTraceSystem.trailIntensity,
        useFloatTextures: layerLinkManager.gpuTraceSystem.useFloatTextures,
        useLinearFiltering: layerLinkManager.gpuTraceSystem.useLinearFiltering,
        displayMeshVisible: layerLinkManager.traceDisplayMesh?.visible,
        displayMeshPosition: layerLinkManager.traceDisplayMesh?.position,
        displayMeshScale: layerLinkManager.traceDisplayMesh?.scale
      });
    } else {
      console.log('GPU Trace System not initialized');
    }
  };
  
  window.setGPUTraceParameters = (params) => {
    if (layerLinkManager.gpuTraceSystem) {
      layerLinkManager.gpuTraceSystem.setParameters(params);
      console.log('GPU trace parameters updated:', params);
    } else {
      console.log('GPU Trace System not available');
    }
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
  
  window.debugSceneHierarchy = () => {
    console.log('=== Scene Hierarchy Debug ===');
    
    const linkGroup = layerLinkManager.getLinkGroup();
    console.log('Link Group:', {
      visible: linkGroup.visible,
      childCount: linkGroup.children.length,
      parent: !!linkGroup.parent
    });
    
    linkGroup.children.forEach((child, i) => {
      console.log(`Child ${i}:`, {
        type: child.type,
        name: child.name || 'unnamed',
        visible: child.visible,
        position: child.position,
        material: child.material?.type,
        geometry: child.geometry?.type,
        pointCount: child.geometry?.attributes?.position?.count || 0
      });
    });
    
    if (layerLinkManager.tracePointsMesh) {
      console.log('Trace Points Mesh:', {
        exists: true,
        visible: layerLinkManager.tracePointsMesh.visible,
        parent: !!layerLinkManager.tracePointsMesh.parent,
        parentName: layerLinkManager.tracePointsMesh.parent?.name,
        position: layerLinkManager.tracePointsMesh.position,
        material: {
          type: layerLinkManager.tracePointsMesh.material.type,
          color: layerLinkManager.tracePointsMesh.material.color,
          size: layerLinkManager.tracePointsMesh.material.size,
          opacity: layerLinkManager.tracePointsMesh.material.opacity,
          transparent: layerLinkManager.tracePointsMesh.material.transparent
        },
        geometry: {
          type: layerLinkManager.tracePointsMesh.geometry.type,
          pointCount: layerLinkManager.tracePointsMesh.geometry.attributes?.position?.count || 0,
          hasPositions: !!layerLinkManager.tracePointsMesh.geometry.attributes?.position,
          hasColors: !!layerLinkManager.tracePointsMesh.geometry.attributes?.color
        }
      });
      
      // Check first few point positions
      const positions = layerLinkManager.tracePointsMesh.geometry.attributes?.position;
      if (positions && positions.count > 0) {
        console.log('First 3 point positions:');
        for (let i = 0; i < Math.min(3, positions.count); i++) {
          const x = positions.getX(i);
          const y = positions.getY(i);
          const z = positions.getZ(i);
          console.log(`  Point ${i}: (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
        }
      }
    } else {
      console.log('Trace Points Mesh: not found');
    }
    
    console.log('=== End Scene Hierarchy Debug ===');
  };
  
  window.testGPUTrace = () => {
    console.log('Testing GPU trace system...');
    
    // Enable layer links and traces
    layerLinkManager.setEnabled(true);
    layerLinkManager.setTraceEnabled(true);
    
    console.log('Layer link status:', layerLinkManager.getStatus());
    
    // Force a manual render if we have midpoints
    if (layerLinkManager.gpuTraceSystem && layerLinkManager.midPoints.length > 0) {
      console.log('Forcing manual GPU trace render with', layerLinkManager.midPoints.length, 'points');
      layerLinkManager.gpuTraceSystem.render(layerLinkManager.midPoints, performance.now() * 0.001);
    }
  };
  
  window.clearGPUTrace = () => {
    if (layerLinkManager.gpuTraceSystem) {
      layerLinkManager.gpuTraceSystem.clearTargets();
      console.log('GPU trace targets cleared');
    }
  };
  
  window.diagnoseGPUTrace = () => {
    console.log('=== GPU Trace System Diagnosis ===');
    
    const status = layerLinkManager.getStatus();
    console.log('Layer Link Status:', status);
    
    if (layerLinkManager.gpuTraceSystem) {
      console.log('GPU Trace System Details:', {
        initialized: layerLinkManager.gpuTraceSystem.initialized,
        usingFallback: layerLinkManager.gpuTraceSystem.usingFallback || false,
        renderTargets: {
          currentTarget: !!layerLinkManager.gpuTraceSystem.currentTarget,
          previousTarget: !!layerLinkManager.gpuTraceSystem.previousTarget,
          width: layerLinkManager.gpuTraceSystem.width,
          height: layerLinkManager.gpuTraceSystem.height
        },
        materials: {
          feedbackMaterial: !!layerLinkManager.gpuTraceSystem.feedbackMaterial,
          pointMaterial: !!layerLinkManager.gpuTraceSystem.pointMaterial,
          displayMaterial: !!layerLinkManager.gpuTraceSystem.displayMaterial
        },
        displayMesh: {
          exists: !!layerLinkManager.traceDisplayMesh,
          visible: layerLinkManager.traceDisplayMesh?.visible,
          position: layerLinkManager.traceDisplayMesh?.position,
          scale: layerLinkManager.traceDisplayMesh?.scale,
          material: layerLinkManager.traceDisplayMesh?.material?.type,
          blending: layerLinkManager.traceDisplayMesh?.material?.blending
        },
        pointsMesh: {
          exists: !!layerLinkManager.tracePointsMesh,
          visible: layerLinkManager.tracePointsMesh?.visible,
          pointCount: layerLinkManager.tracePointsMesh?.geometry?.attributes?.position?.count || 0,
          material: layerLinkManager.tracePointsMesh?.material?.type
        }
      });
      
      // Check if we have midpoints to trace
      if (status.midPointCount > 0) {
        console.log('Midpoint positions (first 3):');
        status.midPointPositions.slice(0, 3).forEach((mp, i) => {
          console.log(`  Point ${i}: (${mp.x}, ${mp.y})`);
        });
      } else {
        console.log('⚠️ No midpoints found - make sure layer links are enabled and you have 2+ layers');
      }
      
    } else {
      console.log('❌ GPU Trace System not initialized');
      console.log('Renderer available:', !!layerLinkManager.renderer);
    }
    
    console.log('=== End Diagnosis ===');
  };
  
  window.testGPUTrails = () => {
    console.log('Testing GPU trail system...');
    
    // Clear current system
    layerLinkManager.clearTraces();
    
    // Reinitialize with trails
    if (layerLinkManager.gpuTraceSystem) {
      layerLinkManager.gpuTraceSystem.dispose();
      layerLinkManager.gpuTraceSystem = null;
    }
    
    // Force recreation of GPU trace system
    layerLinkManager.initializeGPUTraces(layerLinkManager.renderer);
    
    // Enable traces
    layerLinkManager.setTraceEnabled(true);
    
    console.log('GPU trail system reinitialized');
    console.log('Using basic materials:', layerLinkManager.gpuTraceSystem?.usingBasicMaterials);
    console.log('Display mesh available:', !!layerLinkManager.traceDisplayMesh);
    console.log('Points mesh available:', !!layerLinkManager.tracePointsMesh);
  };
  
  window.setTrailParameters = (params) => {
    if (layerLinkManager.gpuTraceSystem) {
      layerLinkManager.gpuTraceSystem.setParameters(params);
      console.log('Trail parameters updated:', params);
    } else {
      console.log('GPU trace system not available');
    }
  };
  
  window.setTrailScale = (scale) => {
    if (layerLinkManager.traceDisplayMesh) {
      layerLinkManager.traceDisplayMesh.scale.set(scale, scale, 1);
      console.log('Trail display mesh scale set to:', scale);
    } else {
      console.log('Trail display mesh not found');
    }
  };
  
  window.setTrailPosition = (x, y, z) => {
    if (layerLinkManager.traceDisplayMesh) {
      layerLinkManager.traceDisplayMesh.position.set(x, y, z);
      console.log('Trail display mesh position set to:', x, y, z);
    } else {
      console.log('Trail display mesh not found');
    }
  };
  
  window.debugTrailSystem = () => {
    console.log('=== Trail System Debug ===');
    
    if (layerLinkManager.gpuTraceSystem) {
      console.log('GPU Trace System:', {
        initialized: layerLinkManager.gpuTraceSystem.initialized,
        usingBasicMaterials: layerLinkManager.gpuTraceSystem.usingBasicMaterials,
        fadeAmount: layerLinkManager.gpuTraceSystem.fadeAmount,
        currentTarget: !!layerLinkManager.gpuTraceSystem.currentTarget,
        previousTarget: !!layerLinkManager.gpuTraceSystem.previousTarget,
        displayMaterial: !!layerLinkManager.gpuTraceSystem.displayMaterial,
        pointMaterial: !!layerLinkManager.gpuTraceSystem.pointMaterial,
        feedbackMaterial: !!layerLinkManager.gpuTraceSystem.feedbackMaterial
      });
      
      // Check if display material has trail texture
      if (layerLinkManager.gpuTraceSystem.displayMaterial.uniforms) {
        console.log('Display material uniforms:', {
          trailTexture: !!layerLinkManager.gpuTraceSystem.displayMaterial.uniforms.trailTexture?.value,
          opacity: layerLinkManager.gpuTraceSystem.displayMaterial.uniforms.opacity?.value,
          colorTint: layerLinkManager.gpuTraceSystem.displayMaterial.uniforms.colorTint?.value
        });
      }
    } else {
      console.log('GPU Trace System not initialized');
    }
    
    if (layerLinkManager.traceDisplayMesh) {
      console.log('Display Mesh:', {
        visible: layerLinkManager.traceDisplayMesh.visible,
        position: layerLinkManager.traceDisplayMesh.position,
        scale: layerLinkManager.traceDisplayMesh.scale,
        renderOrder: layerLinkManager.traceDisplayMesh.renderOrder,
        material: layerLinkManager.traceDisplayMesh.material.type
      });
    } else {
      console.log('Display Mesh not found');
    }
    
    console.log('=== End Trail System Debug ===');
  };
  
  window.forceTrailRender = () => {
    if (layerLinkManager.gpuTraceSystem && layerLinkManager.midPoints.length > 0) {
      console.log('Forcing trail render with', layerLinkManager.midPoints.length, 'points');
      layerLinkManager.gpuTraceSystem.render(layerLinkManager.midPoints, performance.now() * 0.001);
    } else {
      console.log('Cannot force trail render - system not ready or no midpoints');
    }
  };
  
  window.disableGPUTrails = () => {
    console.log('Disabling GPU trails and forcing basic materials mode...');
    
    if (layerLinkManager.gpuTraceSystem) {
      layerLinkManager.gpuTraceSystem.usingBasicMaterials = true;
      console.log('Forced basic materials mode');
    }
    
    // Clear any existing display mesh that might be causing issues
    if (layerLinkManager.traceDisplayMesh) {
      layerLinkManager.linkGroup.remove(layerLinkManager.traceDisplayMesh);
      layerLinkManager.traceDisplayMesh = null;
      console.log('Removed trail display mesh');
    }
    
    // Re-enable traces with basic materials only
    layerLinkManager.setTraceEnabled(false);
    layerLinkManager.setTraceEnabled(true);
    
    console.log('GPU trails disabled, using basic points only');
  };
  
  window.forceBasicMaterials = () => {
    console.log('=== Forcing Basic Materials Mode ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system found');
      return;
    }
    
    console.log('Current state:', {
      usingBasicMaterials: layerLinkManager.gpuTraceSystem.usingBasicMaterials,
      usingFallback: layerLinkManager.gpuTraceSystem.usingFallback,
      initialized: layerLinkManager.gpuTraceSystem.initialized
    });
    
    // Force basic materials mode
    layerLinkManager.gpuTraceSystem.usingBasicMaterials = true;
    
    // Recreate basic materials to ensure they're properly set up
    layerLinkManager.gpuTraceSystem.createBasicMaterials();
    
    console.log('After forcing basic materials:', {
      usingBasicMaterials: layerLinkManager.gpuTraceSystem.usingBasicMaterials,
      pointMaterial: layerLinkManager.gpuTraceSystem.pointMaterial?.type || 'unknown',
      pointMaterialSize: layerLinkManager.gpuTraceSystem.pointMaterial?.size || 'unknown'
    });
    
    // Clear any shader-based display mesh
    if (layerLinkManager.traceDisplayMesh) {
      layerLinkManager.linkGroup.remove(layerLinkManager.traceDisplayMesh);
      layerLinkManager.traceDisplayMesh = null;
      console.log('Removed shader-based display mesh');
    }
    
    // Clear any existing points mesh
    if (layerLinkManager.tracePointsMesh) {
      layerLinkManager.linkGroup.remove(layerLinkManager.tracePointsMesh);
      layerLinkManager.tracePointsMesh = null;
      console.log('Removed existing points mesh');
    }
    
    // Re-enable traces to create new basic materials mesh
    layerLinkManager.setTraceEnabled(false);
    setTimeout(() => {
      layerLinkManager.setTraceEnabled(true);
      console.log('Re-enabled traces with basic materials');
      
      // Check the new state
      setTimeout(() => {
        console.log('Final state check:', {
          traceEnabled: layerLinkManager.traceEnabled,
          pointsMeshExists: !!layerLinkManager.tracePointsMesh,
          pointsMeshVisible: layerLinkManager.tracePointsMesh?.visible,
          pointCount: layerLinkManager.tracePointsMesh?.geometry?.attributes?.position?.count || 0,
          midPointsCount: layerLinkManager.midPoints.length
        });
      }, 100);
    }, 100);
  };
  
  window.checkGPUTraceState = () => {
    console.log('=== GPU Trace State Check ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    console.log('GPU Trace System:', {
      initialized: system.initialized,
      usingBasicMaterials: system.usingBasicMaterials,
      usingFallback: system.usingFallback,
      pointMaterial: {
        type: system.pointMaterial?.type,
        size: system.pointMaterial?.size,
        color: system.pointMaterial?.color?.getHex?.(),
        opacity: system.pointMaterial?.opacity
      },
      geometry: {
        exists: !!system.pointsGeometry,
        positionCount: system.pointsGeometry?.attributes?.position?.count || 0,
        colorCount: system.pointsGeometry?.attributes?.color?.count || 0
      },
      mesh: {
        exists: !!system.pointsMesh,
        visible: system.pointsMesh?.visible,
        parent: !!system.pointsMesh?.parent
      }
    });
    
    console.log('Layer Link Manager:', {
      traceEnabled: layerLinkManager.traceEnabled,
      midPointsCount: layerLinkManager.midPoints.length,
      tracePointsMesh: {
        exists: !!layerLinkManager.tracePointsMesh,
        visible: layerLinkManager.tracePointsMesh?.visible,
        inScene: !!layerLinkManager.tracePointsMesh?.parent
      }
    });
  };
  
  window.enableGPUTrails = () => {
    console.log('=== Enabling GPU Trails ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system found');
      return;
    }
    
    console.log('Current state:', {
      usingBasicMaterials: layerLinkManager.gpuTraceSystem.usingBasicMaterials,
      traceEnabled: layerLinkManager.traceEnabled,
      midPointsCount: layerLinkManager.midPoints.length
    });
    
    try {
      // Force custom shader materials mode
      layerLinkManager.gpuTraceSystem.usingBasicMaterials = false;
      
      // Recreate custom shader materials
      layerLinkManager.gpuTraceSystem.createTrailShaders();
      
      // Test the materials to make sure they work
      const testResult = layerLinkManager.gpuTraceSystem.testMaterials();
      
      if (!testResult) {
        console.warn('Shader materials failed validation, falling back to basic materials');
        layerLinkManager.gpuTraceSystem.usingBasicMaterials = true;
        layerLinkManager.gpuTraceSystem.createBasicMaterials();
        return;
      }
      
      console.log('Shader materials validated successfully');
      
      // Clear any existing basic materials mesh
      if (layerLinkManager.tracePointsMesh) {
        layerLinkManager.linkGroup.remove(layerLinkManager.tracePointsMesh);
        layerLinkManager.tracePointsMesh = null;
        console.log('Removed basic materials points mesh');
      }
      
      // Clear render targets to start fresh
      layerLinkManager.gpuTraceSystem.clearTargets();
      
      // Re-enable traces to create shader-based display mesh
      layerLinkManager.setTraceEnabled(false);
      setTimeout(() => {
        layerLinkManager.setTraceEnabled(true);
        console.log('Re-enabled traces with GPU shaders');
        
        // Check the new state
        setTimeout(() => {
          console.log('GPU Trails state check:', {
            usingBasicMaterials: layerLinkManager.gpuTraceSystem.usingBasicMaterials,
            displayMeshExists: !!layerLinkManager.traceDisplayMesh,
            displayMeshVisible: layerLinkManager.traceDisplayMesh?.visible,
            pointsMeshExists: !!layerLinkManager.tracePointsMesh,
            renderTargetsReady: !!(layerLinkManager.gpuTraceSystem.currentTarget && layerLinkManager.gpuTraceSystem.previousTarget)
          });
          
          // Force a manual render to start the trail system
          if (layerLinkManager.gpuTraceSystem && layerLinkManager.midPoints.length > 0) {
            console.log('Starting trail rendering...');
            layerLinkManager.gpuTraceSystem.render(layerLinkManager.midPoints, performance.now() * 0.001);
          }
        }, 100);
      }, 100);
      
    } catch (error) {
      console.error('Failed to enable GPU trails:', error);
      // Fall back to basic materials
      layerLinkManager.gpuTraceSystem.usingBasicMaterials = true;
      layerLinkManager.gpuTraceSystem.createBasicMaterials();
    }
  };
  
  window.testShaderCompilation = () => {
    console.log('=== Testing Shader Compilation ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    try {
      // Test creating a simple shader material
      const testShader = new THREE.ShaderMaterial({
        uniforms: {
          pointSize: { value: 10.0 }
        },
        vertexShader: `
          uniform float pointSize;
          void main() {
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = pointSize;
          }
        `,
        fragmentShader: `
          void main() {
            gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
          }
        `
      });
      
      // Test with a simple geometry
      const testGeometry = new THREE.BufferGeometry();
      testGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
      
      const testPoints = new THREE.Points(testGeometry, testShader);
      
      console.log('Basic shader compilation: SUCCESS');
      
      // Clean up
      testGeometry.dispose();
      testShader.dispose();
      
      // Now test the actual trail shaders
      layerLinkManager.gpuTraceSystem.createTrailShaders();
      const trailTestResult = layerLinkManager.gpuTraceSystem.testMaterials();
      
      console.log('Trail shader compilation:', trailTestResult ? 'SUCCESS' : 'FAILED');
      
      return trailTestResult;
      
    } catch (error) {
      console.error('Shader compilation test failed:', error);
      return false;
    }
  };
  
  window.debugTrailRendering = () => {
    console.log('=== Trail Rendering Debug ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    console.log('Render Targets:', {
      currentTarget: !!system.currentTarget,
      previousTarget: !!system.previousTarget,
      targetSize: system.currentTarget ? `${system.currentTarget.width}x${system.currentTarget.height}` : 'N/A'
    });
    
    console.log('Materials:', {
      pointMaterial: system.pointMaterial?.type,
      feedbackMaterial: system.feedbackMaterial?.type,
      displayMaterial: system.displayMaterial?.type,
      pointMaterialUniforms: !!system.pointMaterial?.uniforms,
      feedbackMaterialUniforms: !!system.feedbackMaterial?.uniforms,
      displayMaterialUniforms: !!system.displayMaterial?.uniforms
    });
    
    // Show actual uniform values
    if (system.feedbackMaterial?.uniforms) {
      console.log('Feedback Material Uniforms:', {
        fadeAmount: system.feedbackMaterial.uniforms.fadeAmount?.value,
        previousFrame: !!system.feedbackMaterial.uniforms.previousFrame?.value
      });
    }
    
    if (system.pointMaterial?.uniforms) {
      console.log('Point Material Uniforms:', {
        pointSize: system.pointMaterial.uniforms.pointSize?.value,
        opacity: system.pointMaterial.uniforms.opacity?.value
      });
    }
    
    if (system.displayMaterial?.uniforms) {
      console.log('Display Material Uniforms:', {
        opacity: system.displayMaterial.uniforms.opacity?.value,
        colorTint: system.displayMaterial.uniforms.colorTint?.value,
        trailTexture: !!system.displayMaterial.uniforms.trailTexture?.value
      });
    }
    
    console.log('Scenes:', {
      pointScene: !!system.pointScene,
      feedbackScene: !!system.feedbackScene,
      displayScene: !!system.displayScene,
      pointSceneChildren: system.pointScene?.children?.length || 0,
      feedbackSceneChildren: system.feedbackScene?.children?.length || 0
    });
    
    console.log('Display Mesh:', {
      exists: !!layerLinkManager.traceDisplayMesh,
      visible: layerLinkManager.traceDisplayMesh?.visible,
      position: layerLinkManager.traceDisplayMesh?.position,
      scale: layerLinkManager.traceDisplayMesh?.scale,
      material: layerLinkManager.traceDisplayMesh?.material?.type,
      hasTexture: !!(layerLinkManager.traceDisplayMesh?.material?.uniforms?.trailTexture?.value)
    });
    
    // Try a manual render
    if (system && layerLinkManager.midPoints.length > 0) {
      console.log('Attempting manual render with', layerLinkManager.midPoints.length, 'points...');
      try {
        system.render(layerLinkManager.midPoints, performance.now() * 0.001);
        console.log('Manual render completed successfully');
      } catch (error) {
        console.error('Manual render failed:', error);
      }
    }
  };
  
  window.setTrailFade = (fadeAmount) => {
    console.log('=== Setting Trail Fade ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Update the system's fadeAmount property
    system.fadeAmount = fadeAmount;
    
    // Directly update the shader uniform if it exists
    if (system.feedbackMaterial && system.feedbackMaterial.uniforms && system.feedbackMaterial.uniforms.fadeAmount) {
      system.feedbackMaterial.uniforms.fadeAmount.value = fadeAmount;
      console.log('Updated feedback material fadeAmount to:', fadeAmount);
    } else {
      console.log('Feedback material or fadeAmount uniform not found');
      console.log('Material type:', system.feedbackMaterial?.type);
      console.log('Has uniforms:', !!system.feedbackMaterial?.uniforms);
    }
    
    // Verify the change
    setTimeout(() => {
      const currentValue = system.feedbackMaterial?.uniforms?.fadeAmount?.value;
      console.log('Verified fadeAmount is now:', currentValue);
      
      if (currentValue !== fadeAmount) {
        console.warn('fadeAmount was not updated properly!');
      }
    }, 100);
  };
  
  window.clearTrails = () => {
    console.log('Clearing all trails...');
    
    if (layerLinkManager.gpuTraceSystem) {
      layerLinkManager.gpuTraceSystem.clearTargets();
      console.log('Trail render targets cleared');
    }
  };
  
  window.testTrailFadeValues = () => {
    console.log('=== Testing Different Fade Values ===');
    
    const fadeValues = [0.99, 0.95, 0.9, 0.8, 0.7];
    let index = 0;
    
    const testNext = () => {
      if (index < fadeValues.length) {
        const fadeValue = fadeValues[index];
        console.log(`Testing fade value: ${fadeValue}`);
        
        // Clear trails and set new fade value
        clearTrails();
        setTrailFade(fadeValue);
        
        index++;
        setTimeout(testNext, 3000); // Wait 3 seconds between tests
      } else {
        console.log('Fade value testing complete');
      }
    };
    
    testNext();
  };
  
  window.emergencyStop = () => {
    console.log('Emergency stop - disabling all traces');
    layerLinkManager.setTraceEnabled(false);
    layerLinkManager.clearTraces();
    
    if (layerLinkManager.gpuTraceSystem) {
      layerLinkManager.gpuTraceSystem.dispose();
      layerLinkManager.gpuTraceSystem = null;
    }
    
    console.log('All trace systems stopped');
  };
  
  window.fixTrailDisplay = () => {
    console.log('=== Fixing Trail Display ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Check if we have a display mesh
    if (!layerLinkManager.traceDisplayMesh) {
      console.log('No display mesh found, creating one...');
      
      // Get the display mesh from the GPU system
      layerLinkManager.traceDisplayMesh = system.getDisplayMesh();
      
      if (layerLinkManager.traceDisplayMesh) {
        // Configure the display mesh
        const worldSize = 1000;
        layerLinkManager.traceDisplayMesh.position.set(0, 0, -1);
        layerLinkManager.traceDisplayMesh.scale.set(worldSize, worldSize, 1);
        layerLinkManager.traceDisplayMesh.renderOrder = 0;
        layerLinkManager.traceDisplayMesh.material.transparent = true;
        layerLinkManager.traceDisplayMesh.material.depthTest = false;
        layerLinkManager.traceDisplayMesh.material.depthWrite = false;
        
        // Add to the scene
        layerLinkManager.linkGroup.add(layerLinkManager.traceDisplayMesh);
        console.log('Display mesh created and added to scene');
      } else {
        console.error('Failed to get display mesh from GPU system');
        return;
      }
    }
    
    // Ensure display mesh is visible
    if (layerLinkManager.traceDisplayMesh) {
      layerLinkManager.traceDisplayMesh.visible = true;
      console.log('Display mesh set to visible');
      
      // Update the texture reference
      if (system.displayMaterial.uniforms && system.displayMaterial.uniforms.trailTexture) {
        system.displayMaterial.uniforms.trailTexture.value = system.previousTarget.texture;
        console.log('Updated display material texture reference');
      }
      
      // Check material properties
      console.log('Display mesh material:', {
        type: layerLinkManager.traceDisplayMesh.material.type,
        transparent: layerLinkManager.traceDisplayMesh.material.transparent,
        opacity: layerLinkManager.traceDisplayMesh.material.opacity || layerLinkManager.traceDisplayMesh.material.uniforms?.opacity?.value,
        blending: layerLinkManager.traceDisplayMesh.material.blending,
        visible: layerLinkManager.traceDisplayMesh.visible,
        hasTexture: !!(layerLinkManager.traceDisplayMesh.material.uniforms?.trailTexture?.value)
      });
    }
    
    // Force a render to update the trails
    if (layerLinkManager.midPoints.length > 0) {
      console.log('Forcing trail render...');
      system.render(layerLinkManager.midPoints, performance.now() * 0.001);
    }
    
    console.log('Trail display fix complete');
  };
  
  window.makeTrailsMoreVisible = () => {
    console.log('=== Making Trails More Visible ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Increase point size for more visible trails
    if (system.pointMaterial.uniforms && system.pointMaterial.uniforms.pointSize) {
      system.pointMaterial.uniforms.pointSize.value = 100;
      console.log('Increased point size to 100');
    }
    
    // Increase point opacity
    if (system.pointMaterial.uniforms && system.pointMaterial.uniforms.opacity) {
      system.pointMaterial.uniforms.opacity.value = 1.0;
      console.log('Set point opacity to 1.0');
    }
    
    // Increase display opacity
    if (system.displayMaterial.uniforms && system.displayMaterial.uniforms.opacity) {
      system.displayMaterial.uniforms.opacity.value = 1.0;
      console.log('Set display opacity to 1.0');
    }
    
    // Set a bright color tint
    if (system.displayMaterial.uniforms && system.displayMaterial.uniforms.colorTint) {
      system.displayMaterial.uniforms.colorTint.value.setRGB(2.0, 0.5, 2.0); // Bright magenta
      console.log('Set bright magenta color tint');
    }
    
    // Set slow fade for long trails
    setTrailFade(0.98);
    
    // Clear and restart trails
    clearTrails();
    
    // Force multiple renders to build up trails
    setTimeout(() => {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          system.render(layerLinkManager.midPoints, performance.now() * 0.001);
        }, i * 100);
      }
    }, 100);
    
    console.log('Trail visibility enhanced');
  };
  
  window.debugTrailTexture = () => {
    console.log('=== Trail Texture Debug ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    console.log('Render Targets:', {
      currentTarget: {
        exists: !!system.currentTarget,
        width: system.currentTarget?.width,
        height: system.currentTarget?.height,
        texture: !!system.currentTarget?.texture
      },
      previousTarget: {
        exists: !!system.previousTarget,
        width: system.previousTarget?.width,
        height: system.previousTarget?.height,
        texture: !!system.previousTarget?.texture
      }
    });
    
    // Check if the display material has the texture
    if (system.displayMaterial.uniforms && system.displayMaterial.uniforms.trailTexture) {
      const texture = system.displayMaterial.uniforms.trailTexture.value;
      console.log('Display Material Texture:', {
        exists: !!texture,
        isRenderTargetTexture: texture?.isRenderTargetTexture,
        format: texture?.format,
        type: texture?.type
      });
    }
    
    // Check if display mesh exists and has the material
    if (layerLinkManager.traceDisplayMesh) {
      console.log('Display Mesh:', {
        exists: true,
        visible: layerLinkManager.traceDisplayMesh.visible,
        material: layerLinkManager.traceDisplayMesh.material.type,
        hasUniforms: !!layerLinkManager.traceDisplayMesh.material.uniforms,
        inScene: !!layerLinkManager.traceDisplayMesh.parent
      });
    } else {
      console.log('Display Mesh: does not exist');
    }
  };
  
  window.debugFeedbackLoop = () => {
    console.log('=== Feedback Loop Debug ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    console.log('Feedback System State:', {
      feedbackMaterial: {
        exists: !!system.feedbackMaterial,
        type: system.feedbackMaterial?.type,
        hasUniforms: !!system.feedbackMaterial?.uniforms,
        fadeAmount: system.feedbackMaterial?.uniforms?.fadeAmount?.value,
        previousFrame: !!system.feedbackMaterial?.uniforms?.previousFrame?.value
      },
      feedbackScene: {
        exists: !!system.feedbackScene,
        children: system.feedbackScene?.children?.length || 0
      },
      feedbackMesh: {
        exists: !!system.feedbackMesh,
        visible: system.feedbackMesh?.visible,
        material: system.feedbackMesh?.material?.type
      }
    });
    
    // Check if feedback mesh is properly set up
    if (system.feedbackMesh) {
      console.log('Feedback Mesh Details:', {
        geometry: system.feedbackMesh.geometry?.type,
        material: system.feedbackMesh.material?.type,
        visible: system.feedbackMesh.visible,
        inScene: system.feedbackScene?.children?.includes(system.feedbackMesh)
      });
    }
    
    // Check render target ping-pong
    console.log('Ping-Pong State:', {
      currentTargetSame: system.currentTarget === system.previousTarget,
      bothTargetsExist: !!(system.currentTarget && system.previousTarget),
      targetsDifferent: system.currentTarget !== system.previousTarget
    });
    
    if (system.currentTarget === system.previousTarget) {
      console.error('❌ PROBLEM: Current and previous targets are the same! Ping-pong not working.');
    } else {
      console.log('✅ Ping-pong targets are different (good)');
    }
  };
  
  window.fixFeedbackLoop = () => {
    console.log('=== Fixing Feedback Loop ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Check if feedback material exists and has correct uniforms
    if (!system.feedbackMaterial || !system.feedbackMaterial.uniforms) {
      console.log('Recreating feedback material...');
      
      // Recreate the feedback material with proper uniforms
      system.feedbackMaterial = new THREE.ShaderMaterial({
        uniforms: {
          previousFrame: { value: null },
          fadeAmount: { value: system.fadeAmount || 0.95 }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D previousFrame;
          uniform float fadeAmount;
          varying vec2 vUv;
          
          void main() {
            vec4 prevColor = texture2D(previousFrame, vUv);
            gl_FragColor = vec4(prevColor.rgb * fadeAmount, prevColor.a * fadeAmount);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false
      });
      
      console.log('Feedback material recreated');
    }
    
    // Ensure feedback mesh exists
    if (!system.feedbackMesh) {
      console.log('Creating feedback mesh...');
      
      const feedbackGeometry = new THREE.PlaneGeometry(2, 2);
      system.feedbackMesh = new THREE.Mesh(feedbackGeometry, system.feedbackMaterial);
      system.feedbackMesh.position.z = 0;
      
      console.log('Feedback mesh created');
    }
    
    // Ensure feedback scene exists and has the mesh
    if (!system.feedbackScene) {
      system.feedbackScene = new THREE.Scene();
      console.log('Feedback scene created');
    }
    
    if (!system.feedbackScene.children.includes(system.feedbackMesh)) {
      system.feedbackScene.add(system.feedbackMesh);
      console.log('Feedback mesh added to feedback scene');
    }
    
    // Ensure render targets are different (ping-pong)
    if (system.currentTarget === system.previousTarget) {
      console.log('Fixing ping-pong targets...');
      
      // Create new render targets
      const renderTargetOptions = {
        width: system.width || 1024,
        height: system.height || 1024,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping
      };
      
      system.currentTarget = new THREE.WebGLRenderTarget(renderTargetOptions.width, renderTargetOptions.height, renderTargetOptions);
      system.previousTarget = new THREE.WebGLRenderTarget(renderTargetOptions.width, renderTargetOptions.height, renderTargetOptions);
      
      console.log('New ping-pong targets created');
    }
    
    // Update feedback material to use previous target
    if (system.feedbackMaterial.uniforms.previousFrame) {
      system.feedbackMaterial.uniforms.previousFrame.value = system.previousTarget.texture;
      console.log('Feedback material updated with previous frame texture');
    }
    
    // Update display material to use current target
    if (system.displayMaterial.uniforms && system.displayMaterial.uniforms.trailTexture) {
      system.displayMaterial.uniforms.trailTexture.value = system.currentTarget.texture;
      console.log('Display material updated with current frame texture');
    }
    
    console.log('Feedback loop fix complete');
  };
  
  window.testFeedbackLoop = () => {
    console.log('=== Testing Feedback Loop ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // First fix any issues
    fixFeedbackLoop();
    
    // Clear targets to start fresh
    clearTrails();
    
    // Set a very slow fade for testing
    setTrailFade(0.99);
    
    // Force several renders to build up the feedback effect
    console.log('Rendering multiple frames to test feedback...');
    
    for (let i = 0; i < 10; i++) {
      setTimeout(() => {
        console.log(`Feedback test render ${i + 1}/10`);
        system.render(layerLinkManager.midPoints, performance.now() * 0.001);
        
        if (i === 9) {
          console.log('Feedback test complete - trails should now be visible');
        }
      }, i * 200);
    }
  };
  
  window.monitorFeedbackLoop = () => {
    console.log('=== Monitoring Feedback Loop ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Store original render method to intercept calls
    const originalRender = system.render.bind(system);
    
    system.render = function(midPoints, time) {
      console.log('🔄 Render called with', midPoints.length, 'points');
      
      // Check state before render
      console.log('Before render:', {
        currentTarget: !!this.currentTarget,
        previousTarget: !!this.previousTarget,
        feedbackMaterial: !!this.feedbackMaterial,
        feedbackMesh: !!this.feedbackMesh,
        displayMaterial: !!this.displayMaterial
      });
      
      // Check if render targets are being cleared
      const currentTexture = this.currentTarget?.texture;
      const previousTexture = this.previousTarget?.texture;
      
      console.log('Texture state before render:', {
        currentTextureExists: !!currentTexture,
        previousTextureExists: !!previousTexture,
        texturesAreDifferent: currentTexture !== previousTexture
      });
      
      // Call original render
      const result = originalRender(midPoints, time);
      
      // Check state after render
      console.log('After render:', {
        currentTarget: !!this.currentTarget,
        previousTarget: !!this.previousTarget,
        targetsSwapped: this.currentTarget !== currentTexture
      });
      
      return result;
    };
    
    console.log('Feedback loop monitoring enabled. Render calls will be logged.');
    console.log('Run stopMonitoring() to disable.');
  };
  
  window.stopMonitoring = () => {
    if (layerLinkManager.gpuTraceSystem && layerLinkManager.gpuTraceSystem.render) {
      // We need to restore the original render method
      // For now, just reload the page or restart the system
      console.log('To stop monitoring, restart the GPU trace system with:');
      console.log('enableGPUTrails()');
    }
  };
  
  window.checkRenderTargetContents = () => {
    console.log('=== Checking Render Target Contents ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Try to read pixel data from render targets (this might not work due to WebGL restrictions)
    if (system.currentTarget && system.previousTarget) {
      console.log('Render targets exist:', {
        current: {
          width: system.currentTarget.width,
          height: system.currentTarget.height,
          texture: !!system.currentTarget.texture
        },
        previous: {
          width: system.previousTarget.width,
          height: system.previousTarget.height,
          texture: !!system.previousTarget.texture
        }
      });
      
      // Check if the renderer is clearing the targets
      const renderer = layerLinkManager.renderer;
      if (renderer) {
        console.log('Renderer state:', {
          autoClear: renderer.autoClear,
          autoClearColor: renderer.autoClearColor,
          autoClearDepth: renderer.autoClearDepth,
          autoClearStencil: renderer.autoClearStencil
        });
      }
    }
  };
  
  window.testMinimalFeedback = () => {
    console.log('=== Testing Minimal Feedback ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    const renderer = layerLinkManager.renderer;
    
    if (!renderer) {
      console.log('No renderer available');
      return;
    }
    
    // Save current render target
    const originalTarget = renderer.getRenderTarget();
    
    try {
      // Clear both targets to black
      renderer.setRenderTarget(system.currentTarget);
      renderer.clear();
      
      renderer.setRenderTarget(system.previousTarget);
      renderer.clear();
      
      // Render a simple white square to current target
      const testScene = new THREE.Scene();
      const testGeometry = new THREE.PlaneGeometry(0.2, 0.2);
      const testMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const testMesh = new THREE.Mesh(testGeometry, testMaterial);
      testScene.add(testMesh);
      
      const testCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      testCamera.position.z = 1;
      
      renderer.setRenderTarget(system.currentTarget);
      renderer.render(testScene, testCamera);
      
      console.log('Rendered white square to current target');
      
      // Now test feedback: render previous target to current with fade
      const feedbackScene = new THREE.Scene();
      const feedbackGeometry = new THREE.PlaneGeometry(2, 2);
      const feedbackMaterial = new THREE.ShaderMaterial({
        uniforms: {
          previousFrame: { value: system.previousTarget.texture },
          fadeAmount: { value: 0.9 }
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D previousFrame;
          uniform float fadeAmount;
          varying vec2 vUv;
          void main() {
            vec4 prevColor = texture2D(previousFrame, vUv);
            gl_FragColor = vec4(prevColor.rgb * fadeAmount, 1.0);
          }
        `
      });
      
      const feedbackMesh = new THREE.Mesh(feedbackGeometry, feedbackMaterial);
      feedbackScene.add(feedbackMesh);
      
      // Swap targets
      const temp = system.currentTarget;
      system.currentTarget = system.previousTarget;
      system.previousTarget = temp;
      
      // Render feedback
      renderer.setRenderTarget(system.currentTarget);
      renderer.render(feedbackScene, testCamera);
      
      console.log('Rendered feedback effect');
      
      // Update display material
      if (system.displayMaterial.uniforms && system.displayMaterial.uniforms.trailTexture) {
        system.displayMaterial.uniforms.trailTexture.value = system.currentTarget.texture;
        console.log('Updated display material with new texture');
      }
      
      // Clean up
      testGeometry.dispose();
      testMaterial.dispose();
      feedbackGeometry.dispose();
      feedbackMaterial.dispose();
      
    } catch (error) {
      console.error('Minimal feedback test failed:', error);
    } finally {
      // Restore original render target
      renderer.setRenderTarget(originalTarget);
    }
    
    console.log('Minimal feedback test complete');
  };
  
  window.fixGPUTraceFeedback = () => {
    console.log('=== Fixing GPU Trace Feedback ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // The issue is that the system uses 'feedbackQuad' not 'feedbackMesh'
    console.log('Current feedback system state:', {
      feedbackQuad: !!system.feedbackQuad,
      feedbackScene: !!system.feedbackScene,
      feedbackMaterial: !!system.feedbackMaterial,
      feedbackCamera: !!system.feedbackCamera
    });
    
    // Ensure feedback scene and quad exist
    if (!system.feedbackScene) {
      system.feedbackScene = new THREE.Scene();
      system.feedbackCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      console.log('Created feedback scene and camera');
    }
    
    if (!system.feedbackQuad) {
      const feedbackGeometry = new THREE.PlaneGeometry(2, 2);
      system.feedbackQuad = new THREE.Mesh(feedbackGeometry, system.feedbackMaterial);
      system.feedbackScene.add(system.feedbackQuad);
      console.log('Created feedback quad and added to scene');
    }
    
    // Ensure feedback material has correct uniforms
    if (system.feedbackMaterial.uniforms) {
      system.feedbackMaterial.uniforms.previousFrame.value = system.previousTarget.texture;
      system.feedbackMaterial.uniforms.fadeAmount.value = system.fadeAmount || 0.95;
      console.log('Updated feedback material uniforms');
    }
    
    // Test the feedback system by forcing a render
    console.log('Testing feedback system...');
    
    try {
      // Store original state
      const originalTarget = layerLinkManager.renderer.getRenderTarget();
      
      // Clear current target
      layerLinkManager.renderer.setRenderTarget(system.currentTarget);
      layerLinkManager.renderer.setClearColor(0x000000, 0.0);
      layerLinkManager.renderer.clear();
      
      // Render feedback quad
      layerLinkManager.renderer.render(system.feedbackScene, system.feedbackCamera);
      
      // Restore original target
      layerLinkManager.renderer.setRenderTarget(originalTarget);
      
      console.log('Feedback test render completed successfully');
      
    } catch (error) {
      console.error('Feedback test render failed:', error);
    }
    
    console.log('GPU trace feedback fix complete');
  };
  
  window.debugGPUTraceFeedback = () => {
    console.log('=== GPU Trace Feedback Debug ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    console.log('Feedback System Components:', {
      feedbackQuad: {
        exists: !!system.feedbackQuad,
        visible: system.feedbackQuad?.visible,
        material: system.feedbackQuad?.material?.type,
        geometry: system.feedbackQuad?.geometry?.type,
        inScene: system.feedbackScene?.children?.includes(system.feedbackQuad)
      },
      feedbackScene: {
        exists: !!system.feedbackScene,
        children: system.feedbackScene?.children?.length || 0,
        childTypes: system.feedbackScene?.children?.map(child => child.type) || []
      },
      feedbackCamera: {
        exists: !!system.feedbackCamera,
        type: system.feedbackCamera?.type,
        left: system.feedbackCamera?.left,
        right: system.feedbackCamera?.right
      },
      feedbackMaterial: {
        exists: !!system.feedbackMaterial,
        type: system.feedbackMaterial?.type,
        hasUniforms: !!system.feedbackMaterial?.uniforms,
        uniforms: system.feedbackMaterial?.uniforms ? Object.keys(system.feedbackMaterial.uniforms) : []
      }
    });
    
    // Check if feedback material uniforms are properly set
    if (system.feedbackMaterial?.uniforms) {
      console.log('Feedback Material Uniform Values:', {
        fadeAmount: system.feedbackMaterial.uniforms.fadeAmount?.value,
        previousFrame: {
          exists: !!system.feedbackMaterial.uniforms.previousFrame?.value,
          isTexture: system.feedbackMaterial.uniforms.previousFrame?.value?.isTexture,
          isRenderTargetTexture: system.feedbackMaterial.uniforms.previousFrame?.value?.isRenderTargetTexture
        }
      });
    }
    
    // Check render targets
    console.log('Render Targets:', {
      currentTarget: {
        exists: !!system.currentTarget,
        texture: !!system.currentTarget?.texture
      },
      previousTarget: {
        exists: !!system.previousTarget,
        texture: !!system.previousTarget?.texture
      },
      targetsAreDifferent: system.currentTarget !== system.previousTarget
    });
  };
  
  window.fixDisplayMeshPosition = () => {
    console.log('=== Fixing Display Mesh Position ===');
    
    if (!layerLinkManager.traceDisplayMesh) {
      console.log('No display mesh found');
      return;
    }
    
    const displayMesh = layerLinkManager.traceDisplayMesh;
    
    console.log('Current display mesh state:', {
      position: {
        x: displayMesh.position.x,
        y: displayMesh.position.y,
        z: displayMesh.position.z
      },
      scale: {
        x: displayMesh.scale.x,
        y: displayMesh.scale.y,
        z: displayMesh.scale.z
      },
      visible: displayMesh.visible,
      renderOrder: displayMesh.renderOrder,
      material: {
        type: displayMesh.material.type,
        transparent: displayMesh.material.transparent,
        opacity: displayMesh.material.uniforms?.opacity?.value,
        depthTest: displayMesh.material.depthTest,
        depthWrite: displayMesh.material.depthWrite
      }
    });
    
    // Fix position and scale
    displayMesh.position.set(0, 0, 10); // Move it in front of everything
    displayMesh.scale.set(1000, 1000, 1); // Keep the large scale
    displayMesh.renderOrder = 1000; // Render on top of everything
    
    // Fix material properties for visibility
    displayMesh.material.transparent = true;
    displayMesh.material.depthTest = false;
    displayMesh.material.depthWrite = false;
    
    // Increase opacity for visibility
    if (displayMesh.material.uniforms && displayMesh.material.uniforms.opacity) {
      displayMesh.material.uniforms.opacity.value = 1.0;
    }
    
    // Set bright color tint
    if (displayMesh.material.uniforms && displayMesh.material.uniforms.colorTint) {
      displayMesh.material.uniforms.colorTint.value.setRGB(3.0, 1.0, 3.0); // Bright magenta
    }
    
    console.log('Updated display mesh state:', {
      position: {
        x: displayMesh.position.x,
        y: displayMesh.position.y,
        z: displayMesh.position.z
      },
      scale: {
        x: displayMesh.scale.x,
        y: displayMesh.scale.y,
        z: displayMesh.scale.z
      },
      renderOrder: displayMesh.renderOrder,
      opacity: displayMesh.material.uniforms?.opacity?.value,
      colorTint: displayMesh.material.uniforms?.colorTint?.value
    });
    
    console.log('Display mesh position fixed - trails should now be visible!');
  };
  
  window.testDisplayMeshVisibility = () => {
    console.log('=== Testing Display Mesh Visibility ===');
    
    if (!layerLinkManager.traceDisplayMesh) {
      console.log('No display mesh found');
      return;
    }
    
    const displayMesh = layerLinkManager.traceDisplayMesh;
    
    // Try different positions to make it visible
    const positions = [
      { x: 0, y: 0, z: 10, name: 'Front' },
      { x: 0, y: 0, z: -10, name: 'Back' },
      { x: 0, y: 0, z: 100, name: 'Far Front' },
      { x: 0, y: 0, z: 0, name: 'Center' }
    ];
    
    let testIndex = 0;
    
    const testNext = () => {
      if (testIndex < positions.length) {
        const pos = positions[testIndex];
        displayMesh.position.set(pos.x, pos.y, pos.z);
        displayMesh.renderOrder = 1000 + testIndex;
        
        console.log(`Testing position ${testIndex + 1}/4: ${pos.name} (${pos.x}, ${pos.y}, ${pos.z})`);
        console.log('Check if trails are visible now...');
        
        testIndex++;
        setTimeout(testNext, 3000); // Wait 3 seconds between tests
      } else {
        console.log('Visibility test complete. If trails appeared, note which position worked.');
      }
    };
    
    testNext();
  };
  
  window.forceTrailVisibility = () => {
    console.log('=== Forcing Trail Visibility ===');
    
    // Fix display mesh position
    fixDisplayMeshPosition();
    
    // Make trails more visible
    makeTrailsMoreVisible();
    
    // Force multiple renders
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        forceTrailRender();
      }, i * 200);
    }
    
    console.log('Trail visibility forced - check for bright magenta trails!');
  };
  
  window.debugFeedbackAccumulation = () => {
    console.log('=== Debugging Feedback Accumulation ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Check the feedback material blending mode
    console.log('Feedback Material Settings:', {
      blending: system.feedbackMaterial.blending,
      transparent: system.feedbackMaterial.transparent,
      depthTest: system.feedbackMaterial.depthTest,
      depthWrite: system.feedbackMaterial.depthWrite,
      fadeAmount: system.feedbackMaterial.uniforms?.fadeAmount?.value
    });
    
    // Check if the renderer is clearing between passes
    console.log('Renderer Settings:', {
      autoClear: layerLinkManager.renderer.autoClear,
      autoClearColor: layerLinkManager.renderer.autoClearColor,
      autoClearDepth: layerLinkManager.renderer.autoClearDepth
    });
    
    // Check the point material blending
    console.log('Point Material Settings:', {
      blending: system.pointMaterial.blending,
      transparent: system.pointMaterial.transparent,
      pointSize: system.pointMaterial.uniforms?.pointSize?.value,
      opacity: system.pointMaterial.uniforms?.opacity?.value
    });
  };
  
  window.fixFeedbackAccumulation = () => {
    console.log('=== Fixing Feedback Accumulation ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Fix feedback material blending for proper accumulation
    system.feedbackMaterial.blending = THREE.NormalBlending; // Use normal blending for feedback
    system.feedbackMaterial.transparent = true;
    system.feedbackMaterial.depthTest = false;
    system.feedbackMaterial.depthWrite = false;
    
    console.log('Fixed feedback material blending');
    
    // Fix point material blending for additive trails
    system.pointMaterial.blending = THREE.AdditiveBlending; // Use additive for points
    system.pointMaterial.transparent = true;
    system.pointMaterial.depthTest = false;
    system.pointMaterial.depthWrite = false;
    
    // Increase point size and opacity for more visible trails
    if (system.pointMaterial.uniforms) {
      system.pointMaterial.uniforms.pointSize.value = 50.0; // Larger points
      system.pointMaterial.uniforms.opacity.value = 1.0; // Full opacity
    }
    
    console.log('Fixed point material blending and size');
    
    // Set a slower fade for longer trails
    if (system.feedbackMaterial.uniforms) {
      system.feedbackMaterial.uniforms.fadeAmount.value = 0.98; // Very slow fade
    }
    
    console.log('Set slower fade amount for longer trails');
    
    // Test the accumulation by rendering multiple frames
    console.log('Testing accumulation with multiple renders...');
    
    // Clear targets first
    clearTrails();
    
    // Render multiple frames to build up trails
    for (let i = 0; i < 20; i++) {
      setTimeout(() => {
        system.render(layerLinkManager.midPoints, performance.now() * 0.001);
        if (i === 19) {
          console.log('Accumulation test complete - trails should now be visible!');
        }
      }, i * 100);
    }
  };
  
  window.testTrailAccumulation = () => {
    console.log('=== Testing Trail Accumulation ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Set up for maximum trail visibility
    console.log('Setting up for maximum trail visibility...');
    
    // Very slow fade
    setTrailFade(0.995);
    
    // Large, bright points
    if (system.pointMaterial.uniforms) {
      system.pointMaterial.uniforms.pointSize.value = 100.0;
      system.pointMaterial.uniforms.opacity.value = 1.0;
    }
    
    // Bright display
    if (system.displayMaterial.uniforms) {
      system.displayMaterial.uniforms.opacity.value = 1.0;
      system.displayMaterial.uniforms.colorTint.value.setRGB(5.0, 2.0, 5.0);
    }
    
    // Clear and start fresh
    clearTrails();
    
    console.log('Starting continuous rendering for 10 seconds...');
    
    // Render continuously for 10 seconds
    let renderCount = 0;
    const renderInterval = setInterval(() => {
      system.render(layerLinkManager.midPoints, performance.now() * 0.001);
      renderCount++;
      
      if (renderCount % 10 === 0) {
        console.log(`Rendered ${renderCount} frames...`);
      }
      
      if (renderCount >= 100) { // 10 seconds at ~10fps
        clearInterval(renderInterval);
        console.log('Trail accumulation test complete! Trails should be very visible now.');
      }
    }, 100);
  };
  
  window.debugRenderProcess = () => {
    console.log('=== Debugging Render Process ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    const renderer = layerLinkManager.renderer;
    
    // Override the renderGPUTrails method to add debugging
    const originalRenderGPUTrails = system.renderGPUTrails.bind(system);
    
    system.renderGPUTrails = function(midPoints, time) {
      console.log('🔄 Starting GPU trails render...');
      
      // Store original render state
      const originalTarget = renderer.getRenderTarget();
      const originalClearColor = renderer.getClearColor(new THREE.Color());
      const originalClearAlpha = renderer.getClearAlpha();
      
      console.log('Original render state:', {
        target: !!originalTarget,
        clearColor: originalClearColor.getHex(),
        clearAlpha: originalClearAlpha
      });
      
      try {
        // Update point positions for this frame
        this.updatePointPositions(midPoints);
        console.log('✅ Updated point positions');
        
        // Step 1: Render feedback (fade previous frame)
        console.log('🔄 Rendering feedback pass...');
        this.renderFeedback();
        console.log('✅ Feedback pass complete');
        
        // Step 2: Render new points on top of faded trails
        console.log('🔄 Rendering points pass...');
        this.renderPoints();
        console.log('✅ Points pass complete');
        
        // Step 3: Update display material with current trail texture
        if (this.displayMaterial.uniforms && this.displayMaterial.uniforms.trailTexture) {
          this.displayMaterial.uniforms.trailTexture.value = this.currentTarget.texture;
          console.log('✅ Updated display material texture');
        }
        
        // Step 4: Swap render targets for next frame
        this.swapTargets();
        console.log('✅ Swapped render targets');
        
        // Restore original render state
        renderer.setRenderTarget(originalTarget);
        renderer.setClearColor(originalClearColor, originalClearAlpha);
        console.log('✅ Restored render state');
        
        console.log('🎉 GPU trails render complete!');
        
      } catch (error) {
        console.error('❌ Error in renderGPUTrails:', error);
        // Fall back to basic materials to prevent freezing
        this.usingBasicMaterials = true;
        this.updatePointPositions(midPoints);
      }
    };
    
    console.log('Render process debugging enabled. Next render will be logged in detail.');
  };
  
  window.fixRendererAutoClear = () => {
    console.log('=== Fixing Renderer AutoClear Issue ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    const renderer = layerLinkManager.renderer;
    
    console.log('Current renderer autoClear settings:', {
      autoClear: renderer.autoClear,
      autoClearColor: renderer.autoClearColor,
      autoClearDepth: renderer.autoClearDepth,
      autoClearStencil: renderer.autoClearStencil
    });
    
    // Override the renderFeedback and renderPoints methods to control clearing
    const originalRenderFeedback = system.renderFeedback.bind(system);
    const originalRenderPoints = system.renderPoints.bind(system);
    
    system.renderFeedback = function() {
      try {
        // Ensure we have valid targets
        if (!this.currentTarget || !this.previousTarget) {
          console.warn('[GPU TRACE] Invalid render targets in feedback pass');
          return;
        }
        
        // Set previous frame texture as input
        this.feedbackMaterial.uniforms.previousFrame.value = this.previousTarget.texture;
        
        // Render to current target
        renderer.setRenderTarget(this.currentTarget);
        renderer.setClearColor(0x000000, 0.0); // Clear to transparent
        
        // CRITICAL: Clear the target manually, then disable autoClear
        renderer.clear();
        const originalAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        
        // Render full-screen quad with faded previous frame
        renderer.render(this.feedbackScene, this.feedbackCamera);
        
        // Restore autoClear setting
        renderer.autoClear = originalAutoClear;
        
        console.log('[GPU TRACE] Feedback pass rendered with manual clear control');
      } catch (error) {
        console.error('[GPU TRACE] Error in renderFeedback:', error);
        throw error;
      }
    };
    
    system.renderPoints = function() {
      try {
        // Ensure we have valid geometry
        if (!this.pointsGeometry || !this.pointsMesh) {
          console.warn('[GPU TRACE] Invalid geometry in points pass');
          return;
        }
        
        // Keep rendering to the same target (additive blending)
        // CRITICAL: Don't clear - we want to add points on top of the faded trails
        const originalAutoClear = renderer.autoClear;
        renderer.autoClear = false; // Disable clearing for points pass
        
        // Set up camera to match world coordinates
        this.setupPointCamera();
        
        // Render points on top of existing content
        renderer.render(this.pointScene, this.pointCamera);
        
        // Restore autoClear setting
        renderer.autoClear = originalAutoClear;
        
        console.log('[GPU TRACE] Points pass rendered without clearing');
      } catch (error) {
        console.error('[GPU TRACE] Error in renderPoints:', error);
        throw error;
      }
    };
    
    console.log('✅ Fixed renderer autoClear issue - trails should now accumulate properly!');
    
    // Test the fix
    console.log('Testing trail accumulation with fixed renderer...');
    
    // Clear targets and start fresh
    clearTrails();
    
    // Set slow fade for visible trails
    setTrailFade(0.98);
    
    // Render multiple frames to build up trails
    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        system.render(layerLinkManager.midPoints, performance.now() * 0.001);
        if (i === 14) {
          console.log('🎉 Trail accumulation test complete - trails should now be visible!');
        }
      }, i * 150);
    }
  };
  
  window.testTrailsWithFixedRenderer = () => {
    console.log('=== Testing Trails with Fixed Renderer ===');
    
    // First fix the renderer issue
    fixRendererAutoClear();
    
    // Wait a bit, then make trails super visible
    setTimeout(() => {
      makeTrailsMoreVisible();
      
      // Force continuous rendering for a few seconds
      let renderCount = 0;
      const renderInterval = setInterval(() => {
        layerLinkManager.gpuTraceSystem.render(layerLinkManager.midPoints, performance.now() * 0.001);
        renderCount++;
        
        if (renderCount >= 30) { // 3 seconds
          clearInterval(renderInterval);
          console.log('🌟 Trail test complete! You should see bright, persistent trails now!');
        }
      }, 100);
    }, 2000);
  };
  
  window.setTrailPointSize = (size) => {
    console.log(`=== Setting Trail Point Size to ${size} ===`);
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    if (system.pointMaterial && system.pointMaterial.uniforms && system.pointMaterial.uniforms.pointSize) {
      system.pointMaterial.uniforms.pointSize.value = size;
      console.log(`Trail point size set to: ${size}`);
    } else {
      console.log('Point material or pointSize uniform not found');
    }
  };
  
  window.makeTrailsNormalSize = () => {
    console.log('=== Making Trails Normal Size ===');
    
    // Set reasonable point size
    setTrailPointSize(8.0); // Much smaller, reasonable size
    
    // Keep other visibility settings but tone them down a bit
    if (layerLinkManager.gpuTraceSystem) {
      const system = layerLinkManager.gpuTraceSystem;
      
      // Keep good opacity but not overwhelming
      if (system.pointMaterial.uniforms && system.pointMaterial.uniforms.opacity) {
        system.pointMaterial.uniforms.opacity.value = 0.8;
      }
      
      // Tone down the color tint
      if (system.displayMaterial.uniforms && system.displayMaterial.uniforms.colorTint) {
        system.displayMaterial.uniforms.colorTint.value.setRGB(1.5, 0.8, 1.5); // Less intense magenta
      }
      
      console.log('Trail size normalized - points should now be a reasonable size');
    }
  };
  
  window.setTrailStyle = (style) => {
    console.log(`=== Setting Trail Style: ${style} ===`);
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    switch (style) {
      case 'subtle':
        setTrailPointSize(4.0);
        setTrailFade(0.95);
        if (system.pointMaterial.uniforms) system.pointMaterial.uniforms.opacity.value = 0.6;
        if (system.displayMaterial.uniforms) {
          system.displayMaterial.uniforms.opacity.value = 0.7;
          system.displayMaterial.uniforms.colorTint.value.setRGB(1.0, 1.0, 1.0);
        }
        break;
        
      case 'normal':
        setTrailPointSize(8.0);
        setTrailFade(0.98);
        if (system.pointMaterial.uniforms) system.pointMaterial.uniforms.opacity.value = 0.8;
        if (system.displayMaterial.uniforms) {
          system.displayMaterial.uniforms.opacity.value = 0.9;
          system.displayMaterial.uniforms.colorTint.value.setRGB(1.2, 0.8, 1.2);
        }
        break;
        
      case 'bold':
        setTrailPointSize(12.0);
        setTrailFade(0.99);
        if (system.pointMaterial.uniforms) system.pointMaterial.uniforms.opacity.value = 1.0;
        if (system.displayMaterial.uniforms) {
          system.displayMaterial.uniforms.opacity.value = 1.0;
          system.displayMaterial.uniforms.colorTint.value.setRGB(2.0, 1.0, 2.0);
        }
        break;
        
      default:
        console.log('Available styles: subtle, normal, bold');
        return;
    }
    
    console.log(`Trail style set to: ${style}`);
  };
  
  window.enablePixelPerfectTrails = () => {
    console.log('=== Enabling Pixel-Perfect Line Trails ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Enable line-based rendering
    system.useLines = true;
    
    // Recreate materials with line support
    system.createMaterials();
    
    // Update existing meshes
    if (system.trailMesh && system.lineMaterial) {
      system.trailMesh.material = system.lineMaterial;
      console.log('Updated trail mesh to use line material');
    }
    
    // Clear trails and restart
    clearTrails();
    
    console.log('✅ Pixel-perfect line trails enabled!');
    console.log('Trails will now render as smooth 1-pixel lines instead of point sprites');
  };
  
  window.enablePointTrails = () => {
    console.log('=== Enabling Point-Based Trails ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Disable line-based rendering
    system.useLines = false;
    
    // Recreate materials with point support
    system.createMaterials();
    
    // Clear trails and restart
    clearTrails();
    
    console.log('✅ Point-based trails enabled!');
    console.log('Trails will now render as point sprites (original behavior)');
  };
  
  window.testPixelPerfectTrails = () => {
    console.log('=== Testing Pixel-Perfect Trails ===');
    
    // Enable pixel-perfect trails
    enablePixelPerfectTrails();
    
    // Set optimal settings for visibility
    setTimeout(() => {
      setTrailFade(0.98); // Slow fade for visible trails
      
      if (layerLinkManager.gpuTraceSystem) {
        const system = layerLinkManager.gpuTraceSystem;
        
        // Set line material properties for maximum visibility
        if (system.lineMaterial) {
          system.lineMaterial.opacity = 1.0;
          system.lineMaterial.color.setHex(0x00ff88); // Bright green for visibility
          console.log('Set line material to bright green with full opacity');
        }
        
        // Set display material for good visibility
        if (system.displayMaterial.uniforms) {
          system.displayMaterial.uniforms.opacity.value = 0.9;
          system.displayMaterial.uniforms.colorTint.value.setRGB(1.0, 2.0, 1.0); // Green tint
          console.log('Set display material to green tint');
        }
      }
      
      console.log('Starting continuous rendering to build up pixel-perfect trails...');
      
      // Render continuously for a few seconds to build up trails
      let renderCount = 0;
      const renderInterval = setInterval(() => {
        layerLinkManager.gpuTraceSystem.render(layerLinkManager.midPoints, performance.now() * 0.001);
        renderCount++;
        
        if (renderCount >= 30) { // 3 seconds
          clearInterval(renderInterval);
          console.log('🌟 Pixel-perfect trail test complete!');
          console.log('You should now see smooth, continuous 1-pixel trails without gaps or jitter!');
        }
      }, 100);
    }, 1000);
  };
  
  window.setPixelPerfectTrailLength = (length) => {
    console.log(`=== Setting Pixel-Perfect Trail Length to ${length} ===`);
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    if (!layerLinkManager.gpuTraceSystem.useLines) {
      console.log('Not using line-based trails. Enable with enablePixelPerfectTrails() first.');
      return;
    }
    
    layerLinkManager.gpuTraceSystem.setTrailLength(length);
    console.log(`Pixel-perfect trail length set to: ${length} historical positions`);
    console.log(`This will keep ${Math.floor(length / 10)} frames of position history`);
  };
  
  window.setVeryLongPixelTrails = () => {
    console.log('=== Setting Very Long Pixel-Perfect Trails (equivalent to 0.999 fade) ===');
    setPixelPerfectTrailLength(1000); // Very long trails
    console.log('Pixel-perfect trails are now very long and persistent!');
  };
  
  window.setMediumPixelTrails = () => {
    console.log('=== Setting Medium Length Pixel-Perfect Trails ===');
    setPixelPerfectTrailLength(200); // Medium trails
    console.log('Pixel-perfect trails are now medium length');
  };
  
  window.setShortPixelTrails = () => {
    console.log('=== Setting Short Pixel-Perfect Trails ===');
    setPixelPerfectTrailLength(50); // Short trails
    console.log('Pixel-perfect trails are now short');
  };
  
  window.usePixelPerfectTrails = () => {
    console.log('=== Switching to Pixel-Perfect Line Trails (Default Mode) ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system - will use pixel-perfect trails when initialized');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Enable line-based rendering
    system.useLines = true;
    
    // Recreate materials and scenes for line rendering
    system.createMaterials();
    system.createScenes();
    
    // Clear existing trails and restart
    layerLinkManager.clearTraces();
    layerLinkManager.setTraceEnabled(false);
    setTimeout(() => {
      layerLinkManager.setTraceEnabled(true);
      console.log('✅ Switched to pixel-perfect line trails');
      console.log('Trails will render as smooth 1-pixel lines without gaps or jitter');
    }, 100);
  };
  
  window.useLegacyPointTrails = () => {
    console.log('=== Switching to Legacy Point Sprite Trails ===');
    
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system');
      return;
    }
    
    const system = layerLinkManager.gpuTraceSystem;
    
    // Disable line-based rendering
    system.useLines = false;
    
    // Recreate materials and scenes for point rendering
    system.createMaterials();
    system.createScenes();
    
    // Clear existing trails and restart
    layerLinkManager.clearTraces();
    layerLinkManager.setTraceEnabled(false);
    setTimeout(() => {
      layerLinkManager.setTraceEnabled(true);
      console.log('✅ Switched to legacy point sprite trails');
      console.log('Trails will render as point sprites with GPU feedback (may have gaps/jitter)');
      console.log('Use setTrailFade(0.999) to control fade for this mode');
    }, 100);
  };
  
  window.getCurrentTrailMode = () => {
    if (!layerLinkManager.gpuTraceSystem) {
      console.log('No GPU trace system initialized');
      return;
    }
    
    const mode = layerLinkManager.gpuTraceSystem.useLines ? 'Pixel-Perfect Lines' : 'Legacy Point Sprites';
    console.log(`Current trail mode: ${mode}`);
    
    if (layerLinkManager.gpuTraceSystem.useLines) {
      console.log(`Trail length: ${layerLinkManager.gpuTraceSystem.trailLength} positions`);
      console.log(`History frames: ${layerLinkManager.gpuTraceSystem.maxHistoryFrames}`);
    } else {
      console.log(`Fade amount: ${layerLinkManager.gpuTraceSystem.fadeAmount}`);
    }
    
    return mode;
  };
  
  window.forcePixelPerfectTrails = () => {
    console.log('=== Forcing Pixel-Perfect Trail System Restart ===');
    
    // Clear current system
    layerLinkManager.setTraceEnabled(false);
    layerLinkManager.clearTraces();
    
    // Dispose and recreate GPU trace system
    if (layerLinkManager.gpuTraceSystem) {
      layerLinkManager.gpuTraceSystem.dispose();
      layerLinkManager.gpuTraceSystem = null;
    }
    
    // Force recreation with pixel-perfect settings
    if (layerLinkManager.renderer) {
      layerLinkManager.gpuTraceSystem = new GPUTraceSystem(layerLinkManager.renderer, {
        width: 1024,
        height: 1024,
        fadeAmount: 1.0,
        trailIntensity: 1.0,
        pointSize: 1.0,
        useLines: true, // Force line-based rendering
        trailLength: 500 // Long trails
      });
      
      console.log('✅ GPU trace system recreated with pixel-perfect line trails');
      console.log('System settings:', {
        useLines: layerLinkManager.gpuTraceSystem.useLines,
        trailLength: layerLinkManager.gpuTraceSystem.trailLength,
        usingBasicMaterials: layerLinkManager.gpuTraceSystem.usingBasicMaterials
      });
    }
    
    // Re-enable traces
    setTimeout(() => {
      layerLinkManager.setTraceEnabled(true);
      console.log('🌟 Pixel-perfect trails should now be visible in bright green!');
      console.log('If you still see magenta trails, run this function again.');
    }, 100);
  };
} 