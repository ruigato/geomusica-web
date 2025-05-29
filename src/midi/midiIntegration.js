// src/midi/midiIntegration.js - Integration between GeoMusica triggers and MIDI output
// Handles routing of triggered notes to appropriate MIDI channels based on layer

import { playMidiNote, getMidiStatus } from './midiOut.js';

/**
 * MIDI Integration Manager
 * Handles routing of geomusica notes to MIDI output with layer-aware channel mapping
 */
class MidiIntegrationManager {
  constructor() {
    this.isEnabled = false;
    this.originalAudioCallback = null;
    this.layerManager = null;
    
    // Statistics
    this.stats = {
      totalNotes: 0,
      layerNotes: 0,
      layerLinkNotes: 0,
      errors: 0
    };
  }
  
  /**
   * Initialize MIDI integration with the existing audio system
   * @param {Function} originalAudioCallback - Original audio trigger callback
   * @param {Object} layerManager - Layer manager instance
   */
  initialize(originalAudioCallback, layerManager) {
    this.originalAudioCallback = originalAudioCallback;
    this.layerManager = layerManager;
  }
  
  /**
   * Enable MIDI integration
   * This will route notes to both audio and MIDI output
   */
  enable() {
    this.isEnabled = true;
  }
  
  /**
   * Disable MIDI integration
   * Notes will only go to audio output
   */
  disable() {
    this.isEnabled = false;
  }
  
  /**
   * Enhanced audio callback that routes to both audio and MIDI
   * @param {Object} note - Note object from trigger system
   * @returns {Object} The processed note
   */
  enhancedAudioCallback(note) {
    try {
      // Always call original audio callback first
      let processedNote = note;
      if (this.originalAudioCallback) {
        processedNote = this.originalAudioCallback(note) || note;
      }
      
      // Route to MIDI if enabled and MIDI is available
      if (this.isEnabled && this.shouldRouteMidiNote(processedNote)) {
        this.routeNoteToMidi(processedNote);
      }
      
      this.stats.totalNotes++;
      return processedNote;
      
    } catch (error) {
      this.stats.errors++;
      return note;
    }
  }
  
