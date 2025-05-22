// src/audio/audio.js - Updated to handle note objects

import { Csound } from '@csound/browser';
import { quantizeToEqualTemperament, getNoteName } from './frequencyUtils.js';

// Core audio system variables
let csoundInstance = null;
let audioContext = null;
let csoundStarted = false;
let startTime = 0;
let sampleRate = 44100; 

// Queue for notes received before Csound is ready
let pendingNotes = [];

// Path to the orchestra file
const ORC_FILE_PATH = './src/audio/GeoMusica.orc';

// Expanded instrument types mapping to Csound instruments
export const InstrumentType = {
  FM_BELL: 1,      // Layer 0
  PLUCKED: 2,      // Layer 1
  SOFT_PAD: 3,     // Layer 2
  PERCUSSION: 4    // Layer 3
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
    console.log(`[AUDIO] Attempting to load orchestra file from: ${ORC_FILE_PATH}`);
    
    let response;
    try {
      response = await fetch(ORC_FILE_PATH);
      
      if (!response.ok) {
        console.warn(`[AUDIO] Failed to load orchestra file (HTTP ${response.status}): ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (fetchError) {
      console.warn(`[AUDIO] Initial fetch failed: ${fetchError.message}`);
      
      // Try an alternative path as fallback
      console.log('[AUDIO] Trying alternative path as fallback...');
      const fallbackPath = ORC_FILE_PATH.startsWith('./') ? 
                        ORC_FILE_PATH.substring(2) : // Remove ./ if present
                        `./${ORC_FILE_PATH}`; // Add ./ if not present
      
      console.log(`[AUDIO] Fallback path: ${fallbackPath}`);
      
      try {
        response = await fetch(fallbackPath);
        
        if (!response.ok) {
          throw new Error(`Failed to load orchestra file from fallback path: HTTP ${response.status}`);
        }
      } catch (fallbackError) {
        // Try one more path with '/src/' prefix
        const srcFallbackPath = fallbackPath.includes('/src/') ? 
                               fallbackPath : 
                               fallbackPath.replace('src/', '/src/');
        
        console.log(`[AUDIO] Trying second fallback path: ${srcFallbackPath}`);
        response = await fetch(srcFallbackPath);
        
        if (!response.ok) {
          throw new Error(`All orchestra file paths failed. Last error: HTTP ${response.status}`);
        }
      }
      
      console.log('[AUDIO] Orchestra file loaded from fallback path');
    }
    
    console.log('[AUDIO] Orchestra file loaded successfully');
    const text = await response.text();
    console.log(`[AUDIO] Orchestra file content length: ${text.length} bytes`);
    
    // Log a short preview of the content
    if (text.length > 0) {
      const preview = text.substring(0, 100) + (text.length > 100 ? '...' : '');
      console.log(`[AUDIO] Orchestra file preview: ${preview}`);
    } else {
      console.warn('[AUDIO] Orchestra file is empty!');
    }
    
    return text;
  } catch (error) {
    console.error("[AUDIO] Error loading orchestra file:", error);
    
    // Show an alert dialog to make the error more visible
    setTimeout(() => {
      alert(`Error loading Csound orchestra file: ${error.message}\nPlease check the console for more details.`);
    }, 1000);
    
    throw error;
  }
}

// Setup the audio system
export async function setupAudio() {
  try {
    // Initialize audio context
    initAudioContext();
    
    // Create a visible notification to show Csound needs initialization
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.bottom = '20px';
    notification.style.right = '20px';
    notification.style.padding = '15px';
    notification.style.background = 'rgba(0, 0, 0, 0.8)';
    notification.style.color = 'white';
    notification.style.borderRadius = '5px';
    notification.style.fontFamily = 'Arial, sans-serif';
    notification.style.zIndex = '9999';
    notification.style.cursor = 'pointer';
    notification.innerHTML = '<strong>Click here to initialize audio</strong> (or press Space)';
    notification.id = 'csound-init-notification';
    document.body.appendChild(notification);
    
    // Add a keypress handler to initialize audio with spacebar
    document.addEventListener('keypress', (event) => {
      if (event.code === 'Space' && !csoundStarted) {
        const initNotification = document.getElementById('csound-init-notification');
        if (initNotification) {
          console.log("[AUDIO] Spacebar pressed, triggering audio initialization");
          initNotification.click(); // Simulate click on the notification
        }
      }
    });
    
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
        console.log("[AUDIO] Csound instance created successfully");
        
        // Add specific click handler to the notification
        notification.addEventListener('click', async () => {
          try {
            console.log("[AUDIO] Notification clicked, initializing Csound...");
            // Remove the notification
            document.body.removeChild(notification);
            
            // Add loading indicator
            const loadingIndicator = document.createElement('div');
            loadingIndicator.style.position = 'fixed';
            loadingIndicator.style.bottom = '20px';
            loadingIndicator.style.right = '20px';
            loadingIndicator.style.padding = '15px';
            loadingIndicator.style.background = 'rgba(0, 0, 255, 0.8)';
            loadingIndicator.style.color = 'white';
            loadingIndicator.style.borderRadius = '5px';
            loadingIndicator.style.fontFamily = 'Arial, sans-serif';
            loadingIndicator.style.zIndex = '9999';
            loadingIndicator.innerHTML = '<strong>Initializing audio...</strong>';
            loadingIndicator.id = 'csound-loading-indicator';
            document.body.appendChild(loadingIndicator);
            
            // Resume audio context
            if (audioContext.state === 'suspended') {
              await audioContext.resume();
              console.log("[AUDIO] Audio context resumed on notification click");
            }
            
            // Load and compile the orchestra file with explicit path
            const orcPath = ORC_FILE_PATH;
            console.log(`[AUDIO] Loading orchestra file from: ${orcPath}`);
            
            try {
              const orchestraCode = await loadOrchestraFile();
              console.log("[AUDIO] Orchestra file loaded successfully, compiling...");
              console.log("[AUDIO] Orchestra code length:", orchestraCode.length);
              
              await csoundInstance.compileOrc(orchestraCode);
              console.log("[AUDIO] Orchestra compiled successfully");
              
              await csoundInstance.setOption("-odac");
              await csoundInstance.start();
              csoundStarted = true;
              
              // Ensure audio node is connected to output
              const csoundNode = csoundInstance.getNode();
              if (csoundNode && audioContext) {
                // Safely disconnect if the method exists
                if (csoundNode.disconnect && typeof csoundNode.disconnect === 'function') {
                  csoundNode.disconnect();
                }
                if (csoundNode.connect && typeof csoundNode.connect === 'function') {
                  csoundNode.connect(audioContext.destination);
                  console.log("[AUDIO] Csound node reconnected to audio destination");
                } else {
                  console.log("[AUDIO] Csound node doesn't have connect method, using alternative audio routing");
                  
                  // Alternative routing method for Csound
                  try {
                    // Setup direct Csound output
                    console.log("[AUDIO] Setting up direct Csound audio output");
                    
                    // Create a dummy audio node to keep audio context alive
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 0.001; // Almost silent
                    gainNode.connect(audioContext.destination);
                    
                    // Create a silent oscillator to keep the audio context running
                    const silentOsc = audioContext.createOscillator();
                    silentOsc.frequency.value = 20; // Inaudible frequency
                    silentOsc.connect(gainNode);
                    silentOsc.start();
                    
                    // Store references to prevent garbage collection
                    window.geoMusicaSilentNodes = {
                      gainNode,
                      silentOsc
                    };
                    
                    console.log("[AUDIO] Alternative direct audio output established");
                  } catch (routingError) {
                    console.error("[AUDIO] Error setting up alternative routing:", routingError);
                  }
                }
              }
              
              console.log("[AUDIO] Csound started successfully");
              
              // Remove loading indicator
              const loadingIndicator = document.getElementById('csound-loading-indicator');
              if (loadingIndicator) {
                document.body.removeChild(loadingIndicator);
              }
              
              // Set default parameters
              await csoundInstance.setControlChannel("attack", 0.01);
              await csoundInstance.setControlChannel("decay", 0.3);
              await csoundInstance.setControlChannel("sustain", 0.5);
              await csoundInstance.setControlChannel("release", 1.0);
              await csoundInstance.setControlChannel("brightness", 0.0);
              await csoundInstance.setControlChannel("masterVolume", 1.0);
              
              console.log("[AUDIO] Audio parameters set: masterVolume=1.0, attack=0.01, decay=0.3, sustain=0.5, release=1.0");
              
              // Play a test note with clear audible feedback
              setTimeout(() => {
                playNote({
                  frequency: 440,
                  duration: 1.0,
                  velocity: 1.0,
                  pan: 0
                });
                console.log("[AUDIO] Test note played: A4 (440Hz), duration=1.0s, velocity=1.0");
                
                // Follow with another test note at a different frequency
                setTimeout(() => {
                  playNote({
                    frequency: 880,
                    duration: 1.0,
                    velocity: 1.0,
                    pan: 0
                  });
                  console.log("[AUDIO] Second test note played: A5 (880Hz), duration=1.0s, velocity=1.0");
                  
                  // Play any notes that were queued before initialization
                  setTimeout(() => {
                    playQueuedNotes();
                  }, 500);
                }, 1500);
                
                // Show success message
                const successMsg = document.createElement('div');
                successMsg.style.position = 'fixed';
                successMsg.style.bottom = '20px';
                successMsg.style.right = '20px';
                successMsg.style.padding = '15px';
                successMsg.style.background = 'rgba(0, 128, 0, 0.8)';
                successMsg.style.color = 'white';
                successMsg.style.borderRadius = '5px';
                successMsg.style.fontFamily = 'Arial, sans-serif';
                successMsg.style.zIndex = '9999';
                successMsg.innerHTML = '<strong>Audio initialized successfully!</strong>';
                document.body.appendChild(successMsg);
                
                // Remove the success message after 3 seconds
                setTimeout(() => {
                  document.body.removeChild(successMsg);
                }, 3000);
              }, 500);
              
            } catch (orcError) {
              console.error("[AUDIO] Error loading/compiling orchestra:", orcError);
              
              // Remove loading indicator
              const loadingIndicator = document.getElementById('csound-loading-indicator');
              if (loadingIndicator) {
                document.body.removeChild(loadingIndicator);
              }
              
              // Show error message
              notification.style.background = 'rgba(255, 0, 0, 0.8)';
              notification.innerHTML = '<strong>Error initializing audio. Click to try again.</strong>';
              document.body.appendChild(notification);
            }
          } catch (error) {
            console.error("[AUDIO] Error in notification click handler:", error);
          }
        });
        
      } catch (error) {
        console.error("Failed to create Csound instance:", error);
        return null;
      }
    }
    
    // Set up first-click handler to ensure audio context is resumed
    document.body.addEventListener('click', async (event) => {
      try {
        // Skip if the user clicked on the specific notification
        // We already handle that with a dedicated click handler
        if (event.target.closest('#csound-init-notification')) {
          return;
        }
        
        // Just resume the audio context if suspended
        if (audioContext && audioContext.state === 'suspended') {
          await audioContext.resume();
          console.log("[AUDIO] Audio context resumed on user interaction");
        }
        
        // If Csound isn't started yet, show a notification reminding the user
        if (!csoundStarted) {
          const existingNotification = document.getElementById('csound-init-notification');
          if (existingNotification) {
            // Make the notification more prominent
            existingNotification.style.animation = 'pulse 0.5s 3';
            existingNotification.style.background = 'rgba(255, 165, 0, 0.9)';
            existingNotification.innerHTML = '<strong>Click HERE to initialize audio</strong>';
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
 * Play a note with the appropriate instrument based on layer
 * @param {Object} note - Note object with all parameters
 * @returns {boolean} True if successful
 */
export function playNote(note) {
  if (!csoundInstance || !csoundStarted) {
    console.warn("Note received but Csound not ready:", note);
    return false;
  }
  
  try {
    // Validate required note properties
    if (!note || typeof note !== 'object') {
      console.error("Invalid note object:", note);
      return false;
    }
    
    // Default parameters if not provided
    const freq = note.frequency !== undefined ? note.frequency : 440;
    const dur = note.duration !== undefined ? note.duration : 0.5;
    
    // Increase default velocity for better audibility
    const vel = note.velocity !== undefined ? note.velocity * 1.5 : 1.0; // Amplify velocity
    
    const pan = note.pan !== undefined ? note.pan : 0.0;
    
    // Select instrument based on the note property or default to FM Bell (1)
    const instr = note.instrument || InstrumentType.FM_BELL;
    
    // Log the note being played
    console.log(`[AUDIO] Playing note: freq=${freq.toFixed(1)}Hz, instr=${instr}, duration=${dur.toFixed(2)}s, velocity=${vel.toFixed(2)}, pan=${pan.toFixed(2)}`);
    
    // Format score event with instrument selection - IMPORTANT: no space between 'i' and instrument number
    // i<instrument> <start> <duration> <frequency> <velocity> <pan>
    const scoreEvent = `i${instr} 0 ${dur} ${freq} ${vel} ${pan}`;
    
    // Log the exact score event being sent
    console.log(`[AUDIO SCORE] Sending to Csound: "${scoreEvent}"`);
    
    // Play the note
    try {
      // Use a reliable way to send the score event
      if (csoundInstance.readScore) {
        csoundInstance.readScore(scoreEvent);
      } else if (csoundInstance.evaluateCode) {
        csoundInstance.evaluateCode(scoreEvent);
      }
      
      console.log(`[AUDIO] Score event sent successfully`);
      
      // Always play a Web Audio note regardless of test or not
      // This ensures we hear something even if Csound isn't working
      try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.value = freq;
        
        // For test notes, make them more audible
        // For regular notes, make them less audible (backup only)
        const isTestNote = (freq === 440 || freq === 880);
        gainNode.gain.value = isTestNote ? vel * 0.3 : vel * 0.1; 
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + dur);
        
        setTimeout(() => {
          oscillator.stop();
        }, dur * 1000);
        
        if (isTestNote) {
          console.log(`[AUDIO] Fallback Web Audio note played as backup`);
        }
      } catch (webAudioError) {
        console.warn(`[AUDIO] Fallback Web Audio failed: ${webAudioError.message}`);
      }
    } catch (error) {
      console.error(`[AUDIO] Error sending score event: ${error.message}`);
      console.error(`[AUDIO] Score event was: "${scoreEvent}"`);
      
      // Try alternative method if first one failed
      try {
        if (csoundInstance.inputMessage) {
          console.log(`[AUDIO] Trying alternative inputMessage method`);
          csoundInstance.inputMessage(scoreEvent);
          console.log(`[AUDIO] Alternative score event method successful`);
        }
      } catch (altError) {
        console.error(`[AUDIO] Alternative method also failed: ${altError.message}`);
      }
    }
    
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
  try {
    // Log the incoming note object
    console.log(`[AUDIO TRIGGER] Received note:`, JSON.stringify(note));
    
    if (!csoundInstance || !csoundStarted) {
      console.log("[AUDIO TRIGGER] Csound not ready, queueing note for later playback");
      // Store note in pending queue to play once Csound is initialized
      pendingNotes.push({...note});
      return note;
    }
    
    // Check if we have a valid note object
    if (!note || typeof note !== 'object' || !note.frequency) {
      console.error("[AUDIO TRIGGER] Invalid or incomplete note object received:", note);
      
      // If we have a Csound instance object instead of a proper note,
      // this is a bug. Return a simple valid note object to avoid errors.
      if (note && note.name && note.name.includes("Csound")) {
        console.error("[AUDIO TRIGGER] Received Csound instance instead of note object - this is a bug");
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
    
    // Map layerId to instrument type
    if (noteCopy.layerId !== undefined) {
      // Select instrument based on layerId
      switch (noteCopy.layerId) {
        case 0:
          noteCopy.instrument = InstrumentType.FM_BELL;
          break;
        case 1:
          noteCopy.instrument = InstrumentType.PLUCKED;
          break;
        case 2:
          noteCopy.instrument = InstrumentType.SOFT_PAD;
          break;
        case 3:
          noteCopy.instrument = InstrumentType.PERCUSSION;
          break;
        default:
          noteCopy.instrument = InstrumentType.FM_BELL;
      }
      
      // Log the instrument selection
      console.log(`[AUDIO TRIGGER] Layer ${noteCopy.layerId} mapped to instrument ${noteCopy.instrument}`);
    }
    
    // Make note more audible - increase duration and velocity
    if (noteCopy.duration !== undefined && noteCopy.duration < 0.5) {
      noteCopy.duration = 0.5; // Minimum duration of 0.5 seconds
    }
    
    if (noteCopy.velocity !== undefined && noteCopy.velocity < 0.7) {
      noteCopy.velocity = 0.7; // Minimum velocity of 0.7
    }
    
    console.log(`[AUDIO TRIGGER] Playing enhanced note:`, JSON.stringify(noteCopy));
    
    // Play the note
    playNote(noteCopy);
    
    return noteCopy;
  } catch (error) {
    console.error("[AUDIO TRIGGER] Error in triggerAudio:", error);
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

// Function to play queued notes after Csound is initialized
function playQueuedNotes() {
  if (pendingNotes.length > 0) {
    console.log("[AUDIO] Playing queued notes");
    for (const note of pendingNotes) {
      playNote(note);
    }
    pendingNotes = [];
  } else {
    console.log("[AUDIO] No queued notes to play");
  }
}