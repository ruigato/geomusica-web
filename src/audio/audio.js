// src/audio/audio.js - Updated to handle note objects with improved parameter management

import { Csound } from '@csound/browser';
import { quantizeToEqualTemperament, getNoteName } from './frequencyUtils.js';
import { DEFAULT_VALUES, PARAMETER_RANGES } from '../config/constants.js';
import { initializeTime } from '../time/time.js';

// Debug flag to control audio logging
const DEBUG_AUDIO = false;

// Core audio system variables
let csoundInstance = null;
let audioContext = null;
let csoundStarted = false;
let startTime = 0;
let sampleRate = 44100; 

// Path to the orchestra file
const ORC_FILE_PATH = '/src/audio/GeoMusica.orc';

// We now have a single instrument with ID 1
export const InstrumentType = {
  FM_BELL: 1 // Our only instrument
};

// Default instrument type
let activeInstrument = InstrumentType.FM_BELL;

/**
 * Parameter manager for audio system to handle synchronization and validation
 */
class AudioParameterManager {
  constructor() {
    this.pendingParams = null;
    this.isApplying = false;
    this.defaultParams = {
      attack: DEFAULT_VALUES.ATTACK,
      decay: DEFAULT_VALUES.DECAY,
      sustain: DEFAULT_VALUES.SUSTAIN,
      release: DEFAULT_VALUES.RELEASE,
      brightness: DEFAULT_VALUES.BRIGHTNESS,
      volume: DEFAULT_VALUES.VOLUME
    };
  }

  /**
   * Set pending parameters with validation
   */
  setPendingParams(params) {
    if (!params || typeof params !== 'object') {
      
      return false;
    }

    // Validate and clamp parameter values
    const validatedParams = {};
    
    if (params.attack !== undefined) {
      validatedParams.attack = this.validateRange(params.attack, 
        PARAMETER_RANGES.ATTACK.MIN, 
        PARAMETER_RANGES.ATTACK.MAX, 
        'attack');
    }
    if (params.decay !== undefined) {
      validatedParams.decay = this.validateRange(params.decay, 
        PARAMETER_RANGES.DECAY.MIN, 
        PARAMETER_RANGES.DECAY.MAX, 
        'decay');
    }
    if (params.sustain !== undefined) {
      validatedParams.sustain = this.validateRange(params.sustain, 
        PARAMETER_RANGES.SUSTAIN.MIN, 
        PARAMETER_RANGES.SUSTAIN.MAX, 
        'sustain');
    }
    if (params.release !== undefined) {
      validatedParams.release = this.validateRange(params.release, 
        PARAMETER_RANGES.RELEASE.MIN, 
        PARAMETER_RANGES.RELEASE.MAX, 
        'release');
    }
    if (params.brightness !== undefined) {
      validatedParams.brightness = this.validateRange(params.brightness, 
        PARAMETER_RANGES.BRIGHTNESS.MIN, 
        PARAMETER_RANGES.BRIGHTNESS.MAX, 
        'brightness');
    }
    if (params.volume !== undefined) {
      validatedParams.volume = this.validateRange(params.volume, 
        PARAMETER_RANGES.VOLUME.MIN, 
        PARAMETER_RANGES.VOLUME.MAX, 
        'volume');
    }

    this.pendingParams = validatedParams;
    return true;
  }

  /**
   * Validate and clamp parameter to safe range
   */
  validateRange(value, min, max, paramName) {
    if (isNaN(value) || value === null || value === undefined) {
      
      return this.defaultParams[paramName];
    }
    
    const clamped = Math.max(min, Math.min(max, value));
    if (clamped !== value) {
      
    }
    
    return clamped;
  }

