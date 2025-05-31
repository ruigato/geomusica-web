// src/ui/ui.js - Updated with Number parameter rounding fix
import { UI_RANGES, QUANTIZATION_VALUES } from '../config/constants.js';
import { ParameterMode } from '../notes/notes.js';
import { getUnisonMode, applyUnisonParameterChange } from './layersUI.js';

// Debug flag to control logging
const DEBUG_LOGGING = false;

// Time subdivision values for radio buttons (8 slower to 8 faster than global BPM)
const TIME_SUBDIVISION_VALUES = [
  // 8 slower options
  {value: 0.125, label: '1/8x'},
  {value: 0.143, label: '1/7x'},
  {value: 0.167, label: '1/6x'},
  {value: 0.2, label: '1/5x'},
  {value: 0.25, label: '1/4x'},
  {value: 0.333, label: '1/3x'},
  {value: 0.5, label: '1/2x'},
  {value: 0.667, label: '2/3x'},
  // Normal speed
  {value: 1, label: '1x'},
  // 8 faster options
  {value: 1.5, label: '1.5x'},
  {value: 2, label: '2x'},
  {value: 3, label: '3x'},
  {value: 4, label: '4x'},
  {value: 5, label: '5x'},
  {value: 6, label: '6x'},
  {value: 7, label: '7x'},
  {value: 8, label: '8x'},
];

// Quantization values for radio buttons
const QUANTIZATION_VALUES_FOR_RADIO_BUTTONS = [
  'off', '1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/64',
  '1/4T', '1/8T', '1/16T', '1/32T',
];

// ==================================================================================
// SYNC PAIR FUNCTION - Synchronizes slider and number inputs
// ==================================================================================

/**
 * Synchronize a range slider with a number input and display value
 * @param {HTMLInputElement} rangeInput - Range slider element
 * @param {HTMLInputElement} numberInput - Number input element  
 * @param {HTMLElement} valueDisplay - Display element for current value
 * @param {Function} setterFunction - Function to call when value changes
 * @param {number} minValue - Minimum allowed value
 * @param {number} maxValue - Maximum allowed value
 * @param {Function} typeConverter - Type conversion function (e.g., Number, parseInt)
 */
function syncPair(rangeInput, numberInput, valueDisplay, setterFunction, minValue, maxValue, typeConverter = Number) {
  if (!rangeInput || !numberInput || !valueDisplay || !setterFunction) {
    console.warn('[UI] syncPair: Missing required elements or setter function');
    return;
  }

  // Set initial values from range input
  const initialValue = typeConverter(rangeInput.value);
  numberInput.value = initialValue;
  
  // Format display value based on type
  if (typeConverter === Number) {
    // Check if it's an integer or decimal
    if (Number.isInteger(initialValue)) {
      valueDisplay.textContent = initialValue.toString();
    } else {
      valueDisplay.textContent = initialValue.toFixed(2);
    }
  } else {
    valueDisplay.textContent = initialValue.toString();
  }

  // Function to update all elements and call setter
  const updateValue = (newValue, source = 'range') => {
    try {
      const convertedValue = typeConverter(newValue);
      
      // Clamp value to valid range
      const clampedValue = Math.max(minValue, Math.min(maxValue, convertedValue));
      
      // Update all inputs
      rangeInput.value = clampedValue;
      numberInput.value = clampedValue;
      
      // Update display with appropriate formatting
      if (typeConverter === Number) {
        if (Number.isInteger(clampedValue)) {
          valueDisplay.textContent = clampedValue.toString();
        } else {
          valueDisplay.textContent = clampedValue.toFixed(2);
        }
      } else {
        valueDisplay.textContent = clampedValue.toString();
      }
      
      // Call the setter function
      setterFunction(clampedValue);
      
    } catch (error) {
      console.warn('[UI] syncPair: Error updating value:', error);
    }
  };

  // Range input event listeners
  rangeInput.addEventListener('input', (e) => {
    updateValue(e.target.value, 'range');
  });

  rangeInput.addEventListener('change', (e) => {
    updateValue(e.target.value, 'range');
  });

  // Number input event listeners
  numberInput.addEventListener('input', (e) => {
    updateValue(e.target.value, 'number');
  });

  numberInput.addEventListener('change', (e) => {
    updateValue(e.target.value, 'number');
  });

  // Handle blur to ensure value is within range
  numberInput.addEventListener('blur', (e) => {
    updateValue(e.target.value, 'number');
  });
}

// ==================================================================================
// UI UPDATE FUNCTION
// ==================================================================================

/**
 * Update UI elements from state values
 * @param {Object} state - State object containing current values
 * @param {Object} elements - Object containing UI element references
 */
function updateUIFromState(state, elements) {
  if (!state || !elements) return;

  try {
    // Update range/number/display triplets
    const updateTriplet = (rangeEl, numberEl, displayEl, stateValue, formatter = null) => {
      if (rangeEl && numberEl && displayEl && stateValue !== undefined) {
        rangeEl.value = stateValue;
        numberEl.value = stateValue;
        displayEl.textContent = formatter ? formatter(stateValue) : stateValue.toString();
      }
    };

    // Update all slider controls
    updateTriplet(elements.bpmRange, elements.bpmNumber, elements.bpmValue, 
                 state.bpm || 120);
    updateTriplet(elements.radiusRange, elements.radiusNumber, elements.radiusValue, 
                 state.radius, val => val.toString());
    updateTriplet(elements.copiesRange, elements.copiesNumber, elements.copiesValue, 
                 state.copies, val => val.toString());
    updateTriplet(elements.stepScaleRange, elements.stepScaleNumber, elements.stepScaleValue, 
                 state.stepScale, val => val.toFixed(2));
    updateTriplet(elements.angleRange, elements.angleNumber, elements.angleValue, 
                 state.angle, val => val.toString());
    updateTriplet(elements.startingAngleRange, elements.startingAngleNumber, elements.startingAngleValue, 
                 state.startingAngle, val => val.toString());
    updateTriplet(elements.numberRange, elements.numberNumber, elements.numberValue, 
                 state.segments, val => val.toString());
    updateTriplet(elements.lerpTimeRange, elements.lerpTimeNumber, elements.lerpTimeValue, 
                 state.lerpTime, val => val.toFixed(1));
    updateTriplet(elements.altScaleRange, elements.altScaleNumber, elements.altScaleValue, 
                 state.altScale, val => val.toFixed(2));
    updateTriplet(elements.altStepNRange, elements.altStepNNumber, elements.altStepNValue, 
                 state.altStepN, val => val.toString());

    // Update checkboxes
    if (elements.useLerpCheckbox) elements.useLerpCheckbox.checked = state.useLerp || false;
    if (elements.useQuantizationCheckbox) elements.useQuantizationCheckbox.checked = state.useQuantization || false;
    if (elements.useFractalCheckbox) elements.useFractalCheckbox.checked = state.useFractal || false;
    if (elements.useStarsCheckbox) elements.useStarsCheckbox.checked = state.useStars || false;
    if (elements.useCutsCheckbox) elements.useCutsCheckbox.checked = state.useCuts || false;
    if (elements.useTesselationCheckbox) elements.useTesselationCheckbox.checked = state.useTesselation || false;
    if (elements.useEuclidCheckbox) elements.useEuclidCheckbox.checked = state.useEuclid || false;
    if (elements.useDeleteCheckbox) elements.useDeleteCheckbox.checked = state.useDelete || false;
    if (elements.showAxisFreqLabelsCheckbox) elements.showAxisFreqLabelsCheckbox.checked = state.showAxisFreqLabels !== false;
    if (elements.showPointsFreqLabelsCheckbox) elements.showPointsFreqLabelsCheckbox.checked = state.showPointsFreqLabels || false;

    // Update radio button groups
    if (elements.modulusRadioGroup && state.modulusValue !== undefined) {
      setupModulusRadioButtons(elements.modulusRadioGroup, state);
    }
    if (elements.timeSubdivisionRadioGroup && state.timeSubdivisionValue !== undefined) {
      setupTimeSubdivisionRadioButtons(elements.timeSubdivisionRadioGroup, state);
    }
    if (elements.quantizationRadioGroup && state.quantizationValue !== undefined) {
      setupQuantizationRadioButtons(elements.quantizationRadioGroup, state);
    }

  } catch (error) {
    console.warn('[UI] Error updating UI from state:', error);
  }
}

