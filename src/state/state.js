// src/state/state.js
import { Tone } from '../audio/audio.js';
import { DEFAULT_VALUES } from '../config/constants.js';
import { clearLabels } from '../ui/domLabels.js';

// Function to generate sequence from 1/modulus to 1.0 in even steps
export function generateSequence(n) {
  const sequence = [];
  const step = 1.0 / n;
  
  for (let i = 1; i <= n; i++) {
    // Calculate sequence as i * step
    sequence.push(i * step);
  }
  
  return sequence;
}

// Create initial application state
export function createAppState() {
  return {
    // Time and animation related state
    lastTime: Tone.now(),
    lastAngle: 0,
    lastTrig: new Set(),
    markers: [],
    // Add these properties to track intersection calculation state
    justCalculatedIntersections: false,
    
    // Additional state to track parameter changes
    lastStepScale: DEFAULT_VALUES.STEP_SCALE,
    lastAngle: DEFAULT_VALUES.ANGLE,

    // User configurable parameters
    bpm: DEFAULT_VALUES.BPM,
    radius: DEFAULT_VALUES.RADIUS,
    copies: DEFAULT_VALUES.COPIES,
    segments: DEFAULT_VALUES.SEGMENTS,
    stepScale: DEFAULT_VALUES.STEP_SCALE,
    angle: DEFAULT_VALUES.ANGLE,
    
    // MODULUS related parameters
    modulusValue: DEFAULT_VALUES.MODULUS_VALUE,
    useModulus: DEFAULT_VALUES.USE_MODULUS,
    
    // Intersection related parameters
    useIntersections: DEFAULT_VALUES.USE_INTERSECTIONS,
    lastUseIntersections: DEFAULT_VALUES.USE_INTERSECTIONS, // Track last state to detect changes
    intersectionPoints: [], // Store detected intersection points
    needsIntersectionUpdate: true, // Flag to track when intersections need to be recalculated
    
    // Lerp/Lag related parameters
    useLerp: false,
    lerpTime: 1.0, // Time in seconds for lerp transitions
    
    // Target values for lerping (only for parameters that can be lerped)
    targetRadius: DEFAULT_VALUES.RADIUS,
    targetStepScale: DEFAULT_VALUES.STEP_SCALE,
    targetAngle: DEFAULT_VALUES.ANGLE,
    
    // Frequency label settings
    showAxisFreqLabels: DEFAULT_VALUES.SHOW_AXIS_FREQ_LABELS,
    showPointsFreqLabels: DEFAULT_VALUES.SHOW_POINTS_FREQ_LABELS,
    lastShowPointsFreqLabels: DEFAULT_VALUES.SHOW_POINTS_FREQ_LABELS,
    pointFreqLabels: [], // Array to store persistent frequency labels
    needsPointFreqLabelsUpdate: false,
    
    // Reference to modifiable baseGeo (will be set in main.js)
    baseGeo: null,
    
    // Track the current geometry's radius to detect changes
    currentGeometryRadius: null,
    
    // State setters
    setBpm(value) {
      // BPM is exempt from lerping - always set immediately
      this.bpm = Number(value);
    },
    
    setRadius(value) {
      // Ensure radius is always a number and within valid range
      const newRadius = Number(value);
      if (!isNaN(newRadius)) {
        // Only update target for lerping if enabled
        this.targetRadius = Math.max(20, Math.min(2048, newRadius));
        // If lerping is disabled, update the actual value immediately
        if (!this.useLerp) {
          this.radius = this.targetRadius;
        }
        // Flag for intersection recalculation
        this.needsIntersectionUpdate = true;
      }
    },
    
    setCopies(value) {
      // Copies is exempt from lerping - always set immediately
      this.copies = Number(value);
      // Flag for intersection recalculation
      this.needsIntersectionUpdate = true;
    },
    
    setSegments(value) {
      // Segments (Number) is exempt from lerping - always set immediately
      this.segments = Number(value);
      // Flag for intersection recalculation
      this.needsIntersectionUpdate = true;
    },
    
    setStepScale(value) {
      this.targetStepScale = Number(value);
      if (!this.useLerp) {
        this.stepScale = this.targetStepScale;
      }
      // Flag for intersection recalculation
      this.needsIntersectionUpdate = true;
    },
    
    setAngle(value) {
      this.targetAngle = Number(value);
      if (!this.useLerp) {
        this.angle = this.targetAngle;
      }
      // Flag for intersection recalculation
      this.needsIntersectionUpdate = true;
    },
    
    setModulusValue(value) {
      this.modulusValue = Number(value);
      // Flag for intersection recalculation if modulus is used
      if (this.useModulus) {
        this.needsIntersectionUpdate = true;
      }
    },
    
    setUseModulus(value) {
      this.useModulus = Boolean(value);
      // Flag for intersection recalculation
      this.needsIntersectionUpdate = true;
    },
    
    setUseIntersections(value) {
      this.useIntersections = Boolean(value);
      // Flag for intersection recalculation if being enabled
      this.needsIntersectionUpdate = true;
    },
    
    setUseLerp(value) {
      this.useLerp = Boolean(value);
      
      // If lerping is disabled, sync all values to targets immediately
      if (!this.useLerp) {
        this.radius = this.targetRadius;
        this.stepScale = this.targetStepScale;
        this.angle = this.targetAngle;
        // Flag for intersection recalculation
        this.needsIntersectionUpdate = true;
      }
    },
    
    setLerpTime(value) {
      this.lerpTime = Math.max(0.1, Math.min(10.0, Number(value)));
    },
    
    // Add methods for frequency label toggles
    setShowAxisFreqLabels(value) {
      this.showAxisFreqLabels = Boolean(value);
    },
    
    setShowPointsFreqLabels(value) {
      this.showPointsFreqLabels = Boolean(value);
      
      // When toggling off, clean up existing point frequency labels
      if (!value && this.pointFreqLabels.length > 0) {
        this.cleanupPointFreqLabels();
      } else if (value) {
        // When toggling on, flag that we need to generate labels
        this.needsPointFreqLabelsUpdate = true;
      }
    },
    
    // Helper method to clean up point frequency labels
    cleanupPointFreqLabels() {
      if (!this.pointFreqLabels || this.pointFreqLabels.length === 0) return;
      
      // Clear all DOM-based labels
      clearLabels();
      
      // Clear the array
      this.pointFreqLabels = [];
    },
    
    // Get scale factor for a specific copy based on modulus
    getScaleFactorForCopy(copyIndex) {
      if (!this.useModulus) {
        // If modulus is not used, use the normal step scale
        return Math.pow(this.stepScale, copyIndex);
      }
      
      // If modulus is used, calculate scale based on the sequence
      const modVal = this.modulusValue;
      
      // Generate sequence from 1/modVal to 1.0 in even steps
      const sequence = generateSequence(modVal);
      
      // Use round-robin to select the multiplier from the sequence
      const sequenceIndex = copyIndex % sequence.length;
      const multiplier = sequence[sequenceIndex];
      
      // Return the multiplier directly
      return multiplier;
    },
    
    // Update lerp values based on time elapsed
    updateLerp(dt) {
      if (!this.useLerp) return;
      
      const oldRadius = this.radius;
      const oldStepScale = this.stepScale;
      const oldAngle = this.angle;
      
      // Calculate lerp factor based on time and lerp duration
      const lerpFactor = Math.min(dt / this.lerpTime, 1.0);
      
      // Lerp only the parameters that should be affected
      this.radius = this.lerp(this.radius, this.targetRadius, lerpFactor);
      this.stepScale = this.lerp(this.stepScale, this.targetStepScale, lerpFactor);
      this.angle = this.lerp(this.angle, this.targetAngle, lerpFactor);
      
      // Check if any lerped value changed significantly enough to update intersections
      if (Math.abs(oldRadius - this.radius) > 0.1 || 
          Math.abs(oldStepScale - this.stepScale) > 0.001 || 
          Math.abs(oldAngle - this.angle) > 0.1) {
        this.needsIntersectionUpdate = true;
      }
      
      // Note: BPM, copies, and segments (Number) are not lerped
    },
    
    // Helper function for linear interpolation
    lerp(start, end, t) {
      return start + (end - start) * t;
    }
  };
}