// src/main.js - Updated with improved DOM loading and parameter handling
import * as THREE from 'three';
import Stats from 'stats.js';

// Import modules
import { setupUI } from './ui/ui.js';
import { setupSynthUI } from './ui/synthUI.js';
import { LayerUI } from './ui/LayerUI.js';
import { 
  setupAudio, 
  triggerAudio, 
  setEnvelope, 
  setBrightness, 
  setMasterVolume,
  applySynthParameters
} from './audio/audio.js';
import { createPolygonGeometry, createAxis } from './geometry/geometry.js';
import { LayerManager } from './geometry/LayerManager.js';
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

// Import layer styles
import './styles/layers.css';

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

// Initialize layer manager
function initializeLayerSystem(scene) {
  // Create layer manager with state reference
  layerManager = new LayerManager(scene, appState);
  
  // Create layer UI container
  const layersPanel = document.createElement('div');
  document.body.appendChild(layersPanel);
  
  // Create app object with necessary methods for LayerUI
  const app = {
    state: appState,
    setActiveLayer: (layerId) => {
      if (appState.layers.byId[layerId]) {
        appState.layers.activeLayerId = layerId;
        // Update UI to reflect active layer
        if (layerUI) layerUI.render();
        // Update any other UI elements that depend on the active layer
        updateUIFromState(appState);
      }
    },
    toggleLayerVisibility: (layerId, visible) => {
      if (appState.layers.byId[layerId]) {
        appState.layers.byId[layerId].visible = visible;
        layerManager.updateLayer(appState.layers.byId[layerId]);
        // Emit event for UI updates
        appState.emit('layers:changed');
      }
    },
    addLayer: () => {
      const newLayerId = `layer-${Date.now()}`;
      const activeLayer = appState.layers.byId[appState.layers.activeLayerId] || {};
      
      // Create new layer with default values or copy from active layer
      const newLayer = {
        id: newLayerId,
        name: `Layer ${appState.layers.list.length + 1}`,
        visible: true,
        locked: false,
        zIndex: appState.layers.list.length,
        // Copy properties from active layer or use defaults
        radius: activeLayer.radius || appState.radius,
        segments: activeLayer.segments || appState.segments,
        stepScale: activeLayer.stepScale || appState.stepScale,
        angle: activeLayer.angle || appState.angle,
        copies: activeLayer.copies || appState.copies,
        color: activeLayer.color || 0xffffff,
        opacity: activeLayer.opacity !== undefined ? activeLayer.opacity : 0.8,
        wireframe: activeLayer.wireframe !== undefined ? activeLayer.wireframe : true,
        useFractal: activeLayer.useFractal !== undefined ? activeLayer.useFractal : appState.useFractal,
        fractalValue: activeLayer.fractalValue || appState.fractalValue,
        useStars: activeLayer.useStars !== undefined ? activeLayer.useStars : appState.useStars,
        starSkip: activeLayer.starSkip || appState.starSkip,
        useEuclid: activeLayer.useEuclid !== undefined ? activeLayer.useEuclid : appState.useEuclid,
        euclidValue: activeLayer.euclidValue || appState.euclidValue,
        useCuts: activeLayer.useCuts !== undefined ? activeLayer.useCuts : appState.useCuts,
        useAltScale: activeLayer.useAltScale !== undefined ? activeLayer.useAltScale : appState.useAltScale,
        altScale: activeLayer.altScale || appState.altScale,
        altStepN: activeLayer.altStepN || appState.altStepN,
        useModulus: activeLayer.useModulus !== undefined ? activeLayer.useModulus : appState.useModulus,
        modulusValue: activeLayer.modulusValue || appState.modulusValue,
        useInversion: activeLayer.useInversion !== undefined ? activeLayer.useInversion : appState.useInversion,
        inversionValue: activeLayer.inversionValue || appState.inversionValue,
        useRotation: activeLayer.useRotation !== undefined ? activeLayer.useRotation : appState.useRotation,
        rotationSpeed: activeLayer.rotationSpeed || appState.rotationSpeed,
        rotationAxis: activeLayer.rotationAxis || appState.rotationAxis,
        usePulse: activeLayer.usePulse !== undefined ? activeLayer.usePulse : appState.usePulse,
        pulseSpeed: activeLayer.pulseSpeed || appState.pulseSpeed,
        pulseMin: activeLayer.pulseMin || appState.pulseMin,
        pulseMax: activeLayer.pulseMax || appState.pulseMax,
        useNoise: activeLayer.useNoise !== undefined ? activeLayer.useNoise : appState.useNoise,
        noiseSpeed: activeLayer.noiseSpeed || appState.noiseSpeed,
        noiseAmount: activeLayer.noiseAmount || appState.noiseAmount,
        useGradient: activeLayer.useGradient !== undefined ? activeLayer.useGradient : appState.useGradient,
        gradientStart: activeLayer.gradientStart || appState.gradientStart,
        gradientEnd: activeLayer.gradientEnd || appState.gradientEnd,
        useOutline: activeLayer.useOutline !== undefined ? activeLayer.useOutline : appState.useOutline,
        outlineColor: activeLayer.outlineColor || appState.outlineColor,
        outlineWidth: activeLayer.outlineWidth || appState.outlineWidth,
        useGlow: activeLayer.useGlow !== undefined ? activeLayer.useGlow : appState.useGlow,
        glowColor: activeLayer.glowColor || appState.glowColor,
        glowIntensity: activeLayer.glowIntensity || appState.glowIntensity,
        useBloom: activeLayer.useBloom !== undefined ? activeLayer.useBloom : appState.useBloom,
        bloomIntensity: activeLayer.bloomIntensity || appState.bloomIntensity,
        bloomThreshold: activeLayer.bloomThreshold || appState.bloomThreshold,
        bloomRadius: activeLayer.bloomRadius || appState.bloomRadius
      };
      
      // Add to state
      appState.layers.byId[newLayerId] = newLayer;
      appState.layers.list.push(newLayerId);
      appState.layers.activeLayerId = newLayerId;
      
      // Create layer in manager
      layerManager.createLayer(newLayer);
      
      // Emit event for UI updates
      appState.emit('layers:changed');
      
      // Update UI
      updateUIFromState(appState);
      
      return newLayerId;
    },
    removeLayer: (layerId) => {
      if (!appState.layers.byId[layerId]) return false;
      
      // Remove from state
      delete appState.layers.byId[layerId];
      appState.layers.list = appState.layers.list.filter(id => id !== layerId);
      
      // If we deleted the active layer, set a new active layer
      if (appState.layers.activeLayerId === layerId) {
        appState.layers.activeLayerId = appState.layers.list[appState.layers.list.length - 1] || null;
      }
      
      // Remove from manager
      layerManager.removeLayer(layerId);
      
      // Emit event for UI updates
      appState.emit('layers:changed');
      
      // Update UI
      updateUIFromState(appState);
      
      return true;
    },
    reorderLayers: (newOrder) => {
      // Validate the new order contains all existing layer IDs
      const validOrder = newOrder.filter(id => appState.layers.byId[id]);
      
      // If the new order is missing some layers, keep them at the end
      const missingLayers = appState.layers.list.filter(id => !validOrder.includes(id));
      const finalOrder = [...validOrder, ...missingLayers];
      
      // Update state
      appState.layers.list = finalOrder;
      
      // Update z-index for each layer
      finalOrder.forEach((layerId, index) => {
        if (appState.layers.byId[layerId]) {
          appState.layers.byId[layerId].zIndex = index;
          // Update layer in manager if needed
          if (layerManager) {
            layerManager.updateLayer({
              ...appState.layers.byId[layerId],
              zIndex: index
            });
          }
        }
      });
      
      // Emit event for UI updates
      appState.emit('layers:changed');
    }
  };
  
  // Initialize layer UI
  layerUI = new LayerUI(layersPanel, app);
  
  // Add default layer if none exists
  if (appState.layers.list.length === 0) {
    console.log('No layers found, creating default layer...');
    app.addLayer();
  } else {
    console.log(`Initializing ${appState.layers.list.length} existing layers...`);
    // Initialize existing layers in the manager
    appState.layers.list.forEach((layerId, index) => {
      const layer = appState.layers.byId[layerId];
      if (layer) {
        console.log(`Initializing layer ${index + 1}:`, { id: layerId, name: layer.name });
        layerManager.createLayer(layer);
      }
    });
  }
  
  return { layerManager, layerUI };
}

