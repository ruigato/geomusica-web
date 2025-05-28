// src/main.js - Updated with improved DOM loading and parameter handling
import * as THREE from 'three';
import Stats from 'stats.js';

// Debug flag to control the visibility of debug buttons
const DEBUG_BUTTONS = false; // Set to false to hide debug tools
const DEBUG_LOGGING = false;

// Expose debug flag globally
window.DEBUG_BUTTONS = DEBUG_BUTTONS;

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
  saveState,
  applyLoadedState, 
  setupAutoSave, 
  exportStateToFile, 
  importStateFromFile, 
  updateUIFromState,
  updateAudioEngineFromState,
  applyPropertiesToState
} from './state/statePersistence.js';
import { initializeTime, resetTime, getCurrentTime, setTimingMode } from './time/time.js';
import { setupHeaderTabs } from './ui/headerTabs.js';
import { LayerManager } from './state/LayerManager.js';
import { setupLayersUI, updateLayersUI } from './ui/layersUI.js';
// Import the global state manager
import { GlobalStateManager } from './state/GlobalStateManager.js';
import { initializeUIInputs } from './ui/uiUtils.js';
// Import the layer link manager
import { layerLinkManager } from './geometry/layerLink.js';

// Initialize stats for performance monitoring
const stats = new Stats();
stats.showPanel(0);
document.body.appendChild(stats.dom);

// Position the stats panel in the top right corner
stats.dom.style.position = 'absolute';
stats.dom.style.left = 'auto';
stats.dom.style.right = '10px';
stats.dom.style.top = '10px';

// Store UI references globally
let uiReferences = null;
let synthUIReferences = null;
let layerUIReferences = null;
let globalUIReferences = null;

// References to core components
let audioInstance = null;
let sceneInstance = null;
let layerManager = null;
let appState = null;
let globalState = null;

// Store Csound instance globally for consistent access
let csoundInstance = null;

/**
 * Ensure state is synchronized across all systems
 * Call this whenever the state changes in important ways
 * @param {boolean} isLayerSwitch - Set to true when called from setActiveLayer to prevent geometry recreation
 */
function syncStateAcrossSystems(isLayerSwitch = false) {
  // FIXED: Add debouncing to prevent race conditions during rapid operations
  if (syncStateAcrossSystems._debounceTimer) {
    clearTimeout(syncStateAcrossSystems._debounceTimer);
  }
  
  // Use immediate execution for layer switches, debounce for other changes
  if (isLayerSwitch) {
    performStateSync(isLayerSwitch);
  } else {
    syncStateAcrossSystems._debounceTimer = setTimeout(() => {
      performStateSync(isLayerSwitch);
    }, 10); // Short debounce to prevent rapid successive calls
  }
}

/**
 * Internal function that performs the actual state synchronization
 * @param {boolean} isLayerSwitch - Whether this is a layer switch operation
 */
function performStateSync(isLayerSwitch = false) {
  try {
    // FIXED: Use a more robust approach to get the active state
    let state = null;
    let activeLayerId = null;
    
    // First, try to get state from layer manager if available
    if (layerManager && typeof layerManager.getActiveLayer === 'function') {
      const activeLayer = layerManager.getActiveLayer();
      if (activeLayer && activeLayer.state) {
        state = activeLayer.state;
        activeLayerId = activeLayer.id;
      }
    }
    
    // Fallback to window.getActiveState if layer manager approach fails
    if (!state && typeof window.getActiveState === 'function') {
      state = window.getActiveState();
      if (state && state.layerId !== undefined) {
        activeLayerId = state.layerId;
      }
    }
    
    // Final fallback to appState
    if (!state) {
      
      state = appState;
      activeLayerId = 'fallback';
    }
    
    
    
    // FIXED: Validate state before proceeding
    if (!state) {
      console.error('[STATE SYNC] No valid state found, aborting synchronization');
      return;
    }
    
    // Make sure all core components have access to the state
    if (sceneInstance) {
      // Store state ID instead of direct reference to prevent circular references
      sceneInstance.userData.stateId = activeLayerId;
      sceneInstance.userData.globalState = globalState;
    }
    
    // FIXED: More robust active layer handling
    const activeLayer = layerManager?.getActiveLayer();
    if (activeLayer?.group) {
      // Only update if the layer is actually active and valid
      if (activeLayer.id === activeLayerId || activeLayerId === 'fallback') {
        // Update stateId instead of setting state directly to avoid circular references
        activeLayer.group.userData.stateId = activeLayerId;
        activeLayer.group.userData.globalState = globalState;
        
        // Verify the active layer's state is correctly set
        if (DEBUG_BUTTONS) {
          
        }
      }
    }
    
    if (audioInstance) {
      // Update audio state with validation
      if (!audioInstance.userData) {
        audioInstance.userData = {};
      }
      // Use stateId instead of direct state reference
      audioInstance.userData.stateId = activeLayerId;
      audioInstance.userData.globalState = globalState;
    }
    
    // FIXED: More robust UI synchronization
    if (state && !isLayerSwitch) {
      // Only update UI if this is not a layer switch to prevent conflicts
      updateUIFromActiveState(state);
    }
    
    // Update global UI with global state
    if (globalUIReferences && globalState) {
      updateGlobalUI(globalState);
    }
    
    // FIXED: Better handling of parameter changes during layer switches
    if (isLayerSwitch && state && typeof state.resetParameterChanges === 'function') {
      // Reset parameter changes to prevent unnecessary geometry recreation during layer switch
      state.resetParameterChanges();
      
      // FIXED: Also prevent any geometry updates during layer switches
      // Set a flag to indicate we just switched layers and don't need geometry updates
      if (activeLayer) {
        activeLayer._justSwitchedTo = true;
        
        // Clear the flag after a short delay to allow normal updates after the switch
        setTimeout(() => {
          activeLayer._justSwitchedTo = false;
        }, 100); // 100ms grace period
      }
    }
    
    // FIXED: Improved geometry update logic - skip if we're switching layers
    if (!isLayerSwitch && state && state.parameterChanges) {
      handleGeometryUpdates(state, activeLayer);
    } else if (isLayerSwitch) {
      // Skip geometry updates completely during layer switches
    }
    
  } catch (error) {
    console.error('[STATE SYNC] Error during state synchronization:', error);
    // Don't rethrow to prevent cascading failures
  }
}

