// src/time/QuickTimingTest.js - Quick timing verification test
import { getCurrentTime, getTimingStatus, TIMING_SOURCES, switchTimingSource } from './time.js';

/**
 * Quick timing test to verify rock-solid performance
 * This runs a 10-second test and reports timing accuracy
 */
export function runQuickTimingTest() {
  console.group('[QUICK TIMING TEST] Starting 10-second timing verification...');
  
  const startTime = getCurrentTime();
  const startPerformanceTime = performance.now();
  const samples = [];
  let frameCount = 0;
  const testDuration = 10; // 10 seconds
  let animationId = null;
  
  // Get initial timing source
  const initialStatus = getTimingStatus();
  const timingSource = initialStatus.activeSource;
  
  console.log(`[QUICK TIMING TEST] Testing timing source: ${timingSource}`);
  
  function sampleTiming() {
    const currentTime = getCurrentTime();
    const performanceTime = performance.now();
    const relativeTime = currentTime - startTime;
    const performanceRelativeTime = (performanceTime - startPerformanceTime) / 1000;
    
    samples.push({
      audioTime: currentTime,
      performanceTime: performanceTime,
      relativeAudioTime: relativeTime,
      relativePerformanceTime: performanceRelativeTime,
      frameNumber: frameCount,
      timestamp: Date.now(),
      timingSource: timingSource
    });
    
    frameCount++;
    
    // Continue for test duration
    if (relativeTime < testDuration) {
      animationId = requestAnimationFrame(sampleTiming);
    } else {
      analyzeQuickTest(samples, startTime, startPerformanceTime, timingSource);
    }
  }
  
  // Start the test
  animationId = requestAnimationFrame(sampleTiming);
  
  console.log('[QUICK TIMING TEST] Running... switch tabs to test background behavior');
  console.log('[QUICK TIMING TEST] Using requestAnimationFrame for accurate measurements');
  
  return {
    stop: () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
        console.log('[QUICK TIMING TEST] Test stopped manually');
      }
    }
  };
}

/**
 * Analyze quick test results
 */
