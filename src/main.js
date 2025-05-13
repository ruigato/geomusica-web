// src/main.js - Updated with improved DOM loading and parameter handling
import * as THREE from 'three';
import Stats from 'stats.js';

// Import modules
import { setupUI } from './ui/ui.js';
import { setupSynthUI } from './ui/synthUI.js';
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
import { initializeTime, enableCsoundTiming } from './time/time.js';
import { setupHeaderTabs } from './ui/headerTabs.js';

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

// Make state globally accessible for debugging
window._appState = appState;

// Store UI references globally
let uiReferences = null;
let synthUIReferences = null;

// References to core components
let audioInstance = null;
let sceneInstance = null;
let groupInstance = null;

/**
 * Ensure state is synchronized across all systems
 * Call this whenever the state changes in important ways
 */
function syncStateAcrossSystems() {
  // Make sure all core components have access to the state
  if (sceneInstance) {
    sceneInstance.userData.state = appState;
  }
  
  if (groupInstance) {
    groupInstance.userData.state = appState;
  }
  
  if (audioInstance) {
    // Update audio state
    audioInstance.userData = {
      ...audioInstance.userData,
      state: appState
    };
  }
  
  // Force more immediate intersection update on critical parameter changes
  if (appState.parameterChanges && 
      (appState.parameterChanges.copies || 
       appState.parameterChanges.modulus || 
       appState.parameterChanges.useModulus)) {
    appState.needsIntersectionUpdate = true;
  }
}

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
            
            // Ensure all systems have updated state
            syncStateAcrossSystems();
            
            // Update audio engine with imported state values
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

/**
 * Check if the DOM is fully loaded
 * @returns {boolean} True if DOM is fully loaded, false otherwise
 */
function isDOMLoaded() {
  return document.readyState === 'complete' || document.readyState === 'interactive';
}

// Function to setup collapsible sections
function setupCollapsibleSections() {
  const sections = document.querySelectorAll('section');
  
  sections.forEach(section => {
    const header = section.querySelector('h2');
    const content = section.querySelector('.section-content');
    
    if (header && content) {
      // Add click event to h2 headers
      header.addEventListener('click', () => {
        // Toggle the collapsed class on the section (for our original implementation)
        section.classList.toggle('collapsed');
        
        // Toggle the collapsed class on the header and content (for the inline JS implementation)
        if (header.classList.contains('section-title')) {
          header.classList.toggle('collapsed');
          content.classList.toggle('collapsed');
        }
        
        // Save the collapsed state to localStorage
        const sectionId = header.textContent.trim().replace(/\s+/g, '_').toLowerCase();
        localStorage.setItem(`section_${sectionId}_collapsed`, section.classList.contains('collapsed'));
      });
      
      // Check if there's a saved state for this section
      const sectionId = header.textContent.trim().replace(/\s+/g, '_').toLowerCase();
      const isCollapsed = localStorage.getItem(`section_${sectionId}_collapsed`) === 'true';
      
      // Apply saved state
      if (isCollapsed) {
        section.classList.add('collapsed');
        
        // Also add it to the title and content if we're using that approach
        if (header.classList.contains('section-title')) {
          header.classList.add('collapsed');
          content.classList.add('collapsed');
        }
      }
    }
  });
}

// Preload the DOS VGA font before proceeding with setup
function loadFontAndInitApp() {
  preloadFont('Perfect DOS VGA 437', '/fonts/PerfectDOSVGA437.ttf')
    .then(() => {
      console.log('DOS VGA font loaded successfully');
      
      // Initialize label system after font is loaded
      initLabels();
      
      // Continue with application setup
      // Make sure we check if DOM is ready
      if (isDOMLoaded()) {
        initializeApplication();
      } else {
        // Wait for DOM to be fully loaded
        document.addEventListener('DOMContentLoaded', initializeApplication);
      }
    })
    .catch(error => {
      console.error('Error loading DOS VGA font:', error);
      
      // Continue anyway with fallback font
      console.warn('Using fallback font instead');
      
      // Initialize label system with fallback font
      initLabels();
      
      // Make sure we check if DOM is ready
      if (isDOMLoaded()) {
        initializeApplication();
      } else {
        // Wait for DOM to be fully loaded
        document.addEventListener('DOMContentLoaded', initializeApplication);
      }
    });
}

