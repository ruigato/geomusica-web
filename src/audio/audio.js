// src/audio/audio.js - Optimized version with testing code removed

import { Csound } from '@csound/browser';

// Core audio system variables
let csoundInstance = null;
let audioContext = null;
let csoundStarted = false;
let startTime = 0;
let sampleRate = 44100; 
let isUsingCsoundTiming = false;
let lastCsoundTime = 0;

// Path to the orchestra file
const ORC_FILE_PATH = '/src/audio/GeoMusica.orc';

// Instrument types
export const InstrumentType = {
  SIMPLE: 5,
  FM: 6,
  ADDITIVE: 7,
  PLUCKED: 8
};

// Default instrument type
let activeInstrument = InstrumentType.SIMPLE;

// Channel for time synchronization with Csound
const TIME_CHANNEL_NAME = "currentTime";

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

// Get current time with Csound's internal clock when available
export function getCurrentTime() {
  if (csoundInstance && csoundStarted && isUsingCsoundTiming) {
    try {
      const csoundTime = csoundInstance.getControlChannel(TIME_CHANNEL_NAME);
      if (typeof csoundTime === 'number' && !isNaN(csoundTime)) {
        lastCsoundTime = csoundTime;
        return csoundTime;
      }
    } catch (error) {
      // Fall back to audio context time on error
    }
  }
  return getAudioContextTime();
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
        csoundInstance = await Csound({ audioContext: audioContext });
      } catch (error) {
        console.error("Failed to create Csound instance:", error);
        return null;
      }
    }
    
    // Set up first-click handler to initialize audio
    document.body.addEventListener('click', async () => {
      try {
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
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
            await csoundInstance.setControlChannel("decay", 0.1);
            await csoundInstance.setControlChannel("sustain", 0.7);
            await csoundInstance.setControlChannel("release", 0.5);
            await csoundInstance.setControlChannel("masterVolume", 0.8);
            
            // Play a test note
            playNote(440, 0.7, 0.5);
            
            // Enable Csound timing
            setTimeout(async () => {
              try {
                await csoundInstance.setControlChannel(TIME_CHANNEL_NAME, 0);
                const initialTime = await csoundInstance.getControlChannel(TIME_CHANNEL_NAME);
                
                if (typeof initialTime === 'number' && !isNaN(initialTime)) {
                  isUsingCsoundTiming = true;
                }
              } catch (e) {
                console.warn("Using AudioContext timing instead of Csound timing");
                isUsingCsoundTiming = false;
              }
            }, 1000);
            
          } catch (error) {
            console.error("Error during Csound setup:", error);
          }
        }
      } catch (error) {
        console.error("Error in audio initialization:", error);
      }
    }, { once: true });
    
    return csoundInstance;
  } catch (error) {
    console.error("Setup error:", error);
    return null;
  }
}

// Play a note with the active instrument
export function playNote(frequency, amplitude = 0.7, duration = 0.2, pan = 0.0) {
  if (!csoundInstance || !csoundStarted) return null;
  
  try {
    // Calculate deterministic pan position if not specified
    if (pan === 0.0) {
      const minFreq = 50;
      const maxFreq = 5000;
      const normalizedFreq = Math.max(0, Math.min(1, 
        Math.log(frequency / minFreq) / Math.log(maxFreq / minFreq)
      ));
      pan = normalizedFreq * 1.6 - 0.8;
    }
    
    // Limit duration to reasonable values
    duration = Math.max(0.05, Math.min(10, duration));
    
    // Add instrument-specific parameters
    let extraParams = "";
    switch (activeInstrument) {
      case InstrumentType.FM:
        extraParams = " 2.0 3.0"; // modRatio and modIndex
        break;
      case InstrumentType.ADDITIVE:
        extraParams = " 1.0"; // brightness
        break;
    }
    
    // Build Csound score event
    const scoreEvent = `i ${activeInstrument} 0 ${duration} ${frequency} ${amplitude} ${duration} ${pan}${extraParams}`;
    
    // Play the note
    csoundInstance.readScore(scoreEvent);
    
    return true;
  } catch (error) {
    console.error("Error playing note:", error);
    return false;
  }
}

// Set active instrument by ID
export function setInstrument(instrumentId) {
  if (Object.values(InstrumentType).includes(instrumentId)) {
    activeInstrument = instrumentId;
    return true;
  }
  return false;
}

// Set master volume (0.0-1.0)
export async function setMasterVolume(volume) {
  if (!csoundInstance || !csoundStarted) return false;
  
  const safeVolume = Math.max(0, Math.min(1, volume));
  
  try {
    await csoundInstance.setControlChannel("masterVolume", safeVolume);
    return true;
  } catch (error) {
    console.error("Error setting master volume:", error);
    return false;
  }
}

// Trigger audio based on polygon vertex passing the axis
export async function triggerAudio(audioInstance, x, y, lastAngle, angle, tNow, options = {}) {
  if (!audioInstance || !csoundStarted) return Math.hypot(x, y);
  
  try {
    // Calculate frequency from coordinates
    const freq = Math.hypot(x, y);
    
    // Calculate pan based on angle
    const angRad = angle % (2 * Math.PI);
    const pan = Math.sin(angRad);
    
    // Use provided instrument if specified in options
    const instrument = options.instrument;
    if (instrument && Object.values(InstrumentType).includes(instrument)) {
      const savedInstrument = activeInstrument;
      setInstrument(instrument);
      playNote(freq, 0.7, 0.2, pan);
      setInstrument(savedInstrument);
    } else {
      playNote(freq, 0.7, 0.2, pan);
    }
    
    return freq;
  } catch (error) {
    console.error("Error in triggerAudio:", error);
    return Math.hypot(x, y);
  }
}

// Set envelope parameters
export async function setEnvelope(attack, decay, sustain, release) {
  if (!csoundInstance || !csoundStarted) return false;
  
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

// Clean up audio system
export async function cleanupAudio() {
  if (csoundInstance) {
    try {
      if (typeof csoundInstance.reset === 'function') {
        await csoundInstance.reset();
      }
      csoundInstance = null;
      csoundStarted = false;
      isUsingCsoundTiming = false;
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
  now: getCurrentTime,
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
          playNote(freq, 0.7, dur);
        } catch (error) {
          console.error("Error in triggerAttackRelease:", error);
        }
      }
    }
  }
};