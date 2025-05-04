// src/ui/synthUI.js
import { setEnvelope, setBrightness, setMasterVolume } from '../audio/audio.js';

/**
 * Setup synth UI controls and connect them to the audio engine
 * @param {Object} state - Application state object
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

  // Initialize values from state
  if (state.attack !== undefined) {
    attackRange.value = state.attack;
    attackNumber.value = state.attack;
    attackValue.textContent = state.attack;
  }

  if (state.decay !== undefined) {
    decayRange.value = state.decay;
    decayNumber.value = state.decay;
    decayValue.textContent = state.decay;
  }

  if (state.sustain !== undefined) {
    sustainRange.value = state.sustain;
    sustainNumber.value = state.sustain;
    sustainValue.textContent = state.sustain;
  }

  if (state.release !== undefined) {
    releaseRange.value = state.release;
    releaseNumber.value = state.release;
    releaseValue.textContent = state.release;
  }

  if (state.brightness !== undefined) {
    brightnessRange.value = state.brightness;
    brightnessNumber.value = state.brightness;
    brightnessValue.textContent = state.brightness;
  }

  if (state.volume !== undefined) {
    volumeRange.value = state.volume;
    volumeNumber.value = state.volume;
    volumeValue.textContent = state.volume;
  }

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