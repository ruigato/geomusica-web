// src/ui/domLabels.js - Updated to show note parameters
import * as THREE from 'three';

// Label containers
let pointLabelContainer = null;
let axisLabelContainer = null;

// Object pools for label reuse
const pointLabelPool = [];
const axisLabelPool = [];

// Maps for tracking active labels
const activePointLabels = new Map();
const activeAxisLabels = new Map();

// Map to store labels by marker ID
const labelMap = new Map();
let nextLabelId = 1;

// Initialize layer event listeners
let layerEventListenersInitialized = false;

/**
 * Initialize the DOM labels system
 * @param {THREE.WebGLRenderer} renderer Renderer to get element dimensions
 */
export function initLabels(renderer) {
  // Initialize containers first
  initLabelContainers();
  
  // Clear any existing labels
  for (const label of labelMap.values()) {
    if (label.parentNode) {
      label.parentNode.removeChild(label);
    }
  }
  
  // Reset maps
  labelMap.clear();
  activePointLabels.clear();
  activeAxisLabels.clear();
  
  // Reset ID counter
  nextLabelId = 1;
  
  
}

/**
 * Initialize the label containers
 */
function initLabelContainers() {
  // Create the point label container if it doesn't exist
  pointLabelContainer = document.getElementById('point-labels-container');
  if (!pointLabelContainer) {
    pointLabelContainer = document.createElement('div');
    pointLabelContainer.id = 'point-labels-container';
    pointLabelContainer.style.position = 'absolute';
    pointLabelContainer.style.top = '0';
    pointLabelContainer.style.left = '0';
    pointLabelContainer.style.width = '100%';
    pointLabelContainer.style.height = '100%';
    pointLabelContainer.style.pointerEvents = 'none';
    pointLabelContainer.style.overflow = 'hidden';
    pointLabelContainer.style.zIndex = '1000'; // Lower z-index
    document.body.appendChild(pointLabelContainer);
  }
  
  // Create the axis label container if it doesn't exist
  axisLabelContainer = document.getElementById('axis-labels-container');
  if (!axisLabelContainer) {
    axisLabelContainer = document.createElement('div');
    axisLabelContainer.id = 'axis-labels-container';
    axisLabelContainer.style.position = 'absolute';
    axisLabelContainer.style.top = '0';
    axisLabelContainer.style.left = '0';
    axisLabelContainer.style.width = '100%';
    axisLabelContainer.style.height = '100%';
    axisLabelContainer.style.pointerEvents = 'none';
    axisLabelContainer.style.overflow = 'hidden';
    axisLabelContainer.style.zIndex = '1001'; // Higher z-index
    document.body.appendChild(axisLabelContainer);
  }
}

/**
 * Get a point label from the pool or create a new one
 * @returns {HTMLElement} Label element
 */
function getPointLabel() {
  if (pointLabelPool.length > 0) {
    const label = pointLabelPool.pop();
    label.style.display = 'block';
    return label;
  }
  
  // Create a new point label
  const label = document.createElement('div');
  label.className = 'point-frequency-label';
  label.style.position = 'absolute';
  label.style.fontFamily = '"Perfect DOS VGA 437", monospace';
  label.style.fontSize = '14px';
  label.style.color = '#ffffff';
  label.style.textAlign = 'center';
  label.style.backgroundColor = 'transparent';
  label.style.padding = '2px 4px';
  label.style.pointerEvents = 'none';
  label.style.transform = 'translate(-50%, -50%)';
  pointLabelContainer.appendChild(label);
  
  return label;
}

/**
 * Get an axis label from the pool or create a new one
 * @returns {HTMLElement} Label element
 */
function getAxisLabel() {
  if (axisLabelPool.length > 0) {
    const label = axisLabelPool.pop();
    label.style.display = 'block';
    return label;
  }
  
  // Create a new axis label
  const label = document.createElement('div');
  label.className = 'axis-frequency-label'; 
  label.style.position = 'absolute';
  label.style.fontFamily = '"Perfect DOS VGA 437", monospace';
  label.style.fontSize = '14px';
  label.style.color = '#ffffff';
  label.style.textAlign = 'center';
  label.style.backgroundColor = 'rgba(255, 0, 255, 0.7)';
  label.style.padding = '2px 4px';
  label.style.borderRadius = '2px';
  label.style.pointerEvents = 'none';
  label.style.transform = 'translate(-50%, -100%)'; // Ensure label is centered horizontally above the point
  label.style.transformOrigin = 'bottom center'; // Set transform origin for better positioning
  label.style.whiteSpace = 'nowrap'; // Prevent text wrapping for better readability
  axisLabelContainer.appendChild(label);
  
  return label;
}

