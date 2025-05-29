// src/osc/legacyOscCompatibility.js - Legacy OSC compatibility layer for GM_layer.maxpat
// Translates legacy Max4Live parameters to current GeoMusica format

/**
 * Legacy parameter mapping from GM_layer.maxpat to current GeoMusica parameters
 * Format: 'legacyName': { current, range, currentRange, type }
 */
const LEGACY_PARAMETER_MAPPING = {
  // Duration Parameters (X prefix in legacy)
  'Xdurphase': { 
    current: 'DurationPhase', 
    range: { min: 0, max: 1.0 },
    currentRange: { min: 0, max: 1 },
    type: 'number'
  },
  'Xdurmode': { 
    current: 'DurationMode', 
    range: { min: 0, max: 3 },
    currentRange: ['modulo', 'random', 'interpolation'],
    type: 'mode'
  },
  'Xdurmin': { 
    current: 'MinDuration', 
    range: { min: 0, max: 1.0 },
    currentRange: { min: 0.01, max: 1.0 },
    type: 'number'
  },
  'Xdurmax': { 
    current: 'MaxDuration', 
    range: { min: 0, max: 5.0 },
    currentRange: { min: 0.01, max: 2.0 },
    type: 'number'
  },
  'Xdurcycles': { 
    current: 'DurationModulo', 
    range: { min: 0, max: 12.0 },
    currentRange: { min: 1, max: 12 },
    type: 'number'
  },

  // Velocity Parameters
  'Velphase': { 
    current: 'VelocityPhase', 
    range: { min: 0, max: 1.0 },
    currentRange: { min: 0, max: 1 },
    type: 'number'
  },
  'Velmode': { 
    current: 'VelocityMode', 
    range: { min: 0, max: 3 },
    currentRange: ['modulo', 'random', 'interpolation'],
    type: 'mode'
  },
  'Velmin': { 
    current: 'MinVelocity', 
    range: { min: 0, max: 1.0 },
    currentRange: { min: 0.1, max: 0.9 },
    type: 'number'
  },
  'Velmax': { 
    current: 'MaxVelocity', 
    range: { min: 0, max: 1.0 },
    currentRange: { min: 0.2, max: 1.0 },
    type: 'number'
  },
  'Velcycles': { 
    current: 'VelocityModulo', 
    range: { min: 0, max: 12.0 },
    currentRange: { min: 1, max: 12 },
    type: 'number'
  },

  // Shape Parameters
  'Number': { 
    current: 'Segments', 
    range: { min: 0, max: 10 },
    currentRange: { min: 2, max: 12 },
    type: 'number'
  },
  'Copies': { 
    current: 'Copies', 
    range: { min: 0, max: 32.0 },
    currentRange: { min: 0, max: 32 },
    type: 'number'
  },
  'Angle': { 
    current: 'Angle', 
    range: { min: -180.0, max: 180.0 },
    currentRange: { min: -180.0, max: 180.0 },
    type: 'number'
  },
  'Gscale': { 
    current: 'Radius', 
    range: { min: 0, max: 5000.0 },
    currentRange: { min: 0, max: 5000 },
    type: 'number'
  },
  'Stepscale': { 
    current: 'StepScale', 
    range: { min: 0, max: 3.0 },
    currentRange: { min: 0, max: 3.0 },
    type: 'number'
  },
  'Offset': { 
    current: 'StartingAngle', 
    range: { min: 0, max: 1.0 },
    currentRange: { min: 0, max: 360 },
    type: 'number'
  },

  // Timing Parameters
  'Speed': { 
    current: 'TimeSubdivisionValue', 
    range: { min: 0, max: 7 },
    currentRange: { min: 1, max: 7 },
    type: 'number',
    discrete: [0.125, 0.25, 0.5, 1, 2, 3, 4, 5]
  },
  // 'Freespeed': { 
  //   current: 'LerpTime', // DISABLED - Map to closest equivalent
  //   range: { min: 0, max: 2.0 },
  //   currentRange: { min: 0.1, max: 5.0 },
  //   type: 'number'
  // },
  // 'Masterspeed': { 
  //   current: 'TimeSubdivisionValue', // DISABLED - Map to time subdivision
  //   range: { min: 0, max: 4.0 },
  //   currentRange: { min: 0.125, max: 8 },
  //   type: 'number'
  // },
  // 'Sync': { 
  //   current: 'UseTimeSubdivision', // DISABLED - Map to time subdivision enable
  //   range: { min: 0, max: 1.0 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },

  // Modulation Parameters
  'Modulus': { 
    current: 'ModulusValue', 
    range: { min: 0, max: 11 },
    currentRange: { min: 1, max: 12 },
    type: 'number'
  },
  'Modmult': { 
    current: 'UseModulus', 
    range: { min: 0, max: 12.0 },
    currentRange: { min: false, max: true },
    type: 'boolean'
  },
  'Modreorderphase': { 
    current: 'DurationPhase', // Map to duration phase as closest equivalent
    range: { min: 0, max: 1.0 },
    currentRange: { min: 0, max: 1 },
    type: 'number'
  },
  'Modreordercycles': { 
    current: 'ModulusValue', // Map to modulus value
    range: { min: 0, max: 1.0 },
    currentRange: { min: 2, max: 16 },
    type: 'number'
  },
  'Modreorderseed': { 
    current: 'DeleteSeed', // Map to delete seed as closest equivalent
    range: { min: 0, max: 1.0 },
    currentRange: { min: 0, max: 999 },
    type: 'number'
  },
  'Modreordermode': { 
    current: 'DurationMode', // Map to duration mode
    range: { min: 0, max: 4 },
    currentRange: ['modulo', 'random', 'interpolation'],
    type: 'mode'
  },
  'Altstep': { 
    current: 'AltScale', // Altstep in legacy = AltScale in modern (direct 1:1 mapping)
    range: { min: 0, max: 10.0 },
    currentRange: { min: 0, max: 10.0 },
    type: 'number'
  },

  // Shape Modification Parameters
  'Tesselate': { 
    current: 'UseTesselation', 
    range: { min: 0, max: 1 },
    currentRange: { min: false, max: true },
    type: 'boolean'
  },
  // 'Tesselatejoin': { 
  //   current: 'UseTesselation', // DISABLED - Map to main tesselation toggle
  //   range: { min: 0, max: 1 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },
  // 'Tesselaterotate': { 
  //   current: 'UseTesselation', // DISABLED - Map to main tesselation toggle
  //   range: { min: 0, max: 1 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },
  // 'Tesselatesort': { 
  //   current: 'UseTesselation', // DISABLED - Map to main tesselation toggle
  //   range: { min: 0, max: 1 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },
  'Star': { 
    current: 'UseStars', 
    range: { min: 0, max: 1 },
    currentRange: { min: false, max: true },
    type: 'boolean'
  },
  'Startype': { 
    current: 'StarSkip', 
    range: { min: 0, max: 2.0 },
    currentRange: { min: 1, max: 5 },
    type: 'number'
  },
  'Starcuts': { 
    current: 'UseCuts', 
    range: { min: 0, max: 1 },
    currentRange: { min: false, max: true },
    type: 'boolean'
  },
  // 'Particles': { 
  //   current: 'ShowPointsFreqLabels', // DISABLED
  //   range: { min: 0, max: 1 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },
  'Intersections': { 
    current: 'UsePlainIntersections', 
    range: { min: 0, max: 1 },
    currentRange: { min: false, max: true },
    type: 'boolean'
  },

  // Delete Parameters
  'Delete': { 
    current: 'UseDelete', 
    range: { min: 0, max: 1 },
    currentRange: { min: false, max: true },
    type: 'boolean'
  },
  'Deletemin': { 
    current: 'DeleteMin', 
    range: { min: 0, max: 16.0 },
    currentRange: { min: 1, max: 32 },
    type: 'number'
  },
  'Deletemax': { 
    current: 'DeleteMax', 
    range: { min: 0, max: 16.0 },
    currentRange: { min: 1, max: 32 },
    type: 'number'
  },
  'Deleteseed': { 
    current: 'DeleteSeed', 
    range: { min: 0, max: 999.0 },
    currentRange: { min: 0, max: 999 },
    type: 'number'
  },
  'Deletepp': { 
    current: 'DeleteTarget', 
    range: { min: 0, max: 1 },
    currentRange: ['points', 'primitives'],
    type: 'mode'
  },
  'Deleterandom': { 
    current: 'DeleteMode', 
    range: { min: 0, max: 1 },
    currentRange: ['pattern', 'random'],
    type: 'mode'
  },

  // Fractal and Euclidean Parameters
  'Fractal': { 
    current: 'UseFractal', 
    range: { min: 0, max: 1 },
    currentRange: { min: false, max: true },
    type: 'boolean'
  },
  'Fractalseg': { 
    current: 'FractalValue', 
    range: { min: 0, max: 12.0 },
    currentRange: { min: 1, max: 9 },
    type: 'number'
  },
  'Euclid': { 
    current: 'UseEuclid', 
    range: { min: 0, max: 1 },
    currentRange: { min: false, max: true },
    type: 'boolean'
  },
  'K': { 
    current: 'EuclidValue', 
    range: { min: 0, max: 12.0 },
    currentRange: { min: 1, max: 12 },
    type: 'number'
  },

  // Display and Curve Parameters
  // 'Numbers': { 
  //   current: 'ShowAxisFreqLabels', // DISABLED
  //   range: { min: 0, max: 1 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },
  // 'Lines': { 
  //   current: 'ShowAxisFreqLabels', // DISABLED - Map to axis labels as closest equivalent
  //   range: { min: 0, max: 1 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },
  // 'Dots': { 
  //   current: 'ShowPointsFreqLabels', // DISABLED - Dots parameter not implemented yet
  //   range: { min: 0, max: 1 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },
  // 'Mirror': { 
  //   current: 'AltScale', // DISABLED - Mirror parameter not implemented yet
  //   range: { min: 0, max: 2.0 },
  //   currentRange: { min: 0.5, max: 5.0 },
  //   type: 'number'
  // },
  'Lag': { 
    current: 'UseLerp', 
    range: { min: 0, max: 1 },
    currentRange: { min: false, max: true },
    type: 'boolean'
  },

  // Note Parameters
  // 'Temperament': { 
  //   current: 'UseEqualTemperament', // DISABLED
  //   range: { min: 0, max: 1 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },
  // 'Noteendless': { 
  //   current: 'UseLerp', // DISABLED - Map to lerp as closest equivalent for endless notes
  //   range: { min: 0, max: 1 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },
  // 'Noteduration': { 
  //   current: 'MaxDuration', // DISABLED - Map to max duration
  //   range: { min: 0, max: 4.0 },
  //   currentRange: { min: 0.01, max: 2.0 },
  //   type: 'number'
  // },

  // Carve Parameters (map to existing functionality)
  // 'Carve': { 
  //   current: 'UseDelete', // DISABLED - Map to delete as closest equivalent
  //   range: { min: 0, max: 1 },
  //   currentRange: { min: false, max: true },
  //   type: 'boolean'
  // },
  // 'Carvex': { 
  //   current: 'DeleteMin', // DISABLED - Map to delete min
  //   range: { min: 0, max: 1.0 },
  //   currentRange: { min: 1, max: 32 },
  //   type: 'number'
  // },
  // 'Carvey': { 
  //   current: 'DeleteMax', // DISABLED - Map to delete max
  //   range: { min: 0, max: 1.0 },
  //   currentRange: { min: 1, max: 32 },
  //   type: 'number'
  // }
};

