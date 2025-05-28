// src/time/TimingDiagnostics.js - Comprehensive timing diagnostics and stress testing
import { getCurrentTime, getTimingStatus, configureTimingCache, switchTimingSource, TIMING_SOURCES } from './time.js';

class TimingDiagnostics {
  constructor() {
    this.isRunning = false;
    this.testResults = [];
    this.backgroundTabTest = null;
    this.highBPMTest = null;
    this.stressTest = null;
    this.continuityTest = null;
    
    // Test configuration
    this.testDuration = 30000; // 30 seconds
    this.sampleInterval = 16.67; // ~60fps
    this.highBPMValues = [120, 180, 240, 300, 400, 500]; // Test various BPM values
    
    // Results storage
    this.timingData = [];
    this.frameRateData = [];
    this.backgroundTabData = [];
    
    // Bind methods
    this.runDiagnostics = this.runDiagnostics.bind(this);
    this.stopDiagnostics = this.stopDiagnostics.bind(this);
    this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
  }

  /**
   * Start comprehensive timing diagnostics
   */
  async runDiagnostics() {
    if (this.isRunning) {
      console.warn('[TIMING DIAGNOSTICS] Already running');
      return;
    }

    this.isRunning = true;
    this.testResults = [];
    this.timingData = [];
    this.frameRateData = [];
    this.backgroundTabData = [];

    console.group('[TIMING DIAGNOSTICS] Starting comprehensive timing tests...');
    
    // Test 1: Basic timing accuracy
    await this.testBasicTiming();
    
    // Test 2: Cache performance
    await this.testCachePerformance();
    
    // Test 3: Background tab behavior
    await this.testBackgroundTabBehavior();
    
    // Test 4: High BPM stress test
    await this.testHighBPMStress();
    
    // Test 5: Timing source switching
    await this.testTimingSourceSwitching();
    
    // Test 6: Long-term stability
    await this.testLongTermStability();
    
    // Generate comprehensive report
    this.generateReport();
    
    console.groupEnd();
    this.isRunning = false;
  }

  /**
   * Test basic timing accuracy and precision
   */
  async testBasicTiming() {
    console.log('[TIMING DIAGNOSTICS] Testing basic timing accuracy...');
    
    const samples = [];
    const startTime = getCurrentTime();
    let lastTime = startTime;
    
    for (let i = 0; i < 1000; i++) {
      const currentTime = getCurrentTime();
      const delta = currentTime - lastTime;
      samples.push({
        time: currentTime,
        delta: delta,
        absoluteTime: currentTime - startTime
      });
      lastTime = currentTime;
      
      // Small delay to simulate real usage
      await new Promise(resolve => setTimeout(resolve, 1));
    }
    
    // Analyze timing precision
    const deltas = samples.slice(1).map(s => s.delta);
    const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const maxDelta = Math.max(...deltas);
    const minDelta = Math.min(...deltas.filter(d => d > 0));
    const stdDev = Math.sqrt(deltas.reduce((sq, n) => sq + Math.pow(n - avgDelta, 2), 0) / deltas.length);
    
    this.testResults.push({
      test: 'Basic Timing Accuracy',
      avgDelta: avgDelta * 1000, // Convert to ms
      maxDelta: maxDelta * 1000,
      minDelta: minDelta * 1000,
      stdDev: stdDev * 1000,
      samples: samples.length,
      status: stdDev < 0.001 ? 'EXCELLENT' : stdDev < 0.005 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
    });
  }

  /**
   * Test cache performance and hit rates
   */
  async testCachePerformance() {
    console.log('[TIMING DIAGNOSTICS] Testing cache performance...');
    
    // Test different cache durations
    const cacheDurations = [0, 1, 2, 5, 10]; // milliseconds
    const cacheResults = [];
    
    for (const duration of cacheDurations) {
      configureTimingCache({ enabled: true, duration: duration });
      
      const startStatus = getTimingStatus();
      const startTime = performance.now();
      
      // Simulate high-frequency timing calls
      for (let i = 0; i < 10000; i++) {
        getCurrentTime();
      }
      
      const endTime = performance.now();
      const endStatus = getTimingStatus();
      
      const totalCalls = endStatus.cacheHits + endStatus.cacheMisses - (startStatus.cacheHits + startStatus.cacheMisses);
      const hitRate = totalCalls > 0 ? (endStatus.cacheHits - startStatus.cacheHits) / totalCalls : 0;
      
      cacheResults.push({
        duration: duration,
        hitRate: hitRate * 100,
        totalTime: endTime - startTime,
        callsPerMs: totalCalls / (endTime - startTime)
      });
    }
    
    this.testResults.push({
      test: 'Cache Performance',
      results: cacheResults,
      status: 'COMPLETED'
    });
    
    // Reset to optimal cache settings
    configureTimingCache({ enabled: true, duration: 2 });
  }