  /**
   * Determine if a note should be routed to MIDI
   * @param {Object} note - Note object
   * @returns {boolean} Whether to route to MIDI
   */
  shouldRouteMidiNote(note) {
    const midiStatus = getMidiStatus();
    
    // Check if MIDI is available and enabled
    if (!midiStatus.isEnabled || !midiStatus.deviceName) {
      return false;
    }
    
    // Check if note has required properties
    if (!note || typeof note.frequency !== 'number' || note.frequency <= 0) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Route a note to the appropriate MIDI channel
   * @param {Object} note - Note object to route
   */
  routeNoteToMidi(note) {
    try {
      // Determine if this is a layer link trigger
      const isLayerLink = this.isLayerLinkNote(note);
      
      // Get layer ID for channel mapping
      let layerId = this.getLayerIdFromNote(note);
      
      // Route to MIDI with appropriate channel mapping
      playMidiNote(note, layerId, isLayerLink);
      
      // Update statistics
      if (isLayerLink) {
        this.stats.layerLinkNotes++;
      } else {
        this.stats.layerNotes++;
      }
      
    } catch (error) {
      this.stats.errors++;
    }
  }
  
  /**
   * Determine if a note is from a layer link trigger
   * @param {Object} note - Note object
   * @returns {boolean} Whether this is a layer link note
   */
  isLayerLinkNote(note) {
    // Check for layer link specific properties
    if (note.isLinkTrigger || note.linkIndex !== undefined) {
      return true;
    }
    
    // Check if the note came from layer link manager
    if (note.source === 'layerlink' || note.type === 'layerlink') {
      return true;
    }
    
    // Check for special copy index that indicates layer link
    if (note.copyIndex === -1 && note.isIntersection === false) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Extract layer ID from note object
   * @param {Object} note - Note object
   * @returns {number} Layer ID (0-based)
   */
  getLayerIdFromNote(note) {
    // Direct layer ID property
    if (typeof note.layerId === 'number') {
      return note.layerId;
    }
    
    // Try to get from layer manager if available
    if (this.layerManager) {
      // If no specific layer ID, use active layer
      const activeLayer = this.layerManager.getActiveLayer();
      if (activeLayer) {
        return activeLayer.id;
      }
    }
    
    // Fallback to layer 0
    return 0;
  }
  
  /**
   * Get integration statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return {
      ...this.stats,
      isEnabled: this.isEnabled,
      hasOriginalCallback: !!this.originalAudioCallback,
      hasLayerManager: !!this.layerManager
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalNotes: 0,
      layerNotes: 0,
      layerLinkNotes: 0,
      errors: 0
    };
  }
}

// Create singleton instance
const midiIntegrationManager = new MidiIntegrationManager();

/**
 * Initialize MIDI integration with the existing system
 * @param {Function} originalAudioCallback - Original audio callback
 * @param {Object} layerManager - Layer manager instance
 */
export function initializeMidiIntegration(originalAudioCallback, layerManager) {
  midiIntegrationManager.initialize(originalAudioCallback, layerManager);
}

/**
 * Get the enhanced audio callback that routes to both audio and MIDI
 * @returns {Function} Enhanced callback function
 */
export function getEnhancedAudioCallback() {
  return (note) => midiIntegrationManager.enhancedAudioCallback(note);
}

/**
 * Enable MIDI integration
 */
export function enableMidiIntegration() {
  midiIntegrationManager.enable();
}

/**
 * Disable MIDI integration
 */
export function disableMidiIntegration() {
  midiIntegrationManager.disable();
}

/**
 * Check if MIDI integration is enabled
 * @returns {boolean} Integration status
 */
export function isMidiIntegrationEnabled() {
  return midiIntegrationManager.isEnabled;
}

/**
 * Get MIDI integration statistics
 * @returns {Object} Statistics
 */
export function getMidiIntegrationStats() {
  return midiIntegrationManager.getStats();
}

/**
 * Reset MIDI integration statistics
 */
export function resetMidiIntegrationStats() {
  midiIntegrationManager.resetStats();
}

/**
 * Helper function to patch the existing trigger system
 * This should be called during application initialization
 * @param {Object} options - Configuration options
 */
export function patchTriggerSystem(options = {}) {
  const { 
    layerManager = window._layers,
    globalState = window._globalState 
  } = options;
  
  if (!layerManager) {
    return false;
  }
  
  // Initialize integration
  initializeMidiIntegration(null, layerManager);
  
  // Patch the animation system to use enhanced callback
  if (typeof window.patchAnimationForMidi === 'function') {
    window.patchAnimationForMidi(getEnhancedAudioCallback());
  } else {
    // Store enhanced callback globally for manual integration
    window.enhancedAudioCallback = getEnhancedAudioCallback();
  }
  
  return true;
}

/**
 * Create a wrapper for the original triggerAudio function
 * @param {Function} originalTriggerAudio - Original trigger audio function
 * @returns {Function} Enhanced trigger audio function
 */
export function createEnhancedTriggerAudio(originalTriggerAudio) {
  return function enhancedTriggerAudio(note) {
    try {
      // Call original function
      const result = originalTriggerAudio(note);
      
      // Route to MIDI if integration is enabled
      if (midiIntegrationManager.isEnabled && midiIntegrationManager.shouldRouteMidiNote(note)) {
        midiIntegrationManager.routeNoteToMidi(note);
      }
      
      return result;
    } catch (error) {
      return originalTriggerAudio(note);
    }
  };
}

// Make available globally for debugging and manual integration
if (typeof window !== 'undefined') {
  window.midiIntegrationManager = midiIntegrationManager;
  window.initializeMidiIntegration = initializeMidiIntegration;
  window.getEnhancedAudioCallback = getEnhancedAudioCallback;
  window.enableMidiIntegration = enableMidiIntegration;
  window.disableMidiIntegration = disableMidiIntegration;
  window.getMidiIntegrationStats = getMidiIntegrationStats;
  window.patchTriggerSystem = patchTriggerSystem;
  window.createEnhancedTriggerAudio = createEnhancedTriggerAudio;
}

export default midiIntegrationManager; 