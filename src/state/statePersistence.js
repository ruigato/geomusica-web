// src/state/statePersistence.js
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
    // Extract only the serializable properties we want to save
    const saveData = {
      // Time parameters
      bpm: state.bpm,
      
      // Shape parameters
      radius: state.radius,
      copies: state.copies,
      segments: state.segments,
      stepScale: state.stepScale,
      angle: state.angle,
      
      // Modulus parameters
      modulusValue: state.modulusValue,
      useModulus: state.useModulus,
      
      // Intersection parameters
      useIntersections: state.useIntersections,
      
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
      
      // Display parameters
      showAxisFreqLabels: state.showAxisFreqLabels,
      showPointsFreqLabels: state.showPointsFreqLabels
    };
    
    // Convert to string and save
    const saveString = JSON.stringify(saveData);
    localStorage.setItem(STORAGE_KEY, saveString);
    console.log('State saved successfully');
    
    return true;
  } catch (error) {
    console.error('Error saving state:', error);
    return false;
  }
}

/**
 * Load state from localStorage
 * @returns {Object|null} The loaded state or null if not found
 */
export function loadState() {
  try {
    const saveString = localStorage.getItem(STORAGE_KEY);
    
    if (!saveString) {
      console.log('No saved state found');
      return null;
    }
    
    const loadedState = JSON.parse(saveString);
    console.log('State loaded successfully');
    
    return loadedState;
  } catch (error) {
    console.error('Error loading state:', error);
    return null;
  }
}

/**
 * Apply loaded state to current state object
 * @param {Object} state - The application state to update
 * @param {Object} loadedState - The loaded state data
 */
export function applyLoadedState(state, loadedState) {
  if (!state || !loadedState) return false;
  
  try {
    // Apply each property if it exists in the loaded state
    if (loadedState.bpm !== undefined) state.setBpm(loadedState.bpm);
    if (loadedState.radius !== undefined) state.setRadius(loadedState.radius);
    if (loadedState.copies !== undefined) state.setCopies(loadedState.copies);
    if (loadedState.segments !== undefined) state.setSegments(loadedState.segments);
    if (loadedState.stepScale !== undefined) state.setStepScale(loadedState.stepScale);
    if (loadedState.angle !== undefined) state.setAngle(loadedState.angle);
    
    if (loadedState.modulusValue !== undefined) state.setModulusValue(loadedState.modulusValue);
    if (loadedState.useModulus !== undefined) state.setUseModulus(loadedState.useModulus);
    
    if (loadedState.useIntersections !== undefined) state.setUseIntersections(loadedState.useIntersections);
    
    if (loadedState.useLerp !== undefined) state.setUseLerp(loadedState.useLerp);
    if (loadedState.lerpTime !== undefined) state.setLerpTime(loadedState.lerpTime);
    
    if (loadedState.attack !== undefined) state.setAttack(loadedState.attack);
    if (loadedState.decay !== undefined) state.setDecay(loadedState.decay);
    if (loadedState.sustain !== undefined) state.setSustain(loadedState.sustain);
    if (loadedState.release !== undefined) state.setRelease(loadedState.release);
    if (loadedState.brightness !== undefined) state.setBrightness(loadedState.brightness);
    if (loadedState.volume !== undefined) state.setVolume(loadedState.volume);
    
    if (loadedState.showAxisFreqLabels !== undefined) state.setShowAxisFreqLabels(loadedState.showAxisFreqLabels);
    if (loadedState.showPointsFreqLabels !== undefined) state.setShowPointsFreqLabels(loadedState.showPointsFreqLabels);
    
    console.log('State applied successfully');
    return true;
  } catch (error) {
    console.error('Error applying state:', error);
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
 * Export current state to a downloadable JSON file
 * @param {Object} state - The application state
 */
export function exportStateToFile(state) {
  try {
    // Extract serializable properties as in saveState
    const exportData = {
      bpm: state.bpm,
      radius: state.radius,
      copies: state.copies,
      segments: state.segments,
      stepScale: state.stepScale,
      angle: state.angle,
      modulusValue: state.modulusValue,
      useModulus: state.useModulus,
      useIntersections: state.useIntersections,
      useLerp: state.useLerp,
      lerpTime: state.lerpTime,
      attack: state.attack,
      decay: state.decay,
      sustain: state.sustain,
      release: state.release,
      brightness: state.brightness,
      volume: state.volume,
      showAxisFreqLabels: state.showAxisFreqLabels,
      showPointsFreqLabels: state.showPointsFreqLabels
    };
    
    // Add timestamp
    exportData.exportDate = new Date().toISOString();
    
    // Convert to JSON string
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Create a blob
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.href = url;
    link.download = `geomusica_settings_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`;
    
    // Append to document, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up URL object
    URL.revokeObjectURL(url);
    
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

// src/state/statePersistence.js - Add this function

/**
 * Update UI elements to reflect the current state
 * @param {Object} state - The application state
 * @param {Object} uiElements - References to UI elements
 */
export function updateUIFromState(state, uiElements) {
    if (!state || !uiElements) return;
    
    try {
      // Update BPM controls
      if (uiElements.bpmRange && state.bpm !== undefined) {
        uiElements.bpmRange.value = state.bpm;
        if (uiElements.bpmNumber) uiElements.bpmNumber.value = state.bpm;
        if (uiElements.bpmValue) uiElements.bpmValue.textContent = state.bpm;
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
      
      // Update checkbox states
      if (uiElements.useLerpCheckbox && state.useLerp !== undefined) {
        uiElements.useLerpCheckbox.checked = state.useLerp;
      }
      
      if (uiElements.useModulusCheckbox && state.useModulus !== undefined) {
        uiElements.useModulusCheckbox.checked = state.useModulus;
      }
      
      if (uiElements.useIntersectionsCheckbox && state.useIntersections !== undefined) {
        uiElements.useIntersectionsCheckbox.checked = state.useIntersections;
      }
      
      if (uiElements.showAxisFreqLabelsCheckbox && state.showAxisFreqLabels !== undefined) {
        uiElements.showAxisFreqLabelsCheckbox.checked = state.showAxisFreqLabels;
      }
      
      if (uiElements.showPointsFreqLabelsCheckbox && state.showPointsFreqLabels !== undefined) {
        uiElements.showPointsFreqLabelsCheckbox.checked = state.showPointsFreqLabels;
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
      
      // Update modulus radio buttons
      if (state.modulusValue !== undefined && uiElements.modulusRadioGroup) {
        const radioButton = document.querySelector(`#modulus-${state.modulusValue}`);
        if (radioButton) {
          radioButton.checked = true;
        }
      }
      
      console.log('UI updated from state successfully');
      return true;
    } catch (error) {
      console.error('Error updating UI from state:', error);
      return false;
    }
  }