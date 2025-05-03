// src/animation/animation.js
import * as THREE from 'three';
import { getCurrentTime } from '../audio/audio.js';
import { updateGroup, detectCrossings, createPolygonGeometry } from '../geometry/geometry.js';
import { processIntersections, createIntersectionMarkers } from '../geometry/intersections.js';
import { MARK_LIFE } from '../config/constants.js';

// Function to clean up intersection point markers
function cleanupIntersectionMarkers(scene) {
  if (scene && scene.userData.intersectionMarkers) {
    for (const marker of scene.userData.intersectionMarkers) {
      scene.remove(marker);
      if (marker.geometry) marker.geometry.dispose();
      if (marker.material) marker.material.dispose();
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
  if (currentSegments !== segments || state.currentGeometryRadius !== state.radius) {
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
  
  // If intersection toggle changed, need to update
  if (state.lastUseIntersections !== useIntersections) {
    state.lastUseIntersections = useIntersections;
    state.needsIntersectionUpdate = true;
    
    // Clean up intersection markers if no longer needed
    if (!useIntersections) {
      cleanupIntersectionMarkers(scene);
    }
  }
  
  // Process intersections if needed
  if (useIntersections && needsIntersectionUpdate && copies > 1) {
    // Clean up any existing intersection markers
    cleanupIntersectionMarkers(scene);
    
    // First create a temp group with the polygon copies (without visuals)
    const tempGroup = new THREE.Group();
    tempGroup.position.copy(group.position);
    
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
      
      // Create visual markers for the intersection points
      createIntersectionMarkers(scene, state.intersectionPoints);
    }
    
    // Clean up temporary group
    tempGroup.traverse(obj => {
      if (obj.geometry && obj !== params.baseGeo) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    
    // Reset the flag since we've updated the intersections
    state.needsIntersectionUpdate = false;
  }

  // Update the group with current parameters
  updateGroup(group, copies, stepScale, params.baseGeo, mat, segments, angle, state);

  // Calculate animation angle based on BPM
  const dAng = (bpm / 60) * 2 * Math.PI * dt;
  const ang = lastAngle + dAng;

  // Apply rotation to the group
  group.rotation.z = ang;

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
    
    // Remove markers with no life left
    if (o.life <= 0) {
      if (o.mesh) {
        scene.remove(o.mesh);
        
        // Proper cleanup to avoid memory leaks
        if (o.mesh.geometry) o.mesh.geometry.dispose();
        if (o.mesh.material) o.mesh.material.dispose();
      }
      markers.splice(j, 1);
    }
  }

  // Update state
  state.lastTrig = triggeredNow;
  state.lastAngle = ang;
  
  // Render
  stats.begin();
  renderer.render(scene, cam);
  stats.end();
}