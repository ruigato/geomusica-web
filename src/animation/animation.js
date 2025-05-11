// src/animation/animation.js - Reverted to continuous rotation with time subdivision as speed multiplier
import * as THREE from 'three';
import { getCurrentTime } from '../time/time.js';
import { updateGroup, detectCrossings, createPolygonGeometry, calculateBoundingSphere } from '../geometry/geometry.js';
import { processIntersections } from '../geometry/intersections.js';
import { MARK_LIFE } from '../config/constants.js';
import { updateLabelPositions, updateAxisLabels, removeLabel, updateRotatingLabels } from '../ui/domLabels.js';
import { getInstrumentForFrequency, getInstrumentOptions } from '../audio/instruments.js';

// Function to clean up intersection point markers
function cleanupIntersectionMarkers(scene) {
  // Clean up the marker group in the scene
  if (scene && scene.userData.intersectionMarkerGroup) {
    const group = scene.userData.intersectionMarkerGroup;
    const parent = group.parent;
    
    if (parent) {
      parent.remove(group);
    } else {
      scene.remove(group);
    }
    
    // Clean up resources
    group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    scene.userData.intersectionMarkerGroup = null;
  }
  
  // Clean up any marker groups in child objects
  if (scene.children) {
    scene.children.forEach(child => {
      if (child.userData && child.userData.intersectionMarkerGroup) {
        const markerGroup = child.userData.intersectionMarkerGroup;
        child.remove(markerGroup);
        
        markerGroup.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
        
        child.userData.intersectionMarkerGroup = null;
      }
    });
  }
  
  // Clean up individual markers if present
  if (scene && scene.userData.intersectionMarkers) {
    for (const marker of scene.userData.intersectionMarkers) {
      if (marker.parent) {
        marker.parent.remove(marker);
      } else {
        scene.remove(marker);
      }
      if (marker.geometry) marker.geometry.dispose();
      if (marker.material) {
        if (Array.isArray(marker.material)) {
          marker.material.forEach(m => m.dispose());
        } else {
          marker.material.dispose();
        }
      }
    }
    scene.userData.intersectionMarkers = [];
  }
}