// Helper function for checkbox UNISON handling
const handleCheckboxChange = (setterName, value) => {
  // Check if UNISON mode is enabled and apply to all layers
  const unisonApplied = getUnisonMode() && applyUnisonParameterChange(setterName, value, window._layers);
  
  if (!unisonApplied) {
    // Normal mode - apply to active layer only
    try {
      const { state: targetState, id, valid } = getTargetState(setterName);
      
      if (!targetState) {
        console.error(`[UI] No target state found for ${setterName}, skipping update`);
        return;
      }
      
      if (typeof targetState[setterName] === 'function') {
        targetState[setterName](value);
      } else {
        // Fallback to the original approach if the method doesn't exist
        if (typeof window.getActiveState === 'function') {
          const activeState = window.getActiveState();
          if (activeState && typeof activeState[setterName] === 'function') {
            activeState[setterName](value);
          }
        }
      }
    } catch (error) {
      console.error(`[UI] Error setting ${setterName}:`, error);
    }
  }
};

// Helper function for radio button UNISON handling
const handleRadioButtonChange = (setterName, value, additionalSetters = []) => {
  // Check if UNISON mode is enabled and apply to all layers
  const unisonApplied = getUnisonMode() && applyUnisonParameterChange(setterName, value, window._layers);
  
  if (!unisonApplied) {
    // Normal mode - apply to active layer only
    try {
      const { state: targetState, id, valid } = getTargetState(setterName);
      
      if (!targetState) {
        console.error(`[UI] No target state found for ${setterName}, skipping update`);
        return;
      }
      
      if (typeof targetState[setterName] === 'function') {
        targetState[setterName](value);
      } else {
        // Fallback to the original approach if the method doesn't exist
        if (typeof window.getActiveState === 'function') {
          const activeState = window.getActiveState();
          if (activeState && typeof activeState[setterName] === 'function') {
            activeState[setterName](value);
          }
        }
      }
      
      // Handle additional setters (e.g., auto-enable/disable related features)
      additionalSetters.forEach(({ setterName: additionalSetter, value: additionalValue }) => {
        const additionalUnisonApplied = getUnisonMode() && applyUnisonParameterChange(additionalSetter, additionalValue, window._layers);
        
        if (!additionalUnisonApplied) {
          if (typeof targetState[additionalSetter] === 'function') {
            targetState[additionalSetter](additionalValue);
          }
        }
      });
      
    } catch (error) {
      console.error(`[UI] Error setting ${setterName}:`, error);
    }
  } else {
    // UNISON mode was applied for the main setter, now handle additional setters
    additionalSetters.forEach(({ setterName: additionalSetter, value: additionalValue }) => {
      applyUnisonParameterChange(additionalSetter, additionalValue, window._layers);
    });
  }
};

// FIXED: More robust helper function to get the current target state for parameter changes
const getTargetState = (setterName) => {
  try {
    // Check if this is a global parameter that should be routed to globalState
    const globalParameters = new Set([
      'setBpm', 'setAttack', 'setDecay', 'setSustain', 'setRelease', 
      'setBrightness', 'setVolume', 'setReferenceFrequency'
    ]);
    
    const isGlobalParameter = globalParameters.has(setterName) || 
      setterName.includes('Bpm') || 
      setterName.includes('attack') ||
      setterName.includes('decay') ||
      setterName.includes('sustain') ||
      setterName.includes('release') ||
      setterName.includes('brightness') ||
      setterName.includes('volume') ||
      setterName.includes('referenceFreq');
    
    if (isGlobalParameter && window._globalState) {
      return { 
        state: window._globalState, 
        isGlobal: true,
        id: 'global',
        valid: true
      };
    }
    
    // For layer-specific parameters, use a priority-based approach
    let targetState = null;
    let layerId = 'unknown';
    
    // Priority 1: Try window.getActiveState() (most reliable)
    if (typeof window.getActiveState === 'function') {
      try {
        targetState = window.getActiveState();
        if (targetState && targetState.layerId !== undefined) {
          layerId = targetState.layerId;
          return {
            state: targetState,
            isGlobal: false,
            id: layerId,
            valid: true
          };
        }
      } catch (error) {
        
      }
    }
    
    // Priority 2: Try layer manager approach
    if (!targetState && window._layers && typeof window._layers.getActiveLayer === 'function') {
      try {
        const activeLayer = window._layers.getActiveLayer();
        if (activeLayer && activeLayer.state) {
          targetState = activeLayer.state;
          layerId = activeLayer.id;
          return { 
            state: targetState, 
            isGlobal: false,
            id: layerId,
            valid: true
          };
        }
      } catch (error) {
        
      }
    }
    
    // Priority 3: Try direct access to layer manager layers
    if (!targetState && window._layers && window._layers.layers) {
      try {
        const activeLayerIndex = window._layers.activeLayerId;
        if (activeLayerIndex !== undefined && window._layers.layers[activeLayerIndex]) {
          const activeLayer = window._layers.layers[activeLayerIndex];
          if (activeLayer && activeLayer.state) {
            targetState = activeLayer.state;
            layerId = activeLayer.id;
            return { 
              state: targetState, 
              isGlobal: false,
              id: layerId,
              valid: true
            };
          }
        }
      } catch (error) {
        
      }
    }
    
    // Final fallback to window._appState
    if (!targetState && window._appState) {
      
      return { 
        state: window._appState, 
        isGlobal: false,
        id: 'fallback',
        valid: false // Mark as invalid to indicate this is a fallback
      };
    }
    
    // If all else fails, use the original state parameter
    console.error(`[UI] No valid state found for ${setterName}, using original state parameter`);
    return { 
      state: state, 
      isGlobal: false,
      id: 'original',
      valid: false
    };
    
  } catch (error) {
    console.error(`[UI] Critical error in getTargetState for ${setterName}:`, error);
    // Return the original state as ultimate fallback
    return { 
      state: state, 
      isGlobal: false,
      id: 'error-fallback',
      valid: false
    };
  }
};

// Function to set up modulus radio buttons - MOVED TO TOP OF FILE
function setupModulusRadioButtons(container, state, type = null) {
  if (!container) return; // Null check
  
  // Clear any existing content
  container.innerHTML = '';
  
  // Get current value from state based on type
  let currentValue;
  
  if (type === 'duration') {
    currentValue = state.durationModulo;
  } else if (type === 'velocity') {
    currentValue = state.velocityModulo;
  } else {
    currentValue = state.modulusValue;
  }
  
  // Create a radio button for each value from 1 to 12
  for (let i = 1; i <= 12; i++) {
    const radioItem = document.createElement('div');
    radioItem.className = 'radio-item';
    
    const radioId = type ? `${type}Modulo-${i}` : `modulus-${i}`;
    const radioName = type ? `${type}Modulo` : 'modulus';
    
    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.id = radioId;
    radioInput.name = radioName;
    radioInput.value = i;
    radioInput.checked = (i === currentValue);
    
    // Add event listener with appropriate state setter
    radioInput.addEventListener('change', () => {
      if (radioInput.checked) {
        if (type === 'duration') {
          handleRadioButtonChange('setDurationModulo', i);
          
          // Send OSC OUT message for legacy compatibility
          if (window.triggerOSCParameterChange) {
            // Get current layer ID
            const layerId = window._layers?.activeLayerId || 0;
            window.triggerOSCParameterChange('DurationModulo', i, false, layerId);
          }
        } else if (type === 'velocity') {
          handleRadioButtonChange('setVelocityModulo', i);
          
          // Send OSC OUT message for legacy compatibility
          if (window.triggerOSCParameterChange) {
            // Get current layer ID
            const layerId = window._layers?.activeLayerId || 0;
            window.triggerOSCParameterChange('VelocityModulo', i, false, layerId);
          }
        } else {
          // Auto-enable modulus if value is not 1 (default)
          const isDefault = i === 1;
          const additionalSetters = [
            { setterName: 'setUseModulus', value: !isDefault }
          ];
          handleRadioButtonChange('setModulusValue', i, additionalSetters);
          
          // Send OSC OUT message for legacy compatibility
          if (window.triggerOSCParameterChange) {
            // Get current layer ID
            const layerId = window._layers?.activeLayerId || 0;
            window.triggerOSCParameterChange('ModulusValue', i, false, layerId);
          }
        }
      }
    });
    
    const radioLabel = document.createElement('label');
    radioLabel.htmlFor = radioId;
    radioLabel.textContent = i;
    
    radioItem.appendChild(radioInput);
    radioItem.appendChild(radioLabel);
    container.appendChild(radioItem);
  }
}

