// src/audio/audio.js - Updated to handle note objects

import { Csound } from '@csound/browser';
import { quantizeToEqualTemperament, getNoteName } from './frequencyUtils.js';

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

// Initialize the Audio Context
function initAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      sampleRate = audioContext.sampleRate;
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
export async function setupAudio() {
  try {
    // Initialize audio context
    initAudioContext();
    
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
        
        // Initialize Csound immediately without waiting for user click
        try {
          // Load and compile the orchestra
          const orchestraCode = await loadOrchestraFile();
          await csoundInstance.compileOrc(orchestraCode);
          await csoundInstance.setOption("-odac");
          await csoundInstance.start();
          csoundStarted = true;
          
          // Set default parameters
          await csoundInstance.setControlChannel("attack", 0.01);
          await csoundInstance.setControlChannel("decay", 0.3);
          await csoundInstance.setControlChannel("sustain", 0.5);
          await csoundInstance.setControlChannel("release", 1.0);
          await csoundInstance.setControlChannel("brightness", 0.0);
          await csoundInstance.setControlChannel("masterVolume", 0.8);
          
          console.log("[AUDIO] Csound initialized and started successfully");
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
          console.log("[AUDIO] Audio context resumed on user interaction");
        }
        
        if (!csoundStarted) {
          try {
            // Load and compile the orchestra
            const orchestraCode = await loadOrchestraFile();
            await csoundInstance.compileOrc(orchestraCode);
            await csoundInstance.setOption("-odac");
            await csoundInstance.start();
            csoundStarted = true;
            
            // Set default parameters
            await csoundInstance.setControlChannel("attack", 0.01);
            await csoundInstance.setControlChannel("decay", 0.3);
            await csoundInstance.setControlChannel("sustain", 0.5);
            await csoundInstance.setControlChannel("release", 1.0);
            await csoundInstance.setControlChannel("brightness", 0.0);
            await csoundInstance.setControlChannel("masterVolume", 0.8);
            
            // Check if we have any pending parameters to apply
            if (window.pendingSynthParams) {
              applySynthParameters(window.pendingSynthParams).then(() => {
                console.log("Applied pending synth parameters after initialization");
              });
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
    console.warn("Csound not initialized yet, will apply parameters on first note");
    
    // Store params to apply when audio starts
    window.pendingSynthParams = params;
    return false;
  }
  
  try {
    // Apply all parameters
    await csoundInstance.setControlChannel("attack", params.attack || 0.01);
    await csoundInstance.setControlChannel("decay", params.decay || 0.3);
    await csoundInstance.setControlChannel("sustain", params.sustain || 0.5);
    await csoundInstance.setControlChannel("release", params.release || 1.0);
    await csoundInstance.setControlChannel("brightness", params.brightness || 0.0);
    await csoundInstance.setControlChannel("masterVolume", params.volume || 0.8);
    
    console.log("All synth parameters applied successfully:", params);
    return true;
  } catch (error) {
    console.error("Error applying synth parameters:", error);
    return false;
  }
}

/**
 * Play a note with the active instrument
 * @param {Object} note - Note object with all parameters
 * @returns {boolean} True if successful
 */
// Improved playNote function in audio.js
export function playNote(note) {
  if (!csoundInstance || !csoundStarted) return false;
  
  try {
    // Log the full note object
    
    // Extract parameters with proper defaults
    const frequency = note && note.frequency ? note.frequency : 440;
    const amplitude = note && note.velocity ? note.velocity : 0.7;
    const duration = note && note.duration ? note.duration : 0.3;
    const pan = note && note.pan ? note.pan : 0.0;
    
  
    // Apply any pending parameters before playing the note
    if (window.pendingSynthParams) {
     
      // Apply parameters directly (don't wait for the Promise)
      if (window.pendingSynthParams.attack !== undefined) 
        csoundInstance.setControlChannel("attack", window.pendingSynthParams.attack);
      if (window.pendingSynthParams.decay !== undefined) 
        csoundInstance.setControlChannel("decay", window.pendingSynthParams.decay);
      if (window.pendingSynthParams.sustain !== undefined) 
        csoundInstance.setControlChannel("sustain", window.pendingSynthParams.sustain);
      if (window.pendingSynthParams.release !== undefined) 
        csoundInstance.setControlChannel("release", window.pendingSynthParams.release);
      if (window.pendingSynthParams.brightness !== undefined) 
        csoundInstance.setControlChannel("brightness", window.pendingSynthParams.brightness);
      if (window.pendingSynthParams.volume !== undefined) 
        csoundInstance.setControlChannel("masterVolume", window.pendingSynthParams.volume);
      
      // Clear pending parameters
      window.pendingSynthParams = null;
    }
    
    // Limit duration to reasonable values
    const safeDuration = Math.max(0.05, Math.min(10, duration));
    

    
    // Build Csound score event with instrument 1 (FM Bell)
    const scoreEvent = `i 1 0 ${safeDuration} ${frequency} ${amplitude} ${safeDuration} ${pan}`;
    
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
    if (!window.pendingSynthParams) window.pendingSynthParams = {};
    window.pendingSynthParams.volume = volume;
    return false;
  }
  
  const safeVolume = Math.max(0, Math.min(1, volume));
  
  try {
    await csoundInstance.setControlChannel("masterVolume", safeVolume);
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
// Improved triggerAudio function in audio.js
export async function triggerAudio(note) {
  if (!csoundInstance || !csoundStarted) return note;
  
  try {
    // Log the received note
    
    // Check if we have a valid note object
    if (!note || typeof note !== 'object' || !note.frequency) {
      console.error("Invalid or incomplete note object received:", note);
      
      // If we have a Csound instance object instead of a proper note,
      // this is a bug. Return a simple valid note object to avoid errors.
      if (note && note.name && note.name.includes("Csound")) {
        return playNote({
          frequency: 440,
          duration: 0.3,
          velocity: 0.7,
          pan: 0
        });
      }
      
      return note;
    }
    
    // Create a fresh copy to avoid reference issues
    const noteCopy = { ...note };
    
    // Play the note
    playNote(noteCopy);
    
    return noteCopy;
  } catch (error) {
    console.error("Error in triggerAudio:", error);
    return note;
  }
}

// Set envelope parameters
export async function setEnvelope(attack, decay, sustain, release) {
  if (!csoundInstance || !csoundStarted) {
    // Store as pending parameters if Csound not ready
    if (!window.pendingSynthParams) window.pendingSynthParams = {};
    window.pendingSynthParams.attack = attack;
    window.pendingSynthParams.decay = decay;
    window.pendingSynthParams.sustain = sustain;
    window.pendingSynthParams.release = release;
    return false;
  }
  
  try {
    await csoundInstance.setControlChannel("attack", attack);
    await csoundInstance.setControlChannel("decay", decay);
    await csoundInstance.setControlChannel("sustain", sustain);
    await csoundInstance.setControlChannel("release", release);
    return true;
  } catch (error) {
    console.error("Error setting envelope:", error);
    return false;
  }
}

// Set brightness parameter
export async function setBrightness(brightness) {
  if (!csoundInstance || !csoundStarted) {
    // Store as pending parameter if Csound not ready
    if (!window.pendingSynthParams) window.pendingSynthParams = {};
    window.pendingSynthParams.brightness = brightness;
    return false;
  }
  
  try {
    await csoundInstance.setControlChannel("brightness", brightness);
    return true;
  } catch (error) {
    console.error("Error setting brightness:", error);
    return false;
  }
}

// Start Csound time updates - now just a stub
export function startCsoundTimeUpdates() {
  console.log("[TIMING] Csound timing disabled, using browser performance timing");
  return true;
}

// Stop Csound time updates - now just a stub
export function stopCsoundTimeUpdates() {
  console.log("[TIMING] No Csound time updates to stop");
}

// Clean up audio system
export async function cleanupAudio() {
  // Stop time updates first
  stopCsoundTimeUpdates();
  
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

/**
 * Csound timer stub for compatibility
 * @returns {Promise<boolean>} Always resolves to true
 */
export async function startCsoundTimer() {
  console.log("[TIMING] Csound timing disabled, using browser performance timing");
  return true;
}