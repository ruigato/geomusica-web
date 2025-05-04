// src/main.js - Updated to include synth UI and state persistence
import * as THREE from 'three';
import Stats from 'stats.js';

// Import modules
import { setupUI } from './ui/ui.js';
import { setupSynthUI } from './ui/synthUI.js'; // Import the new synthUI module
import { 
  setupAudio, 
  triggerAudio, 
  setEnvelope, 
  setBrightness, 
  setMasterVolume,
  applySynthParameters
} from './audio/audio.js';
import { createPolygonGeometry, createAxis } from './geometry/geometry.js';
import { animate } from './animation/animation.js';
import { createAppState } from './state/state.js';
import { MARK_LIFE } from './config/constants.js';
import { initLabels, updateLabelPositions } from './ui/domLabels.js';
import { preloadFont } from './utils/fontUtils.js';
import { 
  loadState, 
  applyLoadedState, 
  setupAutoSave, 
  exportStateToFile, 
  importStateFromFile, 
  updateUIFromState,
  updateAudioEngineFromState
} from './state/statePersistence.js';

// Initialize stats for performance monitoring
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Position the stats panel in the top right corner
stats.dom.style.position = 'absolute';
stats.dom.style.left = 'auto';
stats.dom.style.right = '10px';
stats.dom.style.top = '10px';

// Create application state
const appState = createAppState();

// Store UI references globally
let uiReferences = null;
let synthUIReferences = null;

// Add this function to the file
function addStateControlsToUI(state) {
  // Create a container for the controls
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.bottom = '10px';
  container.style.right = '10px';
  container.style.zIndex = '1000';
  container.style.display = 'flex';
  container.style.gap = '10px';
  
  // Create export button
  const exportButton = document.createElement('button');
  exportButton.textContent = 'Export Settings';
  exportButton.style.padding = '8px 12px';
  exportButton.style.backgroundColor = '#333';
  exportButton.style.color = '#fff';
  exportButton.style.border = 'none';
  exportButton.style.borderRadius = '4px';
  exportButton.style.cursor = 'pointer';
  
  // Add export click handler
  exportButton.addEventListener('click', () => {
    exportStateToFile(state);
  });
  
  // Create import button and file input
  const importButton = document.createElement('button');
  importButton.textContent = 'Import Settings';
  importButton.style.padding = '8px 12px';
  importButton.style.backgroundColor = '#333';
  importButton.style.color = '#fff';
  importButton.style.border = 'none';
  importButton.style.borderRadius = '4px';
  importButton.style.cursor = 'pointer';
  
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.style.display = 'none';
  
  // Set up import click handler
  importButton.addEventListener('click', () => {
    fileInput.click();
  });
  
  // Handle file selection
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      importStateFromFile(file, state)
        .then(success => {
          if (success) {
            // Update UI to reflect imported state
            const allUIReferences = { ...uiReferences, ...synthUIReferences };
            updateUIFromState(state, allUIReferences);
            
            // Update audio engine with imported state values - use new approach
            applySynthParameters({
              attack: state.attack,
              decay: state.decay,
              sustain: state.sustain,
              release: state.release,
              brightness: state.brightness,
              volume: state.volume
            }).then(result => {
              console.log("Synth parameters applied after import:", result);
            });
          } else {
            alert('Failed to import settings');
          }
        })
        .catch(error => {
          console.error('Import error:', error);
          alert('Error importing settings file');
        });
    }
  });
  
  // Add elements to container
  container.appendChild(exportButton);
  container.appendChild(importButton);
  container.appendChild(fileInput);
  
  // Add container to document
  document.body.appendChild(container);
}

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
  // Setup UI and bind it to state - STORE the references
  uiReferences = setupUI(appState);

  // Load saved state if available
  const savedState = loadState();
  if (savedState) {
    applyLoadedState(appState, savedState);
    // Update UI to reflect loaded state
    updateUIFromState(appState, uiReferences);
  }

  // Add import/export controls to the UI
  addStateControlsToUI(appState);

  // Set up auto save (every 5 seconds)
  const stopAutoSave = setupAutoSave(appState, 5000);

  // Setup audio - now with enhanced Csound timing for better precision
  setupAudio().then(audioInstance => {
    if (!audioInstance) {
      console.error('Failed to initialize audio. Visualization will run without audio.');
    }

    // Setup synthesizer UI controls after audio is initialized
    synthUIReferences = setupSynthUI(appState, audioInstance);
    
    // If we have loaded state, update synth UI and audio engine
    if (savedState) {
      updateUIFromState(appState, synthUIReferences);
      
      // Apply synth parameters directly with the new approach
      applySynthParameters({
        attack: appState.attack,
        decay: appState.decay,
        sustain: appState.sustain,
        release: appState.release,
        brightness: appState.brightness,
        volume: appState.volume
      }).then(result => {
        console.log("Synth parameters applied on load:", result);
      });
    } else {
      // Set initial ADSR values in the audio engine from default state
      applySynthParameters({
        attack: appState.attack,
        decay: appState.decay,
        sustain: appState.sustain,
        release: appState.release,
        brightness: appState.brightness,
        volume: appState.volume
      });
    }

    // Function to handle audio triggers
    const handleAudioTrigger = (x, y, lastAngle, angle, tNow, options = {}) => {
      return triggerAudio(audioInstance, x, y, lastAngle, angle, tNow, options);
    };

    // Three.js setup
    const scene = new THREE.Scene();
    
    // Store the appState in the scene's userData for access in other modules
    scene.userData.state = appState;
    
    const cam = new THREE.PerspectiveCamera(
      75, 
      (window.innerWidth * 0.6) / window.innerHeight, // Updated to account for new UI width
      0.1, 
      10000
    );
    cam.position.set(0, 0, 2000);
    cam.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth * 0.6, window.innerHeight); // Updated to account for new UI width
    document.getElementById('canvas').appendChild(renderer.domElement);

    // Store camera and renderer in scene's userData for label management
    scene.userData.camera = cam;
    scene.userData.renderer = renderer;

    // Initialize geometry - use our new polygon outline geometry
    const baseGeo = createPolygonGeometry(appState.radius, appState.segments);
    appState.baseGeo = baseGeo; // Store reference in state
    
    // Use LineBasicMaterial for lines
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
      cam.aspect = (window.innerWidth * 0.6) / window.innerHeight; // Updated to account for new UI width
      cam.updateProjectionMatrix();
      renderer.setSize(window.innerWidth * 0.6, window.innerHeight); // Updated to account for new UI width
      
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
      (window.innerWidth * 0.6) / window.innerHeight, // Updated to account for new UI width
      0.1, 
      10000
    );
    cam.position.set(0, 0, 2000);
    cam.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth * 0.6, window.innerHeight); // Updated to account for new UI width
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
      cam.aspect = (window.innerWidth * 0.6) / window.innerHeight; // Updated to account for new UI width
      cam.updateProjectionMatrix();
      renderer.setSize(window.innerWidth * 0.6, window.innerHeight); // Updated to account for new UI width
      
      // Update DOM label positions when window resizes
      updateLabelPositions(cam, renderer);
    });

    // Silent audio trigger function - does nothing but required for animation
    const silentAudioTrigger = () => {};

    // Still setup the synth UI even without audio
    synthUIReferences = setupSynthUI(appState, null);
    
    // If we have loaded state, update synth UI
    if (savedState) {
      updateUIFromState(appState, synthUIReferences);
    }

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