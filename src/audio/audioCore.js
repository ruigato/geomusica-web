// src/audio/audioCore.js - Core Audio System (Clean & Simple)
// Focused audio system that registers as a trigger handler

import { Csound } from '@csound/browser';
import { DEFAULT_VALUES } from '../config/constants.js';

// SINGLE audio system variables - NO DUPLICATES
let csoundInstance = null;
let audioContext = null;
let isReady = false;

// Path to the orchestra file
const ORC_FILE_PATH = '/src/audio/GeoMusica.orc';

// Global audio enable/disable flag
let audioEnabled = true;

/**
 * Enable or disable audio globally
 */
export function setAudioEnabled(enabled) {
  audioEnabled = enabled;
  console.log(`[AUDIO CORE] Audio ${enabled ? 'ENABLED' : 'DISABLED'}`);
  
  // Update trigger handler status
  try {
    import('../triggers/triggerDispatcher.js').then(module => {
      module.setTriggerHandlerEnabled('audio', enabled);
    });
  } catch (error) {
    // Ignore if dispatcher not available
  }
}

/**
 * Check if audio is enabled
 */
export function isAudioEnabled() {
  return audioEnabled;
}

/**
 * Get the Csound instance (for debugging only)
 */
export function getCsoundInstance() {
  return csoundInstance;
}

/**
 * Check if audio system is ready
 */
export function isAudioReady() {
  return csoundInstance !== null && isReady && audioEnabled;
}

/**
 * Get the audio context
 */
export function getAudioContext() {
  return audioContext;
}

/**
 * Load the orchestra file
 */
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

/**
 * Audio trigger handler - handles notes from the trigger dispatcher
 * @param {Object} note - Note data from trigger system
 */
export function handleAudioTrigger(note) {
  if (!audioEnabled || !csoundInstance || !isReady) {
    return false;
  }

  try {
    // Validate note parameters
    const frequency = note.frequency || 440;
    const duration = note.duration || 0.3;
    const velocity = Math.max(0, Math.min(1, note.velocity || 0.7));
    const pan = Math.max(-1, Math.min(1, note.pan || 0.0));
    
    // Build Csound score event
    const scoreEvent = `i 1 0 ${duration} ${frequency} ${velocity} ${duration} ${pan}`;
    
    // Play the note
    csoundInstance.readScore(scoreEvent);
    
    console.log(`[AUDIO CORE] Playing note: ${frequency}Hz`);
    return true;
  } catch (error) {
    console.error("Error playing note:", error);
    return false;
  }
}

/**
 * Setup the audio system - CLEAN AND SIMPLE
 */
export async function setupAudio({ audioContext: providedAudioContext } = {}) {
  try {
    console.log('[AUDIO CORE] Setting up core audio system...');
    
    // Use provided AudioContext or create new one
    if (providedAudioContext) {
      audioContext = providedAudioContext;
      console.log('[AUDIO CORE] Using provided AudioContext');
    } else {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log('[AUDIO CORE] Created new AudioContext');
    }
    
    // Create Csound instance
    if (!csoundInstance) {
      const csoundOptions = {
        audioContext: audioContext,
        bufferSize: 4096
      };
      
      console.log('[AUDIO CORE] Creating Csound instance...');
      csoundInstance = await Csound(csoundOptions);
      
      // Load and compile the orchestra
      const orchestraCode = await loadOrchestraFile();
      await csoundInstance.compileOrc(orchestraCode);
      await csoundInstance.setOption("-odac");
      await csoundInstance.start();
      
      // Set default parameters
      await csoundInstance.setControlChannel("attack", DEFAULT_VALUES.ATTACK);
      await csoundInstance.setControlChannel("decay", DEFAULT_VALUES.DECAY);
      await csoundInstance.setControlChannel("sustain", DEFAULT_VALUES.SUSTAIN);
      await csoundInstance.setControlChannel("release", DEFAULT_VALUES.RELEASE);
      await csoundInstance.setControlChannel("brightness", DEFAULT_VALUES.BRIGHTNESS);
      await csoundInstance.setControlChannel("masterVolume", DEFAULT_VALUES.VOLUME);
      
      isReady = true;
      console.log('[AUDIO CORE] Csound initialized successfully');
    }
    
    // Register as trigger handler
    try {
      const { registerTriggerHandler } = await import('../triggers/triggerDispatcher.js');
      registerTriggerHandler('audio', handleAudioTrigger, {
        enabled: audioEnabled,
        priority: 10 // High priority for audio
      });
      console.log('[AUDIO CORE] Registered as trigger handler');
    } catch (error) {
      console.warn('[AUDIO CORE] Could not register trigger handler:', error);
    }
    
    // Simple click handler to resume audio context
    document.body.addEventListener('click', async () => {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('[AUDIO CORE] Audio context resumed');
      }
    }, { once: true });
    
    return csoundInstance;
  } catch (error) {
    console.error("Error in setupAudio:", error);
    return null;
  }
}

/**
 * Legacy trigger function for backward compatibility
 * @param {Object} note - Note to trigger
 */
export function triggerAudio(note) {
  return handleAudioTrigger(note);
}

/**
 * Set master volume
 */
export async function setMasterVolume(volume) {
  if (!csoundInstance || !isReady) return false;
  
  try {
    const validVolume = Math.max(0, Math.min(1, volume));
    await csoundInstance.setControlChannel("masterVolume", validVolume);
    return true;
  } catch (error) {
    console.error("Error setting master volume:", error);
    return false;
  }
}

/**
 * Set envelope parameters
 */
export async function setEnvelope(attack, decay, sustain, release) {
  if (!csoundInstance || !isReady) return false;
  
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

/**
 * Set brightness parameter
 */
export async function setBrightness(brightness) {
  if (!csoundInstance || !isReady) return false;
  
  try {
    await csoundInstance.setControlChannel("brightness", brightness);
    return true;
  } catch (error) {
    console.error("Error setting brightness:", error);
    return false;
  }
}

/**
 * Clean up audio system
 */
export async function cleanupAudio() {
  // Unregister from trigger dispatcher
  try {
    const { unregisterTriggerHandler } = await import('../triggers/triggerDispatcher.js');
    unregisterTriggerHandler('audio');
  } catch (error) {
    // Ignore if dispatcher not available
  }

  if (csoundInstance) {
    try {
      await csoundInstance.stop();
      await csoundInstance.reset();
      csoundInstance = null;
      isReady = false;
      console.log('[AUDIO CORE] Audio system cleaned up');
    } catch (error) {
      console.error("Error cleaning up audio:", error);
    }
  }
}

// Export for compatibility (but simplified)
export const Tone = {
  now: () => audioContext ? audioContext.currentTime : performance.now() / 1000,
  start: async () => {
    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  }
};

// Backward compatibility exports
export const playNote = triggerAudio; 