/**
 * Legacy OSC Compatibility Layer
 * Intercepts and translates legacy Max4Live GM_layer.maxpat OSC messages
 */
class LegacyOscCompatibility {
  constructor() {
    this.isEnabled = true;
    this.stats = {
      messagesTranslated: 0,
      unknownParameters: new Set(),
      errors: 0
    };
    
    console.log('[LEGACY OSC] LegacyOscCompatibility initialized');
  }

  /**
   * Check if a message is a legacy OSC message
   * @param {string} message - OSC message to check
   * @returns {boolean} True if this is a legacy message
   */
  isLegacyMessage(message) {
    if (!this.isEnabled || !message) return false;
    
    // Legacy messages have format: "/LayerName/ParameterName value"
    // where ParameterName is in our legacy mapping
    const parts = message.trim().split(' ');
    if (parts.length < 2) return false;
    
    const address = parts[0];
    const addressMatch = address.match(/^\/([^\/]+)\/(.+)$/);
    if (!addressMatch) return false;
    
    const parameterName = addressMatch[2];
    return LEGACY_PARAMETER_MAPPING.hasOwnProperty(parameterName);
  }

  /**
   * Translate a legacy OSC message to current format
   * @param {string} message - Legacy OSC message
   * @returns {string|null} Translated message or null if translation fails
   */
  translateMessage(message) {
    try {
      if (!this.isLegacyMessage(message)) {
        return null; // Not a legacy message
      }

      const parts = message.trim().split(' ');
      const address = parts[0];
      const value = parts.slice(1).join(' '); // Handle values with spaces

      // Parse legacy address: "/LayerName/ParameterName"
      const addressMatch = address.match(/^\/([^\/]+)\/(.+)$/);
      if (!addressMatch) {
        console.warn('[LEGACY OSC] Invalid address format:', address);
        return null;
      }

      const layerName = addressMatch[1];
      const legacyParameterName = addressMatch[2];

      // Get parameter mapping
      const paramMapping = LEGACY_PARAMETER_MAPPING[legacyParameterName];
      if (!paramMapping) {
        this.stats.unknownParameters.add(legacyParameterName);
        console.warn('[LEGACY OSC] Unknown legacy parameter:', legacyParameterName);
        return null;
      }

      // Parse and convert value
      const convertedValue = this.convertValue(value, paramMapping);
      if (convertedValue === null) {
        console.warn('[LEGACY OSC] Failed to convert value for', legacyParameterName, ':', value);
        this.stats.errors++;
        return null;
      }

      // Extract layer ID from layer name (e.g., "G01" -> "01")
      const layerIdMatch = layerName.match(/^G(\d+)$/);
      let newAddress;
      
      if (layerIdMatch) {
        // Standard layer format: /G01/Parameter -> /G01/NewParameter
        newAddress = `/G${layerIdMatch[1]}/${paramMapping.current}`;
      } else {
        // Non-standard layer name, keep as is but use new parameter name
        newAddress = `/${layerName}/${paramMapping.current}`;
      }

      // Create new message
      const newMessage = `${newAddress} ${convertedValue}`;
      
      this.stats.messagesTranslated++;
      console.log(`[LEGACY OSC] Translated: "${message}" -> "${newMessage}"`);
      
      return newMessage;

    } catch (error) {
      console.error('[LEGACY OSC] Error translating message:', error);
      this.stats.errors++;
      return null;
    }
  }