/**
 * Update UI elements to reflect the active state
 * @param {Object} state - Active state object
 */
function updateUIFromActiveState(state) {
  try {
    if (uiReferences && state) {
      
      // Add specific UI update logic here if needed
    }
  } catch (error) {
    console.error('[STATE SYNC] Error updating UI from active state:', error);
  }
}

/**
 * Update global UI elements
 * @param {Object} globalState - Global state object
 */
function updateGlobalUI(globalState) {
  try {
    
    
    // Update BPM display with null checks
    const bpmValue = document.getElementById('bpmValue');
    if (bpmValue) bpmValue.textContent = globalState.bpm;
    
    const bpmRange = document.getElementById('bpmRange');
    if (bpmRange) bpmRange.value = globalState.bpm;
    
    const bpmNumber = document.getElementById('bpmNumber');
    if (bpmNumber) bpmNumber.value = globalState.bpm;
  } catch (error) {
    console.error('[STATE SYNC] Error updating global UI:', error);
  }
}

/**
 * Handle geometry updates based on parameter changes
 * @param {Object} state - State object with parameter changes
 * @param {Object} activeLayer - Active layer object
 */
function handleGeometryUpdates(state, activeLayer) {
  try {
    // Force more immediate intersection update on critical parameter changes
    const criticalChanges = [
      'copies', 'modulus', 'useModulus', 'euclidValue', 'useEuclid',
      'segments', 'fractal', 'useFractal', 'starSkip', 'useStars'
    ];
    
    const hasCriticalChanges = criticalChanges.some(param => state.parameterChanges[param]);
    
    if (hasCriticalChanges) {
      // DEPRECATED: needsIntersectionUpdate removed
  // state.needsIntersectionUpdate = true;
      
      // Explicitly force a geometry update for Euclidean rhythm and Stars parameters
      const forceGeometryUpdate = ['euclidValue', 'useEuclid', 'starSkip', 'useStars'];
      const needsGeometryUpdate = forceGeometryUpdate.some(param => state.parameterChanges[param]);
      
      if (needsGeometryUpdate && activeLayer?.baseGeo) {
        updateLayerGeometry(activeLayer, state);
      }
    }
  } catch (error) {
    console.error('[STATE SYNC] Error handling geometry updates:', error);
  }
}

/**
 * Update layer geometry safely
 * @param {Object} activeLayer - Active layer object
 * @param {Object} state - State object
 */
function updateLayerGeometry(activeLayer, state) {
  try {
    const oldGeo = activeLayer.baseGeo;
    
    // Force recreate the geometry with current parameters
    activeLayer.baseGeo = createPolygonGeometry(
      state.radius,
      Math.round(state.segments),
      state
    );
    
    // Clean up old geometry safely
    if (oldGeo && oldGeo !== activeLayer.baseGeo && oldGeo.dispose) {
      // Dispose after a short delay to prevent rendering issues
      setTimeout(() => {
        try {
          oldGeo.dispose();
        } catch (disposeError) {
          
        }
      }, 100);
    }
    
    
  } catch (error) {
    console.error('[STATE SYNC] Error updating layer geometry:', error);
  }
}

// Make syncStateAcrossSystems available globally
window.syncStateAcrossSystems = syncStateAcrossSystems;

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
  exportButton.className = 'state-control-button export';
  
  // Add export click handler
  exportButton.addEventListener('click', () => {
    exportStateToFile(state);
  });
  
  // Create import button and file input
  const importButton = document.createElement('button');
  importButton.textContent = 'Import Settings';
  importButton.className = 'state-control-button import';
  
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
  
  // Create "Make Default" button
  const makeDefaultButton = document.createElement('button');
  makeDefaultButton.textContent = 'Make Default';
  makeDefaultButton.className = 'state-control-button make-default';
  
  // Add click handler to save current state as default
  makeDefaultButton.addEventListener('click', () => {
    // Get the current state
    const currentState = window.getActiveState ? window.getActiveState() : state;
    
    // Save it to localStorage
    if (typeof saveState === 'function') {
      const success = saveState(currentState);
      if (success) {
        
        
        // Provide visual feedback
        makeDefaultButton.textContent = 'Saved!';
        
        // Reset button after a short delay
        setTimeout(() => {
          makeDefaultButton.textContent = 'Make Default';
        }, 1500);
      } else {
        console.error('Failed to save state as default');
      }
    } else {
      console.error('saveState function not available');
    }
  });
  
  // Add elements to container
  container.appendChild(exportButton);
  container.appendChild(importButton);
  container.appendChild(makeDefaultButton);
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
    onFontLoaded: async () => {
      try {
        await initializeApplication();
      } catch (error) {
        console.error('[INIT] Failed to initialize application:', error);
      }
    }
  });
}

