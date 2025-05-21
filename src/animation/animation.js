// src/animation/animation.js - Fixed version with proper rendering and vertex update on camera change
import * as THREE from 'three';
import { 
  getCurrentTime, 
  secondsToTicks, 
  ticksToSeconds, 
  calculateRotation 
} from '../time/time.js';
// Import the updateGroup function from geometry.js
import { 
  updateGroup, 
  calculateBoundingSphere, 
  cleanupIntersectionMarkers, 
  createPolygonGeometry 
} from '../geometry/geometry.js';
import { processIntersections } from '../geometry/intersections.js';
import { 
  detectTriggers, 
  clearExpiredMarkers, 
  processPendingTriggers,
  resetGlobalSequentialIndex
} from '../triggers/triggers.js';
import { 
  updateLabelPositions, 
  updateAxisLabels, 
  updateRotatingLabels 
} from '../ui/domLabels.js';
import { getInstrumentForFrequency } from '../audio/instruments.js';
import { triggerAudio } from '../audio/audio.js';

/**
 * Check if any note parameters have changed
 * @param {Object} state Application state
 * @returns {boolean} True if any note parameters have changed
 */
function haveNoteParametersChanged(state) {
  if (!state || !state.parameterChanges) return false;
  
  return state.parameterChanges.durationMode ||
         state.parameterChanges.durationModulo ||
         state.parameterChanges.minDuration ||
         state.parameterChanges.maxDuration ||
         state.parameterChanges.velocityMode ||
         state.parameterChanges.velocityModulo ||
         state.parameterChanges.minVelocity ||
         state.parameterChanges.maxVelocity;
}

