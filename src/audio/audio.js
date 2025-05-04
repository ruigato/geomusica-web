// src/audio/audio.js
import { Csound } from '@csound/browser';

// Globals
let csoundInstance = null;
let audioContext = null;

// Explicitly define whether Csound has started
let csoundStarted = false;

// Create a channel variable to control frequency in real-time
let currentFrequency = 440;
// Path to the orchestra file
const ORC_FILE_PATH = '/src/audio/GeoMusica.orc';
// Basic Csound orchestra with ALL logic included
// This approach puts everything in the orchestra to avoid score syntax errors
const FULL_ORCHESTRA = `
sr = 44100
ksmps = 128
nchnls = 2
0dbfs = 1

; Global variables for real-time control
gkFreq chnexport "frequency", 1
giAmp chnexport "amplitude", 1

; Define function table for sine wave
giSine ftgen 1, 0, 16384, 10, 1

; Simple always-on instrument that reads from channels
instr 1
  ; Read frequency and amplitude from channels
  kfreq = gkFreq
  kamp = giAmp
  
  ; Simple oscillator
  asig poscil kamp, kfreq, giSine


  
  ; Direct output
  outs asig, asig
endin

; Start instrument 1 and keep it running
schedule 1, 0, 100000 ; Run for a very long time
`;

// Initialize the Audio Context
function initAudioContext() {
  if (!audioContext) {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log("Audio context created:", audioContext.state);
    } catch (error) {
      console.error("Failed to create audio context:", error);
    }
  }
  
  return audioContext;
}

// Simple time reference
export function getCurrentTime() {
  return performance.now() / 1000;
}

// Load the orchestra file
async function loadOrchestraFile() {
  try {
    console.log("Attempting to load orchestra file from:", ORC_FILE_PATH);
    const response = await fetch(ORC_FILE_PATH);
    
    if (!response.ok) {
      throw new Error(`Failed to load orchestra file (HTTP ${response.status})`);
    }
    
    const orchestraCode = await response.text();
    console.log("Orchestra file loaded successfully:", orchestraCode.length, "bytes");
    return orchestraCode;
  } catch (error) {
    console.error("Error loading orchestra file:", error);
    console.log("Using fallback orchestra code");
    return FALLBACK_ORCHESTRA;
  }
}

