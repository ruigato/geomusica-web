// src/main.js - Refactored for Layer System with GlobalState and LayerManager
import * as THREE from 'three';
import Stats from 'stats.js';

// State Management
import { createGlobalState } from './state/globalState.js';
import { LayerManager } from './state/LayerManager.js';
// import { createAppState } from './state/state.js'; // Old state replaced

// UI - These will need significant adaptation
import { setupUI } from './ui/ui.js';
import { setupSynthUI } from './ui/synthUI.js'; // May focus on active layer or be part of general layer UI

// Core Modules
import { 
    setupAudio, 
    setMasterVolume, 
    applySynthParameters 
} from './audio/audio.js';

// Geometry - updateGroup will be refactored to updateLayerVisuals
import { createPolygonGeometry, createAxis } from './geometry/geometry.js'; 

import { animate } from './animation/animation.js'; // animate will be refactored

// State Persistence - This module will need significant refactoring
import { 
    loadState, 
    applyLoadedState, 
    setupAutoSave, 
    exportStateToFile, 
    importStateFromFile, 
    updateUIFromState,
    updateAudioEngineFromState
} from './state/statePersistence.js';

// Other Utilities
import { initLabels, updateLabelPositions } from './ui/domLabels.js';
import { preloadFont } from './utils/fontUtils.js';
import { initializeTime, enableCsoundTiming } from './time/time.js'; 
import { setupHeaderTabs } from './ui/headerTabs.js'; 

// Initialize stats for performance monitoring
const stats = new Stats();
stats.showPanel(0); 
document.body.appendChild(stats.dom);
stats.dom.style.position = 'absolute';
stats.dom.style.left = 'auto';
stats.dom.style.right = '10px';
stats.dom.style.top = '10px';


// --- Core Three.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000); 
camera.position.z = 1200; 
scene.add(camera); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio); 
document.body.appendChild(renderer.domElement);

// --- Initialize State Management ---
const globalState = createGlobalState();
window._globalState = globalState; // For debugging

const layerManager = new LayerManager(scene); // Pass the scene
window._layerManager = layerManager; // For debugging

// --- Make state and core components accessible ---
scene.userData.globalState = globalState;
scene.userData.layerManager = layerManager;
scene.userData.camera = camera;
scene.userData.renderer = renderer;

// // Store UI references globally // Commenting out for now, will be handled by setupUI
// let uiReferences = null;
// let synthUIReferences = null;

// // References to core components // Commenting out, these are now part of scene/camera/renderer or managed locally
// let audioInstance = null;
// let sceneInstance = null; // scene is now the primary reference
// let groupInstance = null; // groupInstance is replaced by layerManager.layerGroups

// // Remove old appState initialization
// const appState = createAppState(); 
// window._appState = appState;

// // Remove old syncStateAcrossSystems function, as state is now passed explicitly or via scene.userData
// function syncStateAcrossSystems() { ... }

