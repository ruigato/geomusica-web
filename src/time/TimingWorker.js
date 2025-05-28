// src/time/TimingWorker.js - Web Worker for rock-solid timing
// This worker runs independently of main thread throttling

let audioContext = null;
let startTime = 0;
let isRunning = false;
let intervalId = null;

// High-frequency timing updates
const TIMING_INTERVAL = 1; // 1ms for maximum precision

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'INIT':
      initializeWorkerTiming(data);
      break;
      
    case 'START':
      startTiming();
      break;
      
    case 'STOP':
      stopTiming();
      break;
      
    case 'GET_TIME':
      sendCurrentTime();
      break;
      
    case 'RESET':
      resetTiming();
      break;
      
    default:
      console.warn('[TIMING WORKER] Unknown message type:', type);
  }
};

function initializeWorkerTiming(config) {
  try {
    // Create AudioContext in worker (if supported)
    if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
      const AudioContextClass = AudioContext || webkitAudioContext;
      audioContext = new AudioContextClass({
        sampleRate: config.sampleRate || 44100,
        latencyHint: 'interactive'
      });
      
      startTime = audioContext.currentTime;
      
      self.postMessage({
        type: 'INIT_SUCCESS',
        data: {
          sampleRate: audioContext.sampleRate,
          state: audioContext.state,
          startTime: startTime
        }
      });
    } else {
      // Fallback to performance.now() timing
      startTime = performance.now() / 1000;
      
      self.postMessage({
        type: 'INIT_FALLBACK',
        data: {
          startTime: startTime,
          message: 'AudioContext not available in worker, using performance.now()'
        }
      });
    }
  } catch (error) {
    self.postMessage({
      type: 'INIT_ERROR',
      data: {
        error: error.message,
        startTime: performance.now() / 1000
      }
    });
  }
}

function startTiming() {
  if (isRunning) return;
  
  isRunning = true;
  
  // High-frequency timing loop
  intervalId = setInterval(() => {
    sendCurrentTime();
  }, TIMING_INTERVAL);
  
  self.postMessage({
    type: 'TIMING_STARTED',
    data: { interval: TIMING_INTERVAL }
  });
}

function stopTiming() {
  if (!isRunning) return;
  
  isRunning = false;
  
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  
  self.postMessage({
    type: 'TIMING_STOPPED'
  });
}

function sendCurrentTime() {
  let currentTime;
  
  if (audioContext) {
    currentTime = audioContext.currentTime - startTime;
  } else {
    currentTime = (performance.now() / 1000) - startTime;
  }
  
  self.postMessage({
    type: 'TIME_UPDATE',
    data: {
      time: currentTime,
      timestamp: performance.now(),
      source: audioContext ? 'audioContext' : 'performance'
    }
  });
}

function resetTiming() {
  stopTiming();
  
  if (audioContext) {
    startTime = audioContext.currentTime;
  } else {
    startTime = performance.now() / 1000;
  }
  
  self.postMessage({
    type: 'TIMING_RESET',
    data: { startTime: startTime }
  });
} 