  /**
   * Convert a value from legacy range to current range
   * @param {string} value - Input value as string
   * @param {Object} paramMapping - Parameter mapping configuration
   * @returns {string|null} Converted value or null if conversion fails
   */
  convertValue(value, paramMapping) {
    try {
      const { type, range, currentRange } = paramMapping;

      switch (type) {
        case 'number':
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return null;

          // Handle discrete value mapping (like Speed -> TimeSubdivisionValue)
          if (paramMapping.discrete && Array.isArray(paramMapping.discrete)) {
            const index = Math.floor(Math.max(0, Math.min(paramMapping.discrete.length - 1, numValue)));
            return paramMapping.discrete[index].toString();
          }

          // Scale from legacy range to current range
          const scaledValue = this.scaleValue(
            numValue, 
            range.min, 
            range.max, 
            currentRange.min, 
            currentRange.max
          );

          return scaledValue.toString();

        case 'boolean':
          // Convert 0/1 to true/false, but keep boolean strings as-is
          if (value === '0' || value === 'false') return 'false';
          if (value === '1' || value === 'true') return 'true';
          
          // Try parsing as number for 0/1 values
          const boolNum = parseFloat(value);
          if (!isNaN(boolNum)) {
            return boolNum > 0.5 ? 'true' : 'false';
          }
          
          return null;

        case 'mode':
          // Convert numeric mode to string mode
          const modeIndex = Math.floor(parseFloat(value));
          if (isNaN(modeIndex) || modeIndex < 0 || modeIndex >= currentRange.length) {
            return currentRange[0]; // Default to first mode
          }
          return currentRange[modeIndex];

        default:
          console.warn('[LEGACY OSC] Unknown parameter type:', type);
          return value; // Return as-is
      }

    } catch (error) {
      console.error('[LEGACY OSC] Error converting value:', error);
      return null;
    }
  }