  /**
   * Test background tab behavior
   */
  async testBackgroundTabBehavior() {
    console.log('[TIMING DIAGNOSTICS] Testing background tab behavior...');
    console.log('[TIMING DIAGNOSTICS] Please switch to another tab/window and back to test background behavior');
    
    // Set up visibility change monitoring
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    
    const testData = {
      foregroundSamples: [],
      backgroundSamples: [],
      transitionEvents: []
    };
    
    const startTime = getCurrentTime();
    let sampleCount = 0;
    const maxSamples = 3000; // 50 seconds at 60fps
    
    const sampleTiming = () => {
      if (sampleCount >= maxSamples) {
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        this.analyzeBgTabResults(testData, startTime);
        return;
      }
      
      const currentTime = getCurrentTime();
      const sample = {
        time: currentTime,
        relativeTime: currentTime - startTime,
        visible: !document.hidden,
        frameTime: performance.now()
      };
      
      if (document.hidden) {
        testData.backgroundSamples.push(sample);
      } else {
        testData.foregroundSamples.push(sample);
      }
      
      sampleCount++;
      setTimeout(sampleTiming, 16.67); // ~60fps
    };
    
    sampleTiming();
    
    // Wait for test completion
    await new Promise(resolve => {
      const checkCompletion = () => {
        if (sampleCount >= maxSamples) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      checkCompletion();
    });
  }

  /**
   * Handle visibility change events for background tab testing
   */
  handleVisibilityChange() {
    const currentTime = getCurrentTime();
    this.backgroundTabData.push({
      time: currentTime,
      hidden: document.hidden,
      event: 'visibilitychange'
    });
    
    console.log(`[TIMING DIAGNOSTICS] Tab ${document.hidden ? 'hidden' : 'visible'} at ${currentTime.toFixed(3)}s`);
  }

  /**
   * Analyze background tab test results
   */
  analyzeBgTabResults(testData, startTime) {
    const { foregroundSamples, backgroundSamples, transitionEvents } = testData;
    
    // Analyze timing continuity across visibility changes
    let timingGaps = [];
    let maxGap = 0;
    
    if (backgroundSamples.length > 0 && foregroundSamples.length > 0) {
      // Check for timing gaps when switching between foreground/background
      const allSamples = [...foregroundSamples, ...backgroundSamples].sort((a, b) => a.time - b.time);
      
      for (let i = 1; i < allSamples.length; i++) {
        const gap = allSamples[i].time - allSamples[i-1].time;
        if (gap > 0.1) { // Gaps larger than 100ms
          timingGaps.push(gap);
          maxGap = Math.max(maxGap, gap);
        }
      }
    }
    
    this.testResults.push({
      test: 'Background Tab Behavior',
      foregroundSamples: foregroundSamples.length,
      backgroundSamples: backgroundSamples.length,
      timingGaps: timingGaps.length,
      maxGap: maxGap * 1000, // Convert to ms
      avgGap: timingGaps.length > 0 ? (timingGaps.reduce((a, b) => a + b, 0) / timingGaps.length) * 1000 : 0,
      status: timingGaps.length === 0 ? 'EXCELLENT' : timingGaps.length < 5 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
    });
  }

  /**
   * Test high BPM stress scenarios
   */
  async testHighBPMStress() {
    console.log('[TIMING DIAGNOSTICS] Testing high BPM stress scenarios...');
    
    const bpmResults = [];
    
    for (const bpm of this.highBPMValues) {
      console.log(`[TIMING DIAGNOSTICS] Testing BPM: ${bpm}`);
      
      const rotationsPerSecond = bpm / 240; // Full rotation time
      const degreesPerMs = (rotationsPerSecond * 360) / 1000;
      
      const samples = [];
      const startTime = getCurrentTime();
      
      // Sample for 5 seconds at high frequency
      for (let i = 0; i < 300; i++) { // 5 seconds at 60fps
        const currentTime = getCurrentTime();
        const relativeTime = currentTime - startTime;
        const expectedRotations = relativeTime * rotationsPerSecond;
        const expectedDegrees = (expectedRotations % 1) * 360;
        
        samples.push({
          time: currentTime,
          relativeTime: relativeTime,
          expectedDegrees: expectedDegrees,
          rotationsPerSecond: rotationsPerSecond
        });
        
        await new Promise(resolve => setTimeout(resolve, 16.67)); // ~60fps
      }
      
      // Analyze timing stability at this BPM
      const timingErrors = [];
      for (let i = 1; i < samples.length; i++) {
        const actualDelta = samples[i].relativeTime - samples[i-1].relativeTime;
        const expectedDelta = 16.67 / 1000; // Expected ~16.67ms
        const error = Math.abs(actualDelta - expectedDelta);
        timingErrors.push(error);
      }
      
      const avgError = timingErrors.reduce((a, b) => a + b, 0) / timingErrors.length;
      const maxError = Math.max(...timingErrors);
      
      bpmResults.push({
        bpm: bpm,
        rotationsPerSecond: rotationsPerSecond,
        avgError: avgError * 1000, // Convert to ms
        maxError: maxError * 1000,
        samples: samples.length,
        status: avgError < 0.001 ? 'EXCELLENT' : avgError < 0.005 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      });
    }
    
    this.testResults.push({
      test: 'High BPM Stress Test',
      results: bpmResults,
      status: 'COMPLETED'
    });
  }

  /**
   * Test timing source switching
   */
  async testTimingSourceSwitching() {
    console.log('[TIMING DIAGNOSTICS] Testing timing source switching...');
    
    const originalSource = getTimingStatus().activeSource;
    const switchResults = [];
    
    // Test switching between sources
    const sources = [TIMING_SOURCES.AUDIO_CONTEXT, TIMING_SOURCES.PERFORMANCE_NOW];
    
    for (const source of sources) {
      console.log(`[TIMING DIAGNOSTICS] Testing source: ${source}`);
      
      switchTimingSource(source);
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow settling
      
      const beforeTime = getCurrentTime();
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second test
      const afterTime = getCurrentTime();
      
      const actualDuration = afterTime - beforeTime;
      const expectedDuration = 1.0;
      const error = Math.abs(actualDuration - expectedDuration);
      
      switchResults.push({
        source: source,
        actualDuration: actualDuration,
        expectedDuration: expectedDuration,
        error: error * 1000, // Convert to ms
        status: error < 0.01 ? 'EXCELLENT' : error < 0.05 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      });
    }
    
    // Restore original source
    switchTimingSource(originalSource);
    
    this.testResults.push({
      test: 'Timing Source Switching',
      results: switchResults,
      status: 'COMPLETED'
    });
  }

  /**
   * Test long-term stability
   */
  async testLongTermStability() {
    console.log('[TIMING DIAGNOSTICS] Testing long-term stability (10 seconds)...');
    
    const samples = [];
    const startTime = getCurrentTime();
    const testDuration = 10; // 10 seconds
    
    const sampleTiming = () => {
      const currentTime = getCurrentTime();
      const relativeTime = currentTime - startTime;
      
      if (relativeTime >= testDuration) {
        this.analyzeLongTermStability(samples, startTime);
        return;
      }
      
      samples.push({
        time: currentTime,
        relativeTime: relativeTime
      });
      
      setTimeout(sampleTiming, 50); // 20fps for long-term test
    };
    
    sampleTiming();
    
    // Wait for test completion
    await new Promise(resolve => {
      const checkCompletion = () => {
        if (samples.length > 0 && samples[samples.length - 1].relativeTime >= testDuration) {
          resolve();
        } else {
          setTimeout(checkCompletion, 100);
        }
      };
      setTimeout(checkCompletion, testDuration * 1000 + 1000);
    });
  }

  /**
   * Analyze long-term stability results
   */
  analyzeLongTermStability(samples, startTime) {
    // Check for drift over time
    const expectedInterval = 0.05; // 50ms
    const intervals = [];
    
    for (let i = 1; i < samples.length; i++) {
      const interval = samples[i].relativeTime - samples[i-1].relativeTime;
      intervals.push(interval);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const drift = Math.abs(avgInterval - expectedInterval);
    const maxDeviation = Math.max(...intervals.map(i => Math.abs(i - expectedInterval)));
    
    this.testResults.push({
      test: 'Long-term Stability',
      duration: samples[samples.length - 1].relativeTime,
      samples: samples.length,
      avgInterval: avgInterval * 1000, // Convert to ms
      expectedInterval: expectedInterval * 1000,
      drift: drift * 1000,
      maxDeviation: maxDeviation * 1000,
      status: drift < 0.001 ? 'EXCELLENT' : drift < 0.005 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
    });
  }

  /**
   * Generate comprehensive diagnostic report
   */
  generateReport() {
    console.group('[TIMING DIAGNOSTICS] COMPREHENSIVE REPORT');
    
    // Overall system status
    const timingStatus = getTimingStatus();
    console.log('=== TIMING SYSTEM STATUS ===');
    console.log('Initialized:', timingStatus.initialized);
    console.log('Active Source:', timingStatus.activeSource);
    console.log('AudioContext State:', timingStatus.audioContextState);
    console.log('Sample Rate:', timingStatus.sampleRate);
    console.log('Cache Hit Rate:', timingStatus.cacheHitRate);
    console.log('');
    
    // Test results
    console.log('=== TEST RESULTS ===');
    this.testResults.forEach(result => {
      console.log(`${result.test}: ${result.status}`);
      
      if (result.test === 'Basic Timing Accuracy') {
        console.log(`  Avg Delta: ${result.avgDelta.toFixed(3)}ms`);
        console.log(`  Std Dev: ${result.stdDev.toFixed(3)}ms`);
        console.log(`  Max Delta: ${result.maxDelta.toFixed(3)}ms`);
      }
      
      if (result.test === 'Background Tab Behavior') {
        console.log(`  Foreground Samples: ${result.foregroundSamples}`);
        console.log(`  Background Samples: ${result.backgroundSamples}`);
        console.log(`  Timing Gaps: ${result.timingGaps}`);
        console.log(`  Max Gap: ${result.maxGap.toFixed(3)}ms`);
      }
      
      if (result.test === 'High BPM Stress Test') {
        console.log('  BPM Results:');
        result.results.forEach(bpmResult => {
          console.log(`    ${bpmResult.bpm} BPM: ${bpmResult.status} (avg error: ${bpmResult.avgError.toFixed(3)}ms)`);
        });
      }
      
      if (result.test === 'Long-term Stability') {
        console.log(`  Duration: ${result.duration.toFixed(3)}s`);
        console.log(`  Drift: ${result.drift.toFixed(3)}ms`);
        console.log(`  Max Deviation: ${result.maxDeviation.toFixed(3)}ms`);
      }
      
      console.log('');
    });
    
    // Recommendations
    console.log('=== RECOMMENDATIONS ===');
    const excellentTests = this.testResults.filter(r => r.status === 'EXCELLENT').length;
    const goodTests = this.testResults.filter(r => r.status === 'GOOD').length;
    const needsImprovementTests = this.testResults.filter(r => r.status === 'NEEDS_IMPROVEMENT').length;
    
    if (excellentTests === this.testResults.length) {
      console.log('🎉 ROCK SOLID TIMING! All tests passed with excellent results.');
      console.log('Your timing system is professional-grade and ready for any BPM.');
    } else if (needsImprovementTests === 0) {
      console.log('✅ SOLID TIMING! Most tests passed with good results.');
      console.log('Minor optimizations possible but timing is reliable.');
    } else {
      console.log('⚠️  TIMING ISSUES DETECTED! Some tests need improvement.');
      console.log('Consider the following optimizations:');
      
      const bgTabTest = this.testResults.find(r => r.test === 'Background Tab Behavior');
      if (bgTabTest && bgTabTest.status === 'NEEDS_IMPROVEMENT') {
        console.log('- Background tab timing needs improvement');
        console.log('- Consider implementing Web Worker timing');
        console.log('- Increase cache duration for background stability');
      }
      
      const highBPMTest = this.testResults.find(r => r.test === 'High BPM Stress Test');
      if (highBPMTest) {
        const failedBPMs = highBPMTest.results.filter(r => r.status === 'NEEDS_IMPROVEMENT');
        if (failedBPMs.length > 0) {
          console.log(`- High BPM timing issues at: ${failedBPMs.map(r => r.bpm).join(', ')} BPM`);
          console.log('- Consider reducing cache duration for high BPM');
          console.log('- Optimize getCurrentTime() function further');
        }
      }
    }
    
    console.groupEnd();
    
    // Make results available globally
    window._timingDiagnostics = {
      results: this.testResults,
      status: timingStatus,
      report: this.generateJSONReport()
    };
  }

  /**
   * Generate JSON report for programmatic access
   */
  generateJSONReport() {
    return {
      timestamp: new Date().toISOString(),
      systemStatus: getTimingStatus(),
      testResults: this.testResults,
      summary: {
        totalTests: this.testResults.length,
        excellent: this.testResults.filter(r => r.status === 'EXCELLENT').length,
        good: this.testResults.filter(r => r.status === 'GOOD').length,
        needsImprovement: this.testResults.filter(r => r.status === 'NEEDS_IMPROVEMENT').length
      }
    };
  }

  /**
   * Stop all running diagnostics
   */
  stopDiagnostics() {
    this.isRunning = false;
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    console.log('[TIMING DIAGNOSTICS] Stopped');
  }
}

// Create global instance
const timingDiagnostics = new TimingDiagnostics();

// Export for use
export { timingDiagnostics };

// Make available globally for console access
if (typeof window !== 'undefined') {
  window.runTimingDiagnostics = () => timingDiagnostics.runDiagnostics();
  window.stopTimingDiagnostics = () => timingDiagnostics.stopDiagnostics();
} 