// src/midi/index.js - Main MIDI module for GeoMusica
// Exports all MIDI functionality and provides integration interface

// Note: Using dynamic imports within functions to avoid circular dependencies
// and ensure proper module loading order

// Import managers for re-export
import midiOutManager from './midiOut.js';
import midiIntegrationManager from './midiIntegration.js';

/**
 * Complete MIDI system initialization for GeoMusica
 * Call this during application startup to set up all MIDI functionality
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Initialization result
 */
export async function initializeCompleteMidiSystem(options = {}) {
  const {
    uiContainer = document.body,
    layerManager = window._layers,
    globalState = window._globalState,
    originalAudioCallback = null,
    autoEnable = false
  } = options;
  
  console.log('[MIDI SYSTEM] Initializing complete MIDI system...');
  
  try {
    // Step 1: Initialize MIDI output
    const { initializeMidiOut } = await import('./midiOut.js');
    const midiInitialized = await initializeMidiOut();
    
    // Step 2: Setup MIDI UI
    let uiReferences = null;
    if (uiContainer) {
      const { setupMidiUI } = await import('./midiUI.js');
      uiReferences = setupMidiUI(uiContainer);
    }
    
    // Step 3: Initialize integration with trigger system
    const { initializeMidiIntegration, patchTriggerSystem } = await import('./midiIntegration.js');
    
    if (layerManager) {
      initializeMidiIntegration(originalAudioCallback, layerManager);
      patchTriggerSystem({ layerManager, globalState });
    }
    
    // Step 4: Auto-enable if requested
    if (autoEnable && midiInitialized) {
      const { selectMidiDevice } = await import('./midiOut.js');
      const { enableMidiIntegration } = await import('./midiIntegration.js');
      
      // Try to select first available device
      selectMidiDevice();
      enableMidiIntegration();
    }
    
    const result = {
      success: true,
      midiInitialized,
      uiSetup: !!uiReferences,
      integrationSetup: !!layerManager,
      autoEnabled: autoEnable && midiInitialized
    };
    
    console.log('[MIDI SYSTEM] Complete MIDI system initialized:', result);
    return result;
    
  } catch (error) {
    console.error('[MIDI SYSTEM] Error initializing complete MIDI system:', error);
    return {
      success: false,
      error: error.message,
      midiInitialized: false,
      uiSetup: false,
      integrationSetup: false,
      autoEnabled: false
    };
  }
}

/**
 * Get comprehensive MIDI system status
 * @returns {Promise<Object>} Complete system status
 */
export async function getCompleteMidiStatus() {
  try {
    const { getMidiStatus } = await import('./midiOut.js');
    const { getMidiIntegrationStats } = await import('./midiIntegration.js');
    
    return {
      output: getMidiStatus(),
      integration: getMidiIntegrationStats(),
      timestamp: Date.now()
    };
  } catch (error) {
    console.error('[MIDI SYSTEM] Error getting status:', error);
    return {
      output: null,
      integration: null,
      timestamp: Date.now(),
      error: error.message
    };
  }
}

/**
 * Quick setup function for basic MIDI output
 * Use this for simple MIDI output without full integration
 * @param {string} deviceId - Optional device ID to connect to
 * @returns {Promise<boolean>} Success status
 */
export async function quickMidiSetup(deviceId = null) {
  try {
    const { initializeMidiOut, selectMidiDevice } = await import('./midiOut.js');
    const initialized = await initializeMidiOut();
    if (!initialized) return false;
    
    return selectMidiDevice(deviceId);
  } catch (error) {
    console.error('[MIDI SYSTEM] Quick setup failed:', error);
    return false;
  }
}

/**
 * Enhanced trigger audio function factory
 * Creates a drop-in replacement for existing triggerAudio functions
 * @param {Function} originalTriggerAudio - Original trigger audio function
 * @returns {Promise<Function>} Enhanced function with MIDI support
 */
export async function createMidiEnhancedTriggerAudio(originalTriggerAudio) {
  try {
    const { createEnhancedTriggerAudio } = await import('./midiIntegration.js');
    return createEnhancedTriggerAudio(originalTriggerAudio);
  } catch (error) {
    console.error('[MIDI SYSTEM] Error creating enhanced trigger audio:', error);
    return originalTriggerAudio; // Fallback to original function
  }
}

/**
 * Utility function to test MIDI output
 * Plays a test note on the specified channel
 * @param {number} channel - MIDI channel (1-16)
 * @param {number} frequency - Test frequency (default: 440Hz)
 * @param {number} duration - Test duration in seconds (default: 1s)
 */
export async function testMidiOutput(channel = 1, frequency = 440, duration = 1) {
  try {
    const { playMidiNote } = await import('./midiOut.js');
    
    const testNote = {
      frequency,
      velocity: 0.7,
      duration,
      pan: 0
    };
    
    // Calculate layer ID from channel (channel 1-15 = layer 0-14, channel 16 = layerlink)
    const layerId = channel === 16 ? 0 : channel - 1;
    const isLayerLink = channel === 16;
    
    playMidiNote(testNote, layerId, isLayerLink);
    console.log(`[MIDI SYSTEM] Test note: ${frequency}Hz on channel ${channel} for ${duration}s`);
  } catch (error) {
    console.error('[MIDI SYSTEM] Error testing MIDI output:', error);
  }
}

