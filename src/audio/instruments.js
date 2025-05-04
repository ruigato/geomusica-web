// src/audio/instruments.js
// This module provides functions for working with different Csound instruments

/**
 * Instrument IDs:
 * 1: Simple oscillator (low frequencies)
 * 2: FM synthesis (mid-low frequencies)  
 * 3: Additive synthesis (mid-high frequencies)
 * 4: Plucked string (high frequencies)
 * 5: Percussion (very high frequencies)
 * 0: Automatic selection based on frequency
 */

// Get the appropriate instrument based on frequency
export function getInstrumentForFrequency(frequency) {
    // Selection criteria based on frequency ranges
    if (frequency < 200) {
      return 1; // Low frequencies: simple oscillator
    } else if (frequency < 500) {
      return 2; // Mid-low frequencies: FM synthesis
    } else if (frequency < 800) {
      return 3; // Mid-high frequencies: additive synthesis  
    } else if (frequency < 1200) {
      return 4; // High frequencies: plucked string
    } else {
      return 5; // Very high frequencies: percussion
    }
  }
  
  // Get instrument by name
  export function getInstrumentByName(name) {
    switch (name.toLowerCase()) {
      case 'sine':
      case 'oscillator':
      case 'simple':
        return 1;
        
      case 'fm':
      case 'frequency modulation':
        return 2;
        
      case 'additive':
      case 'harmonic':
        return 3;
        
      case 'pluck':
      case 'string':
      case 'plucked':
        return 4;
        
      case 'percussion':
      case 'noise':
      case 'perc':
        return 5;
        
      case 'auto':
      case 'automatic':
      default:
        return 0; // Let the controller decide based on frequency
    }
  }
  
  // Get instrument name from ID
  export function getInstrumentName(id) {
    switch (id) {
      case 1: return "Simple Oscillator";
      case 2: return "FM Synthesis";
      case 3: return "Additive Synthesis";
      case 4: return "Plucked String";
      case 5: return "Percussion";
      case 0: 
      default: return "Automatic";
    }
  }
  
  // Set instrument channels if the Csound instance exists
  export async function setInstrument(csoundInstance, instrumentId) {
    if (!csoundInstance) return false;
    
    try {
      await csoundInstance.setControlChannel("instrument", instrumentId);
      return true;
    } catch (error) {
      console.error("Error setting instrument:", error);
      return false;
    }
  }
  
  // Get instrument-specific options for triggerAudio
  export function getInstrumentOptions(instrumentId, customOptions = {}) {
    // Start with custom options
    const options = { ...customOptions };
    
    // Set the instrument ID
    options.instrument = instrumentId;
    
    // Add any instrument-specific parameters
    switch (instrumentId) {
      case 2: // FM synthesis
        // Default modulator ratio if not specified
        if (!options.modRatio) options.modRatio = 2;
        break;
        
      case 3: // Additive synthesis
        // Default brightness if not specified
        if (!options.brightness) options.brightness = 1;
        break;
    }
    
    return options;
  }