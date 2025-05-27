import * as THREE from 'three';

/**
 * Generate a color palette using offset sine waves for RGB components
 * @param {number} numLayers - Number of layers (and color samples)
 * @param {number} offset - Offset between RGB components in cycles (default: 0.125)
 * @param {number} brightness - Overall brightness multiplier (default: 1.0)
 * @param {number} saturation - Color saturation (default: 1.0)
 * @returns {Array<THREE.Color>} Array of colors for each layer
 */
export function generateSineWaveColorPalette(numLayers, offset = 0.125, brightness = 1.0, saturation = 1.0) {
  const colors = [];
  const offsetRadians = offset * 2 * Math.PI;
  
  // Handle edge case of no layers
  if (numLayers <= 0) {
    console.warn('generateSineWaveColorPalette: numLayers must be greater than 0');
    return colors;
  }
  
  for (let i = 0; i < numLayers; i++) {
    const angle = (i / numLayers) * 2 * Math.PI;
    
    // Calculate RGB using offset sine waves
    let r = (Math.sin(angle) + 1) / 2;
    let g = (Math.sin(angle + offsetRadians) + 1) / 2;
    let b = (Math.sin(angle + 2 * offsetRadians) + 1) / 2;
    
    // Apply saturation
    if (saturation < 1.0) {
      const avg = (r + g + b) / 3;
      r = avg + (r - avg) * saturation;
      g = avg + (g - avg) * saturation;
      b = avg + (b - avg) * saturation;
    }
    
    // Apply brightness and clamp
    r = Math.max(0, Math.min(1, r * brightness));
    g = Math.max(0, Math.min(1, g * brightness));
    b = Math.max(0, Math.min(1, b * brightness));
    
    colors.push(new THREE.Color(r, g, b));
  }
  
  return colors;
}

/**
 * Generate a rainbow color palette using HSL color space
 * @param {number} numLayers - Number of layers (and color samples)
 * @param {number} saturation - Color saturation (0-1, default: 1.0)
 * @param {number} lightness - Color lightness (0-1, default: 0.5)
 * @returns {Array<THREE.Color>} Array of colors for each layer
 */
export function generateRainbowColorPalette(numLayers, saturation = 1.0, lightness = 0.5) {
  const colors = [];
  
  // Handle edge case of no layers
  if (numLayers <= 0) {
    console.warn('generateRainbowColorPalette: numLayers must be greater than 0');
    return colors;
  }
  
  for (let i = 0; i < numLayers; i++) {
    const hue = (i / numLayers) * 360; // Distribute hues evenly across the spectrum
    const color = new THREE.Color();
    color.setHSL(hue / 360, saturation, lightness);
    colors.push(color);
  }
  
  return colors;
}

/**
 * Generate a color palette using a custom mathematical function
 * @param {number} numLayers - Number of layers
 * @param {Function} colorFunction - Function that takes (index, total) and returns {r, g, b} values (0-1)
 * @returns {Array<THREE.Color>} Array of colors for each layer
 */
export function generateCustomColorPalette(numLayers, colorFunction) {
  const colors = [];
  
  // Handle edge case of no layers
  if (numLayers <= 0) {
    console.warn('generateCustomColorPalette: numLayers must be greater than 0');
    return colors;
  }
  
  if (typeof colorFunction !== 'function') {
    console.error('generateCustomColorPalette: colorFunction must be a function');
    return colors;
  }
  
  for (let i = 0; i < numLayers; i++) {
    try {
      const rgb = colorFunction(i, numLayers);
      if (rgb && typeof rgb.r === 'number' && typeof rgb.g === 'number' && typeof rgb.b === 'number') {
        // Clamp values to valid range
        const r = Math.max(0, Math.min(1, rgb.r));
        const g = Math.max(0, Math.min(1, rgb.g));
        const b = Math.max(0, Math.min(1, rgb.b));
        colors.push(new THREE.Color(r, g, b));
      } else {
        console.warn(`generateCustomColorPalette: Invalid color returned for layer ${i}, using fallback`);
        colors.push(new THREE.Color(1, 0, 0)); // Red fallback
      }
    } catch (error) {
      console.error(`generateCustomColorPalette: Error generating color for layer ${i}:`, error);
      colors.push(new THREE.Color(1, 0, 0)); // Red fallback
    }
  }
  
  return colors;
} 