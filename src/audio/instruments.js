// src/audio/instruments.js - Optimized version
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

// Frequency thresholds for instrument selection
const FREQ_THRESHOLDS = {
    LOW: 200,
    MID_LOW: 500,
    MID_HIGH: 800,
    HIGH: 1200
  };
  
  // Instrument name mappings
  const INSTRUMENT_NAME_MAP = {
    1: "Simple Oscillator",
    2: "FM Synthesis",
    3: "Additive Synthesis",
    4: "Plucked String",
    5: "Percussion",
    0: "Automatic"
  };
  
  // Get the appropriate instrument based on frequency
  export function getInstrumentForFrequency(frequency) {
    if (frequency < FREQ_THRESHOLDS.LOW) {
      return 1; // Low frequencies: simple oscillator
    } else if (frequency < FREQ_THRESHOLDS.MID_LOW) {
      return 2; // Mid-low frequencies: FM synthesis
    } else if (frequency < FREQ_THRESHOLDS.MID_HIGH) {
      return 3; // Mid-high frequencies: additive synthesis  
    } else if (frequency < FREQ_THRESHOLDS.HIGH) {
      return 4; // High frequencies: plucked string
    } else {
      return 5; // Very high frequencies: percussion
    }
  }
  
  // Get instrument by name
  export function getInstrumentByName(name) {
    const normalizedName = name.toLowerCase();
    
    if (normalizedName.includes('sine') || 
        normalizedName.includes('oscillator') || 
        normalizedName.includes('simple')) {
      return 1;
    }
    
    if (normalizedName.includes('fm') || 
        normalizedName.includes('frequency modulation')) {
      return 2;
    }
    
    if (normalizedName.includes('additive') || 
        normalizedName.includes('harmonic')) {
      return 3;
    }
    
    if (normalizedName.includes('pluck') || 
        normalizedName.includes('string')) {
      return 4;
    }
    
    if (normalizedName.includes('percussion') || 
        normalizedName.includes('noise') || 
        normalizedName.includes('perc')) {
      return 5;
    }
    
    // Default: Automatic selection
    return 0;
  }
  
  // Get instrument name from ID
  export function getInstrumentName(id) {
    return INSTRUMENT_NAME_MAP[id] || "Unknown";
  }
  
  // Set instrument in Csound
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
    
    // Add instrument-specific parameters
    switch (instrumentId) {
      case 2: // FM synthesis
        options.modRatio = options.modRatio || 2;
        break;
        
      case 3: // Additive synthesis
        options.brightness = options.brightness || 1;
        break;
    }
    
    return options;
  }