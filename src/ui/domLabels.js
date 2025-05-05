// src/ui/domLabels.js - Simple version with targeted optimizations
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

// Reusable Vector3 object for calculations
const _tempVector = new THREE.Vector3();
const _rotationAxis = new THREE.Vector3(0, 0, 1);

/**
 * Initialize the label system with separate containers
 */
export function initLabels() {
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
  
  // Create a new point label with optimized styling
  const label = document.createElement('div');
  label.className = 'point-frequency-label';
  label.style.position = 'absolute';
  label.style.fontFamily = '"Roboto Mono", monospace'; // Simplified font stack
  label.style.fontSize = '14px';
  label.style.color = '#fff';
  label.style.transform = 'translate3d(-50%, -50%, 0)'; // Use translate3d for GPU acceleration
  label.style.pointerEvents = 'none';
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
  
  // Create a new axis label with optimized styling
  const label = document.createElement('div');
  label.className = 'axis-frequency-label'; 
  label.style.position = 'absolute';
  label.style.fontFamily = '"Roboto Mono", monospace'; // Simplified font stack
  label.style.fontSize = '14px';
  label.style.color = '#fff';
  label.style.backgroundColor = 'rgba(255,0,255,0.7)';
  label.style.transform = 'translate3d(-50%, -100%, 0)'; // Use translate3d for GPU acceleration
  label.style.pointerEvents = 'none';
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
  if (!pointLabelContainer) initLabels();
  
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
 * @param {number} lifespan Lifespan in frames
 * @returns {Object} Label object with ID and DOM element
 */
export function createAxisLabel(id, worldPos, text, camera, renderer, lifespan = 30) {
  if (!axisLabelContainer) initLabels();
  
  const label = getAxisLabel();
  activeAxisLabels.set(id, label);
  
  // Set ID for DOM queries
  label.id = 'axis-' + id;
  
  // Calculate screen position
  const screenPos = worldToScreen(worldPos, camera, renderer);
  
  // Store world position
  label.dataset.worldX = worldPos.x;
  label.dataset.worldY = worldPos.y;
  label.dataset.worldZ = worldPos.z || 10;
  
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
 * Update non-rotating label positions
 * @param {THREE.Camera} camera Camera for positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for positioning
 */
export function updateLabelPositions(camera, renderer) {
  // This function is a stub - specific updates are handled elsewhere
}

/**
 * Update rotating point frequency labels - simplified but optimized
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
  for (let i = 0; i < state.pointFreqLabels.length; i++) {
    const labelInfo = state.pointFreqLabels[i];
    const label = labelInfo.label;
    
    if (!label || !label.id) continue;
    
    // Optimization: Reuse Vector3 object instead of cloning
    _tempVector.copy(labelInfo.position);
    
    // Apply the current group rotation
    _tempVector.applyAxisAngle(_rotationAxis, worldRotation);
    
    // Convert to screen position
    const screenPos = worldToScreen(_tempVector, camera, renderer);
    
    // Update the DOM element position - direct approach for rotation correctness
    const elementId = label.id.startsWith('point-') ? label.id : 'point-' + label.id;
    const element = document.getElementById(elementId);
    
    if (element) {
      element.style.left = `${screenPos.x}px`;
      element.style.top = `${screenPos.y}px`;
    }
  }
}

/**
 * Update temporary axis labels - simplified version
 */
export function updateAxisLabels() {
  if (!axisLabelContainer) return;
  
  const removeIds = [];
  
  activeAxisLabels.forEach((label, id) => {
    if (!label.dataset.life) return;
    
    let life = parseInt(label.dataset.life) - 1;
    label.dataset.life = life;
    
    // Update opacity
    label.style.opacity = life / 30;
    
    // Mark for removal if expired
    if (life <= 0) {
      removeIds.push(id);
    }
  });
  
  // Remove expired labels
  removeIds.forEach(id => {
    removeAxisLabel(id);
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
 * Convert world position to screen position - optimized
 * @param {THREE.Vector3} worldPos World position
 * @param {THREE.Camera} camera Camera for projection
 * @param {THREE.WebGLRenderer} renderer Renderer for screen size
 * @returns {Object} Screen position {x, y}
 */
function worldToScreen(worldPos, camera, renderer) {
  // Create a position vector if needed
  const pos = worldPos.isVector3 ? worldPos : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z || 0);
  
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