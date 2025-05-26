// src/ui/ui.js - Updated with Number parameter rounding fix
import { UI_RANGES, QUANTIZATION_VALUES } from '../config/constants.js';
import { ParameterMode } from '../notes/notes.js';

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
        // Get the current active layer state
        const activeState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
          
        if (type === 'duration') {
          activeState.setDurationModulo(i);
        } else if (type === 'velocity') {
          activeState.setVelocityModulo(i);
        } else {
          activeState.setModulusValue(i);
          
          // Auto-enable modulus if value is not 1 (default)
          const isDefault = i === 1;
          activeState.setUseModulus(!isDefault);
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
        // Get the current active layer state
        const activeState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        
        // Set time subdivision value on the active layer
        activeState.setTimeSubdivisionValue(parseFloat(value));
        
        // Auto-enable time subdivision if value is not 1 (default)
        const isDefault = Math.abs(parseFloat(value) - 1.0) < 0.001;
        activeState.setUseTimeSubdivision(!isDefault);
        
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
        state.setQuantizationValue(value);
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
        // Get the current active layer state at the time of the event
        const currentActiveState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        currentActiveState.setStarSkip(skipValue);
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

  const useAltScaleCheckbox = document.getElementById('useAltScaleCheckbox');
  
  // DEPRECATED: Intersections control - functionality removed
  const useIntersectionsCheckbox = document.getElementById('useIntersectionsCheckbox');

  // Get UI elements for display settings
  const showAxisFreqLabelsCheckbox = document.getElementById('showAxisFreqLabelsCheckbox');
  const showPointsFreqLabelsCheckbox = document.getElementById('showPointsFreqLabelsCheckbox');
  
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
  const validSkipsInfo = document.getElementById('validSkipsInfo');
  
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
  if (useAltScaleCheckbox) useAltScaleCheckbox.checked = state.useAltScale;
  // Time subdivision checkbox removed
  // Equal temperament checkbox initialization is now handled in setupGlobalUI in main.js
  if (useQuantizationCheckbox) useQuantizationCheckbox.checked = state.useQuantization;
  if (useFractalCheckbox) useFractalCheckbox.checked = state.useFractal;
  if (useStarsCheckbox) useStarsCheckbox.checked = state.useStars;
  if (useCutsCheckbox) useCutsCheckbox.checked = state.useCuts;
  if (useLerpCheckbox) useLerpCheckbox.checked = state.useLerp;
  
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
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
      
      activeState.setShowAxisFreqLabels(e.target.checked);
    });
  }

  if (showPointsFreqLabelsCheckbox) {
    showPointsFreqLabelsCheckbox.addEventListener('change', e => {
      state.setShowPointsFreqLabels(e.target.checked);
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
  
  // Modulus checkbox is removed - now automatically handled by radio button selection
  
  // Time subdivision checkbox is removed - now automatically handled by radio button selection
  
  // Setup quantization checkbox with null check
  if (useQuantizationCheckbox) {
    useQuantizationCheckbox.checked = state.useQuantization;
    useQuantizationCheckbox.addEventListener('change', e => {
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
        
      activeState.setUseQuantization(e.target.checked);
    });
  }
  
  // Setup alt scale checkbox with null check
  if (useAltScaleCheckbox) {
    useAltScaleCheckbox.checked = state.useAltScale;
    useAltScaleCheckbox.addEventListener('change', e => {
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
        
      activeState.setUseAltScale(e.target.checked);
    });
  }
  
  // Equal temperament checkbox is now handled in setupGlobalUI in main.js
  
  // Setup fractal checkbox with null check
  if (useFractalCheckbox) {
    useFractalCheckbox.checked = state.useFractal;
    useFractalCheckbox.addEventListener('change', e => {
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
        
      activeState.setUseFractal(e.target.checked);
    });
  }
  
  // Setup stars checkbox with null check
  if (useStarsCheckbox) {
    useStarsCheckbox.checked = state.useStars;
    useStarsCheckbox.addEventListener('change', e => {
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
        
      activeState.setUseStars(e.target.checked);
    });
  }
  
  // Setup cuts checkbox with null check
  if (useCutsCheckbox) {
    useCutsCheckbox.checked = state.useCuts;
    useCutsCheckbox.addEventListener('change', e => {
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
        
      activeState.setUseCuts(e.target.checked);
    });
  }
  
  // Setup plain intersections checkbox
  if (useIntersectionsCheckbox) {
    useIntersectionsCheckbox.addEventListener('change', e => {
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
      activeState.setUsePlainIntersections(e.target.checked);
    });
  }

  // Setup duration mode radio buttons with null check
  if (durationModeRadios && durationModeRadios.length > 0) {
    durationModeRadios.forEach(radio => {
      // Check the one that matches the current state
      if (radio.value === state.durationMode) {
        radio.checked = true;
      }
      
      // Add event listener
      radio.addEventListener('change', e => {
        if (e.target.checked) {
          // Get the current active layer state
          const activeState = typeof window.getActiveState === 'function' ? 
            window.getActiveState() : state;
            
          activeState.setDurationMode(e.target.value);
        }
      });
    });
  }
  
  // Setup velocity mode radio buttons with null check
  if (velocityModeRadios && velocityModeRadios.length > 0) {
    velocityModeRadios.forEach(radio => {
      // Check the one that matches the current state
      if (radio.value === state.velocityMode) {
        radio.checked = true;
      }
      
      // Add event listener
      radio.addEventListener('change', e => {
        if (e.target.checked) {
          // Get the current active layer state
          const activeState = typeof window.getActiveState === 'function' ? 
            window.getActiveState() : state;
            
          activeState.setVelocityMode(e.target.value);
        }
      });
    });
  }

  // Sync control values with the UI
  const syncPair = (rangeEl, numEl, spanEl, setter, min, max, parser = v => parseFloat(v)) => {
    // Setup initial values
    const initialValue = typeof spanEl.textContent === 'string' ? 
      parseFloat(spanEl.textContent) : 
      parseInt(spanEl.textContent);
    
    // Setup event listeners
    rangeEl.addEventListener('input', e => {
      let v = parser(e.target.value);
      
      // Special case for Number parameter - always round to integers
      if (rangeEl.id === 'numberRange') {
        v = Math.round(v);
      }
      
      v = Math.min(Math.max(v, min), max);
      
      // Get the setter name from the setter function
      const setterName = setter.name;
      
      // FIXED: Get the target state with improved error handling
      const { state: targetState, isGlobal, id, valid } = getTargetState(setterName);
      
      // FIXED: Enhanced validation and error handling
      if (!targetState) {
        console.error(`[UI] No target state found for ${setterName}, skipping update`);
        return;
      }
      
      // Log state routing for debugging (only if not valid to avoid spam)
      if (!valid) {
        
      }
      
      try {
        if (isGlobal) {
          // Find the setter name by removing 'Range' from the ID
          const paramName = rangeEl.id.replace('Range', '');
          // Convert to camelCase setter name (e.g., 'bpm' -> 'setBpm')
          const globalSetterName = 'set' + paramName.charAt(0).toUpperCase() + paramName.slice(1);
          
          // Call the setter on globalState if it exists
          if (typeof targetState[globalSetterName] === 'function') {
            targetState[globalSetterName](v);
            
          } else {
            
          }
        } else {
          // Call the setter on the layer state
          if (typeof setter === 'function') {
            setter.call(targetState, v);
            
          } else {
            
          }
        }
      } catch (error) {
        console.error(`[UI] Error calling setter ${setterName}:`, error);
      }
      
      spanEl.textContent = parser === parseFloat ? v.toFixed(1) : v;
      numEl.value = v;
    });
    
    // Setup event listeners for number inputs
    numEl.addEventListener('input', e => {
      let v = parser(e.target.value);
      
      // Special case for Number parameter - always round to integers
      if (numEl.id === 'numberNumber') {
        v = Math.round(v);
      }
      
      v = Math.min(Math.max(v || min, min), max);
      
      // Get the setter name from the setter function
      const setterName = setter.name;
      
      // FIXED: Get the target state with improved error handling
      const { state: targetState, isGlobal, id, valid } = getTargetState(setterName);
      
      // FIXED: Enhanced validation and error handling
      if (!targetState) {
        console.error(`[UI] No target state found for ${setterName}, skipping update`);
        return;
      }
      
      // Log state routing for debugging (only if not valid to avoid spam)
      if (!valid) {
        
      }
      
      try {
        if (isGlobal) {
          // Find the setter name by removing 'Number' from the ID
          const paramName = numEl.id.replace('Number', '');
          // Convert to camelCase setter name (e.g., 'bpm' -> 'setBpm')
          const globalSetterName = 'set' + paramName.charAt(0).toUpperCase() + paramName.slice(1);
          
          // Call the setter on globalState if it exists
          if (typeof targetState[globalSetterName] === 'function') {
            targetState[globalSetterName](v);
            
          } else {
            
          }
        } else {
          // Call the setter on the layer state
          if (typeof setter === 'function') {
            setter.call(targetState, v);
            
          } else {
            
          }
        }
      } catch (error) {
        console.error(`[UI] Error calling setter ${setterName}:`, error);
      }
      
      spanEl.textContent = parser === parseFloat ? v.toFixed(1) : v;
      rangeEl.value = v;
    });
  };
  
  // Setup checkbox event listener for lerp toggle with null check
  if (useLerpCheckbox) {
    useLerpCheckbox.addEventListener('change', e => {
      // FIXED: Use the same robust state routing approach as other UI elements
      try {
        // Get target state using the same approach as other UI controls
        const { state: targetState, id, valid } = getTargetState('setUseLerp');
        
        if (!targetState) {
          console.error('[UI] No target state found for setUseLerp, skipping update');
          return;
        }
        
        // Log state routing for debugging (only if not valid to avoid spam)
        if (!valid) {
          
        }
        
        if (typeof targetState.setUseLerp === 'function') {
          targetState.setUseLerp(e.target.checked);
          
        } else {
          
          
          // Fallback to the original approach if the method doesn't exist
          if (typeof window.getActiveState === 'function') {
            const activeState = window.getActiveState();
            if (activeState && typeof activeState.setUseLerp === 'function') {
              activeState.setUseLerp(e.target.checked);
              
            }
          } else {
            // Last resort fallback to the original state
            if (typeof state.setUseLerp === 'function') {
              state.setUseLerp(e.target.checked);
            }
          }
        }
      } catch (error) {
        console.error('[UI] Error setting useLerp:', error);
        
        // Ultimate fallback to prevent UI from breaking
        if (typeof state.setUseLerp === 'function') {
          state.setUseLerp(e.target.checked);
        }
      }
    });
  }

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

  const euclidRange = document.getElementById('euclidRange');
  const euclidNumber = document.getElementById('euclidNumber');
  const euclidValue = document.getElementById('euclidValue');
  const useEuclidCheckbox = document.getElementById('useEuclidCheckbox');
  const validEuclidInfo = document.getElementById('validEuclidInfo');
  
  // Setup Euclidean rhythm checkbox with null check
  if (useEuclidCheckbox) {
    useEuclidCheckbox.checked = state.useEuclid;
    useEuclidCheckbox.addEventListener('change', e => {
      state.setUseEuclid(e.target.checked);
    });
  }
  
  // Update Euclidean rhythm info
  function updateEuclidInfo() {
    if (validEuclidInfo) {
      const n = state.segments;
      const k = state.euclidValue;
      
      // Make sure k is at most n
      const effectiveK = Math.min(k, n);
      
      validEuclidInfo.textContent = `Current Euclidean pattern: ${effectiveK} vertices evenly distributed from a ${n}-sided polygon`;
      
      // If k > n, add a warning
      if (k > n) {
        validEuclidInfo.innerHTML += `<br><span style="color: #ff8866;">Note: Only using ${n} vertices since that's the maximum for this shape</span>`;
      }
    }
  }
  
  // Link Euclidean rhythm controls
  if (euclidRange && euclidNumber && euclidValue) {
    syncPair(euclidRange, euclidNumber, euclidValue,
      value => {
        state.setEuclidValue(Number(value));
        updateEuclidInfo();
      },
      UI_RANGES.EUCLID_VALUE[0], UI_RANGES.EUCLID_VALUE[1],
      Number);
    // Initial update
    updateEuclidInfo();
  }
  
  // Setup a listener for segment changes to update Euclidean info
  if (numberRange) {
    numberRange.addEventListener('input', updateEuclidInfo);
    numberRange.addEventListener('change', updateEuclidInfo);
  }
  
  // Initial update
  updateEuclidInfo();

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
      numberRange, numberNumber, numberValue,
      useLerpCheckbox, lerpTimeRange, lerpTimeNumber, lerpTimeValue,
      /* Modulus checkbox removed */ modulusRadioGroup,
      /* Time subdivision checkbox removed */ timeSubdivisionRadioGroup,
      useQuantizationCheckbox, quantizationRadioGroup,
      altScaleRange, altScaleNumber, altScaleValue,
      altStepNRange, altStepNNumber, altStepNValue,
      useAltScaleCheckbox, useIntersectionsCheckbox, 
      showAxisFreqLabelsCheckbox, showPointsFreqLabelsCheckbox,
      useEqualTemperamentCheckbox,
      referenceFreqRange, referenceFreqNumber, referenceFreqValue,
      fractalRange, fractalNumber, fractalValue,
      useFractalCheckbox,
      euclidRange, euclidNumber, euclidValue,
      useEuclidCheckbox, validEuclidInfo,
      starSkipRadioGroup, useStarsCheckbox, validSkipsInfo,
      useCutsCheckbox,
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
      numberRange, numberNumber, numberValue,
      useLerpCheckbox, lerpTimeRange, lerpTimeNumber, lerpTimeValue,
      /* Modulus checkbox removed */ modulusRadioGroup,
      /* Time subdivision checkbox removed */ timeSubdivisionRadioGroup,
      useQuantizationCheckbox, quantizationRadioGroup,
      altScaleRange, altScaleNumber, altScaleValue,
      altStepNRange, altStepNNumber, altStepNValue,
      useAltScaleCheckbox, useIntersectionsCheckbox, 
      showAxisFreqLabelsCheckbox, showPointsFreqLabelsCheckbox,
      useEqualTemperamentCheckbox,
      referenceFreqRange, referenceFreqNumber, referenceFreqValue,
      fractalRange, fractalNumber, fractalValue,
      useFractalCheckbox,
      euclidRange, euclidNumber, euclidValue,
      useEuclidCheckbox, validEuclidInfo,
      starSkipRadioGroup, useStarsCheckbox, validSkipsInfo,
      useCutsCheckbox,
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
    numberRange, numberNumber, numberValue,
    useLerpCheckbox, lerpTimeRange, lerpTimeNumber, lerpTimeValue,
    /* Modulus checkbox removed */ modulusRadioGroup,
    /* Time subdivision checkbox removed */ timeSubdivisionRadioGroup,
    useQuantizationCheckbox, quantizationRadioGroup,
    altScaleRange, altScaleNumber, altScaleValue,
    altStepNRange, altStepNNumber, altStepNValue,
    useAltScaleCheckbox,
    useIntersectionsCheckbox, 
    showAxisFreqLabelsCheckbox,
    showPointsFreqLabelsCheckbox,
    useEqualTemperamentCheckbox,
    referenceFreqRange, referenceFreqNumber, referenceFreqValue,
    fractalRange, fractalNumber, fractalValue,
    useFractalCheckbox,
    euclidRange, euclidNumber, euclidValue,
    useEuclidCheckbox, validEuclidInfo,
    starSkipRadioGroup,
    useStarsCheckbox, validSkipsInfo,
    useCutsCheckbox,
    
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