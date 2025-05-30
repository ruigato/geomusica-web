// src/state/statePersistence.js - Updated with Note Parameters
/**
 * State persistence module for GeoMusica
 * Saves and loads application state to/from localStorage
 */

const STORAGE_KEY = 'geomusica_state';

/**
 * Save the current state to localStorage
 * @param {Object} state - The application state
 */
export function saveState(state) {
  try {
    // Get references to all layers and global state
    const layerManager = window._layers;
    const globalState = window._globalState;
    
    if (!layerManager || !globalState) {
      
    }
    
    // Extract serializable properties for the active state
    const activeStateData = extractSerializableState(state);
    
    // Create the save data object
    const saveData = {
      // Store active state
      activeState: activeStateData,
      
      // Store global state if available
      globalState: globalState ? {
        bpm: globalState.bpm,
        attack: globalState.attack,
        decay: globalState.decay,
        sustain: globalState.sustain,
        release: globalState.release,
        brightness: globalState.brightness,
        volume: globalState.volume,
        lastAngle: globalState.lastAngle,
        useQuantization: globalState.useQuantization,
        quantizationValue: globalState.quantizationValue,
        useEqualTemperament: globalState.useEqualTemperament,
        referenceFrequency: globalState.referenceFrequency
      } : null,
      
      // Store all layers if available
      layers: []
    };
    
    // Add active layer ID if available
    if (layerManager) {
      saveData.activeLayerId = layerManager.activeLayerId;
      
      // Add layer data for all layers
      layerManager.layers.forEach(layer => {
        if (layer && layer.state) {
          saveData.layers.push({
            id: layer.id,
            visible: layer.visible,
            color: layer.material?.color ? {
              r: layer.material.color.r,
              g: layer.material.color.g,
              b: layer.material.color.b
            } : null,
            state: extractSerializableState(layer.state)
          });
        }
      });
    }
    
    // Convert to string and save
    const saveString = JSON.stringify(saveData);
    localStorage.setItem(STORAGE_KEY, saveString);
    
    
    return true;
  } catch (error) {
    console.error('Error saving state:', error);
    return false;
  }
}

/**
 * Extract a serializable state object from a state object
 * @param {Object} state - The state to extract from
 * @returns {Object} - Serializable state object
 */
function extractSerializableState(state) {
  return {
    // Shape parameters
    radius: state.radius,
    copies: state.copies,
    segments: state.segments,
    stepScale: state.stepScale,
    angle: state.angle,
    shapeType: state.shapeType,
    
    // Modulus parameters
    modulusValue: state.modulusValue,
    useModulus: state.useModulus,
    
    // Time subdivision parameters
    timeSubdivisionValue: state.timeSubdivisionValue,
    useTimeSubdivision: state.useTimeSubdivision,
    
    // Quantization parameters
    quantizationValue: state.quantizationValue,
    useQuantization: state.useQuantization,
    
    // Scale mod parameters
    altScale: state.altScale,
    altStepN: state.altStepN,
    
    // Fractal parameters
    fractalValue: state.fractalValue,
    useFractal: state.useFractal,
    
    // Euclidean rhythm parameters
    euclidValue: state.euclidValue,
    useEuclid: state.useEuclid,
    
    // Star parameters
    starSkip: state.starSkip,
    useStars: state.useStars,
    useCuts: state.useCuts,
    useTesselation: state.useTesselation,
    
    // Time parameters
    bpm: state.bpm,
    
    // Intersection parameters
    usePlainIntersections: state.usePlainIntersections,
    
    // Animation parameters
    useLerp: state.useLerp,
    lerpTime: state.lerpTime,
    
    // Synth parameters
    attack: state.attack,
    decay: state.decay,
    sustain: state.sustain,
    release: state.release,
    brightness: state.brightness,
    volume: state.volume,
    
    useEqualTemperament: state.useEqualTemperament,
    referenceFrequency: state.referenceFrequency,

    // Display parameters
    showAxisFreqLabels: state.showAxisFreqLabels,
    showPointsFreqLabels: state.showPointsFreqLabels,
    
    // Note parameter settings
    durationMode: state.durationMode,
    durationModulo: state.durationModulo,
    minDuration: state.minDuration, 
    maxDuration: state.maxDuration,
    durationPhase: state.durationPhase,
    
    velocityMode: state.velocityMode,
    velocityModulo: state.velocityModulo,
    minVelocity: state.minVelocity,
    maxVelocity: state.maxVelocity,
    velocityPhase: state.velocityPhase,

    // Additional global state properties
    lastAngle: state.lastAngle,
    startingAngle: state.startingAngle,
  };
}

/**
 * Load state from localStorage
 * @returns {Promise<Object|null>} Promise that resolves to the loaded state or null if not found
 */
