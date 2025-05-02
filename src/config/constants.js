// src/config/constants.js

// Animation constants
export const MARK_LIFE = 30;

// Default values
export const DEFAULT_VALUES = {
  BPM: 120,
  RADIUS: 432,
  COPIES: 1,
  SEGMENTS: 4,
  STEP_SCALE: 1.1,
  ANGLE: 0,
  LERP_TIME: 1.0
};

// UI ranges
export const UI_RANGES = {
  BPM: { MIN: 0, MAX: 240, STEP: 1 },
  RADIUS: { MIN: 20, MAX: 2048, STEP: 1 },
  COPIES: { MIN: 0, MAX: 32, STEP: 1 },
  STEP_SCALE: { MIN: 0.1, MAX: 2, STEP: 0.01 },
  ANGLE: { MIN: -180, MAX: 180, STEP: 0.1 },
  NUMBER: { MIN: 2, MAX: 12, STEP: 1 },
  LERP_TIME: { MIN: 0.1, MAX: 5.0, STEP: 0.1 }
};