// src/state/statePersistence.js - Refactored for GlobalState and LayerManager
/**
 * State persistence module for GeoMusica
 * Saves and loads application state to/from localStorage
 */

// const STORAGE_KEY = 'geomusica_state'; // Old key for single state object
const GLOBAL_SETTINGS_KEY = 'geomusica_global_settings';
const LAYERS_DATA_KEY = 'geomusica_layers_data';

/**
 * Save the current global settings and layer configurations.
 * @param {Object} globalState - The global application state.
 * @param {LayerManager} layerManager - The layer manager instance.
 */
export function saveState(globalState, layerManager) {
  try {
    // 1. Serialize Global State (excluding non-persistent parts)
    const serializableGlobalState = { ...globalState };
    delete serializableGlobalState.parameterChanges; // Runtime tracking object
    delete serializableGlobalState.lastUpdateTime; // Runtime metric
    delete serializableGlobalState.frame; // Runtime metric
    delete serializableGlobalState.lastTime; // Runtime metric, re-initialized on load
    delete serializableGlobalState.activeModals; // Runtime UI state
    // delete serializableGlobalState.audioContext; // Runtime object, should not be serialized
    // Add any other runtime properties of globalState to exclude here

    localStorage.setItem(GLOBAL_SETTINGS_KEY, JSON.stringify(serializableGlobalState));

    // 2. Serialize Layer Data using LayerManager's method
    const layersData = layerManager.serializeLayers(); 
    localStorage.setItem(LAYERS_DATA_KEY, JSON.stringify(layersData));

    console.log('Global settings and Layers saved successfully');
    return true;
  } catch (error) {
    console.error('Error saving state:', error);
    return false;
  }
}

/**
 * Load global settings and layer configurations from localStorage.
 * @returns {Object|null} Object containing { globalSettings, layersData } or null if critical parts not found/error.
 */
export function loadState() {
  try {
    const globalSettingsString = localStorage.getItem(GLOBAL_SETTINGS_KEY);
    const layersDataString = localStorage.getItem(LAYERS_DATA_KEY);

    // If neither is found, it's likely a fresh session or cleared storage.
    if (!globalSettingsString && !layersDataString) {
      console.log('No saved state found (global settings or layers).');
      return null;
    }
    
    let globalSettings = null;
    if (globalSettingsString) {
        try {
            globalSettings = JSON.parse(globalSettingsString);
        } catch (e) {
            console.error("Error parsing global settings from localStorage:", e);
            // Decide if this is a critical error, maybe clear the faulty item
            // localStorage.removeItem(GLOBAL_SETTINGS_KEY);
        }
    } else {
        console.log('No global settings found in localStorage. Will use defaults.');
    }

    let layersData = null;
    if (layersDataString) {
        try {
            layersData = JSON.parse(layersDataString);
        } catch (e) {
            console.error("Error parsing layers data from localStorage:", e);
            // localStorage.removeItem(LAYERS_DATA_KEY);
        }
    } else {
        console.log('No layers data found in localStorage. Will start with no layers or default layer(s).');
        layersData = []; // Default to empty array if no layer data found
    }
    
    // Only log success if we actually got something to return
    if (globalSettings || (layersData && layersData.length > 0)) {
        console.log('State loaded from localStorage (global/layers).');
    }
    return { globalSettings, layersData };

  } catch (error) {
    // This outer catch might be redundant if inner catches handle JSON.parse errors
    console.error('Error loading state from localStorage:', error);
    return { globalSettings: null, layersData: [] }; // Fallback to a defined structure
  }
}

/**
 * Apply loaded state to current globalState and layerManager.
 * @param {Object} globalState - The live global state object to update.
 * @param {LayerManager} layerManager - The live layer manager instance.
 * @param {Object} loadedData - The object from loadState() containing { globalSettings, layersData }.
 */
