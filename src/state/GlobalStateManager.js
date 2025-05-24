// src/state/GlobalStateManager.js - Manages global state parameters across all layers
import { DEFAULT_VALUES } from '../config/constants.js';

// Debug flag to control logging frequency
const DEBUG_LOGGING = false; // Set to true to enable verbose rotation logging

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
   * @returns {Object} Object with angle and lastAngle in DEGREES
   */
  updateAngle(tNow) {
    // Initialize totalAccumulatedAngle if it doesn't exist
    // This tracks the absolute angle without applying % 360
    if (this.totalAccumulatedAngle === undefined) {
      this.totalAccumulatedAngle = 0;
    }
    
    // If this is the first call, initialize lastTime
    if (!this.lastTime) {
      this.lastTime = tNow;
      console.log(`[ROTATION] Initializing rotation timing system at t=${tNow.toFixed(3)}`);
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    // Calculate time delta in seconds (tNow is already in seconds)
    let dt = tNow - this.lastTime;
    
    // CRITICAL DEBUG: Calculate and track the actual rotation rate
    if (typeof window.__rotationRateHistory === 'undefined') {
      window.__rotationRateHistory = [];
      window.__lastLoggedRotationRate = 0;
    }
    
    // Handle time discontinuities (like timer resets or app restarts)
    // This happens when the time jumps backward significantly
    if (dt < -0.1) { // If time jumps backward by more than 100ms
      // Instead of just showing a warning, provide more context and recovery info
      const timeJumpMinutes = Math.abs(dt) / 60;
      console.warn(`[ROTATION] Time discontinuity detected: ${dt.toFixed(3)}s jump (${timeJumpMinutes.toFixed(1)} minutes).`);
      console.log(`[ROTATION] This is normal during development or if the tab was inactive. Resetting timing system.`);
      
      // Set lastTime without resetting angle - this maintains rotation position but resets timing
      this.lastTime = tNow;
      
      // Track discontinuity count for debugging
      this._discontinuityCount = (this._discontinuityCount || 0) + 1;
      
      // Add more robust debug info to understand what's happening
      if (this._discontinuityCount > 1) {
        console.log(`[ROTATION] Total discontinuities detected: ${this._discontinuityCount}`);
      }
      
      // Return current angle without changes to prevent visual jumps
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    // Handle unreasonably large time jumps (browser tab inactive, etc.)
    if (dt > 1.0) { // Cap at 1 second
      console.warn(`[ROTATION] Large time jump detected: ${dt.toFixed(3)}s. Capping at 0.033s.`);
      dt = 0.033; // Cap at a reasonable frame time (30fps)
    }
    
    // Calculate rotations per second based on BPM (60 BPM = 1 rotation per second)
    // This is the critical piece for converting BPM to rotation speed
    // BPM / 60 gives rotations per second
    const BPM_TO_ROTATION_MULTIPLIER = 1.0; // Adjust this if needed to get the desired rotation speed
    
    // CRITICAL FIX: Ensure BPM is never zero or negative to prevent rotation from stopping
    const effectiveBPM = Math.max(1, this.bpm); // Minimum BPM of 1
    const rotationsPerSecond = (effectiveBPM / 60) * BPM_TO_ROTATION_MULTIPLIER;
    
    // Track rotation rate history
    window.__rotationRateHistory.push(rotationsPerSecond);
    if (window.__rotationRateHistory.length > 10) {
      window.__rotationRateHistory.shift();
    }
    
    // Calculate angle delta in DEGREES based on rotation speed and time delta
    // For a full 360° rotation: 360 * rotationsPerSecond * dt
    const angleDelta = 360 * rotationsPerSecond * dt;
    
    // CRITICAL DEBUG: Log rotation rate changes
    if (Math.abs(rotationsPerSecond - window.__lastLoggedRotationRate) > 0.001 || Math.random() < 0.02) {
      window.__lastLoggedRotationRate = rotationsPerSecond;
      console.log(`[ROTATION CRITICAL] BPM=${this.bpm}, Rotation rate=${rotationsPerSecond.toFixed(4)} rotations/sec`);
      console.log(`[ROTATION CRITICAL] dt=${(dt*1000).toFixed(1)}ms, expected angle delta=${angleDelta.toFixed(4)}°`);
      console.log(`[ROTATION CRITICAL] Current total angle=${((this.lastAngle + angleDelta) % 360).toFixed(2)}°`);
    }
    
    // CRITICAL FIX: Update total accumulated angle WITHOUT modulo
    this.totalAccumulatedAngle += angleDelta;
    
    // Increment the last angle and keep it in the range [0, 360)
    // This is for display and the actual rotation value
    this.lastAngle = (this.lastAngle + angleDelta) % 360;
    if (this.lastAngle < 0) this.lastAngle += 360; // Handle negative angles
    
    // Store current time for next frame's delta calculation
    this.lastTime = tNow;
    
    // Track true rotation count (full 360° rotations)
    this.rotationCount = Math.floor(this.totalAccumulatedAngle / 360);
    
    // Debug logging
    if (DEBUG_LOGGING) {
      console.log(`[ROTATION] dt: ${(dt*1000).toFixed(3)}ms, BPM: ${this.bpm}, Rotations/sec: ${rotationsPerSecond.toFixed(2)}, Angle Delta: ${angleDelta.toFixed(2)}°, Current Angle: ${this.lastAngle.toFixed(2)}°`);
    }
    
    // Return both the current and previous angle values
    return { angle: this.lastAngle, lastAngle: this.lastAngle - angleDelta };
  }
  
  /**
   * Handle time reset event from the timing system
   * This ensures the rotation system doesn't experience a discontinuity
   * when the time is reset
   * 
   * @param {number} previousTime The time before reset
   */
  handleTimeReset(previousTime) {
    console.log(`[ROTATION] Handling time reset from timing system. Previous time: ${previousTime.toFixed(3)}s`);
    
    // CRITICAL FIX: Store the current lastAngle to maintain rotation position
    const preservedAngle = this.lastAngle;
    
    // Reset our lastTime while maintaining continuity
    // Instead of resetting to 0, we'll use the previousTime value which 
    // represents how much time had elapsed before the reset
    this.lastTime = previousTime;
    
    // Log the angle state for debugging
    console.log(`[ROTATION] Rotation angle preserved at ${preservedAngle.toFixed(2)}° after time reset`);
    
    // Track reset count for debugging
    this._timeResetCount = (this._timeResetCount || 0) + 1;
    console.log(`[ROTATION] Total time resets handled: ${this._timeResetCount}`);
    
    // Dispatch an event about the rotation state for debugging
    try {
      const event = new CustomEvent('rotationStatePreserved', { 
        detail: { 
          angle: preservedAngle,
          timeReset: this._timeResetCount 
        } 
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('[ROTATION] Failed to dispatch rotationStatePreserved event:', error);
    }
    
    // Return current angle state
    return { angle: preservedAngle, lastAngle: preservedAngle };
  }
} 