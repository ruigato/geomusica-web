// src/animation/animation.js - Refactored for Layer System
import * as THREE from 'three';
import { 
  getCurrentTime,
  // secondsToTicks, 
  // ticksToSeconds, 
  // calculateRotation // Assuming these are used by detectTriggers or similar, keep if needed
} from '../time/time.js';
import { 
  // updateGroup, // To be replaced by updateLayerVisuals
  // calculateBoundingSphere, // Will be per-layer if needed
  cleanupIntersectionMarkers, // May need layer context or be part of updateLayerVisuals
  createPolygonGeometry,
  updateLayerVisuals // Import the new function
} from '../geometry/geometry.js';
// Placeholder for the new per-layer visual update function
// import { updateLayerVisuals } from './geometry/geometry.js'; // Will be created in geometry.js

// import { processIntersections } from '../geometry/intersections.js'; // Likely part of updateLayerVisuals logic
import { 
  detectTriggers, 
  clearExpiredMarkers, 
  processPendingTriggers
} from '../triggers/triggers.js';
import { 
  updateLabelPositions, 
  updateAxisLabels, 
  // updateRotatingLabels // This will be per-layer
} from '../ui/domLabels.js';
// import { getInstrumentForFrequency } from '../audio/instruments.js'; // Used by triggerAudio
import { triggerAudio } from '../audio/audio.js'; // Passed in now
import { DEFAULT_VALUES } from '../config/constants.js'; // For fallback lerp time

/**
 * Check if any note parameters have changed -- THIS FUNCTION IS UNUSED AND WILL BE REMOVED
 * @param {Object} state Application state
 * @returns {boolean} True if any note parameters have changed
 */
/*
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
*/

