// src/ui/layersUI.js - UI controls for managing layers
import { LayerManager } from '../state/LayerManager.js';
import { updateUIFromState } from '../state/statePersistence.js';

// Import DEBUG_BUTTONS flag from main.js if it exists, otherwise default to false
const DEBUG_BUTTONS = window.DEBUG_BUTTONS !== undefined ? window.DEBUG_BUTTONS : false;

// Global UNISON state
let unisonMode = false;

/**
 * Get the current UNISON mode state
 * @returns {boolean} Whether UNISON mode is enabled
 */
export function getUnisonMode() {
  return unisonMode;
}

/**
 * Set the UNISON mode state
 * @param {boolean} enabled Whether to enable UNISON mode
 */
export function setUnisonMode(enabled) {
  unisonMode = enabled;
  
  // Update the checkbox if it exists
  const unisonCheckbox = document.getElementById('unisonModeCheckbox');
  if (unisonCheckbox) {
    unisonCheckbox.checked = enabled;
  }
  
  // Dispatch event to notify other systems
  window.dispatchEvent(new CustomEvent('unisonModeChanged', { 
    detail: { enabled } 
  }));
  
  console.log(`UNISON mode ${enabled ? 'enabled' : 'disabled'}: Parameter changes will now apply to ${enabled ? 'all layers' : 'active layer only'}`);
}

/**
 * Apply a parameter change to all layers when UNISON mode is enabled
 * @param {string} setterName Name of the setter function
 * @param {*} value Value to set
 * @param {LayerManager} layerManager Layer manager instance
 */
export function applyUnisonParameterChange(setterName, value, layerManager) {
  if (!unisonMode || !layerManager) {
    return false; // Not in UNISON mode or no layer manager
  }
  
  // List of parameters that should be applied to all layers in UNISON mode
  const unisonParameters = [
    'setRadius', 'setSegments', 'setCopies', 'setStepScale', 'setAngle',
    'setLerpTime', 'setAltScale', 'setAltStepN', 'setFractalValue',
    'setMinDuration', 'setMaxDuration', 'setDurationPhase',
    'setMinVelocity', 'setMaxVelocity', 'setVelocityPhase',
    'setEuclidValue', 'setUseEuclid', 'setUseFractal', 'setUseStars',
    'setUseCuts', 'setUseTesselation', 'setUseLerp', 'setUseQuantization',
    'setUsePlainIntersections', 'setShowAxisFreqLabels', 'setShowPointsFreqLabels',
    'setUseDelete', 'setDeleteMin', 'setDeleteMax', 'setDeleteMode', 'setDeleteTarget', 'setDeleteSeed',
    'setDurationMode', 'setVelocityMode',
    // Radio button parameters
    'setModulusValue', 'setUseModulus', 'setDurationModulo', 'setVelocityModulo',
    'setTimeSubdivisionValue', 'setUseTimeSubdivision', 'setQuantizationValue',
    'setStarSkip'
  ];
  
  if (!unisonParameters.includes(setterName)) {
    return false; // This parameter is not supported in UNISON mode
  }
  
  let appliedCount = 0;
  
  // Apply the parameter change to all layers
  layerManager.layers.forEach((layer, index) => {
    if (layer && layer.state && typeof layer.state[setterName] === 'function') {
      try {
        layer.state[setterName](value);
        appliedCount++;
      } catch (error) {
        console.error(`Error applying ${setterName}(${value}) to layer ${index}:`, error);
      }
    }
  });
  
  if (appliedCount > 0) {
    console.log(`UNISON: Applied ${setterName}(${value}) to ${appliedCount} layers`);
    
    // Force UI update to reflect changes
    if (typeof window.syncStateAcrossSystems === 'function') {
      window.syncStateAcrossSystems();
    }
    
    return true;
  }
  
  return false;
}

/**
 * Copy all parameters from source layer to target layer
 * @param {LayerManager} layerManager The layer manager instance
 * @param {number} sourceLayerId ID of the source layer
 * @param {number} targetLayerId ID of the target layer
 */