// Make state globally accessible for debugging
window._appState = appState;

// Store UI references globally
let uiReferences = null;
let synthUIReferences = null;
let layerUI = null;
let layerManager = null;

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
       appState.parameterChanges.useModulus ||
       appState.parameterChanges.euclidValue ||
       appState.parameterChanges.useEuclid ||
       appState.parameterChanges.segments ||
       appState.parameterChanges.fractal ||
       appState.parameterChanges.useFractal ||
       appState.parameterChanges.starSkip ||
       appState.parameterChanges.useStars)) {
    appState.needsIntersectionUpdate = true;
    
    // Explicitly force a geometry update for Euclidean rhythm and Stars parameters
    if (appState.parameterChanges.euclidValue || 
        appState.parameterChanges.useEuclid ||
        appState.parameterChanges.starSkip ||
        appState.parameterChanges.useStars) {
      // If we have a valid baseGeo reference, update it based on current state parameters
      if (appState.baseGeo) {
        const oldGeo = appState.baseGeo;
        
        // Force recreate the geometry with current parameters
        appState.baseGeo = createPolygonGeometry(
          appState.radius,
          Math.round(appState.segments),
          appState
        );
        
        // Clean up old geometry if needed
        if (oldGeo && oldGeo !== appState.baseGeo) {
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
async function initializeApplication() {
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
      return; // Exit early if audio failed to initialize
    }

    // Ensure appState is properly initialized
    if (!appState) {
      console.error('Application state is not initialized');
      return;
    }

    // Store state reference in audio instance
    audioInstance.userData = { 
      ...audioInstance.userData, 
      state: appState 
    };

    // Initialize time module with Csound instance if available
    if (audioInstance.audioContext) {
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

    try {
      // Setup synthesizer UI controls after audio is initialized
      synthUIReferences = setupSynthUI(appState, audioInstance);
      
      // If we have loaded state, update synth UI and audio engine
      if (savedState) {
        console.log("Applying loaded state to UI elements:", savedState);
        
        // Update both UI sets with all loaded values including equal temperament settings
        updateUIFromState(appState, { ...uiReferences, ...synthUIReferences });
        
        // Apply synth parameters directly with the new approach
        const synthParams = {
          attack: appState.attack ?? 0.1,
          decay: appState.decay ?? 0.3,
          sustain: appState.sustain ?? 0.7,
          release: appState.release ?? 0.5,
          brightness: appState.brightness ?? 0.5,
          volume: appState.volume ?? 0.7
        };
        
        applySynthParameters(synthParams).then(result => {
          console.log("Synth parameters applied on load:", result);
        }).catch(error => {
          console.error("Error applying synth parameters:", error);
        });
      } else {
        // Set initial ADSR values in the audio engine from default state
        applySynthParameters({
          attack: appState.attack ?? 0.1,
          decay: appState.decay ?? 0.3,
          sustain: appState.sustain ?? 0.7,
          release: appState.release ?? 0.5,
          brightness: appState.brightness ?? 0.5,
          volume: appState.volume ?? 0.7
        });
      }
    } catch (error) {
      console.error("Error initializing synth UI:", error);
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
    
    // Initialize layer system
    const { layerManager: lm, layerUI: lui } = initializeLayerSystem(scene);
    layerManager = lm;
    layerUI = lui;
    
    // Store the appState in the scene's userData for access in other modules
    scene.userData.state = appState;
    
    // Create camera with better default settings
    const cam = new THREE.PerspectiveCamera(
      60, // Wider field of view for better visibility
      window.innerWidth / window.innerHeight, // Full width aspect ratio
      1,     // Increased near plane for better precision
      100000 // Increased far plane for large scenes
    );
    
    // Position camera to look at the scene from an angle
    cam.position.set(1000, 1000, 1000);
    cam.lookAt(0, 0, 0);
    cam.up.set(0, 1, 0); // Ensure up is Y-up
    
    // Add camera helper for debugging
    const cameraHelper = new THREE.CameraHelper(cam);
    cameraHelper.visible = true; // Make sure it's visible
    scene.add(cameraHelper);
    
    // Add coordinate axes for reference (smaller size for better visibility)
    const mainAxes = new THREE.AxesHelper(500);
    mainAxes.name = 'mainAxes';
    scene.add(mainAxes);
    
    // Add a main grid for reference (larger size for better visibility)
    const mainGrid = new THREE.GridHelper(5000, 50, 0x888888, 0x444444);
    mainGrid.name = 'mainGrid';
    scene.add(mainGrid);
    
    // Add a point light to illuminate the scene
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1).normalize();
    scene.add(light);
    scene.add(new THREE.AmbientLight(0x404040)); // Soft white light
    
    // Add a point at the origin for reference
    const originPoint = new THREE.Mesh(
      new THREE.SphereGeometry(10, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    originPoint.name = 'originPoint';
    scene.add(originPoint);

    // Create renderer with robust settings
    console.log('Creating WebGL renderer...');
    
    // Create a new canvas element
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block'; // Ensure proper display
    
    // Set up WebGL context attributes
    const contextAttributes = {
      antialias: true,
      alpha: false, // Opaque background
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true, // Keep drawing buffer for debugging
      premultipliedAlpha: false, // Ensure proper transparency handling
      failIfMajorPerformanceCaveat: false
    };
    
    // Create WebGL renderer with better defaults
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'highp',
      stencil: false,
      depth: true,
      logarithmicDepthBuffer: true, // Helps with z-fighting at large distances
      canvas: canvas,
      context: canvas.getContext('webgl2', contextAttributes) || 
               canvas.getContext('webgl', contextAttributes) ||
               canvas.getContext('experimental-webgl', contextAttributes),
      ...contextAttributes
    });
    
    // Verify WebGL context was created
    if (!renderer.getContext()) {
      console.error('WebGL is not supported in this browser');
      // Show error to user
      const errorDiv = document.createElement('div');
      errorDiv.style.color = 'red';
      errorDiv.style.padding = '20px';
      errorDiv.style.fontFamily = 'Arial, sans-serif';
      errorDiv.innerHTML = `
        <h2>WebGL Not Supported</h2>
        <p>Your browser or device does not support WebGL, which is required for this application.</p>
        <p>Please try using a modern browser like Chrome, Firefox, or Edge.</p>
      `;
      document.body.appendChild(errorDiv);
      return;
    }
    
    console.log('WebGL Renderer created successfully');
    console.log('WebGL Context:', renderer.getContext());
    
    // Configure renderer
    renderer.autoClear = false; // Don't clear the canvas automatically
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 1); // Black background
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Verify and configure WebGL context
    const webglContext = renderer.getContext();
    if (!webglContext) {
      console.error('WebGL is not available in your browser!');
      const warning = document.createElement('div');
      warning.style.position = 'fixed';
      warning.style.top = '0';
      warning.style.left = '0';
      warning.style.right = '0';
      warning.style.padding = '20px';
      warning.style.background = 'red';
      warning.style.color = 'white';
      warning.style.zIndex = '10000';
      warning.style.fontFamily = 'sans-serif';
      warning.style.textAlign = 'center';
      warning.textContent = 'WebGL is not available in your browser. Please enable WebGL or use a compatible browser.';
      document.body.appendChild(warning);
      return; // Stop initialization if WebGL is not available
    }
    
    console.log('WebGL context created successfully');
    
    // Configure renderer
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth * 0.5, window.innerHeight);
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = true;
    renderer.autoClearColor = true;
    renderer.autoClearDepth = true;
    renderer.autoClearStencil = false;
    
    // Disable shadow maps if not needed
    renderer.shadowMap.enabled = false;
    
    // Log the initial scene setup
    console.log('Initial scene setup complete');
    console.log('Scene children:', scene.children.map(c => ({
      name: c.name || 'unnamed',
      type: c.type,
      position: c.position ? c.position.toArray() : 'no position'
    })));
    
    // Force a render to ensure everything is visible
    renderer.render(scene, cam);
    console.log('Test objects added to scene');
    
    // Log camera settings for debugging
    console.log('Camera initialized:', {
      fov: cam.fov,
      aspect: cam.aspect,
      near: cam.near,
      far: cam.far,
      position: cam.position,
      rotation: cam.rotation
    });
    
    // Log WebGL capabilities
    console.log('WebGL Renderer Capabilities:', {
      maxTextures: renderer.capabilities.maxTextures,
      maxTextureSize: renderer.capabilities.maxTextureSize,
      maxCubemapSize: renderer.capabilities.maxCubemapSize,
      maxVertexTextures: renderer.capabilities.maxVertexTextures,
      maxTextureUnits: renderer.capabilities.maxTextures,
      precision: renderer.capabilities.precision,
      logarithmicDepthBuffer: renderer.capabilities.logarithmicDepthBuffer
    });
    
    // Error handling
    webglContext.getExtension('WEBGL_lose_context');
    
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      console.error('WebGL context lost:', event);
      event.preventDefault();
    }, false);
    
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored');
    }, false);
    
    // Add debug info to renderer
    console.log('WebGL Renderer created:', {
      width: renderer.domElement.width,
      height: renderer.domElement.height,
      pixelRatio: renderer.getPixelRatio(),
      context: renderer.getContext().getContextAttributes()
    });
    
    // Debug: Check if DOM is ready
    console.log('DOM ready state:', document.readyState);
    
    // Function to add canvas to DOM
    function addCanvasToDOM() {
      const canvasContainer = document.getElementById('canvas');
      
      if (!canvasContainer) {
        console.error('Canvas container not found in DOM');
        // Create a fallback container
        const fallbackContainer = document.createElement('div');
        fallbackContainer.id = 'canvas-fallback';
        document.body.appendChild(fallbackContainer);
        fallbackContainer.appendChild(renderer.domElement);
        
        // Apply fallback styles
        document.body.style.margin = '0';
        document.body.style.padding = '0';
        document.body.style.overflow = 'hidden';
        fallbackContainer.style.position = 'fixed';
        fallbackContainer.style.top = '0';
        fallbackContainer.style.right = '0';
        fallbackContainer.style.width = '60%';
        fallbackContainer.style.height = '100vh';
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        
        console.warn('Created fallback canvas container');
        return;
      }
      
      // Clear any existing canvas
      while (canvasContainer.firstChild) {
        canvasContainer.removeChild(canvasContainer.firstChild);
      }
      
      // Add canvas to container
      canvasContainer.appendChild(renderer.domElement);
      
      // Log container info
      console.log('Canvas container dimensions:', {
        clientWidth: canvasContainer.clientWidth,
        clientHeight: canvasContainer.clientHeight,
        offsetWidth: canvasContainer.offsetWidth,
        offsetHeight: canvasContainer.offsetHeight,
        computedStyle: {
          display: window.getComputedStyle(canvasContainer).display,
          position: window.getComputedStyle(canvasContainer).position,
          visibility: window.getComputedStyle(canvasContainer).visibility
        }
      });
      
      // Force a reflow and repaint
      setTimeout(() => {
        console.log('Canvas dimensions after timeout:', {
          width: renderer.domElement.width,
          height: renderer.domElement.height,
          clientWidth: renderer.domElement.clientWidth,
          clientHeight: renderer.domElement.clientHeight,
          style: renderer.domElement.style.cssText
        });
        
        // Force renderer resize
        const width = canvasContainer.clientWidth;
        const height = canvasContainer.clientHeight;
        renderer.setSize(width, height, false);
        console.log('Renderer resized to:', width, 'x', height);
      }, 0);
    }
    
    // Add canvas to DOM
    addCanvasToDOM();
    
    // Handle window resize
    window.addEventListener('resize', () => {
      const container = document.getElementById('canvas') || document.querySelector('#canvas-fallback');
      if (container) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        console.log('Window resized, renderer size:', width, 'x', height);
      }
    });
    
    // Add debug style to canvas
    renderer.domElement.style.border = '1px solid red';
    
    // Perform a test render
    function testRender() {
      console.log('Performing test render...');
      
      // Create a test scene
      const testScene = new THREE.Scene();
      testScene.background = new THREE.Color(0x112233);
      
      // Add a test cube
      const geometry = new THREE.BoxGeometry(100, 100, 100);
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00,
        wireframe: false 
      });
      const cube = new THREE.Mesh(geometry, material);
      testScene.add(cube);
      
      // Set up camera with better default position
      const cam = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
      
      // Position camera to see the origin
      cam.position.set(0, 0, 800);
      cam.lookAt(0, 0, 0);
      
      // Add camera helper for debugging
      const cameraHelper = new THREE.CameraHelper(cam);
      scene.add(cameraHelper);
      
      // Add coordinate axes at origin
      const axesHelper = new THREE.AxesHelper(500);
      scene.add(axesHelper);
      
      // Add grid helper
      const size = 1000;
      const divisions = 20;
      const gridHelper = new THREE.GridHelper(size, divisions, 0x444444, 0x222222);
      gridHelper.position.y = -50;
      scene.add(gridHelper);
      
      console.log('Camera initialized at:', cam.position);
      
      // Render test scene
      renderer.render(testScene, cam);
      
      // Check if anything was rendered
      const gl = renderer.getContext();
      const pixels = new Uint8Array(4);
      gl.readPixels(
        Math.floor(renderer.domElement.width / 2),
        Math.floor(renderer.domElement.height / 2),
        1, 1,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels
      );
      console.log('Test render center pixel (RGBA):', Array.from(pixels));
    }
    
    // Force renderer resize using the canvas element directly
    const rendererCanvas = renderer.domElement;
    const width = rendererCanvas.clientWidth || window.innerWidth * 0.5;
    const height = rendererCanvas.clientHeight || window.innerHeight;
    
    // Only update if dimensions are valid
    if (width > 0 && height > 0) {
      renderer.setSize(width, height, false);
      console.log('Renderer resized to:', width, 'x', height);
      
      // Update camera projection
      if (cam) {
        cam.aspect = width / height;
        cam.updateProjectionMatrix();
      }
    } else {
      console.warn('Invalid canvas dimensions:', { width, height });
    }
    
    // Update active layer if it exists
    if (layerManager && appState.layers && appState.layers.activeLayerId) {
      const activeLayer = appState.layers.byId[appState.layers.activeLayerId];
      if (activeLayer) {
        layerManager.updateLayer(activeLayer);
      }
    }
    
    // Group and axis are already created and initialized above

    // Setup marker geometry - create a reusable geometry for markers
    const markerGeom = new THREE.SphereGeometry(8, 8, 8);
    
    // Store it in scene's userData for reuse
    scene.userData.markerGeometry = markerGeom;

    // Handle window resize
    window.addEventListener('resize', () => {
      cam.aspect = (window.innerWidth * 0.5) / window.innerHeight; // Updated to account for 50% UI width
      cam.updateProjectionMatrix();
      renderer.setSize(window.innerWidth * 0.5, window.innerHeight); // Updated to account for 50% UI width
      
      // Update layer UI positions if needed
      if (layerUI) {
        layerUI.render();
      }
      
      // Update DOM label positions when window resizes
      updateLabelPositions(cam, renderer);
    });

    // Add debug info panel
    const debugInfo = document.createElement('div');
    debugInfo.id = 'debug-info';
    debugInfo.style.position = 'fixed';
    debugInfo.style.top = '10px';
    debugInfo.style.right = '10px';
    debugInfo.style.color = '#0f0';
    debugInfo.style.background = 'rgba(0,0,0,0.7)';
    debugInfo.style.padding = '10px';
    debugInfo.style.borderRadius = '5px';
    debugInfo.style.fontFamily = 'monospace';
    debugInfo.style.fontSize = '12px';
    debugInfo.style.zIndex = '1000';
    document.body.appendChild(debugInfo);
    
    // Function to update debug info
    function updateDebugInfo() {
      if (!renderer) return;
      
      const gl = renderer.getContext();
      const info = [
        '=== DEBUG INFO ===',
        `Renderer: ${renderer.info.render.type}`,
        `Draw Calls: ${renderer.info.render.calls}`,
        `Triangles: ${renderer.info.render.triangles}`,
        `Points: ${renderer.info.render.points}`,
        `Lines: ${renderer.info.render.lines}`,
        `Textures: ${renderer.info.memory.textures}`,
        `Geometries: ${renderer.info.memory.geometries}`,
        `Shaders: ${renderer.programs ? renderer.programs.length : 0}`,
        `Scene Children: ${scene.children.length}`,
        `Camera Pos: [${cam.position.x.toFixed(1)}, ${cam.position.y.toFixed(1)}, ${cam.position.z.toFixed(1)}]`,
        `FOV: ${cam.fov.toFixed(1)}`,
        `Aspect: ${cam.aspect.toFixed(2)}`,
        `Near/Far: ${cam.near}/${cam.far}`,
        '=== WEBGL CONTEXT ===',
        `Vendor: ${gl.getParameter(gl.VENDOR)}`,
        `Renderer: ${gl.getParameter(gl.RENDERER)}`,
        `WebGL Version: ${gl.getParameter(gl.VERSION)}`,
        `GLSL Version: ${gl.getParameter(gl.SHADING_LANGUAGE_VERSION)}`,
        `Max Texture Size: ${gl.getParameter(gl.MAX_TEXTURE_SIZE)}`,
        `Max Render Buffer Size: ${gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)}`
      ];
      
      debugInfo.innerHTML = info.join('<br>');
      
      // Check for WebGL errors
      const error = gl.getError();
      if (error !== gl.NO_ERROR) {
        debugInfo.innerHTML += `<br><span style="color:red">WebGL Error: ${getGLErrorString(gl, error)}</span>`;
      }
    }
    
    // Update debug info periodically
    setInterval(updateDebugInfo, 1000);
    
    // Add a test object to verify rendering
    function addTestObject() {
      console.log('Adding test object to scene...');
      
      // Create a simple colored cube
      const geometry = new THREE.BoxGeometry(100, 100, 100);
      const material = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: false,
        transparent: true,
        opacity: 0.8
      });
      const cube = new THREE.Mesh(geometry, material);
      cube.name = 'testCube';
      cube.position.set(0, 0, 0);
      
      // Add to scene
      scene.add(cube);
      console.log('Test cube added to scene:', cube);
      
      // Force a render
      renderer.render(scene, cam);
      console.log('Test render completed');
      
      // Check WebGL context
      const gl = renderer.getContext();
      console.log('WebGL context status:', gl ? 'Active' : 'Inactive');
      if (gl) {
        console.log('WebGL context attributes:', gl.getContextAttributes());
      }
    }
    
    // Add test object after a short delay
    setTimeout(addTestObject, 1000);
    
    // Add an info message
    const infoEl = document.createElement('div');
    infoEl.id = 'status-message';
    infoEl.style.position = 'absolute';
    infoEl.style.bottom = '10px';
    infoEl.style.left = '10px';
    infoEl.style.color = 'white';
    infoEl.style.background = 'rgba(0,0,0,0.7)';
    infoEl.style.padding = '10px';
    infoEl.style.borderRadius = '5px';
    infoEl.style.fontFamily = 'Arial, sans-serif';
    infoEl.style.zIndex = '1000';
    infoEl.innerHTML = `
      <div>GeoMusica - Click anywhere to start audio</div>
      <div id="render-status" style="color: #ff0; margin-top: 5px;">Initializing renderer...</div>
    `;
    document.body.appendChild(infoEl);
    
    // Update status message
    const renderStatus = document.getElementById('render-status');
    if (renderer) {
      renderStatus.textContent = 'Renderer ready';
      renderStatus.style.color = '#0f0';
    }
    
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
    
    // Debug render function
    const debugRender = () => {
      try {
        console.log('=== DEBUG RENDER ===');
        console.log('Camera:', {
          position: cam.position.toArray(),
          rotation: cam.rotation.toArray(),
          matrixWorld: cam.matrixWorld.toArray()
        });
        
        console.log('Scene children:', scene.children.length);
        scene.children.forEach((child, i) => {
          console.log(`  Child ${i}:`, child.type, 'visible:', child.visible, 'position:', child.position.toArray());
        });
        
        // Force render
        console.log('Rendering scene...');
        renderer.render(scene, cam);
        
        // Check WebGL context
        const gl = renderer.getContext();
        if (!gl) {
          console.error('WebGL context is not available!');
          return;
        }
        
        // Check for WebGL errors
        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
          console.error('WebGL Error:', getGLErrorString(gl, error));
        }
        
        // Read pixel data
        const pixels = new Uint8Array(4);
        gl.readPixels(
          Math.floor(renderer.domElement.width / 2), 
          Math.floor(renderer.domElement.height / 2), 
          1, 1,
          gl.RGBA, 
          gl.UNSIGNED_BYTE, 
          pixels
        );
        console.log('Center pixel (RGBA):', Array.from(pixels));
        
      } catch (error) {
        console.error('Error in debugRender:', error);
      }
    };
    
    // Helper function to get WebGL error string
    function getGLErrorString(gl, error) {
      const errors = {
        [gl.NO_ERROR]: 'NO_ERROR',
        [gl.INVALID_ENUM]: 'INVALID_ENUM',
        [gl.INVALID_VALUE]: 'INVALID_VALUE',
        [gl.INVALID_OPERATION]: 'INVALID_OPERATION',
        [gl.OUT_OF_MEMORY]: 'OUT_OF_MEMORY',
        [gl.CONTEXT_LOST_WEBGL]: 'CONTEXT_LOST_WEBGL'
      };
      return errors[error] || `Unknown error (${error})`;
    }
    
    // Initial debug render
    debugRender();
    
    // Store the appState in the scene's userData for access in other modules
    scene.userData.state = appState;
    
    // Update camera aspect ratio
    cam.aspect = (window.innerWidth * 0.5) / window.innerHeight; // Updated to account for 50% UI width
    cam.updateProjectionMatrix();
    
    // Store camera and renderer in scene's userData for label management
    scene.userData.camera = cam;
    scene.userData.renderer = renderer;
    
    // Create default material
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffcc });
    
    // Create a group for the geometry
    const group = new THREE.Group();
    scene.add(group);
    
    // Set group instance and user data
    groupInstance = group;
    group.userData.state = appState;
    
    // Create axis helper
    createAxis(scene);
    
    // Create initial polygon geometry with default values
    const defaultRadius = 100;
    const defaultSegments = appState.segments || 5;
    const baseGeo = createPolygonGeometry(defaultRadius, defaultSegments, appState);
    
    // Silent audio trigger function - does nothing but required for animation
    const silentAudioTrigger = (note) => note;
    
    // Start animation loop without audio
    animate({
      scene,
      group,
      baseGeo,
      mat,
      stats: new Stats(),
      csound: null,
      renderer,
      cam,
      state: appState,
      triggerAudioCallback: silentAudioTrigger,
      layerManager: null // We'll set this up later if needed
    });

    // Initialize polygon geometry without audio
    // Ensure we have default values for required properties
    if (!appState) {
      console.error('appState is not defined');
      return;
    }

    // Initialize required state properties with defaults if they don't exist
    const defaults = {
      radius: 100,
      segments: 5,
      // Add other required state properties here
    };

    // Set defaults for any missing required properties
    Object.entries(defaults).forEach(([key, defaultValue]) => {
      if (appState[key] === undefined) {
        appState[key] = defaultValue;
        // Call setter if it exists
        const setter = appState[`set${key.charAt(0).toUpperCase() + key.slice(1)}`];
        if (typeof setter === 'function') {
          setter.call(appState, defaultValue);
        }
      }
    });

    // Handle window resize with label updates
    window.addEventListener('resize', () => {
      cam.aspect = (window.innerWidth * 0.5) / window.innerHeight; // Updated to account for 50% UI width
      cam.updateProjectionMatrix();
      renderer.setSize(window.innerWidth * 0.5, window.innerHeight); // Updated to account for 50% UI width
      
      // Update DOM label positions when window resizes
      updateLabelPositions(cam, renderer);
    });

    // Still setup the synth UI even without audio
    synthUIReferences = setupSynthUI(appState, null);
    
    // If we have loaded state, update synth UI
    if (savedState) {
      // Update both UI sets with all loaded values including scale mod parameters
      updateUIFromState(appState, { ...uiReferences, ...synthUIReferences });
    }

    // Create and configure stats
    const stats = new Stats();
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
    document.body.appendChild(stats.dom);
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

