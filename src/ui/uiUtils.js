// src/ui/uiUtils.js - Utilities for UI initialization and management
import { DEFAULT_VALUES, PARAMETER_RANGES } from '../config/constants.js';

/**
 * Initialize UI input elements using values from DEFAULT_VALUES and ranges from PARAMETER_RANGES
 * This ensures consistency between UI elements, default values, and validation ranges
 */
export function initializeUIInputs() {
  // Initialize synth control UI elements
  initializeSynthControls();
  
  // Initialize other UI elements here as needed
}

/**
 * Initialize the synth control UI elements with defaults from constants
 */
function initializeSynthControls() {
  // Get all ADSR UI elements
  const attackElements = {
    range: document.getElementById('attackRange'),
    number: document.getElementById('attackNumber'),
    value: document.getElementById('attackValue')
  };
  
  const decayElements = {
    range: document.getElementById('decayRange'),
    number: document.getElementById('decayNumber'),
    value: document.getElementById('decayValue')
  };
  
  const sustainElements = {
    range: document.getElementById('sustainRange'),
    number: document.getElementById('sustainNumber'),
    value: document.getElementById('sustainValue')
  };
  
  const releaseElements = {
    range: document.getElementById('releaseRange'),
    number: document.getElementById('releaseNumber'),
    value: document.getElementById('releaseValue')
  };
  
  const brightnessElements = {
    range: document.getElementById('brightnessRange'),
    number: document.getElementById('brightnessNumber'),
    value: document.getElementById('brightnessValue')
  };
  
  const volumeElements = {
    range: document.getElementById('volumeRange'),
    number: document.getElementById('volumeNumber'),
    value: document.getElementById('volumeValue')
  };

  // Initialize attack controls
  initializeInputGroup(attackElements, 'ATTACK', DEFAULT_VALUES.ATTACK, PARAMETER_RANGES.ATTACK);
  
  // Initialize decay controls
  initializeInputGroup(decayElements, 'DECAY', DEFAULT_VALUES.DECAY, PARAMETER_RANGES.DECAY);
  
  // Initialize sustain controls
  initializeInputGroup(sustainElements, 'SUSTAIN', DEFAULT_VALUES.SUSTAIN, PARAMETER_RANGES.SUSTAIN);
  
  // Initialize release controls
  initializeInputGroup(releaseElements, 'RELEASE', DEFAULT_VALUES.RELEASE, PARAMETER_RANGES.RELEASE);
  
  // Initialize brightness controls
  initializeInputGroup(brightnessElements, 'BRIGHTNESS', DEFAULT_VALUES.BRIGHTNESS, PARAMETER_RANGES.BRIGHTNESS);
  
  // Initialize volume controls
  initializeInputGroup(volumeElements, 'VOLUME', DEFAULT_VALUES.VOLUME, PARAMETER_RANGES.VOLUME);
  
  // Initialize equal temperament checkbox
  const equalTempCheckbox = document.getElementById('useEqualTemperamentCheckbox');
  if (equalTempCheckbox) {
    equalTempCheckbox.checked = DEFAULT_VALUES.USE_EQUAL_TEMPERAMENT;
  }
  
  // Initialize reference frequency controls
  const refFreqElements = {
    range: document.getElementById('referenceFreqRange'),
    number: document.getElementById('referenceFreqNumber'),
    value: document.getElementById('referenceFreqValue')
  };
  
  initializeInputGroup(refFreqElements, 'REFERENCE_FREQ', DEFAULT_VALUES.REFERENCE_FREQ, PARAMETER_RANGES.REFERENCE_FREQ);
}

/**
 * Initialize a group of related input elements (range, number, and value display)
 * @param {Object} elements - Object containing range, number, and value elements
 * @param {string} paramName - Name of the parameter in constants
 * @param {number} defaultValue - Default value from DEFAULT_VALUES
 * @param {Object} paramRange - Range object from PARAMETER_RANGES
 */
function initializeInputGroup(elements, paramName, defaultValue, paramRange) {
  if (!elements.range || !elements.number || !elements.value) {
    console.warn(`[UI] Missing UI elements for ${paramName}`);
    return;
  }
  
  // Set the min, max, and step attributes from PARAMETER_RANGES
  if (paramRange) {
    elements.range.min = paramRange.MIN;
    elements.range.max = paramRange.MAX;
    elements.range.step = paramRange.STEP || 0.01;
    
    elements.number.min = paramRange.MIN;
    elements.number.max = paramRange.MAX;
    elements.number.step = paramRange.STEP || 0.01;
  }
  
  // Set the value from DEFAULT_VALUES
  elements.range.value = defaultValue;
  elements.number.value = defaultValue;
  
  // Format display value appropriately
  if (paramName === 'BPM' || paramName === 'REFERENCE_FREQ') {
    elements.value.textContent = defaultValue.toString();
  } else {
    elements.value.textContent = defaultValue.toFixed(2);
  }
} 