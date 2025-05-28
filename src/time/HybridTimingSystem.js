// src/time/HybridTimingSystem.js - Hybrid timing system for maximum reliability
import { getTimingStatus } from './time.js';

class HybridTimingSystem {
  constructor() {
    this.worker = null;
    this.workerAvailable = false;
    this.workerTime = 0;
    this.workerTimestamp = 0;
    this.useWorker = false;
    this.timingMode = 'worker'; // Changed from 'main' to 'worker' to prefer Web Worker
    
    // Performance tracking
    this.mainThreadSamples = [];
    this.workerSamples = [];
    this.maxSamples = 100;
    
    // Timing validation
    this.lastValidationTime = 0;
    this.validationInterval = 1000; // Validate every second
    
    // Direct timing access to avoid circular dependency
    this.audioContext = null;
    this.audioStartTime = 0;
    this.performanceStartTime = performance.now() / 1000;
    
    // Worker preference settings
    this.workerBias = 1.5; // Bias factor to prefer worker timing (1.5x better stability required to switch away from worker)
    this.minWorkerStability = 0.1; // Minimum stability threshold for worker timing
    
    this.initializeWorker();
    this.initializeMainThreadTiming();
  }
  
  /**
   * Initialize main thread timing directly to avoid circular dependency
   */
  initializeMainThreadTiming() {
    try {
      // Try to get the shared AudioContext from the global scope
      if (window.mainScene && window.mainScene.userData && window.mainScene.userData.audioContext) {
        this.audioContext = window.mainScene.userData.audioContext;
        this.audioStartTime = this.audioContext.currentTime;
        console.log('[HYBRID TIMING] Using shared AudioContext for main thread timing');
      } else {
        console.log('[HYBRID TIMING] No shared AudioContext found, using performance timing for main thread');
      }
    } catch (error) {
      console.warn('[HYBRID TIMING] Failed to initialize main thread timing:', error);
    }
  }
  
  /**
   * Update the AudioContext reference (called from main timing system)
   */
  updateAudioContext(audioContext) {
    if (audioContext && audioContext !== this.audioContext) {
      this.audioContext = audioContext;
      this.audioStartTime = audioContext.currentTime;
      console.log('[HYBRID TIMING] AudioContext reference updated');
    }
  }
  
  /**
   * Get main thread time directly without circular dependency
   */
  getMainThreadTime() {
    if (this.audioContext && this.audioContext.state === 'running') {
      return this.audioContext.currentTime - this.audioStartTime;
    } else {
      return performance.now() / 1000 - this.performanceStartTime;
    }
  }
  
