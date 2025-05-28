// src/time/RockSolidTiming.js - Ultra-simple, bulletproof timing system
// NO switching, NO fallbacks, NO complexity - just rock-solid Web Worker timing
// Added performance.now() mode for comparison

class RockSolidTiming {
  constructor() {
    this.worker = null;
    this.workerTime = 0;
    this.workerTimestamp = 0;
    this.isReady = false;
    this.startTime = performance.now() / 1000;
    this.performanceStartTime = performance.now() / 1000;
    this.usePerformanceMode = false; // Default to Web Worker
    
    // Large buffer for maximum stability - we prioritize consistency over latency
    this.bufferSize = 50; // 50ms buffer - large enough to handle any UI interference
    this.updateInterval = 1; // 1ms worker updates for precision
    
    // Diagnostic tracking
    this.diagnostics = {
      webWorkerCalls: 0,
      performanceCalls: 0,
      lastSwitchTime: 0,
      timingDifferences: [],
      maxDifference: 0,
      avgDifference: 0
    };
    
    this.initializeWorker();
  }
  
  initializeWorker() {
    try {
      // Ultra-simple worker code - no AudioContext complexity, just pure timing
      const workerCode = `
        let startTime = performance.now() / 1000;
        let updateInterval = 1; // 1ms updates
        
        function sendTimeUpdate() {
          const currentTime = performance.now() / 1000 - startTime;
          self.postMessage({
            type: 'timeUpdate',
            time: currentTime,
            timestamp: performance.now()
          });
        }
        
        // Start immediately with consistent updates
        let intervalId = setInterval(sendTimeUpdate, updateInterval);
        
        // Send initial time
        sendTimeUpdate();
        
        // Simple message handling
        self.onmessage = function(e) {
          if (e.data.type === 'reset') {
            startTime = performance.now() / 1000;
            sendTimeUpdate();
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      this.worker = new Worker(URL.createObjectURL(blob));
      
      this.worker.onmessage = (e) => {
        if (e.data.type === 'timeUpdate') {
          this.workerTime = e.data.time;
          this.workerTimestamp = e.data.timestamp;
          this.isReady = true;
        }
      };
      
      this.worker.onerror = (error) => {
        console.error('[ROCK SOLID TIMING] Worker error:', error);
        this.isReady = false;
      };
      
      console.log('[ROCK SOLID TIMING] Initialized with 50ms buffer for maximum stability');
      
    } catch (error) {
      console.error('[ROCK SOLID TIMING] Failed to initialize:', error);
      this.isReady = false;
    }
  }
  
  /**
   * Switch between Web Worker and performance.now() timing
   * @param {boolean} usePerformance - True for performance.now(), false for Web Worker
   */
  setPerformanceMode(usePerformance) {
    // Get the current time before switching modes to preserve continuity
    const currentTime = this.getCurrentTime();
    
    // Log previous mode statistics before switching
    if (this.diagnostics.webWorkerCalls > 0 || this.diagnostics.performanceCalls > 0) {
      console.log(`[TIMING DIAGNOSTICS] Previous mode stats:
        Web Worker calls: ${this.diagnostics.webWorkerCalls}
        Performance.now() calls: ${this.diagnostics.performanceCalls}
        Max difference: ${(this.diagnostics.maxDifference * 1000).toFixed(2)}ms
        Avg difference: ${(this.diagnostics.avgDifference * 1000).toFixed(2)}ms`);
    }
    
    this.usePerformanceMode = usePerformance;
    this.diagnostics.lastSwitchTime = performance.now();
    
    // Reset diagnostics for new mode
    this.diagnostics.webWorkerCalls = 0;
    this.diagnostics.performanceCalls = 0;
    this.diagnostics.timingDifferences = [];
    this.diagnostics.maxDifference = 0;
    this.diagnostics.avgDifference = 0;
    
    if (usePerformance) {
      // Set performanceStartTime so that performance.now() continues from current time
      this.performanceStartTime = performance.now() / 1000 - currentTime;
      console.log('[ROCK SOLID TIMING] Switched to performance.now() mode for comparison');
      console.log('[TIMING DIAGNOSTICS] Watch console for timing difference reports...');
    } else {
      // When switching back to Web Worker mode, adjust startTime to maintain continuity
      this.startTime = performance.now() / 1000 - currentTime;
      console.log('[ROCK SOLID TIMING] Switched to Web Worker mode');
      console.log('[TIMING DIAGNOSTICS] Web Worker timing active with 50ms buffer');
    }
  }
  
  /**
   * Get current time - Web Worker or performance.now() based on mode
   * @returns {number} Current time in seconds
   */
  getCurrentTime() {
    let currentTime;
    
    if (this.usePerformanceMode) {
      // Direct performance.now() mode for comparison
      currentTime = performance.now() / 1000 - this.performanceStartTime;
      this.diagnostics.performanceCalls++;
      
      // Compare with Web Worker time for diagnostics (if available)
      if (this.isReady && this.workerTimestamp > 0) {
        const timeSinceUpdate = (performance.now() - this.workerTimestamp) / 1000;
        const workerTime = this.workerTime + timeSinceUpdate + (this.bufferSize / 1000);
        const difference = Math.abs(currentTime - workerTime);
        
        this.diagnostics.timingDifferences.push(difference);
        this.diagnostics.maxDifference = Math.max(this.diagnostics.maxDifference, difference);
        
        // Keep only last 100 samples for average calculation
        if (this.diagnostics.timingDifferences.length > 100) {
          this.diagnostics.timingDifferences.shift();
        }
        
        this.diagnostics.avgDifference = this.diagnostics.timingDifferences.reduce((a, b) => a + b, 0) / this.diagnostics.timingDifferences.length;
        
        // Log significant differences
        if (difference > 0.001) { // More than 1ms difference
          console.log(`[TIMING COMPARISON] Performance.now() vs Web Worker difference: ${(difference * 1000).toFixed(2)}ms`);
        }
      }
    } else {
      // Web Worker mode (default)
      this.diagnostics.webWorkerCalls++;
      
      if (!this.isReady || this.workerTimestamp === 0) {
        // Fallback only during initialization
        currentTime = performance.now() / 1000 - this.startTime;
      } else {
        // Use worker time with large buffer compensation
        const timeSinceUpdate = (performance.now() - this.workerTimestamp) / 1000;
        const bufferedTime = this.workerTime + timeSinceUpdate;
        
        // Apply buffer offset for consistent timing
        currentTime = bufferedTime + (this.bufferSize / 1000);
      }
    }
    
    return currentTime;
  }
  
  /**
   * Reset timing to zero
   */
  reset() {
    this.startTime = performance.now() / 1000;
    this.performanceStartTime = performance.now() / 1000;
    if (this.worker) {
      this.worker.postMessage({ type: 'reset' });
    }
    console.log('[ROCK SOLID TIMING] Reset to zero');
  }
  
  /**
   * Get timing status
   */
  getStatus() {
    return {
      ready: this.isReady,
      mode: this.usePerformanceMode ? 'performance.now()' : 'webworker',
      bufferSize: this.bufferSize,
      updateInterval: this.updateInterval,
      currentTime: this.getCurrentTime(),
      workerTime: this.workerTime,
      lastUpdate: this.workerTimestamp,
      diagnostics: {
        webWorkerCalls: this.diagnostics.webWorkerCalls,
        performanceCalls: this.diagnostics.performanceCalls,
        maxDifference: this.diagnostics.maxDifference,
        avgDifference: this.diagnostics.avgDifference,
        timeSinceLastSwitch: (performance.now() - this.diagnostics.lastSwitchTime) / 1000
      }
    };
  }
  
  /**
   * Destroy the timing system
   */
  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isReady = false;
  }
}

// Create single global instance
const rockSolidTiming = new RockSolidTiming();

// Export simple interface
export function getCurrentTime() {
  return rockSolidTiming.getCurrentTime();
}

export function resetTime() {
  rockSolidTiming.reset();
}

export function getTimingStatus() {
  return rockSolidTiming.getStatus();
}

export function isTimingReady() {
  return rockSolidTiming.isReady;
}

export function setTimingMode(usePerformance) {
  rockSolidTiming.setPerformanceMode(usePerformance);
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.rockSolidTiming = rockSolidTiming;
  window.getRockSolidTime = getCurrentTime;
  window.setRockSolidTimingMode = setTimingMode;
  
  // Add diagnostic function
  window.getTimingDiagnostics = () => {
    const status = getTimingStatus();
    console.log(`[TIMING DIAGNOSTICS] Current Status:
      Mode: ${status.mode}
      Current Time: ${status.currentTime.toFixed(3)}s
      Web Worker Calls: ${status.diagnostics.webWorkerCalls}
      Performance.now() Calls: ${status.diagnostics.performanceCalls}
      Max Difference: ${(status.diagnostics.maxDifference * 1000).toFixed(2)}ms
      Avg Difference: ${(status.diagnostics.avgDifference * 1000).toFixed(2)}ms
      Time Since Last Switch: ${status.diagnostics.timeSinceLastSwitch.toFixed(1)}s
      Worker Ready: ${status.ready}
      Buffer Size: ${status.bufferSize}ms`);
    return status;
  };
} 