function analyzeQuickTest(samples, startTime, startPerformanceTime, timingSource) {
  console.log('[QUICK TIMING TEST] Analyzing results...');
  
  if (samples.length < 2) {
    console.error('[QUICK TIMING TEST] Not enough samples for analysis');
    return;
  }
  
  // Calculate timing consistency between AudioContext and performance.now()
  const timingDifferences = samples.map(sample => {
    return Math.abs(sample.relativeAudioTime - sample.relativePerformanceTime);
  });
  
  const avgTimingDiff = timingDifferences.reduce((a, b) => a + b, 0) / timingDifferences.length;
  const maxTimingDiff = Math.max(...timingDifferences);
  const minTimingDiff = Math.min(...timingDifferences);
  
  // Calculate frame rate consistency (using performance.now as reference)
  const frameIntervals = [];
  for (let i = 1; i < samples.length; i++) {
    const interval = samples[i].relativePerformanceTime - samples[i-1].relativePerformanceTime;
    frameIntervals.push(interval);
  }
  
  const avgFrameInterval = frameIntervals.reduce((a, b) => a + b, 0) / frameIntervals.length;
  const frameRateHz = 1 / avgFrameInterval;
  
  // Calculate AudioContext timing stability
  const audioIntervals = [];
  for (let i = 1; i < samples.length; i++) {
    const interval = samples[i].relativeAudioTime - samples[i-1].relativeAudioTime;
    audioIntervals.push(interval);
  }
  
  const avgAudioInterval = audioIntervals.reduce((a, b) => a + b, 0) / audioIntervals.length;
  const audioIntervalStdDev = Math.sqrt(
    audioIntervals.reduce((sq, interval) => sq + Math.pow(interval - avgAudioInterval, 2), 0) / audioIntervals.length
  );
  
  // Check for timing drift over the test duration
  const firstHalfSamples = samples.slice(0, Math.floor(samples.length / 2));
  const secondHalfSamples = samples.slice(Math.floor(samples.length / 2));
  
  const firstHalfAvgDiff = firstHalfSamples.reduce((sum, s) => sum + Math.abs(s.relativeAudioTime - s.relativePerformanceTime), 0) / firstHalfSamples.length;
  const secondHalfAvgDiff = secondHalfSamples.reduce((sum, s) => sum + Math.abs(s.relativeAudioTime - s.relativePerformanceTime), 0) / secondHalfSamples.length;
  const timingDrift = Math.abs(secondHalfAvgDiff - firstHalfAvgDiff);
  
  // Get system status
  const status = getTimingStatus();
  
  // Report results
  console.log('=== QUICK TIMING TEST RESULTS ===');
  console.log(`Test Duration: ${samples[samples.length-1].relativeAudioTime.toFixed(3)}s`);
  console.log(`Samples: ${samples.length}`);
  console.log(`Average Frame Rate: ${frameRateHz.toFixed(1)}fps`);
  console.log(`Timing Source: ${timingSource}`);
  console.log(`AudioContext State: ${status.audioContextState}`);
  console.log(`Cache Hit Rate: ${status.cacheHitRate}`);
  
  // Show hybrid timing info if available
  if (timingSource === TIMING_SOURCES.HYBRID && status.hybridMode) {
    console.log(`Hybrid Mode: ${status.hybridMode}`);
    console.log(`Worker Available: ${status.workerAvailable}`);
    console.log(`Using Worker: ${status.useWorker}`);
    console.log(`Main Stability: ${status.mainStability?.toFixed(3) || 'N/A'}`);
    console.log(`Worker Stability: ${status.workerStability?.toFixed(3) || 'N/A'}`);
  }
  
  console.log('');
  console.log('TIMING CONSISTENCY:');
  console.log(`  Average Difference: ${(avgTimingDiff * 1000).toFixed(3)}ms`);
  console.log(`  Maximum Difference: ${(maxTimingDiff * 1000).toFixed(3)}ms`);
  console.log(`  Minimum Difference: ${(minTimingDiff * 1000).toFixed(3)}ms`);
  console.log(`  Timing Drift: ${(timingDrift * 1000).toFixed(3)}ms`);
  console.log('');
  console.log('TIMING STABILITY:');
  console.log(`  Average Interval: ${(avgAudioInterval * 1000).toFixed(3)}ms`);
  console.log(`  Interval Std Dev: ${(audioIntervalStdDev * 1000).toFixed(3)}ms`);
  console.log(`  Jitter (3σ): ${(audioIntervalStdDev * 3 * 1000).toFixed(3)}ms`);
  console.log('');
  
  // Overall assessment based on professional audio standards
  let assessment = '';
  let recommendations = [];
  
  // Professional audio timing should have <1ms jitter and <0.1ms average difference
  const jitter3Sigma = audioIntervalStdDev * 3 * 1000; // Convert to ms
  const avgDiffMs = avgTimingDiff * 1000;
  
  if (avgDiffMs < 0.1 && jitter3Sigma < 1.0 && timingDrift * 1000 < 0.5) {
    assessment = '🎉 ROCK SOLID TIMING! Professional-grade accuracy achieved.';
  } else if (avgDiffMs < 0.5 && jitter3Sigma < 2.0 && timingDrift * 1000 < 1.0) {
    assessment = '✅ EXCELLENT TIMING! Very stable and accurate.';
  } else if (avgDiffMs < 1.0 && jitter3Sigma < 5.0 && timingDrift * 1000 < 2.0) {
    assessment = '👍 GOOD TIMING! Suitable for most applications.';
  } else {
    assessment = '⚠️  TIMING NEEDS IMPROVEMENT! Consider optimizations.';
    
    if (avgDiffMs > 1.0) {
      recommendations.push('- Large timing difference detected - check AudioContext initialization');
    }
    if (jitter3Sigma > 5.0) {
      recommendations.push('- High jitter detected - consider using HYBRID timing mode');
    }
    if (timingDrift * 1000 > 2.0) {
      recommendations.push('- Timing drift detected - check for background tab throttling');
    }
    if (frameRateHz < 55) {
      recommendations.push('- Low frame rate detected - browser may be throttling requestAnimationFrame');
    }
    if (timingSource !== TIMING_SOURCES.HYBRID) {
      recommendations.push('- Try HYBRID timing mode for better stability');
    }
  }
  
  console.log('ASSESSMENT:', assessment);
  
  if (recommendations.length > 0) {
    console.log('');
    console.log('RECOMMENDATIONS:');
    recommendations.forEach(rec => console.log(rec));
  }
  
  console.groupEnd();
  
  // Make results available globally
  window._quickTimingTestResults = {
    samples: samples.length,
    duration: samples[samples.length-1].relativeAudioTime,
    avgTimingDiff: avgDiffMs,
    maxTimingDiff: maxTimingDiff * 1000,
    jitter3Sigma: jitter3Sigma,
    timingDrift: timingDrift * 1000,
    frameRate: frameRateHz,
    timingSource: timingSource,
    assessment: assessment,
    recommendations: recommendations,
    status: status,
    rawSamples: samples // For detailed analysis
  };
}

/**
 * Run comparative timing test across all timing sources
 */