  initializeWorker() {
    try {
      // Create worker with more aggressive timing for better performance
      const workerCode = `
        let audioContext = null;
        let startTime = 0;
        let performanceStartTime = performance.now() / 1000;
        let updateInterval = 0.5; // Start with 0.5ms updates for maximum precision
        
        // Try to create AudioContext in worker
        try {
          audioContext = new (self.AudioContext || self.webkitAudioContext)();
          startTime = audioContext.currentTime;
          console.log('[WORKER] AudioContext created successfully');
        } catch (e) {
          console.log('[WORKER] AudioContext not available, using performance.now()');
        }
        
        function sendTimeUpdate() {
          let currentTime;
          if (audioContext && audioContext.state === 'running') {
            currentTime = audioContext.currentTime - startTime;
          } else {
            currentTime = performance.now() / 1000 - performanceStartTime;
          }
          
          self.postMessage({
            type: 'timeUpdate',
            time: currentTime,
            timestamp: performance.now(),
            source: audioContext ? 'audioContext' : 'performance'
          });
        }
        
        // Start with high frequency updates
        let intervalId = setInterval(sendTimeUpdate, updateInterval);
        
        self.onmessage = function(e) {
          if (e.data.type === 'setUpdateInterval') {
            clearInterval(intervalId);
            updateInterval = Math.max(0.5, e.data.interval); // Minimum 0.5ms
            intervalId = setInterval(sendTimeUpdate, updateInterval);
            console.log('[WORKER] Update interval set to', updateInterval, 'ms');
          }
        };
        
        // Send initial time immediately
        sendTimeUpdate();
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      
      this.worker.onmessage = (e) => {
        if (e.data.type === 'timeUpdate') {
          this.workerTime = e.data.time;
          this.workerTimestamp = e.data.timestamp;
          this.workerAvailable = true;
          
          // Store worker sample for stability calculation
          if (this.workerSamples.length >= this.maxSamples) {
            this.workerSamples.shift();
          }
          this.workerSamples.push({
            time: e.data.time,
            timestamp: e.data.timestamp
          });
        }
      };
      
      this.worker.onerror = (error) => {
        console.warn('[HYBRID TIMING] Worker error:', error);
        this.workerAvailable = false;
      };
      
      // Set aggressive update interval for maximum precision
      setTimeout(() => {
        if (this.worker) {
          this.worker.postMessage({ type: 'setUpdateInterval', interval: 0.5 });
        }
      }, 100);
      
      console.log('[HYBRID TIMING] Worker initialized with aggressive timing (0.5ms updates)');
      
    } catch (error) {
      console.warn('[HYBRID TIMING] Failed to initialize worker:', error);
      this.workerAvailable = false;
    }
  }
  
  getCurrentTime() {
    const now = performance.now();
    
    // Validate timing sources periodically
    if (now - this.lastValidationTime > this.validationInterval) {
      this.validateTimingSources();
      this.lastValidationTime = now;
    }
    
    // Get main thread time
    const mainTime = this.getMainThreadTime();
    
    // Store main thread sample
    if (this.mainThreadSamples.length >= this.maxSamples) {
      this.mainThreadSamples.shift();
    }
    this.mainThreadSamples.push({
      time: mainTime,
      timestamp: now
    });
    
    // Choose timing source based on current mode and availability with worker preference
    switch (this.timingMode) {
      case 'worker':
        if (this.workerAvailable && this.workerTimestamp > 0) {
          // Interpolate worker time to current moment
          const timeSinceWorkerUpdate = (now - this.workerTimestamp) / 1000;
          return this.workerTime + timeSinceWorkerUpdate;
        }
        // Fallback to main thread if worker not available
        console.warn('[HYBRID TIMING] Worker not available, falling back to main thread');
        return mainTime;
        
      case 'hybrid':
        // Use worker-biased selection logic
        const mainStability = this.calculateStability(this.mainThreadSamples);
        const workerStability = this.workerAvailable ? this.calculateStability(this.workerSamples) : 0;
        
        // Apply worker bias: worker needs to be significantly worse to switch away from it
        const shouldUseWorker = this.workerAvailable && 
                               this.workerTimestamp > 0 && 
                               (workerStability >= this.minWorkerStability) &&
                               (workerStability * this.workerBias >= mainStability);
        
        if (shouldUseWorker) {
          const timeSinceWorkerUpdate = (now - this.workerTimestamp) / 1000;
          return this.workerTime + timeSinceWorkerUpdate;
        }
        return mainTime;
        
      case 'main':
      default:
        return mainTime;
    }
  }
  
  calculateStability(samples) {
    if (samples.length < 10) return 0;
    
    // Calculate timing intervals
    const intervals = [];
    for (let i = 1; i < samples.length; i++) {
      const interval = samples[i].time - samples[i-1].time;
      intervals.push(interval);
    }
    
    // Calculate standard deviation (lower = more stable)
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sq, interval) => sq + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    
    // Return stability score (higher = more stable)
    return 1 / (1 + stdDev * 1000); // Convert to ms and invert
  }
  
  validateTimingSources() {
    if (this.mainThreadSamples.length < 10) return;
    
    const mainStability = this.calculateStability(this.mainThreadSamples);
    const workerStability = this.workerAvailable ? this.calculateStability(this.workerSamples) : 0;
    
    // Auto-switch logic with worker preference
    if (this.timingMode === 'hybrid') {
      const previousUseWorker = this.useWorker;
      
      // Apply worker bias: prefer worker unless it's significantly worse
      this.useWorker = this.workerAvailable && 
                      (workerStability >= this.minWorkerStability) &&
                      (workerStability * this.workerBias >= mainStability);
      
      if (previousUseWorker !== this.useWorker) {
        const chosenSource = this.useWorker ? 'worker' : 'main';
        const chosenStability = this.useWorker ? workerStability : mainStability;
        console.log(`[HYBRID TIMING] Switched to ${chosenSource} timing (stability: ${chosenStability.toFixed(3)}, worker bias: ${this.workerBias}x)`);
        console.log(`[HYBRID TIMING] Worker stability: ${workerStability.toFixed(3)}, Main stability: ${mainStability.toFixed(3)}`);
      }
    }
    
    // Force worker mode if it's available and stable enough
    if (this.timingMode === 'worker' && this.workerAvailable && workerStability >= this.minWorkerStability) {
      this.useWorker = true;
    }
  }
  
  setTimingMode(mode) {
    if (['main', 'worker', 'hybrid'].includes(mode)) {
      this.timingMode = mode;
      console.log(`[HYBRID TIMING] Timing mode set to: ${mode}`);
    }
  }
  
  /**
   * Configure worker preference settings
   * @param {Object} options - Configuration options
   * @param {number} options.workerBias - Bias factor for worker timing (default: 1.5)
   * @param {number} options.minWorkerStability - Minimum stability threshold (default: 0.1)
   * @param {string} options.defaultMode - Default timing mode (default: 'worker')
   */
  configureWorkerPreference(options = {}) {
    this.workerBias = options.workerBias || 1.5;
    this.minWorkerStability = options.minWorkerStability || 0.1;
    
    if (options.defaultMode && ['main', 'worker', 'hybrid'].includes(options.defaultMode)) {
      this.timingMode = options.defaultMode;
    }
    
    console.log(`[HYBRID TIMING] Worker preference configured: bias=${this.workerBias}x, minStability=${this.minWorkerStability}, mode=${this.timingMode}`);
  }
  
  /**
   * Get detailed timing status including worker preference info
   */
  getTimingStatus() {
    const mainStatus = getTimingStatus();
    const mainStability = this.calculateStability(this.mainThreadSamples);
    const workerStability = this.workerAvailable ? this.calculateStability(this.workerSamples) : 0;
    
    return {
      ...mainStatus,
      hybridMode: this.timingMode,
      workerAvailable: this.workerAvailable,
      useWorker: this.useWorker,
      mainStability: mainStability,
      workerStability: workerStability,
      mainSamples: this.mainThreadSamples.length,
      workerSamples: this.workerSamples.length,
      workerBias: this.workerBias,
      minWorkerStability: this.minWorkerStability,
      workerPreferred: workerStability * this.workerBias >= mainStability && workerStability >= this.minWorkerStability
    };
  }
  
  destroy() {
    if (this.worker) {
      this.worker.postMessage({ type: 'STOP' });
      this.worker.terminate();
      this.worker = null;
    }
    this.workerAvailable = false;
  }
}

// Create global instance
const hybridTiming = new HybridTimingSystem();

// Export functions
export function getCurrentTime() {
  return hybridTiming.getCurrentTime();
}

export function getHybridTimingStatus() {
  return hybridTiming.getTimingStatus();
}

export function setHybridTimingMode(mode) {
  hybridTiming.setTimingMode(mode);
}

export { hybridTiming }; 