// --- Main Application Initialization ---
async function initializeApplication() {
    try {
        await preloadFont('Perfect DOS VGA 437', '/fonts/PerfectDOSVGA437.ttf');
        console.log('DOS VGA font loaded successfully');
        initLabels(scene, camera, renderer); // Pass necessary components
    } catch (error) {
        console.error("Font loading failed:", error);
    }

    // Setup Audio System
    try {
        // const audioContext = await setupAudio(globalState); // Old call
        const audioSetupResult = await setupAudio(globalState); 
        if (audioSetupResult && audioSetupResult.csoundInstance) {
            scene.userData.csoundInstance = audioSetupResult.csoundInstance; // Store if needed
            scene.userData.audioContext = audioSetupResult.audioContext;   // Store if needed

            if (globalState.masterVolume !== undefined && typeof setMasterVolume === 'function') {
                setMasterVolume(globalState.masterVolume);
            }
            console.log('Audio system initialized.');

            // Initialize Time System with Csound instance and AudioContext
            try {
                initializeTime(audioSetupResult.csoundInstance, audioSetupResult.audioContext); 
                // if (globalState.useCsoundTiming) { // This logic is handled within initializeTime/enableCsoundTiming
                //      enableCsoundTiming();
                // }
                console.log('Time system initialized with audio components.');
            } catch (error) {
                console.error('Error initializing time system:', error);
            }
        } else {
            console.error('Audio system setup failed to return valid instance or context.');
        }
    } catch (error) {
        console.error('Audio system initialization failed:', error);
    }
    
    // Load Persisted State (Needs Major Refactoring in statePersistence.js)
    try {
        const persistedData = loadState(); 
        if (persistedData) {
            console.log("Applying loaded state...");
            applyLoadedState(globalState, layerManager, persistedData); 
        } else {
            console.log("No saved state found, creating a default layer.");
            layerManager.addLayer({ name: "Default Layer 1" }); 
        }
    } catch (error) {
        console.error("Error loading or applying state:", error);
        if (layerManager.getAllLayers().length === 0) {
             layerManager.addLayer({ name: "Fallback Layer" });
        }
    }

    // Setup UI (Needs Major Refactoring in ui.js)
    try {
        // uiReferences = setupUI(globalState, layerManager, scene, camera, renderer); // New signature
        // setupSynthUI(globalState, layerManager, scene, camera, renderer); // New signature
        console.log('UI setup will be called here with globalState and layerManager.');
    } catch (error) {
        console.error('Error setting up UI:', error);
    }
    
    // Setup Header Tabs
    try {
        setupHeaderTabs(); 
    } catch (error) {
        console.error('Error setting up header tabs:', error);
    }

    createAxis(scene);

    // Setup Auto-Save (Needs Refactoring in statePersistence.js)
    // setupAutoSave(globalState, layerManager, 15000); // New signature

    addStateControlsToUI(globalState, layerManager); // Adapted call

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (typeof updateLabelPositions === 'function') {
            updateLabelPositions(); // Ensure labels are updated on resize
        }
    }, false);

    console.log("Initialization complete. Starting animation loop.");
    animate({
        scene,
        camera,
        renderer,
        globalState,
        layerManager,
        stats,
        // Pass other necessary functions like triggerAudio, updateLayerVisuals once they are ready
    });
}

// Helper function for state export/import buttons (adapted from original)
function addStateControlsToUI(globalState, layerManager) { // Added parameters
    const container = document.createElement('div');
    container.id = 'state-controls-container'; // Add an ID for potential removal/check
    container.style.position = 'fixed'; 
    container.style.bottom = '10px';
    container.style.right = '10px';
    container.style.zIndex = '10000'; 
    container.style.display = 'flex';
    container.style.gap = '10px';
    container.style.backgroundColor = 'rgba(0,0,0,0.5)';
    container.style.padding = '5px';
    container.style.borderRadius = '5px';

    const exportButton = document.createElement('button');
    exportButton.textContent = 'Export All';
    exportButton.style.padding = '8px 12px';
    exportButton.onclick = () => {
        // exportStateToFile will be refactored in statePersistence.js
        exportStateToFile(globalState, layerManager); 
    };

    const importButton = document.createElement('button');
    importButton.textContent = 'Import All';
    importButton.style.padding = '8px 12px';
    
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';

    importButton.onclick = () => fileInput.click();

    fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (file) {
            try {
                // importStateFromFile will be refactored in statePersistence.js
                const success = await importStateFromFile(file, globalState, layerManager);
                if (success) {
                    alert('Settings imported successfully!');
                    // UI and audio should be updated by applyLoadedState called within importStateFromFile
                    // Or trigger a global refresh/event if needed
                } else {
                    alert('Failed to import settings. Check console for errors.');
                }
            } catch (err) {
                console.error('Import error:', err);
                alert(`Error importing settings: ${err.message}`);
            }
        }
        fileInput.value = ''; 
    };

    container.appendChild(exportButton);
    container.appendChild(importButton);
    container.appendChild(fileInput); 
    // Check if container already exists before appending
    if (!document.getElementById('state-controls-container')) {
        document.body.appendChild(container);
    }
}


// --- DOM Ready Check and App Initialization ---
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initializeApplication();
} else {
    document.addEventListener('DOMContentLoaded', initializeApplication);
}