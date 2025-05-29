// src/osc/oscUIIntegration.js - Integration between OSC system and UI controls
// Handles mousedown/mouseup detection and OSC OUT sending

import { 
  sendOSCParameterChange, 
  setOSCParameterActive, 
  setOSCParameterInactive,
  isOSCEnabled 
} from './oscManager.js';

/**
 * OSC UI Integration Manager
 * Patches existing UI controls to handle OSC communication
 */
class OSCUIIntegration {
  constructor() {
    this.isInitialized = false;
    this.patchedElements = new Set();
    this.activeInteractions = new Map();
    
    // Parameter name mapping from UI element IDs to OSC parameter names
    this.parameterNameMapping = {
      // Shape parameters
      'radius': 'Radius',
      'copies': 'Copies',
      'segments': 'Segments', // This is the "Number" parameter
      'stepScale': 'StepScale',
      'angle': 'Angle',
      'startingAngle': 'StartingAngle',
      'lerpTime': 'LerpTime',
      
      // Scale mod parameters
      'altScale': 'AltScale',
      'altStepN': 'AltStepN',
      
      // Fractal parameters
      'fractal': 'FractalValue',
      'useFractal': 'UseFractal',
      
      // Euclidean parameters
      'euclid': 'EuclidValue',
      'useEuclid': 'UseEuclid',
      
      // Star parameters
      'useStars': 'UseStars',
      'useCuts': 'UseCuts',
      'useTesselation': 'UseTesselation',
      
      // Delete parameters
      'useDelete': 'UseDelete',
      'deleteMin': 'DeleteMin',
      'deleteMax': 'DeleteMax',
      'deleteSeed': 'DeleteSeed',
      
      // Note parameters
      'minDuration': 'MinDuration',
      'maxDuration': 'MaxDuration',
      'durationPhase': 'DurationPhase',
      'minVelocity': 'MinVelocity',
      'maxVelocity': 'MaxVelocity',
      'velocityPhase': 'VelocityPhase',
      
      // Other parameters
      'useLerp': 'UseLerp',
      'useQuantization': 'UseQuantization',
      'usePlainIntersections': 'UsePlainIntersections',
      'showAxisFreqLabels': 'ShowAxisFreqLabels',
      'showPointsFreqLabels': 'ShowPointsFreqLabels',
      
      // Global parameters
      'bpm': 'BPM',
      'attack': 'Attack',
      'decay': 'Decay',
      'sustain': 'Sustain',
      'release': 'Release',
      'brightness': 'Brightness',
      'volume': 'Volume',
      'useEqualTemperament': 'UseEqualTemperament',
      'referenceFreq': 'ReferenceFreq',
      
      // Radio button parameters
      'modulus': 'ModulusValue',
      'timeSubdivision': 'TimeSubdivisionValue',
      'quantization': 'QuantizationValue',
      'durationModulo': 'DurationModulo',
      'velocityModulo': 'VelocityModulo',
      'starSkip': 'StarSkip'
    };
    
    // Global parameters (not layer-specific)
    this.globalParameters = new Set([
      'BPM', 'Attack', 'Decay', 'Sustain', 'Release', 
      'Brightness', 'Volume', 'UseEqualTemperament', 'ReferenceFreq'
    ]);
    
    console.log('[OSC UI] OSCUIIntegration initialized');
  }
  
