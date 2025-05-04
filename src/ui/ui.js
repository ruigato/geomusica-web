// src/ui/ui.js
import { UI_RANGES } from '../config/constants.js';

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
  
  // Intersections control
  const useIntersectionsCheckbox = document.getElementById('useIntersectionsCheckbox');

    // Get new UI elements
    const showAxisFreqLabelsCheckbox = document.getElementById('showAxisFreqLabelsCheckbox');
    const showPointsFreqLabelsCheckbox = document.getElementById('showPointsFreqLabelsCheckbox');
    
    // Initialize checkbox states from app state
    showAxisFreqLabelsCheckbox.checked = state.showAxisFreqLabels;
    showPointsFreqLabelsCheckbox.checked = state.showPointsFreqLabels;
    
    // Setup event listeners for new checkboxes
    showAxisFreqLabelsCheckbox.addEventListener('change', e => {
      state.setShowAxisFreqLabels(e.target.checked);
    });
  
    showPointsFreqLabelsCheckbox.addEventListener('change', e => {
      state.setShowPointsFreqLabels(e.target.checked);
    });
  
  // Initialize modulus radio buttons
  setupModulusRadioButtons(modulusRadioGroup, state);
  
  // Setup modulus checkbox
  useModulusCheckbox.checked = state.useModulus;
  useModulusCheckbox.addEventListener('change', e => {
    state.setUseModulus(e.target.checked);
  });
  
  // Setup intersections checkbox
  useIntersectionsCheckbox.checked = state.useIntersections;
  useIntersectionsCheckbox.addEventListener('change', e => {
    state.setUseIntersections(e.target.checked);
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

  return {
    bpmRange, bpmNumber, bpmValue,
    radiusRange, radiusNumber, radiusValue,
    copiesRange, copiesNumber, copiesValue,
    stepScaleRange, stepScaleNumber, stepScaleValue,
    angleRange, angleNumber, angleValue,
    numberRange, numberNumber, numberValue,
    useLerpCheckbox, lerpTimeRange, lerpTimeNumber, lerpTimeValue,
    useModulusCheckbox, modulusRadioGroup,
    useIntersectionsCheckbox,     showAxisFreqLabelsCheckbox,
    showPointsFreqLabelsCheckbox
  };
}

// Function to set up modulus radio buttons
function setupModulusRadioButtons(container, state) {
  // Clear any existing content
  container.innerHTML = '';
  
  // Create a radio button for each value from 1 to 12
  for (let i = 1; i <= 12; i++) {
    const radioItem = document.createElement('div');
    radioItem.className = 'radio-item';
    
    const radioInput = document.createElement('input');
    radioInput.type = 'radio';
    radioInput.id = `modulus-${i}`;
    radioInput.name = 'modulus';
    radioInput.value = i;
    radioInput.checked = (i === state.modulusValue);
    
    // Add event listener
    radioInput.addEventListener('change', () => {
      if (radioInput.checked) {
        state.setModulusValue(i);
      }
    });
    
    const radioLabel = document.createElement('label');
    radioLabel.htmlFor = `modulus-${i}`;
    radioLabel.textContent = i;
    
    radioItem.appendChild(radioInput);
    radioItem.appendChild(radioLabel);
    container.appendChild(radioItem);
  }
}