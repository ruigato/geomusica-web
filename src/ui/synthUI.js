// src/ui/synthUI.js
import { setEnvelope, setBrightness, setMasterVolume } from '../audio/audio.js';

/**
 * Setup synth UI controls and connect them to the audio engine
 * @param {Object} state - Application state object
 * @param {Object} csoundInstance - Csound instance
 * @returns {Object} References to UI elements
 */
export function setupSynthUI(state, csoundInstance) {
  // Get all ADSR UI elements
  const attackRange = document.getElementById('attackRange');
  const attackNumber = document.getElementById('attackNumber');
  const attackValue = document.getElementById('attackValue');

  const decayRange = document.getElementById('decayRange');
  const decayNumber = document.getElementById('decayNumber');
  const decayValue = document.getElementById('decayValue');

  const sustainRange = document.getElementById('sustainRange');
  const sustainNumber = document.getElementById('sustainNumber');
  const sustainValue = document.getElementById('sustainValue');

  const releaseRange = document.getElementById('releaseRange');
  const releaseNumber = document.getElementById('releaseNumber');
  const releaseValue = document.getElementById('releaseValue');

  const brightnessRange = document.getElementById('brightnessRange');
  const brightnessNumber = document.getElementById('brightnessNumber');
  const brightnessValue = document.getElementById('brightnessValue');

  const volumeRange = document.getElementById('volumeRange');
  const volumeNumber = document.getElementById('volumeNumber');
  const volumeValue = document.getElementById('volumeValue');

  // Ensure state is valid
  if (!state) {
    console.error('setupSynthUI: State object is undefined');
    return {};
  }

  // Set default values for synth parameters
  const defaults = {
    attack: 0.1,
    decay: 0.3,
    sustain: 0.7,
    release: 0.5,
    brightness: 0.5,
    volume: 0.7
  };

  // Log initial state for debugging
  console.log('SynthUI initial state:', { ...state });

  // Initialize state with defaults if they don't exist
  Object.entries(defaults).forEach(([key, defaultValue]) => {
    try {
      // Use nullish coalescing to ensure we have a value
      state[key] = state[key] ?? defaultValue;
      
      // If there's a setter, call it to ensure proper initialization
      const setterName = `set${key.charAt(0).toUpperCase() + key.slice(1)}`;
      if (typeof state[setterName] === 'function') {
        state[setterName](state[key]);
      }
    } catch (error) {
      console.error(`Error initializing ${key}:`, error);
      state[key] = defaultValue; // Ensure we have a valid value
    }
  });

  // Helper function to safely set UI values
  const safeSetValue = (rangeEl, numEl, spanEl, value, defaultValue) => {
    if (!rangeEl || !numEl || !spanEl) return;
    try {
      const safeValue = value !== undefined ? value : defaultValue;
      rangeEl.value = safeValue;
      numEl.value = safeValue;
      spanEl.textContent = safeValue.toFixed(2);
    } catch (error) {
      console.error(`Error setting UI value for ${rangeEl?.id || 'unknown'}:`, error);
    }
  };

  // Initialize UI elements with safe values
  safeSetValue(attackRange, attackNumber, attackValue, state.attack, defaults.attack);
  safeSetValue(decayRange, decayNumber, decayValue, state.decay, defaults.decay);
  safeSetValue(sustainRange, sustainNumber, sustainValue, state.sustain, defaults.sustain);
  safeSetValue(releaseRange, releaseNumber, releaseValue, state.release, defaults.release);
  safeSetValue(brightnessRange, brightnessNumber, brightnessValue, state.brightness, defaults.brightness);
  safeSetValue(volumeRange, volumeNumber, volumeValue, state.volume, defaults.volume);

  // Helper function to sync a pair of range and number inputs
  const syncPair = (rangeEl, numEl, spanEl, setter, callback) => {
    rangeEl.addEventListener('input', e => {
      const value = parseFloat(e.target.value);
      spanEl.textContent = value.toFixed(2);
      numEl.value = value;
      
      // Update state
      if (setter) {
        setter(value);
      }
      
      // Call callback if provided
      if (callback) {
        callback(value);
      }
    });
    
    numEl.addEventListener('input', e => {
      const value = parseFloat(e.target.value);
      spanEl.textContent = value.toFixed(2);
      rangeEl.value = value;
      
      // Update state
      if (setter) {
        setter(value);
      }
      
      // Call callback if provided
      if (callback) {
        callback(value);
      }
    });
  };

  // Add state update methods if they don't exist
  if (!state.setAttack) {
    state.setAttack = function(value) {
      this.attack = value;
    };
  }
  
  if (!state.setDecay) {
    state.setDecay = function(value) {
      this.decay = value;
    };
  }
  
  if (!state.setSustain) {
    state.setSustain = function(value) {
      this.sustain = value;
    };
  }
  
  if (!state.setRelease) {
    state.setRelease = function(value) {
      this.release = value;
    };
  }
  
  if (!state.setBrightness) {
    state.setBrightness = function(value) {
      this.brightness = value;
    };
  }
  
  if (!state.setVolume) {
    state.setVolume = function(value) {
      this.volume = value;
    };
  }

  // Connect the ADSR controls to both state and audio engine
  syncPair(attackRange, attackNumber, attackValue, 
    value => state.setAttack(value),
    value => setEnvelope(value, state.decay, state.sustain, state.release));

  syncPair(decayRange, decayNumber, decayValue, 
    value => state.setDecay(value),
    value => setEnvelope(state.attack, value, state.sustain, state.release));

  syncPair(sustainRange, sustainNumber, sustainValue, 
    value => state.setSustain(value),
    value => setEnvelope(state.attack, state.decay, value, state.release));

  syncPair(releaseRange, releaseNumber, releaseValue, 
    value => state.setRelease(value),
    value => setEnvelope(state.attack, state.decay, state.sustain, value));

  syncPair(brightnessRange, brightnessNumber, brightnessValue, 
    value => state.setBrightness(value),
    value => setBrightness(value));

  syncPair(volumeRange, volumeNumber, volumeValue, 
    value => state.setVolume(value),
    value => setMasterVolume(value));

  // Return references to UI elements
  return {
    attackRange, attackNumber, attackValue,
    decayRange, decayNumber, decayValue,
    sustainRange, sustainNumber, sustainValue,
    releaseRange, releaseNumber, releaseValue,
    brightnessRange, brightnessNumber, brightnessValue,
    volumeRange, volumeNumber, volumeValue
  };
}