export function applyLoadedState(globalState, layerManager, loadedData) {
  if (!loadedData) {
    console.warn("applyLoadedState: No loadedData provided.");
    return false;
  }

  let appliedGlobal = false;
  let appliedLayers = false;

  try {
    // Apply Global Settings
    if (loadedData.globalSettings && globalState) {
      console.log("Applying global settings...", loadedData.globalSettings);
      for (const key in loadedData.globalSettings) {
        if (Object.prototype.hasOwnProperty.call(loadedData.globalSettings, key)) {
          const value = loadedData.globalSettings[key];
          const setterName = `set${key.charAt(0).toUpperCase() + key.slice(1)}`;
          
          if (typeof globalState[setterName] === 'function') {
            globalState[setterName](value);
          } else if (globalState.hasOwnProperty(key)) {
            // Direct assignment for properties without setters or complex objects
            if (globalState[key] !== undefined && typeof globalState[key] === 'object' && 
                globalState[key] !== null && !Array.isArray(globalState[key]) && 
                typeof value === 'object' && value !== null) {
                 // For nested objects like 'performance', merge them to preserve structure
                 Object.assign(globalState[key], value); 
            } else {
                 globalState[key] = value; // Direct assignment for simple types or if structure differs
            }
          } else {
            // console.warn(`Global state has no property or setter for: ${key}`);
          }
        }
      }
      if (typeof globalState.resetParameterChanges === 'function') {
        globalState.resetParameterChanges(); // Reset after applying all changes
      }
      console.log('Global settings applied.');
      appliedGlobal = true;
    } else {
      console.log("No global settings to apply or globalState object missing.");
    }

    // Apply Layer Data
    if (loadedData.layersData && layerManager) {
      console.log("Applying layers data...", loadedData.layersData);
      layerManager.deserializeLayers(loadedData.layersData); 
      console.log('Layers data applied.');
      appliedLayers = true;
    } else {
      console.log("No layers data to apply or layerManager object missing.");
      // If there's no layersData from localStorage, ensure LayerManager is at least empty or has defaults.
      // deserializeLayers should handle empty array correctly by clearing existing layers.
      if (layerManager && !loadedData.layersData) {
        layerManager.deserializeLayers([]); // Ensure it clears out any existing layers if none are loaded
      }
    }
    
    // Note: UI and Audio engine updates should ideally be triggered 
    // by events or subscriptions after state changes, rather than directly here.
    // For example, LayerManager notifying its subscribers would allow the UI to refresh its layer list.
    // Global state changes could also have a notification mechanism.

    return appliedGlobal || appliedLayers; 
  } catch (error) {
    console.error('Error applying loaded state:', error);
    return false;
  }
}

/**
 * Export current state (global and layers) to a JSON file.
 * @param {Object} globalState - The global application state.
 * @param {LayerManager} layerManager - The layer manager instance.
 */
