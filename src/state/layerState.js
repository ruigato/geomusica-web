import { DEFAULT_VALUES } from '../config/constants.js';

/**
 * Creates a new layer state with default values
 * @param {string} id - Unique identifier for the layer
 * @param {Object} overrides - Optional overrides for default values
 * @returns {Object} New layer state
 */
export function createLayerState(id, overrides = {}) {
  // Create the base state object
  const layerState = {
    id,
    name: `Layer ${id.split('-').pop()}`,
    visible: true,
    zIndex: 0,
    
    // Geometry parameters
    radius: DEFAULT_VALUES.RADIUS,
    segments: DEFAULT_VALUES.SEGMENTS,
    stepScale: DEFAULT_VALUES.STEP_SCALE,
    angle: DEFAULT_VALUES.ANGLE,
    copies: DEFAULT_VALUES.COPIES,
    modulus: 1,  // Default modulus value
    
    // Visual properties
    color: 0xffffff,
    opacity: 0.8,
    wireframe: true,
    
    // Advanced parameters
    useFractal: DEFAULT_VALUES.USE_FRACTAL,
    fractalValue: DEFAULT_VALUES.FRACTAL_VALUE,
    useStars: DEFAULT_VALUES.USE_STARS,
    starSkip: DEFAULT_VALUES.STAR_SKIP,
    useEuclid: DEFAULT_VALUES.USE_EUCLID,
    euclidValue: DEFAULT_VALUES.EUCLID_VALUE,
    
    // Apply any overrides (this will override any of the above defaults)
    ...overrides
  };
  
  // Add the method to the state object, properly bound to the state
  layerState.getScaleFactorForCopy = function(copyIndex) {
    console.log('getScaleFactorForCopy called with:', { 
      copyIndex, 
      modulus: this.modulus,
      hasMethod: typeof this.getScaleFactorForCopy === 'function',
      props: Object.keys(this)
    });
    
    if (!this.modulus || this.modulus <= 1) return 1.0;
    
    try {
      // Calculate the step size between scale factors
      const step = (1.0 - (1.0 / this.modulus)) / (this.modulus - 1);
      
      // Calculate the scale factor for this copy, cycling through the sequence
      const sequenceIndex = copyIndex % this.modulus;
      return (1.0 / this.modulus) + (sequenceIndex * step);
    } catch (error) {
      console.error('Error in getScaleFactorForCopy:', error);
      return 1.0;
    }
  }.bind(layerState);
  
  return layerState;
}

/**
 * Creates the initial layers state with one default layer
 * @returns {Object} Initial layers state
 */
export function createInitialLayersState() {
  const defaultLayer = createLayerState('layer-1', { name: 'Layer 1' });
  
  return {
    activeLayerId: defaultLayer.id,
    list: [defaultLayer.id],
    byId: {
      [defaultLayer.id]: defaultLayer
    }
  };
}
