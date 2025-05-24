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
    this.attack = DEFAULT_VALUES.ATTACK;
    this.decay = DEFAULT_VALUES.DECAY;
    this.sustain = DEFAULT_VALUES.SUSTAIN;
    this.release = DEFAULT_VALUES.RELEASE;
    this.brightness = DEFAULT_VALUES.BRIGHTNESS;
    this.volume = DEFAULT_VALUES.VOLUME;
    
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
   * @param {number} tNow Current time in seconds from getCurrentTime()
   * @returns {Object} Object with angle and lastAngle
   */
  updateAngle(tNow) {
    // If this is the first call, initialize lastTime
    if (!this.lastTime) {
      this.lastTime = tNow;
      console.log(`[ROTATION] Initializing rotation timing system at t=${tNow.toFixed(3)}`);
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    // Calculate time delta in seconds (tNow is already in seconds)
    let dt = tNow - this.lastTime;
    
    // Handle time discontinuities (like timer resets or app restarts)
    // This happens when the time jumps backward significantly
    if (dt < -0.1) { // If time jumps backward by more than 100ms
      console.warn(`[ROTATION] Time discontinuity detected: negative dt=${dt.toFixed(3)}s (lastTime=${this.lastTime.toFixed(3)}, tNow=${tNow.toFixed(3)})`);
      console.log(`[ROTATION] Time system reset detected. Restarting rotation tracking.`);
      
      // Instead of just resetting lastTime, also adjust the rotation to be continuous
      // This ensures the visual rotation doesn't "jump" when time resets
      this.lastTime = tNow;
      
      // Just keep using the current angle without changes
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    // Handle exceptionally large positive jumps (like browser tab becoming active again)
    if (dt > 1.0) { // More than 1 second jump
      console.log(`[ROTATION] Large time jump detected: dt=${dt.toFixed(3)}s. Limiting to prevent visual jumps.`);
      // Limit the effective dt to prevent huge rotation jumps
      dt = 0.033; // Simulate a normal frame (about 30fps)
    }
    
    // Detect unusually large time steps which may indicate timing problems
    else if (dt > 0.050) { // 50ms in seconds
      console.log(`[ROTATION] Large time step detected: dt=${(dt*1000).toFixed(3)}ms (normal range is 1-33ms)`);
    }
    
    // Skip tiny time steps (less than 1ms = 0.001s)
    if (dt < 0.001) {
      if (Math.random() < 0.05) { // Log skipped frames occasionally
        console.log(`[DEBUG] Skipping tiny time step: ${(dt*1000).toFixed(6)}ms`);
      }
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    // dt is already in seconds, no need to convert
    const seconds = dt;
    
    // IMPORTANT: Framerate-independent calculation
    // Adjust calculation to make 120 BPM = 0.5 rotation per second (1 rotation per 2 seconds)
    // Formula: rotationsPerSecond = BPM / 240
    // At 60 BPM: 60/240 = 0.25 rotations per second (1 rotation takes 4 seconds)
    // At 120 BPM: 120/240 = 0.5 rotations per second (1 rotation takes 2 seconds) 
    // At 240 BPM: 240/240 = 1 rotation per second (1 rotation takes 1 second)
    const rotationsPerSecond = this.bpm / 240;
    
    // Calculate degrees to rotate this frame - multiplied by actual time elapsed
    const degreesPerSecond = rotationsPerSecond * 360;
    const angleDelta = degreesPerSecond * seconds;
    
    // Get the last angle and calculate the new angle
    const lastAngle = this.lastAngle;
    const angle = (lastAngle + angleDelta) % 360;
    
    // Debug logging more frequently (about once every 1-2 seconds at 60fps)
    if (Math.random() < 0.02) { // ~2% chance each frame
      console.log(`[ROTATION] dt: ${(dt*1000).toFixed(3)}ms, seconds: ${seconds.toFixed(5)}, BPM: ${this.bpm}, Rotations/sec: ${rotationsPerSecond.toFixed(2)}, Angle Delta: ${angleDelta.toFixed(2)}°`);
    }
    
    // Store for next frame
    this.lastAngle = angle;
    this.lastTime = tNow;
    
    return { angle, lastAngle };
  }
} 