export function exportStateToFile(globalState, layerManager) {
  try {
    const serializableGlobalState = { ...globalState };
    // Remove runtime or non-persistent properties from globalState for export
    delete serializableGlobalState.parameterChanges;
    delete serializableGlobalState.lastUpdateTime;
    delete serializableGlobalState.frame;
    delete serializableGlobalState.lastTime;
    delete serializableGlobalState.activeModals;
    // delete serializableGlobalState.audioContext; 

    const layersData = layerManager.serializeLayers();

    const combinedState = {
      formatVersion: 'geomusica-v2.0', // Versioning for future compatibility
      savedAt: new Date().toISOString(),
      globalSettings: serializableGlobalState,
      layers: layersData
    };

    const jsonString = JSON.stringify(combinedState, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Create a more user-friendly timestamp for the filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `geomusica_session_${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('State exported to file successfully.');
    return true;
  } catch (error) {
    console.error('Error exporting state to file:', error);
    // alert('Failed to export state. See console for details.'); // Optional user feedback
    return false;
  }
}

/**
 * Import state from a JSON file.
 * @param {File} file - The file object to import.
 * @param {Object} globalState - The live global state object.
 * @param {LayerManager} layerManager - The live layer manager instance.
 * @returns {Promise<boolean>} True if import and application were successful.
 */
export async function importStateFromFile(file, globalState, layerManager) {
  return new Promise((resolve, reject) => {
    if (!file) {
      // console.error('No file provided for import.');
      reject(new Error('No file provided for import.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        
        if (!importedData || typeof importedData !== 'object') {
            throw new Error('Invalid file content: not a JSON object.');
        }
        
        // Basic validation (can be more sophisticated, e.g., checking formatVersion)
        if (!importedData.globalSettings || !Array.isArray(importedData.layers)) {
          throw new Error('Invalid file format: missing globalSettings or layers array.');
        }

        // applyLoadedState will update the live state objects
        const success = applyLoadedState(globalState, layerManager, {
          globalSettings: importedData.globalSettings,
          layersData: importedData.layers
        });
        
        if (success) {
          console.log('State imported from file and applied successfully.');
          // Notify relevant systems about the state change
          if (layerManager && typeof layerManager._notifySubscribers === 'function') {
            layerManager._notifySubscribers(); // Ensure UI updates for layers
          }
          // Add a similar notification for globalState if a subscription system is implemented for it
          // For example: if (typeof globalState._notifySubscribers === 'function') globalState._notifySubscribers();
          resolve(true);
        } else {
          throw new Error('Failed to apply imported state. Check console for details.');
        }
      } catch (error) {
        console.error('Error processing imported file:', error);
        reject(error); // Pass the error object itself
      }
    };
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      reject(error); // Pass the error object
    };
    reader.readAsText(file);
  });
}

/**
 * Setup auto-save functionality.
 * @param {Object} globalState - The global application state.
 * @param {LayerManager} layerManager - The layer manager instance.
 * @param {number} interval - Auto-save interval in milliseconds.
 */
export function setupAutoSave(globalState, layerManager, interval = 15000) {
  // Clear any existing interval to prevent multiple auto-save loops
  if (window.geomusicaAutoSaveIntervalId) { // Changed variable name for clarity
    clearInterval(window.geomusicaAutoSaveIntervalId);
  }

  if (!globalState || !layerManager) {
    console.warn("Auto-save setup skipped: globalState or layerManager is missing.");
    return;
  }

  window.geomusicaAutoSaveIntervalId = setInterval(() => {
    console.log('Auto-saving state...');
    saveState(globalState, layerManager); // Uses the refactored saveState
  }, interval);

  console.log(`Auto-save enabled every ${interval / 1000} seconds.`);
}

// --- Functions below this line need careful review and major adaptation ---
// Their full refactoring depends on changes in ui.js and audio.js.

/**
 * Update the UI from the current state. (NEEDS MAJOR REFACTORING)
 * This function's structure will heavily depend on how ui.js is refactored.
 * @param {Object} globalState - The global application state.
 * @param {LayerManager} layerManager - The layer manager instance.
 * @param {Object} uiElements - References to UI elements (this structure will likely change significantly).
 */
export function updateUIFromState(globalState, layerManager, uiElements) {
  console.warn(
    "updateUIFromState is a placeholder and needs a major refactor. " +
    "It depends on the new UI structure and how UI elements are managed and referenced."
  );
  
  if (!globalState || !layerManager) {
    // console.error('updateUIFromState: Missing globalState or layerManager.');
    return;
  }

  // Conceptual: The UI should ideally subscribe to changes in globalState (if it has a notifier)
  // and layerManager (which has _notifySubscribers) and update itself reactively.
  // This function, if kept, would be a manual trigger for such an update.

  // Example of what it might do (highly dependent on actual ui.js refactor):
  // if (uiElements && uiElements.globalControls) {
  //   Object.keys(uiElements.globalControls).forEach(key => {
  //     const control = uiElements.globalControls[key];
  //     if (globalState.hasOwnProperty(key) && control && typeof control.setValue === 'function') {
  //       control.setValue(globalState[key]);
  //     } else if (globalState.hasOwnProperty(key) && control && control.hasOwnProperty('value')) {
  //       control.value = globalState[key];
  //     }
  //   });
  // }

  // const activeLayerState = layerManager.getActiveLayerState();
  // if (activeLayerState && uiElements && uiElements.layerControls) {
  //   Object.keys(uiElements.layerControls).forEach(key => {
  //     const control = uiElements.layerControls[key];
  //     if (activeLayerState.hasOwnProperty(key) && control && typeof control.setValue === 'function') {
  //       control.setValue(activeLayerState[key]);
  //     } else if (activeLayerState.hasOwnProperty(key) && control && control.hasOwnProperty('value')) {
  //       control.value = activeLayerState[key];
  //     }
  //   });
  // }
  
  // Example: Update the layer list UI (if managed here)
  // if (uiElements && uiElements.layerListContainer) {
  //   // Code to rebuild the layer list based on layerManager.getAllLayers()
  //   // This would involve creating/updating DOM elements for each layer.
  // }
}

/**
 * Update the audio engine with values from the state. (NEEDS REVIEW/ADAPTATION)
 * @param {Object} globalState - The global application state.
 * @param {LayerManager} layerManager - The layer manager (for per-layer audio if applicable).
 * @param {Object} audioModule - The audio module (e.g., containing setMasterVolume, applySynthParameters).
 */
export function updateAudioEngineFromState(globalState, layerManager, audioModule) {
  console.warn(
    "updateAudioEngineFromState needs review. " +
    "Global audio settings (e.g., master volume) are applied. " +
    "Per-layer audio depends on LayerState structure and audio.js capabilities."
  );

  if (!globalState || !audioModule) {
    console.error("updateAudioEngineFromState: Missing globalState or audioModule.");
    return false;
  }

  try {
    // Apply global audio settings
    if (audioModule.setMasterVolume && globalState.masterVolume !== undefined) {
      audioModule.setMasterVolume(globalState.masterVolume);
    }
    // Add other global audio settings here if any (e.g., global effects controlled by globalState)

    // Apply active layer's synth parameters (if synth is per-layer and controlled this way)
    const activeLayerState = layerManager ? layerManager.getActiveLayerState() : null;
    if (activeLayerState && audioModule.applySynthParameters) {
        // This assumes applySynthParameters can take parameters relevant to a single layer's sound.
        // The exact parameters would depend on how layerState's audio properties (attack, decay, etc.) are defined
        // and how the audio engine expects to receive them for a specific layer/instrument.
        // This might be more complex if each layer has its own synth instance.
        const layerSynthParams = {
            attack: activeLayerState.attack,
            decay: activeLayerState.decay,
            sustain: activeLayerState.sustain,
            release: activeLayerState.release,
            // Other params like layer-specific volume/brightness if applicable to its synth
        };
        // audioModule.applySynthParameters(layerSynthParams, activeLayerState.id); // Might need layerID
        console.log("Conceptual: Would apply synth parameters for active layer:", activeLayerState.id, layerSynthParams);
    } else if (activeLayerState && !audioModule.applySynthParameters) {
        console.warn("audioModule.applySynthParameters not found. Cannot apply active layer synth settings.");
    }
    
    // console.log('Audio engine updated from state (global settings applied).');
    return true;
  } catch (error) {
    console.error('Error updating audio engine from state:', error);
    return false;
  }
}