  /**
   * Scale a value from one range to another
   * @param {number} value - Input value
   * @param {number} fromMin - Source range minimum
   * @param {number} fromMax - Source range maximum
   * @param {number} toMin - Target range minimum
   * @param {number} toMax - Target range maximum
   * @returns {number} Scaled value
   */
  scaleValue(value, fromMin, fromMax, toMin, toMax) {
    // Clamp input value to source range
    const clampedValue = Math.max(fromMin, Math.min(fromMax, value));
    
    // Handle edge case where source range is 0
    if (fromMax === fromMin) {
      return toMin;
    }
    
    // Scale to 0-1 range
    const normalized = (clampedValue - fromMin) / (fromMax - fromMin);
    
    // Scale to target range
    return toMin + (normalized * (toMax - toMin));
  }

  /**
   * Enable or disable legacy compatibility
   * @param {boolean} enabled - Whether to enable legacy compatibility
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
    console.log(`[LEGACY OSC] Legacy compatibility ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get compatibility statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      isEnabled: this.isEnabled,
      messagesTranslated: this.stats.messagesTranslated,
      unknownParameters: Array.from(this.stats.unknownParameters),
      errors: this.stats.errors,
      supportedParameters: Object.keys(LEGACY_PARAMETER_MAPPING).length
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats.messagesTranslated = 0;
    this.stats.unknownParameters.clear();
    this.stats.errors = 0;
    console.log('[LEGACY OSC] Statistics reset');
  }

  /**
   * Get list of supported legacy parameters
   * @returns {Array} Array of supported legacy parameter names
   */
  getSupportedParameters() {
    return Object.keys(LEGACY_PARAMETER_MAPPING);
  }