  /**
   * Apply pending parameters with synchronization
   */
  async applyPendingParams() {
    if (!this.pendingParams || this.isApplying) {
      return false;
    }

    if (!csoundInstance || !csoundStarted) {
      
      return false;
    }

    this.isApplying = true;
    
    try {
      const params = this.pendingParams;
      
      // Apply all parameters atomically
      if (params.attack !== undefined) {
        await csoundInstance.setControlChannel("attack", params.attack);
      }
      if (params.decay !== undefined) {
        await csoundInstance.setControlChannel("decay", params.decay);
      }
      if (params.sustain !== undefined) {
        await csoundInstance.setControlChannel("sustain", params.sustain);
      }
      if (params.release !== undefined) {
        await csoundInstance.setControlChannel("release", params.release);
      }
      if (params.brightness !== undefined) {
        await csoundInstance.setControlChannel("brightness", params.brightness);
      }
      if (params.volume !== undefined) {
        await csoundInstance.setControlChannel("masterVolume", params.volume);
      }

      if (DEBUG_AUDIO) {
        
      }
      this.pendingParams = null;
      return true;
    } catch (error) {
      console.error('[AUDIO] Error applying pending parameters:', error);
      return false;
    } finally {
      this.isApplying = false;
    }
  }

  /**
   * Check if there are pending parameters
   */
  hasPendingParams() {
    return this.pendingParams !== null;
  }

  /**
   * Clear pending parameters
   */
  clearPendingParams() {
    this.pendingParams = null;
  }
}

// Create global parameter manager instance
const parameterManager = new AudioParameterManager();

/**
 * Validate note parameters with comprehensive checks
 */
function validateNoteParameters(note) {
  if (!note || typeof note !== 'object') {
    console.error('[AUDIO] Invalid note object - not an object:', note);
    return {
      frequency: 440,
      duration: 0.3,
      velocity: 0.7,
      pan: 0.0,
      noteName: 'A4'
    };
  }

  const validated = {};

  // Validate frequency
  if (isNaN(note.frequency) || note.frequency === undefined || note.frequency === null) {
    
    validated.frequency = 440;
    validated.noteName = note.noteName || 'A4';
  } else if (note.frequency <= 0) {
    
    validated.frequency = 440;
    validated.noteName = note.noteName || 'A4';
  } else if (note.frequency < 10 || note.frequency > 22050) {
    // Extended range check - allow subsonic and ultrasonic but warn
    const clamped = Math.max(20, Math.min(20000, note.frequency));
    
    validated.frequency = clamped;
    validated.noteName = note.noteName || `${clamped}Hz`;
  } else {
    validated.frequency = note.frequency;
    validated.noteName = note.noteName || `${note.frequency}Hz`;
  }

  // Validate duration
  if (isNaN(note.duration) || note.duration === undefined || note.duration === null || note.duration <= 0) {
    
    validated.duration = 0.3;
  } else if (note.duration > 30) {
    // Prevent extremely long notes that could cause memory issues
    
    validated.duration = 30;
  } else {
    validated.duration = note.duration;
  }

  // Validate velocity/amplitude
  if (isNaN(note.velocity) || note.velocity === undefined || note.velocity === null) {
    
    validated.velocity = 0.7;
  } else {
    validated.velocity = Math.max(0, Math.min(1, note.velocity));
    if (validated.velocity !== note.velocity) {
      
    }
  }

  // Validate pan
  if (isNaN(note.pan) || note.pan === undefined || note.pan === null) {
    validated.pan = 0.0;
  } else {
    validated.pan = Math.max(-1, Math.min(1, note.pan));
    if (validated.pan !== note.pan) {
      
    }
  }

  return validated;
}

/**
 * Get the Csound instance
 * @returns {Object|null} Csound instance or null if not initialized
 */
export function getCsoundInstance() {
  return csoundInstance;
}

/**
 * Check if audio system is ready
 * @returns {boolean} True if Csound is initialized and started
 */
export function isAudioReady() {
  return csoundInstance !== null && csoundStarted;
}

/**
 * Get the audio context
 * @returns {AudioContext|null} The audio context or null if not initialized
 */
export function getAudioContext() {
  if (!audioContext) {
    initAudioContext();
  }
  return audioContext;
}

/**
 * Get the shared AudioContext for timing system integration
 * @returns {AudioContext|null} The shared AudioContext instance
 */
export function getSharedAudioContext() {
  return audioContext;
}