/**
 * Emergency stop function
 * Stops all MIDI notes and disconnects
 */
export async function emergencyMidiStop() {
  try {
    const { stopAllMidiNotes, disconnectMidi } = await import('./midiOut.js');
    stopAllMidiNotes();
    disconnectMidi();
    console.log('[MIDI SYSTEM] Emergency stop executed');
  } catch (error) {
    console.error('[MIDI SYSTEM] Error during emergency stop:', error);
  }
}

// Re-export managers for advanced usage
export { midiOutManager, midiIntegrationManager };

// Individual export functions to replace static exports
export async function initializeMidiOut() {
  const { initializeMidiOut } = await import('./midiOut.js');
  return initializeMidiOut();
}

export async function getMidiDevices() {
  const { getMidiDevices } = await import('./midiOut.js');
  return getMidiDevices();
}

export async function selectMidiDevice(deviceId = null) {
  const { selectMidiDevice } = await import('./midiOut.js');
  return selectMidiDevice(deviceId);
}

export async function playMidiNote(note, layerId = 0, isLayerLink = false) {
  const { playMidiNote } = await import('./midiOut.js');
  return playMidiNote(note, layerId, isLayerLink);
}

export async function stopAllMidiNotes() {
  const { stopAllMidiNotes } = await import('./midiOut.js');
  return stopAllMidiNotes();
}

export async function setMidiMicrotonalMode(enabled) {
  const { setMidiMicrotonalMode } = await import('./midiOut.js');
  return setMidiMicrotonalMode(enabled);
}

export async function setMidiMTSMode(enabled) {
  const { setMidiMTSMode } = await import('./midiOut.js');
  return setMidiMTSMode(enabled);
}

export async function setMidiPitchBendRange(semitones) {
  const { setMidiPitchBendRange } = await import('./midiOut.js');
  return setMidiPitchBendRange(semitones);
}

export async function getMidiStatus() {
  const { getMidiStatus } = await import('./midiOut.js');
  return getMidiStatus();
}

export async function setMidiDebugMode(enabled) {
  const { setMidiDebugMode } = await import('./midiOut.js');
  return setMidiDebugMode(enabled);
}

export async function disconnectMidi() {
  const { disconnectMidi } = await import('./midiOut.js');
  return disconnectMidi();
}

export async function setupMidiUI(uiContainer) {
  const { setupMidiUI } = await import('./midiUI.js');
  return setupMidiUI(uiContainer);
}

export async function initializeMidiIntegration(originalAudioCallback, layerManager) {
  const { initializeMidiIntegration } = await import('./midiIntegration.js');
  return initializeMidiIntegration(originalAudioCallback, layerManager);
}

export async function getEnhancedAudioCallback() {
  const { getEnhancedAudioCallback } = await import('./midiIntegration.js');
  return getEnhancedAudioCallback();
}

export async function enableMidiIntegration() {
  const { enableMidiIntegration } = await import('./midiIntegration.js');
  return enableMidiIntegration();
}

export async function disableMidiIntegration() {
  const { disableMidiIntegration } = await import('./midiIntegration.js');
  return disableMidiIntegration();
}

export async function isMidiIntegrationEnabled() {
  const { isMidiIntegrationEnabled } = await import('./midiIntegration.js');
  return isMidiIntegrationEnabled();
}

export async function getMidiIntegrationStats() {
  const { getMidiIntegrationStats } = await import('./midiIntegration.js');
  return getMidiIntegrationStats();
}

export async function resetMidiIntegrationStats() {
  const { resetMidiIntegrationStats } = await import('./midiIntegration.js');
  return resetMidiIntegrationStats();
}

export async function patchTriggerSystem(options) {
  const { patchTriggerSystem } = await import('./midiIntegration.js');
  return patchTriggerSystem(options);
}

export async function createEnhancedTriggerAudio(originalTriggerAudio) {
  const { createEnhancedTriggerAudio } = await import('./midiIntegration.js');
  return createEnhancedTriggerAudio(originalTriggerAudio);
}

// Make main functions available globally for debugging
if (typeof window !== 'undefined') {
  window.initializeCompleteMidiSystem = initializeCompleteMidiSystem;
  window.getCompleteMidiStatus = getCompleteMidiStatus;
  window.quickMidiSetup = quickMidiSetup;
  window.testMidiOutput = testMidiOutput;
  window.emergencyMidiStop = emergencyMidiStop;
  
  // Add to global MIDI namespace
  if (!window.MIDI) {
    window.MIDI = {};
  }
  
  Object.assign(window.MIDI, {
    initialize: initializeCompleteMidiSystem,
    quickSetup: quickMidiSetup,
    getStatus: getCompleteMidiStatus,
    test: testMidiOutput,
    emergencyStop: emergencyMidiStop,
    managers: {
      output: midiOutManager,
      integration: midiIntegrationManager
    }
  });
}

// Default export for convenience
export default {
  initialize: initializeCompleteMidiSystem,
  quickSetup: quickMidiSetup,
  getStatus: getCompleteMidiStatus,
  test: testMidiOutput,
  emergencyStop: emergencyMidiStop
}; 