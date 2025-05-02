// src/main.js
import * as THREE from 'three';
import Stats from 'stats.js';

// Import modules
import { setupUI } from './ui/ui.js';
import { setupAudio, triggerAudio } from './audio/audio.js';
import { createCircleGeometry, createAxis } from './geometry/geometry.js';
import { animate } from './animation/animation.js';
import { createAppState } from './state/state.js';
import { MARK_LIFE } from './config/constants.js';

// Initialize stats for performance monitoring
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Create application state
const appState = createAppState();

// Setup UI and bind it to state
setupUI(appState);

// Setup audio
const synth = setupAudio();

// Function to handle audio triggers with access to synth
const handleAudioTrigger = (x, y, lastAngle, angle, tNow) => {
  triggerAudio(synth, x, y, lastAngle, angle, tNow);
};

// Three.js setup
const scene = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(
  75, 
  (window.innerWidth * 0.8) / window.innerHeight, 
  0.1, 
  10000
);
cam.position.set(0, 0, 2000);
cam.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth * 0.8, window.innerHeight);
document.getElementById('canvas').appendChild(renderer.domElement);

// Initialize geometry
const baseGeo = createCircleGeometry(appState.radius, appState.segments);
appState.baseGeo = baseGeo; // Store reference in state
const mat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
const group = new THREE.Group();
scene.add(group);
createAxis(scene);

// Setup marker geometry
const markerGeom = new THREE.SphereGeometry(8, 8, 8);

// Handle window resize
window.addEventListener('resize', () => {
  cam.aspect = (window.innerWidth * 0.8) / window.innerHeight;
  cam.updateProjectionMatrix();
  renderer.setSize(window.innerWidth * 0.8, window.innerHeight);
});

// Start animation loop
animate({
  scene,
  group,
  baseGeo: baseGeo, // Pass the direct reference, not through state
  mat,
  stats,
  synth,
  renderer,
  cam,
  state: appState,
  triggerAudioCallback: handleAudioTrigger
});