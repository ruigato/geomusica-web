// src/audio/audio.js
import { Csound } from '@csound/browser';

// Fallback to direct WebAudio implementation
let webAudioContext = null;
let webAudioOscillator = null;
let webAudioGain = null;

// Function to initialize basic WebAudio API for fallback
function initWebAudio() {
  if (webAudioContext) return true;
  
  try {
    // Create audio context
    webAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log("WebAudio context created successfully");
    
    // Create gain node
    webAudioGain = webAudioContext.createGain();
    webAudioGain.gain.value = 0;
    webAudioGain.connect(webAudioContext.destination);
    
    return true;
  } catch (error) {
    console.error("Failed to initialize WebAudio:", error);
    return false;
  }
}

// Function to play a simple tone using WebAudio API
function playWebAudioTone(frequency, amplitude, duration) {
  if (!webAudioContext) {
    if (!initWebAudio()) return;
  }
  
  try {
    // Resume context if suspended
    if (webAudioContext.state === 'suspended') {
      webAudioContext.resume();
    }
    
    // Create oscillator
    const oscillator = webAudioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    
    // Create gain node for this tone
    const gainNode = webAudioContext.createGain();
    gainNode.gain.value = amplitude;
    
    // Connect nodes
    oscillator.connect(gainNode);
    gainNode.connect(webAudioContext.destination);
    
    // Play tone with envelope
    const now = webAudioContext.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(amplitude, now + 0.01);
    gainNode.gain.linearRampToValueAtTime(amplitude * 0.7, now + duration - 0.1);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);
    
    // Start and stop oscillator
    oscillator.start(now);
    oscillator.stop(now + duration);
    
    console.log(`WebAudio tone played: freq=${frequency}, amp=${amplitude}, dur=${duration}`);
    
    // Clean up
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
    
    return true;
  } catch (error) {
    console.error("Failed to play WebAudio tone:", error);
    return false;
  }
}

// Simple fallback for timing
function simpleNow() {
  return performance.now() / 1000;
}

// Equivalent to Tone.now() - gets current time
export function getCurrentTime() {
  return simpleNow();
}

// Set up audio (try Csound, fall back to WebAudio)
export async function setupAudio() {
  try {
    // First initialize WebAudio as fallback
    initWebAudio();
    
    // Create Csound instance
    const csound = await Csound({ 
      messageLevel: 0  // Show all messages for debugging
    });
    
    // Setup click handler to initialize audio
    document.body.addEventListener('click', async () => {
      try {
        // Play a test tone with WebAudio
        playWebAudioTone(440, 0.2, 0.5);
        
        // Also try to initialize Csound's audio
        try {
          await csound.start();
          await csound.readScore('i 1 0 1 440 0.5');
        } catch (csoundError) {
          console.warn("Csound audio failed, using WebAudio fallback", csoundError);
        }
      } catch (error) {
        console.error('Error initializing audio:', error);
      }
    }, { once: true });
    
    return {
      // This object mimics a Csound instance but actually uses WebAudio
      readScore: async (scoreEvent) => {
        try {
          // Parse score event (format: "i 1 0 duration freq amp")
          const parts = scoreEvent.split(/\s+/);
          if (parts.length >= 6 && parts[0] === 'i') {
            const duration = parseFloat(parts[3]);
            const frequency = parseFloat(parts[4]);
            const amplitude = parseFloat(parts[5]);
            
            // Use WebAudio to play the tone
            playWebAudioTone(frequency, amplitude, duration);
          }
        } catch (error) {
          console.error("Error parsing score:", error);
        }
      },
      start: async () => {
        console.log("WebAudio fallback ready");
        return 0;
      }
    };
  } catch (error) {
    console.error('Failed to initialize audio:', error);
    
    // Return WebAudio fallback
    return {
      readScore: async (scoreEvent) => {
        try {
          // Parse score event (format: "i 1 0 duration freq amp")
          const parts = scoreEvent.split(/\s+/);
          if (parts.length >= 6 && parts[0] === 'i') {
            const duration = parseFloat(parts[3]);
            const frequency = parseFloat(parts[4]);
            const amplitude = parseFloat(parts[5]);
            
            // Use WebAudio to play the tone
            playWebAudioTone(frequency, amplitude, duration);
          }
        } catch (error) {
          console.error("Error parsing score:", error);
        }
      },
      start: async () => {
        console.log("WebAudio fallback ready");
        return 0;
      }
    };
  }
}

// Trigger audio using WebAudio fallback
export async function triggerAudio(audioInstance, x, y, lastAngle, angle, tNow) {
  if (!audioInstance) return;
  
  try {
    const freq = Math.hypot(x, y);
    const amp = 0.3;
    const duration = 0.3;
    
    const scoreEvent = `i 1 0 ${duration} ${freq} ${amp}`;
    console.log(`Triggering sound: ${scoreEvent}`);
    
    await audioInstance.readScore(scoreEvent);
  } catch (error) {
    console.error('Error triggering audio:', error);
  }
}

// Export a stub of Tone to maintain compatibility with existing code
export const Tone = {
  now: () => getCurrentTime(),
  start: async () => {
    if (webAudioContext && webAudioContext.state === 'suspended') {
      await webAudioContext.resume();
    }
  },
  getTransport: () => {
    return {
      start: async () => {
        if (webAudioContext && webAudioContext.state === 'suspended') {
          await webAudioContext.resume();
        }
      }
    };
  },
  Synth: class {
    constructor() {
      // Stub constructor
      initWebAudio();
    }
    
    toDestination() {
      // Return this for chaining
      return this;
    }
    
    triggerAttackRelease(freq, duration, time) {
      // Use WebAudio to play the tone
      playWebAudioTone(freq, 0.5, parseFloat(duration) || 0.3);
    }
  }
};