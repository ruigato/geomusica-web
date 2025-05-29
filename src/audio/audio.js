// src/audio/audio.js - Backward Compatibility Layer
// Re-exports from audioCore.js for existing code

// Re-export everything from the core audio system
export {
  setupAudio,
  triggerAudio,
  playNote,
  setAudioEnabled,
  isAudioEnabled,
  getCsoundInstance,
  isAudioReady,
  getAudioContext,
  setMasterVolume,
  setEnvelope,
  setBrightness,
  cleanupAudio,
  Tone
} from './audioCore.js';