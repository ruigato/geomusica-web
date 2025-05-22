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
    state,
    triggerAudioCallback
  } = params;

  // Set up frame recursion
  requestAnimationFrame(() => animate(params));
  
  // Start performance monitoring
  stats.begin();

  // Time tracking
  const tNow = window.performance.now();
  const dt = Math.min(tNow - state.lastTime, 100); // Cap delta time at 100ms
  
  // Get BPM from state
  const bpm = state.bpm || 120;
  
  // Calculate angle based on time and BPM (simple rotation)
  // Calculate the angular velocity in degrees per millisecond
  const anglePerSecond = (bpm / 60) * 360; // Full rotation per beat
  const anglePerMs = anglePerSecond / 1000;
  
  // Calculate the angle delta based on elapsed time
  const angleDelta = anglePerMs * dt;
  
  // Get the last angle and calculate the new angle
  const lastAngle = state.lastAngle || 0;
  const angle = (lastAngle + angleDelta) % 360;
  
  // Store for next frame
  state.lastAngle = angle;
  
  // Update state's time
  state.lastTime = tNow;
  
  // Create animation parameters for layers
  const animationParams = {
    scene,
    tNow,
    dt,
    angle: angle,
    lastAngle,
    triggerAudioCallback,
    camera: cam
  };
  
  // Update the layer manager if available
  if (scene._layerManager) {
    scene._layerManager.updateLayers(animationParams);
  }
  
  // Update any DOM labels
  updateLabelPositions(cam, renderer);
  
  // Render the scene
  renderer.render(scene, cam);
  
  // End stats monitoring
  stats.end();
  
  // Log occasionally
  animationFrameCounter++;
  if (animationFrameCounter % 300 === 0) {
    console.log(`Animation frame ${animationFrameCounter}, angle: ${angle.toFixed(2)}`);
  }
}