export function loadState() {
  return new Promise((resolve) => {
    try {
      const saveString = localStorage.getItem(STORAGE_KEY);
      
      if (!saveString) {
        
        resolve(null);
        return;
      }
      
      const loadedState = JSON.parse(saveString);
      
      
      resolve(loadedState);
    } catch (error) {
      console.error('Error loading state:', error);
      resolve(null);
    }
  });
}

/**
 * Get a serializable object representing the state
 * @param {Object} state Application state
 * @returns {Object} Serializable state object
 */
export function getSerializableState(state) {
  return extractSerializableState(state);
}

/**
 * Apply loaded state to current state object
 * @param {Object} state - The application state to update
 * @param {Object} loadedState - The loaded state data
 */
export function applyLoadedState(state, loadedState) {
  if (!state || !loadedState) return false;
  
  try {
    // Check if this is the new format with layers and globalState
    const isNewFormat = loadedState.hasOwnProperty('activeState') && 
                       loadedState.hasOwnProperty('layers');
    
    if (isNewFormat) {
      
      
      // Apply global state if available
      if (loadedState.globalState && window._globalState) {
        applyPropertiesToState(window._globalState, loadedState.globalState);
        
      }
      
      // Apply active state to the current state
      if (loadedState.activeState) {
        applyPropertiesToState(state, loadedState.activeState);
        
      }
      
      // If we have layers and a layer manager, recreate the layer structure
      if (loadedState.layers && loadedState.layers.length > 0 && window._layers) {
        recreateLayerStructure(loadedState.layers, loadedState.activeLayerId);
        
      }
    } else {
      // Legacy format - directly apply each property
      
      applyPropertiesToState(state, loadedState);
    }
    
    
    return true;
  } catch (error) {
    console.error('Error applying state:', error);
    return false;
  }
}

/**
 * Apply properties from one state object to another
 * This is a helper function for the new multi-layer state saving system
 * @param {Object} targetState - The state object to update
 * @param {Object} sourceState - The state object to copy from
 * @returns {boolean} - True if successful
 */
export function applyPropertiesToState(targetState, sourceState) {
  if (!targetState || !sourceState) return false;
  
  // Apply each property if it exists in the source state
  // Support both function-based and direct property assignment
  const properties = [
    // Shape parameters
    { name: 'radius', setter: 'setRadius' },
    { name: 'copies', setter: 'setCopies' },
    { name: 'segments', setter: 'setSegments' },
    { name: 'stepScale', setter: 'setStepScale' },
    { name: 'angle', setter: 'setAngle' },
    { name: 'shapeType', setter: 'setShapeType' },
    { name: 'startingAngle', setter: 'setStartingAngle' },
    
    // Modulus parameters
    { name: 'modulusValue', setter: 'setModulusValue' },
    { name: 'useModulus', setter: 'setUseModulus' },
    
    // Time subdivision parameters
    { name: 'timeSubdivisionValue', setter: 'setTimeSubdivisionValue' },
    { name: 'useTimeSubdivision', setter: 'setUseTimeSubdivision' },
    
    // Quantization parameters
    { name: 'quantizationValue', setter: 'setQuantizationValue' },
    { name: 'useQuantization', setter: 'setUseQuantization' },
    
    // Scale mod parameters
    { name: 'altScale', setter: 'setAltScale' },
    { name: 'altStepN', setter: 'setAltStepN' },
    
    // Fractal parameters
    { name: 'fractalValue', setter: 'setFractalValue' },
    { name: 'useFractal', setter: 'setUseFractal' },
    
    // Euclidean rhythm parameters
    { name: 'euclidValue', setter: 'setEuclidValue' },
    { name: 'useEuclid', setter: 'setUseEuclid' },
    
    // Star parameters
    { name: 'starSkip', setter: 'setStarSkip' },
    { name: 'useStars', setter: 'setUseStars' },
    { name: 'useCuts', setter: 'setUseCuts' },
    { name: 'useTesselation', setter: 'setUseTesselation' },
    
    // Time parameters
    { name: 'bpm', setter: 'setBpm' },
    
    // Intersection parameters
    { name: 'usePlainIntersections', setter: 'setUsePlainIntersections' },
    
    // Animation parameters
    { name: 'useLerp', setter: 'setUseLerp' },
    { name: 'lerpTime', setter: 'setLerpTime' },
    
    // Synth parameters
    { name: 'attack', setter: 'setAttack' },
    { name: 'decay', setter: 'setDecay' },
    { name: 'sustain', setter: 'setSustain' },
    { name: 'release', setter: 'setRelease' },
    { name: 'brightness', setter: 'setBrightness' },
    { name: 'volume', setter: 'setVolume' },
    

    
    // Display parameters
    { name: 'showAxisFreqLabels', setter: 'setShowAxisFreqLabels' },
    { name: 'showPointsFreqLabels', setter: 'setShowPointsFreqLabels' },
    
    // Note parameter settings
    { name: 'durationMode', setter: 'setDurationMode' },
    { name: 'durationModulo', setter: 'setDurationModulo' },
    { name: 'minDuration', setter: 'setMinDuration' },
    { name: 'maxDuration', setter: 'setMaxDuration' },
    { name: 'durationPhase', setter: 'setDurationPhase' },
    
    { name: 'velocityMode', setter: 'setVelocityMode' },
    { name: 'velocityModulo', setter: 'setVelocityModulo' },
    { name: 'minVelocity', setter: 'setMinVelocity' },
    { name: 'maxVelocity', setter: 'setMaxVelocity' },
    { name: 'velocityPhase', setter: 'setVelocityPhase' },
    
    // Additional global state properties
    { name: 'lastAngle', setter: 'setLastAngle' },
    { name: 'startingAngle', setter: 'setStartingAngle' }
  ];
  
  // Apply each property
  for (const prop of properties) {
    if (sourceState[prop.name] !== undefined) {
      if (typeof targetState[prop.setter] === 'function') {
        targetState[prop.setter](sourceState[prop.name]);
      } else {
        targetState[prop.name] = sourceState[prop.name];
      }
    }
  }
  
  return true;
}

