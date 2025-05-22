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
    triggerAudioCallback
  } = params;

  // Ensure renderer has the correct settings
  renderer.setClearColor(0x000000, 0); // Clear with black background, fully transparent
  renderer.autoClear = true;           // Clear before each render
  renderer.sortObjects = true;         // Sort objects for proper transparency
  
  // Ensure proper depth testing and blending
  renderer.setPixelRatio(window.devicePixelRatio);
  
  // Get the layer manager if it exists
  const layerManager = window._layers;

  // Store the last angle for trigger detection
  let lastAngle = state.lastAngle || 0;
  
  // Store the last camera position to detect significant changes
  let lastCameraDistance = cam.position.z;
  
  // Make sure frame counter is initialized
  if (!state.frame) {
    state.frame = 0;
  }
  
  // Force initial setup of group if it's empty
  if (group.children.length === 0 && state.copies > 0) {
    // Initial group setup - always do this
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
  
  // Main animation function that will be called recursively
  function animationLoop() {
    // Request next frame at the beginning to maintain frame rate
    requestAnimationFrame(animationLoop);
    
    // Start performance measurement
    stats.begin();
    
    // Get accurate time from time module
    const tNow = getCurrentTime();
    const dt = tNow - state.lastTime;
    state.lastTime = tNow;
    
    // Process any pending triggers that should execute now
    if (triggerAudioCallback) {
      processPendingTriggers(tNow, triggerAudioCallback, scene);
    }

    // If we have a layer manager, update all layers
    if (layerManager) {
      // Get the current angle
      const angle = calculateRotation(tNow, state.bpm, state);
      
      // Create animation parameters for each layer
      const animationParams = {
        scene,
        stats,
        csound,
        renderer,
        cam,
        tNow,
        dt,
        angle,
        lastAngle,
        triggerAudioCallback
      };
      
      // Update all layers
      layerManager.updateLayers(animationParams);
      
      // Update camera
      if (state.cameraDistance !== state.targetCameraDistance) {
        state.updateCameraLerp(dt);
        cam.position.z = state.cameraDistance;
      }
      
      // Update DOM label positions for the UI
      updateLabelPositions(cam, renderer);
      
      // Debug info
      console.log(`Rendering scene with ${scene.children.length} children, layer container has ${layerManager.layerContainer.children.length} layers`);
      
      // Make sure scene is visible
      scene.visible = true;
      layerManager.layerContainer.visible = true;
      
      // IMPORTANT: Render the scene - with proper settings
      renderer.render(scene, cam);
      
      // End performance measurement
      stats.end();
      
      // Store the last angle for the next frame
      lastAngle = angle;
      
      return;
    }
    
    // Legacy code for single layer if layer manager is not available
    // Update lerped values
    state.updateLerp(dt);

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
      const markerGroup = scene.getObjectByName("markers");
      if (markerGroup) {
        scene.remove(markerGroup);
      }
    }
    
    // Get current rotation angle
    const angle = calculateRotation(tNow, state.bpm, state);
    
    // If we have a valid group, update it
    if (group && baseGeo) {
      // Check if we should detect triggers
      if (state.copies > 0) {
        // Detect and handle triggers
        detectTriggers(
          baseGeo,
          lastAngle,
          angle,
          state.copies,
          group,
          state.lastTrig,
          tNow,
          triggerAudioCallback
        );
      }
      
      // Update group with current parameters
      updateGroup(
        group, 
        state.copies, 
        state.stepScale, 
        baseGeo, 
        mat, 
        state.segments, 
        angle, 
        state, 
        isLerping, 
        state.justCalculatedIntersections
      );
      
      // Update DOM label positions
      updateLabelPositions(cam, renderer);
      
      // Clear out expired markers
      if (state.markers && state.markers.length > 0) {
        clearExpiredMarkers(scene, state.markers);
      }
    }
    
    // Update camera position if target has changed
    if (state.cameraDistance !== state.targetCameraDistance) {
      state.updateCameraLerp(dt);
      cam.position.z = state.cameraDistance;
    }
    
    // End performance measurement
    stats.end();
    
    // Store the last angle for the next frame
    lastAngle = angle;
  }
  
  // Start the animation loop
  animationLoop();
}