// src/animation/animation.js
import * as THREE from 'three';
import { Tone } from '../audio/audio.js';
import { updateGroup, detectCrossings } from '../geometry/geometry.js';
import { MARK_LIFE } from '../config/constants.js';

// Function to animate and update group rotation
export function animate(params) {
  const {
    scene, 
    group, 
    baseGeo, 
    mat, 
    stats, 
    synth, 
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
    synth,
    renderer,
    cam,
    state,
    triggerAudioCallback
  }));

  // Calculate time and update lerping
  const tNow = Tone.now(); 
  const dt = tNow - lastTime;
  state.lastTime = tNow;
  
  // Update lerped values based on time elapsed
  state.updateLerp(dt);

  // Rebuild geometry if radius or segments change
  if (baseGeo.parameters.radius !== radius || baseGeo.parameters.segments !== segments) {
    baseGeo.dispose();
    const newGeo = new THREE.CircleGeometry(radius, segments);
    state.baseGeo = newGeo;
    // This is critical: we need to update the baseGeo reference in our params as well
    params.baseGeo = newGeo;
  }

  updateGroup(group, copies, stepScale, baseGeo, mat, segments, angle);

  // Calculate animation angle based on BPM
  const dAng = (bpm / 60) * 2 * Math.PI * dt;
  const ang = lastAngle + dAng;

  // Apply rotation to the group
  // We don't apply the UI angle here, since it's applied per-copy in updateGroup
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