import * as THREE from 'three';
import { createPolygonGeometry, updateGroup } from './geometry.js';
import { findAllIntersections as findIntersections, cleanupIntersectionMarkers } from './intersections.js';

export class LayerManager {
  constructor(scene, state = null) {
    this.scene = scene;
    this.layers = new Map(); // Maps layerId to layer data
    this.activeLayerId = null;
    this.needFullUpdate = true; // Flag for full update
    this.intersectionMarkers = [];
    this.compositionMode = 'normal'; // normal, add, subtract, multiply, etc.
    this._updateQueue = new Set(); // For batching updates
    this._updateRaf = null; // For requestAnimationFrame batching
    this._lastFrameTime = 0;
    
    // Store state reference and set up event listeners if state is provided
    this.state = state;
    if (state && typeof state.on === 'function') {
      this._handleGeometryChanged = this._handleGeometryChanged.bind(this);
      this._handleStateChange = this._handleStateChange.bind(this);
      state.on('geometry:changed', this._handleGeometryChanged);
      state.on('change', this._handleStateChange);
    }
  }

  /**
   * Creates a new layer in the scene
   * @param {Object} layerState - The layer state
   * @returns {Object} The created layer data
   */
  /**
   * Creates a new layer or updates existing one
   * @param {Object} layerState - The layer state
   * @param {boolean} [forceUpdate=false] - Force update even if no changes detected
   * @returns {Object} The created/updated layer data
   */
  createLayer(layerState, forceUpdate = false) {
    console.log('LayerManager.createLayer called:', { 
      layerId: layerState.id, 
      name: layerState.name,
      forceUpdate 
    });
    
    const existingLayer = this.layers.get(layerState.id);
    
    if (existingLayer) {
      if (!forceUpdate) {
        console.log('Updating existing layer:', layerState.id);
        return this.updateLayer(layerState);
      }
      console.log('Force updating layer:', layerState.id);
      this._cleanupLayer(existingLayer);
    } else {
      console.log('Creating new layer:', layerState.id);
    }

    // Create a group for this layer with optimized settings
    const group = new THREE.Group();
    group.name = `layer-${layerState.id}`;
    group.renderOrder = layerState.zIndex;
    group.matrixAutoUpdate = false; // Optimize for static layers
    
    // Create the mesh for this layer
    const geometry = this.createGeometry(layerState);
    const material = this.createMaterial(layerState);
    
    // Create line segments for the polygon outline
    const line = new THREE.LineSegments(geometry, material);
    line.visible = layerState.visible !== false;
    
    // Create a group for the geometry
    const geometryGroup = new THREE.Group();
    geometryGroup.add(line);
    
    // Add to scene
    group.add(geometryGroup);
    this.scene.add(group);
    
    // Create layer data with optimized structure and default animation properties
    const layerData = {
      id: layerState.id,
      group,
      geometryGroup,
      line,
      mesh: line, // Store line as mesh for compatibility
      material,
      state: { 
        // Default animation properties
        autoRotate: true,
        rotationX: 0.5,
        rotationY: 1,
        rotationZ: 0.25,
        rotationSpeed: 1,
        animateScale: false,
        animateOpacity: false,
        animateColor: false,
        // Spread the original layer state
        ...layerState 
      },
      _lastGeometryState: this.getGeometryState(layerState),
      _geometry: geometry,
      _needsUpdate: false,
      _intersectionPoints: [],
      _lastUpdate: performance.now()
    };
    
    // Enable auto-rotation by default for visual feedback
    if (layerState.autoRotate === undefined) {
      layerData.state.autoRotate = true;
    }
    
    this.layers.set(layerState.id, layerData);
    
    // Batch the update for better performance
    this._queueLayerUpdate(layerState.id, true);
    
    return layerData;
  }

