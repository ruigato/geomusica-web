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
  REFERENCE_FREQ: 440, // Default for reference frequency (A4 = 440Hz)
  FRACTAL_VALUE: 1, // Default fractal value (no subdivision)
  USE_FRACTAL: false, // Default for fractal feature
  STAR_SKIP: 1, // Default for star skip value
  USE_STARS: false, // Default for star polygon feature
  EUCLID_VALUE: 1, // Default Euclidean rhythm value
  USE_EUCLID: false // Default for Euclidean rhythm feature
};

// UI Ranges
export const UI_RANGES = {
  BPM: [20, 300],
  RADIUS: [20, 2048],
  COPIES: [0, 32],
  SEGMENTS: [3, 32],
  STEP_SCALE: [0.01, 10],
  ANGLE: [-180, 180],
  MODULUS_VALUE: [2, 16],
  ALT_SCALE: [0.1, 10],
  ALT_STEP_N: [1, 32],
  TIME_SUBDIVISION_VALUE: [0.125, 8],
  QUANTIZATION_VALUE: [0, 8],
  REFERENCE_FREQ: [220, 880],
  FRACTAL_VALUE: [1, 9],
  EUCLID_VALUE: [1, 12], // UI range for Euclidean rhythm value
  STAR_SKIP: [1, 5] // UI range for star skip value
};

// Parameter ranges (min/max)
export const PARAMETER_RANGES = {
  // BPM range
  BPM: { MIN: 20, MAX: 300, STEP: 1 },
  
  // Shape parameter ranges
  RADIUS: { MIN: 20, MAX: 2048, STEP: 1 },
  COPIES: { MIN: 0, MAX: 32, STEP: 1 },
  SEGMENTS: { MIN: 3, MAX: 32, STEP: 1 },
  STEP_SCALE: { MIN: 0.01, MAX: 10, STEP: 0.01 },
  ANGLE: { MIN: -180, MAX: 180, STEP: 0.1 },
  
  // Modulus parameter ranges
  MODULUS_VALUE: { MIN: 2, MAX: 16, STEP: 1 },
  USE_MODULUS: { MIN: false, MAX: true, STEP: null },
  
  // Scale mod parameter ranges
  ALT_SCALE: { MIN: 0.1, MAX: 10, STEP: 0.01 },
  ALT_STEP_N: { MIN: 1, MAX: 32, STEP: 1 },
  USE_ALT_SCALE: { MIN: false, MAX: true, STEP: null },
  
  // Intersection ranges
  USE_INTERSECTIONS: { MIN: false, MAX: true, STEP: null },
  
  // Frequency label ranges
  SHOW_AXIS_FREQ_LABELS: { MIN: false, MAX: true, STEP: null },
  SHOW_POINTS_FREQ_LABELS: { MIN: false, MAX: true, STEP: null },
  
  // Time subdivision ranges
  TIME_SUBDIVISION_VALUE: { MIN: 0.125, MAX: 8, STEP: 0.125 },
  USE_TIME_SUBDIVISION: { MIN: false, MAX: true, STEP: null },
  
  // Equal temperament ranges
  USE_EQUAL_TEMPERAMENT: { MIN: false, MAX: true, STEP: null },
  REFERENCE_FREQ: { MIN: 220, MAX: 880, STEP: 1 },
  
  // Fractal subdivision range
  FRACTAL_VALUE: { MIN: 1, MAX: 9, STEP: 1 },
  USE_FRACTAL: { MIN: false, MAX: true, STEP: null },
  
  // Euclidean rhythm range
  EUCLID_VALUE: { MIN: 1, MAX: 12, STEP: 1 },
  USE_EUCLID: { MIN: false, MAX: true, STEP: null },
  
  // Star polygon parameters
  STAR_SKIP: { MIN: 1, MAX: 5, STEP: 1 },
  USE_STARS: { MIN: false, MAX: true, STEP: null },
  
  // New quantization parameters
  QUANTIZATION_VALUE: { MIN: 0, MAX: 8, STEP: 1 },
  USE_QUANTIZATION: { MIN: false, MAX: true, STEP: null },
  
  // Note parameter ranges
  DURATION_MODE: { MIN: 'modulo', MAX: 'fixed', STEP: null },
  DURATION_MODULO: { MIN: 1, MAX: 12, STEP: 1 },
  MIN_DURATION: { MIN: 0.1, MAX: 1.0, STEP: 0.01 },
  MAX_DURATION: { MIN: 0.1, MAX: 2.0, STEP: 0.01 },
  DURATION_PHASE: { MIN: 0, MAX: 1, STEP: 0.01 },
  
  VELOCITY_MODE: { MIN: 'modulo', MAX: 'fixed', STEP: null },
  VELOCITY_MODULO: { MIN: 1, MAX: 12, STEP: 1 },
  MIN_VELOCITY: { MIN: 0.1, MAX: 0.9, STEP: 0.01 },
  MAX_VELOCITY: { MIN: 0.2, MAX: 1.0, STEP: 0.01 },
  VELOCITY_PHASE: { MIN: 0, MAX: 1, STEP: 0.01 }
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