/**
 * Recreate the layer structure from saved data
 * This is a helper function for the new multi-layer state saving system
 * @param {Array} layersData - Array of layer data objects
 * @param {number} activeLayerId - ID of the active layer
 * @returns {boolean} - True if successful
 */
export function recreateLayerStructure(layersData, activeLayerId) {
  // Get layer manager
  const layerManager = window._layers;
  if (!layerManager) {
    console.error('Layer manager not found, cannot recreate layers');
    return false;
  }
  
  try {
    // First remove any existing layers except the first one
    while (layerManager.layers.length > 1) {
      const lastIndex = layerManager.layers.length - 1;
      layerManager.removeLayer(lastIndex);
    }
    
    // Now recreate layers from saved data
    layersData.forEach((layerData, index) => {
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
        
        // Apply saved state to the new layer
        if (layer && layer.state && layerData.state) {
          applyPropertiesToState(layer.state, layerData.state);
        }
        
        // Apply color if available
        if (layer && layerData.color && layer.setColor && window.THREE) {
          const { r, g, b } = layerData.color;
          layer.setColor(new window.THREE.Color(r, g, b));
        }
        
        // Set visibility
        if (layer && layer.setVisible) {
          layer.setVisible(layerData.visible !== false);
        }
      }
    });
    
    // Set active layer
    if (activeLayerId !== undefined && layerManager.layers.length > 0) {
      // Find the layer with the matching ID or use the first layer
      const activeLayerIndex = layerManager.layers.findIndex(l => l.id === activeLayerId);
      if (activeLayerIndex >= 0) {
        layerManager.setActiveLayer(activeLayerIndex);
      } else {
        layerManager.setActiveLayer(0);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error recreating layer structure:', error);
    return false;
  }
}

/**
 * Update the audio engine with values from the state
 * @param {Object} state - The application state
 * @param {Object} audioModule - The audio module containing the necessary functions
 */
export function updateAudioEngineFromState(state, audioModule) {
  if (!state || !audioModule) return false;
  
  try {
    // Use individual parameter setting functions
    const { setEnvelope, setBrightness, setMasterVolume } = audioModule;
    
    if (setEnvelope) {
      setEnvelope(state.attack, state.decay, state.sustain, state.release);
    }
    
    if (setBrightness) {
      setBrightness(state.brightness);
    }
    
    if (setMasterVolume) {
      setMasterVolume(state.volume);
    }
    
    
    return true;
  } catch (error) {
    console.error('Error updating audio engine from state:', error);
    return false;
  }
}

/**
 * Setup auto-save functionality
 * @param {Object} state - The application state to auto-save
 * @param {number} interval - Save interval in milliseconds (default: 5000ms/5s)
 */
export function setupAutoSave(state, interval = 5000) {
  // Save immediately to capture initial state
  saveState(state);
  
  // Setup interval for periodic saves
  const autoSaveInterval = setInterval(() => {
    saveState(state);
  }, interval);
  
  // Return a function to clear the interval if needed
  return () => clearInterval(autoSaveInterval);
}

/**
 * Export current state to a JSON file in the presets folder
 * @param {Object} state - The application state
 */
export async function exportStateToFile(state) {
  try {
    // Use the same format as saveState for consistency
    const layerManager = window._layers;
    const globalState = window._globalState;
    
    // Create export data with the same structure as saveState
    const exportData = {
      // Store active state
      activeState: extractSerializableState(state),
      
      // Store global state if available
      globalState: globalState ? {
        bpm: globalState.bpm,
        attack: globalState.attack,
        decay: globalState.decay,
        sustain: globalState.sustain,
        release: globalState.release,
        brightness: globalState.brightness,
        volume: globalState.volume,
        lastAngle: globalState.lastAngle,
        useQuantization: globalState.useQuantization,
        quantizationValue: globalState.quantizationValue,
        useEqualTemperament: globalState.useEqualTemperament,
        referenceFrequency: globalState.referenceFrequency
      } : null,
      
      // Store all layers if available
      layers: []
    };
    
    // Add active layer ID if available
    if (layerManager) {
      exportData.activeLayerId = layerManager.activeLayerId;
      
      // Add layer data for all layers
      layerManager.layers.forEach(layer => {
        if (layer && layer.state) {
          exportData.layers.push({
            id: layer.id,
            visible: layer.visible,
            color: layer.material?.color ? {
              r: layer.material.color.r,
              g: layer.material.color.g,
              b: layer.material.color.b
            } : null,
            state: extractSerializableState(layer.state)
          });
        }
      });
    }
    
    // Add timestamp
    exportData.exportDate = new Date().toISOString();
    
    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Generate filename
    const filename = `geomusica_settings_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
    
    // Try to use File System Access API to save to presets folder
    if ('showDirectoryPicker' in window) {
      try {
        // Check if user previously selected to always use the File System API
        const alwaysUseFileSystem = localStorage.getItem('geomusica-use-filesystem') === 'true';
        const skipDirectoryPicker = localStorage.getItem('geomusica-skip-directory-picker') === 'true';
        
        if (alwaysUseFileSystem || confirm('Would you like to save the preset directly to the presets folder on your computer?\n\nClick "OK" to select the presets folder, or "Cancel" to download the file normally.')) {
          let rootHandle;
          
          if (skipDirectoryPicker) {
            // Try to use a previously verified presets directory
            const cachedDirectoryName = localStorage.getItem('geomusica-presets-path');
            if (cachedDirectoryName) {
              try {
                // For now, we still need to ask for directory selection each time
                // as FileSystemDirectoryHandle can't be persisted
                rootHandle = await window.showDirectoryPicker({
                  mode: 'readwrite',
                  startIn: 'documents'
                });
              } catch (error) {
                console.warn('Failed to use cached directory, asking user to select:', error);
                localStorage.removeItem('geomusica-presets-path');
                localStorage.removeItem('geomusica-skip-directory-picker');
              }
            }
          }
          
          if (!rootHandle) {
            // Ask user to select the project root directory or presets directory
            rootHandle = await window.showDirectoryPicker({
              mode: 'readwrite',
              startIn: 'documents'
            });
          }
          
          // Try to find or create the presets directory
          let presetsHandle;
          if (rootHandle.name === 'presets') {
            presetsHandle = rootHandle;
          } else {
            try {
              presetsHandle = await rootHandle.getDirectoryHandle('presets');
            } catch (error) {
              // Create presets folder if it doesn't exist
              presetsHandle = await rootHandle.getDirectoryHandle('presets', { create: true });
            }
          }
          
          if (presetsHandle) {
            // Create the file in the presets directory
            const fileHandle = await presetsHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(jsonString);
            await writable.close();
            
            console.log(`Settings exported to presets/${filename}`);
            
            // Cache the directory choice
            localStorage.setItem('geomusica-use-filesystem', 'true');
            localStorage.setItem('geomusica-presets-path', presetsHandle.name);
            
            // Ask if user wants to skip the directory picker next time
            if (!skipDirectoryPicker && confirm('Settings saved successfully!\n\nWould you like to skip the directory selection dialog for future exports?\n\n(You can reset this in browser settings if needed)')) {
              localStorage.setItem('geomusica-skip-directory-picker', 'true');
            }
            
            // Show success message to user
            if (typeof showNotification === 'function') {
              showNotification(`Settings exported to presets/${filename}`, 'success');
            } else {
              alert(`Settings exported to presets/${filename}`);
            }
            
            return true;
          }
        } else {
          // User chose to use download method
          localStorage.setItem('geomusica-use-filesystem', 'false');
        }
      } catch (fsError) {
        console.warn('File System Access API failed, falling back to download:', fsError);
        // Fall through to download method
      }
    }
    
    // Fallback: Use the original download method
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    
    // Append to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up URL object
    URL.revokeObjectURL(url);
    
    console.log('Settings exported as download:', filename);
    return true;
  } catch (error) {
    console.error('Error exporting state:', error);
    return false;
  }
}

/**
 * Import state from a JSON file
 * @param {File} file - The file to import
 * @param {Object} state - The application state to update
 * @returns {Promise<boolean>} True if successful
 */
export function importStateFromFile(file, state) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const importedState = JSON.parse(event.target.result);
        const success = applyLoadedState(state, importedState);
        resolve(success);
      } catch (error) {
        console.error('Error parsing imported state file:', error);
        reject(error);
      }
    };
    
    reader.onerror = (error) => {
      console.error('Error reading file:', error);
      reject(error);
    };
    
    reader.readAsText(file);
  });
}

/**
 * Update UI elements to reflect the current state
 * @param {Object} state - The application state
 * @param {Object} uiElements - References to UI elements
 */
export function updateUIFromState(state, uiElements) {
  if (!state || !uiElements) return false;
  
  try {
    // Update BPM controls
    if (uiElements.bpmRange && state.bpm !== undefined) {
      uiElements.bpmRange.value = state.bpm;
      if (uiElements.bpmNumber) uiElements.bpmNumber.value = state.bpm;
      if (uiElements.bpmValue) uiElements.bpmValue.textContent = state.bpm;
    }
    
    // Update timing source radio buttons if they exist
    if (state.timingSource !== undefined) {
      if (uiElements.audioContextRadio && uiElements.performanceNowRadio) {
        uiElements.audioContextRadio.checked = (state.timingSource === 'audioContext');
        uiElements.performanceNowRadio.checked = (state.timingSource === 'performanceNow');
      }
    }
    
    // Update Radius controls
    if (uiElements.radiusRange && state.radius !== undefined) {
      uiElements.radiusRange.value = state.radius;
      if (uiElements.radiusNumber) uiElements.radiusNumber.value = state.radius;
      if (uiElements.radiusValue) uiElements.radiusValue.textContent = state.radius;
    }
    
    // Update Copies controls
    if (uiElements.copiesRange && state.copies !== undefined) {
      uiElements.copiesRange.value = state.copies;
      if (uiElements.copiesNumber) uiElements.copiesNumber.value = state.copies;
      if (uiElements.copiesValue) uiElements.copiesValue.textContent = state.copies;
    }
    
    // Update Segments/Number controls
    if (uiElements.numberRange && state.segments !== undefined) {
      uiElements.numberRange.value = state.segments;
      if (uiElements.numberNumber) uiElements.numberNumber.value = state.segments;
      if (uiElements.numberValue) uiElements.numberValue.textContent = state.segments;
    }
    
    // Update Step Scale controls
    if (uiElements.stepScaleRange && state.stepScale !== undefined) {
      uiElements.stepScaleRange.value = state.stepScale;
      if (uiElements.stepScaleNumber) uiElements.stepScaleNumber.value = state.stepScale;
      if (uiElements.stepScaleValue) uiElements.stepScaleValue.textContent = state.stepScale.toFixed(2);
    }
    
    // Update Angle controls
    if (uiElements.angleRange && state.angle !== undefined) {
      uiElements.angleRange.value = state.angle;
      if (uiElements.angleNumber) uiElements.angleNumber.value = state.angle;
      if (uiElements.angleValue) uiElements.angleValue.textContent = state.angle;
    }
    
    // Update Starting Angle controls
    if (uiElements.startingAngleRange && state.startingAngle !== undefined) {
      uiElements.startingAngleRange.value = state.startingAngle;
      if (uiElements.startingAngleNumber) uiElements.startingAngleNumber.value = state.startingAngle;
      if (uiElements.startingAngleValue) uiElements.startingAngleValue.textContent = state.startingAngle;
    }
    
    // Update Scale Mod controls
    if (uiElements.altScaleRange && state.altScale !== undefined) {
      uiElements.altScaleRange.value = state.altScale;
      if (uiElements.altScaleNumber) uiElements.altScaleNumber.value = state.altScale;
      if (uiElements.altScaleValue) uiElements.altScaleValue.textContent = state.altScale.toFixed(2);
    }
    
    if (uiElements.altStepNRange && state.altStepN !== undefined) {
      uiElements.altStepNRange.value = state.altStepN;
      if (uiElements.altStepNNumber) uiElements.altStepNNumber.value = state.altStepN;
      if (uiElements.altStepNValue) uiElements.altStepNValue.textContent = state.altStepN;
    }
    
    // Update Fractal controls
    if (uiElements.fractalRange && state.fractalValue !== undefined) {
      uiElements.fractalRange.value = state.fractalValue;
      if (uiElements.fractalNumber) uiElements.fractalNumber.value = state.fractalValue;
      if (uiElements.fractalValue) uiElements.fractalValue.textContent = state.fractalValue;
    }
    
    // Update Euclidean rhythm controls
    if (uiElements.useEuclidCheckbox && state.useEuclid !== undefined) {
      uiElements.useEuclidCheckbox.checked = state.useEuclid;
    }
    
    if (uiElements.euclidRange && state.euclidValue !== undefined) {
      uiElements.euclidRange.value = state.euclidValue;
      if (uiElements.euclidNumber) uiElements.euclidNumber.value = state.euclidValue;
      if (uiElements.euclidValue) uiElements.euclidValue.textContent = state.euclidValue;
    }
    
    if (uiElements.validEuclidInfo && state.euclidValue !== undefined && state.segments !== undefined) {
      uiElements.validEuclidInfo.textContent = `Current Euclidean pattern: k=${state.euclidValue} out of n=${state.segments} vertices`;
    }
    
    // Update Delete controls
    if (uiElements.useDeleteCheckbox && state.useDelete !== undefined) {
      uiElements.useDeleteCheckbox.checked = state.useDelete;
    }
    
    if (uiElements.deleteMinRange && state.deleteMin !== undefined) {
      uiElements.deleteMinRange.value = state.deleteMin;
      if (uiElements.deleteMinNumber) uiElements.deleteMinNumber.value = state.deleteMin;
      if (uiElements.deleteMinValue) uiElements.deleteMinValue.textContent = state.deleteMin;
    }
    
    if (uiElements.deleteMaxRange && state.deleteMax !== undefined) {
      uiElements.deleteMaxRange.value = state.deleteMax;
      if (uiElements.deleteMaxNumber) uiElements.deleteMaxNumber.value = state.deleteMax;
      if (uiElements.deleteMaxValue) uiElements.deleteMaxValue.textContent = state.deleteMax;
    }
    
    if (uiElements.deleteSeedRange && state.deleteSeed !== undefined) {
      uiElements.deleteSeedRange.value = state.deleteSeed;
      if (uiElements.deleteSeedNumber) uiElements.deleteSeedNumber.value = state.deleteSeed;
      if (uiElements.deleteSeedValue) uiElements.deleteSeedValue.textContent = state.deleteSeed;
    }
    
    // Update Delete mode radio buttons
    if (uiElements.deleteModeRadios && state.deleteMode !== undefined) {
      uiElements.deleteModeRadios.forEach(radio => {
        radio.checked = radio.value === state.deleteMode;
      });
    }
    
    // Update Delete target radio buttons
    if (uiElements.deleteTargetRadios && state.deleteTarget !== undefined) {
      uiElements.deleteTargetRadios.forEach(radio => {
        radio.checked = radio.value === state.deleteTarget;
      });
    }
    
    // Update checkbox states
    if (uiElements.useLerpCheckbox && state.useLerp !== undefined) {
      uiElements.useLerpCheckbox.checked = state.useLerp;
    }
    
    // Modulus checkbox removed - now automatically enabled/disabled based on value
    
    // Time subdivision checkbox removed - now automatically enabled/disabled based on value
    
    if (uiElements.useQuantizationCheckbox && state.useQuantization !== undefined) {
      uiElements.useQuantizationCheckbox.checked = state.useQuantization;
    }
    
    if (uiElements.useFractalCheckbox && state.useFractal !== undefined) {
      uiElements.useFractalCheckbox.checked = state.useFractal;
    }
    
    // Update plain intersections checkbox
    if (uiElements.useIntersectionsCheckbox && state.usePlainIntersections !== undefined) {
      uiElements.useIntersectionsCheckbox.checked = state.usePlainIntersections;
    }
    
    if (uiElements.showAxisFreqLabelsCheckbox && state.showAxisFreqLabels !== undefined) {
      uiElements.showAxisFreqLabelsCheckbox.checked = state.showAxisFreqLabels;
    }
    
    if (uiElements.showPointsFreqLabelsCheckbox && state.showPointsFreqLabels !== undefined) {
      uiElements.showPointsFreqLabelsCheckbox.checked = state.showPointsFreqLabels;
    }
    
    // Update point label display options
    if (uiElements.pointLabelShowLayerIdCheckbox && state.pointLabelShowLayerId !== undefined) {
      uiElements.pointLabelShowLayerIdCheckbox.checked = state.pointLabelShowLayerId;
    }
    
    if (uiElements.pointLabelShowFrequencyCheckbox && state.pointLabelShowFrequency !== undefined) {
      uiElements.pointLabelShowFrequencyCheckbox.checked = state.pointLabelShowFrequency;
    }
    
    if (uiElements.pointLabelShowDurationCheckbox && state.pointLabelShowDuration !== undefined) {
      uiElements.pointLabelShowDurationCheckbox.checked = state.pointLabelShowDuration;
    }
    
    if (uiElements.pointLabelShowVelocityCheckbox && state.pointLabelShowVelocity !== undefined) {
      uiElements.pointLabelShowVelocityCheckbox.checked = state.pointLabelShowVelocity;
    }
    
    // Update Lerp Time controls
    if (uiElements.lerpTimeRange && state.lerpTime !== undefined) {
      uiElements.lerpTimeRange.value = state.lerpTime;
      if (uiElements.lerpTimeNumber) uiElements.lerpTimeNumber.value = state.lerpTime;
      if (uiElements.lerpTimeValue) uiElements.lerpTimeValue.textContent = state.lerpTime.toFixed(1);
    }
    
    // Update Synth controls if they exist
    if (uiElements.attackRange && state.attack !== undefined) {
      uiElements.attackRange.value = state.attack;
      if (uiElements.attackNumber) uiElements.attackNumber.value = state.attack;
      if (uiElements.attackValue) uiElements.attackValue.textContent = state.attack.toFixed(2);
    }
    
    if (uiElements.decayRange && state.decay !== undefined) {
      uiElements.decayRange.value = state.decay;
      if (uiElements.decayNumber) uiElements.decayNumber.value = state.decay;
      if (uiElements.decayValue) uiElements.decayValue.textContent = state.decay.toFixed(2);
    }
    
    if (uiElements.sustainRange && state.sustain !== undefined) {
      uiElements.sustainRange.value = state.sustain;
      if (uiElements.sustainNumber) uiElements.sustainNumber.value = state.sustain;
      if (uiElements.sustainValue) uiElements.sustainValue.textContent = state.sustain.toFixed(2);
    }
    
    if (uiElements.releaseRange && state.release !== undefined) {
      uiElements.releaseRange.value = state.release;
      if (uiElements.releaseNumber) uiElements.releaseNumber.value = state.release;
      if (uiElements.releaseValue) uiElements.releaseValue.textContent = state.release.toFixed(2);
    }
    
    if (uiElements.brightnessRange && state.brightness !== undefined) {
      uiElements.brightnessRange.value = state.brightness;
      if (uiElements.brightnessNumber) uiElements.brightnessNumber.value = state.brightness;
      if (uiElements.brightnessValue) uiElements.brightnessValue.textContent = state.brightness.toFixed(2);
    }
    
    if (uiElements.volumeRange && state.volume !== undefined) {
      uiElements.volumeRange.value = state.volume;
      if (uiElements.volumeNumber) uiElements.volumeNumber.value = state.volume;
      if (uiElements.volumeValue) uiElements.volumeValue.textContent = state.volume.toFixed(2);
    }

    // Equal temperament is now handled by global state, not layer state
    const globalState = window._globalState;
    if (uiElements.useEqualTemperamentCheckbox && globalState) {
      uiElements.useEqualTemperamentCheckbox.checked = globalState.useEqualTemperament;
    }    
    
    if (uiElements.referenceFreqRange && globalState) {
      uiElements.referenceFreqRange.value = globalState.referenceFrequency;
      if (uiElements.referenceFreqNumber) uiElements.referenceFreqNumber.value = globalState.referenceFrequency;
      if (uiElements.referenceFreqValue) uiElements.referenceFreqValue.textContent = globalState.referenceFrequency;
    }
    
    // Update Note Parameters controls
    
    // Update Duration Mode radio buttons
    if (uiElements.durationModeRadios && state.durationMode !== undefined) {
      uiElements.durationModeRadios.forEach(radio => {
        radio.checked = (radio.value === state.durationMode);
      });
    }
    
    // Update Duration Min/Max values
    if (uiElements.minDurationRange && state.minDuration !== undefined) {
      uiElements.minDurationRange.value = state.minDuration;
      if (uiElements.minDurationNumber) uiElements.minDurationNumber.value = state.minDuration;
      if (uiElements.minDurationValue) uiElements.minDurationValue.textContent = state.minDuration.toFixed(2);
    }
    
    if (uiElements.maxDurationRange && state.maxDuration !== undefined) {
      uiElements.maxDurationRange.value = state.maxDuration;
      if (uiElements.maxDurationNumber) uiElements.maxDurationNumber.value = state.maxDuration;
      if (uiElements.maxDurationValue) uiElements.maxDurationValue.textContent = state.maxDuration.toFixed(2);
    }
    
    // Update Duration Phase
    if (uiElements.durationPhaseRange && state.durationPhase !== undefined) {
      uiElements.durationPhaseRange.value = state.durationPhase;
      if (uiElements.durationPhaseNumber) uiElements.durationPhaseNumber.value = state.durationPhase;
      if (uiElements.durationPhaseValue) uiElements.durationPhaseValue.textContent = state.durationPhase.toFixed(2);
    }
    
    // Update Velocity Mode radio buttons
    if (uiElements.velocityModeRadios && state.velocityMode !== undefined) {
      uiElements.velocityModeRadios.forEach(radio => {
        radio.checked = (radio.value === state.velocityMode);
      });
    }
    
    // Update Velocity Min/Max values
    if (uiElements.minVelocityRange && state.minVelocity !== undefined) {
      uiElements.minVelocityRange.value = state.minVelocity;
      if (uiElements.minVelocityNumber) uiElements.minVelocityNumber.value = state.minVelocity;
      if (uiElements.minVelocityValue) uiElements.minVelocityValue.textContent = state.minVelocity.toFixed(2);
    }
    
    if (uiElements.maxVelocityRange && state.maxVelocity !== undefined) {
      uiElements.maxVelocityRange.value = state.maxVelocity;
      if (uiElements.maxVelocityNumber) uiElements.maxVelocityNumber.value = state.maxVelocity;
      if (uiElements.maxVelocityValue) uiElements.maxVelocityValue.textContent = state.maxVelocity.toFixed(2);
    }
    
    // Update Velocity Phase
    if (uiElements.velocityPhaseRange && state.velocityPhase !== undefined) {
      uiElements.velocityPhaseRange.value = state.velocityPhase;
      if (uiElements.velocityPhaseNumber) uiElements.velocityPhaseNumber.value = state.velocityPhase;
      if (uiElements.velocityPhaseValue) uiElements.velocityPhaseValue.textContent = state.velocityPhase.toFixed(2);
    }

    // Update modulus radio buttons
    if (state.modulusValue !== undefined && uiElements.modulusRadioGroup) {
      const radioButton = document.querySelector(`#modulus-${state.modulusValue}`);
      if (radioButton) {
        radioButton.checked = true;
      }
    }
    
    // Update duration modulo radio buttons
    if (state.durationModulo !== undefined && uiElements.durationModuloRadioGroup) {
      const radioButton = document.querySelector(`#durationModulo-${state.durationModulo}`);
      if (radioButton) {
        radioButton.checked = true;
      }
    }
    
    // Update velocity modulo radio buttons
    if (state.velocityModulo !== undefined && uiElements.velocityModuloRadioGroup) {
      const radioButton = document.querySelector(`#velocityModulo-${state.velocityModulo}`);
      if (radioButton) {
        radioButton.checked = true;
      }
    }
    
    // Update time subdivision radio buttons
    if (state.timeSubdivisionValue !== undefined && uiElements.timeSubdivisionRadioGroup) {
      // Create a CSS-safe selector by replacing slashes and dots with underscores
      const safeValue = String(state.timeSubdivisionValue).replace(/[\/\.]/g, '_');
      const radioButton = document.querySelector(`#timeSubdivision-${safeValue}`);
      if (radioButton) {
        radioButton.checked = true;
      }
    }
    
    // Update quantization radio buttons with CSS-safe selector
    if (state.quantizationValue !== undefined && uiElements.quantizationRadioGroup) {
      // Convert the quantization value to a CSS-safe selector by replacing slashes with underscores
      const safeCssSelector = `#quantization-${state.quantizationValue.replace(/\//g, '_')}`;
      
      try {
        const radioButton = document.querySelector(safeCssSelector);
        if (radioButton) {
          radioButton.checked = true;
        } else {
          
        }
      } catch (error) {
        console.error(`Error selecting quantization radio button: ${error.message}`);
      }
    }
    
    // Update Skip radio button if it exists
    if (state.starSkip !== undefined && uiElements.starSkipRadioGroup) {
      // Find the radio button for the current skip value
      const radioButton = document.querySelector(`#starSkip-${state.starSkip}`);
      if (radioButton) {
        radioButton.checked = true;
      } else {
        // If radio button doesn't exist (e.g., invalid skip for current n),
        // recalculate valid skips and select the first valid one
        const validSkips = state.getValidStarSkips();
        if (validSkips.length > 0) {
          state.setStarSkip(validSkips[0]);
          const firstValidRadio = document.querySelector(`#starSkip-${validSkips[0]}`);
          if (firstValidRadio) {
            firstValidRadio.checked = true;
          }
        }
      }
    }
    
    if (uiElements.useStarsCheckbox && state.useStars !== undefined) {
      uiElements.useStarsCheckbox.checked = state.useStars;
    }
    
    if (uiElements.useCutsCheckbox && state.useCuts !== undefined) {
      uiElements.useCutsCheckbox.checked = state.useCuts;
    }
    
    if (uiElements.useTesselationCheckbox && state.useTesselation !== undefined) {
      uiElements.useTesselationCheckbox.checked = state.useTesselation;
    }
    
    return true;
  } catch (error) {
    console.error('Error updating UI from state:', error);
    return false;
  }
}