/**
 * Release a point label back to the pool
 * @param {HTMLElement} label The label to release
 */
function releasePointLabel(label) {
  label.style.display = 'none';
  pointLabelPool.push(label);
}

/**
 * Release an axis label back to the pool
 * @param {HTMLElement} label The label to release
 */
function releaseAxisLabel(label) {
  label.style.display = 'none';
  axisLabelPool.push(label);
}

/**
 * Create or update a point frequency label
 * @param {string} id Unique ID for the label
 * @param {THREE.Vector3} worldPos World position for the label
 * @param {string} text Text content of the label
 * @param {THREE.Camera} camera Camera for positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for positioning
 * @returns {Object} Label object with ID and DOM element
 */
export function createOrUpdateLabel(id, worldPos, text, camera, renderer) {
  if (!pointLabelContainer) initLabelContainers();
  
  const screenPos = worldToScreen(worldPos, camera, renderer);
  
  let label;
  if (activePointLabels.has(id)) {
    label = activePointLabels.get(id);
  } else {
    label = getPointLabel();
    activePointLabels.set(id, label);
  }
  
  // Set ID for DOM queries
  label.id = 'point-' + id;
  
  // Store world position
  label.dataset.worldX = worldPos.x;
  label.dataset.worldY = worldPos.y;
  label.dataset.worldZ = worldPos.z || 0;
  
  // Update position and text
  label.style.left = `${screenPos.x}px`;
  label.style.top = `${screenPos.y}px`;
  label.textContent = text;
  
  return { id: 'point-' + id, domElement: label };
}

/**
 * Create a temporary axis crossing label
 * @param {string} id Unique ID for the label
 * @param {THREE.Vector3} worldPos World position for the label
 * @param {string} text Text content of the label
 * @param {THREE.Camera} camera Camera for positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for positioning
 * @param {number} lifespan Lifespan in seconds (default: 1 second)
 * @param {THREE.Color|string} color Color for the label background (optional)
 * @returns {Object} Label object with ID and DOM element
 */
export function createAxisLabel(id, worldPos, text, camera, renderer, lifespan = 1.0, color = null) {
  if (!axisLabelContainer) initLabelContainers();
  
  const label = getAxisLabel();
  activeAxisLabels.set(id, label);
  
  // Set ID for DOM queries
  label.id = 'axis-' + id;
  
  // Calculate screen position
  const screenPos = worldToScreen(worldPos, camera, renderer);
  
  // Store world position
  label.dataset.worldX = worldPos.x;
  label.dataset.worldY = worldPos.y;
  label.dataset.worldZ = worldPos.z || 0;
  
  // Store creation time and lifespan for time-based fadeout
  label.dataset.createdAt = Date.now();
  label.dataset.lifespan = lifespan * 1000; // Store in ms
  
  // Position and set text - center the label over the point
  // The transform in CSS is already set to translate(-50%, -100%) to position above the point
  label.style.left = `${screenPos.x}px`;
  label.style.top = `${screenPos.y - 10}px`; // Add a small offset to position above the point
  label.textContent = text;
  
  // Apply custom color if provided
  if (color) {
    // Handle both string colors and THREE.Color objects
    let colorString;
    if (typeof color === 'string') {
      colorString = color;
    } else if (color.isColor) {
      // Convert THREE.Color to rgba string with 0.7 opacity
      colorString = `rgba(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)}, 0.7)`;
    }
    
    if (colorString) {
      label.style.backgroundColor = colorString;
    }
  }
  
  return { id: 'axis-' + id, domElement: label };
}

/**
 * Remove a point label
 * @param {string} id Label ID
 */
export function removePointLabel(id) {
  const normalizedId = id.startsWith('point-') ? id : 'point-' + id;
  if (activePointLabels.has(normalizedId)) {
    const label = activePointLabels.get(normalizedId);
    releasePointLabel(label);
    activePointLabels.delete(normalizedId);
  }
}

/**
 * Remove an axis label
 * @param {string} id Label ID
 */
export function removeAxisLabel(id) {
  const normalizedId = id.startsWith('axis-') ? id : 'axis-' + id;
  if (activeAxisLabels.has(normalizedId)) {
    const label = activeAxisLabels.get(normalizedId);
    releaseAxisLabel(label);
    activeAxisLabels.delete(normalizedId);
  }
}

/**
 * Generic remove that checks both types
 * @param {string} id Label ID
 */
export function removeLabel(id) {
  removePointLabel(id);
  removeAxisLabel(id);
}

