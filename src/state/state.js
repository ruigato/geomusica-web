// src/state/state.js
import { Tone } from '../audio/audio.js';
import { DEFAULT_VALUES } from '../config/constants.js';

// Create initial application state
export function createAppState() {
  return {
    // Time and animation related state
    lastTime: Tone.now(),
    lastAngle: 0,
    lastTrig: new Set(),
    markers: [],
    
    // User configurable parameters
    bpm: DEFAULT_VALUES.BPM,
    radius: DEFAULT_VALUES.RADIUS,
    copies: DEFAULT_VALUES.COPIES,
    segments: DEFAULT_VALUES.SEGMENTS,
    stepScale: DEFAULT_VALUES.STEP_SCALE,
    angle: DEFAULT_VALUES.ANGLE,
    
    // Lerp/Lag related parameters
    useLerp: false,
    lerpTime: 1.0, // Time in seconds for lerp transitions
    
    // Target values for lerping (only for parameters that can be lerped)
    targetRadius: DEFAULT_VALUES.RADIUS,
    targetStepScale: DEFAULT_VALUES.STEP_SCALE,
    targetAngle: DEFAULT_VALUES.ANGLE,
    
    // Reference to modifiable baseGeo (will be set in main.js)
    baseGeo: null,
    
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
      }
    },
    
    setCopies(value) {
      // Copies is exempt from lerping - always set immediately
      this.copies = Number(value);
    },
    
    setSegments(value) {
      // Segments (Number) is exempt from lerping - always set immediately
      this.segments = Number(value);
    },
    
    setStepScale(value) {
      this.targetStepScale = Number(value);
      if (!this.useLerp) {
        this.stepScale = this.targetStepScale;
      }
    },
    
    setAngle(value) {
      this.targetAngle = Number(value);
      if (!this.useLerp) {
        this.angle = this.targetAngle;
      }
    },
    
    setUseLerp(value) {
      this.useLerp = Boolean(value);
      
      // If lerping is disabled, sync all values to targets immediately
      if (!this.useLerp) {
        this.radius = this.targetRadius;
        this.stepScale = this.targetStepScale;
        this.angle = this.targetAngle;
      }
    },
    
    setLerpTime(value) {
      this.lerpTime = Math.max(0.1, Math.min(10.0, Number(value)));
    },
    
    // Update lerp values based on time elapsed
    updateLerp(dt) {
      if (!this.useLerp) return;
      
      // Calculate lerp factor based on time and lerp duration
      const lerpFactor = Math.min(dt / this.lerpTime, 1.0);
      
      // Lerp only the parameters that should be affected
      this.radius = this.lerp(this.radius, this.targetRadius, lerpFactor);
      this.stepScale = this.lerp(this.stepScale, this.targetStepScale, lerpFactor);
      this.angle = this.lerp(this.angle, this.targetAngle, lerpFactor);
      
      // Note: BPM, copies, and segments (Number) are not lerped
    },
    
    // Helper function for linear interpolation
    lerp(start, end, t) {
      return start + (end - start) * t;
    }
  };
}