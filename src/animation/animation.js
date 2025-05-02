// src/animation/animation.js
import * as THREE from 'three';
import { getCurrentTime } from '../audio/audio.js';
import { updateGroup, detectCrossings, createPolygonGeometry } from '../geometry/geometry.js';
import { MARK_LIFE } from '../config/constants.js';

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
  
  // Check if radius or segments have changed
  if (currentSegments !== segments) {
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
  }

  updateGroup(group, copies, stepScale, baseGeo, mat, segments, angle);

  // Calculate animation angle based on BPM
  const dAng = (bpm / 60) * 2 * Math.PI * dt;
  const ang = lastAngle + dAng;

  // Apply rotation to the group
  group.rotation.z = ang;

  // Detection of vertex crossings and audio calculations
  const triggeredNow = detectCrossings(
    baseGeo, 
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
    o.mesh.material.opacity = o.life / MARK_LIFE;
    if (o.life <= 0) {
      scene.remove(o.mesh);
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