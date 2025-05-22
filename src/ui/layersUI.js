// src/ui/layersUI.js - UI controls for managing layers
import { LayerManager } from '../state/LayerManager.js';

/**
 * Set up the Layer tab UI with controls for managing layers
 * @param {LayerManager} layerManager The layer manager instance
 * @returns {Object} Object containing UI references
 */
export function setupLayersUI(layerManager) {
  const layerTab = document.getElementById('layer-tab');
  
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
  layerCountInput.value = '1';
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
  
  // Create layer selector container
  const layerSelectorContainer = document.createElement('div');
  layerSelectorContainer.className = 'control';
  
  const layerSelectorLabel = document.createElement('label');
  layerSelectorLabel.textContent = 'Active Layer:';
  layerSelectorContainer.appendChild(layerSelectorLabel);
  
  // Create button container for layer selection
  const layerButtonsContainer = document.createElement('div');
  layerButtonsContainer.className = 'layer-buttons';
  layerButtonsContainer.id = 'layerButtons';
  layerSelectorContainer.appendChild(layerButtonsContainer);
  
  layerTab.appendChild(layerSelectorContainer);
  
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
  layerColorPicker.value = '#ff0000';
  layerColorPicker.addEventListener('change', (e) => {
    const activeLayer = layerManager.getActiveLayer();
    if (activeLayer) {
      activeLayer.setColor(e.target.value);
    }
  });
  
  layerColorContainer.appendChild(layerColorPicker);
  
  // Add help text
  const colorHelpText = document.createElement('div');
  colorHelpText.className = 'help-text';
  colorHelpText.textContent = 'Change the color of the active layer';
  layerColorContainer.appendChild(colorHelpText);
  
  layerTab.appendChild(layerColorContainer);
  
  // Layer visibility control
  const layerVisibilityContainer = document.createElement('div');
  layerVisibilityContainer.className = 'control';
  
  const layerVisibilityLabel = document.createElement('label');
  layerVisibilityLabel.textContent = 'Layer Visible:';
  layerVisibilityLabel.setAttribute('for', 'layerVisibleCheckbox');
  layerVisibilityContainer.appendChild(layerVisibilityLabel);
  
  // Create checkbox
  const layerVisibleCheckbox = document.createElement('input');
  layerVisibleCheckbox.type = 'checkbox';
  layerVisibleCheckbox.id = 'layerVisibleCheckbox';
  layerVisibleCheckbox.checked = true;
  layerVisibleCheckbox.addEventListener('change', (e) => {
    const activeLayer = layerManager.getActiveLayer();
    if (activeLayer) {
      activeLayer.setVisible(e.target.checked);
    }
  });
  
  layerVisibilityContainer.appendChild(layerVisibleCheckbox);
  
  // Add help text
  const visibilityHelpText = document.createElement('div');
  visibilityHelpText.className = 'help-text';
  visibilityHelpText.textContent = 'Toggle visibility of the active layer';
  layerVisibilityContainer.appendChild(visibilityHelpText);
  
  layerTab.appendChild(layerVisibilityContainer);
  
  // Initial UI update
  updateLayerButtons(layerManager);
  
  // Add debug buttons to the layer tab
  addDebugButtons(layerTab, layerManager);
  
  // Return references to UI elements
  return {
    layerCountInput,
    layerColorPicker,
    layerVisibleCheckbox
  };
}

/**
 * Update the layer selection buttons based on current layers
 * @param {LayerManager} layerManager The layer manager instance
 */
function updateLayerButtons(layerManager) {
  const container = document.getElementById('layerButtons');
  if (!container) return;
  
  // Clear existing buttons
  container.innerHTML = '';
  
  // Create a button for each layer
  for (let i = 0; i < layerManager.layers.length; i++) {
    const layer = layerManager.layers[i];
    const button = document.createElement('button');
    button.textContent = `Layer ${i + 1}`;
    button.className = 'layer-button';
    button.dataset.layerId = i;
    
    // Mark active layer
    if (layerManager.activeLayerId === i) {
      button.classList.add('active');
    }
    
    // Set button color to match layer
    const color = layer.color;
    button.style.backgroundColor = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
    
    // Set button text color for visibility
    const brightness = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
    button.style.color = brightness > 0.5 ? '#000' : '#fff';
    
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
      
      // Update visibility checkbox
      const visibleCheckbox = document.getElementById('layerVisibleCheckbox');
      if (visibleCheckbox) {
        visibleCheckbox.checked = layer.visible;
      }
      
      // Ensure UI reflects the newly selected layer's state
      if (typeof window.syncStateAcrossSystems === 'function') {
        window.syncStateAcrossSystems();
      }
    });
    
    container.appendChild(button);
  }
}

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
  
  // Update visibility checkbox
  const visibleCheckbox = document.getElementById('layerVisibleCheckbox');
  if (visibleCheckbox) {
    visibleCheckbox.checked = activeLayer.visible;
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
 * Add a button to recreate geometry for debugging
 * @param {HTMLElement} container - Container to add button to
 * @param {LayerManager} layerManager - Layer manager instance
 */
function addDebugButtons(container, layerManager) {
  // Create a button container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'debug-button-container';
  buttonContainer.style.marginTop = '20px';
  buttonContainer.style.padding = '10px';
  buttonContainer.style.backgroundColor = '#333';
  buttonContainer.style.borderRadius = '5px';
  
  // Add a title
  const title = document.createElement('h3');
  title.textContent = 'Debug Tools';
  title.style.color = '#ff0000';
  title.style.margin = '0 0 10px 0';
  buttonContainer.appendChild(title);
  
  // Create recreate geometry button
  const recreateButton = document.createElement('button');
  recreateButton.textContent = 'Recreate Geometry';
  recreateButton.style.backgroundColor = '#ff3333';
  recreateButton.style.color = 'white';
  recreateButton.style.padding = '10px 15px';
  recreateButton.style.border = 'none';
  recreateButton.style.borderRadius = '4px';
  recreateButton.style.cursor = 'pointer';
  recreateButton.style.marginRight = '10px';
  
  // Add click handler
  recreateButton.addEventListener('click', () => {
    const activeLayerId = layerManager.activeLayerId;
    if (activeLayerId !== null) {
      console.log(`Manually recreating geometry for layer ${activeLayerId}`);
      const layer = layerManager.layers[activeLayerId];
      // Call the new forceVisibility method
      layer.forceVisibility();
      // Also recreate via layer manager
      layerManager.recreateLayerGeometry(activeLayerId);
    }
  });
  
  // Add button to container
  buttonContainer.appendChild(recreateButton);
  
  // Add container to parent
  container.appendChild(buttonContainer);
} 