  /**
   * Initialize OSC UI integration
   * Patches existing UI controls to handle OSC communication
   */
  initialize() {
    if (this.isInitialized) {
      console.log('[OSC UI] Already initialized');
      return;
    }
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.patchUIControls());
    } else {
      this.patchUIControls();
    }
    
    this.isInitialized = true;
    console.log('[OSC UI] Integration initialized');
  }
  
  /**
   * Patch all UI controls to handle OSC communication
   */
  patchUIControls() {
    // Patch range sliders and number inputs
    this.patchSliderControls();
    
    // Patch checkboxes
    this.patchCheckboxControls();
    
    // Patch radio buttons
    this.patchRadioControls();
    
    console.log('[OSC UI] Patched', this.patchedElements.size, 'UI elements');
  }
  
  /**
   * Patch slider and number input controls
   */
  patchSliderControls() {
    // Find all slider containers
    const sliderContainers = document.querySelectorAll('.slider-container');
    
    sliderContainers.forEach(container => {
      const rangeInput = container.querySelector('input[type="range"]');
      const numberInput = container.querySelector('input[type="number"]');
      
      if (rangeInput) {
        this.patchInputElement(rangeInput);
      }
      
      if (numberInput) {
        this.patchInputElement(numberInput);
      }
    });
    
    // Also patch standalone range and number inputs
    const allRangeInputs = document.querySelectorAll('input[type="range"]');
    const allNumberInputs = document.querySelectorAll('input[type="number"]');
    
    allRangeInputs.forEach(input => this.patchInputElement(input));
    allNumberInputs.forEach(input => this.patchInputElement(input));
  }
  
  /**
   * Patch checkbox controls
   */
  patchCheckboxControls() {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
      this.patchInputElement(checkbox);
    });
  }
  
  /**
   * Patch radio button controls
   */
  patchRadioControls() {
    const radioButtons = document.querySelectorAll('input[type="radio"]');
    
    radioButtons.forEach(radio => {
      this.patchInputElement(radio);
    });
  }
  
  /**
   * Patch an individual input element
   * @param {HTMLElement} element - Input element to patch
   */
  patchInputElement(element) {
    if (this.patchedElements.has(element)) {
      return; // Already patched
    }
    
    const parameterInfo = this.getParameterInfo(element);
    if (!parameterInfo) {
      return; // Not a recognized parameter
    }
    
    const { parameterName, isGlobal } = parameterInfo;
    
    // Add mousedown event listener
    element.addEventListener('mousedown', (event) => {
      this.handleMouseDown(element, parameterName, isGlobal);
    });
    
    // Add mouseup event listener
    element.addEventListener('mouseup', (event) => {
      this.handleMouseUp(element, parameterName, isGlobal);
    });
    
    // Add mouse leave event listener (in case mouse leaves while pressed)
    element.addEventListener('mouseleave', (event) => {
      if (this.activeInteractions.has(element)) {
        this.handleMouseUp(element, parameterName, isGlobal);
      }
    });
    
    // Add change event listener for sending OSC OUT
    element.addEventListener('change', (event) => {
      this.handleParameterChange(element, parameterName, isGlobal);
    });
    
    // Add input event listener for real-time updates (sliders)
    if (element.type === 'range') {
      element.addEventListener('input', (event) => {
        this.handleParameterChange(element, parameterName, isGlobal);
      });
    }
    
    this.patchedElements.add(element);
    console.log(`[OSC UI] Patched ${element.type} element for parameter: ${parameterName}`);
  }
  
  /**
   * Get parameter information from an input element
   * @param {HTMLElement} element - Input element
   * @returns {Object|null} Parameter info or null if not recognized
   */
  getParameterInfo(element) {
    const id = element.id;
    if (!id) return null;
    
    // Extract parameter name from element ID
    let baseId = id;
    
    // Remove common suffixes
    if (id.endsWith('Range') || id.endsWith('Number') || id.endsWith('Checkbox')) {
      baseId = id.replace(/(Range|Number|Checkbox)$/, '');
    }
    
    // Handle radio buttons with special naming
    if (element.type === 'radio') {
      const name = element.name;
      if (name) {
        baseId = name;
      }
    }
    
    // Map to OSC parameter name
    const parameterName = this.parameterNameMapping[baseId];
    if (!parameterName) {
      return null;
    }
    
    const isGlobal = this.globalParameters.has(parameterName);
    
    return { parameterName, isGlobal };
  }
  
  /**
   * Handle mouse down event
   * @param {HTMLElement} element - Input element
   * @param {string} parameterName - Parameter name
   * @param {boolean} isGlobal - Whether this is a global parameter
   */
  handleMouseDown(element, parameterName, isGlobal) {
    if (!isOSCEnabled()) return;
    
    // Mark parameter as active (disable OSC IN)
    const layerId = isGlobal ? null : this.getCurrentLayerId();
    setOSCParameterActive(parameterName, isGlobal, layerId);
    
    // Track active interaction
    this.activeInteractions.set(element, {
      parameterName,
      isGlobal,
      layerId,
      startTime: Date.now()
    });
    
    console.log(`[OSC UI] Mouse down on ${parameterName} (${isGlobal ? 'global' : `layer ${layerId}`})`);
  }
  
  /**
   * Handle mouse up event
   * @param {HTMLElement} element - Input element
   * @param {string} parameterName - Parameter name
   * @param {boolean} isGlobal - Whether this is a global parameter
   */
  handleMouseUp(element, parameterName, isGlobal) {
    if (!isOSCEnabled()) return;
    
    const interaction = this.activeInteractions.get(element);
    if (!interaction) return;
    
    // Mark parameter as inactive (re-enable OSC IN)
    const layerId = isGlobal ? null : this.getCurrentLayerId();
    setOSCParameterInactive(parameterName, isGlobal, layerId);
    
    // Remove active interaction
    this.activeInteractions.delete(element);
    
    const duration = Date.now() - interaction.startTime;
    console.log(`[OSC UI] Mouse up on ${parameterName} (duration: ${duration}ms)`);
  }
  
  /**
   * Handle parameter change event
   * @param {HTMLElement} element - Input element
   * @param {string} parameterName - Parameter name
   * @param {boolean} isGlobal - Whether this is a global parameter
   */
  handleParameterChange(element, parameterName, isGlobal) {
    if (!isOSCEnabled()) return;
    
    // For checkboxes and radio buttons, always send OSC OUT (they're momentary actions)
    // For sliders/numbers, only send OSC OUT if user is actively touching the control
    const isCheckboxOrRadio = element.type === 'checkbox' || element.type === 'radio';
    
    if (!isCheckboxOrRadio && !this.activeInteractions.has(element)) {
      return;
    }
    
    // Get current value
    let value;
    if (element.type === 'checkbox' || element.type === 'radio') {
      value = element.checked;
    } else {
      value = element.value;
      
      // Convert to number if it's a numeric input
      if (element.type === 'range' || element.type === 'number') {
        value = parseFloat(value);
      }
    }
    
    // Send OSC OUT message
    const layerId = isGlobal ? null : this.getCurrentLayerId();
    sendOSCParameterChange(parameterName, value, isGlobal, layerId);
    
    console.log(`[OSC UI] Sent parameter change: ${parameterName} = ${value}${isCheckboxOrRadio ? ' (checkbox/radio)' : ''}`);
  }
  
  /**
   * Get current active layer ID
   * @returns {number} Current layer ID (0-based)
   */
  getCurrentLayerId() {
    // Get active layer from layer manager
    if (window._layers && window._layers.activeLayerId !== undefined) {
      return window._layers.activeLayerId;
    }
    
    // Fallback to layer 0
    return 0;
  }
  
  /**
   * Manually trigger parameter change (for programmatic updates)
   * @param {string} parameterName - Parameter name
   * @param {*} value - Parameter value
   * @param {boolean} isGlobal - Whether this is a global parameter
   * @param {number|null} layerId - Layer ID (optional, uses current if not specified)
   */
  triggerParameterChange(parameterName, value, isGlobal = false, layerId = null) {
    if (!isOSCEnabled()) return;
    
    const targetLayerId = layerId !== null ? layerId : (isGlobal ? null : this.getCurrentLayerId());
    sendOSCParameterChange(parameterName, value, isGlobal, targetLayerId);
    
    console.log(`[OSC UI] Manually triggered parameter change: ${parameterName} = ${value}`);
  }
  
  /**
   * Get integration status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      patchedElements: this.patchedElements.size,
      activeInteractions: this.activeInteractions.size,
      parameterMappings: Object.keys(this.parameterNameMapping).length
    };
  }
  
  /**
   * Clean up all event listeners and patches
   */
  cleanup() {
    // Remove all event listeners from patched elements
    this.patchedElements.forEach(element => {
      // Clone element to remove all event listeners
      const newElement = element.cloneNode(true);
      element.parentNode.replaceChild(newElement, element);
    });
    
    this.patchedElements.clear();
    this.activeInteractions.clear();
    this.isInitialized = false;
    
    console.log('[OSC UI] Cleaned up all patches');
  }
}

// Create singleton instance
const oscUIIntegration = new OSCUIIntegration();

// Export functions
export function initializeOSCUI() {
  oscUIIntegration.initialize();
}

export function getOSCUIStatus() {
  return oscUIIntegration.getStatus();
}

export function triggerOSCParameterChange(parameterName, value, isGlobal = false, layerId = null) {
  oscUIIntegration.triggerParameterChange(parameterName, value, isGlobal, layerId);
}

export function cleanupOSCUI() {
  oscUIIntegration.cleanup();
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.oscUIIntegration = oscUIIntegration;
  window.initializeOSCUI = initializeOSCUI;
  window.getOSCUIStatus = getOSCUIStatus;
  window.triggerOSCParameterChange = triggerOSCParameterChange;
  
  // Debug function
  window.debugOSCUI = () => {
    const status = getOSCUIStatus();
    console.log('[OSC UI DEBUG] Status:', status);
    console.log('[OSC UI DEBUG] Patched elements:', Array.from(oscUIIntegration.patchedElements).map(el => el.id));
    console.log('[OSC UI DEBUG] Active interactions:', Array.from(oscUIIntegration.activeInteractions.keys()).map(el => el.id));
    return status;
  };
}

export default oscUIIntegration; 