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
// Import the new layer modules
import { LayerManager } from './state/LayerManager.js';
import { setupLayersUI, updateLayersUI } from './ui/layersUI.js';

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
let layerUIReferences = null;

// References to core components
let audioInstance = null;
let sceneInstance = null;
let layerManager = null;

/**
 * Ensure state is synchronized across all systems
 * Call this whenever the state changes in important ways
 */
function syncStateAcrossSystems() {
  // Get active layer's state
  const activeLayer = layerManager?.getActiveLayer();
  const state = activeLayer?.state || appState;
  
  // Make sure all core components have access to the state
  if (sceneInstance) {
    sceneInstance.userData.state = state;
  }
  
  if (activeLayer?.group) {
    activeLayer.group.userData.state = state;
  }
  
  if (audioInstance) {
    // Update audio state
    audioInstance.userData = {
      ...audioInstance.userData,
      state: state
    };
  }
  
  // Force more immediate intersection update on critical parameter changes
  if (state.parameterChanges && 
      (state.parameterChanges.copies || 
       state.parameterChanges.modulus || 
       state.parameterChanges.useModulus ||
       state.parameterChanges.euclidValue ||
       state.parameterChanges.useEuclid ||
       state.parameterChanges.segments ||
       state.parameterChanges.fractal ||
       state.parameterChanges.useFractal ||
       state.parameterChanges.starSkip ||
       state.parameterChanges.useStars)) {
    state.needsIntersectionUpdate = true;
    
    // Explicitly force a geometry update for Euclidean rhythm and Stars parameters
    if (state.parameterChanges.euclidValue || 
        state.parameterChanges.useEuclid ||
        state.parameterChanges.starSkip ||
        state.parameterChanges.useStars) {
      // If we have a valid baseGeo reference, update it based on current state parameters
      if (activeLayer?.baseGeo) {
        const oldGeo = activeLayer.baseGeo;
        
        // Force recreate the geometry with current parameters
        activeLayer.baseGeo = createPolygonGeometry(
          state.radius,
          Math.round(state.segments),
          state
        );
        
        // Clean up old geometry if needed
        if (oldGeo && oldGeo !== activeLayer.baseGeo) {
          // Don't dispose immediately as it might still be in use
          setTimeout(() => {
            oldGeo.dispose();
          }, 100);
        }
        
        console.log("Forced geometry update due to Euclidean rhythm or Stars parameter change");
      }
    }
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
      
      if (isCollapsed) {
        section.classList.add('collapsed');
        if (header.classList.contains('section-title')) {
          header.classList.add('collapsed');
          content.classList.add('collapsed');
        }
      }
    }
  });
}

/**
 * Load the font and initialize the application
 */
function loadFontAndInitApp() {
  // Load the Barlow font
  preloadFont({
    font: 'Barlow',
    text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/()[]{}|<>?;:\'"\\~`!@#$%^&*-+=',
    fontSize: 16,
    fontWeight: 'normal',
    onFontLoaded: initializeApplication
  });
}

/**
 * Initialize the main application
 */