/**
 * Update the positions of labels based on markers
 * @param {Array} markers Array of markers to update labels for
 * @param {THREE.Camera} camera Camera to use for projection
 * @param {THREE.WebGLRenderer} renderer Renderer to get element dimensions
 */
export function updateLabelPositions(markers, camera, renderer) {
  if (!markers || !Array.isArray(markers) || !camera || !renderer) {
    return;
  }

  // Get necessary dimensions
  const rendererDomElement = renderer.domElement;
  const width = rendererDomElement.clientWidth;
  const height = rendererDomElement.clientHeight;
  
  // Project each marker position to screen space
  markers.forEach(marker => {
    const position = marker.position;
    
    if (!position) return;
    
    // Clone position to avoid modifying the original
    const pos = position.clone();
    
    // Project the 3D position to screen space
    pos.project(camera);
    
    // Convert normalized device coordinates to pixel coordinates
    const x = (pos.x * 0.5 + 0.5) * width;
    const y = (-pos.y * 0.5 + 0.5) * height;
    
    // Update or create label for this marker
    updateOrCreateLabel(marker, x, y);
  });
  
  // Hide any labels that no longer have corresponding markers
  hideOrphanedLabels(markers);
}

/**
 * Update rotating point frequency labels
 * @param {THREE.Group} group Rotation group
 * @param {THREE.Camera} camera Camera for positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for positioning
 */
export function updateRotatingLabels(group, camera, renderer) {
  if (!group || !camera || !renderer || !pointLabelContainer) return;
  
  // Get the group's world rotation
  const worldRotation = group.rotation.z;
  
  // FIXED: Get state from the correct layer instead of assuming group.parent.userData.state
  const layerId = group.userData.layerId;
  const layerManager = window.layerManager;
  
  if (!layerManager || layerId === undefined) {
    return;
  }
  
  const layer = layerManager.getLayer(layerId);
  const state = layer?.state;
  
  if (!state || !state.pointFreqLabels || !state.pointFreqLabels.length) {
    return;
  }
  
  // Update each point frequency label based on geometry rotation
  state.pointFreqLabels.forEach((labelInfo, index) => {
    const label = labelInfo.label;
    if (!label || !label.id) {
      return;
    }
    
    // FIXED: Use the original unrotated position and apply current rotation
    const originalPos = labelInfo.originalPosition || labelInfo.position;
    if (!originalPos) {
      return;
    }
    
    const copyRotation = labelInfo.copyRotation || 0;
    
    // Apply both the copy's original rotation and the current group rotation
    const totalRotation = copyRotation + worldRotation;
    const rotatedPos = originalPos.clone();
    rotatedPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), totalRotation);
    
    // Convert to screen position
    const screenPos = worldToScreen(rotatedPos, camera, renderer);
    
    // FIXED: Try multiple ways to find the DOM element
    let element = null;
    
    // Method 1: Try labelId first
    if (labelInfo.labelId) {
      element = document.getElementById(labelInfo.labelId);
    }
    
    // Method 2: Try the label.id
    if (!element && label.id) {
      element = document.getElementById(label.id);
    }
    
    // Method 3: Try point- prefix
    if (!element && label.id && !label.id.startsWith('point-')) {
      element = document.getElementById('point-' + label.id);
    }
    
    // Method 4: Search through active point labels
    if (!element) {
      for (const [id, activeLabel] of activePointLabels.entries()) {
        if (activeLabel === label || (label.id && id.includes(label.id))) {
          element = activeLabel;
          break;
        }
      }
    }
    
    if (element) {
      // Update the DOM element position with vertical offset to avoid overlapping the vertex
      const verticalOffset = 20; // Pixels below the vertex
      element.style.left = `${screenPos.x}px`;
      element.style.top = `${screenPos.y + verticalOffset}px`;
    }
  });
}

/**
 * Update temporary axis labels - fade and remove based on time
 */
export function updateAxisLabels() {
  if (!axisLabelContainer) return;
  
  if (activeAxisLabels.size === 0) return;
  
  // Current time for fade calculations
  const now = Date.now();
  
  activeAxisLabels.forEach((label, id) => {
    if (!label.dataset.createdAt || !label.dataset.lifespan) return;
    
    // Get creation time and lifespan
    const creationTime = parseInt(label.dataset.createdAt);
    const lifespan = parseInt(label.dataset.lifespan);
    
    // Calculate elapsed time in ms
    const elapsed = now - creationTime;
    
    // Calculate opacity based on time (linear fade)
    const opacity = Math.max(0, 1 - (elapsed / lifespan));
    
    // Update opacity
    label.style.opacity = opacity;
    
    // Remove if expired
    if (elapsed >= lifespan) {
      removeAxisLabel(id);
    }
  });
}

