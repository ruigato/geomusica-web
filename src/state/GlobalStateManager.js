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
    
    // FIXED: Centralized layer timing system
    this._layerTimingSystem = {
      // Base angle that all layers should refer to
      baseAngle: 0,
      // Layer-specific angle multipliers (for time subdivision)
      layerMultipliers: new Map(),
      // Last time the angles were updated
      lastUpdateTime: performance.now() / 1000,
      // Accumulated angles per layer (degrees)
      accumulatedAngles: new Map()
    };
    
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
   * FIXED: Get layer angle data, creating a consistent timing reference for all layers
   * @param {string} layerId Layer ID
   * @param {number} timeSubdivisionValue Time subdivision multiplier for this layer
   * @param {number} currentTime Current time in seconds
   * @returns {Object} Angle data for the layer
   */
  getLayerAngleData(layerId, timeSubdivisionValue, currentTime) {
    if (!this._layerTimingSystem) {
      this._layerTimingSystem = {
        baseAngle: this.lastAngle || 0,
        layerMultipliers: new Map(),
        lastUpdateTime: currentTime,
        accumulatedAngles: new Map()
      };
    }
    
    // Store the multiplier for this layer
    this._layerTimingSystem.layerMultipliers.set(layerId, timeSubdivisionValue || 1);
    
    // Calculate how much time has passed since the last update
    const elapsedTime = currentTime - this._layerTimingSystem.lastUpdateTime;
    
    // FIXED: Always update angles even if this is the first access for this layer
    // to maintain continuous rotation
    if (elapsedTime > 0) {
      // Calculate base rotation (degrees) based on BPM
      // 120 BPM = 0.5 rotations per second = 180 degrees per second
      const rotationsPerSecond = this.bpm / 240;
      const baseDeltaAngleDegrees = rotationsPerSecond * 360 * elapsedTime;
      
      // Update the base angle
      this._layerTimingSystem.baseAngle = (this._layerTimingSystem.baseAngle + baseDeltaAngleDegrees) % 360;
      
      // Update all layer angles with their respective multipliers
      for (const [id, multiplier] of this._layerTimingSystem.layerMultipliers.entries()) {
        // Get current accumulated angle for this layer (or initialize it)
        const currentAngle = this._layerTimingSystem.accumulatedAngles.get(id) || this._layerTimingSystem.baseAngle;
        
        // Calculate new angle with this layer's multiplier
        const newAngle = (currentAngle + (baseDeltaAngleDegrees * multiplier)) % 360;
        
        // Store the new accumulated angle
        this._layerTimingSystem.accumulatedAngles.set(id, newAngle);
      }
      
      // Update the last update time
      this._layerTimingSystem.lastUpdateTime = currentTime;
    }
    
    // Get the accumulated angle for this specific layer
    let layerAngle = this._layerTimingSystem.accumulatedAngles.get(layerId);
    
    // FIXED: If this is the first time for this layer, initialize it based on the base angle
    // but avoid causing a jump in animation by using the current base angle
    if (layerAngle === undefined) {
      layerAngle = this._layerTimingSystem.baseAngle;
      this._layerTimingSystem.accumulatedAngles.set(layerId, layerAngle);
      
      // IMPORTANT: Don't update lastUpdateTime here - we want continuous motion
      // instead of resetting the timer, which would cause a pause
    }
    
    // Convert from degrees to radians for the return value
    const angleRadians = (layerAngle * Math.PI) / 180;
    
    return {
      angleDegrees: layerAngle,
      angleRadians: angleRadians,
      baseAngleDegrees: this._layerTimingSystem.baseAngle,
      lastUpdateTime: this._layerTimingSystem.lastUpdateTime,
      elapsedTime: elapsedTime
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
   * Update angle for animation with subframe precision
   * @param {number} tNow Current time in ms
   * @returns {Object} Object with angle and lastAngle
   */
  updateAngle(tNow) {
    // Store the previous angle
    const previousAngle = this.lastAngle;
    
    // If this is the first call, initialize lastTime
    if (!this.lastTime) {
      this.lastTime = tNow;
      // Initialize high precision time tracking
      this.lastPreciseTime = tNow / 1000; // Convert to seconds for precision calculations
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    // Calculate time delta in milliseconds (for backward compatibility)
    const dt = Math.min(tNow - this.lastTime, 100); // Cap delta time at 100ms
    
    // Skip tiny time steps (often happen during timing system initialization)
    if (dt < 1) {
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    // Get time in seconds
    const seconds = dt / 1000;
    
    // High precision time calculation (in seconds)
    const currentPreciseTime = tNow / 1000;
    const preciseDt = currentPreciseTime - (this.lastPreciseTime || currentPreciseTime);
    
    // Use precise time delta if available, otherwise fallback to regular calculation
    const effectiveSeconds = (preciseDt > 0 && preciseDt < 0.1) ? preciseDt : seconds;
    
    // Adjust calculation to make 120 BPM = 0.5 rotation per second (1 rotation per 2 seconds)
    // Formula: rotationsPerSecond = BPM / 240
    // At 60 BPM: 60/240 = 0.25 rotations per second (1 rotation takes 4 seconds)
    // At 120 BPM: 120/240 = 0.5 rotations per second (1 rotation takes 2 seconds) 
    // At 240 BPM: 240/240 = 1 rotation per second (1 rotation takes 1 second)
    const rotationsPerSecond = this.bpm / 240;
    
    // Calculate degrees to rotate this frame
    const degreesPerSecond = rotationsPerSecond * 360;
    const angleDelta = degreesPerSecond * effectiveSeconds;
    
    // Get the last angle and calculate the new angle
    const lastAngle = this.lastAngle;
    const angle = (lastAngle + angleDelta) % 360;
    
    // Debug logging periodically (about once every 5 seconds at 60fps)
    if (Math.random() < 0.003) { // ~0.3% chance each frame
      
    }
    
    // Store for next frame
    this.lastTime = tNow;
    this.lastPreciseTime = currentPreciseTime;
    this.previousAngle = previousAngle;
    this.lastAngle = angle;
    
    return { angle, lastAngle, previousAngle };
  }
} 