// Helper function to safely wrap state setters
function wrapSetter(prop, setter) {
  return function(value) {
    const result = setter.call(appState, value);
    syncStateAcrossSystems();
    return result;
  };
}

// After saving all the original state setters, wrap them to call syncStateAcrossSystems
// This ensures state is always consistent across all systems

// Store original setters to wrap them
const originalSetters = {};

// Wrap each setter if it exists
if (appState) {
  [
    'setCopies', 'setModulusValue', 'setUseModulus', 'setAltScale',
    'setUseAltScale', 'setAltStepN', 'setSegments', 'setFractalValue',
    'setUseFractal', 'setEuclidValue', 'setUseEuclid', 'setStarSkip',
    'setUseStars', 'setUseCuts'
  ].forEach(prop => {
    if (typeof appState[prop] === 'function') {
      originalSetters[prop] = appState[prop];
      appState[prop] = wrapSetter(prop, appState[prop]);
    }
  });
}

// Special handling for setSegments to ensure proper rounding
if (originalSetters.setSegments) {
  const originalSetSegments = originalSetters.setSegments;
  appState.setSegments = function(value) {
    // Ensure value is properly rounded to an integer
    const roundedValue = Math.round(Number(value));
    return originalSetSegments.call(this, roundedValue);
  };
}

// Start the application initialization process
if (isDOMLoaded()) {
  loadFontAndInitApp();
} else {
  document.addEventListener('DOMContentLoaded', loadFontAndInitApp);
}