// Initialize the Audio Context with immediate availability for timing
function initAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      sampleRate = audioContext.sampleRate;
      
      // Immediately try to initialize timing system if context is ready
      if (audioContext.state === 'running') {
        try {
          if (typeof initializeTime === 'function') {
            initializeTime(audioContext);
            console.log('[AUDIO] Timing system initialized immediately with AudioContext');
          }
        } catch (error) {
          console.warn('[AUDIO] Could not initialize timing immediately:', error);
        }
      }
      
      console.log('[AUDIO] AudioContext created with sample rate:', sampleRate);
    } catch (error) {
      console.error("Failed to create audio context:", error);
    }
  }
  return audioContext;
}

// Helper for consistently getting audio context time
function getAudioContextTime() {
  if (audioContext) {
    const currentTime = audioContext.currentTime;
    if (startTime === 0) {
      startTime = currentTime;
    }
    return currentTime - startTime;
  }
  return performance.now() / 1000;
}

// Load the external orchestra file
async function loadOrchestraFile() {
  try {
    const response = await fetch(ORC_FILE_PATH);
    if (!response.ok) {
      throw new Error(`Failed to load orchestra file (HTTP ${response.status})`);
    }
    return await response.text();
  } catch (error) {
    console.error("Error loading orchestra file:", error);
    throw error;
  }
}

// Setup the audio system
export async function setupAudio({ audioContext: providedAudioContext } = {}) {
  try {
    // Use provided AudioContext if available, otherwise initialize a new one
    if (providedAudioContext) {
      audioContext = providedAudioContext;
      sampleRate = audioContext.sampleRate;
      console.log('[AUDIO] Using provided AudioContext with sample rate:', sampleRate);
    } else {
      // Initialize audio context as fallback
      initAudioContext();
    }
    
    // Create the Csound instance if not already created
    if (!csoundInstance) {
      try {
        // Add buffer size options to the Csound initialization
        const csoundOptions = {
          audioContext: audioContext,
          // Increase buffer size - typical values: 1024, 2048, 4096
          // Larger values reduce glitches but increase latency
          bufferSize: 4096  
        };
          
        csoundInstance = await Csound(csoundOptions);
        
        // Initialize timing system with our AudioContext - CRITICAL for rock-solid timing
        try {
          if (typeof initializeTime === 'function') {
            initializeTime(audioContext);
            console.log('[AUDIO] Timing system initialized with shared AudioContext');
          }
        } catch (error) {
          console.error('[AUDIO] FATAL: Failed to initialize timing system:', error);
          throw error; // This is critical - don't continue without proper timing
        }
        
        // Initialize Csound immediately without waiting for user click
        try {
          // Load and compile the orchestra
          const orchestraCode = await loadOrchestraFile();
          await csoundInstance.compileOrc(orchestraCode);
          await csoundInstance.setOption("-odac");
          await csoundInstance.start();
          csoundStarted = true;
          
          // Initialize timing system with AudioContext on user interaction
          try {
            if (typeof initializeTime === 'function') {
              initializeTime(audioContext);
              console.log('[AUDIO] Timing system initialized with shared AudioContext (user interaction)');
            }
          } catch (error) {
            console.error('[AUDIO] FATAL: Failed to initialize timing system on user interaction:', error);
          }
          
          // Set default parameters
          await csoundInstance.setControlChannel("attack", DEFAULT_VALUES.ATTACK);
          await csoundInstance.setControlChannel("decay", DEFAULT_VALUES.DECAY);
          await csoundInstance.setControlChannel("sustain", DEFAULT_VALUES.SUSTAIN);
          await csoundInstance.setControlChannel("release", DEFAULT_VALUES.RELEASE);
          await csoundInstance.setControlChannel("brightness", DEFAULT_VALUES.BRIGHTNESS);
          await csoundInstance.setControlChannel("masterVolume", DEFAULT_VALUES.VOLUME);
          
          if (DEBUG_AUDIO) {
            
          }
        } catch (error) {
          console.error("[AUDIO] Error during immediate Csound initialization:", error);
          // Fall back to click-based initialization
        }
        
      } catch (error) {
        console.error("Failed to create Csound instance:", error);
        return null;
      }
    }
    
    // Set up first-click handler to ensure audio context is resumed
    document.body.addEventListener('click', async () => {
      try {
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          if (DEBUG_AUDIO) {
            
          }
          audioContextActivated = true;
        }
        
        if (!csoundStarted) {
          try {
            // Load and compile the orchestra
            const orchestraCode = await loadOrchestraFile();
            await csoundInstance.compileOrc(orchestraCode);
            await csoundInstance.setOption("-odac");
            await csoundInstance.start();
            csoundStarted = true;
            
            // Initialize timing system with AudioContext on user interaction
            try {
              if (typeof initializeTime === 'function') {
                initializeTime(audioContext);
                console.log('[AUDIO] Timing system initialized with shared AudioContext (user interaction)');
              }
            } catch (error) {
              console.error('[AUDIO] FATAL: Failed to initialize timing system on user interaction:', error);
            }
            
            // Set default parameters
            await csoundInstance.setControlChannel("attack", DEFAULT_VALUES.ATTACK);
            await csoundInstance.setControlChannel("decay", DEFAULT_VALUES.DECAY);
            await csoundInstance.setControlChannel("sustain", DEFAULT_VALUES.SUSTAIN);
            await csoundInstance.setControlChannel("release", DEFAULT_VALUES.RELEASE);
            await csoundInstance.setControlChannel("brightness", DEFAULT_VALUES.BRIGHTNESS);
            await csoundInstance.setControlChannel("masterVolume", DEFAULT_VALUES.VOLUME);
            
            // Apply any pending parameters
            if (parameterManager.hasPendingParams()) {
              await parameterManager.applyPendingParams();
              if (DEBUG_AUDIO) {
                
              }
            }
            
            // Play a test note
            playNote({
              frequency: 432,
              duration: 0.5,
              velocity: 0.7,
              pan: 0.0
            });
            
          } catch (error) {
            console.error("[AUDIO] Error starting Csound on click:", error);
          }
        }
      } catch (error) {
        console.error("[AUDIO] Error in click handler:", error);
      }
    }, { once: false });
    
    return csoundInstance;
  } catch (error) {
    console.error("Error in setupAudio:", error);
    return null;
  }
}

