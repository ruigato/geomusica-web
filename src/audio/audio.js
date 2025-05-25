// src/audio/audio.js - Updated to handle note objects with improved parameter management

import { Csound } from '@csound/browser';
import { quantizeToEqualTemperament, getNoteName } from './frequencyUtils.js';
import { DEFAULT_VALUES, PARAMETER_RANGES } from '../config/constants.js';

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

// Flag to control Csound message logging
let csoundLoggingEnabled = false;

// We now have a single instrument with ID 1
export const InstrumentType = {
  FM_BELL: 1 // Our only instrument
};

// Default instrument type
let activeInstrument = InstrumentType.FM_BELL;

/**
 * Disable Csound message logging to clean up the console
 */
export async function disableCsoundLogs() {
  if (!csoundInstance) return false;
  
  try {
    // Set message level to suppress all messages
    // Multiple approaches to ensure it works
    await csoundInstance.setOption("-m0"); // General message level
    await csoundInstance.setOption("--message-level=0"); // Alternative syntax
    await csoundInstance.setOption("-+msg_color=0"); // Disable message colors
    await csoundInstance.setOption("--no-warnings"); // Suppress warnings
    await csoundInstance.setOption("-d"); // Suppress debug messages
    await csoundInstance.setOption("-g"); // Suppress graph displays
    
    // Even more aggressive console suppression
    // Override csoundInstance.message if it exists
    if (csoundInstance.message) {
      // Store the original message function for later restoration
      csoundInstance._originalMessage = csoundInstance.message;
      
      csoundInstance.message = function() {
        // Filter out all rtevent messages by not forwarding them
        const args = Array.from(arguments);
        const msgText = args[0] || '';
        if (msgText.includes('rtevent') || msgText.includes('i 1')) {
          return; // Don't forward rtevent messages
        }
        return csoundInstance._originalMessage.apply(csoundInstance, args);
      };
    }
    
    // ULTRA-AGGRESSIVE: Override console.log to filter Csound messages
    if (!window._originalConsoleLog) {
      // Store original console methods
      window._originalConsoleLog = console.log;
      window._originalConsoleWarn = console.warn;
      window._originalConsoleInfo = console.info;
      window._originalConsoleDebug = console.debug;
      
      // Create a filter function for Csound messages
      const isCsoundMessage = (text) => {
        if (typeof text !== 'string') return false;
        
        return text.includes('@csound_browser') || 
               text.includes('rtevent') || 
               text.includes('new alloc for instr') ||
               (text.includes('T ') && text.includes('TT ') && text.includes('M:'));
      };
      
      // Replace all console methods
      console.log = function() {
        const args = Array.from(arguments);
        if (args.length > 0 && isCsoundMessage(String(args[0]))) {
          return; // Skip Csound messages
        }
        return window._originalConsoleLog.apply(console, args);
      };
      
      console.warn = function() {
        const args = Array.from(arguments);
        if (args.length > 0 && isCsoundMessage(String(args[0]))) {
          return; // Skip Csound messages
        }
        return window._originalConsoleWarn.apply(console, args);
      };
      
      console.info = function() {
        const args = Array.from(arguments);
        if (args.length > 0 && isCsoundMessage(String(args[0]))) {
          return; // Skip Csound messages
        }
        return window._originalConsoleInfo.apply(console, args);
      };
      
      console.debug = function() {
        const args = Array.from(arguments);
        if (args.length > 0 && isCsoundMessage(String(args[0]))) {
          return; // Skip Csound messages
        }
        return window._originalConsoleDebug.apply(console, args);
      };
      
      // Add filtering using Error.prepareStackTrace to catch direct console writes
      const originalPrepareStackTrace = Error.prepareStackTrace;
      Error._originalPrepareStackTrace = originalPrepareStackTrace; // Save for restoration
      Error.prepareStackTrace = function(error, stack) {
        // Check if this is coming from csound_browser.js
        const csoundFrame = stack.find(frame => {
          const fileName = frame.getFileName() || '';
          return fileName.includes('csound_browser');
        });
        
        // If it's from csound_browser.js, we might be able to block it
        if (csoundFrame) {
          const funcName = csoundFrame.getFunctionName() || '';
          if (funcName.includes('log') || funcName.includes('print')) {
            return ''; // Return empty stack trace to minimize impact
          }
        }
        
        // Otherwise use the original behavior
        if (originalPrepareStackTrace) {
          return originalPrepareStackTrace(error, stack);
        }
        return stack;
      };
      
      // EXTREME: Inject style to hide csound console entries with CSS
      try {
        const style = document.createElement('style');
        style.id = 'csound-console-filter';
        style.textContent = `
          /* Hide console messages from csound */
          .console-message-wrapper:has(.console-message-text:contains('@csound_browser')),
          .console-message-wrapper:has(.console-message-text:contains('rtevent')),
          .console-message-wrapper:has(.console-message-text:contains('new alloc for instr')),
          .console-message-wrapper:has(.console-message-text:contains('T ') + :contains('TT ') + :contains('M:')) {
            display: none !important;
          }
        `;
        document.head.appendChild(style);
      } catch (styleError) {
        // Style injection may fail in some browsers, that's ok
        console.error('Style injection failed:', styleError);
      }
      
      console.log("%c Console filtering enabled for Csound messages", "color: #444; font-style: italic;");
    }
    
    // NUCLEAR OPTION: Monkey patch XMLHttpRequest and fetch to block csound_browser.js from loading
    // Only as a last resort because it might break functionality
    if (!window._originalXMLHttpRequest && !window._originalFetch) {
      try {
        // Save original methods
        window._originalXMLHttpRequest = window.XMLHttpRequest;
        window._originalFetch = window.fetch;
        
        // Create a blocker class that prevents loading of csound scripts
        class FilteredXHR extends window._originalXMLHttpRequest {
          open(method, url, ...args) {
            if (typeof url === 'string' && url.includes('csound_browser')) {
              // Log that we're blocking this
              window._originalConsoleLog.call(console, "Blocking Csound script load:", url);
              // Call open with a dummy URL that will fail silently
              return super.open(method, 'about:blank', ...args);
            }
            return super.open(method, url, ...args);
          }
        }
        
        // Replace the global XMLHttpRequest
        window.XMLHttpRequest = FilteredXHR;
        
        // Wrap fetch to filter csound scripts
        window.fetch = function(resource, options) {
          if (typeof resource === 'string' && resource.includes('csound_browser')) {
            // Return a resolved promise with empty response to avoid errors
            return Promise.resolve(new Response('', {
              status: 200,
              headers: { 'Content-Type': 'application/javascript' }
            }));
          }
          return window._originalFetch.call(window, resource, options);
        };
      } catch (xhrError) {
        console.error('XHR/fetch monkey patching failed:', xhrError);
      }
    }
    
    // Set flag to indicate logs are disabled
    csoundLoggingEnabled = false;
    console.log("%c Csound logs disabled to improve console readability", "color: #444; font-style: italic;");
    return true;
  } catch (error) {
    console.error("Error disabling Csound logs:", error);
    return false;
  }
}