export async function runComparativeTimingTest() {
  console.group('[COMPARATIVE TIMING TEST] Testing all timing sources...');
  
  const sources = [TIMING_SOURCES.AUDIO_CONTEXT, TIMING_SOURCES.PERFORMANCE_NOW];
  
  // Add hybrid if available
  try {
    const hybridModule = await import('./HybridTimingSystem.js');
    if (hybridModule.hybridTiming) {
      sources.push(TIMING_SOURCES.HYBRID);
    }
  } catch (error) {
    console.warn('[COMPARATIVE TEST] Hybrid timing not available');
  }
  
  const results = {};
  
  for (const source of sources) {
    console.log(`[COMPARATIVE TEST] Testing ${source}...`);
    
    // Switch to this timing source
    switchTimingSource(source);
    
    // Wait a moment for the switch to take effect
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Run a shorter test for each source
    const testResults = await runTimingSourceTest(source, 3); // 3 second test
    results[source] = testResults;
  }
  
  // Analyze comparative results
  console.log('=== COMPARATIVE TIMING RESULTS ===');
  
  let bestSource = null;
  let bestScore = 0;
  
  for (const [source, result] of Object.entries(results)) {
    const score = calculateTimingScore(result);
    console.log(`${source}: Score ${score.toFixed(3)} (jitter: ${result.jitter3Sigma.toFixed(3)}ms, diff: ${result.avgTimingDiff.toFixed(3)}ms)`);
    
    if (score > bestScore) {
      bestScore = score;
      bestSource = source;
    }
  }
  
  console.log(`\nBEST TIMING SOURCE: ${bestSource} (score: ${bestScore.toFixed(3)})`);
  console.log('RECOMMENDATION: Use the best performing timing source for your application.');
  
  console.groupEnd();
  
  return { results, bestSource, bestScore };
}

/**
 * Run a timing test for a specific source
 */
async function runTimingSourceTest(source, duration = 3) {
  return new Promise((resolve) => {
    const startTime = getCurrentTime();
    const startPerformanceTime = performance.now();
    const samples = [];
    let frameCount = 0;
    
    function sampleTiming() {
      const currentTime = getCurrentTime();
      const performanceTime = performance.now();
      const relativeTime = currentTime - startTime;
      const performanceRelativeTime = (performanceTime - startPerformanceTime) / 1000;
      
      samples.push({
        relativeAudioTime: relativeTime,
        relativePerformanceTime: performanceRelativeTime,
        frameNumber: frameCount
      });
      
      frameCount++;
      
      if (relativeTime < duration) {
        requestAnimationFrame(sampleTiming);
      } else {
        // Analyze and resolve
        const result = analyzeTimingSamples(samples);
        resolve(result);
      }
    }
    
    requestAnimationFrame(sampleTiming);
  });
}

/**
 * Analyze timing samples and return metrics
 */
function analyzeTimingSamples(samples) {
  if (samples.length < 2) return null;
  
  // Calculate timing differences
  const timingDifferences = samples.map(sample => {
    return Math.abs(sample.relativeAudioTime - sample.relativePerformanceTime);
  });
  
  const avgTimingDiff = timingDifferences.reduce((a, b) => a + b, 0) / timingDifferences.length;
  const maxTimingDiff = Math.max(...timingDifferences);
  
  // Calculate timing stability
  const audioIntervals = [];
  for (let i = 1; i < samples.length; i++) {
    const interval = samples[i].relativeAudioTime - samples[i-1].relativeAudioTime;
    audioIntervals.push(interval);
  }
  
  const avgAudioInterval = audioIntervals.reduce((a, b) => a + b, 0) / audioIntervals.length;
  const audioIntervalStdDev = Math.sqrt(
    audioIntervals.reduce((sq, interval) => sq + Math.pow(interval - avgAudioInterval, 2), 0) / audioIntervals.length
  );
  
  return {
    avgTimingDiff: avgTimingDiff * 1000, // Convert to ms
    maxTimingDiff: maxTimingDiff * 1000,
    jitter3Sigma: audioIntervalStdDev * 3 * 1000,
    samples: samples.length
  };
}

/**
 * Calculate a timing quality score (higher = better)
 */
function calculateTimingScore(result) {
  if (!result) return 0;
  
  // Score based on jitter and timing difference (lower = better, so invert)
  const jitterScore = 1 / (1 + result.jitter3Sigma);
  const diffScore = 1 / (1 + result.avgTimingDiff);
  
  // Weighted average (jitter is more important for audio applications)
  return (jitterScore * 0.7) + (diffScore * 0.3);
}

// Make available globally
if (typeof window !== 'undefined') {
  window.runQuickTimingTest = runQuickTimingTest;
  window.runComparativeTimingTest = runComparativeTimingTest;
} 