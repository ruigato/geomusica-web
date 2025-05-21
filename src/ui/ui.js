// src/ui/ui.js - Updated with robust state access and error handling
import { UI_RANGES, QUANTIZATION_VALUES } from '../config/constants.js';
import { ParameterMode } from '../notes/notes.js';

/**
 * Safely access state properties with defaults
 * @param {Object} state - Application state object
 * @param {string} prop - Property path to access (e.g., 'timeSubdivisionValue')
 * @param {*} defaultValue - Default value if property is undefined
 * @returns {*} The property value or default
 */
function getStateValue(state, prop, defaultValue) {
  if (!state) return defaultValue;
  
  // Special handling for nested properties if needed
  const value = state[prop];
  return value !== undefined ? value : defaultValue;
}

// Define default values for all state properties
const defaultState = {
  // Modulus values
  modulusValue: 2,
  durationModulo: 3,
  velocityModulo: 4,
  
  // Time and subdivision
  timeSubdivisionValue: 1.0,
  
  // Duration and velocity
  minDuration: 0.1,
  maxDuration: 0.5,
  minVelocity: 0.3,
  maxVelocity: 0.9,
  
  // Toggles and flags
  showAxisFreqLabels: false,
  showPointsFreqLabels: false,
  useAltScale: false,
  useTimeSubdivision: false,
  useEqualTemperament: false,
  useQuantization: false,
  useFractal: false,
  useStars: false,
  useCuts: false,
  
  // Other numeric values
  referenceFrequency: 440.0,
  altScale: 1.0,
  altStepN: 1,
  
  // Add other state properties with defaults as needed
};

/**
 * Set up modulus radio buttons with safe state access
 * @param {HTMLElement} container - Container for radio buttons
 * @param {Object} state - Application state
 * @param {string} [type=null] - Type of modulus ('duration', 'velocity', or null for default)
 */
