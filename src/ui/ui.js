// src/ui/ui.js - Updated with Note Parameters and fixed function order
import { UI_RANGES, QUANTIZATION_VALUES } from '../config/constants.js';
import { ParameterMode } from '../notes/notes.js';

// Function to set up modulus radio buttons - MOVED TO TOP OF FILE
function setupModulusRadioButtons(container, state, type = null) {
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

// Function to set up time subdivision radio buttons - MOVED TO TOP OF FILE
function setupTimeSubdivisionRadioButtons(container, state) {
  // Clear any existing content
  container.innerHTML = '';
  
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
    radioInput.checked = (Math.abs(value - state.timeSubdivisionValue) < 0.001);
    
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
  // Clear any existing content
  container.innerHTML = '';
  
  // Create a radio button for each quantization value
  for (const value of QUANTIZATION_VALUES) {
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

export function setupUI(state) {
  // Get all UI elements
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
  
  // Initialize checkbox states from app state
  showAxisFreqLabelsCheckbox.checked = state.showAxisFreqLabels;
  showPointsFreqLabelsCheckbox.checked = state.showPointsFreqLabels;
  useAltScaleCheckbox.checked = state.useAltScale;
  useTimeSubdivisionCheckbox.checked = state.useTimeSubdivision;
  useEqualTemperamentCheckbox.checked = state.useEqualTemperament;
  useQuantizationCheckbox.checked = state.useQuantization;
  
  // Set initial values for scale mod controls from state
  altScaleRange.value = state.altScale;
  altScaleNumber.value = state.altScale;
  altScaleValue.textContent = state.altScale.toFixed(2);
  
  altStepNRange.value = state.altStepN;
  altStepNNumber.value = state.altStepN;
  altStepNValue.textContent = state.altStepN;
  
  // Set initial values for equal temperament controls
  referenceFreqRange.value = state.referenceFrequency;
  referenceFreqNumber.value = state.referenceFrequency;
  referenceFreqValue.textContent = state.referenceFrequency;
  
  // Set initial values for duration controls
  minDurationRange.value = state.minDuration;
  minDurationNumber.value = state.minDuration;
  minDurationValue.textContent = state.minDuration.toFixed(2);
  
  maxDurationRange.value = state.maxDuration;
  maxDurationNumber.value = state.maxDuration;
  maxDurationValue.textContent = state.maxDuration.toFixed(2);
  
  // Set initial values for velocity controls
  minVelocityRange.value = state.minVelocity;
  minVelocityNumber.value = state.minVelocity;
  minVelocityValue.textContent = state.minVelocity.toFixed(2);
  
  maxVelocityRange.value = state.maxVelocity;
  maxVelocityNumber.value = state.maxVelocity;
  maxVelocityValue.textContent = state.maxVelocity.toFixed(2);
  
  // Setup event listeners for new checkboxes
  showAxisFreqLabelsCheckbox.addEventListener('change', e => {
    state.setShowAxisFreqLabels(e.target.checked);
  });

  showPointsFreqLabelsCheckbox.addEventListener('change', e => {
    state.setShowPointsFreqLabels(e.target.checked);
  });
  
  // Initialize modulus radio buttons
  setupModulusRadioButtons(modulusRadioGroup, state);
  
  // Initialize time subdivision radio buttons
  setupTimeSubdivisionRadioButtons(timeSubdivisionRadioGroup, state);
  
  // Initialize quantization radio buttons
  setupQuantizationRadioButtons(quantizationRadioGroup, state);
  
  // Initialize duration and velocity modulo radio buttons
  setupModulusRadioButtons(durationModuloRadioGroup, state, 'duration');
  setupModulusRadioButtons(velocityModuloRadioGroup, state, 'velocity');
  
  // Setup modulus checkbox
  useModulusCheckbox.checked = state.useModulus;
  useModulusCheckbox.addEventListener('change', e => {
    state.setUseModulus(e.target.checked);
  });
  
  // Setup time subdivision checkbox
  useTimeSubdivisionCheckbox.checked = state.useTimeSubdivision;
  useTimeSubdivisionCheckbox.addEventListener('change', e => {
    state.setUseTimeSubdivision(e.target.checked);
  });
  
  // Setup quantization checkbox
  useQuantizationCheckbox.checked = state.useQuantization;
  useQuantizationCheckbox.addEventListener('change', e => {
    state.setUseQuantization(e.target.checked);
  });
  
  // Setup alt scale checkbox
  useAltScaleCheckbox.checked = state.useAltScale;
  useAltScaleCheckbox.addEventListener('change', e => {
    state.setUseAltScale(e.target.checked);
  });
  
  // Setup equal temperament checkbox
  useEqualTemperamentCheckbox.checked = state.useEqualTemperament;
  useEqualTemperamentCheckbox.addEventListener('change', e => {
    state.setUseEqualTemperament(e.target.checked);
  });
  
  // Setup intersections checkbox
  useIntersectionsCheckbox.checked = state.useIntersections;
  useIntersectionsCheckbox.addEventListener('change', e => {
    state.setUseIntersections(e.target.checked);
  });

  // Setup duration mode radio buttons
  durationModeRadios.forEach(radio => {
    // Check the one that matches the current state
    if (radio.value === state.durationMode) {
      radio.checked = true;
    }
    
    // Add event listener
    radio.addEventListener('change', e => {
      if (e.target.checked) {
        state.setDurationMode(e.target.value);
      }
    });
  });
  
  // Setup velocity mode radio buttons
  velocityModeRadios.forEach(radio => {
    // Check the one that matches the current state
    if (radio.value === state.velocityMode) {
      radio.checked = true;
    }
    
    // Add event listener
    radio.addEventListener('change', e => {
      if (e.target.checked) {
        state.setVelocityMode(e.target.value);
      }
    });
  });

  // Sync control values with the UI
  const syncPair = (rangeEl, numEl, spanEl, setter, min, max, parser = v => parseFloat(v)) => {
    // Initialize UI elements with state values
    const initialValue = parser === parseFloat ? 
      parseFloat(spanEl.textContent) : 
      parseInt(spanEl.textContent);
    
    // Setup event listeners
    rangeEl.addEventListener('input', e => {
      let v = parser(e.target.value);
      v = Math.min(Math.max(v, min), max);
      setter(v);
      spanEl.textContent = parser === parseFloat ? v.toFixed(1) : v;
      numEl.value = v;
    });
    
    numEl.addEventListener('input', e => {
      let v = parser(e.target.value);
      v = Math.min(Math.max(v || min, min), max);
      setter(v);
      spanEl.textContent = parser === parseFloat ? v.toFixed(1) : v;
      rangeEl.value = v;
    });
  };
  
  // Setup checkbox event listener for lerp toggle
  useLerpCheckbox.addEventListener('change', e => {
    state.setUseLerp(e.target.checked);
  });

  // Link UI controls to state with specific Number type conversions
  syncPair(bpmRange, bpmNumber, bpmValue, 
    value => state.setBpm(Number(value)), 
    UI_RANGES.BPM.MIN, UI_RANGES.BPM.MAX, 
    Number);
  
  syncPair(radiusRange, radiusNumber, radiusValue, 
    value => state.setRadius(Number(value)), 
    UI_RANGES.RADIUS.MIN, UI_RANGES.RADIUS.MAX, 
    Number);
  
  syncPair(copiesRange, copiesNumber, copiesValue, 
    value => state.setCopies(Number(value)), 
    UI_RANGES.COPIES.MIN, UI_RANGES.COPIES.MAX, 
    Number);
  
  syncPair(stepScaleRange, stepScaleNumber, stepScaleValue, 
    value => state.setStepScale(Number(value)), 
    UI_RANGES.STEP_SCALE.MIN, UI_RANGES.STEP_SCALE.MAX, 
    Number);
  
  syncPair(angleRange, angleNumber, angleValue, 
    value => state.setAngle(Number(value)), 
    UI_RANGES.ANGLE.MIN, UI_RANGES.ANGLE.MAX, 
    Number);
  
  syncPair(numberRange, numberNumber, numberValue, 
    value => state.setSegments(Number(value)), 
    UI_RANGES.NUMBER.MIN, UI_RANGES.NUMBER.MAX, 
    Number);
    
  syncPair(lerpTimeRange, lerpTimeNumber, lerpTimeValue, 
    value => state.setLerpTime(Number(value)), 
    UI_RANGES.LERP_TIME.MIN, UI_RANGES.LERP_TIME.MAX, 
    Number);
    
  // Link Scale Mod UI controls to state with proper formatting
  syncPair(altScaleRange, altScaleNumber, altScaleValue, 
    value => state.setAltScale(Number(value)), 
    UI_RANGES.ALT_SCALE.MIN, UI_RANGES.ALT_SCALE.MAX, 
    Number);
  
  syncPair(altStepNRange, altStepNNumber, altStepNValue, 
    value => state.setAltStepN(Number(value)), 
    UI_RANGES.ALT_STEP_N.MIN, UI_RANGES.ALT_STEP_N.MAX, 
    Number);

  // Link Equal Temperament reference frequency controls
  syncPair(referenceFreqRange, referenceFreqNumber, referenceFreqValue,
    value => state.setReferenceFrequency(Number(value)),
    UI_RANGES.REFERENCE_FREQUENCY.MIN, UI_RANGES.REFERENCE_FREQUENCY.MAX,
    Number);
    
  // Link duration controls
  syncPair(minDurationRange, minDurationNumber, minDurationValue,
    value => state.setMinDuration(Number(value)),
    0.05, 1.0,
    Number);
    
  syncPair(maxDurationRange, maxDurationNumber, maxDurationValue,
    value => state.setMaxDuration(Number(value)),
    0.1, 2.0,
    Number);
    
  // Link velocity controls
  syncPair(minVelocityRange, minVelocityNumber, minVelocityValue,
    value => state.setMinVelocity(Number(value)),
    0.1, 0.9,
    Number);
    
  syncPair(maxVelocityRange, maxVelocityNumber, maxVelocityValue,
    value => state.setMaxVelocity(Number(value)),
    0.2, 1.0,
    Number);

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
    
    // Note parameter controls
    durationModeRadios, durationModuloRadioGroup,
    minDurationRange, minDurationNumber, minDurationValue,
    maxDurationRange, maxDurationNumber, maxDurationValue,
    
    velocityModeRadios, velocityModuloRadioGroup,
    minVelocityRange, minVelocityNumber, minVelocityValue,
    maxVelocityRange, maxVelocityNumber, maxVelocityValue
  };
}