/**
 * Apply all synth parameters at once
 * This is useful for initializing the synth with saved state
 * @param {Object} params - Object containing all synth parameters
 * @returns {Promise<boolean>} - Promise that resolves to true if successful
 */
export async function applySynthParameters(params) {
  if (!csoundInstance || !csoundStarted) {
    
    
    // Store params to apply when audio starts using parameter manager
    parameterManager.setPendingParams(params);
    return false;
  }
  
  // Use parameter manager for validation and application
  parameterManager.setPendingParams(params);
  return await parameterManager.applyPendingParams();
}

/**
 * Play a note with the active instrument
 * @param {Object} note - Note object with all parameters
 * @returns {boolean} True if successful
 */
export function playNote(note) {
  if (!csoundInstance || !csoundStarted) return false;
  
  try {
    // Use comprehensive parameter validation
    const validatedNote = validateNoteParameters(note);
    
    // Apply any pending parameters before playing the note
    if (parameterManager.hasPendingParams()) {
      parameterManager.applyPendingParams().catch(error => {
        console.error('[AUDIO] Error applying pending parameters:', error);
      });
    }
    
    // Build Csound score event with instrument 1 (FM Bell)
    const scoreEvent = `i 1 0 ${validatedNote.duration} ${validatedNote.frequency} ${validatedNote.velocity} ${validatedNote.duration} ${validatedNote.pan}`;
    
    // Play the note
    csoundInstance.readScore(scoreEvent);
    
    return true;
  } catch (error) {
    console.error("Error playing note:", error);
    return false;
  }
}

