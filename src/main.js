// src/main.js
import * as THREE from 'three';
import Stats from 'stats.js';

// Import modules
import { setupUI } from './ui/ui.js';
import { setupAudio, triggerAudio } from './audio/audio.js';
import { createPolygonGeometry, createAxis } from './geometry/geometry.js';
import { animate } from './animation/animation.js';
import { createAppState } from './state/state.js';
import { MARK_LIFE } from './config/constants.js';
import { initLabels, updateLabelPositions } from './ui/domLabels.js';
import { preloadFont } from './utils/fontUtils.js';

// Initialize stats for performance monitoring
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Create application state
const appState = createAppState();

// Preload the DOS VGA font before proceeding with setup
preloadFont('Perfect DOS VGA 437', '/fonts/PerfectDOSVGA437.ttf')
  .then(() => {
    console.log('DOS VGA font loaded successfully');
    
    // Initialize label system after font is loaded
    initLabels();
    
    // Continue with application setup
    initializeApplication();
  })
  .catch(error => {
    console.error('Error loading DOS VGA font:', error);
    
    // Continue anyway with fallback font
    console.warn('Using fallback font instead');
    
    // Initialize label system with fallback font
    initLabels();
    
    initializeApplication();
  });

// Function to initialize the application after font loading
function initializeApplication() {
  // Setup UI and bind it to state
  setupUI(appState);

  // Setup audio - now with WebAudio
  setupAudio().then(audioInstance => {
    if (!audioInstance) {
      console.error('Failed to initialize audio. Visualization will run without audio.');
    } else {
      console.log('Audio initialized successfully. Click anywhere to start audio.');
    }

    // Function to handle audio triggers
    const handleAudioTrigger = (x, y, lastAngle, angle, tNow) => {
      triggerAudio(audioInstance, x, y, lastAngle, angle, tNow);
    };

    // Three.js setup
    const scene = new THREE.Scene();
    
    // Store the appState in the scene's userData for access in other modules
    scene.userData.state = appState;
    
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

    // Store camera and renderer in scene's userData for label management
    scene.userData.camera = cam;
    scene.userData.renderer = renderer;

    // Initialize geometry - use our new polygon outline geometry
    const baseGeo = createPolygonGeometry(appState.radius, appState.segments);
    appState.baseGeo = baseGeo; // Store reference in state
    
    // Use LineBasicMaterial instead of MeshBasicMaterial for lines
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc });
    
    const group = new THREE.Group();
    scene.add(group);
    createAxis(scene);

    // Setup marker geometry - create a reusable geometry for markers
    const markerGeom = new THREE.SphereGeometry(8, 8, 8);
    
    // Store it in scene's userData for reuse
    scene.userData.markerGeometry = markerGeom;

    // Handle window resize
    window.addEventListener('resize', () => {
      cam.aspect = (window.innerWidth * 0.8) / window.innerHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(window.innerWidth * 0.8, window.innerHeight);
      
      // Update DOM label positions when window resizes
      updateLabelPositions(cam, renderer);
    });

    // Add an info message
    const infoEl = document.createElement('div');
    infoEl.style.position = 'absolute';
    infoEl.style.bottom = '10px';
    infoEl.style.left = '10px';
    infoEl.style.color = 'white';
    infoEl.style.background = 'rgba(0,0,0,0.5)';
    infoEl.style.padding = '5px';
    infoEl.style.borderRadius = '5px';
    infoEl.textContent = 'GeoMusica - Click anywhere to start audio';
    document.body.appendChild(infoEl);

    // Start animation loop
    animate({
      scene,
      group,
      baseGeo,
      mat,
      stats,
      csound: audioInstance,
      renderer,
      cam,
      state: appState,
      triggerAudioCallback: handleAudioTrigger
    });
  }).catch(error => {
    console.error('Error setting up audio:', error);
    
    // Setup Three.js anyway without audio
    const scene = new THREE.Scene();
    
    // Store the appState in the scene's userData for access in other modules
    scene.userData.state = appState;
    
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

    // Store camera and renderer in scene's userData for label management
    scene.userData.camera = cam;
    scene.userData.renderer = renderer;

    // Initialize polygon geometry without audio
    const baseGeo = createPolygonGeometry(appState.radius, appState.segments);
    appState.baseGeo = baseGeo;
    
    // Use LineBasicMaterial for lines
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc });
    
    const group = new THREE.Group();
    scene.add(group);
    createAxis(scene);

    // Setup marker geometry - create a reusable geometry for markers
    const markerGeom = new THREE.SphereGeometry(8, 8, 8);
    
    // Store it in scene's userData for reuse
    scene.userData.markerGeometry = markerGeom;

    // Handle window resize with label updates
    window.addEventListener('resize', () => {
      cam.aspect = (window.innerWidth * 0.8) / window.innerHeight;
      cam.updateProjectionMatrix();
      renderer.setSize(window.innerWidth * 0.8, window.innerHeight);
      
      // Update DOM label positions when window resizes
      updateLabelPositions(cam, renderer);
    });

    // Silent audio trigger function - does nothing but required for animation
    const silentAudioTrigger = () => {};

    // Start animation loop without audio
    animate({
      scene,
      group,
      baseGeo,
      mat,
      stats,
      csound: null,
      renderer,
      cam,
      state: appState,
      triggerAudioCallback: silentAudioTrigger
    });
  });
}