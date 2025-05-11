// src/state/state.js - Updated with time quantization
import { getCurrentTime } from '../time/time.js';
import { DEFAULT_VALUES, UI_RANGES, TICKS_PER_BEAT, TICKS_PER_MEASURE } from '../config/constants.js';
import { clearLabels } from '../ui/domLabels.js';

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

/**
 * Create initial application state
 * @returns {Object} Application state object
 */
export function createAppState() {
  return {
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
    segments: DEFAULT_VALUES.SEGMENTS,
    stepScale: DEFAULT_VALUES.STEP_SCALE,
    angle: DEFAULT_VALUES.ANGLE,
    
    // SYNTH parameters
    attack: 0.01,
    decay: 0.3,
    sustain: 0.5,
    release: 1.0,
    brightness: 1.0,
    volume: 0.8,
    
    // Equal temperament settings
    useEqualTemperament: DEFAULT_VALUES.USE_EQUAL_TEMPERAMENT,
    referenceFrequency: DEFAULT_VALUES.REFERENCE_FREQUENCY,
    
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
    
    // Intersection related parameters
    useIntersections: DEFAULT_VALUES.USE_INTERSECTIONS,
    lastUseIntersections: DEFAULT_VALUES.USE_INTERSECTIONS,
    intersectionPoints: [],
    needsIntersectionUpdate: true,
    
    // Lerp/Lag related parameters
    useLerp: false,
    lerpTime: DEFAULT_VALUES.LERP_TIME,
    
    // Camera related parameters 
    cameraDistance: 2000,
    targetCameraDistance: 2000,
    cameraLerpSpeed: 0.1, // Adjust this to control camera smoothness
    
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
    
    /**
     * Set BPM value (not affected by lerping)
     * @param {number} value New BPM value
     */
    setBpm(value) {
      this.bpm = Number(value);
    },
    
    /**
     * Set radius value (affected by lerping if enabled)
     * @param {number} value New radius value
     */
    setRadius(value) {
      const newRadius = Number(value);
      if (!isNaN(newRadius)) {
        this.targetRadius = Math.max(20, Math.min(2048, newRadius));
        if (!this.useLerp) {
          this.radius = this.targetRadius;
        }
        this.needsIntersectionUpdate = true;
      }
    },
    
    /**
     * Set copies count (not affected by lerping)
     * @param {number} value New copies value
     */
    setCopies(value) {
      this.copies = Number(value);
      this.needsIntersectionUpdate = true;
    },
    
    /**
     * Set segments count (not affected by lerping)
     * @param {number} value New segments value
     */
    setSegments(value) {
      this.segments = Number(value);
      this.needsIntersectionUpdate = true;
    },
    
    /**
     * Set step scale value (affected by lerping if enabled)
     * @param {number} value New step scale value
     */
    setStepScale(value) {
      this.targetStepScale = Number(value);
      if (!this.useLerp) {
        this.stepScale = this.targetStepScale;
      }
      this.needsIntersectionUpdate = true;
    },
    
    /**
     * Set angle value (affected by lerping if enabled)
     * @param {number} value New angle value
     */
    setAngle(value) {
      this.targetAngle = Number(value);
      if (!this.useLerp) {
        this.angle = this.targetAngle;
      }
      this.needsIntersectionUpdate = true;
    },
    
    /**
     * Set modulus value
     * @param {number} value New modulus value
     */
    setModulusValue(value) {
      this.modulusValue = Number(value);
      if (this.useModulus) {
        this.needsIntersectionUpdate = true;
      }
    },
    
    /**
     * Toggle modulus mode
     * @param {boolean} value Enable/disable modulus
     */
    setUseModulus(value) {
      this.useModulus = Boolean(value);
      this.needsIntersectionUpdate = true;
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
      this.targetAltScale = newValue;
      
      // If lerping is off, update the actual value immediately
      if (!this.useLerp) {
        this.altScale = newValue;
      }
      
      // Always mark for intersection update when alt scale is being used
      if (this.useAltScale) {
        this.needsIntersectionUpdate = true;
      }
    },
    
    /**
     * Set alt step N value
     * @param {number} value New alt step N value
     */
    setAltStepN(value) {
      this.altStepN = Number(value);
      if (this.useAltScale) {
        this.needsIntersectionUpdate = true;
      }
    },
    
    /**
     * Toggle alt scale mode
     * @param {boolean} value Enable/disable alt scale
     */
    setUseAltScale(value) {
      this.useAltScale = Boolean(value);
      this.needsIntersectionUpdate = true;
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
      this.useLerp = Boolean(value);
      
      if (!this.useLerp) {
        this.radius = this.targetRadius;
        this.stepScale = this.targetStepScale;
        this.angle = this.targetAngle;
        this.altScale = this.targetAltScale;
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
      this.referenceFrequency = Math.max(UI_RANGES.REFERENCE_FREQUENCY.MIN, 
                               Math.min(UI_RANGES.REFERENCE_FREQUENCY.MAX, Number(value)));
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
     * Update lerp values based on time elapsed
     * @param {number} dt Time delta
     */
    updateLerp(dt) {
      if (!this.useLerp) return;
      
      const oldRadius = this.radius;
      const oldStepScale = this.stepScale;
      const oldAngle = this.angle;
      const oldAltScale = this.altScale;
      
      const lerpFactor = Math.min(dt / this.lerpTime, 1.0);
      
      this.radius = this.lerp(this.radius, this.targetRadius, lerpFactor);
      this.stepScale = this.lerp(this.stepScale, this.targetStepScale, lerpFactor);
      this.angle = this.lerp(this.angle, this.targetAngle, lerpFactor);
      this.altScale = this.lerp(this.altScale, this.targetAltScale, lerpFactor);
      
      if (Math.abs(oldRadius - this.radius) > 0.1 || 
          Math.abs(oldStepScale - this.stepScale) > 0.001 || 
          Math.abs(oldAngle - this.angle) > 0.1 ||
          Math.abs(oldAltScale - this.altScale) > 0.01) {
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
    }
  };
}