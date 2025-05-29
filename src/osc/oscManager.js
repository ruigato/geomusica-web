// src/osc/oscManager.js - OSC IN/OUT integration for GeoMusica
// Handles real-time parameter automation via OSC messages

import { 
  isLegacyOscMessage, 
  translateLegacyOscMessage,
  translateToLegacyOscMessage,
  getLegacyOscStats,
  setLegacyOscEnabled,
  getSupportedLegacyParameters,
  resetLegacyOscStats
} from './legacyOscCompatibility.js';

/**
 * OSC Manager for GeoMusica
 * Handles OSC IN (parameter automation) and OSC OUT (parameter feedback)
 * Address format: "/G{layerId}/{parameterName} {value}"
 * Example: "/G01/Radius 200" sets layer 1 radius to 200
 */
class OSCManager {
  constructor() {
    this.isEnabled = false;
    this.oscInSocket = null;
    this.oscOutSocket = null;
    
    // Connection settings
    this.oscInPort = 8080;
    this.oscOutPort = 8081;
    this.host = 'localhost';
    
    // Parameter tracking
    this.activeParameters = new Map(); // Track which parameters are being touched
    this.parameterMapping = new Map(); // Map OSC addresses to parameter setters
    this.lastValues = new Map(); // Track last sent values to avoid spam
    
    // Statistics
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
      lastActivity: null
    };
    
    // Initialize parameter mapping
    this.initializeParameterMapping();
    