export function copyLayerParameters(layerManager, sourceLayerId, targetLayerId) {
  if (!layerManager || !layerManager.layers) {
    console.error('Invalid layer manager for copy operation');
    return;
  }
  
  const sourceLayer = layerManager.layers[sourceLayerId];
  const targetLayer = layerManager.layers[targetLayerId];
  
  if (!sourceLayer || !targetLayer) {
    console.error(`Invalid layer IDs: source=${sourceLayerId}, target=${targetLayerId}`);
    return;
  }
  
  const sourceState = sourceLayer.state;
  const targetState = targetLayer.state;
  
  if (!sourceState || !targetState) {
    console.error('Invalid layer states for copy operation');
    return;
  }
  
  // List of all copyable parameters (based on unisonParameters)
  const copyableParameters = [
    'setRadius', 'setSegments', 'setCopies', 'setStepScale', 'setAngle',
    'setLerpTime', 'setAltScale', 'setAltStepN', 'setFractalValue',
    'setMinDuration', 'setMaxDuration', 'setDurationPhase',
    'setMinVelocity', 'setMaxVelocity', 'setVelocityPhase',
    'setEuclidValue', 'setUseEuclid', 'setUseFractal', 'setUseStars',
    'setUseCuts', 'setUseTesselation', 'setUseLerp', 'setUseQuantization',
    'setUsePlainIntersections', 'setShowAxisFreqLabels', 'setShowPointsFreqLabels',
    'setUseDelete', 'setDeleteMin', 'setDeleteMax', 'setDeleteMode', 'setDeleteTarget', 'setDeleteSeed',
    'setDurationMode', 'setVelocityMode',
    'setModulusValue', 'setUseModulus', 'setDurationModulo', 'setVelocityModulo',
    'setTimeSubdivisionValue', 'setUseTimeSubdivision', 'setQuantizationValue',
    'setStarSkip'
  ];
  
  // Map setter names to property names for reading values
  const setterToProperty = {
    'setRadius': 'radius',
    'setSegments': 'segments', 
    'setCopies': 'copies',
    'setStepScale': 'stepScale',
    'setAngle': 'angle',
    'setLerpTime': 'lerpTime',
    'setAltScale': 'altScale',
    'setAltStepN': 'altStepN',
    'setFractalValue': 'fractalValue',
    'setMinDuration': 'minDuration',
    'setMaxDuration': 'maxDuration',
    'setDurationPhase': 'durationPhase',
    'setMinVelocity': 'minVelocity',
    'setMaxVelocity': 'maxVelocity',
    'setVelocityPhase': 'velocityPhase',
    'setEuclidValue': 'euclidValue',
    'setUseEuclid': 'useEuclid',
    'setUseFractal': 'useFractal',
    'setUseStars': 'useStars',
    'setUseCuts': 'useCuts',
    'setUseTesselation': 'useTesselation',
    'setUseLerp': 'useLerp',
    'setUseQuantization': 'useQuantization',
    'setUsePlainIntersections': 'usePlainIntersections',
    'setShowAxisFreqLabels': 'showAxisFreqLabels',
    'setShowPointsFreqLabels': 'showPointsFreqLabels',
    'setUseDelete': 'useDelete',
    'setDeleteMin': 'deleteMin',
    'setDeleteMax': 'deleteMax',
    'setDeleteMode': 'deleteMode',
    'setDeleteTarget': 'deleteTarget',
    'setDeleteSeed': 'deleteSeed',
    'setDurationMode': 'durationMode',
    'setVelocityMode': 'velocityMode',
    'setModulusValue': 'modulusValue',
    'setUseModulus': 'useModulus',
    'setDurationModulo': 'durationModulo',
    'setVelocityModulo': 'velocityModulo',
    'setTimeSubdivisionValue': 'timeSubdivisionValue',
    'setUseTimeSubdivision': 'useTimeSubdivision',
    'setQuantizationValue': 'quantizationValue',
    'setStarSkip': 'starSkip'
  };
  
  let copiedCount = 0;
  let errorCount = 0;
  
  // Copy each parameter
  copyableParameters.forEach(setterName => {
    const propertyName = setterToProperty[setterName];
    
    if (!propertyName) {
      console.warn(`No property mapping found for setter: ${setterName}`);
      return;
    }
    
    // Check if both source and target have the setter method
    if (typeof targetState[setterName] === 'function') {
      try {
        // Get the value from source state
        const value = sourceState[propertyName];
        
        if (value !== undefined) {
          // Set the value on target state
          targetState[setterName](value);
          copiedCount++;
        }
      } catch (error) {
        console.error(`Error copying ${setterName}:`, error);
        errorCount++;
      }
    }
  });
  
  console.log(`Layer copy complete: ${copiedCount} parameters copied from Layer ${sourceLayerId + 1} to Layer ${targetLayerId + 1}${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);
  
  // Force UI update to reflect the changes
  if (typeof window.syncStateAcrossSystems === 'function') {
    window.syncStateAcrossSystems();
  }
  
  // Update layer buttons to reflect any visual changes
  updateLayerButtons(layerManager);
}

/**
 * Set up the fixed layer controls that are always visible
 * @param {LayerManager} layerManager The layer manager instance
 */
function setupFixedLayerControls(layerManager) {
  // Initialize the fixed layer buttons
  updateFixedLayerButtons(layerManager);
  
  console.log('Fixed layer controls initialized');
}

/**
 * Set up the Layer tab UI with controls for managing layers
 * @param {LayerManager} layerManager The layer manager instance
 * @returns {Object} Object containing UI references
 */
export function setupLayersUI(layerManager) {
  if (!layerManager) {
    console.error('Cannot set up layers UI: No layer manager provided');
    return null;
  }
  
  // Set up the fixed layer controls first
  setupFixedLayerControls(layerManager);
  
  // Create the layer tab container
  const layerTab = document.getElementById('layer-tab');
  if (!layerTab) {
    console.error('Cannot set up layers UI: No layer tab element found');
    return null;
  }
  
  // Clear existing content
  layerTab.innerHTML = '';
  
  // Create layer count control
  const layerCountContainer = document.createElement('div');
  layerCountContainer.className = 'control';
  
  const layerCountLabel = document.createElement('label');
  layerCountLabel.textContent = 'Number of Layers:';
  layerCountLabel.setAttribute('for', 'layerCountNumber');
  layerCountContainer.appendChild(layerCountLabel);
  
  // Create input container
  const inputContainer = document.createElement('div');
  inputContainer.className = 'input-container';
  
  // Create number input for layer count
  const layerCountInput = document.createElement('input');
  layerCountInput.type = 'number';
  layerCountInput.id = 'layerCountNumber';
  layerCountInput.min = '1';
  layerCountInput.max = '10';
  layerCountInput.value = layerManager.layers.length.toString();
  layerCountInput.addEventListener('change', (e) => {
    const count = parseInt(e.target.value, 10);
    if (!isNaN(count) && count >= 1) {
      layerManager.updateLayerCount(count);
      updateLayerButtons(layerManager);
    }
  });
  
  inputContainer.appendChild(layerCountInput);
  layerCountContainer.appendChild(inputContainer);
  
  // Add help text
  const helpText = document.createElement('div');
  helpText.className = 'help-text';
  helpText.textContent = 'Number of independent geometry layers';
  layerCountContainer.appendChild(helpText);
  
  layerTab.appendChild(layerCountContainer);
  
  // Add UNISON mode control
  const unisonContainer = document.createElement('div');
  unisonContainer.className = 'control';
  
  const unisonLabel = document.createElement('label');
  unisonLabel.textContent = 'UNISON Mode:';
  unisonLabel.setAttribute('for', 'unisonModeCheckbox');
  unisonContainer.appendChild(unisonLabel);
  
  // Create UNISON checkbox
  const unisonCheckbox = document.createElement('input');
  unisonCheckbox.type = 'checkbox';
  unisonCheckbox.id = 'unisonModeCheckbox';
  unisonCheckbox.checked = unisonMode;
  
  unisonCheckbox.addEventListener('change', (e) => {
    setUnisonMode(e.target.checked);
  });
  
  unisonContainer.appendChild(unisonCheckbox);
  
  // Add help text
  const unisonHelpText = document.createElement('div');
  unisonHelpText.className = 'help-text';
  unisonHelpText.textContent = 'When enabled, parameter changes apply to all layers simultaneously';
  unisonContainer.appendChild(unisonHelpText);
  
  layerTab.appendChild(unisonContainer);
  
  // Add layer color control
  const layerColorContainer = document.createElement('div');
  layerColorContainer.className = 'control';
  
  const layerColorLabel = document.createElement('label');
  layerColorLabel.textContent = 'Layer Color:';
  layerColorLabel.setAttribute('for', 'layerColorPicker');
  layerColorContainer.appendChild(layerColorLabel);
  
  // Create color picker
  const layerColorPicker = document.createElement('input');
  layerColorPicker.type = 'color';
  layerColorPicker.id = 'layerColorPicker';
  
  // Set the color picker to the active layer's color
  const activeLayer = layerManager.getActiveLayer();
  if (activeLayer && activeLayer.color) {
    layerColorPicker.value = '#' + activeLayer.color.getHexString();
  } else {
    layerColorPicker.value = '#ff0000'; // Fallback to red if no active layer
  }
  
  layerColorPicker.addEventListener('change', (e) => {
    const activeLayer = layerManager.getActiveLayer();
    if (activeLayer) {
      const activeLayerId = activeLayer.id;
      
      // Use the new method that handles all update aspects
      if (typeof layerManager.updateLayerColor === 'function') {
        layerManager.updateLayerColor(activeLayerId, e.target.value);
      } else {
        // Fallback to the original implementation with enhancements
        // Set the new color
        activeLayer.setColor(e.target.value);
        
        // Immediately update the layer buttons to reflect the new color
        updateLayerButtons(layerManager);
        
        // Force a geometry update to reflect the color change
        if (activeLayer.recreateGeometry) {
          activeLayer.recreateGeometry();
        }
        
        // Force material update for all instances of this layer
        if (activeLayer.group) {
          activeLayer.group.traverse(child => {
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => {
                  mat.color = activeLayer.color;
                  mat.needsUpdate = true;
                });
              } else {
                child.material.color = activeLayer.color;
                child.material.needsUpdate = true;
              }
            }
          });
        }
        
        // Update UI and sync state to ensure color change takes effect immediately
        if (typeof window.syncStateAcrossSystems === 'function') {
          window.syncStateAcrossSystems();
        }
      }
    }
  });
  
  layerColorContainer.appendChild(layerColorPicker);
  
  // Add help text
  const colorHelpText = document.createElement('div');
  colorHelpText.className = 'help-text';
  colorHelpText.textContent = 'Change the color of the active layer';
  layerColorContainer.appendChild(colorHelpText);
  
  layerTab.appendChild(layerColorContainer);
  
  // Add Copy Parameters control
  const copyParametersContainer = document.createElement('div');
  copyParametersContainer.className = 'control copy-parameters-section';
  
  const copyParametersTitle = document.createElement('h3');
  copyParametersTitle.textContent = 'Copy Parameters';
  copyParametersTitle.style.margin = '10px 0 5px 0';
  copyParametersTitle.style.fontSize = '16px';
  copyParametersTitle.style.fontWeight = 'bold';
  copyParametersContainer.appendChild(copyParametersTitle);

  // Copy to layer selector
  const copyToContainer = document.createElement('div');
  copyToContainer.className = 'control';
  
  const copyToLabel = document.createElement('label');
  copyToLabel.textContent = 'Copy to Layer:';
  copyToLabel.setAttribute('for', 'copyToLayerSelect');
  copyToContainer.appendChild(copyToLabel);
  
  const copyToSelect = document.createElement('select');
  copyToSelect.id = 'copyToLayerSelect';
  
  // Populate with layer options (excluding current active layer)
  const updateCopyToOptions = () => {
    copyToSelect.innerHTML = '';
    const activeLayerId = layerManager.activeLayerId;
    
    for (let i = 0; i < layerManager.layers.length; i++) {
      if (i !== activeLayerId) { // Don't include the active layer
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Layer ${i + 1}`;
        copyToSelect.appendChild(option);
      }
    }
    
    // Disable if no target layers available
    copyToSelect.disabled = layerManager.layers.length <= 1;
  };
  
  updateCopyToOptions();
  copyToContainer.appendChild(copyToSelect);
  copyParametersContainer.appendChild(copyToContainer);

  // Copy button
  const copyButtonContainer = document.createElement('div');
  copyButtonContainer.className = 'control';
  
  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy Parameters';
  copyButton.className = 'copy-parameters-button';
  copyButton.style.padding = '8px 16px';
  copyButton.style.backgroundColor = '#2196F3';
  copyButton.style.color = 'white';
  copyButton.style.border = 'none';
  copyButton.style.borderRadius = '4px';
  copyButton.style.cursor = 'pointer';
  copyButton.style.fontSize = '14px';
  copyButton.style.fontWeight = 'bold';
  copyButton.style.transition = 'background-color 0.3s ease';
  copyButton.style.width = '100%';
  
  // Disable if no target layers available
  copyButton.disabled = layerManager.layers.length <= 1;
  
  // Add hover effect
  copyButton.addEventListener('mouseenter', () => {
    if (!copyButton.disabled) {
      copyButton.style.backgroundColor = '#1976D2';
    }
  });
  copyButton.addEventListener('mouseleave', () => {
    if (!copyButton.disabled) {
      copyButton.style.backgroundColor = '#2196F3';
    }
  });
  
  // Add click handler to copy parameters
  copyButton.addEventListener('click', () => {
    const targetLayerId = parseInt(copyToSelect.value);
    const sourceLayerId = layerManager.activeLayerId;
    
    if (isNaN(targetLayerId) || sourceLayerId === undefined) {
      console.error('Invalid layer selection for copy operation');
      return;
    }
    
    copyLayerParameters(layerManager, sourceLayerId, targetLayerId);
  });
  
  copyButtonContainer.appendChild(copyButton);
  copyParametersContainer.appendChild(copyButtonContainer);

  // Add help text
  const copyHelpText = document.createElement('div');
  copyHelpText.className = 'help-text';
  copyHelpText.textContent = 'Copy all parameters from the active layer to the selected target layer';
  copyParametersContainer.appendChild(copyHelpText);

  layerTab.appendChild(copyParametersContainer);
  
  // Add Rainbow Colors button
  const rainbowColorsContainer = document.createElement('div');
  rainbowColorsContainer.className = 'control';
  
  const rainbowColorsButton = document.createElement('button');
  rainbowColorsButton.textContent = 'Rainbow Colors';
  rainbowColorsButton.className = 'rainbow-colors-button';
  rainbowColorsButton.style.padding = '8px 16px';
  rainbowColorsButton.style.backgroundColor = '#4CAF50';
  rainbowColorsButton.style.color = 'white';
  rainbowColorsButton.style.border = 'none';
  rainbowColorsButton.style.borderRadius = '4px';
  rainbowColorsButton.style.cursor = 'pointer';
  rainbowColorsButton.style.fontSize = '14px';
  rainbowColorsButton.style.fontWeight = 'bold';
  rainbowColorsButton.style.transition = 'background-color 0.3s ease';
  
  // Add hover effect
  rainbowColorsButton.addEventListener('mouseenter', () => {
    rainbowColorsButton.style.backgroundColor = '#45a049';
  });
  rainbowColorsButton.addEventListener('mouseleave', () => {
    rainbowColorsButton.style.backgroundColor = '#4CAF50';
  });
  
  // Add click handler to apply sine wave colors
  rainbowColorsButton.addEventListener('click', () => {
    if (layerManager && typeof layerManager.applySineWaveColors === 'function') {
      layerManager.applySineWaveColors();
    } else {
      console.error('Rainbow Colors: LayerManager or applySineWaveColors method not available');
    }
  });
  
  rainbowColorsContainer.appendChild(rainbowColorsButton);
  
  // Add help text
  const rainbowHelpText = document.createElement('div');
  rainbowHelpText.className = 'help-text';
  rainbowHelpText.textContent = 'Apply mathematical sine wave color palette to all layers';
  rainbowColorsContainer.appendChild(rainbowHelpText);
  
  layerTab.appendChild(rainbowColorsContainer);
  
  // Add Layer Link controls
  const layerLinkContainer = document.createElement('div');
  layerLinkContainer.className = 'control layer-link-section';
  
  // Layer Link title
  const layerLinkTitle = document.createElement('h3');
  layerLinkTitle.textContent = 'Layer Link';
  layerLinkTitle.style.margin = '10px 0 5px 0';
  layerLinkTitle.style.fontSize = '16px';
  layerLinkTitle.style.fontWeight = 'bold';
  layerLinkContainer.appendChild(layerLinkTitle);
  
  // Layer Link enable checkbox
  const layerLinkEnableContainer = document.createElement('div');
  layerLinkEnableContainer.className = 'control';
  
  const layerLinkEnableLabel = document.createElement('label');
  layerLinkEnableLabel.textContent = 'Enable Layer Link:';
  layerLinkEnableLabel.setAttribute('for', 'layerLinkEnable');
  layerLinkEnableContainer.appendChild(layerLinkEnableLabel);
  
  const layerLinkEnableCheckbox = document.createElement('input');
  layerLinkEnableCheckbox.type = 'checkbox';
  layerLinkEnableCheckbox.id = 'layerLinkEnable';
  layerLinkEnableCheckbox.checked = false;
  
  layerLinkEnableCheckbox.addEventListener('change', (e) => {
    // Import and use the layer link manager
    import('../geometry/layerLink.js').then(module => {
      module.layerLinkManager.setEnabled(e.target.checked, layerManager);
      
      // Update link visibility controls
      const fromSelect = document.getElementById('layerLinkFrom');
      const toSelect = document.getElementById('layerLinkTo');
      const traceCheckbox = document.getElementById('layerLinkTrace');
      const trailLengthSlider = document.getElementById('layerLinkTrailLength');
      
      if (fromSelect) fromSelect.disabled = !e.target.checked;
      if (toSelect) toSelect.disabled = !e.target.checked;
      if (traceCheckbox) traceCheckbox.disabled = !e.target.checked;
      if (trailLengthSlider) trailLengthSlider.disabled = !e.target.checked;
    });
  });
  
  layerLinkEnableContainer.appendChild(layerLinkEnableCheckbox);
  
  const layerLinkEnableHelp = document.createElement('div');
  layerLinkEnableHelp.className = 'help-text';
  layerLinkEnableHelp.textContent = 'Enable linking between layer vertices';
  layerLinkEnableContainer.appendChild(layerLinkEnableHelp);
  
  layerLinkContainer.appendChild(layerLinkEnableContainer);
  
  // From Layer selector
  const layerLinkFromContainer = document.createElement('div');
  layerLinkFromContainer.className = 'control';
  
  const layerLinkFromLabel = document.createElement('label');
  layerLinkFromLabel.textContent = 'From Layer:';
  layerLinkFromLabel.setAttribute('for', 'layerLinkFrom');
  layerLinkFromContainer.appendChild(layerLinkFromLabel);
  
  const layerLinkFromSelect = document.createElement('select');
  layerLinkFromSelect.id = 'layerLinkFrom';
  layerLinkFromSelect.disabled = true;
  
  // Populate with layer options
  for (let i = 0; i < layerManager.layers.length; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Layer ${i + 1}`;
    layerLinkFromSelect.appendChild(option);
  }
  
  layerLinkFromSelect.addEventListener('change', (e) => {
    import('../geometry/layerLink.js').then(module => {
      module.layerLinkManager.setFromLayer(parseInt(e.target.value));
      module.layerLinkManager.updateLinks(layerManager);
    });
  });
  
  layerLinkFromContainer.appendChild(layerLinkFromSelect);
  layerLinkContainer.appendChild(layerLinkFromContainer);
  
  // To Layer selector
  const layerLinkToContainer = document.createElement('div');
  layerLinkToContainer.className = 'control';
  
  const layerLinkToLabel = document.createElement('label');
  layerLinkToLabel.textContent = 'To Layer:';
  layerLinkToLabel.setAttribute('for', 'layerLinkTo');
  layerLinkToContainer.appendChild(layerLinkToLabel);
  
  const layerLinkToSelect = document.createElement('select');
  layerLinkToSelect.id = 'layerLinkTo';
  layerLinkToSelect.disabled = true;
  
  // Populate with layer options
  for (let i = 0; i < layerManager.layers.length; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = `Layer ${i + 1}`;
    layerLinkToSelect.appendChild(option);
  }
  
  // Set default to layer 1 (index 1)
  if (layerManager.layers.length > 1) {
    layerLinkToSelect.value = 1;
  }
  
  layerLinkToSelect.addEventListener('change', (e) => {
    import('../geometry/layerLink.js').then(module => {
      module.layerLinkManager.setToLayer(parseInt(e.target.value));
      module.layerLinkManager.updateLinks(layerManager);
    });
  });
  
  layerLinkToContainer.appendChild(layerLinkToSelect);
  layerLinkContainer.appendChild(layerLinkToContainer);
  
  // Trace enable checkbox
  const layerLinkTraceContainer = document.createElement('div');
  layerLinkTraceContainer.className = 'control';
  
  const layerLinkTraceLabel = document.createElement('label');
  layerLinkTraceLabel.textContent = 'Enable Trace:';
  layerLinkTraceLabel.setAttribute('for', 'layerLinkTrace');
  layerLinkTraceContainer.appendChild(layerLinkTraceLabel);
  
  const layerLinkTraceCheckbox = document.createElement('input');
  layerLinkTraceCheckbox.type = 'checkbox';
  layerLinkTraceCheckbox.id = 'layerLinkTrace';
  layerLinkTraceCheckbox.checked = false;
  layerLinkTraceCheckbox.disabled = true;
  
  layerLinkTraceCheckbox.addEventListener('change', (e) => {
    import('../geometry/layerLink.js').then(module => {
      module.layerLinkManager.setTraceEnabled(e.target.checked);
    });
  });
  
  layerLinkTraceContainer.appendChild(layerLinkTraceCheckbox);
  
  const layerLinkTraceHelp = document.createElement('div');
  layerLinkTraceHelp.className = 'help-text';
  layerLinkTraceHelp.textContent = 'Show trace paths of link midpoints';
  layerLinkTraceContainer.appendChild(layerLinkTraceHelp);
  
  layerLinkContainer.appendChild(layerLinkTraceContainer);
  
  // Trail Length slider
  const layerLinkTrailLengthContainer = document.createElement('div');
  layerLinkTrailLengthContainer.className = 'control';
  
  const layerLinkTrailLengthLabel = document.createElement('label');
  layerLinkTrailLengthLabel.textContent = 'Trail Length:';
  layerLinkTrailLengthLabel.setAttribute('for', 'layerLinkTrailLength');
  layerLinkTrailLengthContainer.appendChild(layerLinkTrailLengthLabel);
  
  const layerLinkTrailLengthSlider = document.createElement('input');
  layerLinkTrailLengthSlider.type = 'range';
  layerLinkTrailLengthSlider.id = 'layerLinkTrailLength';
  layerLinkTrailLengthSlider.min = '100';
  layerLinkTrailLengthSlider.max = '10000';
  layerLinkTrailLengthSlider.value = '1000';
  layerLinkTrailLengthSlider.step = '100';
  layerLinkTrailLengthSlider.disabled = true;
  
  const layerLinkTrailLengthValue = document.createElement('span');
  layerLinkTrailLengthValue.textContent = '1000';
  layerLinkTrailLengthValue.style.marginLeft = '10px';
  layerLinkTrailLengthValue.style.fontWeight = 'bold';
  
  layerLinkTrailLengthSlider.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    layerLinkTrailLengthValue.textContent = value;
    
    import('../geometry/layerLink.js').then(module => {
      module.layerLinkManager.setTrailLength(value);
    });
  });
  
  layerLinkTrailLengthContainer.appendChild(layerLinkTrailLengthSlider);
  layerLinkTrailLengthContainer.appendChild(layerLinkTrailLengthValue);
  
  const layerLinkTrailLengthHelp = document.createElement('div');
  layerLinkTrailLengthHelp.className = 'help-text';
  layerLinkTrailLengthHelp.textContent = 'Length of pixel-perfect trail lines (100-10000)';
  layerLinkTrailLengthContainer.appendChild(layerLinkTrailLengthHelp);
  
  layerLinkContainer.appendChild(layerLinkTrailLengthContainer);
  
  layerTab.appendChild(layerLinkContainer);
  
  // Initial UI update
  updateLayerButtons(layerManager);
  
  // Add debug buttons to the layer tab
  if (DEBUG_BUTTONS) {
    addDebugButtons(layerTab, layerManager);
  }
  
  // Return references to UI elements
  return {
    layerCountInput,
    layerColorPicker,
    unisonCheckbox,
    layerLinkEnableCheckbox,
    layerLinkFromSelect,
    layerLinkToSelect,
    layerLinkTraceCheckbox,
    layerLinkTrailLengthSlider,
    copyToSelect,
    copyButton,
    updateCopyToOptions
  };
}

/**
 * Calculate the relative luminance of a color using the WCAG formula
 * @param {THREE.Color} color Three.js color object
 * @returns {number} Relative luminance value between 0 and 1
 */
function calculateLuminance(color) {
  // Validate input
  if (!color || typeof color.r !== 'number' || typeof color.g !== 'number' || typeof color.b !== 'number') {
    
    return 0; // Default to dark (white text)
  }
  
  // Ensure values are in valid range [0, 1]
  const r = Math.max(0, Math.min(1, color.r || 0));
  const g = Math.max(0, Math.min(1, color.g || 0));
  const b = Math.max(0, Math.min(1, color.b || 0));
  
  // Apply gamma correction for accurate luminance calculation
  const sRGBToLinear = (c) => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  
  const rLinear = sRGBToLinear(r);
  const gLinear = sRGBToLinear(g);
  const bLinear = sRGBToLinear(b);
  
  // Calculate relative luminance using WCAG formula
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Determine if text should be dark or light based on background color
 * @param {THREE.Color} backgroundColor Three.js color object
 * @returns {string} '#000000' for dark text or '#ffffff' for light text
 */
function getContrastColor(backgroundColor) {
  const luminance = calculateLuminance(backgroundColor);
  // Use WCAG recommended threshold of ~0.18 for better contrast
  return luminance > 0.18 ? '#000000' : '#ffffff';
}

/**
 * Safely convert Three.js color to RGB string with validation
 * @param {THREE.Color} color Three.js color object
 * @returns {string} RGB color string
 */
function colorToRGB(color) {
  // Validate input
  if (!color || typeof color.r !== 'number' || typeof color.g !== 'number' || typeof color.b !== 'number') {
    
    return 'rgb(255, 0, 0)'; // Fallback to red
  }
  
  // Ensure values are in valid range and convert to 0-255
  const r = Math.round(Math.max(0, Math.min(1, color.r || 0)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, color.g || 0)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, color.b || 0)) * 255);
  
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Update the layer selection buttons based on current layers
 * @param {LayerManager} layerManager The layer manager instance
 */
export function updateLayerButtons(layerManager) {
  // Only update the fixed layer buttons now
  updateFixedLayerButtons(layerManager);
}

/**
 * Update the fixed layer buttons that are always visible
 * @param {LayerManager} layerManager The layer manager instance
 */
function updateFixedLayerButtons(layerManager) {
  const container = document.getElementById('fixed-layer-buttons');
  if (!container) return;
  
  // Clear existing buttons
  container.innerHTML = '';
  
  // Create a button for each layer
  for (let i = 0; i < layerManager.layers.length; i++) {
    const layer = layerManager.layers[i];
    const button = document.createElement('button');
    button.textContent = `Layer ${i + 1}`;
    button.className = 'fixed-layer-button';
    button.dataset.layerId = i;
    
    // Mark active layer
    if (layerManager.activeLayerId === i) {
      button.classList.add('active');
    }
    
    // Set button color to match layer with proper validation
    const color = layer.color;
    button.style.backgroundColor = colorToRGB(color);
    
    // Set button text color for optimal contrast
    button.style.color = getContrastColor(color);
    
    // Add click handler to select layer
    button.addEventListener('click', () => {
      layerManager.setActiveLayer(i);
      updateLayerButtons(layerManager);
      
      // Update color picker to match layer color
      const colorPicker = document.getElementById('layerColorPicker');
      if (colorPicker) {
        const hexColor = '#' + layer.color.getHexString();
        colorPicker.value = hexColor;
      }
      
      // Update copy dropdown options when active layer changes
      updateCopyDropdownOptions(layerManager);
      
      // Ensure UI reflects the newly selected layer's state
      if (typeof window.syncStateAcrossSystems === 'function') {
        // Pass true to indicate this is a layer switch operation
        window.syncStateAcrossSystems(true);
      }
    });
    
    container.appendChild(button);
  }
}

/**
 * Update the copy dropdown options when layers change
 * @param {LayerManager} layerManager The layer manager instance
 */
function updateCopyDropdownOptions(layerManager) {
  const copyToSelect = document.getElementById('copyToLayerSelect');
  const copyButton = document.querySelector('.copy-parameters-button');
  
  if (!copyToSelect) return;
  
  // Clear existing options
  copyToSelect.innerHTML = '';
  const activeLayerId = layerManager.activeLayerId;
  
  // Populate with layer options (excluding current active layer)
  for (let i = 0; i < layerManager.layers.length; i++) {
    if (i !== activeLayerId) { // Don't include the active layer
      const option = document.createElement('option');
      option.value = i;
      option.textContent = `Layer ${i + 1}`;
      copyToSelect.appendChild(option);
    }
  }
  
  // Enable/disable controls based on available target layers
  const hasTargets = layerManager.layers.length > 1;
  copyToSelect.disabled = !hasTargets;
  
  if (copyButton) {
    copyButton.disabled = !hasTargets;
    if (hasTargets) {
      copyButton.style.backgroundColor = '#2196F3';
      copyButton.style.cursor = 'pointer';
    } else {
      copyButton.style.backgroundColor = '#cccccc';
      copyButton.style.cursor = 'not-allowed';
    }
  }
}

/**
 * Update the layer link dropdown options when layers change
 * @param {LayerManager} layerManager The layer manager instance
 */
function updateLayerLinkDropdowns(layerManager) {
  const fromSelect = document.getElementById('layerLinkFrom');
  const toSelect = document.getElementById('layerLinkTo');
  
  if (!fromSelect || !toSelect) return;
  
  // Store current values
  const currentFromValue = fromSelect.value;
  const currentToValue = toSelect.value;
  
  // Clear existing options
  fromSelect.innerHTML = '';
  toSelect.innerHTML = '';
  
  // Populate with new layer options
  for (let i = 0; i < layerManager.layers.length; i++) {
    const fromOption = document.createElement('option');
    fromOption.value = i;
    fromOption.textContent = `Layer ${i + 1}`;
    fromSelect.appendChild(fromOption);
    
    const toOption = document.createElement('option');
    toOption.value = i;
    toOption.textContent = `Layer ${i + 1}`;
    toSelect.appendChild(toOption);
  }
  
  // Restore previous values if they're still valid
  if (currentFromValue < layerManager.layers.length) {
    fromSelect.value = currentFromValue;
  }
  if (currentToValue < layerManager.layers.length) {
    toSelect.value = currentToValue;
  } else if (layerManager.layers.length > 1) {
    // Default to layer 1 if previous value is invalid
    toSelect.value = 1;
  }
  
  // Update the layer link manager with new values
  import('../geometry/layerLink.js').then(module => {
    module.layerLinkManager.setFromLayer(parseInt(fromSelect.value));
    module.layerLinkManager.setToLayer(parseInt(toSelect.value));
    if (module.layerLinkManager.enabled) {
      module.layerLinkManager.updateLinks(layerManager);
    }
  }).catch(error => {
    console.warn('Layer link module not available:', error);
  });
}

// Make the function globally available
window.updateLayerButtons = updateLayerButtons;

/**
 * Update UI elements to reflect the active layer
 * @param {LayerManager} layerManager The layer manager instance
 */
export function updateLayersUI(layerManager) {
  const activeLayer = layerManager.getActiveLayer();
  if (!activeLayer) return;
  
  // Update color picker
  const colorPicker = document.getElementById('layerColorPicker');
  if (colorPicker) {
    const hexColor = '#' + activeLayer.color.getHexString();
    colorPicker.value = hexColor;
  }
  
  // Update layer count
  const layerCountInput = document.getElementById('layerCountNumber');
  if (layerCountInput) {
    layerCountInput.value = layerManager.layers.length;
  }
  
  // Update layer buttons
  updateLayerButtons(layerManager);
}

/**
 * Add debug buttons to the layer tab
 * @param {HTMLElement} container Container to add buttons to
 * @param {LayerManager} layerManager Layer manager instance
 */
function addDebugButtons(container, layerManager) {
  const debugContainer = document.createElement('div');
  debugContainer.className = 'debug-container';
  debugContainer.style.marginTop = '20px';
  debugContainer.style.padding = '10px';
  debugContainer.style.border = '1px solid #444';
  debugContainer.style.borderRadius = '4px';
  debugContainer.style.position = 'absolute';
  debugContainer.style.right = '10px';
  debugContainer.style.top = '250px';
  debugContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  debugContainer.style.zIndex = '1000';
  
  const debugTitle = document.createElement('h3');
  debugTitle.textContent = 'Debug Controls';
  debugTitle.style.margin = '0 0 10px 0';
  debugTitle.style.color = '#fff';
  debugContainer.appendChild(debugTitle);
  
  // Create button for layer state verification
  const verifyStateButton = document.createElement('button');
  verifyStateButton.textContent = 'Verify Layer State';
  verifyStateButton.className = 'debug-button';
  verifyStateButton.style.marginRight = '10px';
  verifyStateButton.style.marginBottom = '10px';
  verifyStateButton.style.padding = '5px 10px';
  verifyStateButton.style.backgroundColor = '#f00';
  verifyStateButton.style.color = '#fff';
  verifyStateButton.style.border = 'none';
  verifyStateButton.style.borderRadius = '4px';
  verifyStateButton.addEventListener('click', () => {
    if (typeof layerManager.debugActiveLayerState === 'function') {
      layerManager.debugActiveLayerState();
    } else {
      console.error('debugActiveLayerState function not available on layerManager');
    }
  });
  debugContainer.appendChild(verifyStateButton);
  
  // Create button for geometry recreation
  const recreateGeometryButton = document.createElement('button');
  recreateGeometryButton.textContent = 'Recreate Geometry';
  recreateGeometryButton.className = 'debug-button';
  recreateGeometryButton.style.marginRight = '10px';
  recreateGeometryButton.style.padding = '5px 10px';
  recreateGeometryButton.style.backgroundColor = '#00f';
  recreateGeometryButton.style.color = '#fff';
  recreateGeometryButton.style.border = 'none';
  recreateGeometryButton.style.borderRadius = '4px';
  recreateGeometryButton.addEventListener('click', () => {
    const activeLayer = layerManager.getActiveLayer();
    if (activeLayer) {
      
      activeLayer.recreateGeometry();
    }
  });
  debugContainer.appendChild(recreateGeometryButton);
  
  // Add to document body instead of container for absolute positioning
  document.body.appendChild(debugContainer);
} 