// Setup the audio system
export async function setupAudio() {
  try {
    // Initialize audio context
    initAudioContext();
    
    // Create the Csound instance only if not already created
    if (!csoundInstance) {
      try {
        console.log("Creating Csound instance...");
        csoundInstance = await Csound({
          // Use minimal settings to avoid complexity
          audioContext: audioContext
        });
        console.log("Csound instance created successfully");
      } catch (error) {
        console.error("Failed to create Csound instance:", error);
        return null;
      }
    }
    
    // Set up first-click handler to initialize audio
    document.body.addEventListener('click', async () => {
      try {
        // First check audio context state
        if (audioContext.state === 'suspended') {
          console.log("Resuming audio context...");
          await audioContext.resume();
          console.log("Audio context resumed");
        }
        
        if (!csoundStarted) {
          // Compile the orchestra with everything included
          try {
            console.log("Compiling full orchestra...");
            await csoundInstance.compileOrc(FULL_ORCHESTRA);
            console.log("Orchestra compiled successfully");
            
            // Set output to audio device explicitly
            console.log("Setting output to audio device (dac)...");
            await csoundInstance.setOption("-odac");
            console.log("Output option set");
            
            // Start Csound
            console.log("Starting Csound...");
            await csoundInstance.start();
            csoundStarted = true;
            console.log("Csound started successfully");
            
            // Initialize channels with default values
            console.log("Setting initial channel values...");
            await csoundInstance.setControlChannel("frequency", 440);
            await csoundInstance.setControlChannel("amplitude", 0.8);
            console.log("Channels initialized");
            
            // Play a test tone by changing frequency
            console.log("Playing test frequency...");
            await csoundInstance.setControlChannel("frequency", 880);
            await csoundInstance.setControlChannel("amplitude", 0.9);
            // Test tone will play because instrument 1 is always on
            
            // Return to default after 1 second
            setTimeout(async () => {
              await csoundInstance.setControlChannel("frequency", 440);
              await csoundInstance.setControlChannel("amplitude", 0.0);
              console.log("Test complete");
            }, 1000);
            
          } catch (error) {
            console.error("Error during Csound setup:", error);
          }
        } else {
          console.log("Csound already started");
        }
      } catch (error) {
        console.error("General error in click handler:", error);
      }
    }, { once: true });
    
    // Set up keyboard listeners for testing
    document.addEventListener('keydown', async (e) => {
      // Test tone (C key)
      if (e.key === 'c' || e.key === 'C') {
        console.log("C key pressed - testing Csound...");
        
        if (!csoundInstance || !csoundStarted) {
          console.error("Csound not initialized");
          return;
        }
        
        try {
          // Play test tone by modifying channel values
          console.log("Setting test frequency to 880Hz...");
          await csoundInstance.setControlChannel("frequency", 880);
          await csoundInstance.setControlChannel("amplitude", 0.9);
          
          // Keep it on for 3 seconds
          console.log("Playing for 3 seconds...");
          
          // Turn off after 3 seconds
          setTimeout(async () => {
            await csoundInstance.setControlChannel("amplitude", 0.0);
            console.log("Test tone stopped");
          }, 3000);
        } catch (error) {
          console.error("Error in Csound test:", error);
        }
      }
      
      // Status check (S key)
      else if (e.key === 's' || e.key === 'S') {
        console.log("S key pressed - checking status...");
        console.log("Audio context:", audioContext ? audioContext.state : "not created");
        console.log("Csound instance:", csoundInstance ? "exists" : "not created");
        console.log("csoundStarted flag:", csoundStarted);
        
        try {
          if (csoundInstance) {
            console.log("Csound properties:");
            console.log("- started:", csoundInstance.started);
            console.log("- initialized:", csoundInstance.initialized);
            
            // Try to check channel values
            try {
              const freqValue = await csoundInstance.getControlChannel("frequency");
              const ampValue = await csoundInstance.getControlChannel("amplitude");
              console.log("- current frequency:", freqValue);
              console.log("- current amplitude:", ampValue);
            } catch (e) {
              console.log("- couldn't read channel values");
            }
          }
        } catch (error) {
          console.error("Error checking Csound properties:", error);
        }
      }
      
      // Initialize audio (I key)
      else if (e.key === 'i' || e.key === 'I') {
        console.log("I key pressed - initializing audio system...");
        
        try {
          // Resume audio context
          if (audioContext && audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log("Audio context resumed");
          }
          
          // Initialize Csound step by step
          if (csoundInstance && !csoundStarted) {
            // Compile orchestra
            console.log("Compiling orchestra...");
            await csoundInstance.compileOrc(FULL_ORCHESTRA);
            console.log("Orchestra compilation successful");
            
            // Set output to audio device explicitly
            console.log("Setting output to audio device (dac)...");
            await csoundInstance.setOption("-odac");
            console.log("Output options set");
            
            // Start Csound
            console.log("Starting Csound...");
            await csoundInstance.start();
            csoundStarted = true;
            console.log("Csound started successfully");
            
            // Initialize channels
            await csoundInstance.setControlChannel("frequency", 440);
            await csoundInstance.setControlChannel("amplitude", 0.0);
          } else {
            console.log("Csound already initialized or no instance available");
          }
        } catch (error) {
          console.error("Error during initialization:", error);
        }
      }
      
      // Volume test (V key) - play extremely loud tone
      else if (e.key === 'v' || e.key === 'V') {
        if (csoundInstance && csoundStarted) {
          console.log("Playing LOUD test tone...");
          try {
            // Set channels for loud test
            await csoundInstance.setControlChannel("frequency", 440);
            await csoundInstance.setControlChannel("amplitude", 0.99);
            
            // Turn off after 2 seconds
            setTimeout(async () => {
              await csoundInstance.setControlChannel("amplitude", 0.0);
              console.log("Loud test stopped");
            }, 2000);
          } catch (error) {
            console.error("Error playing loud test:", error);
          }
        } else {
          console.log("Csound not ready for volume test");
        }
      }
    });
    
    return csoundInstance;
  } catch (error) {
    console.error("Setup error:", error);
    return null;
  }
}

// Trigger audio - using channel control
export async function triggerAudio(audioInstance, x, y, lastAngle, angle, tNow, options = {}) {
  // Skip if no instance or not started
  if (!audioInstance || !csoundStarted) return Math.hypot(x, y);
  
  try {
    // Calculate frequency from coordinates
    const freq = Math.hypot(x, y);
    
    // Store for reference
    currentFrequency = freq;
    
    // Set channels without awaiting to avoid performance issues
    try {
      audioInstance.setControlChannel("frequency", freq);
      audioInstance.setControlChannel("amplitude", 0.9);
      
      // Automatically decrease amplitude after a short time
      setTimeout(() => {
        // Only decrease if we're still on this frequency
        if (currentFrequency === freq) {
          audioInstance.setControlChannel("amplitude", 0.0);
        }
      }, 200);
    } catch (error) {
      // Only log occasionally to avoid console spam
      if (Math.random() < 0.01) {
        console.error("Error triggering audio:", error);
      }
    }
    
    return freq;
  } catch (error) {
    return Math.hypot(x, y);
  }
}

// Clean up
export async function cleanupAudio() {
  if (csoundInstance) {
    try {
      // Turn off sound
      if (csoundStarted) {
        await csoundInstance.setControlChannel("amplitude", 0);
      }
      
      // Reset Csound
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

// Export a stub of Tone to maintain compatibility
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
    constructor() {
      // Stub constructor
    }
    
    toDestination() {
      return this;
    }
    
    triggerAttackRelease(freq, duration) {
      if (csoundInstance && csoundStarted) {
        try {
          const dur = parseFloat(duration) || 0.3;
          
          // Set the channels
          csoundInstance.setControlChannel("frequency", freq);
          csoundInstance.setControlChannel("amplitude", 0.9);
          
          // Schedule amplitude to return to 0 after duration
          setTimeout(() => {
            csoundInstance.setControlChannel("amplitude", 0.0);
          }, dur * 1000);
        } catch (error) {
          console.error("Error in triggerAttackRelease:", error);
        }
      }
    }
  }
};