// Function to initialize the application after font loading
function initializeApplication() {
  console.log("Initializing application...");
  
  // Ensure DOM is fully loaded
  if (!isDOMLoaded()) {
    console.warn("DOM not fully loaded. Waiting...");
    document.addEventListener('DOMContentLoaded', initializeApplication);
    return;
  }
  
  console.log("DOM loaded. Setting up UI...");
  
  // Setup UI and bind it to state - STORE the references
  uiReferences = setupUI(appState);
  
  if (!uiReferences) {
    console.error("Failed to set up UI. Retrying...");
    // Retry after a short delay
    setTimeout(initializeApplication, 100);
    return;
  }

  // Setup header tabs functionality
  setupHeaderTabs();

  // Load saved state if available
  const savedState = loadState();
  if (savedState) {
    console.log("Loading saved state:", savedState);
    applyLoadedState(appState, savedState);
    // Update UI to reflect loaded state
    updateUIFromState(appState, uiReferences);
  }

  // Add import/export controls to the UI
  addStateControlsToUI(appState);

  // Setup collapsible sections
  setupCollapsibleSections();

  // Set up auto save (every 5 seconds) - COMMENTED OUT FOR PERFORMANCE
  // const stopAutoSave = setupAutoSave(appState, 5000);

  // Setup audio - now with enhanced Csound timing for better precision
  setupAudio().then(audioEngineInstance => {
    audioInstance = audioEngineInstance;
    
    if (!audioInstance) {
      console.error('Failed to initialize audio. Visualization will run without audio.');
    }

    // Store state reference in audio instance
    if (audioInstance) {
      audioInstance.userData = { 
        ...audioInstance.userData, 
        state: appState 
      };
    }

    // Initialize time module with Csound instance
    if (audioInstance && audioInstance.audioContext) {
      initializeTime(audioInstance, audioInstance.audioContext);
      
      // Enable Csound timing after a short delay to ensure Csound is ready
      setTimeout(() => {
        enableCsoundTiming().then(success => {
          if (success) {
            console.log("Csound timing enabled successfully");
          } else {
            console.warn("Could not enable Csound timing, using audio context time instead");
          }
        });
      }, 1000);
    }

    // Setup synthesizer UI controls after audio is initialized
    synthUIReferences = setupSynthUI(appState, audioInstance);
    
    // If we have loaded state, update synth UI and audio engine
    if (savedState) {
      console.log("Applying loaded state to UI elements:", savedState);
      
      // Update both UI sets with all loaded values including equal temperament settings
      updateUIFromState(appState, { ...uiReferences, ...synthUIReferences });
      
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
    const handleAudioTrigger = (note) => {
      if (!audioInstance) {
        return note;
      }
    
      try {
        // Make sure we're using a clean copy of the note
        const noteCopy = typeof note === 'object' ? { ...note } : { 
          frequency: 440, 
          duration: 0.3, 
          velocity: 0.7,
          pan: 0
        };
        
        // Add state reference data to the note
        if (appState) {
          noteCopy.useEqualTemperament = appState.useEqualTemperament;
          noteCopy.referenceFrequency = appState.referenceFrequency;
        }
        
        // Pass the note copy to triggerAudio
        return triggerAudio(noteCopy);
      } catch (error) {
        console.error("Error in handleAudioTrigger:", error);
        return note;
      }
    };

    // Three.js setup
    const scene = new THREE.Scene();
    sceneInstance = scene;
    
    // Store the appState in the scene's userData for access in other modules
    scene.userData.state = appState;
    
    const cam = new THREE.PerspectiveCamera(
      75, 
      (window.innerWidth * 0.5) / window.innerHeight, // Updated to account for 50% UI width
      0.1, 
      100000
    );
    cam.position.set(0, 0, 2000);
    cam.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth * 0.5, window.innerHeight); // Updated to account for 50% UI width
    
    const canvasContainer = document.getElementById('canvas');
    if (canvasContainer) {
      canvasContainer.appendChild(renderer.domElement);
    } else {
      console.error("Canvas container not found in DOM");
      document.body.appendChild(renderer.domElement);
    }

    // Store camera and renderer in scene's userData for label management
    scene.userData.camera = cam;
    scene.userData.renderer = renderer;

    // Initialize geometry - use our new polygon outline geometry
    // Fix for rounding bug: Ensure we pass the exact number of segments
    const baseGeo = createPolygonGeometry(appState.radius, Math.round(appState.segments));
    appState.baseGeo = baseGeo; // Store reference in state
    
    // Use LineBasicMaterial for lines
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc });
    
    const group = new THREE.Group();
    groupInstance = group;
    group.userData.state = appState;
    scene.add(group);
    createAxis(scene);

    // Setup marker geometry - create a reusable geometry for markers
    const markerGeom = new THREE.SphereGeometry(8, 8, 8);
    
    // Store it in scene's userData for reuse
    scene.userData.markerGeometry = markerGeom;

    // Handle window resize
    window.addEventListener('resize', () => {
      cam.aspect = (window.innerWidth * 0.5) / window.innerHeight; // Updated to account for 50% UI width
      cam.updateProjectionMatrix();
      renderer.setSize(window.innerWidth * 0.5, window.innerHeight); // Updated to account for 50% UI width
      
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
    
    // Print state to console for debugging
    console.log("Current state before animation:", {
      useAltScale: appState.useAltScale,
      altScale: appState.altScale,
      altStepN: appState.altStepN,
      useTimeSubdivision: appState.useTimeSubdivision,
      timeSubdivisionValue: appState.timeSubdivisionValue,
      useEqualTemperament: appState.useEqualTemperament,
      referenceFrequency: appState.referenceFrequency,
      segments: appState.segments // Added to debug the segments issue
    });
    
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
    sceneInstance = scene;
    
    // Store the appState in the scene's userData for access in other modules
    scene.userData.state = appState;
    
    const cam = new THREE.PerspectiveCamera(
      75, 
      (window.innerWidth * 0.5) / window.innerHeight, // Updated to account for 50% UI width
      0.1, 
      10000
    );
    cam.position.set(0, 0, 2000);
    cam.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth * 0.5, window.innerHeight); // Updated to account for 50% UI width
    const canvasContainer = document.getElementById('canvas');
    if (canvasContainer) {
      canvasContainer.appendChild(renderer.domElement);
    } else {
      console.error("Canvas container not found in DOM");
      document.body.appendChild(renderer.domElement);
    }

    // Store camera and renderer in scene's userData for label management
    scene.userData.camera = cam;
    scene.userData.renderer = renderer;

    // Initialize polygon geometry without audio
    // Fix for rounding bug: Ensure we pass the exact number of segments
    const baseGeo = createPolygonGeometry(appState.radius, Math.round(appState.segments));
    appState.baseGeo = baseGeo;
    
    // Use LineBasicMaterial for lines
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc });
    
    const group = new THREE.Group();
    groupInstance = group;
    group.userData.state = appState;
    scene.add(group);
    createAxis(scene);

    // Setup marker geometry - create a reusable geometry for markers
    const markerGeom = new THREE.SphereGeometry(8, 8, 8);
    
    // Store it in scene's userData for reuse
    scene.userData.markerGeometry = markerGeom;

    // Handle window resize with label updates
    window.addEventListener('resize', () => {
      cam.aspect = (window.innerWidth * 0.5) / window.innerHeight; // Updated to account for 50% UI width
      cam.updateProjectionMatrix();
      renderer.setSize(window.innerWidth * 0.5, window.innerHeight); // Updated to account for 50% UI width
      
      // Update DOM label positions when window resizes
      updateLabelPositions(cam, renderer);
    });

    // Silent audio trigger function - does nothing but required for animation
    const silentAudioTrigger = (note) => {
      return note;
    };

    // Still setup the synth UI even without audio
    synthUIReferences = setupSynthUI(appState, null);
    
    // If we have loaded state, update synth UI
    if (savedState) {
      // Update both UI sets with all loaded values including scale mod parameters
      updateUIFromState(appState, { ...uiReferences, ...synthUIReferences });
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
  // Force initial redraw after a delay to ensure correct segments rendering
setTimeout(() => {
  // Force update of segments to redraw geometry
  if (appState && appState.segments) {
    const currentSegments = appState.segments;
    appState.setSegments(currentSegments);
    console.log("Forcing initial redraw with segments:", currentSegments);
  }
}, 500);
}

