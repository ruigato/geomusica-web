// src/ui/domLabels.js
import * as THREE from 'three';

// Separate containers for each label type
let pointLabelContainer = null;
let axisLabelContainer = null;

// Separate pools and tracking for different label types
const pointLabelPool = [];
const axisLabelPool = [];
const activePointLabels = new Map();
const activeAxisLabels = new Map();

// Initialize the labels system with separate containers
export function initLabels() {
  // Create the point label container
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
  
  // Create the axis label container (on top)
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

// Get a point label from the pool or create a new one
function getPointLabel() {
  if (pointLabelPool.length > 0) {
    const label = pointLabelPool.pop();
    label.style.display = 'block';
    return label;
  }
  
  // Create a new point label with specific styling
  const label = document.createElement('div');
  label.className = 'point-frequency-label';
  label.style.position = 'absolute';
  label.style.fontFamily = '"Perfect DOS VGA 437", monospace';
  label.style.fontSize = '14px';
  label.style.color = '#ffffff';
  label.style.textAlign = 'center';
  label.style.backgroundColor = 'transparent'; // Transparent background
  label.style.padding = '2px 4px';
  label.style.pointerEvents = 'none';
  label.style.transform = 'translate(-50%, -50%)';
  pointLabelContainer.appendChild(label); // Use the point label container
  
  return label;
}

// Get an axis label from the pool or create a new one
function getAxisLabel() {
  if (axisLabelPool.length > 0) {
    const label = axisLabelPool.pop();
    label.style.display = 'block';
    return label;
  }
  
  // Create a new axis label with specific styling
  const label = document.createElement('div');
  label.className = 'axis-frequency-label'; 
  label.style.position = 'absolute';
  label.style.fontFamily = '"Perfect DOS VGA 437", monospace';
  label.style.fontSize = '14px';
  label.style.color = '#ffffff';
  label.style.textAlign = 'center';
  label.style.backgroundColor = 'rgba(255, 0, 255, 0.7)'; // Purple background
  label.style.padding = '2px 4px';
  label.style.borderRadius = '2px';
  label.style.pointerEvents = 'none';
  label.style.transform = 'translate(-50%, -100%)'; // Position above point
  axisLabelContainer.appendChild(label); // Use the axis label container
  
  return label;
}

// Release a point label back to the pool
function releasePointLabel(label) {
  label.style.display = 'none';
  pointLabelPool.push(label);
}

// Release an axis label back to the pool
function releaseAxisLabel(label) {
  label.style.display = 'none';
  axisLabelPool.push(label);
}

// Create or update a point frequency label (persistent, rotates with geometry)
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
  
  // Set a data attribute for the ID to find by DOM query later
  label.id = 'point-' + id;
  
  // Store the original world position for rotation calculations
  label.dataset.worldX = worldPos.x;
  label.dataset.worldY = worldPos.y;
  label.dataset.worldZ = worldPos.z || 0;
  
  // Update label position and text
  label.style.left = `${screenPos.x}px`;
  label.style.top = `${screenPos.y}px`;
  label.textContent = text;
  
  return { id: 'point-' + id, domElement: label };
}

// Create temporary label for axis crossings (doesn't rotate)
export function createAxisLabel(id, worldPos, text, camera, renderer, lifespan = 30) {
  if (!axisLabelContainer) initLabels();
  
  const label = getAxisLabel();
  activeAxisLabels.set(id, label);
  
  // Set label ID for DOM queries
  label.id = 'axis-' + id;
  
  // Calculate screen position
  const screenPos = worldToScreen(worldPos, camera, renderer);
  
  // Store world position
  label.dataset.worldX = worldPos.x;
  label.dataset.worldY = worldPos.y;
  label.dataset.worldZ = worldPos.z || 0;
  
  // Set life tracking for this temporary label
  label.dataset.life = lifespan;
  
  // Position the label
  label.style.left = `${screenPos.x}px`;
  label.style.top = `${screenPos.y - 25}px`; // Offset above the point
  label.textContent = text;
  
  return { id: 'axis-' + id, domElement: label };
}

// Remove a point label
export function removePointLabel(id) {
  const normalizedId = id.startsWith('point-') ? id : 'point-' + id;
  if (activePointLabels.has(normalizedId)) {
    const label = activePointLabels.get(normalizedId);
    releasePointLabel(label);
    activePointLabels.delete(normalizedId);
  }
}

// Remove an axis label
export function removeAxisLabel(id) {
  const normalizedId = id.startsWith('axis-') ? id : 'axis-' + id;
  if (activeAxisLabels.has(normalizedId)) {
    const label = activeAxisLabels.get(normalizedId);
    releaseAxisLabel(label);
    activeAxisLabels.delete(normalizedId);
  }
}

// Generic remove that checks both types
export function removeLabel(id) {
  // Try both types of labels
  removePointLabel(id);
  removeAxisLabel(id);
}

// Update non-rotating label positions (for window resize, etc.)
export function updateLabelPositions(camera, renderer) {
  if (!camera || !renderer) return;
  
  // We don't need to do anything here since the other update
  // functions handle everything specific to their label types
}

// Update rotating point frequency labels
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
    
    // Update the DOM element position - make sure we're using the correct ID format
    const elementId = label.id.startsWith('point-') ? label.id : 'point-' + label.id;
    const element = document.getElementById(elementId);
    if (element) {
      element.style.left = `${screenPos.x}px`;
      element.style.top = `${screenPos.y}px`;
    }
  });
}

// Update temporary axis labels - fade and remove
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

// Clear all labels
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

// Convert world position to screen position
function worldToScreen(worldPos, camera, renderer) {
  // Clone position to avoid modifying the original
  const pos = worldPos.clone ? worldPos.clone() : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z || 0);
  
  // Convert world position to screen position
  pos.project(camera);
  
  // Get the canvas bounds to properly position labels relative to the canvas
  const canvas = renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  
  // Convert from normalized device coordinates to CSS pixels
  // Use the canvas bounds to properly align with the canvas position
  const widthHalf = canvas.width / 2;
  const heightHalf = canvas.height / 2;
  
  return {
    x: (pos.x * widthHalf) + widthHalf + rect.left,
    y: -(pos.y * heightHalf) + heightHalf + rect.top
  };
}