// Function to set up time subdivision radio buttons - MOVED TO TOP OF FILE
function setupTimeSubdivisionRadioButtons(container, state) {
  if (!container) return; // Null check
  
  // Clear any existing content
  container.innerHTML = '';
  
  // Create a radio button for each time subdivision value
  for (const {value, label} of TIME_SUBDIVISION_VALUES) {
    const radioItem = document.createElement('div');
    radioItem.className = 'radio-item';
    
    // Create a CSS-safe ID by replacing slashes and dots with underscores
    const safeCssId = `timeSubdivision-${String(value).replace(/[\/\.]/g, '_')}`;
    
    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.id = safeCssId;
    radioInput.name = 'timeSubdivision';
    radioInput.value = value;
    radioInput.checked = (Math.abs(value - state.timeSubdivisionValue) < 0.001);
    
    // Add event listener
    radioInput.addEventListener('change', () => {
      if (radioInput.checked) {
        // Auto-enable time subdivision if value is not 1 (default)
        const isDefault = Math.abs(parseFloat(value) - 1.0) < 0.001;
        const additionalSetters = [
          { setterName: 'setUseTimeSubdivision', value: !isDefault }
        ];
        handleRadioButtonChange('setTimeSubdivisionValue', parseFloat(value), additionalSetters);
        
        // Trigger OSC OUT for time subdivision change
        if (window.triggerOSCParameterChange) {
          const layerId = window._layers ? window._layers.activeLayerId : 0;
          window.triggerOSCParameterChange('TimeSubdivisionValue', parseFloat(value), false, layerId);
        }
        
        if (DEBUG_LOGGING) {
          
        }
      }
    });
    
    const radioLabel = document.createElement('label');
    radioLabel.htmlFor = safeCssId;
    radioLabel.textContent = label;
    
    radioItem.appendChild(radioInput);
    radioItem.appendChild(radioLabel);
    container.appendChild(radioItem);
  }
}

// Function to set up quantization radio buttons - MOVED TO TOP OF FILE
function setupQuantizationRadioButtons(container, state) {
  if (!container) return; // Null check
  
  // Clear any existing content
  container.innerHTML = '';
  
  // Create a radio button for each quantization value
  for (const value of QUANTIZATION_VALUES_FOR_RADIO_BUTTONS) {
    const radioItem = document.createElement('div');
    radioItem.className = 'radio-item';
    
    // Create a CSS-safe ID by replacing slashes with underscores
    const safeCssId = `quantization-${value.replace(/\//g, '_')}`;
    
    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.id = safeCssId;
    radioInput.name = 'quantization';
    radioInput.value = value;
    radioInput.checked = (value === state.quantizationValue);
    
    // Store the original value as a data attribute for reference
    radioInput.dataset.originalValue = value;
    
    // Add event listener
    radioInput.addEventListener('change', () => {
      if (radioInput.checked) {
        handleRadioButtonChange('setQuantizationValue', value);
      }
    });
    
    const radioLabel = document.createElement('label');
    radioLabel.htmlFor = safeCssId;
    radioLabel.textContent = value; // Display the note value (e.g., "1/4", "1/8T")
    
    radioItem.appendChild(radioInput);
    radioItem.appendChild(radioLabel);
    container.appendChild(radioItem);
  }
}

// Function to set up star skip radio buttons
function setupStarSkipRadioButtons(container, state) {
  if (!container) return; // Null check
  
  // Clear any existing content
  container.innerHTML = '';
  
  // Get the current active layer state
  const activeState = typeof window.getActiveState === 'function' ? 
    window.getActiveState() : state;
  
  // Get valid skips for the current number of segments
  const validSkips = activeState.getValidStarSkips();
  
  // Get current value from state
  const currentValue = activeState.starSkip;
  
  // Create a radio button for each valid skip value
  for (const skipValue of validSkips) {
    const radioItem = document.createElement('div');
    radioItem.className = 'radio-item';
    
    const radioId = `starSkip-${skipValue}`;
    
    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.id = radioId;
    radioInput.name = 'starSkip';
    radioInput.value = skipValue;
    radioInput.checked = (skipValue === currentValue);
    
    // Add event listener
    radioInput.addEventListener('change', () => {
      if (radioInput.checked) {
        handleRadioButtonChange('setStarSkip', skipValue);
      }
    });
    
    const radioLabel = document.createElement('label');
    radioLabel.htmlFor = radioId;
    radioLabel.textContent = skipValue;
    
    radioItem.appendChild(radioInput);
    radioItem.appendChild(radioLabel);
    container.appendChild(radioItem);
  }
}

