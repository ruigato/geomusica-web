// src/state/state.js - Updated with fixes for segments rounding issue
import { getCurrentTime } from '../time/time.js';
import { DEFAULT_VALUES, UI_RANGES, TICKS_PER_BEAT, TICKS_PER_MEASURE } from '../config/constants.js';
import { clearLabels } from '../ui/domLabels.js';
import { ParameterMode } from '../notes/notes.js';

/**
 * Generate sequence from 1/modulus to 1.0 in even steps
 * @param {number} n Modulus value
 * @returns {Array<number>} Sequence of scale factors
 */
export function generateSequence(n) {
  const sequence = [];
  const step = 1.0 / n;
  
  for (let i = 1; i <= n; i++) {
    sequence.push(i * step);
  }
  
  return sequence;
}

// Create a debug flag for star cuts
const DEBUG_STAR_CUTS = true;

/**
 * Create initial application state
 * @returns {Object} Application state object
 */
export function createAppState() {
  return {
    // Track parameter changes
    parameterChanges: {
      copies: false,
      segments: false,
      modulus: false,
      angle: false,
      stepScale: false,
      radius: false,
      useModulus: false,
      altScale: false,
      useAltScale: false,
      altStepN: false,
      durationMode: false,
      durationModulo: false,
      minDuration: false,
      maxDuration: false,
      velocityMode: false,
      velocityModulo: false,
      minVelocity: false,
      maxVelocity: false,
      fractal: false,
      useFractal: false,
      starSkip: false,
      useStars: false,
      useCuts: false,
      euclidValue: false,
      useEuclid: false
    },
    
    // Performance and frame tracking
    frame: 0,
    lastUpdateTime: 0,
    performance: {
      highPerformanceMode: true,   // Enable optimizations
      skipFramesWhenNeeded: true,  // Allow skipping frames under load
      updateThreshold: 100         // Minimum ms between heavy updates
    },
    
    // Time and animation related state
    lastTime: getCurrentTime(),
    lastAngle: 0,
    lastTrig: new Set(),
    markers: [],
    justCalculatedIntersections: false,
    
    // Tracking parameter changes
    lastStepScale: DEFAULT_VALUES.STEP_SCALE,
    lastAngle: DEFAULT_VALUES.ANGLE,

    // User configurable parameters
    bpm: DEFAULT_VALUES.BPM,
    radius: DEFAULT_VALUES.RADIUS,
    copies: DEFAULT_VALUES.COPIES,
    targetCopies: DEFAULT_VALUES.COPIES,
    segments: DEFAULT_VALUES.SEGMENTS,
    stepScale: DEFAULT_VALUES.STEP_SCALE,
    
    // RENAMED: angle -> copyAngleOffset to avoid confusion with rotation angle
    copyAngleOffset: DEFAULT_VALUES.ANGLE, // The fixed angle between successive polygon copies
    
    // SYNTH parameters
    attack: 0.01,
    decay: 0.3,
    sustain: 0.5,
    release: 1.0,
    brightness: 1.0,
    volume: 0.8,
    
    // Equal temperament settings
    useEqualTemperament: DEFAULT_VALUES.USE_EQUAL_TEMPERAMENT,
    referenceFrequency: DEFAULT_VALUES.REFERENCE_FREQ,
    
    // MODULUS related parameters
    modulusValue: DEFAULT_VALUES.MODULUS_VALUE,
    useModulus: DEFAULT_VALUES.USE_MODULUS,
    
    // TIME SUBDIVISION related parameters
    timeSubdivisionValue: DEFAULT_VALUES.TIME_SUBDIVISION_VALUE,
    useTimeSubdivision: DEFAULT_VALUES.USE_TIME_SUBDIVISION,
    
    // TIME QUANTIZATION related parameters
    quantizationValue: DEFAULT_VALUES.QUANTIZATION_VALUE,
    useQuantization: DEFAULT_VALUES.USE_QUANTIZATION,
    
    // SCALE MOD related parameters
    altScale: DEFAULT_VALUES.ALT_SCALE,
    altStepN: DEFAULT_VALUES.ALT_STEP_N,
    useAltScale: DEFAULT_VALUES.USE_ALT_SCALE,
    
    // NOTE PARAMETER related parameters
    // Duration parameters
    durationMode: ParameterMode.MODULO, // Default to modulo mode
    durationModulo: 3, // Default modulo value
    minDuration: 0.1, // Minimum duration in seconds
    maxDuration: 0.5, // Maximum duration in seconds
    
    // Velocity parameters
    velocityMode: ParameterMode.MODULO, // Default to modulo mode
    velocityModulo: 4, // Default modulo value
    minVelocity: 0.3, // Minimum velocity (0-1)
    maxVelocity: 0.9, // Maximum velocity (0-1)
    
    // Intersection related parameters
    useIntersections: DEFAULT_VALUES.USE_INTERSECTIONS,
    lastUseIntersections: DEFAULT_VALUES.USE_INTERSECTIONS,
    intersectionPoints: [],
    needsIntersectionUpdate: true,
    
    // Cuts related parameters
    useCuts: false,
    lastUseCuts: false,
    
    // Lerp/Lag related parameters
    useLerp: false,
    lerpTime: DEFAULT_VALUES.LERP_TIME,
    
    // Camera related parameters 
    cameraDistance: 1000,
    targetCameraDistance: 1000,
    cameraLerpSpeed: 0.1,
    
    // Target values for lerping
    targetRadius: DEFAULT_VALUES.RADIUS,
    targetStepScale: DEFAULT_VALUES.STEP_SCALE,
    targetAngle: DEFAULT_VALUES.ANGLE,
    targetAltScale: DEFAULT_VALUES.ALT_SCALE,
    
    // Frequency label settings
    showAxisFreqLabels: DEFAULT_VALUES.SHOW_AXIS_FREQ_LABELS,
    showPointsFreqLabels: DEFAULT_VALUES.SHOW_POINTS_FREQ_LABELS,
    lastShowPointsFreqLabels: DEFAULT_VALUES.SHOW_POINTS_FREQ_LABELS,
    pointFreqLabels: [],
    needsPointFreqLabelsUpdate: false,
    
    // Reference to modifiable baseGeo
    baseGeo: null,
    currentGeometryRadius: null,
    
    // Debug mode flag
    debug: false,
    
    // SHAPE MOD Fractal parameters
    fractalValue: 1, // Default to 1 (no subdivision)
    useFractal: false, // Default to off
    
    // Shape type (regular, fractal, star, euclidean)
    shapeType: 'regular', // Default to regular polygon
    
    // SHAPE MOD Euclidean rhythm parameters
    euclidValue: 3, // Default value 3
    useEuclid: false, // Default to off
    
    // STARS parameters
    starSkip: 1, // Default skip value
    useStars: false, // Default to off
    
    /**
     * Check if any parameters have changed
     * @returns {boolean} True if any parameters changed
     */
    hasParameterChanged() {
      return Object.values(this.parameterChanges).some(changed => changed);
    },
    
    /**
     * Reset all parameter change flags
     */
    resetParameterChanges() {
      for (const key in this.parameterChanges) {
        this.parameterChanges[key] = false;
      }
    },
    
    /**
     * Check if an update is needed based on performance settings
     * @returns {boolean} True if update is needed
     */
    checkIfUpdateNeeded() {
      const now = performance.now();
      const timeSinceLastUpdate = now - this.lastUpdateTime;
      
      // Did something actually change that requires an update?
      const hasChanges = 
        this.needsIntersectionUpdate || 
        this.needsPointFreqLabelsUpdate ||
        this.justCalculatedIntersections ||
        this.hasParameterChanged();
      
      // If nothing changed, no update needed
      if (!hasChanges) return false;
      
      // If in high performance mode, limit update frequency
      if (this.performance.highPerformanceMode && 
          timeSinceLastUpdate < this.performance.updateThreshold) {
        return false;
      }
      
      // Update the timestamp and return true
      this.lastUpdateTime = now;
      return true;
    },
    
    /**
     * Determine if lerping is active
     * @returns {boolean} True if lerping is active
     */
    isLerping() {
      if (!this.useLerp) return false;
      
      return Math.abs(this.radius - this.targetRadius) > 0.1 ||
             Math.abs(this.stepScale - this.targetStepScale) > 0.001 ||
             Math.abs(this.angle - this.targetAngle) > 0.1 ||
             Math.abs(this.copies - this.targetCopies) > 0.1;
    },
    
    /**
     * Set BPM value (not affected by lerping)
     * @param {number} value New BPM value
     */
    setBpm(value) {
      const newValue = Number(value);
      if (this.bpm !== newValue) {
        this.bpm = newValue;
      }
    },
    
    /**
     * Set radius value (affected by lerping if enabled)
     * @param {number} value New radius value
     */
    setRadius(value) {
      const newValue = Number(value);
      if (this.targetRadius !== newValue) {
        this.targetRadius = newValue;
        this.parameterChanges.radius = true;
        
        // If lerping is off, update the actual value immediately
        if (!this.useLerp) {
          this.radius = newValue;
        }
        
        this.needsIntersectionUpdate = true;
        
        // FIXED: Reset trigger state when radius changes to prevent false triggers
        this.resetTriggerState();
      }
    },
    
    /**
     * Set copies count (not affected by lerping)
     * @param {number} value New copies value
     */
    setCopies(value) {
      const newValue = Number(value);
      // Make sure both targetCopies and copies are properly set
      if (this.targetCopies !== newValue || this.copies !== newValue) {
        this.targetCopies = newValue;
        this.parameterChanges.copies = true;
        if (!this.useLerp) {
          this.copies = this.targetCopies;
        }
        this.needsIntersectionUpdate = true;
        
        // FIXED: Reset trigger state when copies change to prevent false triggers
        this.resetTriggerState();
      }
    },
    
    /**
     * Set segments count (not affected by lerping)
     * @param {number} value New segments value
     */
    setSegments(value) {
      const newValue = Math.round(Number(value));
      if (this.segments !== newValue) {
        this.segments = newValue;
        this.parameterChanges.segments = true;
        this.needsIntersectionUpdate = true;
        
        // FIXED: Reset trigger state when segments change to prevent false triggers
        this.resetTriggerState();
      }
    },
    
    /**
     * Set step scale value (affected by lerping if enabled)
     * @param {number} value New step scale value
     */
    setStepScale(value) {
      const newValue = Number(value);
      if (this.targetStepScale !== newValue) {
        this.targetStepScale = newValue;
        this.parameterChanges.stepScale = true;
        if (!this.useLerp) {
          this.stepScale = this.targetStepScale;
        }
        this.needsIntersectionUpdate = true;
        
        // FIXED: Reset trigger state when step scale changes to prevent false triggers
        this.resetTriggerState();
      }
    },
    
    /**
     * Set angle value (affected by lerping if enabled)
     * @param {number} value New angle value
     */
    setAngle(value) {
      const newValue = Number(value);
      if (this.targetAngle !== newValue) {
        this.targetAngle = newValue;
        this.parameterChanges.angle = true;
        if (!this.useLerp) {
          this.copyAngleOffset = this.targetAngle;
        }
        this.needsIntersectionUpdate = true;
      }
    },
    
    /**
     * Set modulus value
     * @param {number} value New modulus value
     */
    setModulusValue(value) {
      const newValue = Number(value);
      if (this.modulusValue !== newValue) {
        this.modulusValue = newValue;
        this.parameterChanges.modulus = true;
        if (this.useModulus) {
          this.needsIntersectionUpdate = true;
        }
      }
    },
    
    /**
     * Toggle modulus mode
     * @param {boolean} value Enable/disable modulus
     */
    setUseModulus(value) {
      const newValue = Boolean(value);
      if (this.useModulus !== newValue) {
        this.useModulus = newValue;
        this.parameterChanges.useModulus = true;
        this.needsIntersectionUpdate = true;
      }
    },
    
    /**
     * Set time subdivision value
     * @param {number} value New time subdivision value
     */
    setTimeSubdivisionValue(value) {
      this.timeSubdivisionValue = Number(value);
    },
    
    /**
     * Toggle time subdivision mode
     * @param {boolean} value Enable/disable time subdivision
     */
    setUseTimeSubdivision(value) {
      this.useTimeSubdivision = Boolean(value);
    },
    
    /**
     * Get time subdivision value
     * @returns {number} Current time subdivision value
     */
    getTimeSubdivisionValue() {
      return this.timeSubdivisionValue;
    },
    
    /**
     * Check if time subdivision is enabled
     * @returns {boolean} True if time subdivision is enabled
     */
    isUsingTimeSubdivision() {
      return this.useTimeSubdivision;
    },
    
    /**
     * Set quantization value
     * @param {string} value New quantization value
     */
    setQuantizationValue(value) {
      this.quantizationValue = value;
    },
    
    /**
     * Toggle quantization mode
     * @param {boolean} value Enable/disable quantization
     */
    setUseQuantization(value) {
      this.useQuantization = Boolean(value);
    },
    
    /**
     * Get quantization value
     * @returns {string} Current quantization value
     */
    getQuantizationValue() {
      return this.quantizationValue;
    },
    
    /**
     * Convert current quantization setting to ticks
     * @returns {number} Ticks per quantization unit
     */
    getQuantizationTicks() {
      // Parse the quantization value (format: '1/4', '1/8T', etc.)
      const value = this.quantizationValue;
      
      if (!value) return TICKS_PER_BEAT; // Default to quarter notes
      
      // Check if it's a triplet
      const isTriplet = value.endsWith('T');
      
      // Get the denominator (4 for quarter notes, 8 for eighth notes, etc.)
      const denominator = parseInt(value.replace('1/', '').replace('T', ''));
      
      if (isNaN(denominator) || denominator <= 0) {
        return TICKS_PER_BEAT; // Default to quarter notes
      }
      
      // Calculate the number of ticks
      if (isTriplet) {
        // For triplets, divide by 3 to get 3 notes where 2 would normally fit
        return Math.round((TICKS_PER_MEASURE / denominator) * (2/3));
      } else {
        return TICKS_PER_MEASURE / denominator;
      }
    },
    
    /**
     * Check if quantization is enabled
     * @returns {boolean} True if quantization is enabled
     */
    isUsingQuantization() {
      return this.useQuantization;
    },
    
    /**
     * Set alt scale value (affected by lerping if enabled)
     * @param {number} value New alt scale value
     */
    setAltScale(value) {
      const newValue = Number(value);
      if (this.targetAltScale !== newValue) {
        this.targetAltScale = newValue;
        this.parameterChanges.altScale = true;
        
        // If lerping is off, update the actual value immediately
        if (!this.useLerp) {
          this.altScale = newValue;
        }
        
        // Always mark for intersection update when alt scale is being used
        if (this.useAltScale) {
          this.needsIntersectionUpdate = true;
          
          // Mark that geometry needs to be recreated
          this.segmentsChanged = true;
          this.currentGeometryRadius = null; // Invalidate cached radius to force redraw
          
          // Log the change for debugging
          console.log("Forcing geometry update due to alt scale change");
        }
      }
    },
    
    /**
     * Set alt step N value
     * @param {number} value New alt step N value
     */
    setAltStepN(value) {
      const newValue = Number(value);
      if (this.altStepN !== newValue) {
        this.altStepN = newValue;
        this.parameterChanges.altStepN = true;
        if (this.useAltScale) {
          this.needsIntersectionUpdate = true;
          
          // Force recreation of base geometry when available
          if (this.baseGeo) {
            console.log("Forcing geometry update due to alt step N change");
            
            // Set flags to signal that geometry needs recreation
            this.segmentsChanged = true;
            this.currentGeometryRadius = null; // Invalidate cached radius to force redraw
          }
        }
      }
    },
    
    /**
     * Toggle alt scale mode
     * @param {boolean} value Enable/disable alt scale
     */
    setUseAltScale(value) {
      const newValue = Boolean(value);
      if (this.useAltScale !== newValue) {
        this.useAltScale = newValue;
        this.parameterChanges.useAltScale = true;
        this.needsIntersectionUpdate = true;
        
        // Force recreation of base geometry when available
        if (this.baseGeo) {
          console.log("Forcing geometry update due to alt scale toggle");
          
          // Set flags to signal that geometry needs recreation
          this.segmentsChanged = true;
          this.currentGeometryRadius = null; // Invalidate cached radius to force redraw
        }
      }
    },
    
    /**
     * Toggle intersections
     * @param {boolean} value Enable/disable intersections
     */
    setUseIntersections(value) {
      this.useIntersections = Boolean(value);
      this.needsIntersectionUpdate = true;
    },
    
    /**
     * Toggle lerping/lag
     * @param {boolean} value Enable/disable lerping
     */
    setUseLerp(value) {
      const wasLerping = this.useLerp;
      this.useLerp = Boolean(value);
      
      // If we're enabling lerping, initialize target values to current values
      if (this.useLerp && !wasLerping) {
        // Set target values to current values as starting point
        this.targetRadius = this.radius;
        this.targetStepScale = this.stepScale;
        this.targetAngle = this.angle;
        this.targetAltScale = this.altScale;
        this.targetCopies = this.copies;
        
        // No need to clear lastTrig - we'll use rate limiting instead
        // Only reset vertex positions if we need to
        const layerRef = this.layerRef || (window._layers && window._layers.layers && 
                           window._layers.layers.find(l => l.id === this.layerId));
        
        // Store the lerping start time for rate limiting
        if (layerRef) {
          layerRef._lerpingStartedAt = performance.now();
        }
      }
      
      if (!this.useLerp) {
        // When disabling lerping, snap values immediately
        this.radius = this.targetRadius;
        this.stepScale = this.targetStepScale;
        this.angle = this.targetAngle;
        this.altScale = this.targetAltScale;
        this.copies = this.targetCopies;
        this.needsIntersectionUpdate = true;
      }
    },
    
    /**
     * Set lerp time
     * @param {number} value New lerp time
     */
    setLerpTime(value) {
      this.lerpTime = Math.max(0.1, Math.min(10.0, Number(value)));
    },
    
    /**
     * Set camera distance
     * @param {number} value New camera distance
     */
    setCameraDistance(value) {
      this.targetCameraDistance = value;
    },
    
    /**
     * Set attack time
     * @param {number} value New attack time in seconds
     */
    setAttack(value) {
      this.attack = Math.max(0.001, Math.min(2.0, Number(value)));
    },
    
    /**
     * Set decay time
     * @param {number} value New decay time in seconds
     */
    setDecay(value) {
      this.decay = Math.max(0.01, Math.min(3.0, Number(value)));
    },
    
    /**
     * Set sustain level
     * @param {number} value New sustain level (0-1)
     */
    setSustain(value) {
      this.sustain = Math.max(0.0, Math.min(1.0, Number(value)));
    },
    
    /**
     * Set release time
     * @param {number} value New release time in seconds
     */
    setRelease(value) {
      this.release = Math.max(0.01, Math.min(10.0, Number(value)));
    },
    
    /**
     * Set brightness
     * @param {number} value New brightness value (0-2)
     */
    setBrightness(value) {
      this.brightness = Math.max(0.0, Math.min(2.0, Number(value)));
    },
    
    /**
     * Set master volume
     * @param {number} value New volume value (0-1)
     */
    setVolume(value) {
      this.volume = Math.max(0.0, Math.min(1.0, Number(value)));
    },
    
    /**
     * Toggle equal temperament
     * @param {boolean} value Enable/disable equal temperament
     */
    setUseEqualTemperament(value) {
      this.useEqualTemperament = Boolean(value);
    },
    
    /**
     * Set reference frequency for equal temperament
     * @param {number} value Reference frequency in Hz
     */
    setReferenceFrequency(value) {
      this.referenceFrequency = Math.max(UI_RANGES.REFERENCE_FREQ[0], 
                               Math.min(UI_RANGES.REFERENCE_FREQ[1], Number(value)));
    },
    
    /**
     * Toggle axis frequency labels
     * @param {boolean} value Enable/disable axis labels
     */
    setShowAxisFreqLabels(value) {
      this.showAxisFreqLabels = Boolean(value);
    },
    
    /**
     * Toggle point frequency labels
     * @param {boolean} value Enable/disable point labels
     */
    setShowPointsFreqLabels(value) {
      this.showPointsFreqLabels = Boolean(value);
      
      if (!value && this.pointFreqLabels.length > 0) {
        this.cleanupPointFreqLabels();
      } else if (value) {
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    /**
     * Toggle debug mode
     * @param {boolean} value Enable/disable debug mode
     */
    setDebug(value) {
      this.debug = Boolean(value);
    },
    
    /**
     * Clean up point frequency labels
     */
    cleanupPointFreqLabels() {
      if (!this.pointFreqLabels || this.pointFreqLabels.length === 0) return;
      
      clearLabels();
      this.pointFreqLabels = [];
    },
    
    /**
     * Get scale factor for a specific copy based on modulus and alt scale
     * @param {number} copyIndex Copy index
     * @returns {number} Scale factor
     */
    getScaleFactorForCopy(copyIndex) {
      let baseFactor = 1.0;
      
      // Apply modulus scaling if enabled
      if (this.useModulus) {
        const modVal = this.modulusValue;
        const sequence = generateSequence(modVal);
        const sequenceIndex = copyIndex % sequence.length;
        baseFactor = sequence[sequenceIndex];
      }
      
      // Apply alt scale if enabled
      if (this.useAltScale && this.altStepN > 0) {
        // Check if this copy index matches the alt step pattern
        if ((copyIndex + 1) % this.altStepN === 0) {
          baseFactor *= this.altScale;
        }
      }
      
      return baseFactor;
    },
    
    /**
     * Set duration mode
     * @param {string} mode Parameter mode (modulo, random, interpolation)
     */
    setDurationMode(mode) {
      if (Object.values(ParameterMode).includes(mode)) {
        this.durationMode = mode;
        this.parameterChanges.durationMode = true;
        this.needsPointFreqLabelsUpdate = true;        
      }
    },
    
    /**
     * Set duration modulo value
     * @param {number} value New modulo value (1-12)
     */
    setDurationModulo(value) {
      const newValue = Math.max(1, Math.min(12, Number(value)));
      if (this.durationModulo !== newValue) {
        this.durationModulo = newValue;
        this.parameterChanges.durationModulo = true;
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    /**
     * Set min duration value
     * @param {number} value New min duration in seconds
     */
    setMinDuration(value) {
      const newValue = Math.max(0.05, Math.min(this.maxDuration, Number(value)));
      if (this.minDuration !== newValue) {
        this.minDuration = newValue;
        this.parameterChanges.minDuration = true;
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    /**
     * Set max duration value
     * @param {number} value New max duration in seconds
     */
    setMaxDuration(value) {
      const newValue = Math.max(this.minDuration, Math.min(2.0, Number(value)));
      if (this.maxDuration !== newValue) {
        this.maxDuration = newValue;
        this.parameterChanges.maxDuration = true;
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    /**
     * Set duration phase value
     * @param {number} value New duration phase (0-1)
     */
    setDurationPhase(value) {
      const newValue = Math.max(0, Math.min(1, Number(value)));
      if (this.durationPhase !== newValue) {
        this.durationPhase = newValue;
        this.parameterChanges.durationPhase = true;
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    /**
     * Set velocity mode
     * @param {string} mode Parameter mode (modulo, random, interpolation)
     */
    setVelocityMode(mode) {
      if (Object.values(ParameterMode).includes(mode) && this.velocityMode !== mode) {
        this.velocityMode = mode;
        this.parameterChanges.velocityMode = true;
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    /**
     * Set velocity modulo value
     * @param {number} value New modulo value (1-12)
     */
    setVelocityModulo(value) {
      const newValue = Math.max(1, Math.min(12, Number(value)));
      if (this.velocityModulo !== newValue) {
        this.velocityModulo = newValue;
        this.parameterChanges.velocityModulo = true;
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    /**
     * Set min velocity value
     * @param {number} value New min velocity (0-1)
     */
    setMinVelocity(value) {
      const newValue = Math.max(0.1, Math.min(this.maxVelocity, Number(value)));
      if (this.minVelocity !== newValue) {
        this.minVelocity = newValue;
        this.parameterChanges.minVelocity = true;
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    /**
     * Set max velocity value
     * @param {number} value New max velocity (0-1)
     */
    setMaxVelocity(value) {
      const newValue = Math.max(this.minVelocity, Math.min(1.0, Number(value)));
      if (this.maxVelocity !== newValue) {
        this.maxVelocity = newValue;
        this.parameterChanges.maxVelocity = true;
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    /**
     * Set velocity phase value
     * @param {number} value New velocity phase (0-1)
     */
    setVelocityPhase(value) {
      const newValue = Math.max(0, Math.min(1, Number(value)));
      if (this.velocityPhase !== newValue) {
        this.velocityPhase = newValue;
        this.parameterChanges.velocityPhase = true;
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    /**
     * Get total count of points in the system
     * @returns {number} Total number of points
     */
    getTotalPointCount() {
      let count = this.segments * this.copies; // Regular vertices
      
      if (this.intersectionPoints) {
        count += this.intersectionPoints.length; // Intersection points
      }
      
      return count;
    },
    
    /**
     * Update lerp values based on time delta
     * @param {number} dt Time delta in seconds
     */
    updateLerp(dt) {
      if (!this.useLerp) return;
      
      // Calculate lerp factor based on lerpTime
      const lerpFactor = Math.min(1.0, dt / this.lerpTime);
      
      // Lerp radius
      if (Math.abs(this.radius - this.targetRadius) > 0.1) {
        this.radius = this.lerp(this.radius, this.targetRadius, lerpFactor);
        this.parameterChanges.radius = true;
      }
      
      // Lerp stepScale
      if (Math.abs(this.stepScale - this.targetStepScale) > 0.001) {
        this.stepScale = this.lerp(this.stepScale, this.targetStepScale, lerpFactor);
        this.parameterChanges.stepScale = true;
      }
      
      // Lerp copyAngleOffset (RENAMED from angle)
      if (Math.abs(this.copyAngleOffset - this.targetAngle) > 0.1) {
        this.copyAngleOffset = this.lerp(this.copyAngleOffset, this.targetAngle, lerpFactor);
        this.parameterChanges.angle = true;
      }
      
      // Lerp copies
      if (Math.abs(this.copies - this.targetCopies) > 0.1) {
        this.copies = this.lerp(this.copies, this.targetCopies, lerpFactor);
        this.copies = Math.max(0, Math.min(Math.round(this.copies), 100)); // Clamp to reasonable range
        this.parameterChanges.copies = true;
      }
      
      // Check if significant changes occurred and explicitly mark parameters as changed
      if (Math.abs(this.radius - this.targetRadius) > 0.1) {
        this.needsIntersectionUpdate = true;
      }
      
      if (Math.abs(this.stepScale - this.targetStepScale) > 0.001) {
        this.needsIntersectionUpdate = true;
      }
      
      if (Math.abs(this.copyAngleOffset - this.targetAngle) > 0.1) {
        this.needsIntersectionUpdate = true;
      }
    },
    
    /**
     * Update camera lerping
     * @param {number} dt Time delta
     */
    updateCameraLerp(dt) {
      if (Math.abs(this.cameraDistance - this.targetCameraDistance) > 1) {
        const lerpFactor = this.cameraLerpSpeed;
        this.cameraDistance = this.lerp(this.cameraDistance, this.targetCameraDistance, lerpFactor);
      }
    },
    
    /**
     * Linear interpolation helper
     * @param {number} start Start value
     * @param {number} end End value
     * @param {number} t Interpolation factor (0-1)
     * @returns {number} Interpolated value
     */
    lerp(start, end, t) {
      return start + (end - start) * t;
    },
    
    /**
     * Set fractal value
     * @param {number} value Fractal subdivision value (1-9)
     */
    setFractalValue(value) {
      const newValue = Math.max(1, Math.min(9, Math.round(Number(value))));
      if (this.fractalValue !== newValue) {
        this.fractalValue = newValue;
        this.parameterChanges.fractal = true;
        this.needsIntersectionUpdate = true;
        
        // Force recreation of base geometry when available
        if (this.baseGeo && this.useFractal) {
          console.log("Forcing geometry update due to fractal value change");
          
          // Set flags to signal that geometry needs recreation
          this.segmentsChanged = true;
          this.currentGeometryRadius = null; // Invalidate cached radius to force redraw
        }
      }
    },
    
    /**
     * Toggle fractal subdivision
     * @param {boolean} value Enable/disable fractal subdivision
     */
    setUseFractal(value) {
      const newValue = Boolean(value);
      if (this.useFractal !== newValue) {
        this.useFractal = newValue;
        this.parameterChanges.useFractal = true;
        this.needsIntersectionUpdate = true;
        
        // Update shape type when fractal is toggled
        if (newValue && this.shapeType === 'regular') {
          this.shapeType = 'fractal';
          console.log("Setting shape type to fractal");
        } else if (!newValue && this.shapeType === 'fractal') {
          this.shapeType = 'regular';
          console.log("Setting shape type back to regular");
        }
        
        // Force recreation of base geometry when available
        if (this.baseGeo) {
          console.log("Forcing geometry update due to fractal toggle");
          
          // Set flags to signal that geometry needs recreation
          this.segmentsChanged = true;
          this.currentGeometryRadius = null; // Invalidate cached radius to force redraw
        }
      }
    },
    
    /**
     * Set Euclidean rhythm value
     * @param {number} value Euclidean rhythm value (1-12)
     */
    setEuclidValue(value) {
      const newValue = Math.max(1, Math.min(12, Math.round(Number(value))));
      if (this.euclidValue !== newValue) {
        this.euclidValue = newValue;
        this.parameterChanges.euclidValue = true;
        this.needsIntersectionUpdate = true;
        
        // Force recreation of base geometry when available
        if (this.baseGeo && this.useEuclid) {
          console.log("Forcing geometry update due to Euclidean value change");
          
          // We need to import this dynamically - handled by the main.js overrides
          // Just set a flag to signal that geometry needs recreation
          this.segmentsChanged = true;
          this.currentGeometryRadius = null; // Invalidate cached radius to force redraw
        }
      }
    },
    
    /**
     * Toggle Euclidean rhythm
     * @param {boolean} value Enable/disable Euclidean rhythm
     */
    setUseEuclid(value) {
      const newValue = Boolean(value);
      if (this.useEuclid !== newValue) {
        this.useEuclid = newValue;
        this.parameterChanges.useEuclid = true;
        this.needsIntersectionUpdate = true;
        
        // Update shape type when Euclidean is toggled
        if (newValue && this.shapeType === 'regular') {
          this.shapeType = 'euclidean';
          console.log("Setting shape type to euclidean");
        } else if (!newValue && this.shapeType === 'euclidean') {
          this.shapeType = 'regular';
          console.log("Setting shape type back to regular");
        }
        
        // Force recreation of base geometry when available
        if (this.baseGeo) {
          console.log("Forcing geometry update due to Euclidean toggle");
          
          // Set flags to signal that geometry needs recreation
          this.segmentsChanged = true;
          this.currentGeometryRadius = null; // Invalidate cached radius to force redraw
        }
      }
    },
    
    /**
     * Set star skip value
     * @param {number} value Star polygon skip value
     */
    setStarSkip(value) {
      const newValue = Math.max(1, Math.round(Number(value)));
      if (this.starSkip !== newValue) {
        this.starSkip = newValue;
        this.parameterChanges.starSkip = true;
        
        // Force intersection update when changing starSkip with stars and cuts enabled
        if (this.useStars && this.useCuts && newValue > 1) {
          if (DEBUG_STAR_CUTS) {
            console.log(`[STAR CUTS] Forcing intersection update after changing starSkip to ${newValue}`);
          }
          this.needsIntersectionUpdate = true;
        }
        
        console.log(`Star skip set to ${newValue}`);
      }
    },
    
    /**
     * Toggle star polygons
     * @param {boolean} value Enable/disable star polygons
     */
    setUseStars(value) {
      const newValue = Boolean(value);
      if (this.useStars !== newValue) {
        this.useStars = newValue;
        this.parameterChanges.useStars = true;
        
        // Update shapeType to 'star' when enabling stars
        if (newValue) {
          this.shapeType = 'star';
        } else if (this.shapeType === 'star') {
          // Revert to regular polygon when disabling stars
          this.shapeType = 'regular';
        }
        
        // Force intersection update when toggling stars with cuts enabled
        if (this.useCuts && this.starSkip > 1) {
          if (DEBUG_STAR_CUTS) {
            console.log(`[STAR CUTS] Forcing intersection update after changing useStars`);
          }
          this.needsIntersectionUpdate = true;
        }
        
        // Always force geometry recreation when toggling stars feature
        this.segmentsChanged = true;
        this.currentGeometryRadius = null; // Invalidate cached radius to force redraw
        
        console.log(`Stars ${newValue ? 'enabled' : 'disabled'}, shapeType=${this.shapeType}`);
      }
    },
    
    /**
     * Toggle cuts (internal star intersections)
     * @param {boolean} value Enable/disable cuts
     */
    setUseCuts(value) {
      const newValue = Boolean(value);
      if (this.useCuts !== newValue) {
        this.useCuts = newValue;
        this.parameterChanges.useCuts = true;
        
        // Force intersection update when toggling cuts with stars enabled
        if (this.useStars && this.starSkip > 1) {
          if (DEBUG_STAR_CUTS) {
            console.log(`[STAR CUTS] Forcing intersection update after changing useCuts`);
          }
          this.needsIntersectionUpdate = true;
          
          // Force geometry recreation when toggling cuts with stars enabled
          this.segmentsChanged = true;
          this.currentGeometryRadius = null; // Invalidate cached radius to force redraw
        }
        
        console.log(`Cuts ${newValue ? 'enabled' : 'disabled'}`);
      }
    },
    
    /**
     * Calculate valid skip values for current number of segments
     * @returns {Array<number>} Array of valid skip values
     */
    getValidStarSkips() {
      const n = this.segments;
      const validSkips = [];
      
      console.log(`Calculating valid star skips for n=${n}`);
      
      // Check each potential skip value
      for (let k = 1; k < n; k++) {
        // Only include if k and n are coprime (gcd(k, n) = 1)
        // This ensures we get a single continuous path through all vertices
        const gcdValue = this.gcd(k, n);
        if (gcdValue === 1) {
          // To avoid duplicates (since {n/k} is the same as {n/(n-k)})
          // only include k up to n/2
          if (k <= Math.floor(n/2)) {
            validSkips.push(k);
            console.log(`Valid skip: k=${k} for n=${n} (gcd=${gcdValue})`);
          }
        } else {
          console.log(`Skip ${k} rejected: forms ${gcdValue} separate figure(s) instead of a single star`);
        }
      }
      
      // Always include skip 1 (regular polygon)
      if (!validSkips.includes(1)) {
        validSkips.unshift(1);
      }
      
      console.log(`Valid skips for n=${n}: ${validSkips.join(', ')}`);
      return validSkips;
    },
    
    /**
     * Calculate greatest common divisor
     * @param {number} a First integer
     * @param {number} b Second integer
     * @returns {number} GCD of a and b
     */
    gcd(a, b) {
      // Euclidean algorithm
      while (b !== 0) {
        const temp = b;
        b = a % b;
        a = temp;
      }
      return a;
    },
    
    /**
     * Set shape type
     * @param {string} type Shape type ('regular', 'fractal', 'star', 'euclidean')
     */
    setShapeType(type) {
      const validTypes = ['regular', 'fractal', 'star', 'euclidean'];
      if (validTypes.includes(type) && this.shapeType !== type) {
        this.shapeType = type;
        console.log(`Shape type set to ${type}`);
        
        // Update corresponding feature flags
        if (type === 'fractal') {
          this.useFractal = true;
          this.useStars = false;
          this.useEuclid = false;
        } else if (type === 'star') {
          this.useFractal = false;
          this.useStars = true;
          this.useEuclid = false;
        } else if (type === 'euclidean') {
          this.useFractal = false;
          this.useStars = false;
          this.useEuclid = true;
        } else {
          this.useFractal = false;
          this.useStars = false;
          this.useEuclid = false;
        }
        
        // Force recreation of base geometry when available
        if (this.baseGeo) {
          this.segmentsChanged = true;
          this.currentGeometryRadius = null; // Invalidate cached radius to force redraw
          this.needsIntersectionUpdate = true;
        }
      }
    },
    
    /**
     * Reset trigger state to prevent false triggers after parameter changes
     */
    resetTriggerState() {
      // Clear any stored trigger state
      if (this.lastTrig) {
        this.lastTrig.clear();
      }
      
      // Reset any timing-related state
      this.lastTriggerTime = 0;
      
      // If this state belongs to a layer, reset the layer's trigger state too
      if (this.layerId !== undefined && window._layers) {
        const layer = window._layers.layers.find(l => l.id === this.layerId);
        if (layer) {
          // Clear the layer's previous vertex positions
          if (layer.prevWorldVertices) {
            layer.prevWorldVertices.clear();
          }
          
          // Clear the layer's last triggered set
          if (layer.lastTrig) {
            layer.lastTrig.clear();
          }
          
          // Mark that trigger state was reset
          layer._triggerStateReset = Date.now();
        }
      }
      
      // Also try to access via global state if available
      if (window._globalState && window._globalState.resetTriggerSystem) {
        window._globalState.resetTriggerSystem();
      }
    }
  };
}