function setupModulusRadioButtons(container, state, type = null) {
  if (!container || !state) return; // Null check
  
  // Clear any existing content
  container.innerHTML = '';
  
  // Get current value from state with safe defaults
  let currentValue;
  
  if (type === 'duration') {
    currentValue = getStateValue(state, 'durationModulo', defaultState.durationModulo);
  } else if (type === 'velocity') {
    currentValue = getStateValue(state, 'velocityModulo', defaultState.velocityModulo);
  } else {
    currentValue = getStateValue(state, 'modulusValue', defaultState.modulusValue);
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
          state.setDurationModulo(i);
        } else if (type === 'velocity') {
          state.setVelocityModulo(i);
        } else {
          state.setModulusValue(i);
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

/**
 * Set up time subdivision radio buttons with safe state access
 * @param {HTMLElement} container - Container for radio buttons
 * @param {Object} state - Application state
 */
function setupTimeSubdivisionRadioButtons(container, state) {
  if (!container) return; // Null check
  
  // Clear any existing content
  container.innerHTML = '';
  
  // Get current value with safe default
  const currentValue = getStateValue(state, 'timeSubdivisionValue', defaultState.timeSubdivisionValue);
  
  // Create radio buttons for each division option
  // Format: [displayed value, actual multiplier]
  const divisions = [
    // Faster options (>1x)
    ["8x", 8],
    ["6x", 6],
    ["4x", 4],
    ["3x", 3],
    ["2x", 2],
    ["1.5x", 1.5],
    // Normal speed
    ["1x", 1],
    // Slower options (<1x)
    ["1/1.5x", 1/1.5],
    ["1/2x", 1/2],
    ["1/3x", 1/3],
    ["1/4x", 1/4],
    ["1/6x", 1/6],
    ["1/8x", 1/8]
  ];
  
  for (const [label, value] of divisions) {
    const radioItem = document.createElement('div');
    radioItem.className = 'radio-item';
    
    // Create a CSS-safe ID by replacing slashes and dots with underscores
    const safeCssId = `timeSubdivision-${String(value).replace(/[\/\.]/g, '_')}`;
    
    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.id = safeCssId;
    radioInput.name = 'timeSubdivision';
    radioInput.value = value;
    radioInput.checked = (Math.abs(value - currentValue) < 0.001);
    
    // Add event listener
    radioInput.addEventListener('change', () => {
      if (radioInput.checked) {
        state.setTimeSubdivisionValue(parseFloat(value));
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
  
  // Get current value with safe default (default to 1/4 if not set)
  const currentValue = getStateValue(state, 'quantizationValue', 0.25);
  
  // Create radio buttons for each quantization value
  for (const [label, value] of QUANTIZATION_VALUES) {
    const radioItem = document.createElement('div');
    radioItem.className = 'radio-item';
    
    // Create a CSS-safe ID by replacing slashes with underscores
    const safeCssId = `quantization-${String(value).replace(/\//g, '_')}`;
    
    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.id = safeCssId;
    radioInput.name = 'quantization';
    radioInput.value = value;
    radioInput.checked = (Math.abs(value - currentValue) < 0.001);
    
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
  
  // Get current value with safe default (default to 2 if not set)
  const currentValue = getStateValue(state, 'starSkip', 2);
  
  // Create radio buttons for star skip values (1-12)
  for (let i = 1; i <= 12; i++) {
    const radioItem = document.createElement('div');
    radioItem.className = 'radio-item';
    
    const radioId = `starSkip-${i}`;
    
    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.id = radioId;
    radioInput.name = 'starSkip';
    radioInput.value = i;
    radioInput.checked = (i === currentValue);
    
    // Add event listener
    radioInput.addEventListener('change', () => {
      if (radioInput.checked) {
        state.setStarSkip(i);
      }
    });
    
    const radioLabel = document.createElement('label');
    radioLabel.htmlFor = radioId;
    radioLabel.textContent = i; // Use the loop counter as the skip value
    
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
  const useModulusCheckbox = document.getElementById('useModulusCheckbox');
  const modulusRadioGroup = document.getElementById('modulusRadioGroup');
  
  // Time subdivision controls
  const useTimeSubdivisionCheckbox = document.getElementById('useTimeSubdivisionCheckbox');
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
  
  // Intersections control
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
  
  // Set initial values for duration phase with robust error handling
  try {
    if (durationPhaseRange && durationPhaseNumber && durationPhaseValue) {
      // Safely get durationPhase with fallback to 0
      const durationPhase = (state && (state.durationPhase !== undefined)) ? state.durationPhase : 0;
      
      // Ensure values are valid numbers
      const safeValue = typeof durationPhase === 'number' ? durationPhase : 0;
      
      // Update UI elements
      durationPhaseRange.value = safeValue;
      durationPhaseNumber.value = safeValue;
      durationPhaseValue.textContent = safeValue.toFixed(2);
      
      // Initialize state if not set
      if (state && state.setDurationPhase) {
        state.setDurationPhase(safeValue);
      }
    }
  } catch (error) {
    console.warn('Error initializing duration phase controls:', error);
    // Set safe defaults
    if (durationPhaseRange) durationPhaseRange.value = 0;
    if (durationPhaseNumber) durationPhaseNumber.value = 0;
    if (durationPhaseValue) durationPhaseValue.textContent = '0.00';
  }
  
  // Check if required elements exist before proceeding
  if (!numberRange || !numberNumber || !numberValue) {
    console.warn('Required UI elements for Number parameter are missing');
    // Continue with other elements that are available
  }
  

  /**
   * Safely gets a number from state with a default value
   * @param {Object} state - The state object
   * @param {string} prop - The property name to get
   * @param {number} defaultValue - Default value if property is missing or invalid
   * @returns {number} The safe number value
   */
  const safeNumberState = (state, prop, defaultValue = 0) => {
    if (state && (state[prop] !== undefined)) {
      const value = parseFloat(state[prop]);
      return isNaN(value) ? defaultValue : value;
    }
    return defaultValue;
  };

  /**
   * Initialize a number control with range and number inputs
   * @param {HTMLInputElement} range - Range input element
   * @param {HTMLInputElement} number - Number input element
   * @param {HTMLElement} value - Element to display the value
   * @param {string} stateProp - State property name
   * @param {number} defaultValue - Default value
   * @param {number} precision - Number of decimal places
   */
  const initNumberControl = (range, number, value, stateProp, defaultValue = 0, precision = 2) => {
    if (!range || !number || !value) return;
    
    // Get value from state with safe fallback
    const safeValue = getStateValue(state, stateProp, defaultValue);
    const numValue = typeof safeValue === 'number' ? safeValue : parseFloat(safeValue) || defaultValue;
    
    // Update UI elements
    range.value = numValue;
    number.value = numValue;
    value.textContent = numValue.toFixed(precision);
    
    // Add event listeners for changes
    const updateState = (newValue) => {
      const num = parseFloat(newValue);
      if (!isNaN(num) && state && state[`set${stateProp.charAt(0).toUpperCase() + stateProp.slice(1)}`]) {
        state[`set${stateProp.charAt(0).toUpperCase() + stateProp.slice(1)}`](num);
      }
    };
    
    range.addEventListener('input', (e) => {
      const num = parseFloat(e.target.value);
      if (!isNaN(num)) {
        number.value = num;
        value.textContent = num.toFixed(precision);
        updateState(num);
      }
    });
    
    number.addEventListener('change', (e) => {
      const num = parseFloat(e.target.value);
      if (!isNaN(num)) {
        range.value = num;
        value.textContent = num.toFixed(precision);
        updateState(num);
      } else {
        // Reset to current value if invalid
        e.target.value = numValue;
      }
    });
  };

  // Initialize scale mod controls
  initNumberControl(altScaleRange, altScaleNumber, altScaleValue, 'altScale', 1.0);
  initNumberControl(altStepNRange, altStepNNumber, altStepNValue, 'altStepN', 1, 0);
  
  // Initialize equal temperament controls with safe defaults
  initNumberControl(
    referenceFreqRange, 
    referenceFreqNumber, 
    referenceFreqValue, 
    'referenceFrequency', 
    440.0,  // Standard A4 frequency
    1       // No decimal places for frequency
  );
  
  // Initialize duration controls with safe defaults
  initNumberControl(
    minDurationRange,
    minDurationNumber,
    minDurationValue,
    'minDuration',
    0.1,   // Default minimum duration in seconds
    2       // 2 decimal places for duration
  );
  
  initNumberControl(
    maxDurationRange,
    maxDurationNumber,
    maxDurationValue,
    'maxDuration',
    0.5,   // Default maximum duration in seconds
    2       // 2 decimal places for duration
  );
  
  // Initialize velocity controls with safe defaults
  initNumberControl(
    minVelocityRange,
    minVelocityNumber,
    minVelocityValue,
    'minVelocity',
    0.3,   // Default minimum velocity (0-1)
    2       // 2 decimal places for velocity
  );
  
  initNumberControl(
    maxVelocityRange,
    maxVelocityNumber,
    maxVelocityValue,
    'maxVelocity',
    0.9,   // Default maximum velocity (0-1)
    2       // 2 decimal places for velocity
  );
  
  // Setup event listeners for new checkboxes with null checks
  if (showAxisFreqLabelsCheckbox) {
    showAxisFreqLabelsCheckbox.addEventListener('change', e => {
      state.setShowAxisFreqLabels(e.target.checked);
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
  
  // Setup modulus checkbox with null check and safe state access
  if (useModulusCheckbox) {
    useModulusCheckbox.checked = getStateValue(state, 'useModulus', defaultState.useModulus);
    useModulusCheckbox.addEventListener('change', e => {
      if (state && state.setUseModulus) {
        state.setUseModulus(e.target.checked);
      }
    });
  }
  
  // Setup time subdivision checkbox with safe state access
  if (useTimeSubdivisionCheckbox) {
    useTimeSubdivisionCheckbox.checked = getStateValue(state, 'useTimeSubdivision', defaultState.useTimeSubdivision);
    useTimeSubdivisionCheckbox.addEventListener('change', e => {
      if (state && state.setUseTimeSubdivision) {
        state.setUseTimeSubdivision(e.target.checked);
      }
    });
  }
  
  // Setup quantization checkbox with safe state access
  if (useQuantizationCheckbox) {
    useQuantizationCheckbox.checked = getStateValue(state, 'useQuantization', defaultState.useQuantization);
    useQuantizationCheckbox.addEventListener('change', e => {
      if (state && state.setUseQuantization) {
        state.setUseQuantization(e.target.checked);
      }
    });
  }
  
  // Setup alt scale checkbox with safe state access
  if (useAltScaleCheckbox) {
    useAltScaleCheckbox.checked = getStateValue(state, 'useAltScale', defaultState.useAltScale);
    useAltScaleCheckbox.addEventListener('change', e => {
      if (state && state.setUseAltScale) {
        state.setUseAltScale(e.target.checked);
      }
    });
  }
  
  // Setup equal temperament checkbox with safe state access
  if (useEqualTemperamentCheckbox) {
    useEqualTemperamentCheckbox.checked = getStateValue(state, 'useEqualTemperament', defaultState.useEqualTemperament);
    useEqualTemperamentCheckbox.addEventListener('change', e => {
      if (state && state.setUseEqualTemperament) {
        state.setUseEqualTemperament(e.target.checked);
      }
    });
  }
  
  // Setup fractal checkbox with safe state access
  if (useFractalCheckbox) {
    useFractalCheckbox.checked = getStateValue(state, 'useFractal', defaultState.useFractal);
    useFractalCheckbox.addEventListener('change', e => {
      if (state && state.setUseFractal) {
        state.setUseFractal(e.target.checked);
      }
    });
  }
  
  // Setup stars checkbox with safe state access
  if (useStarsCheckbox) {
    useStarsCheckbox.checked = getStateValue(state, 'useStars', defaultState.useStars);
    useStarsCheckbox.addEventListener('change', e => {
      if (state && state.setUseStars) {
        state.setUseStars(e.target.checked);
      }
    });
  }
  
  // Setup cuts checkbox with safe state access
  if (useCutsCheckbox) {
    useCutsCheckbox.checked = getStateValue(state, 'useCuts', defaultState.useCuts);
    useCutsCheckbox.addEventListener('change', e => {
      if (state && state.setUseCuts) {
        state.setUseCuts(e.target.checked);
      }
    });
  }
  
  // Setup intersections checkbox with safe state access
  if (useIntersectionsCheckbox) {
    useIntersectionsCheckbox.checked = getStateValue(state, 'useIntersections', defaultState.useIntersections);
    useIntersectionsCheckbox.addEventListener('change', e => {
      if (state && state.setUseIntersections) {
        state.setUseIntersections(e.target.checked);
      }
    });
  }

  // Setup duration mode radio buttons with safe state access
  if (durationModeRadios && durationModeRadios.length > 0) {
    // Get current duration mode with safe default ('fixed' if not set)
    const currentMode = getStateValue(state, 'durationMode', 'fixed');
    
    durationModeRadios.forEach(radio => {
      // Check the one that matches the current state
      radio.checked = (radio.value === currentMode);
      
      // Add event listener with null check
      radio.addEventListener('change', e => {
        if (e.target.checked && state && state.setDurationMode) {
          state.setDurationMode(e.target.value);
        }
      });
    });
  }
  
  // Setup velocity mode radio buttons with safe state access
  if (velocityModeRadios && velocityModeRadios.length > 0) {
    // Get current velocity mode with safe default ('fixed' if not set)
    const currentMode = getStateValue(state, 'velocityMode', 'fixed');
    
    velocityModeRadios.forEach(radio => {
      // Check the one that matches the current state
      radio.checked = (radio.value === currentMode);
      
      // Add event listener with null check
      radio.addEventListener('change', e => {
        if (e.target.checked && state && state.setVelocityMode) {
          state.setVelocityMode(e.target.value);
        }
      });
    });
  }

  // Sync control values with the UI
  const syncPair = (rangeEl, numEl, spanEl, setter, min, max, parser = v => parseFloat(v)) => {
    // Skip if any elements are missing
    if (!rangeEl || !numEl || !spanEl) {
      console.warn('UI elements not found, skipping syncPair setup');
      return;
    }
    
    // Initialize UI elements with state values
    const initialValue = parser === parseFloat ? 
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
      setter(v);
      spanEl.textContent = parser === parseFloat ? v.toFixed(1) : v;
      numEl.value = v;
    });
    
    numEl.addEventListener('input', e => {
      let v = parser(e.target.value);
      
      // Special case for Number parameter - always round to integers
      if (numEl.id === 'numberNumber') {
        v = Math.round(v);
      }
      
      v = Math.min(Math.max(v || min, min), max);
      setter(v);
      spanEl.textContent = parser === parseFloat ? v.toFixed(1) : v;
      rangeEl.value = v;
    });
  };
  
  // Setup checkbox event listener for lerp toggle with null check
  if (useLerpCheckbox) {
    useLerpCheckbox.addEventListener('change', e => {
      state.setUseLerp(e.target.checked);
    });
  }

  // Link UI controls to state with specific Number type conversions and null checks
  if (bpmRange && bpmNumber && bpmValue) {
    syncPair(bpmRange, bpmNumber, bpmValue, 
      value => state.setBpm(Number(value)), 
      UI_RANGES.BPM[0], UI_RANGES.BPM[1], 
      Number);
  }
  
  if (radiusRange && radiusNumber && radiusValue) {
    syncPair(radiusRange, radiusNumber, radiusValue, 
      value => state.setRadius(Number(value)), 
      UI_RANGES.RADIUS[0], UI_RANGES.RADIUS[1], 
      Number);
  }
  
  if (copiesRange && copiesNumber && copiesValue) {
    syncPair(copiesRange, copiesNumber, copiesValue, 
      value => state.setCopies(Number(value)), 
      UI_RANGES.COPIES[0], UI_RANGES.COPIES[1], 
      Number);
  }
  
  if (stepScaleRange && stepScaleNumber && stepScaleValue) {
    syncPair(stepScaleRange, stepScaleNumber, stepScaleValue, 
      value => state.setStepScale(Number(value)), 
      UI_RANGES.STEP_SCALE[0], UI_RANGES.STEP_SCALE[1], 
      Number);
  }
  
  if (angleRange && angleNumber && angleValue) {
    syncPair(angleRange, angleNumber, angleValue, 
      value => state.setAngle(Number(value)), 
      UI_RANGES.ANGLE[0], UI_RANGES.ANGLE[1], 
      Number);
  }
  
  if (numberRange && numberNumber && numberValue) {
    syncPair(numberRange, numberNumber, numberValue, 
      value => state.setSegments(Math.round(Number(value))), // FIX: Always round the number parameter 
      UI_RANGES.SEGMENTS[0], UI_RANGES.SEGMENTS[1], 
      Number);
  }
    
  if (lerpTimeRange && lerpTimeNumber && lerpTimeValue) {
    syncPair(lerpTimeRange, lerpTimeNumber, lerpTimeValue, 
      value => state.setLerpTime(Number(value)), 
      0.1, 5.0, 
      Number);
  }
    
  // Link Scale Mod UI controls to state with proper formatting
  if (altScaleRange && altScaleNumber && altScaleValue) {
    syncPair(altScaleRange, altScaleNumber, altScaleValue, 
      value => state.setAltScale(Number(value)), 
      UI_RANGES.ALT_SCALE[0], UI_RANGES.ALT_SCALE[1], 
      Number);
  }
  
  if (altStepNRange && altStepNNumber && altStepNValue) {
    syncPair(altStepNRange, altStepNNumber, altStepNValue, 
      value => state.setAltStepN(Number(value)), 
      UI_RANGES.ALT_STEP_N[0], UI_RANGES.ALT_STEP_N[1], 
      Number);
  }

  // Link Equal Temperament reference frequency controls
  if (referenceFreqRange && referenceFreqNumber && referenceFreqValue) {
    syncPair(referenceFreqRange, referenceFreqNumber, referenceFreqValue,
      value => state.setReferenceFrequency(Number(value)),
      UI_RANGES.REFERENCE_FREQ[0], UI_RANGES.REFERENCE_FREQ[1],
      Number);
  }
  
  // Link fractal controls
  if (fractalRange && fractalNumber && fractalValue) {
    syncPair(fractalRange, fractalNumber, fractalValue,
      value => state.setFractalValue(Number(value)),
      UI_RANGES.FRACTAL_VALUE[0], UI_RANGES.FRACTAL_VALUE[1],
      Number);
  }
    
  // Link duration controls
  if (minDurationRange && minDurationNumber && minDurationValue) {
    syncPair(minDurationRange, minDurationNumber, minDurationValue,
      value => state.setMinDuration(Number(value)),
      0.05, 1.0,
      Number);
  }
    
  if (maxDurationRange && maxDurationNumber && maxDurationValue) {
    syncPair(maxDurationRange, maxDurationNumber, maxDurationValue,
      value => state.setMaxDuration(Number(value)),
      0.1, 2.0,
      Number);
  }
    
  // Link velocity controls
  if (minVelocityRange && minVelocityNumber && minVelocityValue) {
    syncPair(minVelocityRange, minVelocityNumber, minVelocityValue,
      value => state.setMinVelocity(Number(value)),
      0.1, 0.9,
      Number);
  }
    
  if (maxVelocityRange && maxVelocityNumber && maxVelocityValue) {
    syncPair(maxVelocityRange, maxVelocityNumber, maxVelocityValue,
      value => state.setMaxVelocity(Number(value)),
      0.2, 1.0,
      Number);
  }

  // Add this in the appropriate place in the function (right before or after the other duration controls)
  if (durationPhaseRange && durationPhaseNumber && durationPhaseValue) {
    syncPair(durationPhaseRange, durationPhaseNumber, durationPhaseValue,
      value => state.setDurationPhase(Number(value)),
      0, 1.0,
      Number);
  }

  // Add velocity phase UI elements with safe state access
  const velocityPhaseRange = document.getElementById('velocityPhaseRange');
  const velocityPhaseNumber = document.getElementById('velocityPhaseNumber');
  const velocityPhaseValue = document.getElementById('velocityPhaseValue');
  
  // Set initial values for velocity phase with null checks and safe defaults
  if (velocityPhaseRange && velocityPhaseNumber && velocityPhaseValue) {
    const velocityPhase = getStateValue(state, 'velocityPhase', 0);
    const phaseValue = typeof velocityPhase === 'number' ? velocityPhase : 0;
    
    velocityPhaseRange.value = phaseValue;
    velocityPhaseNumber.value = phaseValue;
    velocityPhaseValue.textContent = phaseValue.toFixed(2);
  }

  // Setup velocity phase controls with safe state updates
  if (velocityPhaseRange && velocityPhaseNumber && velocityPhaseValue) {
    syncPair(
      velocityPhaseRange, 
      velocityPhaseNumber, 
      velocityPhaseValue,
      value => state && state.setVelocityPhase && state.setVelocityPhase(Number(value)),
      0, 
      1.0,
      Number
    );
  }

  // Link star polygon controls
  if (starSkipRadioGroup && validSkipsInfo) {
    setupStarSkipRadioButtons(starSkipRadioGroup, state);
  }

  // Update valid skips information when segments change
  if (numberRange && validSkipsInfo) {
    // Function to update valid skips information with safe state access
    const updateValidSkips = () => {
      if (!state) return;
      
      // Safely get segments with default value of 5
      const n = getStateValue(state, 'segments', 5);
      
      // Safely get valid skips with fallback
      let validSkips = [];
      if (typeof state.getValidStarSkips === 'function') {
        validSkips = state.getValidStarSkips();
      } else {
        // Fallback to a reasonable default if getValidStarSkips is not available
        validSkips = Array.from({length: Math.min(n, 12)}, (_, i) => i + 1);
      }
      
      // Update the UI if the element exists
      if (validSkipsInfo) {
        validSkipsInfo.textContent = `Valid skips for ${getPolygonName(n)} (n=${n}): ${validSkips.join(', ')}`;
      }
      
      // Update the star skip radio buttons if the container exists
      if (starSkipRadioGroup) {
        setupStarSkipRadioButtons(starSkipRadioGroup, state);
      }
      
      // Ensure the current skip value is valid
      if (validSkips.length > 0) {
        // Safely get current skip value with default of 2
        const currentSkip = getStateValue(state, 'starSkip', 2);
        
        // Set skip to first valid skip if current value is not valid
        if (!validSkips.includes(currentSkip)) {
          console.log(`Current skip ${currentSkip} is not valid. Setting to ${validSkips[0]}`);
          if (state.setStarSkip) {
            state.setStarSkip(validSkips[0]);
          }
        } else {
          console.log(`Current skip ${currentSkip} is valid among ${validSkips.join(',')}`);
        }
      }
    };
    
    // Add event listeners for number inputs
    if (numberRange) {
      numberRange.addEventListener('input', updateValidSkips);
      numberRange.addEventListener('change', updateValidSkips);
    }
    
    if (numberNumber) {
      numberNumber.addEventListener('input', updateValidSkips);
      numberNumber.addEventListener('change', updateValidSkips);
    }
    
    // Initial update
    updateValidSkips();
    
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
  
  // Setup Euclidean rhythm checkbox with null check and safe state access
  if (useEuclidCheckbox) {
    // Safely get useEuclid with default value of false
    const useEuclid = getStateValue(state, 'useEuclid', false);
    useEuclidCheckbox.checked = useEuclid;
    
    // Safely add change listener if setUseEuclid exists
    if (state && typeof state.setUseEuclid === 'function') {
      useEuclidCheckbox.addEventListener('change', e => {
        state.setUseEuclid(e.target.checked);
      });
    } else {
      console.warn('setUseEuclid method not available on state object');
    }
  }
  
  // Update Euclidean rhythm info with safe state access
  function updateEuclidInfo() {
    if (!validEuclidInfo || !state) return;
    
    try {
      // Safely get segments with default value of 5
      const n = getStateValue(state, 'segments', 5);
      
      // Safely get euclidValue with default value of 3
      const k = getStateValue(state, 'euclidValue', 3);
      
      // Ensure we have valid numbers
      const segments = typeof n === 'number' ? n : 5;
      const euclidValue = typeof k === 'number' ? k : 3;
      
      // Make sure k is at most n
      const effectiveK = Math.min(euclidValue, segments);
      
      validEuclidInfo.textContent = `Current Euclidean pattern: ${effectiveK} vertices evenly distributed from a ${segments}-sided polygon`;
      
      // If k > n, add a warning
      if (euclidValue > segments) {
        validEuclidInfo.innerHTML += `<br><span style="color: #ff8866;">Note: Only using ${segments} vertices since that's the maximum for this shape</span>`;
      }
    } catch (error) {
      console.error('Error updating Euclidean info:', error);
      validEuclidInfo.textContent = 'Error: Could not update Euclidean pattern info';
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

  return {
    bpmRange, bpmNumber, bpmValue,
    radiusRange, radiusNumber, radiusValue,
    copiesRange, copiesNumber, copiesValue,
    stepScaleRange, stepScaleNumber, stepScaleValue,
    angleRange, angleNumber, angleValue,
    numberRange, numberNumber, numberValue,
    useLerpCheckbox, lerpTimeRange, lerpTimeNumber, lerpTimeValue,
    useModulusCheckbox, modulusRadioGroup,
    useTimeSubdivisionCheckbox, timeSubdivisionRadioGroup,
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