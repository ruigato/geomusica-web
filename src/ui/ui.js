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
    useLerpCheckbox, lerpTimeRange, lerpTimeNumber, lerpTimeValue
  };
}