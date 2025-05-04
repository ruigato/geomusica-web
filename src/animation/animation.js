// src/animation/animation.js
import * as THREE from 'three';
import { getCurrentTime } from '../audio/audio.js';
import { updateGroup, detectCrossings, createPolygonGeometry } from '../geometry/geometry.js';
import { processIntersections, createIntersectionMarkers } from '../geometry/intersections.js';
import { MARK_LIFE } from '../config/constants.js';
import { updateLabelPositions, updateAxisLabels, removeLabel, updateRotatingLabels } from '../ui/domLabels.js';

// Function to clean up intersection point markers - improved version
function cleanupIntersectionMarkers(scene) {
  // First clean up the marker group in the scene
  if (scene && scene.userData.intersectionMarkerGroup) {
    // If the marker group is a child of another object, remove it there
    const parent = scene.userData.intersectionMarkerGroup.parent;
    if (parent) {
      parent.remove(scene.userData.intersectionMarkerGroup);
    } else {
      scene.remove(scene.userData.intersectionMarkerGroup);
    }
    
    // Clear all children of the marker group and dispose resources
    scene.userData.intersectionMarkerGroup.traverse(child => {
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
  
  // Now clean up any marker groups that might be in child objects (like the main group)
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
  
  // Also clean up individual markers for backward compatibility
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

// Function to animate and update group rotation
export function animate(params) {
  const {
    scene, 
    group, 
    baseGeo, 
    mat, 
    stats, 
    csound, // Csound instance
    renderer, 
    cam, 
    state,
    triggerAudioCallback
  } = params;

  // Store camera and renderer in scene's userData for label management
  scene.userData.camera = cam;
  scene.userData.renderer = renderer;

  // Get the current state values - explicitly reading from state each frame
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
  requestAnimationFrame(() => animate({
    scene,
    group,
    baseGeo: params.baseGeo, // Important: use the params reference, not the local variable
    mat,
    stats,
    csound,
    renderer, 
    cam, 
    state,
    triggerAudioCallback
  }));

  // Use simple timing - no more Csound time dependency
  const tNow = getCurrentTime(); // Now returns performance.now() / 1000
  const dt = tNow - lastTime;
  state.lastTime = tNow;
  
  // Update lerped values based on time elapsed
  state.updateLerp(dt);

  // For BufferGeometry, we need to check if the radius or segments have changed
  // by comparing with the state values rather than geometry parameters
  let needsNewGeometry = false;
  
  // Extract the current number of points from the buffer geometry
  const currentSegments = baseGeo.getAttribute('position').count;
  
  // Store current geometry's radius in state if not already stored
  if (!state.currentGeometryRadius) {
    state.currentGeometryRadius = state.radius;
  }
  
  // Check if radius or segments have changed
  if (currentSegments !== segments || Math.abs(state.currentGeometryRadius - state.radius) > 0.1) {
    needsNewGeometry = true;
  }
  
  // If we need a new geometry, create it
  if (needsNewGeometry) {
    // Dispose of the old geometry to free memory
    baseGeo.dispose();
    
    // Create new polygon geometry
    const newGeo = createPolygonGeometry(radius, segments);
    
    // Update references
    state.baseGeo = newGeo;
    params.baseGeo = newGeo;
    
    // Store the current radius value used to create this geometry
    state.currentGeometryRadius = radius;
    
    // If intersections are enabled, flag for update
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

  // Additional flag for updating point frequency labels
  const pointFreqLabelsToggleChanged = 
    state.showPointsFreqLabels !== state.lastShowPointsFreqLabels;
    
  if (pointFreqLabelsToggleChanged) {
    state.lastShowPointsFreqLabels = state.showPointsFreqLabels;
    state.needsPointFreqLabelsUpdate = true;
  }

  // If parameters changed, we need to update
  if (paramsChanged) {
    // Store current values for comparison in next frame
    state.lastStepScale = stepScale;
    state.lastAngle = angle;
    
    // Always clean up existing intersection markers before updating
    cleanupIntersectionMarkers(scene);
    
    // Force intersection update
    if (useIntersections) {
      state.needsIntersectionUpdate = true;
    }
  }
  
  // Check if we're still lerping
  const isLerping = state.useLerp && (
    Math.abs(state.radius - state.targetRadius) > 0.1 ||
    Math.abs(state.stepScale - state.targetStepScale) > 0.001 ||
    Math.abs(state.angle - state.targetAngle) > 0.1
  );
  
  // Check if we actually have enough copies for intersections to be possible
  const hasEnoughCopiesForIntersections = copies > 1;

  // If we don't have enough copies, clean up any existing intersection points
  if (state.useIntersections && !hasEnoughCopiesForIntersections) {
    // Clear any existing intersection points
    state.intersectionPoints = [];
    
    // Clean up any existing intersection markers
    cleanupIntersectionMarkers(scene);
    
    // If we have a marker group on the main group, remove it
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
  
  // If intersection toggle changed, need to update
  if (state.lastUseIntersections !== useIntersections) {
    state.lastUseIntersections = useIntersections;
    state.needsIntersectionUpdate = true;
    
    // Clean up intersection markers if no longer needed
    if (!useIntersections) {
      cleanupIntersectionMarkers(scene);
    }
  }
  
  // Only process intersections if parameters have changed, we have enough copies, and we're not lerping
  const needsIntersectionRecalculation = 
    useIntersections && 
    hasEnoughCopiesForIntersections && 
    (needsIntersectionUpdate || paramsChanged);
    
  // Process intersections if needed - but ONLY when parameters have changed
  if (needsIntersectionRecalculation) {
    // Clean up any existing intersection markers
    cleanupIntersectionMarkers(scene);
    
    // Reset intersection points array to empty before calculating new ones
    state.intersectionPoints = [];
    
    // First create a temp group with the polygon copies (without visuals)
    const tempGroup = new THREE.Group();
    tempGroup.position.copy(group.position);
    
    // Make sure state is accessible to the intersection functions
    tempGroup.userData.state = state;
    
    // Add copies to the temp group
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
    
    // Process intersections with the temporary group
    const newGeometry = processIntersections(state, params.baseGeo, tempGroup);
    
    // If we got a new geometry with intersections added
    if (newGeometry !== params.baseGeo) {
      params.baseGeo = newGeometry;
      state.baseGeo = newGeometry;
    }
    
    // Clean up temporary group
    tempGroup.traverse(obj => {
      if (obj.geometry && obj !== params.baseGeo) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    
    // If no intersections were found, ensure the marker group is cleared
    if (!state.intersectionPoints || state.intersectionPoints.length === 0) {
      // Make sure to clean up both in the scene and in the group
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
      
      // Also clear out the state's intersection points array explicitly
      state.intersectionPoints = [];
    }
    
    // Reset the flag since we've updated the intersections
    state.needsIntersectionUpdate = false;
    
    // Flag to updateGroup that intersections were just calculated
    state.justCalculatedIntersections = true;
  } else {
    state.justCalculatedIntersections = false;
  }

  // Update the group with current parameters and pass the justCalculatedIntersections flag
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
  
  // Reset the flag after updating
  if (state.needsPointFreqLabelsUpdate) {
    state.needsPointFreqLabelsUpdate = false;
  }

  // Calculate animation angle based on BPM
  const dAng = (bpm / 60) * 2 * Math.PI * dt;
  const ang = lastAngle + dAng;

  // Apply rotation to the group
  group.rotation.z = ang;

// Update rotating labels (only the point frequency labels)
if (state.showPointsFreqLabels) {
  updateRotatingLabels(group, cam, renderer);
}
  // Detection of vertex crossings and audio calculations
  const triggeredNow = detectCrossings(
    params.baseGeo, 
    lastAngle, 
    ang, 
    copies, 
    group, 
    lastTrig, 
    tNow, 
    triggerAudioCallback
  );

  // Fade and remove markers
  for (let j = markers.length - 1; j >= 0; j--) {
    const o = markers[j];
    o.life--;
    
    // Update opacity based on remaining life
    if (o.mesh && o.mesh.material) {
      o.mesh.material.opacity = o.life / MARK_LIFE;
    }
    
    // DOM-based text labels are handled by updateAxisLabels
    
    // Remove markers with no life left
    if (o.life <= 0) {
      // Clean up mesh
      if (o.mesh) {
        scene.remove(o.mesh);
        
        // Proper cleanup to avoid memory leaks
        if (o.mesh.geometry) o.mesh.geometry.dispose();
        if (o.mesh.material) o.mesh.material.dispose();
      }
      
      // Clean up text label if it has an ID (DOM-based)
      if (o.textLabel && o.textLabel.id) {
        removeLabel(o.textLabel.id);
      }
      
      // Remove from markers array
      markers.splice(j, 1);
    }
  }

  // Update state
  state.lastTrig = triggeredNow;
  state.lastAngle = ang;
  
// First update the point frequency labels (only if enabled)
if (state.showPointsFreqLabels) {
  updateRotatingLabels(group, cam, renderer);
}

// Then separately update the axis labels (these must be handled differently)
updateAxisLabels();

// Finally update any other non-rotating labels
updateLabelPositions(cam, renderer);
  
  // Render
  stats.begin();
  renderer.render(scene, cam);
  stats.end();
}