// Main animation function
export function animate(params) {
  // Destructure parameters just once outside the animation loop
  const {
    scene, 
    group, 
    baseGeo, 
    mat, 
    stats, 
    csound,
    renderer, 
    cam, 
    state,
    triggerAudioCallback,
    layerManager
  } = params;

  // Store the last angle for trigger detection
  let lastAngle = state.lastAngle || 0;
  
  // Store the last camera position to detect significant changes
  let lastCameraDistance = cam.position.z;
  
  // Make sure frame counter is initialized
  if (!state.frame) {
    state.frame = 0;
  }
  
  // Handle layer-based geometry setup
  if (layerManager) {
    // Update all layers
    const { layers } = state;
    if (layers && layers.list) {
      layers.list.forEach(layerId => {
        const layer = layers.byId[layerId];
        if (layer) {
          // Update layer in the manager
          layerManager.updateLayer(layer);
        }
      });
    }
  } else if (group.children.length === 0 && state.copies > 0) {
    // Fallback to original behavior if no layer manager
    updateGroup(
      group, 
      state.copies, 
      state.stepScale, 
      baseGeo, 
      mat, 
      state.segments, 
      state.angle, 
      state, 
      false, 
      false
    );
    
    // Initialize the global sequential index
    resetGlobalSequentialIndex();
  }
  
  // Debug counter for logging
  let lastLogTime = 0;
  const LOG_INTERVAL = 2000; // Log every 2 seconds
  let animationStartTime = Date.now();
  
  // Main animation function that will be called recursively
  function animationLoop() {
    // Always request the next frame at the start
    animationFrameId = requestAnimationFrame(animationLoop);
    
    // Start performance measurement
    stats.begin();
    
    // Get current time for logging
    const now = Date.now();
    const shouldLog = (now - lastLogTime > LOG_INTERVAL);
    
    // Always log basic frame info
    if (shouldLog) {
      console.group('=== ANIMATION LOOP DEBUG ===');
      console.log('Frame:', state.frame, 'Time:', (now - animationStartTime) / 1000 + 's');
      
      // Check WebGL context
      const gl = renderer.getContext();
      if (!gl) {
        console.error('WebGL context is not available!');
      } else {
        // Check for WebGL errors
        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
          console.warn('WebGL error at start of frame:', getGLErrorString(gl, error));
        }
      }
      
      // Log renderer state
      console.log('Renderer state:', {
        size: `${renderer.domElement.width}x${renderer.domElement.height}`,
        pixelRatio: renderer.getPixelRatio(),
        autoClear: renderer.autoClear,
        antialias: renderer.antialias,
        sortObjects: renderer.sortObjects,
        context: renderer.getContext().getContextAttributes()
      });
      
      // Log camera state
      console.log('Camera state:', {
        position: cam.position.toArray(),
        rotation: cam.rotation.toArray(),
        fov: cam.fov,
        aspect: cam.aspect,
        near: cam.near,
        far: cam.far,
        matrixWorldNeedsUpdate: cam.matrixWorldNeedsUpdate
      });
      
      // Log scene state
      console.log('Scene state:', {
        children: scene.children.length,
        background: scene.background,
        fog: scene.fog ? 'exists' : 'none',
        autoUpdate: scene.autoUpdate
      });
      
      // Log group state
      console.log('Group state:', {
        visible: group.visible,
        children: group.children.length,
        position: group.position.toArray(),
        rotation: group.rotation.toArray(),
        scale: group.scale.toArray(),
        matrixWorldNeedsUpdate: group.matrixWorldNeedsUpdate
      });
      
      // Log scene hierarchy
      console.log('Scene hierarchy:');
      scene.traverse((obj) => {
        if (shouldLog) { // Only log full hierarchy periodically
          console.log(`- ${obj.name || obj.type} (${obj.uuid})`, {
            visible: obj.visible,
            position: obj.position ? obj.position.toArray() : 'no position',
            parent: obj.parent ? (obj.parent.name || obj.parent.type || obj.parent.uuid) : 'none',
            matrixWorldNeedsUpdate: obj.matrixWorldNeedsUpdate
          });
        }
      });
      
      console.groupEnd();
      lastLogTime = now;
    }
    
    // Get time from performance.now() for consistent frame timing
    const tNow = performance.now() / 1000; // Convert to seconds
    
    // Initialize lastTime if not set
    if (state.lastTime === undefined) {
      state.lastTime = tNow;
      startAnimation();
      return;
    }
    
    // Calculate delta time, ensuring it's not too large (cap at 100ms for safety)
    let dt = Math.min(tNow - state.lastTime, 0.1);
    state.lastTime = tNow;
    
    // Skip frame if dt is 0 to prevent division by zero
    if (dt <= 0) {
      startAnimation();
      requestAnimationFrame(animationLoop);
      return;
    }
    
    // Update lerped values in state
    if (state.updateLerp) {
      state.updateLerp(dt);
    }
    
    // Process any pending triggers that should execute now
    if (triggerAudioCallback) {
      processPendingTriggers(tNow, triggerAudioCallback, scene);
    }
    
    // Update all layers if layerManager exists
    if (layerManager) {
      // Get the current audio time for accurate animation timing
      const audioTime = csound?.getControlChannel?.('currentTime') || tNow;
      
      // Update layer animations with audio-synced delta time
      layerManager.layers.forEach(layerData => {
        if (layerData && layerManager._updateLayerAnimation) {
          layerManager._updateLayerAnimation(layerData, dt, audioTime);
        }
      });
      
      // Process any queued updates after animation updates
      if (layerManager._processUpdateQueue) {
        layerManager._processUpdateQueue();
      }
    }
    
    // Update camera if needed
    if (cam && state.cameraDistance !== undefined && state.targetCameraDistance !== undefined) {
      // Smooth camera movement
      cam.position.z += (state.targetCameraDistance - cam.position.z) * 0.1;
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
    }
    
    // Ensure we have all required components
    if (!renderer || !scene || !cam) {
      console.error('Renderer, scene, or camera not available:', { 
        renderer: !!renderer, 
        scene: !!scene, 
        camera: !!cam 
      });
      return;
    }
    
    // Update all objects in the scene
    scene.updateMatrixWorld();
    
    // Clear the screen
    renderer.clear();
    
    // Render the scene
    try {
      renderer.render(scene, cam);
      
      // Debug: Log rendering info periodically
      if (state.frame % 60 === 0) {
        console.log(`Rendered frame ${state.frame} with ${scene.children.length} children in scene`);
        
        // Log first few objects in the scene
        console.log('First few scene objects:', 
          scene.children.slice(0, 3).map(obj => ({
            type: obj.type,
            name: obj.name || 'unnamed',
            visible: obj.visible,
            children: obj.children ? obj.children.length : 0
          }))
        );
      }
      
      // Increment frame counter
      state.frame++;
      
    } catch (error) {
      console.error('Error during rendering:', error);
    }
    
    // End performance measurement
    stats.end();
    
    // Check if geometry needs updating
    let needsNewGeometry = false;
    
    // Check if fractal or star parameters changed 
    const fractalParamsChanged = 
        state.parameterChanges && 
        (state.parameterChanges.fractal || state.parameterChanges.useFractal);
        
    const starParamsChanged = 
        state.parameterChanges && 
        (state.parameterChanges.starSkip || state.parameterChanges.useStars || state.parameterChanges.useCuts);
    
    if (fractalParamsChanged || starParamsChanged) {
      console.log("Fractal or star parameters changed, forcing geometry recreation");
      needsNewGeometry = true;
      
      // Force intersection update if using cuts with stars
      if (state.useStars && (state.useCuts || state.parameterChanges.useCuts)) {
        console.log("Star cuts parameter changed, forcing intersection update");
        state.needsIntersectionUpdate = true;
      }
    }
    
    // Always check if baseGeo exists and is valid
    if (!baseGeo || !baseGeo.getAttribute) {
      console.error("Invalid baseGeo - creating new one");
      params.baseGeo = createPolygonGeometry(state.radius, state.segments, state);
      state.baseGeo = params.baseGeo;
      needsNewGeometry = true;
      resetGlobalSequentialIndex(); // Reset the global sequential index
    } else {
      const currentSegments = baseGeo.getAttribute('position').count;
      
      // Initialize current geometry radius if not set
      if (!state.currentGeometryRadius) {
        state.currentGeometryRadius = state.radius;
      }
      
      // Check if radius or segments have changed significantly
      if (currentSegments !== state.segments || 
          Math.abs(state.currentGeometryRadius - state.radius) > 0.1 || 
          state.segmentsChanged || 
          fractalParamsChanged) {
        needsNewGeometry = true;
        resetGlobalSequentialIndex(); // Reset the global sequential index when geometry changes
        // Clear segments changed flag
        state.segmentsChanged = false;
      }
    }
    
    // Create new geometry if needed
    if (needsNewGeometry) {
      // Dispose old geometry if it exists
      if (baseGeo && baseGeo.dispose) {
        baseGeo.dispose();
      }
      
      // Create new polygon geometry
      const newGeo = createPolygonGeometry(state.radius, state.segments, state);
      
      // Update references
      state.baseGeo = newGeo;
      params.baseGeo = newGeo;
      
      // Store current radius
      state.currentGeometryRadius = state.radius;
      
      // Flag for intersection update if enabled
      if (state.useIntersections) {
        state.needsIntersectionUpdate = true;
        cleanupIntersectionMarkers(scene);
      }
    }
    
    // Check if camera distance has changed significantly
    const cameraDistanceChanged = Math.abs(cam.position.z - lastCameraDistance) > 100;
    if (cameraDistanceChanged) {
      lastCameraDistance = cam.position.z;
    }
    
    // Check if any note parameters have changed
    const noteParamsChanged = haveNoteParametersChanged(state);
    
    // Track parameter changes that affect geometry or intersections
    const paramsChanged = 
      needsNewGeometry || 
      Math.abs(state.lastStepScale - state.stepScale) > 0.001 ||
      Math.abs(state.lastAngle - state.angle) > 0.1 ||
      state.hasParameterChanged();

    // Track point frequency labels toggle changes
    const pointFreqLabelsToggleChanged = state.showPointsFreqLabels !== state.lastShowPointsFreqLabels;
    
    if (pointFreqLabelsToggleChanged) {
      state.lastShowPointsFreqLabels = state.showPointsFreqLabels;
      state.needsPointFreqLabelsUpdate = true;
    }

    // Handle parameter changes
    if (paramsChanged) {
      // Store current values
      state.lastStepScale = state.stepScale;
      state.lastAngle = state.angle;
      
      // Clean up existing intersection markers
      cleanupIntersectionMarkers(scene);
      
      // Force intersection update if enabled
      if (state.useIntersections) {
        state.needsIntersectionUpdate = true;
      }
    }
    
    // Check if currently lerping
    const isLerping = state.useLerp && (
      Math.abs(state.radius - state.targetRadius) > 0.1 ||
      Math.abs(state.stepScale - state.targetStepScale) > 0.001 ||
      Math.abs(state.angle - state.targetAngle) > 0.1
    );
    
    // Check if we have enough copies for intersections
    const hasEnoughCopiesForIntersections = state.copies > 1;

    // Clean up intersections if not enough copies and not using star cuts
    // or if copies is set to 0 (even with star cuts)
    if ((state.useIntersections && !hasEnoughCopiesForIntersections && !(state.useStars && state.useCuts)) || 
        state.copies === 0) {
      // Clear intersection points
      state.intersectionPoints = [];
      
      // Clean up markers
      cleanupIntersectionMarkers(scene);
      
      // Remove marker group if present
      if (group.userData && group.userData.intersectionMarkerGroup) {
        group.remove(group.userData.intersectionMarkerGroup);
        group.userData.intersectionMarkerGroup.traverse(child => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(m => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        });
        group.userData.intersectionMarkerGroup = null;
      }
    }
    
    // Handle intersection toggle changes
    if (state.lastUseIntersections !== state.useIntersections || state.lastUseCuts !== state.useCuts) {
      state.lastUseIntersections = state.useIntersections;
      state.lastUseCuts = state.useCuts;
      state.needsIntersectionUpdate = true;
      
      // Clean up intersections and markers if both features are disabled
      // or if copies is 0 (force cleanup)
      if ((!state.useIntersections && !state.useCuts) || state.copies === 0) {
        // Clean up markers
        cleanupIntersectionMarkers(scene);
        
        // Clear intersection points
        state.intersectionPoints = [];
        
        // Clean up marker group if present
        if (group.userData && group.userData.intersectionMarkerGroup) {
          group.remove(group.userData.intersectionMarkerGroup);
          group.userData.intersectionMarkerGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          });
          group.userData.intersectionMarkerGroup = null;
        }
      }
    }
    
    // Determine if intersections need recalculation
    const needsIntersectionRecalculation = 
      (state.useIntersections || (state.useStars && state.useCuts)) && 
      (hasEnoughCopiesForIntersections || (state.useStars && state.useCuts)) && 
      state.needsIntersectionUpdate;  // Only recalculate when this flag is set
      
    // Calculate intersections if needed
    if (needsIntersectionRecalculation) {
      // Clean up existing markers
      cleanupIntersectionMarkers(scene);
      
      // Reset intersection points
      state.intersectionPoints = [];
      
      // Create temporary group for calculations
      const tempGroup = new THREE.Group();
      tempGroup.position.copy(group.position);
      tempGroup.userData.state = state;
      
      // Add copies to temp group (this is all we need to do, the intersections.js 
      // function now properly handles star polygon geometry internally)
      updateGroup(
        tempGroup, 
        state.copies, 
        state.stepScale, 
        params.baseGeo, 
        mat, 
        state.segments, 
        state.angle, 
        state, 
        false, 
        false
      );
      
      // Process intersections
      const newGeometry = processIntersections(state, params.baseGeo, tempGroup);
      
      // Update geometry if needed
      if (newGeometry !== params.baseGeo) {
        params.baseGeo = newGeometry;
        state.baseGeo = newGeometry;
      }
      
      // Clean up temp group
      tempGroup.traverse(obj => {
        if (obj.geometry && obj !== params.baseGeo) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      
      // Reset update flag
      state.needsIntersectionUpdate = false;
      state.justCalculatedIntersections = true;
    } else {
      state.justCalculatedIntersections = false;
    }

    // Determine when we need to update the group
    const shouldUpdateGroup = 
      paramsChanged || 
      noteParamsChanged || // Add note parameters change detection
      state.parameterChanges.copies ||
      state.parameterChanges.euclidValue ||  // Add Euclidean rhythm parameter
      state.parameterChanges.useEuclid ||    // Add Euclidean rhythm toggle
      state.justCalculatedIntersections || 
      state.needsPointFreqLabelsUpdate ||
      needsNewGeometry ||
      cameraDistanceChanged || // Update when camera changes significantly
      state.segmentsChanged || // New check for segments changes      
      state.frame < 5 || // Always update first few frames
      group.children.length === 0; // Always update if group is empty

    // If copies parameter has changed, clear the group first
    if (state.parameterChanges.copies) {
      group.clear();
    }

    // Update layers based on state changes
    if (layerManager && state.layers) {
      const { layers } = state;
      const needsUpdate = layers.list.some(layerId => {
        const layer = layers.byId[layerId];
        return layer && (layer._needsUpdate || state.needsGroupUpdate);
      });
      
      if (needsUpdate) {
        layers.list.forEach(layerId => {
          const layer = layers.byId[layerId];
          if (layer) {
            // Update layer in the manager
            layerManager.updateLayer(layer);
            layer._needsUpdate = false;
          }
        });
        
        // Reset flags after update
        state.needsGroupUpdate = false;
        state.forceGroupUpdate = false;
        state.forceIntersectionUpdate = false;
        
        // Clear any parameter changes that were just processed
        if (state.parameterChanges) {
          Object.keys(state.parameterChanges).forEach(key => {
            state.parameterChanges[key] = false;
          });
        }
        
        // Force a render after layer updates to ensure smooth transitions
        renderer.render(scene, cam);
        return;
      }
    } 
    // Fallback to original group update if no layer manager
    else if (state.needsGroupUpdate) {
      updateGroup(
        group, 
        state.copies, 
        state.stepScale, 
        baseGeo, 
        mat, 
        state.segments, 
        state.angle, 
        state, 
        state.forceGroupUpdate, 
        state.forceIntersectionUpdate
      );
      
      // Reset flags after update
      state.needsGroupUpdate = false;
      state.forceGroupUpdate = false;
      state.forceIntersectionUpdate = false;
      
      // Clear any parameter changes that were just processed
      if (state.parameterChanges) {
        Object.keys(state.parameterChanges).forEach(key => {
          state.parameterChanges[key] = false;
        });
      }
      
      // Force a render after group update to ensure smooth transitions
      renderer.render(scene, cam);
      return;
    }

    // Calculate rotation angle based on BPM with time subdivision
    // Use a fixed time step for consistent rotation speed regardless of frame rate
    const fixedTimeStep = 1/60; // 60 FPS
    let dAng = (state.bpm / 240) * 2 * Math.PI * fixedTimeStep;

    // Apply time subdivision as a direct speed multiplier if enabled
    if (state.useTimeSubdivision) {
      dAng *= state.timeSubdivisionValue;
    }

    // Apply rotation using the fixed time step for consistency
    group.rotation.z += dAng;
    
    // Keep the angle in a reasonable range to prevent precision issues
    if (group.rotation.z > Math.PI * 2) {
      group.rotation.z -= Math.PI * 2;
    } else if (group.rotation.z < 0) {
      group.rotation.z += Math.PI * 2;
    }
    
    const currentAngle = group.rotation.z;

    // Only update rotating labels if enabled and frame is appropriate
    if (state.showPointsFreqLabels && state.frame % 3 === 0) {
      updateRotatingLabels(group, cam, renderer);
    }
    
    // Handle audio triggers every frame for smooth audio
    if (state.copies > 0) {
      const triggeredNow = detectTriggers(
        params.baseGeo, 
        lastAngle, 
        currentAngle, 
        state.copies, 
        group, 
        state.lastTrig, 
        tNow, 
        triggerAudioCallback
      );
      
      // Update state
      state.lastTrig = triggeredNow;
    }
    
    // Update last angle for next frame
    lastAngle = currentAngle;
    
    // Handle marker cleanup only every few frames
    if (state.frame % 2 === 0) {
      clearExpiredMarkers(scene, state.markers);
    }
    
    // Update axis labels only every few frames
    if (state.frame % 3 === 0) {
      updateAxisLabels();
      updateLabelPositions(cam, renderer);
    }
    
    // Calculate camera distance only every 10 frames or when needed
    if (state.frame % 10 === 0 || shouldUpdateGroup) {
      // Calculate the appropriate camera distance to show all geometry
      const boundingSphere = calculateBoundingSphere(group, state);
      
      // Set target camera distance based on bounding sphere
      // Use a multiplier to ensure everything is in view
      const targetDistance = boundingSphere * 2.5;
      state.setCameraDistance(targetDistance);
    }
    
    // Update camera lerping
    state.updateCameraLerp(dt);
    
    // Update the camera position
    cam.position.z = state.cameraDistance;
    
    // Increment frame counter
    state.frame = (state.frame + 1) % 10000; // Prevent overflow by cycling
    
    try {
      // Clear any existing errors
      const gl = renderer.getContext();
      while(gl.getError() !== gl.NO_ERROR) {}
      
      // Force clear the buffer
      renderer.clear();
      
      // Render the scene
      renderer.render(scene, cam);
      
      // Check for WebGL errors
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        console.warn('WebGL error after render:', getGLErrorString(gl, error));
      }
      
      // Verify something was rendered
      const pixels = new Uint8Array(4);
      gl.readPixels(
        Math.floor(renderer.domElement.width / 2),
        Math.floor(renderer.domElement.height / 2),
        1, 1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );
      
      if (state.frame % 60 === 0) {
        console.log('Center pixel (RGBA):', Array.from(pixels));
      }
      
    } catch (error) {
      console.error('Error during render:', error);
    }
    
    // End performance measurement
    stats.end();
  }
  
  // Helper function to get WebGL error string
  function getGLErrorString(gl, error) {
    const errors = {
      [gl.NO_ERROR]: 'NO_ERROR',
      [gl.INVALID_ENUM]: 'INVALID_ENUM',
      [gl.INVALID_VALUE]: 'INVALID_VALUE',
      [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
      [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
      [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL'
    };
    return errors[error] || `Unknown error (${error})`;
  }
  
  // Animation loop state
  let isRunning = true;
  let animationFrameId = null;
  
  // Start the animation loop
  function startAnimation() {
    if (!isRunning) return;
    animationFrameId = requestAnimationFrame(animationLoop);
  }
  
  // Initial start
  startAnimation();
  
  // Return cleanup function
  return () => {
    isRunning = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    console.log('Animation loop stopped');
  };
}