// Set master volume (0.0-1.0)
export async function setMasterVolume(volume) {
  if (!csoundInstance || !csoundStarted) {
    // Store as pending parameter if Csound not ready
    parameterManager.setPendingParams({ volume });
    return false;
  }
  
  const validatedVolume = parameterManager.validateRange(volume, 0.0, 1.0, 'volume');
  
  try {
    await csoundInstance.setControlChannel("masterVolume", validatedVolume);
    return true;
  } catch (error) {
    console.error("Error setting master volume:", error);
    return false;
  }
}

/**
 * Trigger audio based on a note object
 * @param {Object} note - Complete note object
 * @returns {Object} The same note object for chaining
 */
export async function triggerAudio(note) {
  if (!csoundInstance || !csoundStarted) return note;
  
  try {
    // Use comprehensive validation
    const validatedNote = validateNoteParameters(note);
    
    // Check if this is a star intersection point
    if (note.isStarIntersection) {
      console.log('Playing star intersection note', note);
      
      // Make star intersection points sound different:
      // 1. Increase brightness for more harmonics
      const currentBrightness = await csoundInstance.getControlChannel("brightness");
      // Temporarily boost brightness for this note
      await csoundInstance.setControlChannel("brightness", Math.min(2.0, currentBrightness * 1.5));
      
      // 2. Add a slight detune to make them sound more distinctive
      validatedNote.frequency *= 1.02; // Slightly larger frequency shift (2% higher)
      
      // 3. Make them a bit louder to stand out
      validatedNote.velocity = Math.min(1.0, validatedNote.velocity * 1.3);
      
      // 4. Use a slightly longer duration
      validatedNote.duration = Math.min(2.0, validatedNote.duration * 1.2);
      
      // Play the modified note
      playNote(validatedNote);
      
      // Reset brightness after a slight delay
      setTimeout(async () => {
        await csoundInstance.setControlChannel("brightness", currentBrightness);
      }, validatedNote.duration * 1000);
    } else {
      // Play a regular note
      playNote(validatedNote);
    }
    
    return validatedNote;
  } catch (error) {
    console.error("Error in triggerAudio:", error);
    return note;
  }
}

// Set envelope parameters
export async function setEnvelope(attack, decay, sustain, release) {
  if (!csoundInstance || !csoundStarted) {
    // Store as pending parameters if Csound not ready
    parameterManager.setPendingParams({ attack, decay, sustain, release });
    return false;
  }
  
  // Use parameter manager for validation
  const params = { attack, decay, sustain, release };
  parameterManager.setPendingParams(params);
  return await parameterManager.applyPendingParams();
}

// Set brightness parameter
export async function setBrightness(brightness) {
  if (!csoundInstance || !csoundStarted) {
    // Store as pending parameter if Csound not ready
    parameterManager.setPendingParams({ brightness });
    return false;
  }
  
  // Use parameter manager for validation
  parameterManager.setPendingParams({ brightness });
  return await parameterManager.applyPendingParams();
}

// Clean up audio system
export async function cleanupAudio() {
  // Clear any pending parameters
  parameterManager.clearPendingParams();
  
  if (csoundInstance) {
    try {
      if (typeof csoundInstance.reset === 'function') {
        await csoundInstance.reset();
      }
      csoundInstance = null;
      csoundStarted = false;
    } catch (error) {
      console.error("Error cleaning up Csound:", error);
    }
  }
  
  if (audioContext) {
    try {
      await audioContext.close();
      audioContext = null;
    } catch (error) {
      console.error("Error closing audio context:", error);
    }
  }
}

// Export a minimal Tone stub for compatibility
export const Tone = {
  now: () => {
    // Use audio context time since getCurrentTime is now in time.js
    return getAudioContextTime();
  },
  start: async () => {
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  },
  getTransport: () => ({
    start: async () => {
      if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    }
  }),
  Synth: class {
    constructor() {}
    toDestination() { return this; }
    triggerAttackRelease(freq, duration) {
      if (csoundInstance && csoundStarted) {
        try {
          const dur = parseFloat(duration) || 0.3;
          playNote({
            frequency: freq,
            duration: dur,
            velocity: 0.7,
            pan: 0
          });
        } catch (error) {
          console.error("Error in triggerAttackRelease:", error);
        }
      }
    }
  }
};