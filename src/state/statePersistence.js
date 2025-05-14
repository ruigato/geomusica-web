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
      
      // Time Subdivision parameters
      timeSubdivisionValue: state.timeSubdivisionValue,
      useTimeSubdivision: state.useTimeSubdivision,
      
      // Time Quantization parameters
      quantizationValue: state.quantizationValue,
      useQuantization: state.useQuantization,
      
      // Scale Mod parameters
      altScale: state.altScale,
      altStepN: state.altStepN,
      useAltScale: state.useAltScale,
      
      // Fractal parameters
      fractalValue: state.fractalValue,
      useFractal: state.useFractal,
      
      // Euclidean rhythm parameters
      euclidValue: state.euclidValue,
      useEuclid: state.useEuclid,
      
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
      
      // Star polygon parameters
      starSkip: state.starSkip,
      useStars: state.useStars,
      useCuts: state.useCuts
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
 * Get a serializable object representing the state
 * @param {Object} state Application state
 * @returns {Object} Serializable state object
 */
export function getSerializableState(state) {
  return {
    // Shape parameters
    radius: state.radius,
    copies: state.copies,
    segments: state.segments,
    stepScale: state.stepScale,
    angle: state.angle,
    
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
    useAltScale: state.useAltScale,
    
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
    
    // Time parameters
    bpm: state.bpm,
    
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
  };
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
    
    // Apply time subdivision parameters
    if (loadedState.timeSubdivisionValue !== undefined) state.setTimeSubdivisionValue(loadedState.timeSubdivisionValue);
    if (loadedState.useTimeSubdivision !== undefined) state.setUseTimeSubdivision(loadedState.useTimeSubdivision);
    
    // Apply time quantization parameters
    if (loadedState.quantizationValue !== undefined) state.setQuantizationValue(loadedState.quantizationValue);
    if (loadedState.useQuantization !== undefined) state.setUseQuantization(loadedState.useQuantization);
    
    // Apply scale mod parameters
    if (loadedState.altScale !== undefined) state.setAltScale(loadedState.altScale);
    if (loadedState.altStepN !== undefined) state.setAltStepN(loadedState.altStepN);
    if (loadedState.useAltScale !== undefined) state.setUseAltScale(loadedState.useAltScale);
    
    // Apply fractal parameters
    if (loadedState.fractalValue !== undefined) state.setFractalValue(loadedState.fractalValue);
    if (loadedState.useFractal !== undefined) state.setUseFractal(loadedState.useFractal);
    
    // Apply Euclidean rhythm parameters
    if (loadedState.euclidValue !== undefined) state.setEuclidValue(loadedState.euclidValue);
    if (loadedState.useEuclid !== undefined) state.setUseEuclid(loadedState.useEuclid);
    
    if (loadedState.useIntersections !== undefined) state.setUseIntersections(loadedState.useIntersections);
    
    if (loadedState.useLerp !== undefined) state.setUseLerp(loadedState.useLerp);
    if (loadedState.lerpTime !== undefined) state.setLerpTime(loadedState.lerpTime);
    
    if (loadedState.attack !== undefined) state.setAttack(loadedState.attack);
    if (loadedState.decay !== undefined) state.setDecay(loadedState.decay);
    if (loadedState.sustain !== undefined) state.setSustain(loadedState.sustain);
    if (loadedState.release !== undefined) state.setRelease(loadedState.release);
    if (loadedState.brightness !== undefined) state.setBrightness(loadedState.brightness);
    if (loadedState.volume !== undefined) state.setVolume(loadedState.volume);
    
    if (loadedState.useEqualTemperament !== undefined) state.setUseEqualTemperament(loadedState.useEqualTemperament);
    if (loadedState.referenceFrequency !== undefined) state.setReferenceFrequency(loadedState.referenceFrequency);
  
    if (loadedState.showAxisFreqLabels !== undefined) state.setShowAxisFreqLabels(loadedState.showAxisFreqLabels);
    if (loadedState.showPointsFreqLabels !== undefined) state.setShowPointsFreqLabels(loadedState.showPointsFreqLabels);
    
    // Apply note parameter settings
    if (loadedState.durationMode !== undefined) state.setDurationMode(loadedState.durationMode);
    if (loadedState.durationModulo !== undefined) state.setDurationModulo(loadedState.durationModulo);
    if (loadedState.minDuration !== undefined) state.setMinDuration(loadedState.minDuration);
    if (loadedState.maxDuration !== undefined) state.setMaxDuration(loadedState.maxDuration);
    if (loadedState.durationPhase !== undefined) state.setDurationPhase(loadedState.durationPhase);
    
    if (loadedState.velocityMode !== undefined) state.setVelocityMode(loadedState.velocityMode);
    if (loadedState.velocityModulo !== undefined) state.setVelocityModulo(loadedState.velocityModulo);
    if (loadedState.minVelocity !== undefined) state.setMinVelocity(loadedState.minVelocity);
    if (loadedState.maxVelocity !== undefined) state.setMaxVelocity(loadedState.maxVelocity);
    if (loadedState.velocityPhase !== undefined) state.setVelocityPhase(loadedState.velocityPhase);
    
    // Star polygon parameters
    if (loadedState.starSkip !== undefined) state.setStarSkip(loadedState.starSkip);
    if (loadedState.useStars !== undefined) state.setUseStars(loadedState.useStars);
    if (loadedState.useCuts !== undefined) state.setUseCuts(loadedState.useCuts);
    
    console.log('State applied successfully');
    return true;
  } catch (error) {
    console.error('Error applying state:', error);
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
    // Apply all parameters at once using the new function
    const params = {
      attack: state.attack,
      decay: state.decay,
      sustain: state.sustain,
      release: state.release,
      brightness: state.brightness,
      volume: state.volume
    };
    
    // Use the new applySynthParameters function
    if (audioModule.applySynthParameters) {
      audioModule.applySynthParameters(params);
    } else {
      // Fallback to individual parameter setting
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
    }
    
    console.log('Audio engine updated from state successfully');
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
      
      timeSubdivisionValue: state.timeSubdivisionValue,
      useTimeSubdivision: state.useTimeSubdivision,
      
      quantizationValue: state.quantizationValue,
      useQuantization: state.useQuantization,
      
      altScale: state.altScale,
      altStepN: state.altStepN,
      useAltScale: state.useAltScale,
      
      fractalValue: state.fractalValue,
      useFractal: state.useFractal,
      
      euclidValue: state.euclidValue,
      useEuclid: state.useEuclid,
      
      useIntersections: state.useIntersections,
      useLerp: state.useLerp,
      lerpTime: state.lerpTime,
      
      attack: state.attack,
      decay: state.decay,
      sustain: state.sustain,
      release: state.release,
      brightness: state.brightness,
      volume: state.volume,
      useEqualTemperament: state.useEqualTemperament,
      referenceFrequency: state.referenceFrequency,
      showAxisFreqLabels: state.showAxisFreqLabels,
      showPointsFreqLabels: state.showPointsFreqLabels,
      
      // Include note parameter settings
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
      
      // Star polygon parameters
      starSkip: state.starSkip,
      useStars: state.useStars,
      useCuts: state.useCuts
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
    
    // Update checkbox states
    if (uiElements.useLerpCheckbox && state.useLerp !== undefined) {
      uiElements.useLerpCheckbox.checked = state.useLerp;
    }
    
    if (uiElements.useModulusCheckbox && state.useModulus !== undefined) {
      uiElements.useModulusCheckbox.checked = state.useModulus;
    }
    
    if (uiElements.useTimeSubdivisionCheckbox && state.useTimeSubdivision !== undefined) {
      uiElements.useTimeSubdivisionCheckbox.checked = state.useTimeSubdivision;
    }
    
    if (uiElements.useQuantizationCheckbox && state.useQuantization !== undefined) {
      uiElements.useQuantizationCheckbox.checked = state.useQuantization;
    }
    
    if (uiElements.useAltScaleCheckbox && state.useAltScale !== undefined) {
      uiElements.useAltScaleCheckbox.checked = state.useAltScale;
    }
    
    if (uiElements.useFractalCheckbox && state.useFractal !== undefined) {
      uiElements.useFractalCheckbox.checked = state.useFractal;
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

    if (uiElements.useEqualTemperamentCheckbox && state.useEqualTemperament !== undefined) {
      uiElements.useEqualTemperamentCheckbox.checked = state.useEqualTemperament;
    }    
    
    if (uiElements.referenceFreqRange && state.referenceFrequency !== undefined) {
      uiElements.referenceFreqRange.value = state.referenceFrequency;
      if (uiElements.referenceFreqNumber) uiElements.referenceFreqNumber.value = state.referenceFrequency;
      if (uiElements.referenceFreqValue) uiElements.referenceFreqValue.textContent = state.referenceFrequency;
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
          console.warn(`Could not find quantization radio button with selector: ${safeCssSelector}`);
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
    
    console.log('UI updated from state successfully');
    return true;
  } catch (error) {
    console.error('Error updating UI from state:', error);
    return false;
  }
}