  /**
   * Get parameter mapping for a specific legacy parameter
   * @param {string} legacyParameterName - Legacy parameter name
   * @returns {Object|null} Parameter mapping or null if not found
   */
  getParameterMapping(legacyParameterName) {
    return LEGACY_PARAMETER_MAPPING[legacyParameterName] || null;
  }

  /**
   * Convert a value from current range back to legacy range
   * @param {string} value - Input value as string
   * @param {Object} paramMapping - Parameter mapping configuration
   * @returns {string|null} Converted value or null if conversion fails
   */
  convertValueToLegacy(value, paramMapping) {
    try {
      const { type, range, currentRange } = paramMapping;

      switch (type) {
        case 'number':
          const numValue = parseFloat(value);
          if (isNaN(numValue)) return null;

          // Handle discrete value reverse mapping (like TimeSubdivisionValue -> Speed)
          if (paramMapping.discrete && Array.isArray(paramMapping.discrete)) {
            const index = paramMapping.discrete.indexOf(numValue);
            if (index >= 0) {
              return index.toString();
            }
            // If exact match not found, find closest value
            let closestIndex = 0;
            let closestDiff = Math.abs(paramMapping.discrete[0] - numValue);
            for (let i = 1; i < paramMapping.discrete.length; i++) {
              const diff = Math.abs(paramMapping.discrete[i] - numValue);
              if (diff < closestDiff) {
                closestDiff = diff;
                closestIndex = i;
              }
            }
            return closestIndex.toString();
          }

          // Scale from current range back to legacy range
          const scaledValue = this.scaleValue(
            numValue, 
            currentRange.min, 
            currentRange.max,
            range.min, 
            range.max
          );

          return scaledValue.toString();

        case 'boolean':
          // Convert true/false back to 1/0
          if (value === 'true' || value === true) return '1';
          if (value === 'false' || value === false) return '0';
          
          // Try parsing as boolean for other values
          const boolValue = Boolean(value);
          return boolValue ? '1' : '0';

        case 'mode':
          // Convert string mode back to numeric mode
          if (Array.isArray(currentRange)) {
            const modeIndex = currentRange.indexOf(value);
            if (modeIndex >= 0) {
              return modeIndex.toString();
            }
          }
          return '0'; // Default to first mode

        default:
          return value.toString();
      }
    } catch (error) {
      console.error('[LEGACY OSC] Error converting value to legacy:', error);
      return null;
    }
  }
}

// Create global instance
const legacyOscCompatibility = new LegacyOscCompatibility();

/**
 * Public API functions
 */

/**
 * Check if a message is a legacy OSC message
 * @param {string} message - OSC message to check
 * @returns {boolean} True if this is a legacy message
 */
export function isLegacyOscMessage(message) {
  return legacyOscCompatibility.isLegacyMessage(message);
}

/**
 * Translate a legacy OSC message to current format
 * @param {string} message - Legacy OSC message
 * @returns {string|null} Translated message or null if translation fails
 */
export function translateLegacyOscMessage(message) {
  return legacyOscCompatibility.translateMessage(message);
}

/**
 * Enable or disable legacy OSC compatibility
 * @param {boolean} enabled - Whether to enable legacy compatibility
 */
