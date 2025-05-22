// src/ui/synthUI.js
import { setEnvelope, setBrightness, setMasterVolume } from '../audio/audio.js';

/**
 * Setup synth UI controls and connect them to the audio engine
 * @param {GlobalStateManager} globalState - Global state object containing synth parameters
 * @param {function} syncCallback - Callback to sync state across systems
 * @returns {Object} References to UI elements
 */
export function setupSynthUI(globalState, syncCallback) {
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

  // Initialize values from global state
  if (globalState.attack !== undefined) {
    attackRange.value = globalState.attack;
    attackNumber.value = globalState.attack;
    attackValue.textContent = globalState.attack.toFixed(2);
  }

  if (globalState.decay !== undefined) {
    decayRange.value = globalState.decay;
    decayNumber.value = globalState.decay;
    decayValue.textContent = globalState.decay.toFixed(2);
  }

  if (globalState.sustain !== undefined) {
    sustainRange.value = globalState.sustain;
    sustainNumber.value = globalState.sustain;
    sustainValue.textContent = globalState.sustain.toFixed(2);
  }

  if (globalState.release !== undefined) {
    releaseRange.value = globalState.release;
    releaseNumber.value = globalState.release;
    releaseValue.textContent = globalState.release.toFixed(2);
  }

  if (globalState.brightness !== undefined) {
    brightnessRange.value = globalState.brightness;
    brightnessNumber.value = globalState.brightness;
    brightnessValue.textContent = globalState.brightness.toFixed(2);
  }

  if (globalState.volume !== undefined) {
    volumeRange.value = globalState.volume;
    volumeNumber.value = globalState.volume;
    volumeValue.textContent = globalState.volume.toFixed(2);
  }

  // Helper function to sync a pair of range and number inputs
  const syncPair = (rangeEl, numEl, spanEl, setter, callback) => {
    rangeEl.addEventListener('input', e => {
      const value = parseFloat(e.target.value);
      spanEl.textContent = value.toFixed(2);
      numEl.value = value;
      
      // Update global state
      if (setter) {
        setter(value);
      }
      
      // Call callback if provided
      if (callback) {
        callback(value);
      }
      
      // Sync across systems
      if (syncCallback) {
        syncCallback();
      }
    });
    
    numEl.addEventListener('input', e => {
      const value = parseFloat(e.target.value);
      spanEl.textContent = value.toFixed(2);
      rangeEl.value = value;
      
      // Update global state
      if (setter) {
        setter(value);
      }
      
      // Call callback if provided
      if (callback) {
        callback(value);
      }
      
      // Sync across systems
      if (syncCallback) {
        syncCallback();
      }
    });
  };

  // Connect the ADSR controls to both global state and audio engine
  syncPair(attackRange, attackNumber, attackValue, 
    value => globalState.setAttack(value),
    value => setEnvelope(value, globalState.decay, globalState.sustain, globalState.release));

  syncPair(decayRange, decayNumber, decayValue, 
    value => globalState.setDecay(value),
    value => setEnvelope(globalState.attack, value, globalState.sustain, globalState.release));

  syncPair(sustainRange, sustainNumber, sustainValue, 
    value => globalState.setSustain(value),
    value => setEnvelope(globalState.attack, globalState.decay, value, globalState.release));

  syncPair(releaseRange, releaseNumber, releaseValue, 
    value => globalState.setRelease(value),
    value => setEnvelope(globalState.attack, globalState.decay, globalState.sustain, value));

  syncPair(brightnessRange, brightnessNumber, brightnessValue, 
    value => globalState.setBrightness(value),
    value => setBrightness(value));

  syncPair(volumeRange, volumeNumber, volumeValue, 
    value => globalState.setVolume(value),
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