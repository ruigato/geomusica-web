// src/state/layer.js - Layer class for multi-layer architecture
import { createAppState } from './state.js';
import * as THREE from 'three';
import { createPolygonGeometry, updateGroup } from '../geometry/geometry.js';

// Debug flag to control logging
const DEBUG_LOGGING = false;

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
    
    // Store layer ID instead of direct reference to avoid circular references
    this.state.layerId = id;
    
    // Use WeakRef for layer manager reference to avoid memory retention
    this._layerManagerRef = null;
    
    // Generate a unique color for this layer based on its ID
    if (options.color) {
      // Use the provided color if supplied
      this.color = options.color;
    } else {
      // Generate a color with a distinct hue based on layer ID
      const hue = (id * 60) % 360; // 60-degree shift per layer
      this.color = new THREE.Color(`hsl(${hue}, 100%, 50%)`);
    }
    
    // Layer-specific rendering properties
    this.baseGeo = null;
    this.group = null;
    this.material = null;
    this.visible = true;
    
    // IMPORTANT: Initialize markers array for trigger markers
    this.markers = [];
    
    // Last time this layer was updated
    this.lastUpdateTime = 0;
    
    // Initialize layer with default settings
    this.initialize(options);
    
    // Ensure we have some initial state values that will render something
    this.state.copies = this.state.copies || 3;
    this.state.segments = this.state.segments || 2;
    this.state.radius = this.state.radius || 100;
    this.state.stepScale = this.state.stepScale || 1.05;
    
    // Initialize axis frequency labels setting to true by default
    this.state.showAxisFreqLabels = this.state.showAxisFreqLabels !== undefined ? this.state.showAxisFreqLabels : true;
    
    // Force parameter changes to ensure initial render
    this.state.parameterChanges.copies = true;
    this.state.parameterChanges.segments = true;
    this.state.parameterChanges.radius = true;
    this.state.parameterChanges.stepScale = true;
    
    // Tracking the current and previous angles for rotation
    this.currentAngle = 0;
    this.previousAngle = 0;
    
    if (DEBUG_LOGGING) {
      console.log(`Created Layer ${id} with name ${this.name}`);
    }
    
    // Override the setRadius, setSegments, and setCopies methods to add layer-specific logging
    const originalSetRadius = this.state.setRadius;
    this.state.setRadius = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`Layer ${id} - setRadius(${value})`);
      }
      return originalSetRadius.call(this.state, value);
    };
    
    const originalSetSegments = this.state.setSegments;
    this.state.setSegments = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`Layer ${id} - setSegments(${value})`);
      }
      return originalSetSegments.call(this.state, value);
    };
    
    const originalSetCopies = this.state.setCopies;
    this.state.setCopies = (value) => {
      if (DEBUG_LOGGING) {
        console.log(`Layer ${id} - setCopies(${value})`);
      }
      return originalSetCopies.call(this.state, value);
    };
    
    // Override hasParameterChanged to add layer-specific logging
    const originalHasParameterChanged = this.state.hasParameterChanged;
    this.state.hasParameterChanged = function() {
      const hasChanges = originalHasParameterChanged.call(this);
      if (hasChanges && DEBUG_LOGGING) {
        const changedParams = Object.entries(this.parameterChanges)
          .filter(([_, val]) => val)
          .map(([key, _]) => key)
          .join(", ");
        console.log(`Layer ${id} - Parameters changed: ${changedParams}`);
      }
      return hasChanges;
    };
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
    
    // Instead of storing a direct reference to state, store state ID
    // This prevents circular references while allowing state lookup when needed
    this.group.userData.stateId = this.id;
    // Make state accessible via a getter to avoid circular references
    Object.defineProperty(this.group.userData, 'state', {
      get: () => {
        // This creates a temporary reference only when needed
        return this.state;
      },
      configurable: true
    });
    
    // Set global state reference if available from window
    if (window._globalState) {
      this.group.userData.globalState = window._globalState;
    }
    
    // Create layer-specific material with THIS LAYER'S COLOR
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
    
    // Store the layer ID in the material's userData for debugging
    this.material.userData = {
      layerId: this.id,
      materialCreatedFor: `layer-${this.id}`
    };
    
    // Log material creation with color info
    if (DEBUG_LOGGING) {
      console.log(`Layer ${this.id} - Created material with color ${this.color.getHexString()}`);
    }
    
    // Apply any state overrides from options
    if (options.state) {
      Object.assign(this.state, options.state);
    }
    
    // Force visibility
    this.visible = true;
    
    // Make sure layer has initial geometry
    if (!this.baseGeo) {
      this.state.radius = this.state.radius || 100;
      this.state.segments = this.state.segments || 2;
      this.state.copies = this.state.copies || 3;
      
      // Create initial geometry
      this.recreateGeometry();
    }
    
    if (DEBUG_LOGGING) {
      console.log(`Layer ${this.id} - Initialized with radius=${this.state.radius}, segments=${this.state.segments}, copies=${this.state.copies}`);
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
      this.material.needsUpdate = true; // Important! This forces Three.js to update the material
      
      if (DEBUG_LOGGING) {
        console.log(`Layer ${this.id} - Updated material color to ${this.color.getHexString()}`);
      }
    }
    
    // Update color for all children in the group
    if (this.group) {
      this.group.traverse(child => {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              mat.color = this.color;
              mat.needsUpdate = true;
            });
          } else {
            child.material.color = this.color;
            child.material.needsUpdate = true;
          }
        }
      });
    }
    
    // Mark parameters as changed to force render updates
    if (this.state && this.state.parameterChanges) {
      // Set a special flag for color changes
      this.state.parameterChanges.color = true;
      
      // Force geometry recreation to update vertex dots with new color
      this.recreateGeometry();
    }
    
    // Return this for method chaining
    return this;
  }
  
  /**
   * Recreate the layer's geometry with current parameters
   * @param {boolean} force Force recreation even if no parameters changed
   * @returns {boolean} True if geometry was recreated
   */
  recreateGeometry(force = false) {
    // Skip if not active, but only if not forced
    if (!this.active && !force) {
      return false;
    }
    
    // MODIFIED: Reduced rate limiting to prevent blocking necessary updates
    const now = performance.now();
    const timeSinceLastRecreation = now - (this._lastGeometryRecreation || 0);
    
    // Set consistent 16ms interval (60fps) for all layers as requested
    const MIN_RECREATION_INTERVAL = 16;
    
    // Skip if we recently recreated geometry (unless forced)
    if (!force && timeSinceLastRecreation < MIN_RECREATION_INTERVAL) {
      // Don't reset parameter changes here - they need to persist
      // until we can actually process them
      return false;
    }
    
    // Check if any parameters have changed
    const hasChanges = this.state.hasParameterChanged() || force;
    
    // Skip if no changes and not forced
    if (!hasChanges && !force) {
      return false;
    }
    
    // IMPROVED: Identify what actually changed to be more surgical
    let changedParams = [];
    if (this.state.parameterChanges) {
      changedParams = Object.entries(this.state.parameterChanges)
        .filter(([_, val]) => val)
        .map(([key, _]) => key);
    }
    
    // Only log recreations occasionally to reduce console spam
    const DEBUG_LOGGING_PROB = 0.05; // 5% chance to log
    if ((DEBUG_LOGGING || Math.random() < DEBUG_LOGGING_PROB) && changedParams.length > 0) {
      console.log(`Layer ${this.id} - Recreating geometry due to changes in: ${changedParams.join(', ')}`);
    }
    
    // IMPROVED: Keep track of old geometry for proper disposal
    const oldGeo = this.baseGeo;
    
    try {
      // IMPROVED: Cache key parameters to detect actual changes
      if (!this._lastParams) {
        this._lastParams = {
          radius: this.state.radius,
          segments: this.state.segments,
          copies: this.state.copies,
          stepScale: this.state.stepScale,
          useStars: this.state.useStars,
          starSkip: this.state.starSkip,
          useFractal: this.state.useFractal,
          fractalValue: this.state.fractalValue
        };
      }
      
      // Check if any key parameters actually changed
      const hasKeyChanges = 
        force || 
        !this._lastParams ||
        this._lastParams.radius !== this.state.radius ||
        this._lastParams.segments !== this.state.segments ||
        this._lastParams.copies !== this.state.copies ||
        this._lastParams.stepScale !== this.state.stepScale ||
        this._lastParams.useStars !== this.state.useStars ||
        this._lastParams.starSkip !== this.state.starSkip ||
        this._lastParams.useFractal !== this.state.useFractal ||
        this._lastParams.fractalValue !== this.state.fractalValue;
      
      // If no key parameters changed, we can skip the expensive geometry creation
      if (!hasKeyChanges && !this.state.needsIntersectionUpdate) {
        // Still reset parameter change flags
        this.state.resetParameterChanges();
        
        // Update last params
        this._lastParams = {
          radius: this.state.radius,
          segments: this.state.segments,
          copies: this.state.copies,
          stepScale: this.state.stepScale,
          useStars: this.state.useStars,
          starSkip: this.state.starSkip,
          useFractal: this.state.useFractal,
          fractalValue: this.state.fractalValue
        };
        
        return false;
      }
      
      // Directly create geometry with current state parameters
      this.baseGeo = createPolygonGeometry(
        this.state.radius,
        this.state.segments,
        this.state // Pass entire state for configuration
      );
      
      // Store reference to this geometry in state
      this.state.baseGeo = this.baseGeo;
      
      // Update the group to use the new geometry and current state parameters
      if (this.group) {
        // IMPROVED: Set a flag to indicate this is a programmatic update
        // This helps prevent feedback loops in parameter change detection
        this._isUpdatingGroup = true;
        
        // Add logging to debug the copies value being sent to updateGroup
        console.log('Calling updateGroup with:', {copies: this.state.copies, actualState: this.state.copies});
        
        updateGroup({
          group: this.group,
          state: this.state,
          layer: this,
          baseGeo: this.baseGeo,
          mat: this.material,
          copies: this.state.copies,
          stepScale: this.state.stepScale,
          segments: this.state.segments,
          angle: this.state.angle,
          isLerping: this.state.useLerp
        });
        
        this._isUpdatingGroup = false;
      }
      
      // Update last params
      this._lastParams = {
        radius: this.state.radius,
        segments: this.state.segments,
        copies: this.state.copies,
        stepScale: this.state.stepScale,
        useStars: this.state.useStars,
        starSkip: this.state.starSkip,
        useFractal: this.state.useFractal,
        fractalValue: this.state.fractalValue
      };
      
      // Track last recreation time for rate limiting
      this._lastGeometryRecreation = now;
      
      // Reset parameter change flags
      this.state.resetParameterChanges();
      
      return true;
    } catch (error) {
      console.error(`Error recreating geometry for layer ${this.id}:`, error);
      
      // Try to recover original geometry on error
      if (oldGeo && !this.baseGeo) {
        this.baseGeo = oldGeo;
      }
      
      return false;
    } finally {
      // Safely dispose old geometry if we successfully created a new one
      if (oldGeo && this.baseGeo && oldGeo !== this.baseGeo) {
        // Use a delayed disposal to prevent rendering glitches
        setTimeout(() => {
          try {
            oldGeo.dispose();
          } catch (e) {
            // Silent error - just best effort cleanup
          }
        }, 100);
      }
    }
  }
  
  /**
   * Get the total number of vertices in this layer
   * @returns {number} Total vertex count
   */
  getVertexCount() {
    if (this.baseGeo && this.baseGeo.userData) {
      return this.baseGeo.userData.vertexCount || 0;
    }
    return 0;
  }
  
  /**
   * Get layer manager, using weak reference to avoid memory leaks
   * @returns {LayerManager|null} The layer manager, if available
   */
  getLayerManager() {
    if (this._layerManagerRef) {
      // Get the actual reference from the weak reference
      if (typeof this._layerManagerRef.deref === 'function') {
        return this._layerManagerRef.deref();
      }
      // Fallback for browsers without WeakRef
      return this._layerManagerRef;
    }
    return null;
  }
  
  /**
   * Set layer manager using weak reference to avoid memory leaks
   * @param {LayerManager} layerManager The layer manager to set
   */
  setLayerManager(layerManager) {
    if (typeof WeakRef !== 'undefined' && layerManager) {
      // Use WeakRef to avoid strong circular reference
      this._layerManagerRef = new WeakRef(layerManager);
    } else {
      // Fallback for browsers without WeakRef support
      this._layerManagerRef = layerManager;
    }
  }
  
  /**
   * Set the visibility of this layer
   * @param {boolean} isVisible Whether the layer should be visible
   * @returns {Layer} This layer instance for method chaining
   */
  setVisible(isVisible) {
    const visibility = !!isVisible; // Convert to boolean
    
    // Update layer visibility property
    this.visible = visibility;
    
    // Update Three.js group visibility
    if (this.group) {
      this.group.visible = visibility;
    }
    
    // Return this for method chaining
    return this;
  }
  
  /**
   * Update the layer for animation
   * @param {number} currentTime Current time in seconds
   * @param {number} deltaTime Time since last update in seconds
   */
  update(currentTime, deltaTime) {
    // Skip update if layer is not visible
    if (!this.visible || !this.group) {
      return;
    }
    
    // IMPROVED: Only check for parameter changes at a reasonable interval
    // This prevents excessive checks that can lead to feedback loops
    const now = performance.now();
    const timeSinceLastCheck = now - (this._lastParameterCheck || 0);
    
    // Reduced check interval for layer 0 from 100ms to 33ms
    const CHECK_INTERVAL = this.id === 0 ? 33 : 16; 
    
    // Track last check time
    this._lastParameterCheck = now;
    
    // ADDED: Log to confirm hasParameterChanged() is working as expected
    const hasChanges = this.state.hasParameterChanged();
    if (hasChanges) {
      console.log(`Layer ${this.id} hasParameterChanged() returned TRUE - parameter changes detected`);
    }
    
    // Check if any parameters have changed, but only at a reasonable interval
    if (timeSinceLastCheck >= CHECK_INTERVAL && hasChanges) {
      // Collect changed parameters
      const changedParams = Object.entries(this.state.parameterChanges)
        .filter(([_, val]) => val)
        .map(([key, _]) => key);
      
      // Log all parameter changes to help with debugging
      console.log(`Layer ${this.id} parameters changed: ${changedParams.join(", ")}`);
      
      // IMPROVED: More selective handling of parameter changes
      
      // Non-geometry parameters that don't require recreation
      const nonGeometryParams = [
        'attack', 'decay', 'sustain', 'release', 'brightness', 'volume',
        'showAxisFreqLabels', 'showPointsFreqLabels', 'durationMode',
        'velocityMode', 'minDuration', 'maxDuration', 'minVelocity', 'maxVelocity'
      ];
      
      // Check if only non-geometry parameters have changed
      const onlyNonGeometryChanged = changedParams.every(param => 
        nonGeometryParams.includes(param)
      );
      
      // If only non-geometry params changed, reset flags without recreation
      if (onlyNonGeometryChanged) {
        this.state.resetParameterChanges();
        return;
      }
      
      // Critical parameters that definitely require geometry recreation
      const criticalParams = [
        'radius', 'copies', 'segments', 'useStars', 'starSkip', 
        'useIntersections', 'fractalValue', 'useFractal', 
        'useEuclid', 'euclidValue'
      ];
      
      // Check if any critical parameters have changed
      const hasCriticalChanges = criticalParams.some(param => 
        changedParams.includes(param)
      );
      
      // Lerping-related parameters need special handling
      const lerpingParams = ['useLerp', 'lerpTime', 'targetRadius', 'targetStepScale'];
      const hasLerpingChanges = lerpingParams.some(param => 
        changedParams.includes(param)
      );
      
      // MODIFIED: Reduced throttling for layer 0
      if (this.id === 0) {
        // Use a less aggressive threshold for layer 0
        const MIN_RECREATION_INTERVAL = 60; // ms - reduced from 250ms
        const timeSinceLastRecreation = now - (this._lastGeometryRecreation || 0);
        
        // Skip recreation if we recently did one, but use a much shorter time window
        if (timeSinceLastRecreation < MIN_RECREATION_INTERVAL) {
          // Still reset parameter changes
          this.state.resetParameterChanges();
          return;
        }
      }
      
      if (hasCriticalChanges) {
        // Recreate geometry for critical changes
        console.log(`Layer ${this.id} - Recreating geometry due to critical param changes: ${changedParams.filter(p => criticalParams.includes(p)).join(", ")}`);
        this.recreateGeometry();
      } else if (hasLerpingChanges) {
        // Just update the group for lerping changes without full recreation
        if (this.group && this.baseGeo) {
          // Set flag to indicate this is a programmatic update
          this._isUpdatingGroup = true;
          
          updateGroup({
            group: this.group,
            state: this.state,
            layer: this,
            baseGeo: this.baseGeo,
            mat: this.material,
            copies: this.state.copies,
            stepScale: this.state.stepScale,
            segments: this.state.segments,
            angle: this.state.angle,
            isLerping: this.state.useLerp
          });
          
          this._isUpdatingGroup = false;
          
          // Reset parameter changes after update
          this.state.resetParameterChanges();
        }
      } else {
        // Just reset parameter changes for other parameters
        this.state.resetParameterChanges();
      }
    }
    
    // Store previous angle for trigger detection
    this.previousAngle = this.currentAngle || 0;
    
    // Get time subdivision multiplier for this layer
    const timeSubdivisionMultiplier = this.state?.useTimeSubdivision ? 
      (this.state.timeSubdivisionValue || 1) : 1;
    
    // Get global state for BPM if available
    const globalState = window._globalState;
    const bpm = globalState?.bpm || 120;
    
    // Calculate rotation based on BPM
    // At 120 BPM, we do 0.5 rotations per second (one rotation every 2 seconds)
    const rotationsPerSecond = bpm / 240;
    
    // Calculate angle change based on time delta
    const angleChangeRadians = 2 * Math.PI * rotationsPerSecond * deltaTime * timeSubdivisionMultiplier;
    
    // Update current angle (with normalization to prevent extremely large values)
    // Add the angle change
    let newAngle = (this.currentAngle || 0) + angleChangeRadians;
    
    // Normalize angle to stay within 0 to 2π range
    // This prevents accumulation of extremely large rotation values
    newAngle = newAngle % (2 * Math.PI);
    if (newAngle < 0) newAngle += 2 * Math.PI; // Handle negative values
    
    // Update current angle with normalized value
    this.currentAngle = newAngle;
    
    // Apply rotation to layer group
    if (this.group) {
      this.group.rotation.z = this.currentAngle;
      
      // Debug logging with normalized angle values (extremely rare - only 0.01% chance per frame)
      if (Math.random() < 0.0001) {
        const degrees = (this.currentAngle * 180 / Math.PI).toFixed(1);
        console.log(`Layer ${this.id} rotation: ${degrees}° (normalized), deltaTime: ${(deltaTime * 1000).toFixed(2)}ms, bpm: ${bpm}`);
      }
    }
    
    // Store the current time
    this.state.lastTime = currentTime;
  }
  
  /**
   * Update intersections for this layer
   * Recreates the geometry with intersections
   */
  updateIntersections() {
    // Only update if we need to calculate intersections
    if (this.state.useIntersections || (this.state.useStars && this.state.useCuts)) {
      // Mark as needing update
      this.state.needsIntersectionUpdate = true;
      
      // Force geometry recreation to include intersections
      this.recreateGeometry(true);
    }
  }
  
  /**
   * Clear all intersections for this layer
   */
  clearIntersections() {
    // Reset intersection-related state
    this.state.needsIntersectionUpdate = false;
    
    // Force geometry recreation if we have any state that requires it
    if (this.baseGeo && this.baseGeo.userData && this.baseGeo.userData.hasIntersections) {
      this.recreateGeometry(true);
    }
  }
  
  /**
   * Properly dispose of all resources used by this layer
   * This is crucial for preventing memory leaks and ensuring trigger cleanup
   */
  dispose() {
    // Import the clearLayerMarkers function here to avoid circular dependencies
    import('../triggers/triggers.js').then(triggersModule => {
      if (triggersModule && typeof triggersModule.clearLayerMarkers === 'function') {
        // Clean up any trigger markers
        triggersModule.clearLayerMarkers(this);
      }
    }).catch(err => {
      console.error(`Error importing triggers module for layer ${this.id} cleanup:`, err);
    });

    // Clean up markers directly if we can
    if (this.markers && Array.isArray(this.markers)) {
      for (const marker of this.markers) {
        // Remove from scene
        if (marker.parent) {
          marker.parent.remove(marker);
        }
        
        // Dispose of geometry
        if (marker.geometry) {
          marker.geometry.dispose();
        }
        
        // Dispose of material(s)
        if (marker.material) {
          if (Array.isArray(marker.material)) {
            marker.material.forEach(mat => {
              if (mat) mat.dispose();
            });
          } else {
            marker.material.dispose();
          }
        }
      }
      
      // Clear the markers array
      this.markers = [];
    }

    // Dispose of base geometry
    if (this.baseGeo) {
      this.baseGeo.dispose();
      this.baseGeo = null;
    }
    
    // Dispose of all objects in the group
    if (this.group) {
      this.group.traverse(object => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => {
              if (material) {
                material.dispose();
              }
            });
          } else if (object.material) {
            object.material.dispose();
          }
        }
      });
      
      // Remove group from parent if attached
      if (this.group.parent) {
        this.group.parent.remove(this.group);
      }
      
      // Clear group children
      while (this.group.children.length > 0) {
        this.group.remove(this.group.children[0]);
      }
    }
    
    // Dispose of material
    if (this.material) {
      this.material.dispose();
      this.material = null;
    }
    
    // Clear references to avoid memory leaks
    this._layerManagerRef = null;
    
    if (DEBUG_LOGGING) {
      console.log(`Layer ${this.id} - Disposed and resources released`);
    }
  }
} 