/**
 * Initialize the main application
 */
async function initializeApplication() {
  
  // Initialize AudioContext first
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  console.log('[AUDIO] AudioContext created with sample rate:', audioContext.sampleRate);
  console.log('[AUDIO] AudioContext initial state:', audioContext.state);
  
  // Initialize timing system with RockSolidTiming
  console.log('[MAIN] Initializing RockSolidTiming system...');
  try {
    await initializeTime();
    console.log('[MAIN] RockSolidTiming initialized successfully');
  } catch (error) {
    console.error('[MAIN] Failed to initialize timing system:', error);
    // Continue anyway - RockSolidTiming should work without explicit initialization
  }
  
  // Create application state AFTER timing is initialized
  appState = createAppState();
  
  // Create global state manager AFTER timing is initialized
  globalState = new GlobalStateManager();
  
  // Initialize timing in global state
  globalState.initializeTiming();
  
  // Make states globally accessible for debugging
  window._appState = appState;
  window._globalState = globalState;
  
  // Setup tab system
  setupHeaderTabs();
  
  // Initialize THREE.js and scene first
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x000000, 0);
  
  // Add debugging for renderer
  
  
  
  // Get canvas container and set renderer size
  const canvasContainer = document.getElementById('canvas');
  
  
  
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
  
  
  // Create scene
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x111111); // Dark gray background
  sceneInstance = scene;
  
  // Create camera
  const camera = new THREE.PerspectiveCamera(60, containerWidth / containerHeight, 0.1, 50000);
  camera.position.z = 2000;
  
  // Store camera and renderer references in scene userData for layer manager to access
  scene.userData.camera = camera;
  scene.userData.renderer = renderer;
  scene.userData.globalState = globalState;
  
  // Also add these as direct properties (needed for some older code paths)
  scene.mainCamera = camera;
  scene.mainRenderer = renderer;
  
  // Add to window for emergency access by other components
  window.mainCamera = camera;
  window.mainRenderer = renderer;
  window.mainScene = scene;
  
  
  
  
  
  
  
  
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
  layerManager = new LayerManager(scene);
  
  // Add reference to the scene for easy access
  scene._layerManager = layerManager;
  
  // Add layer link group to scene
  scene.add(layerLinkManager.getLinkGroup());
  
  // Make layer link manager available globally for trigger system
  window.layerLinkManager = layerLinkManager;
  
  // Load saved state (if any) before creating default layers
  loadSavedState().then(savedState => {
    if (!savedState) {
      
      createDefaultLayers();
    } else {
      
    }
    
    // Continue with application initialization
    initializeAppWithLayers();
  });
  
  /**
   * Load saved state from localStorage
   * @returns {Promise<boolean>} True if state was loaded successfully
   */
  function loadSavedState() {
    return loadState().then(savedState => {
      if (!savedState) {
        return false;
      }
      
      // Apply global state if available
      if (savedState.globalState && globalState) {
        applyPropertiesToState(globalState, savedState.globalState);
        
      }
      
      // Create layers from saved data if available
      if (savedState.layers && savedState.layers.length > 0) {
        savedState.layers.forEach((layerData, index) => {
          if (index === 0 && layerManager.layers.length > 0) {
            // Update first layer instead of creating it
            const firstLayer = layerManager.layers[0];
            
            // Apply saved state to the first layer
            if (firstLayer && firstLayer.state && layerData.state) {
              applyPropertiesToState(firstLayer.state, layerData.state);
            }
            
            // Apply color if available
            if (firstLayer && layerData.color && firstLayer.setColor && window.THREE) {
              const { r, g, b } = layerData.color;
              firstLayer.setColor(new window.THREE.Color(r, g, b));
            }
            
            // Set visibility
            if (firstLayer && firstLayer.setVisible) {
              firstLayer.setVisible(layerData.visible !== false);
            }
          } else {
            // Create a new layer for layers after the first one
            const layer = layerManager.createLayer({
              visible: layerData.visible !== false, // Default to visible if not specified
              radius: layerData.state.radius || 100,
              segments: layerData.state.segments || 2,
              copies: layerData.state.copies || 1
            });
            
            // Apply saved state to the layer
            if (layer && layer.state && layerData.state) {
              applyPropertiesToState(layer.state, layerData.state);
            }
            
            // Apply color if available
            if (layer && layer.color && layer.setColor) {
              const { r, g, b } = layerData.color;
              layer.setColor(new THREE.Color(r, g, b));
            }
            
            // Set visibility
            if (layer) {
              layer.setVisible(layerData.visible !== false);
            }
          }
        });
        
        // Set active layer
        if (savedState.activeLayerId !== undefined && layerManager.layers.length > 0) {
          // Try to set the active layer by matching ID
          const activeLayerIndex = layerManager.layers.findIndex(l => l.id === savedState.activeLayerId);
          if (activeLayerIndex >= 0) {
            layerManager.setActiveLayer(activeLayerIndex);
          } else {
            layerManager.setActiveLayer(0);
          }
        }
        
        return true;
      }
      
      return false;
    });
  }
  
  /**
   * Create default layers if no saved state is available
   */
  function createDefaultLayers() {
    
  
    // Create the first layer (triangle)
    const layer0 = layerManager.createLayer({
      visible: true,
      radius: 200,
      segments: 3,  // Triangle
      copies: 3
    });
    
    // Configure first layer
    layer0.state.copies = 3;
    layer0.state.segments = 3;
    layer0.state.radius = 80;
    layer0.state.stepScale = 1.5;
    layer0.setColor(new THREE.Color(0x00ff00)); // Green
    
    // Force parameter changes to update for layer 0
    layer0.state.parameterChanges.copies = true;
    layer0.state.parameterChanges.segments = true;
    layer0.state.parameterChanges.radius = true;
    layer0.state.parameterChanges.stepScale = true;
    
    // Create the second layer (square)
    const layer1 = layerManager.createLayer({
      visible: true,
      radius: 180,
      segments: 4,  // Square
      copies: 4
    });
    
    // Configure second layer
    layer1.state.stepScale = 1.3;
    layer1.setColor(new THREE.Color(0x0088ff)); // Blue
    
    // Force parameter changes to update for layer 1
    layer1.state.parameterChanges.copies = true;
    layer1.state.parameterChanges.segments = true;
    layer1.state.parameterChanges.radius = true;
    layer1.state.parameterChanges.stepScale = true;
    
    // Create the third layer (pentagon)
    const layer2 = layerManager.createLayer({
      visible: true,
      radius: 160,
      segments: 5,  // Pentagon
      copies: 5
    });
    
    // Configure third layer
    layer2.state.stepScale = 1.2;
    layer2.setColor(new THREE.Color(0xff5500)); // Orange
    
    // Force parameter changes to update for layer 2
    layer2.state.parameterChanges.copies = true;
    layer2.state.parameterChanges.segments = true;
    layer2.state.parameterChanges.radius = true;
    layer2.state.parameterChanges.stepScale = true;
    
    // Set the first layer as active
    layerManager.setActiveLayer(0);
    
    // Ensure visibility of all layers
    layer0.setVisible(true);
    layer1.setVisible(true);
    layer2.setVisible(true);
    
    // Debug layers after creation
    
    
  }
  
  /**
   * Continue with application initialization after layers are set up
   */
  function initializeAppWithLayers() {
    // Get the active layer's state
    const activeLayer = layerManager.getActiveLayer();
    const state = activeLayer ? activeLayer.state : appState;
    
    // Update appState reference to point to the active layer's state
    window._appState = state;
    
    // Initialize DOM labels
    initLabels(renderer);
    
    // Add debugging buttons
    addDebugButtons();
    
    // Now initialize audio system after scene is setup
    setupAudio({ audioContext })
      .then(async (csound) => {
        audioInstance = csound;
        
        // Store Csound instance globally
        csoundInstance = csound;
        
        // Ensure timing is properly initialized before starting animation
        try {
          const { isTimingInitialized } = await import('./time/time.js');
          
          if (!isTimingInitialized()) {
            console.warn('[TIMING] Timing system not initialized, re-initializing...');
            await initializeTime();
          }
        } catch (error) {
          console.error('[TIMING] Failed to verify timing initialization:', error);
        }
        
        // Make sure all layers have the globalState attached
        if (layerManager && layerManager.layers) {
          layerManager.layers.forEach(layer => {
            if (layer && layer.group) {
              layer.group.userData.globalState = globalState;
              
            }
          });
        }
        
        // Set initial envelope, brightness and volume from global state
        if (csound) {
          setEnvelope(globalState.attack, globalState.decay, globalState.sustain, globalState.release)
            .then(() => {
              // Set initial brightness and volume from global state
              setBrightness(globalState.brightness);
              setMasterVolume(globalState.volume);
              
              
            })
            .catch(error => {
              console.error("Failed to setup envelope:", error);
            });
        }
        
        // Handling audio triggers
        const handleAudioTrigger = (note) => {
          triggerAudio(note, csound);
        };
        
        // Initialize MIDI system after audio is set up
        try {
          const { initializeCompleteMidiSystem, createMidiEnhancedTriggerAudio, enableMidiIntegration } = await import('./midi/index.js');
          
          // Initialize complete MIDI system with UI integration
          const midiResult = await initializeCompleteMidiSystem({
            uiContainer: document.body,
            layerManager: layerManager,
            globalState: globalState,
            originalAudioCallback: handleAudioTrigger,
            autoEnable: false // Don't auto-enable, let user choose
          });
          
          if (midiResult.success) {
            console.log('[MAIN] MIDI system initialized successfully');
            
            // Create enhanced audio trigger that supports both audio and MIDI
            const enhancedAudioTrigger = await createMidiEnhancedTriggerAudio(handleAudioTrigger);
            
            // Replace the original trigger with the enhanced one
            window.enhancedAudioTrigger = enhancedAudioTrigger;
            
            // Automatically enable MIDI integration
            await enableMidiIntegration();
            console.log('[MAIN] MIDI integration enabled automatically');
            
            // Make MIDI functions available globally for debugging
            window.testMidi = async (freq = 440, dur = 1) => {
              const { testMidiOutput } = await import('./midi/index.js');
              testMidiOutput(1, freq, dur);
            };
            
          } else {
            console.warn('[MAIN] MIDI system initialization failed:', midiResult.error);
          }
        } catch (error) {
          console.warn('[MAIN] MIDI system not available:', error.message);
        }

        // Initialize OSC system after MIDI is set up
        try {
          const { initializeOSC } = await import('./osc/oscManager.js');
          const { initializeOSCUI } = await import('./osc/oscUIIntegration.js');
          
          console.log('[MAIN] Initializing OSC system...');
          
          // Initialize OSC UI integration first (patches UI controls)
          initializeOSCUI();
          console.log('[MAIN] OSC UI integration initialized');
          
          // Try to initialize OSC connections (may fail if bridge server is not running)
          try {
            const oscResult = await initializeOSC();
            if (oscResult) {
              console.log('[MAIN] OSC system initialized successfully');
              console.log('[MAIN] OSC IN: localhost:13245, OSC OUT: localhost:53421');
              console.log('[MAIN] Make sure to run the OSC bridge server: cd osc-bridge && npm start');
            } else {
              console.warn('[MAIN] OSC system initialization failed - bridge server may not be running');
            }
          } catch (oscError) {
            console.warn('[MAIN] OSC connections failed (bridge server not running?):', oscError.message);
            console.log('[MAIN] OSC UI integration is still active for when bridge server becomes available');
          }
          
          // Make OSC functions available globally for debugging
          window.testOSC = async (message = '/G01/Radius 200') => {
            console.log('[OSC DEBUG] Testing message:', message);
            if (window.oscManager) {
              window.oscManager.handleOSCMessage(message);
            } else {
              console.warn('[OSC DEBUG] OSC manager not available');
            }
          };
          
        } catch (error) {
          console.warn('[MAIN] OSC system not available:', error.message);
        }
        
        // Start animation after timing verification is complete
        animate({
          scene,
          group: activeLayer.group,
          baseGeo: activeLayer.baseGeo,
          mat: activeLayer.material,
          stats,
          csound,
          renderer,
          cam: camera,
          state: {
            // Create a proxy to always get the active layer's state
            get bpm() { return globalState.bpm; }, // BPM is now in global state
            get lastTime() { return layerManager.getActiveLayer()?.state.lastTime || 0; },
            set lastTime(value) { if (layerManager.getActiveLayer()) layerManager.getActiveLayer().state.lastTime = value; },
            get lastAngle() { return globalState.lastAngle; }, // lastAngle is now in global state
            set lastAngle(value) { globalState.lastAngle = value; }
          },
          globalState,
          triggerAudioCallback: window.enhancedAudioTrigger || handleAudioTrigger // Use enhanced trigger if available
        });
        
        // Silent trigger function for UI previews
        const silentAudioTrigger = (note) => {
          // Don't actually make sound, just show visual feedback
          // Create a copy of the note to avoid modifying the original
          const noteCopy = { ...note };
          // Add any UI-specific processing here
          return noteCopy;
        };
        
        // Initialize UI inputs from constants
        initializeUIInputs();
        
        // Setup UI controls and bind events
        uiReferences = setupUI(state, syncStateAcrossSystems, silentAudioTrigger);
        
        // Setup timing source controls for comparison
        setupTimingSourceControls();
        
        // Explicitly update UI with the active state to ensure saved values are reflected
        try {
          // Get the most up-to-date active state
          const activeState = typeof window.getActiveState === 'function' 
            ? window.getActiveState() 
            : (layerManager?.getActiveLayer()?.state || state);
          
          // Update UI with the current state values - using the complete uiReferences
          if (typeof updateUIFromState === 'function' && uiReferences) {
            updateUIFromState(activeState, uiReferences);
            console.log('Updated UI from loaded state');
          }
        } catch (error) {
          console.error('Error updating UI from state:', error);
        }
        
        // Process any pending UI updates now that UI references are initialized
        if (window._pendingUIUpdates && window._pendingUIUpdates.length > 0) {
          console.log(`Processing ${window._pendingUIUpdates.length} pending UI updates`);
          
          if (window._updateUIFromStateFunction) {
            // If we already have the function loaded, use it directly
            window._pendingUIUpdates.forEach(pendingState => {
              window._updateUIFromStateFunction(pendingState, uiReferences);
            });
          } else {
            // Otherwise load it first
            import('./state/statePersistence.js')
              .then(module => {
                window._updateUIFromStateFunction = module.updateUIFromState;
                window._pendingUIUpdates.forEach(pendingState => {
                  window._updateUIFromStateFunction(pendingState, uiReferences);
                });
              })
              .catch(err => {
                console.error('Failed to import updateUIFromState for pending updates:', err);
              });
          }
          
          // Clear the queue
          window._pendingUIUpdates = [];
        }
        
        // Setup global UI controls
        setupGlobalUI(globalState);
        
        // Setup synth UI controls
        synthUIReferences = setupSynthUI(globalState, syncStateAcrossSystems);
        
        // Setup layers UI
        layerUIReferences = setupLayersUI(layerManager);
        
        // Make active layer state globally accessible
        window.getActiveState = () => {
          const activeLayer = layerManager?.getActiveLayer();
          const activeLayerId = layerManager?.activeLayerId;
          
          if (activeLayer && activeLayer.state) {
            // Only log if there's a mismatch between active layer and layer ID
            if (activeLayer.id !== activeLayerId) {
              
            }
            return activeLayer.state;
          } else {
            
            return state;
          }
        };
        
        // Update UI to reflect active layer state
        if (typeof window.syncStateAcrossSystems === 'function') {
          // Pass true to prevent unnecessary geometry recreation during initialization
          window.syncStateAcrossSystems(true);
        }
        
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
      .catch(async (error) => {
        console.error("Failed to setup audio system:", error);
        
        // Even if audio fails, ensure timing is properly initialized
        try {
          const { isTimingInitialized } = await import('./time/time.js');
          
          if (!isTimingInitialized()) {
            console.warn('[TIMING] Timing system not initialized (audio failed), re-initializing...');
            await initializeTime();
          }
        } catch (timingError) {
          console.error('[TIMING] Failed to verify timing initialization (audio failed):', timingError);
        }
        
        // If audio fails, still initialize the UI and animation
        const activeLayer = layerManager.getActiveLayer();
        animate({
          scene,
          group: activeLayer.group,
          baseGeo: activeLayer.baseGeo,
          mat: activeLayer.material,
          stats,
          csound: null,
          renderer,
          cam: camera,
          state: {
            get bpm() { return globalState.bpm; },
            get lastTime() { return layerManager.getActiveLayer()?.state.lastTime || 0; },
            set lastTime(value) { if (layerManager.getActiveLayer()) layerManager.getActiveLayer().state.lastTime = value; },
            get lastAngle() { return globalState.lastAngle; },
            set lastAngle(value) { globalState.lastAngle = value; }
          },
          globalState,
          triggerAudioCallback: () => {}
        });
        
        // Setup UI
        uiReferences = setupUI(state, syncStateAcrossSystems, () => {});
        
        // Setup timing source controls for comparison
        setupTimingSourceControls();
        
        // Process any pending UI updates now that UI references are initialized
        if (window._pendingUIUpdates && window._pendingUIUpdates.length > 0) {
          console.log(`Processing ${window._pendingUIUpdates.length} pending UI updates (after audio failure)`);
          
          if (window._updateUIFromStateFunction) {
            // If we already have the function loaded, use it directly
            window._pendingUIUpdates.forEach(pendingState => {
              window._updateUIFromStateFunction(pendingState, uiReferences);
            });
          } else {
            // Otherwise load it first
            import('./state/statePersistence.js')
              .then(module => {
                window._updateUIFromStateFunction = module.updateUIFromState;
                window._pendingUIUpdates.forEach(pendingState => {
                  window._updateUIFromStateFunction(pendingState, uiReferences);
                });
              })
              .catch(err => {
                console.error('Failed to import updateUIFromState for pending updates:', err);
              });
          }
          
          // Clear the queue
          window._pendingUIUpdates = [];
        }
        
        setupGlobalUI(globalState);
        synthUIReferences = setupSynthUI(globalState, syncStateAcrossSystems);
        layerUIReferences = setupLayersUI(layerManager);
        
        // Setup remaining UI elements
        setupCollapsibleSections();
        addStateControlsToUI(state);
      });
  }
  
  /**
   * Add debug buttons to the UI
   */
  function addDebugButtons() {
    if (!DEBUG_BUTTONS) return;
    
    // Create debug container if it doesn't exist
    let debugContainer = document.getElementById('debugContainer');
    if (!debugContainer) {
      debugContainer = document.createElement('div');
      debugContainer.id = 'debugContainer';
      debugContainer.style.position = 'fixed';
      debugContainer.style.bottom = '10px';
      debugContainer.style.right = '10px';
      debugContainer.style.display = 'flex';
      debugContainer.style.flexDirection = 'column';
      debugContainer.style.gap = '5px';
      debugContainer.style.zIndex = '1000';
      debugContainer.style.backgroundColor = 'rgba(0,0,0,0.7)'; // Add background
      debugContainer.style.padding = '10px'; // Add padding
      debugContainer.style.borderRadius = '5px'; // Rounded corners
      document.body.appendChild(debugContainer);
      
      // Add a debug header so it's clear this is the debug panel
      const debugHeader = document.createElement('div');
      debugHeader.textContent = 'DEBUG TOOLS';
      debugHeader.style.color = '#fff';
      debugHeader.style.fontWeight = 'bold';
      debugHeader.style.marginBottom = '10px';
      debugHeader.style.textAlign = 'center';
      debugContainer.appendChild(debugHeader);
    }
    
    // Add export button
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export State';
    exportButton.onclick = () => exportStateToFile();
    debugContainer.appendChild(exportButton);
    
    // Add import button
    const importButton = document.createElement('button');
    importButton.textContent = 'Import State';
    importButton.onclick = () => document.getElementById('stateImport').click();
    debugContainer.appendChild(importButton);
    
    // Add reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset State';
    resetButton.onclick = () => {
      if (confirm('Really reset all state to defaults?')) {
        // Hard reset - recreate the state entirely
        const newState = createAppState();
        
        // Apply the new state to the active layer
        if (layerManager && layerManager.getActiveLayer()) {
          layerManager.getActiveLayer().state = newState;
          // Force UI update
          updateUIFromState(newState);
          
          // Force all geometry to be recreated
          if (layerManager.getActiveLayer().updateGeometry) {
            layerManager.getActiveLayer().updateGeometry(true);
          }
        }
      }
    };
    debugContainer.appendChild(resetButton);
    
    // Add CSynth test button
    // ... rest of the function
  }
}

/**
 * Update existing axis labels with new equal temperament format
 */
function updateExistingAxisLabels() {
  try {
    // Import frequency utilities
    import('./audio/frequencyUtils.js').then(freqModule => {
      const { quantizeToEqualTemperament, getNoteName } = freqModule;
      
      // Get all existing axis labels
      const axisLabels = document.querySelectorAll('.axis-frequency-label');
      const globalState = window._globalState;
      
      if (!globalState) return;
      
      axisLabels.forEach(label => {
        try {
          // Parse the current label text to extract frequency and duration
          const text = label.textContent;
          
          // Match patterns like "123.45Hz 0.50s" or "Q 123.45Hz (C4) 0.50s"
          const freqMatch = text.match(/(\d+\.?\d*)Hz/);
          const durationMatch = text.match(/(\d+\.?\d+)s/);
          const isQuantized = text.startsWith('Q ');
          
          if (freqMatch && durationMatch) {
            const frequency = parseFloat(freqMatch[1]);
            const duration = parseFloat(durationMatch[1]);
            const qPrefix = isQuantized ? "Q " : "";
            
            let newText;
            if (globalState.useEqualTemperament) {
              // Convert to equal temperament format
              const refFreq = globalState.referenceFrequency || 440;
              const quantizedFreq = quantizeToEqualTemperament(frequency, refFreq);
              const noteName = getNoteName(quantizedFreq, refFreq);
              newText = `${qPrefix}${frequency.toFixed(1)}Hz (${noteName}) ${duration.toFixed(2)}s`;
            } else {
              // Convert to free temperament format
              newText = `${qPrefix}${frequency.toFixed(2)}Hz ${duration.toFixed(2)}s`;
            }
            
            // Update the label text
            label.textContent = newText;
          }
        } catch (error) {
          console.error('[LABELS] Error updating individual axis label:', error);
        }
      });
      

    }).catch(error => {
      console.error('[LABELS] Error importing frequency utilities:', error);
    });
  } catch (error) {
    console.error('[LABELS] Error updating existing axis labels:', error);
  }
}

/**
 * Refresh frequency labels when equal temperament setting changes
 */
function refreshFrequencyLabels() {
  try {
    // Update existing axis labels immediately
    updateExistingAxisLabels();
    
    // Import the clearLabels function from domLabels
    import('./ui/domLabels.js').then(module => {
      // Only clear point frequency labels, not axis labels
      // Axis labels are temporary and will be recreated with the new format on next trigger
      
      // Clear point frequency labels from all layer states
      if (layerManager && layerManager.layers) {
        layerManager.layers.forEach(layer => {
          if (layer.state && layer.state.pointFreqLabels) {
            // Clear existing point labels
            layer.state.pointFreqLabels.forEach(labelInfo => {
              if (labelInfo.label && labelInfo.label.id) {
                const element = document.getElementById(labelInfo.label.id);
                if (element) {
                  element.remove();
                }
              }
            });
            layer.state.pointFreqLabels = [];
          }
        });
      }
      
      // Clear only point frequency labels container, leave axis labels alone
      const pointLabelsContainer = document.getElementById('point-labels-container');
      if (pointLabelsContainer) {
        pointLabelsContainer.innerHTML = '';
      }
      
      // Force all layers to recreate their point frequency labels only
      if (layerManager && layerManager.layers) {
        layerManager.layers.forEach(layer => {
          if (layer.state) {
            // Only force point frequency labels to update, not geometry
            layer.state.parameterChanges.showPointsFreqLabels = true;
            layer.state.needsPointFreqLabelsUpdate = true;
          }
        });
      }
      
      // Trigger state synchronization to update point labels
      if (typeof window.syncStateAcrossSystems === 'function') {
        window.syncStateAcrossSystems();
      }
      

    }).catch(error => {
      console.error('[LABELS] Error importing domLabels:', error);
      
      // Fallback: try to clear point labels manually
      const pointLabelsContainer = document.getElementById('point-labels-container');
      if (pointLabelsContainer) {
        pointLabelsContainer.innerHTML = '';
      }
      
      // Force geometry update
      if (layerManager) {
        const activeLayer = layerManager.getActiveLayer();
        if (activeLayer && activeLayer.state) {
          activeLayer.state.parameterChanges.showPointsFreqLabels = true;
          if (typeof window.syncStateAcrossSystems === 'function') {
            window.syncStateAcrossSystems();
          }
        }
      }
    });
  } catch (error) {
    console.error('[LABELS] Error refreshing frequency labels:', error);
  }
}

/**
 * Setup global UI controls
 * @param {GlobalStateManager} globalState The global state manager
 */
function setupGlobalUI(globalState) {
  // Get BPM controls
  const bpmRange = document.getElementById('bpmRange');
  const bpmNumber = document.getElementById('bpmNumber');
  const bpmValue = document.getElementById('bpmValue');
  
  // Get equal temperament controls
  const useEqualTemperamentCheckbox = document.getElementById('useEqualTemperamentCheckbox');
  const referenceFreqRange = document.getElementById('referenceFreqRange');
  const referenceFreqNumber = document.getElementById('referenceFreqNumber');
  const referenceFreqValue = document.getElementById('referenceFreqValue');
  
  // Initialize UI controls with global state values
  try {
    // Create a references object with global UI elements
    const globalUIReferences = {
      bpmRange, bpmNumber, bpmValue,
      useEqualTemperamentCheckbox,
      referenceFreqRange, referenceFreqNumber, referenceFreqValue
    };
    
    // Update UI with global state values
    if (typeof updateUIFromState === 'function') {
      updateUIFromState(globalState, globalUIReferences);
    }
  } catch (error) {
    console.error('Error updating global UI from state:', error);
  }
  
  // Add event listeners
  if (bpmRange) {
    bpmRange.addEventListener('input', e => {
      const value = Number(e.target.value);
      globalState.setBpm(value);
      if (bpmNumber) bpmNumber.value = value;
      if (bpmValue) bpmValue.textContent = value;
    });
  }
  
  if (bpmNumber) {
    bpmNumber.addEventListener('input', e => {
      const value = Number(e.target.value);
      globalState.setBpm(value);
      if (bpmRange) bpmRange.value = value;
      if (bpmValue) bpmValue.textContent = value;
    });
  }
  
  // Add event listeners for equal temperament controls
  if (useEqualTemperamentCheckbox) {
    // Set initial value from global state
    useEqualTemperamentCheckbox.checked = globalState.useEqualTemperament;
    useEqualTemperamentCheckbox.addEventListener('change', e => {
      globalState.setUseEqualTemperament(e.target.checked);
      
      // Refresh existing labels to show the new format
      refreshFrequencyLabels();
    });
  }
  
  // Add event listeners for reference frequency controls
  if (referenceFreqRange) {
    referenceFreqRange.value = globalState.referenceFrequency;
    referenceFreqRange.addEventListener('input', e => {
      const value = Number(e.target.value);
      globalState.setReferenceFrequency(value);
      if (referenceFreqNumber) referenceFreqNumber.value = value;
      if (referenceFreqValue) referenceFreqValue.textContent = value;
      
      // Refresh labels if equal temperament is enabled
      if (globalState.useEqualTemperament) {
        refreshFrequencyLabels();
      }
    });
  }
  
  if (referenceFreqNumber) {
    referenceFreqNumber.value = globalState.referenceFrequency;
    referenceFreqNumber.addEventListener('input', e => {
      const value = Number(e.target.value);
      globalState.setReferenceFrequency(value);
      if (referenceFreqRange) referenceFreqRange.value = value;
      if (referenceFreqValue) referenceFreqValue.textContent = value;
      
      // Refresh labels if equal temperament is enabled
      if (globalState.useEqualTemperament) {
        refreshFrequencyLabels();
      }
    });
  }
  
  if (referenceFreqValue) {
    referenceFreqValue.textContent = globalState.referenceFrequency;
  }
  
  // Store references to global UI controls
  globalUIReferences = {
    bpmRange,
    bpmNumber,
    bpmValue,
    useEqualTemperamentCheckbox,
    referenceFreqRange,
    referenceFreqNumber,
    referenceFreqValue
  };
  
  console.log('[TIMING] Using RockSolidTiming - ultra-simple, bulletproof timing system');
}

// Check if DOM is loaded, otherwise wait for it
if (isDOMLoaded()) {
  loadFontAndInitApp();
} else {
  document.addEventListener('DOMContentLoaded', loadFontAndInitApp);
}

// Make the updateUIFromState function available globally
window.updateUIFromState = function(state) {
  if (!uiReferences) {
    console.log('UI not ready yet, queuing update for when references are available');
    
    // Queue the update for when uiReferences becomes available
    if (!window._pendingUIUpdates) {
      window._pendingUIUpdates = [];
    }
    
    window._pendingUIUpdates.push(state);
    return false;
  }

  // Import updateUIFromState function if needed
  if (!window._updateUIFromStateFunction) {
    try {
      // Try to dynamically import the function
      import('./state/statePersistence.js')
        .then(module => {
          window._updateUIFromStateFunction = module.updateUIFromState;
          window._updateUIFromStateFunction(state, uiReferences);
          
          // Process any pending updates
          if (window._pendingUIUpdates && window._pendingUIUpdates.length > 0) {
            window._pendingUIUpdates.forEach(pendingState => {
              window._updateUIFromStateFunction(pendingState, uiReferences);
            });
            window._pendingUIUpdates = [];
          }
        })
        .catch(err => {
          console.error('Failed to import updateUIFromState:', err);
        });
    } catch (error) {
      console.error('Error importing updateUIFromState:', error);
      return false;
    }
    return true;
  }
  
  // Use the cached function if available
  try {
    return window._updateUIFromStateFunction(state, uiReferences);
  } catch (error) {
    console.error('Error calling updateUIFromState:', error);
    return false;
  }
};

// Add a function to update UI based on active layer ID
window.updateUIForActiveLayer = function(layerId) {
  if (!layerManager) {
    console.error('Cannot update UI for active layer: layerManager not initialized');
    return false;
  }
  
  // Get the active layer state
  const layerState = layerManager.layers[layerId]?.state;
  if (!layerState) {
    console.error(`Cannot update UI: No state found for layer ${layerId}`);
    return false;
  }
  
  // Update UI with the active layer state
  return window.updateUIFromState(layerState);
};

/**
 * Setup timing source controls for comparison
 */
function setupTimingSourceControls() {
  const timingSourceRadios = document.querySelectorAll('input[name="timingSource"]');
  
  if (timingSourceRadios.length > 0) {
    timingSourceRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        if (e.target.checked) {
          const mode = e.target.value; // 'webworker' or 'performance'
          console.log(`[TIMING] Switching to ${mode} mode for comparison`);
          setTimingMode(mode);
        }
      });
    });
    
    console.log('[TIMING] Timing source controls initialized');
  } else {
    console.warn('[TIMING] No timing source radio buttons found');
  }
}
