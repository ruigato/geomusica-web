// src/ui/layersUI.js - UI controls for managing layers
import { LayerManager } from '../state/LayerManager.js';
import { updateUIFromState } from '../state/statePersistence.js';

// Import DEBUG_BUTTONS flag from main.js if it exists, otherwise default to false
const DEBUG_BUTTONS = window.DEBUG_BUTTONS !== undefined ? window.DEBUG_BUTTONS : false;

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
  
  // Initial UI update
  updateLayerButtons(layerManager);
  
  // Add debug buttons to the layer tab
  if (DEBUG_BUTTONS) {
    addDebugButtons(layerTab, layerManager);
  }
  
  // Return references to UI elements
  return {
    layerCountInput,
    layerColorPicker
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
      
      // Ensure UI reflects the newly selected layer's state
      if (typeof window.syncStateAcrossSystems === 'function') {
        // Pass true to indicate this is a layer switch operation
        window.syncStateAcrossSystems(true);
      }
    });
    
    container.appendChild(button);
  }
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