// After saving all the original state setters, wrap them to call syncStateAcrossSystems
// This ensures state is always consistent across all systems
const originalSetters = {
  setCopies: appState.setCopies,
  setModulusValue: appState.setModulusValue,
  setUseModulus: appState.setUseModulus,
  setAltScale: appState.setAltScale,
  setUseAltScale: appState.setUseAltScale,
  setAltStepN: appState.setAltStepN,
  // Add setSegments to ensure rounding is properly applied
  setSegments: appState.setSegments,
  // Add fractal setters
  setFractalValue: appState.setFractalValue,
  setUseFractal: appState.setUseFractal
};

// Override key setters to ensure state sync
appState.setCopies = function(value) {
  originalSetters.setCopies.call(this, value);
  syncStateAcrossSystems();
};

appState.setModulusValue = function(value) {
  originalSetters.setModulusValue.call(this, value);
  syncStateAcrossSystems();
};

appState.setUseModulus = function(value) {
  originalSetters.setUseModulus.call(this, value);
  syncStateAcrossSystems();
};

appState.setAltScale = function(value) {
  originalSetters.setAltScale.call(this, value);
  syncStateAcrossSystems();
};

appState.setUseAltScale = function(value) {
  originalSetters.setUseAltScale.call(this, value);
  syncStateAcrossSystems();
};

appState.setAltStepN = function(value) {
  originalSetters.setAltStepN.call(this, value);
  syncStateAcrossSystems();
};

// Override setSegments to ensure proper rounding
appState.setSegments = function(value) {
  // Ensure value is properly rounded to an integer
  const roundedValue = Math.round(Number(value));
  originalSetters.setSegments.call(this, roundedValue);
  syncStateAcrossSystems();
};

// Override fractal setters
appState.setFractalValue = function(value) {
  originalSetters.setFractalValue.call(this, value);
  syncStateAcrossSystems();
};

appState.setUseFractal = function(value) {
  originalSetters.setUseFractal.call(this, value);
  syncStateAcrossSystems();
};

// Start the application initialization process
if (isDOMLoaded()) {
  loadFontAndInitApp();
} else {
  document.addEventListener('DOMContentLoaded', loadFontAndInitApp);
}