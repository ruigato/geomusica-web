// src/config/constants.js - Updated with note parameter constants

// Animation constants
export const MARK_LIFE = 30;

// Overlapping points threshold distance (in world units)
export const OVERLAP_THRESHOLD = 20;

// Vertex visualization
export const VERTEX_CIRCLE_SIZE = 1;
export const VERTEX_CIRCLE_OPACITY = 0.7;
export const VERTEX_CIRCLE_COLOR = 0x33ccff;

// Intersection visualization
export const INTERSECTION_POINT_SIZE = 16;
export const INTERSECTION_POINT_COLOR = 0xff3366;
export const INTERSECTION_POINT_OPACITY = 0.8;
export const INTERSECTION_MERGE_THRESHOLD = 5; // Distance threshold for merging intersection points

// Text label constants
export const TEXT_LABEL_SIZE = 12;
export const TEXT_LABEL_COLOR = 0xffffff;
export const TEXT_LABEL_OFFSET_Y = 20; // Offset to position text above marker
export const TEXT_LABEL_OPACITY = 0.9;

// Time subdivision constants
export const TICKS_PER_BEAT = 480;
export const TICKS_PER_MEASURE = 1920; // In 4/4 time (480 ticks/beat * 4 beats/measure)

// Default values
export const DEFAULT_VALUES = {
  BPM: 120,
  RADIUS: 432,
  COPIES: 1,
  SEGMENTS: 4,
  STEP_SCALE: 1,
  ANGLE: 15,
  LERP_TIME: 1.0,
  MODULUS_VALUE: 4,
  USE_MODULUS: false,
  USE_INTERSECTIONS: false, // Default for intersection feature
  SHOW_AXIS_FREQ_LABELS: true, // Default for axis crossing frequency labels
  SHOW_POINTS_FREQ_LABELS: false, // Default for point frequency labels
  ALT_SCALE: 1.2, // Default alt scale value
  ALT_STEP_N: 2, // Default apply alt scale every N copies
  USE_ALT_SCALE: false, // Default for alt scale feature
  TIME_SUBDIVISION_VALUE: 1, // Default time subdivision value (1x normal speed)
  USE_TIME_SUBDIVISION: false, // Default for time subdivision feature (disabled)
  USE_EQUAL_TEMPERAMENT: false, // Default for equal temperament feature (disabled)
  REFERENCE_FREQUENCY: 432, // Default reference frequency (A4 = 440Hz)
  // New quantization parameters
  QUANTIZATION_VALUE: "1/4", // Default to quarter notes
  USE_QUANTIZATION: false,    // Off by default
  
  // Note parameter defaults
  DURATION_MODE: 'modulo',   // Default to modulo mode
  DURATION_MODULO: 3,        // Default duration modulo value
  MIN_DURATION: 0.1,         // Default minimum duration (seconds)
  MAX_DURATION: 0.5,         // Default maximum duration (seconds)
  DURATION_PHASE: 0,         // Default duration phase (0-1)
  
  VELOCITY_MODE: 'modulo',   // Default to modulo mode
  VELOCITY_MODULO: 4,        // Default velocity modulo value
  MIN_VELOCITY: 0.3,         // Default minimum velocity (0-1)
  MAX_VELOCITY: 0.9,          // Default maximum velocity (0-1)
  VELOCITY_PHASE: 0,         // Default velocity phase (0-1)
  
  // Fractal subdivision defaults
  FRACTAL_VALUE: 1,          // Default fractal subdivision value (1 = no subdivision)
  USE_FRACTAL: false          // Default to off
};

// UI ranges
export const UI_RANGES = {
  BPM: { MIN: 0, MAX: 240, STEP: 1 },
  RADIUS: { MIN: 20, MAX: 2048, STEP: 1 },
  COPIES: { MIN: 0, MAX: 32, STEP: 1 },
  STEP_SCALE: { MIN: 0.1, MAX: 2, STEP: 0.01 },
  ANGLE: { MIN: -180, MAX: 180, STEP: 0.1 },
  NUMBER: { MIN: 2, MAX: 12, STEP: 1 },
  LERP_TIME: { MIN: 0.1, MAX: 5.0, STEP: 0.1 },
  MODULUS: { MIN: 1, MAX: 12, STEP: 1 },
  ALT_SCALE: { MIN: 0.1, MAX: 10, STEP: 0.01 }, // Range for alt scale
  ALT_STEP_N: { MIN: 1, MAX: 32, STEP: 1 }, // Range for alt step N
  TIME_SUBDIVISION: { MIN: 0.5, MAX: 8, STEP: 0.5 }, // Range for time subdivision
  REFERENCE_FREQUENCY: { MIN: 415, MAX: 466, STEP: 1 }, // Range for reference frequency
  
  // Note parameter ranges
  MIN_DURATION: { MIN: 0.05, MAX: 1.0, STEP: 0.01 },
  MAX_DURATION: { MIN: 0.1, MAX: 2.0, STEP: 0.01 },
  MIN_VELOCITY: { MIN: 0.1, MAX: 0.9, STEP: 0.01 },
  MAX_VELOCITY: { MIN: 0.2, MAX: 1.0, STEP: 0.01 },
  
  // Fractal subdivision range
  FRACTAL: { MIN: 1, MAX: 9, STEP: 1 }
};

// Add this list of valid quantization values for reference
export const QUANTIZATION_VALUES = [
  "1/1",    // Whole notes - one per measure
  "1/2",    // Half notes - two per measure
  "1/2T",   // Half note triplets - three per measure
  "1/4",    // Quarter notes - four per measure (one per beat in 4/4)
  "1/4T",   // Quarter note triplets - six per measure
  "1/8",    // Eighth notes - eight per measure
  "1/8T",   // Eighth note triplets - twelve per measure
  "1/16",   // Sixteenth notes - sixteen per measure
  "1/16T",  // Sixteenth note triplets - twenty-four per measure
  "1/32",   // Thirty-second notes - thirty-two per measure
];