/**
 * Clear all labels
 */
export function clearLabels() {
  // Clear point labels
  activePointLabels.forEach((label, id) => {
    releasePointLabel(label);
  });
  activePointLabels.clear();
  
  // Clear axis labels
  activeAxisLabels.forEach((label, id) => {
    releaseAxisLabel(label);
  });
  activeAxisLabels.clear();
}

/**
 * Clear point frequency labels for a specific layer
 * @param {number} layerId Layer ID to clear labels for
 */
export function clearLayerPointLabels(layerId) {
  if (!layerId && layerId !== 0) return;
  
  const layerManager = window.layerManager;
  if (!layerManager) return;
  
  const layer = layerManager.getLayer(layerId);
  if (!layer || !layer.state || !layer.state.pointFreqLabels) return;
  
  // Clear DOM elements for this layer's point labels
  layer.state.pointFreqLabels.forEach(labelInfo => {
    if (labelInfo.labelId) {
      removePointLabel(labelInfo.labelId);
    }
    // Also clean up any DOM elements directly
    if (labelInfo.label && labelInfo.label.id) {
      const element = document.getElementById(labelInfo.label.id);
      if (element && element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
  });
  
  // Clear the layer's label array
  layer.state.pointFreqLabels = [];
}

/**
 * Update rotating labels for all layers
 * @param {THREE.Camera} camera Camera for positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for positioning
 */
export function updateAllLayersRotatingLabels(camera, renderer) {
  if (!camera || !renderer) return;
  
  const layerManager = window.layerManager;
  if (!layerManager || !layerManager.layers) return;
  
  // Update rotating labels for all layers that have showPointsFreqLabels enabled
  for (const layer of layerManager.layers) {
    if (layer && layer.state && layer.state.showPointsFreqLabels && layer.group) {
      // FIXED: Clear labels if copies is 0 (no geometry to label)
      if (layer.state.copies === 0) {
        clearLayerPointLabels(layer.id);
      } else {
        updateRotatingLabels(layer.group, camera, renderer);
      }
    }
  }
}

/**
 * Convert world position to screen position
 * @param {THREE.Vector3} worldPos World position
 * @param {THREE.Camera} camera Camera for projection
 * @param {THREE.WebGLRenderer} renderer Renderer for screen size
 * @returns {Object} Screen position {x, y}
 */
function worldToScreen(worldPos, camera, renderer) {
  // Input validation
  if (!worldPos || !camera || !renderer) {
    console.error("[LABELS] Missing required parameters for worldToScreen:", 
      { hasWorldPos: !!worldPos, hasCamera: !!camera, hasRenderer: !!renderer });
    // Return a fallback position in the center
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }

  // Clone position to avoid modifying the original
  const pos = worldPos.clone ? worldPos.clone() : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z || 0);
  
  try {  
    // Project world position to camera
    pos.project(camera);
    
    // Handle positions that end up way off screen (can cause positioning issues)
    // Clamp to reasonable bounds
    pos.x = Math.max(-1.5, Math.min(1.5, pos.x)); 
    pos.y = Math.max(-1.5, Math.min(1.5, pos.y));
    
    // Get canvas bounds and size
    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    
    // Convert normalized device coordinates (-1 to +1) to pixel coordinates
    // Taking into account the actual rendered size, not just the container size
    const widthHalf = rect.width / 2; // Use actual rendered width
    const heightHalf = rect.height / 2; // Use actual rendered height
    
    return {
      x: (pos.x * widthHalf) + widthHalf + rect.left,
      y: -(pos.y * heightHalf) + heightHalf + rect.top
    };
  } catch (error) {
    console.error("[LABELS] Error projecting position:", error);
    // Return a fallback position in the center
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
}

/**
 * Update an existing label or create a new one for a marker
 * @param {Object} marker Marker to update/create label for
 * @param {number} x X position in pixels
 * @param {number} y Y position in pixels
 */
function updateOrCreateLabel(marker, x, y) {
  // Generate a unique ID for this marker if it doesn't have one
  if (!marker.labelId) {
    marker.labelId = 'marker-' + (nextLabelId++);
  }
  
  // Check if label already exists
  let label = labelMap.get(marker.labelId);
  
  if (!label) {
    // Create new label element
    label = document.createElement('div');
    label.className = 'marker-label';
    label.style.position = 'absolute';
    label.style.pointerEvents = 'none';
    label.style.userSelect = 'none';
    label.style.fontSize = '12px';
    label.style.color = '#ffffff';
    label.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
    label.style.fontFamily = 'Arial, sans-serif';
    
    // Add to document
    document.body.appendChild(label);
    
    // Store in map
    labelMap.set(marker.labelId, label);
  }
  
  // Update position
  label.style.left = `${x}px`;
  label.style.top = `${y - 20}px`; // Offset above the marker
  
  // Update content based on marker data
  const frequency = marker.frequency ? 
    marker.frequency.toFixed(1) + ' Hz' : 
    '';
  
  label.textContent = frequency;
  
  // Show label
  label.style.display = 'block';
  
  // Update opacity based on marker state
  label.style.opacity = marker.animState === 2 ? '1.0' : '0.6';
}

/**
 * Hide any labels that no longer have corresponding markers
 * @param {Array} activeMarkers Array of currently active markers
 */
function hideOrphanedLabels(activeMarkers) {
  // Get set of active marker IDs
  const activeIds = new Set();
  activeMarkers.forEach(marker => {
    if (marker.labelId) {
      activeIds.add(marker.labelId);
    }
  });
  
  // Hide any labels not in the active set
  for (const [id, label] of labelMap.entries()) {
    if (!activeIds.has(id)) {
      label.style.display = 'none';
    }
  }
}

/**
 * Layer lifecycle hook: Called when a new layer is created
 * @param {number} layerId ID of the newly created layer
 * @param {Layer} layer The layer object
 */
export function onLayerCreated(layerId, layer) {
  // Initialize label tracking for this layer
  if (layer && layer.state) {
    layer.state.pointFreqLabels = layer.state.pointFreqLabels || [];
  }
  
  console.log(`[LABELS] Layer ${layerId} created - label system initialized`);
}

/**
 * Layer lifecycle hook: Called when switching between layers
 * @param {number} fromLayerId Previous active layer ID (null if none)
 * @param {number} toLayerId New active layer ID
 */
export function onLayerChanged(fromLayerId, toLayerId) {
  // No specific action needed for layer changes - labels are per-layer
  // and managed individually by their layer IDs
  console.log(`[LABELS] Layer changed from ${fromLayerId} to ${toLayerId}`);
}

/**
 * Clear all labels across all layers
 */
export function clearAllLayersLabels() {
  const layerManager = window.layerManager;
  if (!layerManager || !layerManager.layers) return;
  
  for (const layer of layerManager.layers) {
    if (layer && layer.id !== undefined) {
      try {
        clearLayerPointLabels(layer.id);
      } catch (error) {
        console.error(`[LABELS] Error clearing labels for layer ${layer.id}:`, error);
      }
    }
  }
  
  // Also clear any remaining global labels
  clearLabels();
}

/**
 * Initialize global event listeners for layer system integration
 * This should be called once when the label system starts up
 */
export function initializeLayerEventListeners() {
  if (layerEventListenersInitialized) return;
  
  // Listen for layer removal events
  window.addEventListener('layerRemoved', (event) => {
    const { removedLayerId, idRemapping } = event.detail;
    
    console.log(`[LABELS] Layer ${removedLayerId} removed - cleaning up labels`);
    
    // Clear labels for the removed layer
    try {
      clearLayerPointLabels(removedLayerId);
    } catch (error) {
      console.error(`[LABELS] Error clearing labels for removed layer ${removedLayerId}:`, error);
    }
    
    // Update any remaining label references if IDs were remapped
    if (idRemapping && Object.keys(idRemapping).length > 0) {
      updateLabelReferencesAfterRemapping(idRemapping);
    }
  });
  
  // Listen for layer change events
  window.addEventListener('layerChanged', (event) => {
    const { layerId, state } = event.detail;
    onLayerChanged(null, layerId); // We don't track fromLayerId in this event
  });
  
  layerEventListenersInitialized = true;
  console.log('[LABELS] Layer event listeners initialized');
}

/**
 * Update label references after layer ID remapping
 * @param {Object} idRemapping Map of old IDs to new IDs
 */
function updateLabelReferencesAfterRemapping(idRemapping) {
  // For now, we use layer-specific label IDs so remapping is handled automatically
  // Future enhancement: could update DOM element IDs if needed
  console.log('[LABELS] Label references updated after layer ID remapping', idRemapping);
}

// Auto-initialize when this module is loaded
if (typeof window !== 'undefined') {
  // Use setTimeout to ensure this runs after the module is fully loaded
  setTimeout(() => {
    initializeLayerEventListeners();
  }, 100);
}