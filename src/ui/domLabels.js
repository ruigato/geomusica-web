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
  
  console.log("[LABELS] Label system initialized");
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
  label.style.transform = 'translate(-50%, -100%)'; // Position above point
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
 * @param {Object} options Additional options for the label
 * @returns {Object} Label object with ID and DOM element
 */
export function createOrUpdateLabel(id, worldPos, text, camera, renderer, options = {}) {
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
  
  // Update position
  label.style.left = `${screenPos.x}px`;
  label.style.top = `${screenPos.y}px`;
  
  // Apply custom class name if provided
  if (options.className) {
    label.className = options.className;
  } else {
    label.className = 'point-frequency-label';
  }
  
  // Store reference to tracked object if provided
  if (options.trackedObject) {
    label.dataset.trackedObjectId = options.trackedObject.id;
  }
  
  // Set visibility
  if (options.alwaysVisible) {
    label.dataset.alwaysVisible = 'true';
  } else {
    delete label.dataset.alwaysVisible;
  }
  
  // Update content - support both text and HTML content
  if (options.isHTML) {
    label.innerHTML = text;
  } else {
    label.textContent = text;
  }
  
  return { id: 'point-' + id, domElement: label };
}

/**
 * Create a temporary axis crossing label
 * @param {string} id Unique ID for the label
 * @param {THREE.Vector3} worldPos World position for the label
 * @param {string} text Text content of the label
 * @param {THREE.Camera} camera Camera for positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for positioning
 * @param {number} lifespan Lifespan in frames
 * @returns {Object} Label object with ID and DOM element
 */
export function createAxisLabel(id, worldPos, text, camera, renderer, lifespan = 30) {
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
  
  // Set life tracking
  label.dataset.life = lifespan;
  
  // Position and set text
  label.style.left = `${screenPos.x}px`;
  label.style.top = `${screenPos.y - 25}px`;
  label.textContent = text;
  
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
  
  // Check if we have pointFreqLabels in the state
  const state = group.parent?.userData?.state;
  if (!state || !state.pointFreqLabels || !state.pointFreqLabels.length) return;
  
  // Update each point frequency label based on geometry rotation
  state.pointFreqLabels.forEach(labelInfo => {
    const label = labelInfo.label;
    if (!label || !label.id) return;
    
    // Get the original position
    const originalPos = labelInfo.position.clone();
    
    // Apply the current group rotation
    const rotatedPos = originalPos.clone();
    rotatedPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), worldRotation);
    
    // Convert to screen position
    const screenPos = worldToScreen(rotatedPos, camera, renderer);
    
    // Update the DOM element position
    const elementId = label.id.startsWith('point-') ? label.id : 'point-' + label.id;
    const element = document.getElementById(elementId);
    if (element) {
      element.style.left = `${screenPos.x}px`;
      element.style.top = `${screenPos.y}px`;
    }
  });
}

/**
 * Update temporary axis labels - fade and remove
 */
export function updateAxisLabels() {
  if (!axisLabelContainer) return;
  
  activeAxisLabels.forEach((label, id) => {
    if (!label.dataset.life) return;
    
    let life = parseInt(label.dataset.life) - 1;
    label.dataset.life = life;
    
    // Update opacity
    label.style.opacity = life / 30;
    
    // Remove if expired
    if (life <= 0) {
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
 * Convert world position to screen position
 * @param {THREE.Vector3} worldPos World position
 * @param {THREE.Camera} camera Camera for projection
 * @param {THREE.WebGLRenderer} renderer Renderer for screen size
 * @returns {Object} Screen position {x, y}
 */
function worldToScreen(worldPos, camera, renderer) {
  // Clone position to avoid modifying the original
  const pos = worldPos.clone ? worldPos.clone() : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z || 0);
  
  // Project world position to camera
  pos.project(camera);
  
  // Get canvas bounds
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  
  // Convert from NDC to CSS pixels
  const widthHalf = canvas.width / 2;
  const heightHalf = canvas.height / 2;
  
  return {
    x: (pos.x * widthHalf) + widthHalf + rect.left,
    y: -(pos.y * heightHalf) + heightHalf + rect.top
  };
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