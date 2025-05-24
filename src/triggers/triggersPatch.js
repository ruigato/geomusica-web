// src/triggers/triggersPatch.js - Patch to integrate temporal trigger engine with existing system
import { detectTemporalLayerTriggers, resetTemporalEngine } from './temporalTriggerIntegration.js';

// Try to import from triggers.js, but provide fallbacks if it fails
let originalDetectLayerTriggers;
let originalResetTriggerSystem;

try {
  const triggersModule = await import('./triggers.js');
  originalDetectLayerTriggers = triggersModule.detectLayerTriggers;
  originalResetTriggerSystem = triggersModule.resetTriggerSystem;
  
} catch (e) {
  
  // Mock implementations for demo
  originalDetectLayerTriggers = (layer, tNow, audioCallback) => {
    
    return false;
  };
  originalResetTriggerSystem = () => {
    
  };
}

// Log that this module loaded

// Feature flag to enable/disable temporal trigger detection
let useTemporalTriggers = false;

/**
 * Enable or disable temporal trigger detection
 * @param {boolean} enabled - Whether to enable temporal triggers
 */
export function setTemporalTriggersEnabled(enabled) {
  useTemporalTriggers = enabled;
  
}

/**
 * Check if temporal triggers are enabled
 * @returns {boolean} Whether temporal triggers are enabled
 */
export function isTemporalTriggersEnabled() {
  return useTemporalTriggers;
}

/**
 * Enhanced trigger detection function that can use either the original or temporal engine
 * @param {Object} layer - Layer to detect triggers for
 * @param {number} tNow - Current time
 * @param {Function} audioCallback - Callback function for triggered audio
 * @returns {boolean} True if any triggers were detected
 */
export function detectLayerTriggers(layer, tNow, audioCallback) {
  // Use temporal engine if enabled
  if (useTemporalTriggers) {
    return detectTemporalLayerTriggers(layer, tNow, audioCallback);
  }
  
  // Otherwise use original engine
  return originalDetectLayerTriggers(layer, tNow, audioCallback);
}

/**
 * Reset the trigger system, affecting both original and temporal engines
 */
export function resetTriggerSystem() {
  // Reset original system
  originalResetTriggerSystem();
  
  // Reset temporal engine if enabled
  if (useTemporalTriggers) {
    resetTemporalEngine();
  }
}

/**
 * Options for the temporal trigger engine
 * @param {Object} options - Engine configuration options
 */
export function configureTemporalEngine(options = {}) {
  if (options.enabled !== undefined) {
    setTemporalTriggersEnabled(options.enabled);
  }
  
  // Additional configuration can be passed to the temporal engine here
} 