  /**
   * Updates an existing layer
   * @param {Object} layerState - The updated layer state
   */
  /**
   * Updates an existing layer
   * @param {Object} layerState - The updated layer state
   * @param {boolean} [immediate=false] - Whether to update immediately
   */
  updateLayer(layerState, immediate = false) {
    console.log('=== updateLayer ===');
    console.log('Updating layer:', layerState.id);
    console.log('New state:', {
      copies: layerState.copies,
      segments: layerState.segments,
      visible: layerState.visible,
      stepScale: layerState.stepScale,
      angle: layerState.angle,
      radius: layerState.radius
    });
    
    let layerData = this.layers.get(layerState.id);
    
    // Create layer if it doesn't exist
    if (!layerData) {
      console.log('Layer not found, creating new layer');
      return this.createLayer(layerState);
    }
    
    // Store the previous state for comparison
    const prevState = { ...layerData.state };
    
    // Update the stored state with new values
    layerData.state = { ...prevState, ...layerState };
    
    // Log state changes
    if (layerState.copies !== undefined && layerState.copies !== prevState.copies) {
      console.log(`Copies changed from ${prevState.copies} to ${layerState.copies}`);
    }
    
    // Check if any geometry-related properties changed
    const geometryProps = ['radius', 'segments', 'stepScale', 'angle', 'copies', 
                         'useFractal', 'fractalValue', 'useStars', 'starSkip', 
                         'useEuclid', 'euclidValue', 'useModulus', 'modulus'];
    const geometryChanged = geometryProps.some(prop => 
      layerState[prop] !== undefined && layerState[prop] !== prevState[prop]
    );

    // Update basic properties
    if (layerData.group) {
      if (layerState.visible !== undefined) {
        const newVisibility = layerState.visible !== false;
        console.log(`Setting visibility to: ${newVisibility}`);
        layerData.group.visible = newVisibility;
      }
      
      // Update material properties if material exists
      if (layerData.material) {
        if (layerState.color !== undefined) {
          console.log('Updating color:', layerState.color);
          layerData.material.color.set(layerState.color);
        }
        if (layerState.opacity !== undefined) {
          console.log('Updating opacity:', layerState.opacity);
          layerData.material.opacity = layerState.opacity;
          layerData.material.transparent = layerState.opacity < 1.0;
        }
        if (layerState.wireframe !== undefined) {
          console.log('Updating wireframe:', layerState.wireframe);
          layerData.material.wireframe = layerState.wireframe;
        }
        layerData.material.needsUpdate = true;
      }
    }

    // Always update geometry if copies changed, or if other geometry properties changed
    const copiesChanged = layerState.copies !== undefined && layerState.copies !== prevState.copies;
    const needsUpdate = geometryChanged || copiesChanged || this.needFullUpdate;
    
    console.log('Update checks:', {
      geometryChanged,
      copiesChanged,
      needFullUpdate: this.needFullUpdate,
      needsUpdate
    });

    if (needsUpdate) {
      console.log('Updating layer geometry...');
      
      if (copiesChanged) {
        // Force a full update if copies changed
        this.needFullUpdate = true;
        console.log('Copies changed, forcing full update');
      }
      
      this.updateLayerGeometry(layerData, layerData.state);
      layerData._lastGeometryState = this.getGeometryState(layerData.state);
      
      // Reset the full update flag
      this.needFullUpdate = false;
    } else {
      console.log('No geometry update needed');
    }
    
    // Clear the update flag and update timestamp
    layerData._needsUpdate = false;
    layerData._lastUpdate = performance.now();
    
    // Process intersections if needed
    if (layerState.intersectWith || (prevState.intersectWith !== layerState.intersectWith)) {
      console.log('Processing intersections...');
      this._processLayerIntersections(layerData);
    }
    
    // Force matrix updates
    if (layerData.group) {
      layerData.group.updateMatrix();
      layerData.group.updateMatrixWorld(true);
    }
    
    console.log('Layer update complete. Final state:', {
      visible: layerData.group?.visible,
      position: layerData.group?.position,
      scale: layerData.group?.scale,
      rotation: layerData.group?.rotation,
      children: layerData.group?.children?.length || 0,
      geometryGroup: layerData.geometryGroup ? {
        visible: layerData.geometryGroup.visible,
        children: layerData.geometryGroup.children.length
      } : 'No geometry group'
    });
    
    return layerData;
  }

  
  /**
   * Update the geometry for a layer
   * @private
   */
  updateLayerGeometry(layerData, layerState) {
    console.log('=== updateLayerGeometry ===');
    console.log('Layer ID:', layerData.id);
    console.log('Requested copies:', layerState.copies);
    
    try {
      // Create new geometry first
      console.log('Creating new geometry...');
      const newGeometry = this.createGeometry(layerState);
      
      if (!newGeometry) {
        console.error('Failed to create geometry');
        return;
      }
      
      // Ensure the geometry has valid bounds
      newGeometry.computeBoundingBox();
      newGeometry.computeBoundingSphere();
      console.log('New geometry bounds:', {
        boundingBox: newGeometry.boundingBox,
        boundingSphere: newGeometry.boundingSphere
      });
      
      // Ensure geometry group exists
      if (!layerData.geometryGroup) {
        console.log('Creating new geometry group');
        layerData.geometryGroup = new THREE.Group();
        layerData.geometryGroup.name = `layer-${layerData.id}-geometry`;
        layerData.geometryGroup.matrixAutoUpdate = true;
        layerData.group.add(layerData.geometryGroup);
        console.log('Created geometry group:', layerData.geometryGroup);
      } else {
        console.log('Using existing geometry group:', layerData.geometryGroup);
      }
      
      // Log current state before cleanup
      console.log('Before cleanup - Children in geometry group:', 
        Array.from(layerData.geometryGroup.children).map(c => ({
          name: c.name,
          type: c.type,
          visible: c.visible,
          userData: c.userData
        }))
      );
      
      // Clear existing children that are part of this layer
      const childrenToRemove = [];
      layerData.geometryGroup.traverse(child => {
        const isPolygonCopy = child.userData?.isPolygonCopy || 
                            (child.parent && child.parent.userData?.isPolygonCopy);
        
        if (isPolygonCopy) {
          console.log(`Marking for removal: ${child.name || 'unnamed'} (${child.type})`);
          childrenToRemove.push(child);
        }
      });
      
      // Remove the identified children
      childrenToRemove.forEach(child => {
        console.log(`Removing: ${child.name || 'unnamed'} (${child.type})`);
        if (child.parent) {
          child.parent.remove(child);
        }
        // Clean up resources
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      
      console.log('After cleanup - Children in geometry group:', 
        Array.from(layerData.geometryGroup.children).map(c => c.name)
      );
      
      // Ensure we have a valid number of copies (minimum 1)
      const numCopies = Math.max(1, Math.floor(layerState.copies || 1));
      console.log(`Creating ${numCopies} copies...`);
      
      // Clone the material to prevent sharing
      const material = layerData.material.clone();
      material.side = THREE.DoubleSide; // Ensure double-sided rendering
      material.needsUpdate = true;
      
      // Create a new group for the copies
      const copiesGroup = new THREE.Group();
      copiesGroup.name = `layer-${layerData.id}-copies`;
      copiesGroup.userData.isPolygonCopy = true;
      copiesGroup.matrixAutoUpdate = true;
      
      console.log('Calling updateGroup with:', {
        copies: numCopies,
        stepScale: layerState.stepScale,
        segments: layerState.segments,
        angle: layerState.angle,
        hasState: !!layerState,
        material: material.uuid
      });
      
      try {
        // Update group parameters with the new geometry and copies
        updateGroup(
          copiesGroup,
          numCopies,
          layerState.stepScale,
          newGeometry,
          material,
          layerState.segments,
          layerState.angle,
          layerState,
          false,
          false
        );
        
        // Add the copies group to the geometry group
        console.log(`Adding copies group with ${copiesGroup.children.length} children`);
        layerData.geometryGroup.add(copiesGroup);
        
        // Force update the matrix
        copiesGroup.updateMatrix();
        copiesGroup.updateMatrixWorld(true);
        
        console.log('Copies group matrix:', copiesGroup.matrix);
        console.log('Copies group world matrix:', copiesGroup.matrixWorld);
      } catch (error) {
        console.error('Error in updateGroup:', error);
      }
      
      // Update the stored geometry reference
      if (layerData._geometry && layerData._geometry !== newGeometry) {
        console.log('Disposing old geometry');
        // Schedule disposal for the next frame to ensure it's not in use
        requestAnimationFrame(() => {
          if (layerData._geometry && layerData._geometry !== newGeometry) {
            try {
              layerData._geometry.dispose();
              console.log('Successfully disposed old geometry');
            } catch (error) {
              console.error('Error disposing geometry:', error);
            }
          }
        });
      }
      
      layerData._geometry = newGeometry;
      
      // Ensure the group is visible
      const shouldBeVisible = layerState.visible !== false;
      console.log(`Setting visibility to: ${shouldBeVisible}`);
      layerData.geometryGroup.visible = shouldBeVisible;
      
      // Force update the matrix
      layerData.geometryGroup.updateMatrix();
      layerData.geometryGroup.updateMatrixWorld(true);
      
      // Log the final state of the geometry group
      console.log('Geometry group state after update:', {
        position: layerData.geometryGroup.position,
        rotation: layerData.geometryGroup.rotation,
        scale: layerData.geometryGroup.scale,
        matrix: layerData.geometryGroup.matrix,
        matrixWorld: layerData.geometryGroup.matrixWorld,
        children: layerData.geometryGroup.children.length
      });
      
      // Log the first few children for debugging
      if (layerData.geometryGroup.children.length > 0) {
        const firstChild = layerData.geometryGroup.children[0];
        console.log('First child:', {
          type: firstChild.type,
          position: firstChild.position,
          visible: firstChild.visible,
          matrix: firstChild.matrix,
          matrixWorld: firstChild.matrixWorld
        });
      }
      
    } catch (error) {
      console.error('Error in updateLayerGeometry:', error);
    }
  }

  /**
   * Removes a layer from the scene
   * @param {string} layerId - The ID of the layer to remove
   */
  removeLayer(layerId) {
    const layerData = this.layers.get(layerId);
    if (!layerData) return false;

    try {
      // Clean up geometry group
      if (layerData.geometryGroup) {
        // Remove all children
        while (layerData.geometryGroup.children.length > 0) {
          const child = layerData.geometryGroup.children[0];
          layerData.geometryGroup.remove(child);
          
          // Clean up geometry and materials
          if (child.geometry) {
            child.geometry.dispose();
          }
          
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
        
        // Remove from parent
        if (layerData.group) {
          layerData.group.remove(layerData.geometryGroup);
        }
      }
      
      // Clean up mesh
      if (layerData.mesh) {
        if (layerData.mesh.geometry) {
          layerData.mesh.geometry.dispose();
        }
        if (layerData.mesh.parent) {
          layerData.mesh.parent.remove(layerData.mesh);
        }
      }
      
      // Clean up material
      if (layerData.material) {
        layerData.material.dispose();
      }
      
      // Remove group from scene
      if (layerData.group && layerData.group.parent) {
        layerData.group.parent.remove(layerData.group);
      }
      
      // Reset active layer if needed
      if (this.activeLayerId === layerId) {
        this.activeLayerId = null;
      }
      
      // Remove from layers map
      this.layers.delete(layerId);
      
      return true;
    } catch (error) {
      console.error('Error removing layer:', error);
      return false;
    }
  }

  /**
   * Creates a material for a layer
   * @private
   */
  createMaterial(layerState) {
    // Use LineBasicMaterial for polygon outlines
    return new THREE.LineBasicMaterial({
      color: layerState.color || 0xffffff,
      transparent: true,
      opacity: layerState.opacity !== undefined ? layerState.opacity : 1.0,
      linewidth: 2.0,
      linejoin: 'round',
      linecap: 'round'
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
    // Return a simplified representation of the geometry state for comparison
    return {
      segments: layerState.segments,
      radius: layerState.radius,
      copies: layerState.copies,
      stepScale: layerState.stepScale,
      angle: layerState.angle,
      useFractal: layerState.useFractal,
      fractalValue: layerState.fractalValue,
      useStars: layerState.useStars,
      starSkip: layerState.starSkip,
      useCuts: layerState.useCuts,
      useEuclid: layerState.useEuclid,
      euclidValue: layerState.euclidValue
    };
  }

  /**
   * Set the active layer
   * @param {string} layerId - ID of the layer to make active
   */
  setActiveLayer(layerId) {
    if (this.layers.has(layerId)) {
      this.activeLayerId = layerId;
      // You can add additional logic here for active layer highlighting, etc.
    }
  }
  
  /**
   * Get the active layer data
   * @returns {Object|null} Active layer data or null if none active
   */
  getActiveLayer() {
    if (!this.activeLayerId || !this.layers.has(this.activeLayerId)) {
      return null;
    }
    return this.layers.get(this.activeLayerId);
  }
  
  /**
   * Force a full update of all layers
   */
  forceFullUpdate() {
    this.needFullUpdate = true;
  }
  
  /**
   * Dispose all resources
   */
  /**
    this.layers.forEach(layerData => {
      if (layerData.state) {
        // Create a new state object with the updated property
        const newState = {
          ...layerData.state,
          [prop]: value
        };
   * @private
   */
  /**
   * Update a single layer's animation
   * @private
   * @param {Object} layerData - The layer data object
   * @param {number} deltaTime - Time since last frame in seconds
   * @param {number} audioTime - Current audio time in seconds
   */
  _updateLayerAnimation(layerData, deltaTime, audioTime) {
    if (!layerData.group || !layerData.state) return;
    
    const { state } = layerData;
    const fixedTimeStep = 1/60; // Fixed time step for consistent animation
    
    // Update rotation if enabled - use delta time for smooth animation
    if (state.autoRotate) {
      const rotationSpeed = (state.rotationSpeed || 1) * 0.5; // Adjust speed factor
      
      // Apply rotation using delta time for smooth animation
      layerData.group.rotation.x += (state.rotationX || 0) * rotationSpeed * fixedTimeStep;
      layerData.group.rotation.y += (state.rotationY || 1) * rotationSpeed * fixedTimeStep * 0.7; // Slight variation
      layerData.group.rotation.z += (state.rotationZ || 0.5) * rotationSpeed * fixedTimeStep * 0.3;
      
      // Keep angles in a reasonable range to prevent precision issues
      const twoPi = Math.PI * 2;
      layerData.group.rotation.x %= twoPi;
      layerData.group.rotation.y %= twoPi;
      layerData.group.rotation.z %= twoPi;
    }
    
    // Update scale if needed - now using audio time for consistency
    if (state.animateScale) {
      const scale = 1 + Math.sin((audioTime || performance.now() * 0.001) * 2) * 0.1;
      layerData.group.scale.set(scale, scale, scale);
    }
    
    // Update material animations - now using audio time
    if (layerData.material) {
      // Pulsing opacity - synced to audio time
      if (state.animateOpacity) {
        layerData.material.opacity = 0.5 + Math.sin((audioTime || performance.now() * 0.001) * 2) * 0.5;
        layerData.material.needsUpdate = true;
      }
      
      // Color cycling - synced to audio time
      if (state.animateColor) {
        const hue = ((audioTime || performance.now() * 0.001) * 20) % 360;
        layerData.material.color.setHSL(hue / 360, 0.7, 0.5);
      }
    }
    
    // Update matrix for proper rendering
    layerData.group.matrixWorldNeedsUpdate = true;
  }
  
  /**
   * Handle general state changes
   * @private
   */
  /**
   * Queue an update for a layer
   * @param {string} layerId - ID of the layer to update
   * @param {Function} updateFn - Function to call to perform the update
   */
  queueUpdate(layerId, updateFn) {
    if (!this._updateQueue) {
      this._updateQueue = new Map();
    }
    
    // Add or update the queued update for this layer
    this._updateQueue.set(layerId, updateFn);
    
    // If we don't have a pending update, schedule one
    if (!this._updateRaf) {
      this._updateRaf = requestAnimationFrame(() => this._processUpdateQueue());
    }
  }
  
  /**
   * Process all queued updates
   * @private
   */
  _processUpdateQueue() {
    if (!this._updateQueue || this._updateQueue.size === 0) {
      this._updateRaf = null;
      return;
    }
    
    // Process all queued updates
    this._updateQueue.forEach((updateFn, layerId) => {
      try {
        updateFn();
      } catch (error) {
        console.error(`Error processing update for layer ${layerId}:`, error);
      }
    });
    
    // Clear the queue
    this._updateQueue.clear();
    this._updateRaf = null;
  }
  
  _handleStateChange({ prop, value, oldValue }) {
    // Handle global state changes that affect all layers
    const globalProps = ['segments', 'radius', 'copies', 'stepScale', 'angle', 'useModulus', 'modulus', 
                        'useFractal', 'fractalValue', 'useStars', 'starSkip', 'useEuclid', 'euclidValue'];
    
    if (globalProps.includes(prop)) {
      this.needFullUpdate = true;
      
      // Update all layers with the new global state
      this.layers.forEach(layerData => {
        if (layerData.state) {
          // Create a new state object with the updated property
          const newState = {
            ...layerData.state,
            [prop]: value
          };
          
          // Update the layer immediately
          this.updateLayer(newState, true);
        }
      });
    }
  }
  
  dispose() {
    // Remove all layers
    const layerIds = Array.from(this.layers.keys());
    layerIds.forEach(layerId => this.removeLayer(layerId));
    
    // Clear the layers map
    this.layers.clear();
    this.activeLayerId = null;
    
    // Clear any pending updates
    if (this._updateRaf) {
      cancelAnimationFrame(this._updateRaf);
      this._updateRaf = null;
    }
    
    // Remove event listeners
    if (this.state && typeof this.state.off === 'function') {
      if (this._handleGeometryChanged) {
        this.state.off('geometry:changed', this._handleGeometryChanged);
      }
      if (this._handleStateChange) {
        this.state.off('change', this._handleStateChange);
      }
    }
  }
  
  /**
   * Handle geometry change events from the state
   * @private
   */
  _handleGeometryChanged({ layerId, updates }) {
    const layerData = this.layers.get(layerId);
    if (!layerData) return;
    
    // Force update the layer with the new geometry parameters
    this.updateLayer(layerData.state, true);
  }

  /**
   * Checks if a layer's geometry needs to be updated
   * @private
   */
  /**
   * Checks if a layer's geometry needs to be updated
   * @private
   */
  needsGeometryUpdate(layerData, newState) {
    if (this.needFullUpdate) return true;
    
    const oldState = layerData._lastGeometryState || {};
    const propsToCheck = Object.keys(this.getGeometryState(newState));
    
    // Check if any geometry-related properties changed
    const geometryChanged = propsToCheck.some(prop => 
      newState[prop] !== oldState[prop]
    );
    
    // Check if composition mode requires update
    const compositionChanged = newState.compositionMode !== oldState.compositionMode;
    
    return geometryChanged || compositionChanged;
  }
  
  /**
   * Queues a layer update for batching
   * @private
   */
  _queueLayerUpdate(layerId, immediate = false) {
    this._updateQueue.add(layerId);
    
    if (immediate) {
      this._processUpdateQueue();
    } else if (!this._updateRaf) {
      this._updateRaf = requestAnimationFrame(() => this._processUpdateQueue());
    }
  }
  
  /**
   * Processes all queued updates
   * @private
   */
  _processUpdateQueue() {
    this._updateRaf = null;
    
    // Process each layer in the queue
    this._updateQueue.forEach(layerId => {
      const layerData = this.layers.get(layerId);
      if (layerData) {
        this.updateLayerGeometry(layerData, layerData.state);
      }
    });
    
    this._updateQueue.clear();
  }
  
  /**
   * Processes intersections between layers
   * @private
   */
  _processLayerIntersections(layerData) {
    if (!layerData.state.intersectWith) return;
    
    // Clear previous intersection markers
    this._clearIntersectionMarkers();
    
    // Get the target layer
    const targetLayer = this.layers.get(layerData.state.intersectWith);
    if (!targetLayer) return;
    
    // Find intersections between the two layers
    const intersections = findIntersections(
      layerData.mesh.geometry,
      targetLayer.mesh.geometry,
      layerData.group.matrixWorld,
      targetLayer.group.matrixWorld
    );
    
    // Store intersection points for visualization
    layerData._intersectionPoints = intersections;
    
    // Emit event or handle intersections as needed
    this._handleIntersections(layerData, targetLayer, intersections);
  }
  
  /**
   * Handles intersection points
   * @private
   */
  _handleIntersections(layerA, layerB, intersections) {
    // This can be overridden or extended by subclasses
    // For now, we'll just store the intersections
    console.log(`Found ${intersections.length} intersections between layers ${layerA.id} and ${layerB.id}`);
  }
  
  /**
   * Clears all intersection markers
   * @private
   */
  _clearIntersectionMarkers() {
    this.intersectionMarkers.forEach(marker => {
      this.scene.remove(marker);
    });
    this.intersectionMarkers = [];
  }
  
  /**
   * Cleans up a layer's resources
   * @private
   */
  _cleanupLayer(layerData) {
    // Clean up geometry
    if (layerData._geometry) {
      layerData._geometry.dispose();
    }
    
    // Clean up material
    if (layerData.material) {
      layerData.material.dispose();
    }
    
    // Clean up group
    if (layerData.group && layerData.group.parent) {
      layerData.group.parent.remove(layerData.group);
    }
    
    // Clean up any custom resources
    if (layerData.dispose) {
      layerData.dispose();
    }
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
