// src/ui/ui.js - Updated with Number parameter rounding fix
import { UI_RANGES, QUANTIZATION_VALUES } from '../config/constants.js';
import { ParameterMode } from '../notes/notes.js';

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
  if (!container) return; // Null check
  
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
  if (!container) return; // Null check
  
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

// Function to set up star skip radio buttons
function setupStarSkipRadioButtons(container, state) {
  if (!container) return; // Null check
  
  // Clear any existing content
  container.innerHTML = '';
  
  // Get valid skips for the current number of segments
  const validSkips = state.getValidStarSkips();
  
  // Get current value from state
  const currentValue = state.starSkip;
  
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
        state.setStarSkip(skipValue);
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
  
  // Set initial values for duration phase with null checks
  if (durationPhaseRange && durationPhaseNumber && durationPhaseValue) {
    durationPhaseRange.value = state.durationPhase || 0;
    durationPhaseNumber.value = state.durationPhase || 0;
    durationPhaseValue.textContent = (state.durationPhase || 0).toFixed(2);
  }
  
  // Check if required elements exist before proceeding
  if (!numberRange || !numberNumber || !numberValue) {
    console.warn('Required UI elements for Number parameter are missing');
    // Continue with other elements that are available
  }
  
  // Initialize checkbox states from app state with null checks
  if (showAxisFreqLabelsCheckbox) showAxisFreqLabelsCheckbox.checked = state.showAxisFreqLabels;
  if (showPointsFreqLabelsCheckbox) showPointsFreqLabelsCheckbox.checked = state.showPointsFreqLabels;
  if (useAltScaleCheckbox) useAltScaleCheckbox.checked = state.useAltScale;
  if (useTimeSubdivisionCheckbox) useTimeSubdivisionCheckbox.checked = state.useTimeSubdivision;
  if (useEqualTemperamentCheckbox) useEqualTemperamentCheckbox.checked = state.useEqualTemperament;
  if (useQuantizationCheckbox) useQuantizationCheckbox.checked = state.useQuantization;
  if (useFractalCheckbox) useFractalCheckbox.checked = state.useFractal;
  if (useStarsCheckbox) useStarsCheckbox.checked = state.useStars;
  if (useCutsCheckbox) useCutsCheckbox.checked = state.useCuts;
  
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
  
  // Set initial values for equal temperament controls with null checks
  if (referenceFreqRange && referenceFreqNumber && referenceFreqValue) {
    referenceFreqRange.value = state.referenceFrequency;
    referenceFreqNumber.value = state.referenceFrequency;
    referenceFreqValue.textContent = state.referenceFrequency;
  }
  
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
  
  // Setup modulus checkbox with null check
  if (useModulusCheckbox) {
    useModulusCheckbox.checked = state.useModulus;
    useModulusCheckbox.addEventListener('change', e => {
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
      
      activeState.setUseModulus(e.target.checked);
    });
  }
  
  // Setup time subdivision checkbox with null check
  if (useTimeSubdivisionCheckbox) {
    useTimeSubdivisionCheckbox.checked = state.useTimeSubdivision;
    useTimeSubdivisionCheckbox.addEventListener('change', e => {
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
        
      activeState.setUseTimeSubdivision(e.target.checked);
    });
  }
  
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
  
  // Setup equal temperament checkbox with null check
  if (useEqualTemperamentCheckbox) {
    useEqualTemperamentCheckbox.checked = state.useEqualTemperament;
    useEqualTemperamentCheckbox.addEventListener('change', e => {
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
        
      activeState.setUseEqualTemperament(e.target.checked);
    });
  }
  
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
  
  // Setup intersections checkbox with null check
  if (useIntersectionsCheckbox) {
    useIntersectionsCheckbox.checked = state.useIntersections;
    useIntersectionsCheckbox.addEventListener('change', e => {
      // Get the current active layer state
      const activeState = typeof window.getActiveState === 'function' ? 
        window.getActiveState() : state;
        
      activeState.setUseIntersections(e.target.checked);
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
    // Skip if any elements are missing
    if (!rangeEl || !numEl || !spanEl) {
      console.warn('UI elements not found, skipping syncPair setup');
      return;
    }
    
    // Initialize UI elements with state values
    const initialValue = parser === parseFloat ? 
      parseFloat(spanEl.textContent) : 
      parseInt(spanEl.textContent);
    
    // Helper function to get the current target state for parameter changes
    const getTargetState = (setterName) => {
      // Check if this is a global parameter that should be routed to globalState
      const isGlobalParameter = 
        setterName.includes('bpm') || 
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
          id: 'global'
        };
      } else {
        // FIXED: First try using window.getActiveState() which is more reliable
        if (typeof window.getActiveState === 'function') {
          const activeState = window.getActiveState();
          if (activeState) {
            // Get the layer ID from the state if available
            const layerId = activeState.layerId !== undefined ? activeState.layerId : 'unknown';
            
            console.log(`[UI CHANGE] Using active state from getActiveState() for layer ${layerId}`);
            
            return {
              state: activeState,
              isGlobal: false,
              id: layerId
            };
          }
        }
        
        // Fallback to window._layers if getActiveState is not available
        const layerManager = window._layers;
        const activeLayer = layerManager?.getActiveLayer();
        
        if (activeLayer && activeLayer.state) {
          return { 
            state: activeLayer.state, 
            isGlobal: false,
            id: activeLayer.id
          };
        }
        
        // Fall back to window._appState if no active layer is found
        console.warn(`Unable to find active layer state for ${setterName}, falling back to default state`);
        return { 
          state: window._appState, 
          isGlobal: false,
          id: 'default'
        };
      }
    };
    
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
      
      // Get the target state for this parameter change
      const { state, isGlobal, id } = getTargetState(setterName);
      
      if (isGlobal) {
        // Find the setter name by removing 'Range' from the ID
        const paramName = rangeEl.id.replace('Range', '');
        // Convert to camelCase setter name (e.g., 'bpm' -> 'setBpm')
        const globalSetterName = 'set' + paramName.charAt(0).toUpperCase() + paramName.slice(1);
        
        // Call the setter on globalState if it exists
        if (typeof state[globalSetterName] === 'function') {
          state[globalSetterName](v);
          console.log(`[GLOBAL] Updated ${paramName} to ${v}`);
        }
      } else {
        // Call the setter on the layer state
        if (typeof setter === 'function') {
          setter.call(state, v);
          console.log(`[UI CHANGE] Updated ${setterName.replace('set', '')} to ${v} on layer ${id}`);
        }
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
      
      // Get the target state for this parameter change
      const { state, isGlobal, id } = getTargetState(setterName);
      
      if (isGlobal) {
        // Find the setter name by removing 'Number' from the ID
        const paramName = numEl.id.replace('Number', '');
        // Convert to camelCase setter name (e.g., 'bpm' -> 'setBpm')
        const globalSetterName = 'set' + paramName.charAt(0).toUpperCase() + paramName.slice(1);
        
        // Call the setter on globalState if it exists
        if (typeof state[globalSetterName] === 'function') {
          state[globalSetterName](v);
          console.log(`[GLOBAL] Updated ${paramName} to ${v}`);
        }
      } else {
        // Call the setter on the layer state
        if (typeof setter === 'function') {
          setter.call(state, v);
          console.log(`[UI CHANGE] Updated ${setterName.replace('set', '')} to ${v} on layer ${id}`);
        }
      }
      
      spanEl.textContent = parser === parseFloat ? v.toFixed(1) : v;
      rangeEl.value = v;
    });
  };
  
  // Setup checkbox event listener for lerp toggle with null check
  if (useLerpCheckbox) {
    useLerpCheckbox.addEventListener('change', e => {
      // Get current active layer's state using getActiveState which is more reliable
      if (typeof window.getActiveState === 'function') {
        const activeState = window.getActiveState();
        if (activeState) {
          activeState.setUseLerp(e.target.checked);
          console.log(`[UI CHANGE] Set useLerp to ${e.target.checked} on layer ${activeState.layerId}`);
          return;
        }
      }
      
      // Fallback to the layer manager approach if getActiveState is not available
      const activeLayerState = window._layers?.getActiveLayer()?.state;
      if (activeLayerState && typeof activeLayerState.setUseLerp === 'function') {
        activeLayerState.setUseLerp(e.target.checked);
      } else {
        // Last resort fallback to the original state
        state.setUseLerp(e.target.checked);
      }
    });
  }

  // Link UI controls to state with specific Number type conversions and null checks
  if (bpmRange && bpmNumber && bpmValue) {
    syncPair(bpmRange, bpmNumber, bpmValue, 
      function setBpm(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setBpm(Number(value));
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

  // Link Equal Temperament reference frequency controls
  if (referenceFreqRange && referenceFreqNumber && referenceFreqValue) {
    syncPair(referenceFreqRange, referenceFreqNumber, referenceFreqValue,
      function setReferenceFrequency(value) {
        // Use getActiveState dynamically at call time, not during setup
        const targetState = typeof window.getActiveState === 'function' ? 
          window.getActiveState() : state;
        targetState.setReferenceFrequency(Number(value));
      },
      UI_RANGES.REFERENCE_FREQ[0], UI_RANGES.REFERENCE_FREQ[1],
      Number);
  }
  
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
      0.05, 1.0,
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
      0.1, 2.0,
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
      const n = state.segments;
      const validSkips = state.getValidStarSkips();
      validSkipsInfo.textContent = `Valid skips for ${getPolygonName(n)} (n=${n}): ${validSkips.join(', ')}`;
      
      // Update the star skip radio buttons 
      if (starSkipRadioGroup) {
        setupStarSkipRadioButtons(starSkipRadioGroup, state);
      }
      
      // Ensure the current skip value is valid
      if (validSkips.length > 0) {
        // Set skip to first valid skip if current value is not valid
        if (!validSkips.includes(state.starSkip)) {
          console.log(`Current skip ${state.starSkip} is not valid. Setting to ${validSkips[0]}`);
          state.setStarSkip(validSkips[0]);
        } else {
          console.log(`Current skip ${state.starSkip} is valid among ${validSkips.join(',')}`);
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