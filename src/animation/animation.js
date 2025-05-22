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

let animationFrameCounter = 0;

/**
 * Main animation loop
 * @param {Object} params Animation parameters
 */
export function animate(params) {
  const {
    scene,
    renderer,
    cam,
    stats,
    state, // This is now a proxy object
    globalState,
    triggerAudioCallback
  } = params;

  // Set up frame recursion
  requestAnimationFrame(() => animate(params));
  
  // Start performance monitoring
  stats.begin();

  // Time tracking
  const tNow = window.performance.now();
  
  // Get active layer's state from layer manager if available
  const layerManager = scene._layerManager;
  const activeLayer = layerManager?.getActiveLayer();
  const activeState = activeLayer?.state || state;
  
  // Add debug frame counter
  animationFrameCounter++;
  const shouldLogDebug = animationFrameCounter % 300 === 0;
  
  // Log active layer debug info occasionally
  if (shouldLogDebug && activeLayer) {
    console.log(`[ANIMATION] Frame ${animationFrameCounter}, active layer ID: ${layerManager?.activeLayerId}`);
  }
  
  // Get angle from global state manager (BPM is global)
  const { angle, lastAngle } = globalState.updateAngle(tNow);
  
  // Create animation parameters for layers
  const animationParams = {
    scene,
    tNow,
    dt: Math.min(tNow - (activeState.lastTime || tNow - 16.67), 100),
    angle,
    lastAngle,
    triggerAudioCallback,
    camera: cam,
    activeLayerId: layerManager?.activeLayerId, // Add active layer ID to params
    layerManager // Pass the layer manager directly
  };
  
  // Update the layer manager if available
  if (layerManager) {
    layerManager.updateLayers(animationParams);
  }
  
  // Update any DOM labels
  updateLabelPositions(cam, renderer);
  
  // Render the scene
  renderer.render(scene, cam);
  
  // End stats monitoring
  stats.end();
}