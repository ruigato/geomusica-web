// src/state/GlobalStateManager.js - Manages global state parameters across all layers
import { DEFAULT_VALUES } from '../config/constants.js';

/**
 * GlobalStateManager class to handle state parameters that should be shared across all layers
 * This includes global timing, audio settings, etc.
 */
export class GlobalStateManager {
  constructor() {
    // Global timing parameters
    this.bpm = DEFAULT_VALUES.BPM;
    this.lastTime = performance.now();
    this.lastAngle = 0;
    
    // Audio engine parameters
    this.attack = 0.01;
    this.decay = 0.3;
    this.sustain = 0.5;
    this.release = 1.0;
    this.brightness = 1.0;
    this.volume = 0.8;
    
    // Time subdivision settings
    this.useTimeSubdivision = DEFAULT_VALUES.USE_TIME_SUBDIVISION;
    this.timeSubdivisionValue = DEFAULT_VALUES.TIME_SUBDIVISION_VALUE;
    
    // Quantization settings
    this.useQuantization = DEFAULT_VALUES.USE_QUANTIZATION;
    this.quantizationValue = DEFAULT_VALUES.QUANTIZATION_VALUE;
    
    // Equal temperament settings
    this.useEqualTemperament = DEFAULT_VALUES.USE_EQUAL_TEMPERAMENT;
    this.referenceFrequency = DEFAULT_VALUES.REFERENCE_FREQ;
    
    // Parameter change tracking
    this.parameterChanges = {
      bpm: false,
      attack: false,
      decay: false,
      sustain: false,
      release: false,
      brightness: false,
      volume: false,
      timeSubdivision: false,
      useTimeSubdivision: false,
      quantization: false,
      useQuantization: false,
      useEqualTemperament: false,
      referenceFrequency: false
    };
  }
  
  /**
   * Set BPM (global tempo)
   * @param {number} value New BPM value
   */
  setBpm(value) {
    const newValue = Number(value);
    if (this.bpm !== newValue) {
      this.bpm = newValue;
      this.parameterChanges.bpm = true;
      console.log(`[GLOBAL] BPM changed to ${newValue}`);
    }
  }
  
  /**
   * Set time subdivision value
   * @param {number} value New time subdivision value
   */
  setTimeSubdivisionValue(value) {
    const newValue = Number(value);
    if (this.timeSubdivisionValue !== newValue) {
      this.timeSubdivisionValue = newValue;
      this.parameterChanges.timeSubdivision = true;
      console.log(`[GLOBAL] Time subdivision changed to ${newValue}`);
    }
  }
  
  /**
   * Toggle time subdivision
   * @param {boolean} value Enable/disable time subdivision
   */
  setUseTimeSubdivision(value) {
    const newValue = Boolean(value);
    if (this.useTimeSubdivision !== newValue) {
      this.useTimeSubdivision = newValue;
      this.parameterChanges.useTimeSubdivision = true;
      console.log(`[GLOBAL] Time subdivision ${newValue ? 'enabled' : 'disabled'}`);
    }
  }
  
  /**
   * Set quantization value
   * @param {string} value New quantization value
   */
  setQuantizationValue(value) {
    if (this.quantizationValue !== value) {
      this.quantizationValue = value;
      this.parameterChanges.quantization = true;
      console.log(`[GLOBAL] Quantization changed to ${value}`);
    }
  }
  
  /**
   * Toggle quantization
   * @param {boolean} value Enable/disable quantization
   */
  setUseQuantization(value) {
    const newValue = Boolean(value);
    if (this.useQuantization !== newValue) {
      this.useQuantization = newValue;
      this.parameterChanges.useQuantization = true;
      console.log(`[GLOBAL] Quantization ${newValue ? 'enabled' : 'disabled'}`);
    }
  }
  
  /**
   * Toggle equal temperament
   * @param {boolean} value Enable/disable equal temperament
   */
  setUseEqualTemperament(value) {
    const newValue = Boolean(value);
    if (this.useEqualTemperament !== newValue) {
      this.useEqualTemperament = newValue;
      this.parameterChanges.useEqualTemperament = true;
      console.log(`[GLOBAL] Equal temperament ${newValue ? 'enabled' : 'disabled'}`);
    }
  }
  
  /**
   * Set reference frequency
   * @param {number} value New reference frequency
   */
  setReferenceFrequency(value) {
    const newValue = Number(value);
    if (this.referenceFrequency !== newValue) {
      this.referenceFrequency = newValue;
      this.parameterChanges.referenceFrequency = true;
      console.log(`[GLOBAL] Reference frequency changed to ${newValue}`);
    }
  }
  