export function setLegacyOscEnabled(enabled) {
  legacyOscCompatibility.setEnabled(enabled);
}

/**
 * Get legacy OSC compatibility statistics
 * @returns {Object} Statistics object
 */
export function getLegacyOscStats() {
  return legacyOscCompatibility.getStats();
}

/**
 * Reset legacy OSC statistics
 */
export function resetLegacyOscStats() {
  legacyOscCompatibility.resetStats();
}

/**
 * Get list of supported legacy parameters
 * @returns {Array} Array of supported legacy parameter names
 */
export function getSupportedLegacyParameters() {
  return legacyOscCompatibility.getSupportedParameters();
}

/**
 * Get parameter mapping for a specific legacy parameter
 * @param {string} legacyParameterName - Legacy parameter name
 * @returns {Object|null} Parameter mapping or null if not found
 */
export function getLegacyParameterMapping(legacyParameterName) {
  return legacyOscCompatibility.getParameterMapping(legacyParameterName);
}

/**
 * Translate a modern OSC message to legacy format for OSC OUT
 * @param {string} message - Modern OSC message
 * @returns {string|null} Legacy OSC message or null if no translation needed
 */
export function translateToLegacyOscMessage(message) {
  if (!legacyOscCompatibility.isEnabled || !message) return null;
  
  try {
    const parts = message.trim().split(' ');
    if (parts.length < 2) return null;
    
    const address = parts[0];
    const value = parts.slice(1).join(' ');
    
    // Parse modern address: "/G01/ParameterName" or "/Global/ParameterName"
    const addressMatch = address.match(/^\/([^\/]+)\/(.+)$/);
    if (!addressMatch) return null;
    
    const layerOrGlobal = addressMatch[1];
    const modernParameterName = addressMatch[2];
    
    // Skip global parameters - they don't have legacy equivalents
    if (layerOrGlobal === 'Global') return null;
    
    // Find the legacy parameter name by searching for the modern name in the mapping
    // For parameters that have multiple legacy mappings, prefer the most appropriate one
    let legacyParameterName = null;
    const legacyMatches = [];
    
    for (const [legacyName, mapping] of Object.entries(LEGACY_PARAMETER_MAPPING)) {
      if (mapping.current === modernParameterName) {
        legacyMatches.push(legacyName);
      }
    }
    
    if (legacyMatches.length === 0) {
      return null; // No legacy mapping found
    } else if (legacyMatches.length === 1) {
      legacyParameterName = legacyMatches[0];
    } else {
      // Multiple legacy parameters map to the same modern parameter
      // Apply priority rules for the most appropriate mapping
      const priorities = {
        // 'ShowAxisFreqLabels': ['Lines'], // DISABLED - Both Numbers and Lines are disabled
        'UseDelete': ['Delete'], // Prefer Delete over Carve (Carve is disabled)
        'DeleteMin': ['Deletemin'], // Prefer Deletemin over Carvex (Carvex is disabled)
        'DeleteMax': ['Deletemax'], // Prefer Deletemax over Carvey (Carvey is disabled)
      };
      
      const priorityList = priorities[modernParameterName];
      if (priorityList) {
        // Find the first priority match
        legacyParameterName = priorityList.find(priority => legacyMatches.includes(priority)) || legacyMatches[0];
      } else {
        // No priority defined, use first match
        legacyParameterName = legacyMatches[0];
      }
      
      console.log(`[LEGACY OSC] Multiple legacy mappings for ${modernParameterName}: [${legacyMatches.join(', ')}], chose: ${legacyParameterName}`);
    }
    
    const paramMapping = LEGACY_PARAMETER_MAPPING[legacyParameterName];
    
    // Convert the value back to legacy range
    const convertedValue = legacyOscCompatibility.convertValueToLegacy(value, paramMapping);
    if (convertedValue === null) {
      console.warn('[LEGACY OSC] Failed to convert value to legacy for', modernParameterName, ':', value);
      return null;
    }
    
    // Create legacy message with same layer name format
    const legacyMessage = `/${layerOrGlobal}/${legacyParameterName} ${convertedValue}`;
    
    console.log(`[LEGACY OSC] Reverse translated: "${message}" -> "${legacyMessage}"`);
    return legacyMessage;
    
  } catch (error) {
    console.error('[LEGACY OSC] Error reverse translating message:', error);
    return null;
  }
}

export default legacyOscCompatibility; 