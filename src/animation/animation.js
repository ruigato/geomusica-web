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

    // Update lerped values
    state.updateLerp(dt);

    // Check if geometry needs updating
    let needsNewGeometry = false;
    
    // Always check if baseGeo exists and is valid
    if (!baseGeo || !baseGeo.getAttribute) {
      console.error("Invalid baseGeo - creating new one");
      params.baseGeo = createPolygonGeometry(state.radius, state.segments);
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
      if (currentSegments !== state.segments || Math.abs(state.currentGeometryRadius - state.radius) > 0.1) {
        needsNewGeometry = true;
        resetGlobalSequentialIndex(); // Reset the global sequential index when geometry changes
      }
    }
    
    // Create new geometry if needed
    if (needsNewGeometry) {
      // Dispose old geometry if it exists
      if (baseGeo && baseGeo.dispose) {
        baseGeo.dispose();
      }
      
      // Create new polygon geometry
      const newGeo = createPolygonGeometry(state.radius, state.segments);
      
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

    // Clean up intersections if not enough copies
    if (state.useIntersections && !hasEnoughCopiesForIntersections) {
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
    if (state.lastUseIntersections !== state.useIntersections) {
      state.lastUseIntersections = state.useIntersections;
      state.needsIntersectionUpdate = true;
      
      // Clean up if disabled
      if (!state.useIntersections) {
        cleanupIntersectionMarkers(scene);
      }
    }
    
    // Determine if intersections need recalculation
    const needsIntersectionRecalculation = 
      state.useIntersections && 
      hasEnoughCopiesForIntersections && 
      (state.needsIntersectionUpdate || paramsChanged);
      
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
      
      // Add copies to temp group
      for (let i = 0; i < state.copies; i++) {
        const finalScale = state.useModulus 
          ? state.getScaleFactorForCopy(i) 
          : Math.pow(state.stepScale, i);
          
        const cumulativeAngleRadians = (i * state.angle * Math.PI) / 180;
        
        const copyGroup = new THREE.Group();
        const lines = new THREE.LineLoop(params.baseGeo, mat.clone());
        lines.scale.set(finalScale, finalScale, 1);
        copyGroup.add(lines);
        copyGroup.rotation.z = cumulativeAngleRadians;
        
        tempGroup.add(copyGroup);
      }
      
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
      state.justCalculatedIntersections || 
      state.needsPointFreqLabelsUpdate ||
      needsNewGeometry ||
      cameraDistanceChanged || // Update when camera changes significantly
      state.frame < 5 || // Always update first few frames
      group.children.length === 0; // Always update if group is empty

    // If copies parameter has changed, clear the group first
    if (state.parameterChanges.copies) {
      group.clear();
    }

    // Update the group with current parameters if needed
    if (shouldUpdateGroup) {
      updateGroup(
        group, 
        state.copies, 
        state.stepScale, 
        params.baseGeo, 
        mat, 
        state.segments, 
        state.angle, 
        state, 
        isLerping, 
        state.justCalculatedIntersections || state.needsPointFreqLabelsUpdate
      );
      
      // Reset point frequency labels update flag
      if (state.needsPointFreqLabelsUpdate) {
        state.needsPointFreqLabelsUpdate = false;
      }
    }

    // Reset parameter change flags
    if (state.hasParameterChanged) {
      state.resetParameterChanges();
    }

    // Calculate rotation angle based on BPM with time subdivision
    let dAng = (state.bpm / 240) * 2 * Math.PI * dt;

    // Apply time subdivision as a direct speed multiplier if enabled
    if (state.useTimeSubdivision) {
      // Use the time subdivision value directly as a multiplier
      dAng *= state.timeSubdivisionValue;
    }

    // Apply rotation
    group.rotation.z += dAng;
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
    
    // Render the scene
    renderer.render(scene, cam);
    
    // End performance measurement
    stats.end();
  }
  
  // Start the animation loop
  animationLoop();
}