  /**
   * Set attack time
   * @param {number} value New attack time
   */
  setAttack(value) {
    const newValue = Number(value);
    if (this.attack !== newValue) {
      this.attack = newValue;
      this.parameterChanges.attack = true;
      console.log(`[GLOBAL] Attack changed to ${newValue}`);
    }
  }
  
  /**
   * Set decay time
   * @param {number} value New decay time
   */
  setDecay(value) {
    const newValue = Number(value);
    if (this.decay !== newValue) {
      this.decay = newValue;
      this.parameterChanges.decay = true;
      console.log(`[GLOBAL] Decay changed to ${newValue}`);
    }
  }
  
  /**
   * Set sustain level
   * @param {number} value New sustain level
   */
  setSustain(value) {
    const newValue = Number(value);
    if (this.sustain !== newValue) {
      this.sustain = newValue;
      this.parameterChanges.sustain = true;
      console.log(`[GLOBAL] Sustain changed to ${newValue}`);
    }
  }
  
  /**
   * Set release time
   * @param {number} value New release time
   */
  setRelease(value) {
    const newValue = Number(value);
    if (this.release !== newValue) {
      this.release = newValue;
      this.parameterChanges.release = true;
      console.log(`[GLOBAL] Release changed to ${newValue}`);
    }
  }
  
  /**
   * Set brightness
   * @param {number} value New brightness value
   */
  setBrightness(value) {
    const newValue = Number(value);
    if (this.brightness !== newValue) {
      this.brightness = newValue;
      this.parameterChanges.brightness = true;
      console.log(`[GLOBAL] Brightness changed to ${newValue}`);
    }
  }
  
  /**
   * Set volume
   * @param {number} value New volume value
   */
  setVolume(value) {
    const newValue = Number(value);
    if (this.volume !== newValue) {
      this.volume = newValue;
      this.parameterChanges.volume = true;
      console.log(`[GLOBAL] Volume changed to ${newValue}`);
    }
  }
  
  /**
   * Check if any parameters have changed
   * @returns {boolean} True if any parameters changed
   */
  hasParameterChanged() {
    return Object.values(this.parameterChanges).some(changed => changed);
  }
  
  /**
   * Reset all parameter change flags
   */
  resetParameterChanges() {
    for (const key in this.parameterChanges) {
      this.parameterChanges[key] = false;
    }
  }
  
  /**
   * Update angle for animation
   * @param {number} tNow Current time in ms
   * @returns {Object} Object with angle and lastAngle
   */
  updateAngle(tNow) {
    // If this is the first call, initialize lastTime
    if (!this.lastTime) {
      this.lastTime = tNow;
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    const dt = Math.min(tNow - this.lastTime, 100); // Cap delta time at 100ms
    
    // Skip tiny time steps (often happen during timing system initialization)
    if (dt < 1) {
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    // Get time in seconds
    const seconds = dt / 1000;
    
    // Adjust calculation to make 120 BPM = 0.5 rotation per second (1 rotation per 2 seconds)
    // Formula: rotationsPerSecond = BPM / 240
    // At 60 BPM: 60/240 = 0.25 rotations per second (1 rotation takes 4 seconds)
    // At 120 BPM: 120/240 = 0.5 rotations per second (1 rotation takes 2 seconds) 
    // At 240 BPM: 240/240 = 1 rotation per second (1 rotation takes 1 second)
    const rotationsPerSecond = this.bpm / 240;
    
    // Calculate degrees to rotate this frame
    const degreesPerSecond = rotationsPerSecond * 360;
    const angleDelta = degreesPerSecond * seconds;
    
    // Get the last angle and calculate the new angle
    const lastAngle = this.lastAngle;
    const angle = (lastAngle + angleDelta) % 360;
    
    // Debug logging periodically (about once every 5 seconds at 60fps)
    if (Math.random() < 0.003) { // ~0.3% chance each frame
      console.log(`[ROTATION] BPM: ${this.bpm}, Rotations/sec: ${rotationsPerSecond.toFixed(2)}, Degrees/sec: ${degreesPerSecond.toFixed(2)}, Delta: ${angleDelta.toFixed(2)}°`);
    }
    
    // Store for next frame
    this.lastAngle = angle;
    this.lastTime = tNow;
    
    return { angle, lastAngle };
  }
} 