/**
 * Enable Csound message logging
 */
export async function enableCsoundLogs() {
  if (!csoundInstance) return false;
  
  try {
    // Restore normal message levels
    await csoundInstance.setOption("-m4"); // General message level (all messages)
    await csoundInstance.setOption("--message-level=4"); // Alternative syntax
    await csoundInstance.setOption("-+msg_color=1"); // Enable message colors
    await csoundInstance.removeOption("--no-warnings"); // Allow warnings
    await csoundInstance.removeOption("-d"); // Allow debug messages
    await csoundInstance.removeOption("-g"); // Allow graph displays
    
    // Restore original message handler if we overrode it
    if (csoundInstance._originalMessage) {
      csoundInstance.message = csoundInstance._originalMessage;
      delete csoundInstance._originalMessage;
    }
    
    // Restore original console methods if we overrode them
    if (window._originalConsoleLog) {
      console.log = window._originalConsoleLog;
      delete window._originalConsoleLog;
    }
    
    if (window._originalConsoleWarn) {
      console.warn = window._originalConsoleWarn;
      delete window._originalConsoleWarn;
    }
    
    if (window._originalConsoleInfo) {
      console.info = window._originalConsoleInfo;
      delete window._originalConsoleInfo;
    }
    
    if (window._originalConsoleDebug) {
      console.debug = window._originalConsoleDebug;
      delete window._originalConsoleDebug;
    }
    
    // Restore original Error.prepareStackTrace if we modified it
    if (Error._originalPrepareStackTrace) {
      Error.prepareStackTrace = Error._originalPrepareStackTrace;
      delete Error._originalPrepareStackTrace;
    }
    
    // Remove any CSS style we added
    const styleElement = document.getElementById('csound-console-filter');
    if (styleElement) {
      styleElement.remove();
    }
    
    // Restore original XMLHttpRequest and fetch if we replaced them
    if (window._originalXMLHttpRequest) {
      window.XMLHttpRequest = window._originalXMLHttpRequest;
      delete window._originalXMLHttpRequest;
    }
    
    if (window._originalFetch) {
      window.fetch = window._originalFetch;
      delete window._originalFetch;
    }
    
    // Set flag to indicate logs are enabled
    csoundLoggingEnabled = true;
    console.log("%c Csound logs enabled", "color: #444; font-style: italic;");
    return true;
  } catch (error) {
    console.error("Error enabling Csound logs:", error);
    return false;
  }
}

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
          
          // Disable Csound logs immediately after starting
          await disableCsoundLogs();
          
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
            
            // Disable Csound logs immediately after starting
            await disableCsoundLogs();
            
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
    
    // Call disableCsoundLogs again just to make sure
    if (csoundInstance && csoundStarted) {
      await disableCsoundLogs();
    }
    
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
    
    // Check if this is a star cut intersection
    if (note.isStarCut) {
      // Make star cuts sound different:
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
      
      // Special logging for star cuts
      if (DEBUG_AUDIO) {
        
      }
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