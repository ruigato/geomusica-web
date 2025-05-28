// src/state/GlobalStateManager.js - Manages global state parameters across all layers
import { DEFAULT_VALUES } from '../config/constants.js';
import { getCurrentTime, TIMING_SOURCES, getActiveTimingSource, switchTimingSource } from '../time/time.js';

/**
 * GlobalStateManager class to handle state parameters that should be shared across all layers
 * This includes global timing, audio settings, etc.
 */
export class GlobalStateManager {
  constructor() {
    // Global timing parameters
    this.bpm = DEFAULT_VALUES.BPM;
    this.lastTime = 0; // Initialize to 0, will be updated when timing is ready
    this.lastAngle = 0;
    
    // Timing source preference
    this.timingSource = TIMING_SOURCES.AUDIO_CONTEXT; // Default to AudioContext
    
    // FIXED: Centralized layer timing system using AudioContext
    this._layerTimingSystem = {
      // Base angle that all layers should refer to
      baseAngle: 0,
      // Layer-specific angle multipliers (for time subdivision)
      layerMultipliers: new Map(),
      // Last time the angles were updated (using audio time)
      lastUpdateTime: 0, // Initialize to 0, will be updated when timing is ready
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
      referenceFrequency: false,
      timingSource: false
    };
    
    // Try to initialize timing if possible
    try {
      this.lastTime = getCurrentTime();
      this._layerTimingSystem.lastUpdateTime = this.lastTime;
    } catch (e) {
      // Timing not ready yet, will be updated later
      console.log('[STATE] Timing system not ready, will initialize later');
    }
  }
  
  /**
   * Initialize timing after audio system is ready
   */
  initializeTiming() {
    try {
      this.lastTime = getCurrentTime();
      this._layerTimingSystem.lastUpdateTime = this.lastTime;
      console.log('[STATE] Timing system initialized');
    } catch (e) {
      console.error('[STATE] Failed to initialize timing:', e);
    }
  }
  
  /**
   * Set the preferred timing source
   * @param {string} source - The timing source to use (AUDIO_CONTEXT or PERFORMANCE_NOW)
   */
  setTimingSource(source) {
    if (source !== this.timingSource) {
      this.timingSource = source;
      
      try {
        // Update the actual timing system
        switchTimingSource(source);
      } catch (e) {
        console.error('[STATE] Failed to switch timing source:', e);
      }
      
      // Mark parameter as changed
      this.parameterChanges.timingSource = true;
    }
  }
  
  /**
   * Get the current timing source
   * @returns {string} The current timing source
   */
  getTimingSource() {
    return getActiveTimingSource();
  }
  
  /**
   * Get layer angle data for a specific layer with time subdivision
   * @param {string} layerId - Layer identifier
   * @param {number} timeSubdivisionValue - Time subdivision multiplier
   * @returns {Object} Angle data for the layer
   */
  getLayerAngleData(layerId, timeSubdivisionValue) {
    // Get current time from audio system
    let currentTime;
    let usingFallback = false;
    
    try {
      currentTime = getCurrentTime();
      
      // Validate the returned time value
      if (currentTime === undefined || currentTime === null || isNaN(currentTime)) {
        throw new Error('Invalid time value returned');
      }
      
    } catch (e) {
      // Fallback to performance timing only when necessary
      currentTime = performance.now() / 1000;
      usingFallback = true;
      
      // Only log warnings occasionally to avoid console spam
      if (!this._lastFallbackWarning || (Date.now() - this._lastFallbackWarning) > 5000) {
        console.warn('[STATE] Audio timing not ready, using performance timing:', e.message);
        this._lastFallbackWarning = Date.now();
      }
    }
    
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
    
    // Calculate elapsed time using audio time
    const elapsedTime = currentTime - this._layerTimingSystem.lastUpdateTime;
    
    // FIXED: Always update the base angle to maintain continuous rotation using audio timing
    if (elapsedTime > 0) {
      // Calculate base rotation (degrees) based on BPM
      // 120 BPM = 0.5 rotations per second = 180 degrees per second
      const rotationsPerSecond = this.bpm / 240;
      const baseDeltaAngleDegrees = rotationsPerSecond * 360 * elapsedTime;
      
      // Update the base angle
      this._layerTimingSystem.baseAngle = (this._layerTimingSystem.baseAngle + baseDeltaAngleDegrees) % 360;
      
      // Update the last update time using audio time
      this._layerTimingSystem.lastUpdateTime = currentTime;
    }
    
    // NEW APPROACH: Calculate layer angle based on transport time and subdivision
    // This ensures layers stay in sync when subdivision changes (with jumps)
    
    // Calculate the current transport position in measures
    const rotationsPerSecond = this.bpm / 240; // 120 BPM = 0.5 rotations per second
    const totalRotations = currentTime * rotationsPerSecond;
    
    // Apply time subdivision to the transport position
    // For subdivision values:
    // - 1x = normal speed (1 full revolution per 2 seconds at 120 BPM)
    // - 2x = double speed (2 full revolutions per 2 seconds at 120 BPM)
    // - 0.5x = half speed (0.5 full revolutions per 2 seconds at 120 BPM)
    const subdivisionMultiplier = timeSubdivisionValue || 1;
    const subdivisionRotations = totalRotations * subdivisionMultiplier;
    
    // Convert to degrees and normalize to 0-360
    const layerAngleDegrees = (subdivisionRotations * 360) % 360;
    
    // Store the calculated angle for this layer
    this._layerTimingSystem.accumulatedAngles.set(layerId, layerAngleDegrees);

    // Convert from degrees to radians for the return value
    const angleRadians = (layerAngleDegrees * Math.PI) / 180;

    return {
      angleDegrees: layerAngleDegrees,
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
   * Update angle for animation with audio timing precision
   * @param {number} audioTime Current audio time in seconds
   * @returns {Object} Object with angle and lastAngle
   */
  updateAngle(audioTime) {
    // Store the previous angle
    const previousAngle = this.lastAngle;
    
    // If this is the first call, initialize lastTime
    if (!this.lastTime) {
      this.lastTime = audioTime;
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    // Calculate time delta in seconds using audio time
    const dt = Math.min(audioTime - this.lastTime, 0.1); // Cap delta time at 100ms
    
    // Skip tiny time steps (often happen during timing system initialization)
    if (dt < 0.001) { // 1ms minimum step
      return { angle: this.lastAngle, lastAngle: this.lastAngle };
    }
    
    // Adjust calculation to make 120 BPM = 0.5 rotation per second (1 rotation per 2 seconds)
    // Formula: rotationsPerSecond = BPM / 240
    // At 60 BPM: 60/240 = 0.25 rotations per second (1 rotation takes 4 seconds)
    // At 120 BPM: 120/240 = 0.5 rotations per second (1 rotation takes 2 seconds) 
    // At 240 BPM: 240/240 = 1 rotation per second (1 rotation takes 1 second)
    const rotationsPerSecond = this.bpm / 240;
    
    // Calculate degrees to rotate this frame
    const degreesPerSecond = rotationsPerSecond * 360;
    const angleDelta = degreesPerSecond * dt;
    
    // Get the last angle and calculate the new angle
    const lastAngle = this.lastAngle;
    const angle = (lastAngle + angleDelta) % 360;
    
    // Store for next frame using audio time
    this.lastTime = audioTime;
    this.previousAngle = previousAngle;
    this.lastAngle = angle;
    
    return { angle, lastAngle, previousAngle };
  }
} 