// Main animation function
export function animate(params) {
  const {
    scene, 
    camera, // Renamed from cam
    renderer, 
    globalState,
    layerManager,
    stats,
    // csound, // If still used, pass it or manage via audio module
    // triggerAudioCallback, // Now passed directly as triggerAudio
    // Pass actual updateLayerVisuals when available
    // updateLayerVisuals, 
  } = params;

  // Ensure actual triggerAudio function is available (was passed as triggerAudioCallback before)
  const triggerAudioFn = params.triggerAudio || triggerAudio; 

  // Store last camera distance (global for now, could be per-viewport if multiple cameras)
  let lastCameraDistance = camera.position.z;
  
  // Ensure frame counter is initialized in globalState
  if (globalState.frame === undefined) {
    globalState.frame = 0;
  }

  // Initialize lastAngle per layer if needed for triggers, or manage globally if appropriate
  // For now, assuming detectTriggers will handle its own lastAngle persistence if needed per call/layer.

  // Main animation function that will be called recursively
  function animationLoop() {
    requestAnimationFrame(animationLoop);
    stats.begin();

    const tNow = getCurrentTime();
    const dt = tNow - (globalState.lastTime || tNow); // Ensure lastTime is initialized
    globalState.lastTime = tNow;
    globalState.frame++;

    // Process any pending audio triggers (global queue for now)
    if (typeof processPendingTriggers === 'function') {
        processPendingTriggers(tNow, triggerAudioFn, scene); // scene might be for marker cleanup
    }

    // Update lerping for global state (if any global params become lerpable)
    if (typeof globalState.updateLerp === 'function') {
        globalState.updateLerp(dt);
    }
    // Update lerping for all active layers
    if (layerManager && typeof layerManager.updateLerpForAllLayers === 'function') {
        layerManager.updateLerpForAllLayers(dt, globalState.lerpTime || DEFAULT_VALUES.LERP_TIME);
    }

    // --- Iterate through layers for updates and rendering ---
    const layers = layerManager.getAllLayers(); // Gets { state, group } for each layer

    for (const layer of layers) {
        if (!layer.state.enabled) {
            // If layer is not enabled, ensure its group is not visible
            if (layer.group.visible) layer.group.visible = false;
            continue; // Skip processing for disabled layers
        }
        // Ensure visible if enabled
        if (!layer.group.visible) layer.group.visible = true;

        // --- Geometry Update for the current layer ---
        let needsNewGeometry = false;
        const currentLayerState = layer.state;

        // Check for changes that require new geometry for THIS LAYER
        // (Simplified change detection; layerState should have its own `parameterChanges` and `hasChanged` for this)
        // For now, assume a simple check or that layerState.isDirty is set elsewhere.
        // Example placeholder for detailed change detection:
        // if (currentLayerState.geometryParametersChanged()) { needsNewGeometry = true; }
        
        // Quick check based on radius/segments for placeholder
        if (!layer.baseGeo || 
            (layer.baseGeo.userData.segments !== currentLayerState.segments) ||
            (layer.baseGeo.userData.radius !== currentLayerState.radius) ||
            (layer.baseGeo.userData.starSkip !== currentLayerState.starSkip) || // Add other critical params
            (layer.baseGeo.userData.fractalValue !== currentLayerState.fractalValue) ||
            (layer.baseGeo.userData.useStars !== currentLayerState.useStars) ||
            (layer.baseGeo.userData.useFractal !== currentLayerState.useFractal) ||
            (layer.baseGeo.userData.useCuts !== currentLayerState.useCuts) || /* or a dirty flag */
            currentLayerState.forceGeometryRecalculation ) { // A flag that can be set on the layer
            needsNewGeometry = true;
            currentLayerState.forceGeometryRecalculation = false; // Reset flag
        }

        if (needsNewGeometry) {
            if (layer.baseGeo && typeof layer.baseGeo.dispose === 'function') {
                layer.baseGeo.dispose();
            }
            layer.baseGeo = createPolygonGeometry(currentLayerState.radius, currentLayerState.segments, currentLayerState);
            // Store some key params on userData for quick check next frame
            layer.baseGeo.userData = {
                radius: currentLayerState.radius,
                segments: currentLayerState.segments,
                starSkip: currentLayerState.starSkip,
                fractalValue: currentLayerState.fractalValue,
                useStars: currentLayerState.useStars,
                useFractal: currentLayerState.useFractal,
                useCuts: currentLayerState.useCuts,
            };
            // console.log(`Layer ${currentLayerState.id}: Rebuilt baseGeo.`);
            
            // If geometry changes, intersections for this layer likely need full re-evaluation
            if (currentLayerState.useIntersections || (currentLayerState.useStars && currentLayerState.useCuts)) {
                currentLayerState.needsIntersectionUpdate = true; 
                // cleanupIntersectionMarkers(layer.group); // cleanup should be part of updateLayerVisuals
            }
        }

        // --- Visual Update for the current layer ---
        if (typeof updateLayerVisuals === 'function') {
            updateLayerVisuals(
                layer.group, 
                layer.baseGeo, 
                currentLayerState, 
                globalState, 
                scene, 
                camera, 
                renderer
            );
        } else {
            console.warn("updateLayerVisuals function not found or not imported correctly.");
        }
        
        // --- Audio Triggers for the current layer ---
        if (layer.baseGeo && layer.group.children.length > 0 && typeof detectTriggers === 'function') {
            // detectTriggers needs to be adapted. It originally took a global state.
            // Now it needs layerState for layer-specific audio params (duration, velocity modes etc.)
            // and potentially globalState for timing (BPM, quantization).
            // The `lastAngle` for rotation also needs to be managed per layer if rotation is per-layer.
            // For now, passing currentLayerState.angle as `currentAngle` and 0 as `lastAngle` (will need fix for continuous rotation)
            
            // Rotation for trigger detection (simplified, assume layer.group.rotation.z is the primary rotation)
            const currentLayerAngle = layer.group.rotation.z; // Radian angle of the layer's main group
            let lastLayerAngle = layer.state.lastAngleForTriggers || 0;

            detectTriggers(
                layer.group,      // The group containing this layer's geometry copies
                camera,           // Main camera
                currentLayerState,// Layer-specific state for note parameters, etc.
                globalState,      // Global state for BPM, quantization, etc.
                currentLayerAngle, // Current rotation of this layer group
                lastLayerAngle,   // Last rotation of this layer group
                tNow,             // Current time
                triggerAudioFn,   // The actual audio trigger function
                scene             // For adding visual markers
            );
            layer.state.lastAngleForTriggers = currentLayerAngle; // Store for next frame
        }
    } // End of layer loop

    // --- Global Updates After Layer Processing ---
    // Camera distance check (moved outside layer loop)
    const cameraDistanceChanged = Math.abs(camera.position.z - lastCameraDistance) > 100;
    if (cameraDistanceChanged) {
        lastCameraDistance = camera.position.z;
        // If camera distance significantly changes, all layers might need to update vertex/point sizes.
        // This can be a flag on each layerState or handled within updateLayerVisuals.
        layers.forEach(layer => {
            if (layer.state) layer.state.cameraDistanceChanged = true;
        });
    }

    clearExpiredMarkers(tNow, scene); // Global marker cleanup

    // Update Labels (global and potentially active layer)
    if (typeof updateAxisLabels === 'function') {
        updateAxisLabels(scene, camera, globalState, renderer); // Uses globalState
    }
    if (typeof updateLabelPositions === 'function') {
        updateLabelPositions(scene, camera, renderer); // General label position updates
    }
    // updateRotatingLabels would be called inside updateLayerVisuals for each layer if needed.

    // Reset parameter change flags on globalState (and potentially on each layerState if they have them)
    if (typeof globalState.resetParameterChanges === 'function') {
        globalState.resetParameterChanges();
    }
    layers.forEach(layer => {
        if (layer.state && typeof layer.state.resetParameterChanges === 'function') {
            // layer.state.resetParameterChanges(); // If layerState implements this
        }
        if (layer.state) layer.state.cameraDistanceChanged = false; // Reset flag
    });

    renderer.render(scene, camera);
    stats.end();
  }

  // Start the animation loop
  animationLoop();
}