    console.log('[OSC] OSCManager initialized');
  }
  
  /**
   * Initialize the mapping between OSC addresses and parameter setters
   */
  initializeParameterMapping() {
    // Layer-specific parameters (per layer)
    const layerParameters = {
      'Radius': { setter: 'setRadius', type: 'number' },
      'Copies': { setter: 'setCopies', type: 'number' },
      'Segments': { setter: 'setSegments', type: 'number' },
      'StepScale': { setter: 'setStepScale', type: 'number' },
      'Angle': { setter: 'setAngle', type: 'number' },
      'StartingAngle': { setter: 'setStartingAngle', type: 'number' },
      'LerpTime': { setter: 'setLerpTime', type: 'number' },
      'AltScale': { setter: 'setAltScale', type: 'number' },
      'AltStepN': { setter: 'setAltStepN', type: 'number' },
      'FractalValue': { setter: 'setFractalValue', type: 'number' },
      'EuclidValue': { setter: 'setEuclidValue', type: 'number' },
      'StarSkip': { setter: 'setStarSkip', type: 'number' },
      'MinDuration': { setter: 'setMinDuration', type: 'number' },
      'MaxDuration': { setter: 'setMaxDuration', type: 'number' },
      'DurationPhase': { setter: 'setDurationPhase', type: 'number' },
      'MinVelocity': { setter: 'setMinVelocity', type: 'number' },
      'MaxVelocity': { setter: 'setMaxVelocity', type: 'number' },
      'VelocityPhase': { setter: 'setVelocityPhase', type: 'number' },
      'DeleteMin': { setter: 'setDeleteMin', type: 'number' },
      'DeleteMax': { setter: 'setDeleteMax', type: 'number' },
      'DeleteSeed': { setter: 'setDeleteSeed', type: 'number' },
      'ModulusValue': { setter: 'setModulusValue', type: 'number' },
      'TimeSubdivisionValue': { setter: 'setTimeSubdivisionValue', type: 'number' },
      'QuantizationValue': { setter: 'setQuantizationValue', type: 'number' },
      'DurationModulo': { setter: 'setDurationModulo', type: 'number' },
      'VelocityModulo': { setter: 'setVelocityModulo', type: 'number' },
      
      // Boolean parameters
      'UseFractal': { setter: 'setUseFractal', type: 'boolean' },
      'UseEuclid': { setter: 'setUseEuclid', type: 'boolean' },
      'UseStars': { setter: 'setUseStars', type: 'boolean' },
      'UseCuts': { setter: 'setUseCuts', type: 'boolean' },
      'UseTesselation': { setter: 'setUseTesselation', type: 'boolean' },
      'UseAltScale': { setter: 'setUseAltScale', type: 'boolean' },
      'UseLerp': { setter: 'setUseLerp', type: 'boolean' },
      'UseQuantization': { setter: 'setUseQuantization', type: 'boolean' },
      'UseModulus': { setter: 'setUseModulus', type: 'boolean' },
      'UseTimeSubdivision': { setter: 'setUseTimeSubdivision', type: 'boolean' },
      'UseDelete': { setter: 'setUseDelete', type: 'boolean' },
      'UsePlainIntersections': { setter: 'setUsePlainIntersections', type: 'boolean' },
      'ShowAxisFreqLabels': { setter: 'setShowAxisFreqLabels', type: 'boolean' },
      'ShowPointsFreqLabels': { setter: 'setShowPointsFreqLabels', type: 'boolean' },
      
      // String parameters
      'DurationMode': { setter: 'setDurationMode', type: 'string' },
      'VelocityMode': { setter: 'setVelocityMode', type: 'string' },
      'DeleteMode': { setter: 'setDeleteMode', type: 'string' },
      'DeleteTarget': { setter: 'setDeleteTarget', type: 'string' }
    };
    
    // Global parameters (not layer-specific)
    const globalParameters = {
      'BPM': { setter: 'setBpm', type: 'number', global: true },
      'Attack': { setter: 'setAttack', type: 'number', global: true },
      'Decay': { setter: 'setDecay', type: 'number', global: true },
      'Sustain': { setter: 'setSustain', type: 'number', global: true },
      'Release': { setter: 'setRelease', type: 'number', global: true },
      'Brightness': { setter: 'setBrightness', type: 'number', global: true },
      'Volume': { setter: 'setVolume', type: 'number', global: true },
      'UseEqualTemperament': { setter: 'setUseEqualTemperament', type: 'boolean', global: true },
      'ReferenceFreq': { setter: 'setReferenceFreq', type: 'number', global: true }
    };
    
    // Store both layer and global parameters
    this.layerParameters = layerParameters;
    this.globalParameters = globalParameters;
    
    console.log('[OSC] Parameter mapping initialized with', 
      Object.keys(layerParameters).length, 'layer parameters and',
      Object.keys(globalParameters).length, 'global parameters');
  }
  
  /**
   * Initialize OSC connections
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      await this.connectOSCIn();
      await this.connectOSCOut();
      this.isEnabled = true;
      console.log('[OSC] OSC system initialized successfully');
      return true;
    } catch (error) {
      console.error('[OSC] Failed to initialize OSC system:', error);
      return false;
    }
  }
  
  /**
   * Connect to OSC IN (receive automation)
   */
  async connectOSCIn() {
    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection for OSC IN
        this.oscInSocket = new WebSocket(`ws://${this.host}:${this.oscInPort}`);
        
        this.oscInSocket.onopen = () => {
          console.log('[OSC IN] Connected to OSC IN server');
          resolve();
        };
        
        this.oscInSocket.onmessage = (event) => {
          this.handleOSCMessage(event.data);
        };
        
        this.oscInSocket.onerror = (error) => {
          console.error('[OSC IN] Connection error:', error);
          reject(error);
        };
        
        this.oscInSocket.onclose = () => {
          console.log('[OSC IN] Connection closed');
          this.oscInSocket = null;
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Connect to OSC OUT (send parameter changes)
   */
  async connectOSCOut() {
    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection for OSC OUT
        this.oscOutSocket = new WebSocket(`ws://${this.host}:${this.oscOutPort}`);
        
        this.oscOutSocket.onopen = () => {
          console.log('[OSC OUT] Connected to OSC OUT server');
          resolve();
        };
        
        this.oscOutSocket.onerror = (error) => {
          console.error('[OSC OUT] Connection error:', error);
          reject(error);
        };
        
        this.oscOutSocket.onclose = () => {
          console.log('[OSC OUT] Connection closed');
          this.oscOutSocket = null;
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  /**
   * Handle incoming OSC message
   * @param {string} message - OSC message data
   */
  handleOSCMessage(message) {
    try {
      // Check if this is a legacy OSC message and translate it
      let processedMessage = message;
      
      if (isLegacyOscMessage(message)) {
        const translatedMessage = translateLegacyOscMessage(message);
        if (translatedMessage) {
          console.log(`[OSC] Legacy message translated: "${message}" -> "${translatedMessage}"`);
          processedMessage = translatedMessage;
        } else {
          console.warn('[OSC] Failed to translate legacy message:', message);
          this.stats.errors++;
          return;
        }
      }

      // Parse OSC message format: "/G{layerId}/{parameterName} {value}"
      const parsed = this.parseOSCMessage(processedMessage);
      if (!parsed) {
        console.warn('[OSC IN] Failed to parse message:', processedMessage);
        return;
      }
      
      const { layerId, parameterName, value, isGlobal } = parsed;
      
      // Check if this parameter is currently being touched by user
      const paramKey = isGlobal ? `global_${parameterName}` : `layer_${layerId}_${parameterName}`;
      if (this.activeParameters.has(paramKey)) {
        // Parameter is being touched, ignore OSC input
        return;
      }
      
      // Apply the parameter change
      this.applyParameterChange(layerId, parameterName, value, isGlobal);
      
      this.stats.messagesReceived++;
      this.stats.lastActivity = Date.now();
      
    } catch (error) {
      console.error('[OSC IN] Error handling message:', error);
      this.stats.errors++;
    }
  }
  
  /**
   * Parse OSC message string
   * @param {string} message - Raw OSC message
   * @returns {Object|null} Parsed message or null if invalid
   */
  parseOSCMessage(message) {
    try {
      // Expected format: "/G{layerId}/{parameterName} {value}" or "/Global/{parameterName} {value}"
      const parts = message.trim().split(' ');
      if (parts.length < 2) return null;
      
      const address = parts[0];
      const value = parts.slice(1).join(' '); // Handle values with spaces
      
      // Parse address
      const addressMatch = address.match(/^\/G(\d+)\/(.+)$/) || address.match(/^\/Global\/(.+)$/);
      if (!addressMatch) return null;
      
      let layerId, parameterName, isGlobal;
      
      if (address.startsWith('/Global/')) {
        isGlobal = true;
        parameterName = addressMatch[1];
        layerId = null;
      } else {
        isGlobal = false;
        layerId = parseInt(addressMatch[1]) - 1; // Convert to 0-based index
        parameterName = addressMatch[2];
      }
      
      return { layerId, parameterName, value, isGlobal };
      
    } catch (error) {
      console.error('[OSC] Error parsing message:', error);
      return null;
    }
  }
  
  /**
   * Apply parameter change from OSC
   * @param {number|null} layerId - Layer ID (0-based) or null for global
   * @param {string} parameterName - Parameter name
   * @param {string} value - Parameter value as string
   * @param {boolean} isGlobal - Whether this is a global parameter
   */
  applyParameterChange(layerId, parameterName, value, isGlobal) {
    try {
      const paramMap = isGlobal ? this.globalParameters : this.layerParameters;
      const paramConfig = paramMap[parameterName];
      
      if (!paramConfig) {
        console.warn('[OSC] Unknown parameter:', parameterName);
        return;
      }
      
      // Convert value based on type
      let convertedValue;
      switch (paramConfig.type) {
        case 'number':
          convertedValue = parseFloat(value);
          if (isNaN(convertedValue)) {
            console.warn('[OSC] Invalid number value for', parameterName, ':', value);
            return;
          }
          break;
        case 'boolean':
          convertedValue = value === 'true' || value === '1' || value === 'on';
          break;
        case 'string':
          convertedValue = value;
          break;
        default:
          console.warn('[OSC] Unknown parameter type:', paramConfig.type);
          return;
      }
      
      // Get target state
      let targetState;
      if (isGlobal) {
        targetState = window._globalState;
      } else {
        const layerManager = window._layers;
        if (!layerManager || !layerManager.layers[layerId]) {
          console.warn('[OSC] Invalid layer ID:', layerId);
          return;
        }
        targetState = layerManager.layers[layerId].state;
      }
      
      if (!targetState) {
        console.warn('[OSC] Target state not found');
        return;
      }
      
      // Call the setter
      const setter = targetState[paramConfig.setter];
      if (typeof setter === 'function') {
        setter.call(targetState, convertedValue);
        console.log(`[OSC] Applied ${parameterName} = ${convertedValue} to ${isGlobal ? 'global' : `layer ${layerId}`}`);
        
        // Update UI to reflect the change (only for active layer)
        this.updateUIForParameter(parameterName, convertedValue, isGlobal, layerId);
        
        // Trigger state synchronization to update geometry
        if (typeof window.syncStateAcrossSystems === 'function') {
          window.syncStateAcrossSystems();
        }
      } else {
        console.warn('[OSC] Setter not found:', paramConfig.setter);
      }
      
    } catch (error) {
      console.error('[OSC] Error applying parameter change:', error);
      this.stats.errors++;
    }
  }
  
  /**
   * Update UI elements to reflect parameter changes from OSC
   * @param {string} parameterName - Parameter name
   * @param {*} value - Parameter value
   * @param {boolean} isGlobal - Whether this is a global parameter
   * @param {number|null} layerId - Layer ID for layer parameters
   */
  updateUIForParameter(parameterName, value, isGlobal, layerId) {
    try {
      // For layer parameters, only update UI if this is the currently active layer
      if (!isGlobal) {
        const layerManager = window._layers;
        if (!layerManager || layerManager.activeLayerId !== layerId) {
          // This parameter change is for a non-active layer, don't update UI
          console.log(`[OSC] Parameter ${parameterName} updated on layer ${layerId} (not active layer ${layerManager?.activeLayerId}), UI not updated`);
          return;
        }
      }
      
      // Convert parameter name to UI element ID format
      const elementId = parameterName.charAt(0).toLowerCase() + parameterName.slice(1);
      
      // Update range slider
      const rangeElement = document.getElementById(`${elementId}Range`);
      if (rangeElement) {
        rangeElement.value = value;
      }
      
      // Update number input
      const numberElement = document.getElementById(`${elementId}Number`);
      if (numberElement) {
        numberElement.value = value;
      }
      
      // Update display value
      const valueElement = document.getElementById(`${elementId}Value`);
      if (valueElement) {
        if (typeof value === 'number') {
          valueElement.textContent = value.toFixed(2);
        } else {
          valueElement.textContent = value.toString();
        }
      }
      
      // Update checkbox for boolean parameters
      let checkboxElement;
      
      // Handle special cases for checkbox naming
      if (parameterName === 'UseLerp') {
        checkboxElement = document.getElementById('useLerpCheckbox');
      } else {
        checkboxElement = document.getElementById(`use${parameterName}Checkbox`);
      }
      
      if (checkboxElement && typeof value === 'boolean') {
        checkboxElement.checked = value;
        console.log(`[OSC] Updated checkbox ${checkboxElement.id} = ${value}`);
      }
      
      // Update radio buttons for numeric parameters that use radio groups
      if (typeof value === 'number') {
        // Handle special cases for radio button parameters
        let radioGroupName;
        
        if (parameterName === 'ModulusValue') {
          radioGroupName = 'modulus';
        } else if (parameterName === 'TimeSubdivisionValue') {
          radioGroupName = 'timeSubdivisionValue';
        } else if (parameterName === 'QuantizationValue') {
          radioGroupName = 'quantizationValue';
        } else if (parameterName === 'DurationModulo') {
          radioGroupName = 'durationModulo';
        } else if (parameterName === 'VelocityModulo') {
          radioGroupName = 'velocityModulo';
        }
        
        if (radioGroupName) {
          const radioButtons = document.querySelectorAll(`input[name="${radioGroupName}"]`);
          radioButtons.forEach(radio => {
            if (parseFloat(radio.value) === value) {
              radio.checked = true;
              
              // Manually trigger the change event to ensure event handlers are called
              const changeEvent = new Event('change', { bubbles: true });
              radio.dispatchEvent(changeEvent);
              console.log(`[OSC] Updated radio button ${radioGroupName} = ${value}`);
            } else {
              radio.checked = false;
            }
          });
        }
      }
      
      console.log(`[OSC] Updated UI for ${isGlobal ? 'global' : `layer ${layerId}`} parameter: ${parameterName} = ${value}`);
      
    } catch (error) {
      console.error('[OSC] Error updating UI:', error);
    }
  }
  
  /**
   * Send parameter change via OSC OUT
   * @param {string} parameterName - Parameter name
   * @param {*} value - Parameter value
   * @param {boolean} isGlobal - Whether this is a global parameter
   * @param {number|null} layerId - Layer ID for layer parameters
   */
  sendParameterChange(parameterName, value, isGlobal = false, layerId = null) {
    if (!this.oscOutSocket || this.oscOutSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    try {
      // Create OSC address
      let address;
      if (isGlobal) {
        address = `/Global/${parameterName}`;
      } else {
        const layerNum = (layerId || 0) + 1; // Convert to 1-based
        address = `/G${layerNum.toString().padStart(2, '0')}/${parameterName}`;
      }
      
      // Create OSC message
      const message = `${address} ${value}`;
      
      // Try to translate to legacy format for compatibility
      let finalMessage = message;
      const legacyMessage = translateToLegacyOscMessage(message);
      if (legacyMessage) {
        finalMessage = legacyMessage;
      }
      
      // Check if value has changed to avoid spam
      const key = `${address}_${value}`;
      if (this.lastValues.get(address) === value) {
        return; // Same value, don't send
      }
      this.lastValues.set(address, value);
      
      // Send message (either modern or legacy format)
      this.oscOutSocket.send(finalMessage);
      
      this.stats.messagesSent++;
      this.stats.lastActivity = Date.now();
      
      console.log(`[OSC OUT] Sent: ${finalMessage}${legacyMessage ? ' (legacy format)' : ''}`);
      
    } catch (error) {
      console.error('[OSC OUT] Error sending message:', error);
      this.stats.errors++;
    }
  }
  
  /**
   * Mark a parameter as being actively touched (disable OSC IN for this parameter)
   * @param {string} parameterName - Parameter name
   * @param {boolean} isGlobal - Whether this is a global parameter
   * @param {number|null} layerId - Layer ID for layer parameters
   */
  setParameterActive(parameterName, isGlobal = false, layerId = null) {
    const paramKey = isGlobal ? `global_${parameterName}` : `layer_${layerId || 0}_${parameterName}`;
    this.activeParameters.set(paramKey, Date.now());
    console.log(`[OSC] Parameter ${paramKey} marked as active (OSC IN disabled)`);
  }
  
  /**
   * Mark a parameter as no longer being touched (re-enable OSC IN for this parameter)
   * @param {string} parameterName - Parameter name
   * @param {boolean} isGlobal - Whether this is a global parameter
   * @param {number|null} layerId - Layer ID for layer parameters
   */
  setParameterInactive(parameterName, isGlobal = false, layerId = null) {
    const paramKey = isGlobal ? `global_${parameterName}` : `layer_${layerId || 0}_${parameterName}`;
    this.activeParameters.delete(paramKey);
    console.log(`[OSC] Parameter ${paramKey} marked as inactive (OSC IN enabled)`);
  }
  
  /**
   * Disconnect OSC connections
   */
  disconnect() {
    if (this.oscInSocket) {
      this.oscInSocket.close();
      this.oscInSocket = null;
    }
    
    if (this.oscOutSocket) {
      this.oscOutSocket.close();
      this.oscOutSocket = null;
    }
    
    this.isEnabled = false;
    console.log('[OSC] Disconnected');
  }
  
  /**
   * Get OSC system status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isEnabled: this.isEnabled,
      oscInConnected: this.oscInSocket && this.oscInSocket.readyState === WebSocket.OPEN,
      oscOutConnected: this.oscOutSocket && this.oscOutSocket.readyState === WebSocket.OPEN,
      activeParameters: this.activeParameters.size,
      stats: { ...this.stats }
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      errors: 0,
      lastActivity: null
    };
    console.log('[OSC] Statistics reset');
  }
  
  /**
   * Get OSC statistics including legacy compatibility stats
   * @returns {Object} Combined statistics
   */
  getCombinedStats() {
    const legacyStats = getLegacyOscStats();
    
    return {
      // Main OSC stats
      isEnabled: this.isEnabled,
      messagesReceived: this.stats.messagesReceived,
      messagesSent: this.stats.messagesSent,
      errors: this.stats.errors,
      lastActivity: this.stats.lastActivity,
      activeParameters: this.activeParameters.size,
      
      // Legacy compatibility stats
      legacy: {
        isEnabled: legacyStats.isEnabled,
        messagesTranslated: legacyStats.messagesTranslated,
        unknownParameters: legacyStats.unknownParameters,
        supportedParameters: legacyStats.supportedParameters,
        errors: legacyStats.errors
      }
    };
  }

  /**
   * Get current OSC statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      isEnabled: this.isEnabled,
      messagesReceived: this.stats.messagesReceived,
      messagesSent: this.stats.messagesSent,
      errors: this.stats.errors,
      lastActivity: this.stats.lastActivity,
      activeParameters: this.activeParameters.size
    };
  }
}

// Create singleton instance
const oscManager = new OSCManager();

// Export functions for integration
export async function initializeOSC() {
  return await oscManager.initialize();
}

export function enableOSC() {
  return oscManager.initialize();
}

export function disableOSC() {
  oscManager.disconnect();
}

export function isOSCEnabled() {
  return oscManager.isEnabled;
}

export function getOSCStatus() {
  return oscManager.getStatus();
}

export function resetOSCStats() {
  oscManager.resetStats();
}

export function sendOSCParameterChange(parameterName, value, isGlobal = false, layerId = null) {
  oscManager.sendParameterChange(parameterName, value, isGlobal, layerId);
}

export function setOSCParameterActive(parameterName, isGlobal = false, layerId = null) {
  oscManager.setParameterActive(parameterName, isGlobal, layerId);
}

export function setOSCParameterInactive(parameterName, isGlobal = false, layerId = null) {
  oscManager.setParameterInactive(parameterName, isGlobal, layerId);
}

/**
 * Get combined OSC statistics including legacy compatibility
 * @returns {Object} Combined statistics
 */
export function getCombinedOSCStats() {
  return oscManager.getCombinedStats();
}

/**
 * Enable or disable legacy OSC compatibility
 * @param {boolean} enabled - Whether to enable legacy compatibility
 */
export function setLegacyOSCEnabled(enabled) {
  setLegacyOscEnabled(enabled);
}

/**
 * Get list of supported legacy parameters
 * @returns {Array} Array of supported legacy parameter names
 */
export function getSupportedLegacyOSCParameters() {
  return getSupportedLegacyParameters();
}

/**
 * Reset legacy OSC statistics
 */
export function resetLegacyOSCStats() {
  resetLegacyOscStats();
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.oscManager = oscManager;
  window.initializeOSC = initializeOSC;
  window.enableOSC = enableOSC;
  window.disableOSC = disableOSC;
  window.getOSCStatus = getOSCStatus;
  window.sendOSCParameterChange = sendOSCParameterChange;
  
  // Debug functions
  window.debugOSC = () => {
    const status = getOSCStatus();
    console.log('[OSC DEBUG] Status:', status);
    return status;
  };
  
  window.testOSCMessage = (message) => {
    console.log('[OSC DEBUG] Testing message:', message);
    oscManager.handleOSCMessage(message);
  };
}

export default oscManager; 