// Main animation function
export function animate(params) {
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

  // Store camera and renderer in scene's userData for label management
  scene.userData.camera = cam;
  scene.userData.renderer = renderer;

  // Get current state values
  const bpm = state.bpm;
  const radius = state.radius;
  const copies = state.copies;
  const segments = state.segments;
  const stepScale = state.stepScale;
  const angle = state.angle;
  const lastTime = state.lastTime;
  const lastAngle = state.lastAngle;
  const lastTrig = state.lastTrig;
  const markers = state.markers;
  const useIntersections = state.useIntersections;
  const needsIntersectionUpdate = state.needsIntersectionUpdate;

  // Schedule next frame
  requestAnimationFrame(() => animate(params));

  // Get accurate time from time module
  const tNow = getCurrentTime();
  const dt = tNow - lastTime;
  state.lastTime = tNow;
  
  // Update lerped values
  state.updateLerp(dt);

  // Check if geometry needs updating
  let needsNewGeometry = false;
  const currentSegments = baseGeo.getAttribute('position').count;
  
  // Initialize current geometry radius if not set
  if (!state.currentGeometryRadius) {
    state.currentGeometryRadius = state.radius;
  }
  
  // Check if radius or segments have changed significantly
  if (currentSegments !== segments || Math.abs(state.currentGeometryRadius - state.radius) > 0.1) {
    needsNewGeometry = true;
  }
  
  // Create new geometry if needed
  if (needsNewGeometry) {
    // Dispose old geometry
    baseGeo.dispose();
    
    // Create new polygon geometry
    const newGeo = createPolygonGeometry(radius, segments);
    
    // Update references
    state.baseGeo = newGeo;
    params.baseGeo = newGeo;
    
    // Store current radius
    state.currentGeometryRadius = radius;
    
    // Flag for intersection update if enabled
    if (useIntersections) {
      state.needsIntersectionUpdate = true;
      cleanupIntersectionMarkers(scene);
    }
  }
  
  // Track parameter changes that affect geometry or intersections
  const paramsChanged = 
    needsNewGeometry || 
    Math.abs(state.lastStepScale - stepScale) > 0.001 ||
    Math.abs(state.lastAngle - angle) > 0.1;

  // Track point frequency labels toggle changes
  const pointFreqLabelsToggleChanged = state.showPointsFreqLabels !== state.lastShowPointsFreqLabels;
    
  if (pointFreqLabelsToggleChanged) {
    state.lastShowPointsFreqLabels = state.showPointsFreqLabels;
    state.needsPointFreqLabelsUpdate = true;
  }

  // Handle parameter changes
  if (paramsChanged) {
    // Store current values
    state.lastStepScale = stepScale;
    state.lastAngle = angle;
    
    // Clean up existing intersection markers
    cleanupIntersectionMarkers(scene);
    
    // Force intersection update if enabled
    if (useIntersections) {
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
  const hasEnoughCopiesForIntersections = copies > 1;

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
  if (state.lastUseIntersections !== useIntersections) {
    state.lastUseIntersections = useIntersections;
    state.needsIntersectionUpdate = true;
    
    // Clean up if disabled
    if (!useIntersections) {
      cleanupIntersectionMarkers(scene);
    }
  }
  
  // Determine if intersections need recalculation
  const needsIntersectionRecalculation = 
    useIntersections && 
    hasEnoughCopiesForIntersections && 
    (needsIntersectionUpdate || paramsChanged);
    
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
    for (let i = 0; i < copies; i++) {
      const finalScale = state.useModulus 
        ? state.getScaleFactorForCopy(i) 
        : Math.pow(stepScale, i);
        
      const cumulativeAngleRadians = (i * angle * Math.PI) / 180;
      
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
    
    // Clean up if no intersections found
    if (!state.intersectionPoints || state.intersectionPoints.length === 0) {
      cleanupIntersectionMarkers(scene);
      
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
      
      state.intersectionPoints = [];
    }
    
    // Reset update flag
    state.needsIntersectionUpdate = false;
    state.justCalculatedIntersections = true;
  } else {
    state.justCalculatedIntersections = false;
  }

  // Update the group with current parameters
  updateGroup(
    group, 
    copies, 
    stepScale, 
    params.baseGeo, 
    mat, 
    segments, 
    angle, 
    state, 
    isLerping, 
    state.justCalculatedIntersections || state.needsPointFreqLabelsUpdate
  );
  
  // Reset point frequency labels update flag
  if (state.needsPointFreqLabelsUpdate) {
    state.needsPointFreqLabelsUpdate = false;
  }

// Calculate rotation angle based on BPM with time subdivision
let dAng = (bpm / 240) * 2 * Math.PI * dt;

// Apply time subdivision as a direct speed multiplier if enabled
if (state.useTimeSubdivision) {
  // Use the time subdivision value directly as a multiplier
  dAng *= state.timeSubdivisionValue;
}

// Calculate the new angle as an increment from the last angle
const ang = lastAngle + dAng;

  // Apply rotation
  group.rotation.z = ang;

  // Update rotating labels if enabled
  if (state.showPointsFreqLabels) {
    updateRotatingLabels(group, cam, renderer);
  }
  
  // Detect vertex crossings and trigger audio
  const triggeredNow = detectCrossings(
    params.baseGeo, 
    lastAngle, 
    ang, 
    copies, 
    group, 
    lastTrig, 
    tNow, 
    // Audio callback handling
    (x, y, lastAngle, angle, tNow) => {
      // Calculate frequency
      const freq = Math.hypot(x, y);
      const instrumentId = getInstrumentForFrequency(freq);
      const options = getInstrumentOptions(instrumentId, {
        frequency: freq
      });
      
      // Choose instrument based on frequency range
      let instrumentNumber = 1;
      
      if (freq < 200) {
        instrumentNumber = 1; // Simple oscillator for low frequencies
      } else if (freq < 500) {
        instrumentNumber = 2; // FM synthesis for mid-low frequencies
      } else if (freq < 800) {
        instrumentNumber = 3; // Additive synthesis for mid-high frequencies
      } else if (freq < 1200) {
        instrumentNumber = 4; // Plucked string for high frequencies
      } else {
        instrumentNumber = 5; // Percussion for very high frequencies
      }
      
      // Trigger audio
      if (triggerAudioCallback) {
        triggerAudioCallback(x, y, lastAngle, angle, tNow, {
          frequency: freq,
          instrument: instrumentNumber
        });
      }
      
      return freq;
    }
  );

  // Handle and fade markers
  for (let j = markers.length - 1; j >= 0; j--) {
    const marker = markers[j];
    marker.life--;
    
    // Update opacity
    if (marker.mesh && marker.mesh.material) {
      marker.mesh.material.opacity = marker.life / MARK_LIFE;
    }
    
    // Remove expired markers
    if (marker.life <= 0) {
      // Clean up mesh
      if (marker.mesh) {
        scene.remove(marker.mesh);
        
        if (marker.mesh.geometry) marker.mesh.geometry.dispose();
        if (marker.mesh.material) marker.mesh.material.dispose();
      }
      
      // Clean up text label
      if (marker.textLabel && marker.textLabel.id) {
        removeLabel(marker.textLabel.id);
      }
      
      // Remove from array
      markers.splice(j, 1);
    }
  }

  // Update state
  state.lastTrig = triggeredNow;
  state.lastAngle = ang;
  
  // Update point frequency labels
  if (state.showPointsFreqLabels) {
    updateRotatingLabels(group, cam, renderer);
  }

  // Update axis labels
  updateAxisLabels();

  // Update other labels
  updateLabelPositions(cam, renderer);
  
  // Calculate the appropriate camera distance to show all geometry
  const boundingSphere = calculateBoundingSphere(group, state);
  
  // Set target camera distance based on bounding sphere
  // Use a multiplier to ensure everything is in view
  const targetDistance = boundingSphere * 2.5;
  state.setCameraDistance(targetDistance);
  
  // Update camera lerping
  state.updateCameraLerp(dt);
  
  // Update the camera position
  cam.position.z = state.cameraDistance;
  
  // Render the scene
  stats.begin();
  renderer.render(scene, cam);
  stats.end();
}