function initializeApplication() {
  console.log("Initializing GeoMusica Web...");
  
  // Initialize time system first
  initializeTime();
  
  // Setup tab system
  setupHeaderTabs();
  
  // Initialize THREE.js
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  
  // Add debugging for renderer
  console.log("Renderer initialized:", renderer);
  console.log("WebGL supported:", renderer.capabilities.isWebGL2 ? "WebGL2" : "WebGL1");
  
  // Get canvas container and set renderer size
  const canvasContainer = document.getElementById('canvas');
  console.log("Canvas container:", canvasContainer);
  console.log("Canvas container dimensions:", canvasContainer.clientWidth, "x", canvasContainer.clientHeight);
  
  const containerWidth = canvasContainer.clientWidth;
  const containerHeight = canvasContainer.clientHeight;
  renderer.setSize(containerWidth, containerHeight);
  
  // Make sure the canvas has a visible style
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.background = '#111'; // Dark background to help visibility
  
  // Add renderer to DOM
  canvasContainer.appendChild(renderer.domElement);
  console.log("Canvas element added to DOM, dimensions:", renderer.domElement.width, "x", renderer.domElement.height);
  
  // Create scene
  const scene = new THREE.Scene();
  sceneInstance = scene;
  
  // Create camera with wider field of view and better positioning
  const camera = new THREE.PerspectiveCamera(60, containerWidth / containerHeight, 0.1, 10000);
  camera.position.z = 300; // Even closer camera position for better visibility
  
  // Store camera and renderer references in scene userData for layer manager to access
  scene.userData.camera = camera;
  scene.userData.renderer = renderer;
  
  console.log("Camera position:", camera.position);
  console.log("Camera field of view:", camera.fov);
  
  // Add a simple ambient light to improve visibility
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);
  
  // Setup camera resize handling
  function handleResize() {
    const width = canvasContainer.clientWidth;
    const height = canvasContainer.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener('resize', handleResize);
  
  // Create axis marker
  createAxis(scene);
  
  // Create the layer manager
  const layerManager = new LayerManager(scene);
  
  // Add reference to the scene for easy access
  scene._layerManager = layerManager;
  
  // Create the initial layer
  const initialLayer = layerManager.createLayer({
    // Initial layer settings
    visible: true,
    radius: 200, // Make it bigger to be more visible
    segments: 3,
    copies: 3
  });
  
  // Store a reference to the active layer
  const activeLayer = initialLayer;
  
  // Set initial layer properties with VERY VISIBLE settings
  initialLayer.state.copies = 3;          // Fewer copies for clarity
  initialLayer.state.segments = 3;        // Triangle for simplicity and visibility
  initialLayer.state.radius = 80;         // Larger radius to be more visible
  initialLayer.state.stepScale = 1.5;     // Larger step scale for obvious difference between copies
  initialLayer.setColor(new THREE.Color(0x00ff00)); // Bright green color
  
  // Force parameter changes to update
  initialLayer.state.parameterChanges.copies = true;
  initialLayer.state.parameterChanges.segments = true;
  initialLayer.state.parameterChanges.radius = true;
  initialLayer.state.parameterChanges.stepScale = true;
  
  // Add a debug button to force geometry recreation
  const debugButton = document.createElement('button');
  debugButton.textContent = 'Recreate Geometry';
  debugButton.style.position = 'absolute';
  debugButton.style.bottom = '50px';
  debugButton.style.left = '10px';
  debugButton.style.zIndex = '1000';
  debugButton.style.padding = '10px';
  debugButton.style.backgroundColor = '#f00';
  debugButton.style.color = '#fff';
  debugButton.style.border = 'none';
  debugButton.style.borderRadius = '5px';
  debugButton.style.cursor = 'pointer';
  
  debugButton.addEventListener('click', () => {
    const activeLayer = layerManager.getActiveLayer();
    if (activeLayer) {
      activeLayer.recreateGeometry();
      console.log("Manually recreated geometry");
    }
  });
  
  document.body.appendChild(debugButton);
  
  // Ensure visibility
  initialLayer.setVisible(true);
  
  // Debug layers after creation
  console.log(`Created initial layer: visible=${initialLayer.visible}, group.visible=${initialLayer.group.visible}`);
  console.log("Scene structure:", scene.children.map(c => c.name || 'unnamed'));
  
  // Get the active layer's state
  const state = activeLayer.state;
  
  // Update appState reference to point to the active layer's state
  window._appState = state;
  
  // Initialize DOM labels
  initLabels(renderer);
  
  // Setup audio system
  setupAudio()
    .then(csound => {
      audioInstance = csound;
      
      // Setup envelope from state
      setEnvelope(state.attack, state.decay, state.sustain, state.release)
        .then(() => {
          // Set initial brightness and volume
          setBrightness(state.brightness);
          setMasterVolume(state.volume);
          
          // Enable Csound timing system
          enableCsoundTiming(csound);
          
          // Handling audio triggers
          const handleAudioTrigger = (note) => {
            triggerAudio(note, csound);
          };
          
          // Start animation with the first layer's parameters
          animate({
            scene,
            group: activeLayer.group,
            baseGeo: activeLayer.baseGeo,
            mat: activeLayer.material,
            stats,
            csound,
            renderer,
            cam: camera,
            state,
            triggerAudioCallback: handleAudioTrigger
          });
          
          // Silent trigger function for UI previews
          const silentAudioTrigger = (note) => {
            // Don't actually make sound, just show visual feedback
            // Create a copy of the note to avoid modifying the original
            const noteCopy = { ...note };
            // Add any UI-specific processing here
            return noteCopy;
          };
          
          // Load state from localStorage if available
          loadState().then(loadedState => {
            if (loadedState) {
              applyLoadedState(loadedState, state);
              console.log("Loaded state from localStorage", state);
            }
          });
          
          // Setup auto-save
          setupAutoSave(state);
          
          // Setup UI controls and bind events
          uiReferences = setupUI(state, syncStateAcrossSystems, silentAudioTrigger);
          
          // Setup synth UI controls
          synthUIReferences = setupSynthUI(state, syncStateAcrossSystems);
          
          // Setup layers UI
          layerUIReferences = setupLayersUI(layerManager);
          
          // Setup collapsible sections
          setupCollapsibleSections();
          
          // Add state controls to UI
          addStateControlsToUI(state);
          
          // Add click handler to make the layer tab active
          const layerTabButton = document.querySelector('.tab-button[data-tab="layer"]');
          if (layerTabButton) {
            layerTabButton.click();
          }
          
          // Show the layer tab content
          const layerTab = document.getElementById('layer-tab');
          if (layerTab) {
            layerTab.style.display = 'block';
            
            // Make the layer tab button active
            const tabButtons = document.querySelectorAll('.tab-button');
            tabButtons.forEach(btn => {
              if (btn.getAttribute('data-tab') === 'layer') {
                btn.classList.add('active');
                btn.style.backgroundColor = '#555';
              } else {
                btn.classList.remove('active');
                btn.style.backgroundColor = '#333';
              }
            });
          }
          
          // Add to window for debugging
          window._layers = layerManager;
        })
        .catch(error => {
          console.error("Failed to setup envelope:", error);
        });
    })
    .catch(error => {
      console.error("Failed to initialize audio:", error);
    });
}

// Check if DOM is loaded, otherwise wait for it
if (isDOMLoaded()) {
  loadFontAndInitApp();
} else {
  document.addEventListener('DOMContentLoaded', loadFontAndInitApp);
}

// Export for debugging
window.syncStateAcrossSystems = syncStateAcrossSystems;