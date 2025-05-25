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
  
  // First, check for an existing label with the same ID and remove it to prevent duplicates
  if (activeAxisLabels.has(id)) {
    removeAxisLabel(id);
  }
  
  // Get a new label from the pool
  const label = getAxisLabel();
  
  // Set ID for DOM queries
  label.id = 'axis-' + id;
  
  // Calculate screen position
  const screenPos = worldToScreen(worldPos, camera, renderer);
  
  // Store world position
  label.dataset.worldX = worldPos.x;
  label.dataset.worldY = worldPos.y;
  label.dataset.worldZ = worldPos.z || 0;
  
  // Ensure a reasonable lifespan (at least 0.5s, at most 5s)
  const normalizedLifespan = Math.min(5.0, Math.max(0.5, lifespan)) * 1000; // Convert to ms
  
  // Store creation time and lifespan for time-based fadeout
  label.dataset.createdAt = Date.now();
  label.dataset.lifespan = normalizedLifespan;
  
  // Position and set text - center the label over the point
  label.style.left = `${screenPos.x}px`;
  label.style.top = `${screenPos.y - 10}px`; // Add a small offset to position above the point
  label.textContent = text;
  
  // Start with full opacity
  label.style.opacity = "1.0";
  
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
  
  // Store in the active labels map
  activeAxisLabels.set(id, label);
  
  // Return a reference to the label
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
 * Update temporary axis labels - fade and remove based on time
 */
export function updateAxisLabels() {
  if (!axisLabelContainer) return;
  
  if (activeAxisLabels.size === 0) return;
  
  // Check if axis labels are globally disabled in the state
  const globalState = window._globalState;
  const showAxisLabels = globalState?.showAxisFreqLabels !== false;
  
  // If axis labels are disabled, forcefully clear all existing labels
  if (!showAxisLabels) {
    // Clear all axis labels immediately
    clearAxisLabels();
    return;
  }
  
  // Current time for fade calculations
  const now = Date.now();
  
  // Force a maximum lifespan to prevent labels from staying forever
  const MAX_LABEL_LIFETIME = 5000; // 5 seconds absolute maximum
  
  // Track labels to remove after iteration
  const labelsToRemove = [];
  
  activeAxisLabels.forEach((label, id) => {
    // If missing creation time or lifespan data, force removal
    if (!label.dataset.createdAt || !label.dataset.lifespan) {
      labelsToRemove.push(id);
      return;
    }
    
    // Get creation time and lifespan
    const creationTime = parseInt(label.dataset.createdAt);
    const lifespan = Math.min(parseInt(label.dataset.lifespan), MAX_LABEL_LIFETIME);
    
    // Calculate elapsed time in ms
    const elapsed = now - creationTime;
    
    // If label has existed longer than MAX_LABEL_LIFETIME, remove it regardless of lifespan
    if (elapsed > MAX_LABEL_LIFETIME) {
      labelsToRemove.push(id);
      return;
    }
    
    // Calculate opacity based on time (linear fade)
    const opacity = Math.max(0, 1 - (elapsed / lifespan));
    
    // Update opacity
    label.style.opacity = opacity;
    
    // Remove if expired
    if (elapsed >= lifespan || opacity <= 0.05) {
      labelsToRemove.push(id);
    }
  });
  
  // Remove all labels marked for removal
  labelsToRemove.forEach(id => {
    removeAxisLabel(id);
  });
  
  // If too many labels are active, remove the oldest ones
  const MAX_ACTIVE_LABELS = 20;
  if (activeAxisLabels.size > MAX_ACTIVE_LABELS) {
    // Convert to array, sort by creation time, and keep only the newest MAX_ACTIVE_LABELS
    const sortedLabels = Array.from(activeAxisLabels.entries())
      .sort((a, b) => {
        const timeA = parseInt(a[1].dataset.createdAt) || 0;
        const timeB = parseInt(b[1].dataset.createdAt) || 0;
        return timeB - timeA; // Newest first
      });
    
    // Remove oldest labels
    sortedLabels.slice(MAX_ACTIVE_LABELS).forEach(([id]) => {
      removeAxisLabel(id);
    });
  }
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
 * Clear all axis labels only
 */
export function clearAxisLabels() {
  if (!axisLabelContainer) return;
  
  // Clear axis labels
  activeAxisLabels.forEach((label, id) => {
    releaseAxisLabel(label);
  });
  activeAxisLabels.clear();
}

// Export to window for global access
if (typeof window !== 'undefined') {
  window.clearAxisLabels = clearAxisLabels;
}