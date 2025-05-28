// src/time/SimpleTimingTest.js - Simple test for RockSolidTiming stability
import { getCurrentTime, getTimingStatus } from './RockSolidTiming.js';

/**
 * Run a simple timing stability test
 * @param {number} duration - Test duration in seconds (default: 10)
 */
export function runSimpleTimingTest(duration = 10) {
  console.log(`[SIMPLE TIMING TEST] Starting ${duration}-second stability test...`);
  console.log('[SIMPLE TIMING TEST] Try scrolling, clicking, or switching windows during the test!');
  
  const startTime = getCurrentTime();
  const measurements = [];
  let frameCount = 0;
  let lastTime = startTime;
  
  function testFrame() {
    const currentTime = getCurrentTime();
    const deltaTime = currentTime - lastTime;
    const totalTime = currentTime - startTime;
    
    // Record measurement
    measurements.push({
      frame: frameCount,
      time: currentTime,
      delta: deltaTime,
      totalTime: totalTime
    });
    
    frameCount++;
    lastTime = currentTime;
    
    // Continue test if within duration
    if (totalTime < duration) {
      requestAnimationFrame(testFrame);
    } else {
      // Test complete - analyze results
      analyzeResults(measurements, duration);
    }
  }
  
  // Start the test
  requestAnimationFrame(testFrame);
}

/**
 * Analyze timing test results
 * @param {Array} measurements - Array of timing measurements
 * @param {number} expectedDuration - Expected test duration
 */
function analyzeResults(measurements, expectedDuration) {
  if (measurements.length < 2) {
    console.error('[SIMPLE TIMING TEST] Not enough measurements to analyze');
    return;
  }
  
  // Calculate statistics
  const deltas = measurements.slice(1).map(m => m.delta * 1000); // Convert to ms
  const actualDuration = measurements[measurements.length - 1].totalTime;
  const avgFPS = measurements.length / actualDuration;
  
  const avgDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const minDelta = Math.min(...deltas);
  const maxDelta = Math.max(...deltas);
  
  // Calculate jitter (standard deviation)
  const variance = deltas.reduce((sum, delta) => sum + Math.pow(delta - avgDelta, 2), 0) / deltas.length;
  const jitter = Math.sqrt(variance);
  
  // Calculate timing accuracy
  const timingError = Math.abs(actualDuration - expectedDuration) * 1000; // ms
  
  // Count frame drops (deltas > 50ms)
  const frameDrops = deltas.filter(delta => delta > 50).length;
  
  // Display results
  console.log('=== SIMPLE TIMING TEST RESULTS ===');
  console.log(`Duration: ${actualDuration.toFixed(3)}s (expected: ${expectedDuration}s)`);
  console.log(`Timing Error: ${timingError.toFixed(3)}ms`);
  console.log(`Average FPS: ${avgFPS.toFixed(1)}`);
  console.log(`Frame Count: ${measurements.length}`);
  console.log(`Average Frame Time: ${avgDelta.toFixed(3)}ms`);
  console.log(`Min Frame Time: ${minDelta.toFixed(3)}ms`);
  console.log(`Max Frame Time: ${maxDelta.toFixed(3)}ms`);
  console.log(`Jitter (σ): ${jitter.toFixed(3)}ms`);
  console.log(`Frame Drops (>50ms): ${frameDrops}`);
  
  // Get timing system status
  const status = getTimingStatus();
  console.log(`Timing System: RockSolidTiming`);
  console.log(`Worker Ready: ${status.ready}`);
  console.log(`Buffer Size: ${status.bufferSize}ms`);
  console.log(`Update Interval: ${status.updateInterval}ms`);
  
  // Performance assessment
  let grade = 'EXCELLENT';
  if (jitter > 5 || timingError > 10 || frameDrops > 5) {
    grade = 'GOOD';
  }
  if (jitter > 10 || timingError > 50 || frameDrops > 20) {
    grade = 'FAIR';
  }
  if (jitter > 20 || timingError > 100 || frameDrops > 50) {
    grade = 'POOR';
  }
  
  console.log(`Performance Grade: ${grade}`);
  console.log('===================================');
  
  // Show user-friendly summary
  const summary = `RockSolidTiming Test Complete!\n\n` +
    `Duration: ${actualDuration.toFixed(1)}s\n` +
    `Timing Error: ${timingError.toFixed(1)}ms\n` +
    `Jitter: ${jitter.toFixed(1)}ms\n` +
    `Frame Drops: ${frameDrops}\n` +
    `Grade: ${grade}\n\n` +
    `${grade === 'EXCELLENT' ? '🎯 Perfect timing stability!' : 
      grade === 'GOOD' ? '✅ Good timing performance' :
      grade === 'FAIR' ? '⚠️ Acceptable timing with some issues' :
      '❌ Timing issues detected'}`;
  
  // Don't show alert in automated tests
  if (typeof window !== 'undefined' && window.location) {
    alert(summary);
  }
}

/**
 * Run a continuous timing monitor
 * @param {number} intervalSeconds - How often to log status (default: 5)
 */
export function startTimingMonitor(intervalSeconds = 5) {
  console.log('[TIMING MONITOR] Starting continuous timing monitor...');
  
  let lastTime = getCurrentTime();
  let frameCount = 0;
  let measurements = [];
  
  function monitor() {
    const currentTime = getCurrentTime();
    const deltaTime = currentTime - lastTime;
    
    measurements.push(deltaTime * 1000); // Convert to ms
    frameCount++;
    lastTime = currentTime;
    
    // Log status every interval
    if (frameCount % (intervalSeconds * 60) === 0) { // Assuming ~60fps
      const avgDelta = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const jitter = Math.sqrt(measurements.reduce((sum, delta) => 
        sum + Math.pow(delta - avgDelta, 2), 0) / measurements.length);
      
      console.log(`[TIMING MONITOR] Avg: ${avgDelta.toFixed(1)}ms, Jitter: ${jitter.toFixed(1)}ms, Frames: ${frameCount}`);
      
      // Reset measurements to prevent memory buildup
      measurements = [];
    }
    
    requestAnimationFrame(monitor);
  }
  
  requestAnimationFrame(monitor);
}

// Make available globally for easy testing
if (typeof window !== 'undefined') {
  window.runSimpleTimingTest = runSimpleTimingTest;
  window.startTimingMonitor = startTimingMonitor;
} 