export function setupUI(state) {
  // Get all UI elements with null checks
  const bpmRange = document.getElementById('bpmRange');
  const bpmNumber = document.getElementById('bpmNumber');
  const bpmValue = document.getElementById('bpmValue');

  const radiusRange = document.getElementById('radiusRange');
  const radiusNumber = document.getElementById('radiusNumber');
  const radiusValue = document.getElementById('radiusValue');

  const copiesRange = document.getElementById('copiesRange');
  const copiesNumber = document.getElementById('copiesNumber');
  const copiesValue = document.getElementById('copiesValue');

  const stepScaleRange = document.getElementById('stepScaleRange');
  const stepScaleNumber = document.getElementById('stepScaleNumber');
  const stepScaleValue = document.getElementById('stepScaleValue');

  const angleRange = document.getElementById('angleRange');
  const angleNumber = document.getElementById('angleNumber');
  const angleValue = document.getElementById('angleValue');

  const startingAngleRange = document.getElementById('startingAngleRange');
  const startingAngleNumber = document.getElementById('startingAngleNumber');
  const startingAngleValue = document.getElementById('startingAngleValue');

  const numberRange = document.getElementById('numberRange');
  const numberNumber = document.getElementById('numberNumber');
  const numberValue = document.getElementById('numberValue');
  
  // Lerp controls
  const useLerpCheckbox = document.getElementById('useLerpCheckbox');
  const lerpTimeRange = document.getElementById('lerpTimeRange');
  const lerpTimeNumber = document.getElementById('lerpTimeNumber');
  const lerpTimeValue = document.getElementById('lerpTimeValue');
  
  // Modulus controls
  // Modulus checkbox removed
  const modulusRadioGroup = document.getElementById('modulusRadioGroup');
  
  // Time subdivision controls
  // Time subdivision checkbox removed
  const timeSubdivisionRadioGroup = document.getElementById('timeSubdivisionRadioGroup');
  
  // Time quantization controls
  const useQuantizationCheckbox = document.getElementById('useQuantizationCheckbox');
  const quantizationRadioGroup = document.getElementById('quantizationRadioGroup');
  
  // Scale Mod controls
  const altScaleRange = document.getElementById('altScaleRange');
  const altScaleNumber = document.getElementById('altScaleNumber');
  const altScaleValue = document.getElementById('altScaleValue');

  const altStepNRange = document.getElementById('altStepNRange');
  const altStepNNumber = document.getElementById('altStepNNumber');
  const altStepNValue = document.getElementById('altStepNValue');

  // DEPRECATED: Intersections control - functionality removed
  const useIntersectionsCheckbox = document.getElementById('useIntersectionsCheckbox');

  // Get UI elements for display settings
  const showAxisFreqLabelsCheckbox = document.getElementById('showAxisFreqLabelsCheckbox');
  const showPointsFreqLabelsCheckbox = document.getElementById('showPointsFreqLabelsCheckbox');
  
  // Point label display option checkboxes
  const pointLabelShowLayerIdCheckbox = document.getElementById('pointLabelShowLayerIdCheckbox');
  const pointLabelShowFrequencyCheckbox = document.getElementById('pointLabelShowFrequencyCheckbox');
  const pointLabelShowDurationCheckbox = document.getElementById('pointLabelShowDurationCheckbox');
  const pointLabelShowVelocityCheckbox = document.getElementById('pointLabelShowVelocityCheckbox');
  
  // Equal temperament controls
  const useEqualTemperamentCheckbox = document.getElementById('useEqualTemperamentCheckbox');
  const referenceFreqRange = document.getElementById('referenceFreqRange');
  const referenceFreqNumber = document.getElementById('referenceFreqNumber');
  const referenceFreqValue = document.getElementById('referenceFreqValue');
  
  // Fractal controls
  const fractalRange = document.getElementById('fractalRange');
  const fractalNumber = document.getElementById('fractalNumber');
  const fractalValue = document.getElementById('fractalValue');
  const useFractalCheckbox = document.getElementById('useFractalCheckbox');
  
  // Star polygon controls
  const starSkipRadioGroup = document.getElementById('starSkipRadioGroup');
  const useStarsCheckbox = document.getElementById('useStarsCheckbox');
  const useCutsCheckbox = document.getElementById('useCutsCheckbox');
  const useTesselationCheckbox = document.getElementById('useTesselationCheckbox');
  const validSkipsInfo = document.getElementById('validSkipsInfo');
  
  // Euclidean rhythm controls
  const euclidRange = document.getElementById('euclidRange');
  const euclidNumber = document.getElementById('euclidNumber');
  const euclidValue = document.getElementById('euclidValue');
  const useEuclidCheckbox = document.getElementById('useEuclidCheckbox');
  const validEuclidInfo = document.getElementById('validEuclidInfo');
  
  // Delete controls
  const useDeleteCheckbox = document.getElementById('useDeleteCheckbox');
  const deleteMinRange = document.getElementById('deleteMinRange');
  const deleteMinNumber = document.getElementById('deleteMinNumber');
  const deleteMinValue = document.getElementById('deleteMinValue');
  const deleteMaxRange = document.getElementById('deleteMaxRange');
  const deleteMaxNumber = document.getElementById('deleteMaxNumber');
  const deleteMaxValue = document.getElementById('deleteMaxValue');
  const deleteModeRadios = document.querySelectorAll('input[name="deleteMode"]');
  const deleteTargetRadios = document.querySelectorAll('input[name="deleteTarget"]');
  const deleteSeedRange = document.getElementById('deleteSeedRange');
  const deleteSeedNumber = document.getElementById('deleteSeedNumber');
  const deleteSeedValue = document.getElementById('deleteSeedValue');
  
  // Note parameter controls - Duration
  const durationModeRadios = document.querySelectorAll('input[name="durationMode"]');
  const durationModuloRadioGroup = document.getElementById('durationModuloRadioGroup');
  const minDurationRange = document.getElementById('minDurationRange');
  const minDurationNumber = document.getElementById('minDurationNumber');
  const minDurationValue = document.getElementById('minDurationValue');
  const maxDurationRange = document.getElementById('maxDurationRange');
  const maxDurationNumber = document.getElementById('maxDurationNumber');
  const maxDurationValue = document.getElementById('maxDurationValue');
  
  // Note parameter controls - Velocity
  const velocityModeRadios = document.querySelectorAll('input[name="velocityMode"]');
  const velocityModuloRadioGroup = document.getElementById('velocityModuloRadioGroup');
  const minVelocityRange = document.getElementById('minVelocityRange');
  const minVelocityNumber = document.getElementById('minVelocityNumber');
  const minVelocityValue = document.getElementById('minVelocityValue');
  const maxVelocityRange = document.getElementById('maxVelocityRange');
  const maxVelocityNumber = document.getElementById('maxVelocityNumber');
  const maxVelocityValue = document.getElementById('maxVelocityValue');
  
  // Add the missing UI elements for the duration phase slider

  // Get UI elements with null checks
  const durationPhaseRange = document.getElementById('durationPhaseRange');
  const durationPhaseNumber = document.getElementById('durationPhaseNumber');
  const durationPhaseValue = document.getElementById('durationPhaseValue');
  
  // Set initial values for duration phase with null checks
  if (durationPhaseRange && durationPhaseNumber && durationPhaseValue) {
    durationPhaseRange.value = state.durationPhase || 0;
    durationPhaseNumber.value = state.durationPhase || 0;
    durationPhaseValue.textContent = (state.durationPhase || 0).toFixed(2);
  }
  
  // Check if required elements exist before proceeding
  if (!numberRange || !numberNumber || !numberValue) {
    
    // Continue with other elements that are available
  }


  
  // Initialize checkbox states from app state with null checks
  if (showAxisFreqLabelsCheckbox) {
    // Get the initial value from the active layer's state
    const activeState = typeof window.getActiveState === 'function' ? 
      window.getActiveState() : state;
    showAxisFreqLabelsCheckbox.checked = activeState.showAxisFreqLabels !== false;
  }
  if (showPointsFreqLabelsCheckbox) showPointsFreqLabelsCheckbox.checked = state.showPointsFreqLabels;
  if (useQuantizationCheckbox) useQuantizationCheckbox.checked = state.useQuantization;
  if (useFractalCheckbox) useFractalCheckbox.checked = state.useFractal;
  if (useStarsCheckbox) useStarsCheckbox.checked = state.useStars;
  if (useCutsCheckbox) useCutsCheckbox.checked = state.useCuts;
  if (useTesselationCheckbox) useTesselationCheckbox.checked = state.useTesselation;
  if (useLerpCheckbox) useLerpCheckbox.checked = state.useLerp;
  if (useEuclidCheckbox) useEuclidCheckbox.checked = state.useEuclid;
  if (useDeleteCheckbox) useDeleteCheckbox.checked = state.useDelete;
  
  // Initialize point label option checkboxes
  if (pointLabelShowLayerIdCheckbox) pointLabelShowLayerIdCheckbox.checked = state.pointLabelShowLayerId;
  if (pointLabelShowFrequencyCheckbox) pointLabelShowFrequencyCheckbox.checked = state.pointLabelShowFrequency;
  if (pointLabelShowDurationCheckbox) pointLabelShowDurationCheckbox.checked = state.pointLabelShowDuration;
  if (pointLabelShowVelocityCheckbox) pointLabelShowVelocityCheckbox.checked = state.pointLabelShowVelocity;
  
  // Set initial values for scale mod controls from state with null checks
  if (altScaleRange && altScaleNumber && altScaleValue) {
    altScaleRange.value = state.altScale;
    altScaleNumber.value = state.altScale;
    altScaleValue.textContent = state.altScale.toFixed(2);
  }
  
  if (altStepNRange && altStepNNumber && altStepNValue) {
    altStepNRange.value = state.altStepN;
    altStepNNumber.value = state.altStepN;
    altStepNValue.textContent = state.altStepN;
  }
  
  // Reference frequency controls initialization is now handled in setupGlobalUI in main.js
  
  // Set initial values for duration controls with null checks
  if (minDurationRange && minDurationNumber && minDurationValue) {
    minDurationRange.value = state.minDuration;
    minDurationNumber.value = state.minDuration;
    minDurationValue.textContent = state.minDuration.toFixed(2);
  }
  
  if (maxDurationRange && maxDurationNumber && maxDurationValue) {
    maxDurationRange.value = state.maxDuration;
    maxDurationNumber.value = state.maxDuration;
    maxDurationValue.textContent = state.maxDuration.toFixed(2);
  }
  
  // Set initial values for velocity controls with null checks
  if (minVelocityRange && minVelocityNumber && minVelocityValue) {
    minVelocityRange.value = state.minVelocity;
    minVelocityNumber.value = state.minVelocity;
    minVelocityValue.textContent = state.minVelocity.toFixed(2);
  }
  
  if (maxVelocityRange && maxVelocityNumber && maxVelocityValue) {
    maxVelocityRange.value = state.maxVelocity;
    maxVelocityNumber.value = state.maxVelocity;
    maxVelocityValue.textContent = state.maxVelocity.toFixed(2);
  }
  
  // Setup event listeners for new checkboxes with null checks
  if (showAxisFreqLabelsCheckbox) {
    showAxisFreqLabelsCheckbox.addEventListener('change', e => {
      handleCheckboxChange('setShowAxisFreqLabels', e.target.checked);
    });
  }

  if (showPointsFreqLabelsCheckbox) {
    showPointsFreqLabelsCheckbox.addEventListener('change', e => {
      handleCheckboxChange('setShowPointsFreqLabels', e.target.checked);
      
      // FIXED: Force immediate state synchronization to update geometry and labels
      if (typeof window.syncStateAcrossSystems === 'function') {
        window.syncStateAcrossSystems();
      }
    });
  }
  
  // Setup point label option checkboxes
  if (pointLabelShowLayerIdCheckbox) {
    pointLabelShowLayerIdCheckbox.addEventListener('change', e => {
      handleCheckboxChange('setPointLabelShowLayerId', e.target.checked);
      // Force label refresh
      if (typeof window.syncStateAcrossSystems === 'function') {
        window.syncStateAcrossSystems();
      }
    });
  }
  
  if (pointLabelShowFrequencyCheckbox) {
    pointLabelShowFrequencyCheckbox.addEventListener('change', e => {
      handleCheckboxChange('setPointLabelShowFrequency', e.target.checked);
      // Force label refresh
      if (typeof window.syncStateAcrossSystems === 'function') {
        window.syncStateAcrossSystems();
      }
    });
  }
  
  if (pointLabelShowDurationCheckbox) {
    pointLabelShowDurationCheckbox.addEventListener('change', e => {
      handleCheckboxChange('setPointLabelShowDuration', e.target.checked);
      // Force label refresh
      if (typeof window.syncStateAcrossSystems === 'function') {
        window.syncStateAcrossSystems();
      }
    });
  }
  
  if (pointLabelShowVelocityCheckbox) {
    pointLabelShowVelocityCheckbox.addEventListener('change', e => {
      handleCheckboxChange('setPointLabelShowVelocity', e.target.checked);
      // Force label refresh
      if (typeof window.syncStateAcrossSystems === 'function') {
        window.syncStateAcrossSystems();
      }
    });
  }
  
  // Initialize modulus radio buttons
  if (modulusRadioGroup) {
    setupModulusRadioButtons(modulusRadioGroup, state);
  }
  
  // Initialize time subdivision radio buttons
  if (timeSubdivisionRadioGroup) {
    setupTimeSubdivisionRadioButtons(timeSubdivisionRadioGroup, state);
  }
  
  // Initialize quantization radio buttons
  if (quantizationRadioGroup) {
    setupQuantizationRadioButtons(quantizationRadioGroup, state);
  }
  
  // Initialize duration and velocity modulo radio buttons
  if (durationModuloRadioGroup) {
    setupModulusRadioButtons(durationModuloRadioGroup, state, 'duration');
  }
  
  if (velocityModuloRadioGroup) {
    setupModulusRadioButtons(velocityModuloRadioGroup, state, 'velocity');
  }
  
  // Setup quantization checkbox with null check
  if (useQuantizationCheckbox) {
    useQuantizationCheckbox.checked = state.useQuantization;
    useQuantizationCheckbox.addEventListener('change', e => {
      handleCheckboxChange('setUseQuantization', e.target.checked);
    });
  }
  
  // ==================================================================================
  // SEQUENCER MODE UI CONTROLS
  // ==================================================================================
  
  // Get sequencer UI elements
  const useSequencerModeCheckbox = document.getElementById('useSequencerModeCheckbox');
  const sequencerConfigSection = document.getElementById('sequencerConfigSection');
  const sequencerLookAheadRange = document.getElementById('sequencerLookAheadRange');
  const sequencerLookAheadNumber = document.getElementById('sequencerLookAheadNumber');
  const sequencerLookAheadValue = document.getElementById('sequencerLookAheadValue');
  const sequencerPrecisionRange = document.getElementById('sequencerPrecisionRange');
  const sequencerPrecisionNumber = document.getElementById('sequencerPrecisionNumber');
  const sequencerPrecisionValue = document.getElementById('sequencerPrecisionValue');
  const sequencerMaxQueueRange = document.getElementById('sequencerMaxQueueRange');
  const sequencerMaxQueueNumber = document.getElementById('sequencerMaxQueueNumber');
  const sequencerMaxQueueValue = document.getElementById('sequencerMaxQueueValue');
  const sequencerDebugCheckbox = document.getElementById('sequencerDebugCheckbox');
  const refreshMetricsBtn = document.getElementById('refreshMetricsBtn');
  
  // Metrics display elements
  const sequencerStatus = document.getElementById('sequencerStatus');
  const sequencerEventsPerSec = document.getElementById('sequencerEventsPerSec');
  const sequencerQueueSize = document.getElementById('sequencerQueueSize');
  const sequencerTimingAccuracy = document.getElementById('sequencerTimingAccuracy');
  const sequencerCacheHitRate = document.getElementById('sequencerCacheHitRate');
  const sequencerCpuUsage = document.getElementById('sequencerCpuUsage');
  const sequencerCpuTime = document.getElementById('sequencerCpuTime');
  const realTimeCpuTime = document.getElementById('realTimeCpuTime');
  const performanceGain = document.getElementById('performanceGain');

  // Variables to hold imported functions
  let setSequencerMode, isSequencerMode, getGlobalSequencer;
  let functionsReady = false;

  // ==================================================================================
  // IMPORT SEQUENCER FUNCTIONS ASYNCHRONOUSLY
  // ==================================================================================
  
  // Import animation and geometry functions and set up UI when ready
  async function initializeSequencerUI() {
    try {
      // Import animation functions
      const animationModule = await import('../animation/animation.js');
      setSequencerMode = animationModule.setSequencerMode;
      isSequencerMode = animationModule.isSequencerMode;
      
      // Import geometry functions  
      const geometryModule = await import('../geometry/geometry.js');
      getGlobalSequencer = geometryModule.getGlobalSequencer;
      
      // Make functions globally available
      if (typeof window !== 'undefined') {
        window.setSequencerMode = setSequencerMode;
        window.isSequencerMode = isSequencerMode;
        window.getGlobalSequencer = getGlobalSequencer;
      }
      
      functionsReady = true;
      console.log('[UI] Sequencer functions imported successfully');
      
      // Set up the UI now that functions are available
      setupSequencerUIControls();
      
    } catch (error) {
      console.error('[UI] Failed to import sequencer functions:', error);
      // Disable sequencer UI if import failed
      if (useSequencerModeCheckbox) {
        useSequencerModeCheckbox.disabled = true;
        useSequencerModeCheckbox.parentElement.title = 'Sequencer functions not available';
      }
    }
  }

  // ==================================================================================
  // SEQUENCER UI SETUP FUNCTION
  // ==================================================================================

  function setupSequencerUIControls() {
    if (!functionsReady) {
      console.warn('[UI] Sequencer functions not ready yet');
      return;
    }

    // Update metrics display
    function updateSequencerMetrics() {
      try {
        if (isSequencerMode && getGlobalSequencer) {
          const isActive = isSequencerMode();
          const sequencer = getGlobalSequencer();
          
          if (sequencerStatus) {
            sequencerStatus.textContent = isActive ? 'Active' : 'Disabled';
            sequencerStatus.style.color = isActive ? '#90ee90' : '#ff9999';
          }
          
          // Debug logging
          if (isActive) {
            console.log(`[UI] Sequencer active, sequencer instance:`, sequencer);
            if (sequencer) {
              const status = sequencer.getStatus();
              console.log(`[UI] Sequencer status:`, status);
            }
          }
          
          if (isActive && sequencer) {
            const metrics = sequencer.getPerformanceMetrics();
            console.log(`[UI] Sequencer metrics:`, metrics);
            
            if (sequencerEventsPerSec) {
              sequencerEventsPerSec.textContent = metrics.eventsScheduledPerSecond || 0;
            }
            if (sequencerQueueSize) {
              sequencerQueueSize.textContent = metrics.currentQueueSize || 0;
            }
            if (sequencerTimingAccuracy) {
              const accuracy = metrics.timingAccuracy;
              if (accuracy && accuracy.total > 0) {
                const accuratePercent = ((accuracy.accurate / accuracy.total) * 100).toFixed(1);
                const avgError = (accuracy.averageError * 1000).toFixed(2);
                sequencerTimingAccuracy.textContent = `${accuratePercent}% (${avgError}ms avg error)`;
              } else {
                sequencerTimingAccuracy.textContent = 'N/A';
              }
            }
            if (sequencerCacheHitRate) {
              const hitRate = metrics.cacheStats?.hitRate;
              if (hitRate !== undefined) {
                sequencerCacheHitRate.textContent = `${(hitRate * 100).toFixed(1)}%`;
              } else {
                sequencerCacheHitRate.textContent = 'N/A';
              }
            }
            if (sequencerCpuUsage) {
              const cpuUsage = metrics.cpuUsage;
              if (cpuUsage) {
                sequencerCpuUsage.textContent = `${cpuUsage.sequencerTime.toFixed(2)}ms`;
              } else {
                sequencerCpuUsage.textContent = 'N/A';
              }
            }
            
            // Performance comparison
            if (sequencerCpuTime && realTimeCpuTime && performanceGain) {
              const cpuUsage = metrics.cpuUsage;
              if (cpuUsage && cpuUsage.sequencerTime > 0 && cpuUsage.realTimeDetectionTime > 0) {
                sequencerCpuTime.textContent = `${cpuUsage.sequencerTime.toFixed(2)}ms`;
                realTimeCpuTime.textContent = `${cpuUsage.realTimeDetectionTime.toFixed(2)}ms`;
                
                const gain = cpuUsage.realTimeDetectionTime / cpuUsage.sequencerTime;
                performanceGain.textContent = `${gain.toFixed(1)}x faster`;
                performanceGain.style.color = gain > 1 ? '#90ee90' : '#ff9999';
              } else {
                sequencerCpuTime.textContent = '0.0ms';
                realTimeCpuTime.textContent = '0.0ms';
                performanceGain.textContent = 'N/A';
              }
            }
          } else {
            // Reset metrics when disabled
            if (sequencerEventsPerSec) sequencerEventsPerSec.textContent = '0';
            if (sequencerQueueSize) sequencerQueueSize.textContent = '0';
            if (sequencerTimingAccuracy) sequencerTimingAccuracy.textContent = 'N/A';
            if (sequencerCacheHitRate) sequencerCacheHitRate.textContent = 'N/A';
            if (sequencerCpuUsage) sequencerCpuUsage.textContent = 'N/A';
            if (sequencerCpuTime) sequencerCpuTime.textContent = '0.0ms';
            if (realTimeCpuTime) realTimeCpuTime.textContent = '0.0ms';
            if (performanceGain) performanceGain.textContent = 'N/A';
          }
        } else {
          console.log(`[UI] Sequencer functions not available: isSequencerMode=${!!isSequencerMode}, getGlobalSequencer=${!!getGlobalSequencer}`);
        }
      } catch (error) {
        console.warn('[UI] Error updating sequencer metrics:', error);
      }
    }
    
    // Setup sequencer mode checkbox
    if (useSequencerModeCheckbox) {
      // Initialize state
      try {
        useSequencerModeCheckbox.checked = isSequencerMode();
        console.log('[UI] Initial sequencer mode state:', isSequencerMode());
      } catch (error) {
        console.warn('[UI] Could not get initial sequencer state:', error);
        useSequencerModeCheckbox.checked = false;
      }
      
      // Show/hide config section based on initial state
      if (sequencerConfigSection) {
        sequencerConfigSection.style.display = useSequencerModeCheckbox.checked ? 'block' : 'none';
      }
      
      // Handle checkbox change
      useSequencerModeCheckbox.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        
        try {
          // Toggle sequencer mode
          setSequencerMode(enabled);
          console.log(`[UI] Sequencer mode ${enabled ? 'enabled' : 'disabled'}`);
          
          // If enabling sequencer mode, make sure it's initialized and has data
          if (enabled) {
            // Force initialization of the global sequencer
            const { initializeGlobalSequencer } = await import('../geometry/geometry.js');
            initializeGlobalSequencer();
            
            // Get the sequencer and set up some basic test data
            const sequencer = getGlobalSequencer();
            if (sequencer) {
              console.log('[UI] Sequencer initialized, checking for geometry...');
              
              // Enable debug mode by default when first enabling sequencer
              sequencer.setDebugMode(true);
              if (sequencerDebugCheckbox) {
                sequencerDebugCheckbox.checked = true;
              }
              
              // Check if we have any layers with geometry
              if (window._layers && window._layers.layers) {
                console.log(`[UI] Found ${window._layers.layers.length} layers`);
                let hasGeometry = false;
                
                for (const layer of window._layers.layers) {
                  if (layer && layer.visible && layer.geometry) {
                    hasGeometry = true;
                    console.log(`[UI] Layer ${layer.id} has geometry with ${layer.geometry.getAttribute('position')?.count || 0} vertices`);
                  }
                }
                
                if (!hasGeometry) {
                  console.warn('[UI] No visible layers with geometry found. Try creating some geometry first.');
                }
              }
            } else {
              console.error('[UI] Failed to get global sequencer instance');
            }
          }
          
          // Show/hide config section
          if (sequencerConfigSection) {
            sequencerConfigSection.style.display = enabled ? 'block' : 'none';
          }
          
          // Update metrics immediately
          updateSequencerMetrics();
          
        } catch (error) {
          console.error('[UI] Error toggling sequencer mode:', error);
          // Revert checkbox state on error
          useSequencerModeCheckbox.checked = !enabled;
        }
      });
    }
    
    // Setup sequencer configuration controls
    if (sequencerLookAheadRange && sequencerLookAheadNumber && sequencerLookAheadValue) {
      const syncLookAhead = () => {
        const value = parseFloat(sequencerLookAheadRange.value);
        sequencerLookAheadNumber.value = value;
        sequencerLookAheadValue.textContent = value;
        
        // Update sequencer config
        try {
          const sequencer = getGlobalSequencer();
          if (sequencer) {
            sequencer.config.lookAheadTime = value / 1000; // Convert ms to seconds
            console.log(`[UI] Updated look-ahead time to ${value}ms`);
          }
        } catch (error) {
          console.warn('[UI] Error updating look-ahead time:', error);
        }
      };
      
      sequencerLookAheadRange.addEventListener('input', syncLookAhead);
      sequencerLookAheadNumber.addEventListener('input', e => {
        sequencerLookAheadRange.value = e.target.value;
        syncLookAhead();
      });
    }
    
    if (sequencerPrecisionRange && sequencerPrecisionNumber && sequencerPrecisionValue) {
      const syncPrecision = () => {
        const value = parseFloat(sequencerPrecisionRange.value);
        sequencerPrecisionNumber.value = value;
        sequencerPrecisionValue.textContent = value.toFixed(1);
        
        // Update sequencer config
        try {
          const sequencer = getGlobalSequencer();
          if (sequencer) {
            sequencer.config.timingPrecision = value / 1000; // Convert ms to seconds
            console.log(`[UI] Updated timing precision to ${value}ms`);
          }
        } catch (error) {
          console.warn('[UI] Error updating timing precision:', error);
        }
      };
      
      sequencerPrecisionRange.addEventListener('input', syncPrecision);
      sequencerPrecisionNumber.addEventListener('input', e => {
        sequencerPrecisionRange.value = e.target.value;
        syncPrecision();
      });
    }
    
    if (sequencerMaxQueueRange && sequencerMaxQueueNumber && sequencerMaxQueueValue) {
      const syncMaxQueue = () => {
        const value = parseInt(sequencerMaxQueueRange.value);
        sequencerMaxQueueNumber.value = value;
        sequencerMaxQueueValue.textContent = value;
        
        // Update sequencer config
        try {
          const sequencer = getGlobalSequencer();
          if (sequencer) {
            sequencer.config.maxQueueSize = value;
            console.log(`[UI] Updated max queue size to ${value}`);
          }
        } catch (error) {
          console.warn('[UI] Error updating max queue size:', error);
        }
      };
      
      sequencerMaxQueueRange.addEventListener('input', syncMaxQueue);
      sequencerMaxQueueNumber.addEventListener('input', e => {
        sequencerMaxQueueRange.value = e.target.value;
        syncMaxQueue();
      });
    }
    
    // Setup debug mode checkbox
    if (sequencerDebugCheckbox) {
      sequencerDebugCheckbox.addEventListener('change', e => {
        const enabled = e.target.checked;
        
        try {
          const sequencer = getGlobalSequencer();
          if (sequencer && typeof sequencer.setDebugMode === 'function') {
            sequencer.setDebugMode(enabled);
            console.log(`[UI] Sequencer debug mode ${enabled ? 'enabled' : 'disabled'}`);
          }
        } catch (error) {
          console.warn('[UI] Error setting debug mode:', error);
        }
      });
    }
    
    // Setup refresh metrics button
    if (refreshMetricsBtn) {
      refreshMetricsBtn.addEventListener('click', updateSequencerMetrics);
    }
    
    // Update metrics periodically when sequencer is active
    setInterval(() => {
      if (useSequencerModeCheckbox && useSequencerModeCheckbox.checked) {
        updateSequencerMetrics();
      }
    }, 1000); // Update every second
    
    // Initial metrics update
    updateSequencerMetrics();
    
    console.log('[UI] Sequencer UI controls initialized successfully');
  }

  // Start the async initialization
  initializeSequencerUI();

  // Link UI controls to state with specific Number type conversions and null checks
  if (bpmRange && bpmNumber && bpmValue) {
    syncPair(bpmRange, bpmNumber, bpmValue, 
      function setBpm(value) {
        // BPM should always be a global parameter
        const globalState = window._globalState || state;
        globalState.setBpm(Number(value));
      }, 
      UI_RANGES.BPM[0], UI_RANGES.BPM[1], 
      Number);
  }
  
  if (radiusRange && radiusNumber && radiusValue) {
    syncPair(radiusRange, radiusNumber, radiusValue, 
      function setRadius(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setRadius(Number(value));
      }, 
      UI_RANGES.RADIUS[0], UI_RANGES.RADIUS[1], 
      Number);
  }
  
  if (copiesRange && copiesNumber && copiesValue) {
    syncPair(copiesRange, copiesNumber, copiesValue, 
      function setCopies(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setCopies(Number(value));
      }, 
      UI_RANGES.COPIES[0], UI_RANGES.COPIES[1], 
      Number);
  }
  
  if (stepScaleRange && stepScaleNumber && stepScaleValue) {
    syncPair(stepScaleRange, stepScaleNumber, stepScaleValue, 
      function setStepScale(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setStepScale(Number(value));
      }, 
      UI_RANGES.STEP_SCALE[0], UI_RANGES.STEP_SCALE[1], 
      Number);
  }
  
  if (angleRange && angleNumber && angleValue) {
    syncPair(angleRange, angleNumber, angleValue, 
      function setAngle(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setAngle(Number(value));
      }, 
      UI_RANGES.ANGLE[0], UI_RANGES.ANGLE[1], 
      Number);
  }
  
  if (startingAngleRange && startingAngleNumber && startingAngleValue) {
    syncPair(startingAngleRange, startingAngleNumber, startingAngleValue, 
      function setStartingAngle(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setStartingAngle(Number(value));
      }, 
      UI_RANGES.STARTING_ANGLE[0], UI_RANGES.STARTING_ANGLE[1], 
      Number);
  }
  
  if (numberRange && numberNumber && numberValue) {
    syncPair(numberRange, numberNumber, numberValue, 
      function setSegments(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setSegments(Math.round(Number(value)));
      }, 
      UI_RANGES.SEGMENTS[0], UI_RANGES.SEGMENTS[1], 
      Number);
  }
    
  if (lerpTimeRange && lerpTimeNumber && lerpTimeValue) {
    syncPair(lerpTimeRange, lerpTimeNumber, lerpTimeValue, 
      function setLerpTime(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setLerpTime(Number(value));
      }, 
      0.1, 5.0, 
      Number);
  }
    
  // Link Scale Mod UI controls to state with proper formatting
  if (altScaleRange && altScaleNumber && altScaleValue) {
    syncPair(altScaleRange, altScaleNumber, altScaleValue, 
      function setAltScale(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setAltScale(Number(value));
      }, 
      UI_RANGES.ALT_SCALE[0], UI_RANGES.ALT_SCALE[1], 
      Number);
  }
  
  if (altStepNRange && altStepNNumber && altStepNValue) {
    syncPair(altStepNRange, altStepNNumber, altStepNValue, 
      function setAltStepN(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setAltStepN(Number(value));
      }, 
      UI_RANGES.ALT_STEP_N[0], UI_RANGES.ALT_STEP_N[1], 
      Number);
  }

  // Reference frequency controls are now handled in setupGlobalUI in main.js
  
  // Link fractal controls
  if (fractalRange && fractalNumber && fractalValue) {
    syncPair(fractalRange, fractalNumber, fractalValue,
      function setFractalValue(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setFractalValue(Number(value));
      },
      UI_RANGES.FRACTAL_VALUE[0], UI_RANGES.FRACTAL_VALUE[1],
      Number);
  }
  
  // Link Euclidean rhythm controls
  if (euclidRange && euclidNumber && euclidValue) {
    syncPair(euclidRange, euclidNumber, euclidValue,
      function setEuclidValue(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setEuclidValue(Number(value));
        updateEuclidInfo();
      },
      1, 12,
      Number);
    // Initial update
    updateEuclidInfo();
  }
  
  // Link Delete controls
  if (deleteMinRange && deleteMinNumber && deleteMinValue) {
    syncPair(deleteMinRange, deleteMinNumber, deleteMinValue,
      function setDeleteMin(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setDeleteMin(Number(value));
      },
      1, 8,
      Number);
  }
  
  if (deleteMaxRange && deleteMaxNumber && deleteMaxValue) {
    syncPair(deleteMaxRange, deleteMaxNumber, deleteMaxValue,
      function setDeleteMax(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setDeleteMax(Number(value));
      },
      1, 8,
      Number);
  }
  
  if (deleteSeedRange && deleteSeedNumber && deleteSeedValue) {
    syncPair(deleteSeedRange, deleteSeedNumber, deleteSeedValue,
      function setDeleteSeed(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setDeleteSeed(Number(value));
      },
      0, 999,
      Number);
  }
    
  // Link duration controls
  if (minDurationRange && minDurationNumber && minDurationValue) {
    syncPair(minDurationRange, minDurationNumber, minDurationValue,
      function setMinDuration(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setMinDuration(Number(value));
      },
      0.01, 1.0,
      Number);
  }
    
  if (maxDurationRange && maxDurationNumber && maxDurationValue) {
    syncPair(maxDurationRange, maxDurationNumber, maxDurationValue,
      function setMaxDuration(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setMaxDuration(Number(value));
      },
      0.01, 2.0,
      Number);
  }
    
  // Link velocity controls
  if (minVelocityRange && minVelocityNumber && minVelocityValue) {
    syncPair(minVelocityRange, minVelocityNumber, minVelocityValue,
      function setMinVelocity(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setMinVelocity(Number(value));
      },
      0.1, 0.9,
      Number);
  }
    
  if (maxVelocityRange && maxVelocityNumber && maxVelocityValue) {
    syncPair(maxVelocityRange, maxVelocityNumber, maxVelocityValue,
      function setMaxVelocity(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setMaxVelocity(Number(value));
      },
      0.2, 1.0,
      Number);
  }

  // Add this in the appropriate place in the function (right before or after the other duration controls)
  if (durationPhaseRange && durationPhaseNumber && durationPhaseValue) {
    syncPair(durationPhaseRange, durationPhaseNumber, durationPhaseValue,
      function setDurationPhase(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setDurationPhase(Number(value));
      },
      0, 1.0,
      Number);
  }

  // Add velocity phase UI elements
  const velocityPhaseRange = document.getElementById('velocityPhaseRange');
  const velocityPhaseNumber = document.getElementById('velocityPhaseNumber');
  const velocityPhaseValue = document.getElementById('velocityPhaseValue');
  
  // Set initial values for velocity phase with null checks
  if (velocityPhaseRange && velocityPhaseNumber && velocityPhaseValue) {
    velocityPhaseRange.value = state.velocityPhase || 0;
    velocityPhaseNumber.value = state.velocityPhase || 0;
    velocityPhaseValue.textContent = (state.velocityPhase || 0).toFixed(2);
  }

  // Add this alongside the other velocity controls
  if (velocityPhaseRange && velocityPhaseNumber && velocityPhaseValue) {
    syncPair(velocityPhaseRange, velocityPhaseNumber, velocityPhaseValue,
      function setVelocityPhase(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setVelocityPhase(Number(value));
      },
      0, 1.0,
      Number);
  }

  // Update Euclidean rhythm info
  function updateEuclidInfo() {
    if (validEuclidInfo) {
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
      const n = activeState.segments;
      const k = activeState.euclidValue;
      
      // Make sure k is at most n
      const effectiveK = Math.min(k, n);
      
      validEuclidInfo.textContent = `Current Euclidean pattern: ${effectiveK} vertices evenly distributed from a ${n}-sided polygon`;
      
      // If k > n, add a warning
      if (k > n) {
        validEuclidInfo.innerHTML += `<br><span style="color: #ff8866;">Note: Only using ${n} vertices since that's the maximum for this shape</span>`;
      }
    }
  }
  
  // Setup a listener for segment changes to update Euclidean info
  if (numberRange) {
    numberRange.addEventListener('input', updateEuclidInfo);
    numberRange.addEventListener('change', updateEuclidInfo);
  }
  
  // Initial update
  updateEuclidInfo();

  // Link star polygon controls
  if (starSkipRadioGroup && validSkipsInfo) {
    setupStarSkipRadioButtons(starSkipRadioGroup, state);
  }

  // Update valid skips information when segments change
  if (numberRange && validSkipsInfo) {
    numberRange.addEventListener('input', updateValidSkips);
    numberNumber.addEventListener('input', updateValidSkips);
    
    // Initial update
    updateValidSkips();
    
    // Function to update valid skips information
    function updateValidSkips() {
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
      
      const n = activeState.segments;
      const validSkips = activeState.getValidStarSkips();
      validSkipsInfo.textContent = `Valid skips for ${getPolygonName(n)} (n=${n}): ${validSkips.join(', ')}`;
      
      // Update the star skip radio buttons 
      if (starSkipRadioGroup) {
        setupStarSkipRadioButtons(starSkipRadioGroup, activeState);
      }
      
      // Ensure the current skip value is valid
      if (validSkips.length > 0) {
        // Set skip to first valid skip if current value is not valid
        if (!validSkips.includes(activeState.starSkip)) {
          
          activeState.setStarSkip(validSkips[0]);
        } else {
          
        }
      }
    }
    
    // Helper function to get polygon name
    function getPolygonName(sides) {
      const names = {
        3: 'triangle',
        4: 'square',
        5: 'pentagon',
        6: 'hexagon',
        7: 'heptagon',
        8: 'octagon',
        9: 'nonagon',
        10: 'decagon',
        11: 'hendecagon',
        12: 'dodecagon'
      };
      return names[sides] || `${sides}-gon`;
    }
  }



  // Set initial values for fractal controls from state with null checks
  if (fractalRange && fractalNumber && fractalValue) {
    fractalRange.value = state.fractalValue;
    fractalNumber.value = state.fractalValue;
    fractalValue.textContent = state.fractalValue;
  }
  
  // Set initial values for Euclidean rhythm controls from state with null checks
  if (euclidRange && euclidNumber && euclidValue) {
    euclidRange.value = state.euclidValue;
    euclidNumber.value = state.euclidValue;
    euclidValue.textContent = state.euclidValue;
  }
  
  // Set initial values for Delete controls from state with null checks
  if (deleteMinRange && deleteMinNumber && deleteMinValue) {
    deleteMinRange.value = state.deleteMin;
    deleteMinNumber.value = state.deleteMin;
    deleteMinValue.textContent = state.deleteMin;
  }
  
  if (deleteMaxRange && deleteMaxNumber && deleteMaxValue) {
    deleteMaxRange.value = state.deleteMax;
    deleteMaxNumber.value = state.deleteMax;
    deleteMaxValue.textContent = state.deleteMax;
  }
  
  if (deleteSeedRange && deleteSeedNumber && deleteSeedValue) {
    deleteSeedRange.value = state.deleteSeed;
    deleteSeedNumber.value = state.deleteSeed;
    deleteSeedValue.textContent = state.deleteSeed;
  }

  // Add event listeners for layer change events
  window.addEventListener('layerChanged', (event) => {
    const { layerId, state } = event.detail;
    
    // Pass all UI elements to ensure complete update
    updateUIFromState(state, {
      bpmRange, bpmNumber, bpmValue,
      radiusRange, radiusNumber, radiusValue,
      copiesRange, copiesNumber, copiesValue,
      stepScaleRange, stepScaleNumber, stepScaleValue,
      angleRange, angleNumber, angleValue,
      startingAngleRange, startingAngleNumber, startingAngleValue,
      numberRange, numberNumber, numberValue,
      useLerpCheckbox, lerpTimeRange, lerpTimeNumber, lerpTimeValue,
      /* Modulus checkbox removed */ modulusRadioGroup,
      /* Time subdivision checkbox removed */ timeSubdivisionRadioGroup,
      useQuantizationCheckbox, quantizationRadioGroup,
      altScaleRange, altScaleNumber, altScaleValue,
      altStepNRange, altStepNNumber, altStepNValue,
      useIntersectionsCheckbox, 
      showAxisFreqLabelsCheckbox,
      showPointsFreqLabelsCheckbox,
      pointLabelShowLayerIdCheckbox,
      pointLabelShowFrequencyCheckbox,
      pointLabelShowDurationCheckbox,
      pointLabelShowVelocityCheckbox,
      useEqualTemperamentCheckbox,
      referenceFreqRange, referenceFreqNumber, referenceFreqValue,
      fractalRange, fractalNumber, fractalValue,
      useFractalCheckbox,
      euclidRange, euclidNumber, euclidValue,
      useEuclidCheckbox, validEuclidInfo,
      starSkipRadioGroup, useStarsCheckbox, validSkipsInfo,
      useCutsCheckbox,
      useTesselationCheckbox,
      useDeleteCheckbox,
      deleteMinRange, deleteMinNumber, deleteMinValue,
      deleteMaxRange, deleteMaxNumber, deleteMaxValue,
      deleteModeRadios, deleteTargetRadios,
      deleteSeedRange, deleteSeedNumber, deleteSeedValue,
      durationModeRadios, durationModuloRadioGroup,
      minDurationRange, minDurationNumber, minDurationValue,
      maxDurationRange, maxDurationNumber, maxDurationValue,
      durationPhaseRange, durationPhaseNumber, durationPhaseValue,
      velocityModeRadios, velocityModuloRadioGroup,
      minVelocityRange, minVelocityNumber, minVelocityValue,
      maxVelocityRange, maxVelocityNumber, maxVelocityValue
    });
  });

  window.addEventListener('layerActivated', (event) => {
    const { layerId, state } = event.detail;
    
    // Pass all UI elements to ensure complete update
    updateUIFromState(state, {
      bpmRange, bpmNumber, bpmValue,
      radiusRange, radiusNumber, radiusValue,
      copiesRange, copiesNumber, copiesValue,
      stepScaleRange, stepScaleNumber, stepScaleValue,
      angleRange, angleNumber, angleValue,
      startingAngleRange, startingAngleNumber, startingAngleValue,
      numberRange, numberNumber, numberValue,
      useLerpCheckbox, lerpTimeRange, lerpTimeNumber, lerpTimeValue,
      /* Modulus checkbox removed */ modulusRadioGroup,
      /* Time subdivision checkbox removed */ timeSubdivisionRadioGroup,
      useQuantizationCheckbox, quantizationRadioGroup,
      altScaleRange, altScaleNumber, altScaleValue,
      altStepNRange, altStepNNumber, altStepNValue,
      useIntersectionsCheckbox, 
      showAxisFreqLabelsCheckbox,
      showPointsFreqLabelsCheckbox,
      pointLabelShowLayerIdCheckbox,
      pointLabelShowFrequencyCheckbox,
      pointLabelShowDurationCheckbox,
      pointLabelShowVelocityCheckbox,
      useEqualTemperamentCheckbox,
      referenceFreqRange, referenceFreqNumber, referenceFreqValue,
      fractalRange, fractalNumber, fractalValue,
      useFractalCheckbox,
      euclidRange, euclidNumber, euclidValue,
      useEuclidCheckbox, validEuclidInfo,
      starSkipRadioGroup, useStarsCheckbox, validSkipsInfo,
      useCutsCheckbox,
      useTesselationCheckbox,
      useDeleteCheckbox,
      deleteMinRange, deleteMinNumber, deleteMinValue,
      deleteMaxRange, deleteMaxNumber, deleteMaxValue,
      deleteModeRadios, deleteTargetRadios,
      deleteSeedRange, deleteSeedNumber, deleteSeedValue,
      durationModeRadios, durationModuloRadioGroup,
      minDurationRange, minDurationNumber, minDurationValue,
      maxDurationRange, maxDurationNumber, maxDurationValue,
      durationPhaseRange, durationPhaseNumber, durationPhaseValue,
      velocityModeRadios, velocityModuloRadioGroup,
      minVelocityRange, minVelocityNumber, minVelocityValue,
      maxVelocityRange, maxVelocityNumber, maxVelocityValue
    });
  });

  return {
    bpmRange, bpmNumber, bpmValue,
    radiusRange, radiusNumber, radiusValue,
    copiesRange, copiesNumber, copiesValue,
    stepScaleRange, stepScaleNumber, stepScaleValue,
    angleRange, angleNumber, angleValue,
    startingAngleRange, startingAngleNumber, startingAngleValue,
    numberRange, numberNumber, numberValue,
    useLerpCheckbox, lerpTimeRange, lerpTimeNumber, lerpTimeValue,
    /* Modulus checkbox removed */ modulusRadioGroup,
    /* Time subdivision checkbox removed */ timeSubdivisionRadioGroup,
    useQuantizationCheckbox, quantizationRadioGroup,
    altScaleRange, altScaleNumber, altScaleValue,
    altStepNRange, altStepNNumber, altStepNValue,
    useIntersectionsCheckbox, 
    showAxisFreqLabelsCheckbox,
    showPointsFreqLabelsCheckbox,
    pointLabelShowLayerIdCheckbox,
    pointLabelShowFrequencyCheckbox,
    pointLabelShowDurationCheckbox,
    pointLabelShowVelocityCheckbox,
    useEqualTemperamentCheckbox,
    referenceFreqRange, referenceFreqNumber, referenceFreqValue,
    fractalRange, fractalNumber, fractalValue,
    useFractalCheckbox,
    euclidRange, euclidNumber, euclidValue,
    useEuclidCheckbox, validEuclidInfo,
    starSkipRadioGroup,
    useStarsCheckbox, validSkipsInfo,
    useCutsCheckbox,
    useTesselationCheckbox,
    useDeleteCheckbox,
    deleteMinRange, deleteMinNumber, deleteMinValue,
    deleteMaxRange, deleteMaxNumber, deleteMaxValue,
    deleteModeRadios, deleteTargetRadios,
    deleteSeedRange, deleteSeedNumber, deleteSeedValue,
    
    // Note parameter controls
    durationModeRadios, durationModuloRadioGroup,
    minDurationRange, minDurationNumber, minDurationValue,
    maxDurationRange, maxDurationNumber, maxDurationValue,
    durationPhaseRange, durationPhaseNumber, durationPhaseValue,
    
    velocityModeRadios, velocityModuloRadioGroup,
    minVelocityRange, minVelocityNumber, minVelocityValue,
    maxVelocityRange, maxVelocityNumber, maxVelocityValue
  };
}