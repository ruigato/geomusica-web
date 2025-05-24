// src/triggers/triggerManager.test.js - Test file for the TriggerManager
import { 
  getTriggerManager, 
  configureTriggerManager, 
  setTemporalTriggersEnabled,
  isTemporalTriggersEnabled,
  detectLayerTriggers,
  resetTriggerSystem
} from './triggerManager.js';

// Mock audio callback for testing
const audioCallback = (note) => {
  console.log(`[Test] Audio triggered: ${note.frequency}Hz`);
};

// Simple test to verify the TriggerManager is working
function runBasicTest() {
  console.log('----- BASIC TRIGGER MANAGER TEST -----');
  
  // Get the TriggerManager instance
  const manager = getTriggerManager();
  
  // Log initial state
  console.log(`Initial temporal trigger state: ${manager.isTemporalTriggersEnabled() ? 'enabled' : 'disabled'}`);
  
  // Toggle temporal triggers on
  manager.setTemporalTriggersEnabled(true);
  console.log(`After toggle: ${manager.isTemporalTriggersEnabled() ? 'enabled' : 'disabled'}`);
  
  // Toggle temporal triggers off
  manager.setTemporalTriggersEnabled(false);
  console.log(`After second toggle: ${manager.isTemporalTriggersEnabled() ? 'enabled' : 'disabled'}`);
  
  // Reset trigger system
  manager.resetTriggerSystem();
  console.log('Trigger system reset');
  
  console.log('----- BASIC TEST COMPLETE -----');
}

// A/B Testing demo using the TriggerManager
function runABTestingDemo() {
  console.log('----- A/B TESTING DEMO -----');
  
  // Configure the TriggerManager for A/B testing
  configureTriggerManager({
    useTemporalTriggers: false, // Start with original system
    enableParallelDetection: true, // Run both systems
    enableLogging: true, // Log comparison data
    enablePerformanceMonitoring: true // Track performance
  });
  
  const manager = getTriggerManager();
  
  // Create a mock layer for testing
  const mockLayer = createMockLayer();
  
  // Simulate 100 frames of animation with the original system
  console.log('Running 100 frames with ORIGINAL system...');
  simulateFrames(mockLayer, 100, false);
  
  // Print stats
  printStats(manager);
  
  // Switch to temporal system
  setTemporalTriggersEnabled(true);
  
  // Simulate 100 frames of animation with the temporal system
  console.log('Running 100 frames with TEMPORAL system...');
  simulateFrames(mockLayer, 100, true);
  
  // Print final stats
  printStats(manager);
  
  // Export logs
  const logsJson = manager.exportComparisonLogs();
  console.log('Exported logs:', logsJson.substring(0, 100) + '...');
  
  console.log('----- A/B TESTING DEMO COMPLETE -----');
}

// Create a mock layer for testing
function createMockLayer() {
  // Create a simple layer mock with similar structure to GeoMusica layers
  return {
    id: 'mock-layer',
    state: {
      segments: 4,
      copies: 2
    },
    group: {
      visible: true,
      children: [
        { 
          type: 'Mesh', 
          userData: { isDummy: true } 
        },
        {
          type: 'Group',
          children: [
            {
              type: 'LineLoop',
              geometry: {
                getAttribute: () => ({
                  count: 4,
                  array: new Float32Array([1, 0, 0, 0, 1, 0, -1, 0, 0, 0, -1, 0])
                })
              }
            }
          ]
        },
        {
          type: 'Group',
          children: [
            {
              type: 'LineLoop',
              geometry: {
                getAttribute: () => ({
                  count: 4,
                  array: new Float32Array([2, 0, 0, 0, 2, 0, -2, 0, 0, 0, -2, 0])
                })
              }
            }
          ]
        }
      ],
      parent: { userData: {} }
    },
    baseGeo: {
      getAttribute: () => ({
        array: new Float32Array([1, 0, 0, 0, 1, 0, -1, 0, 0, 0, -1, 0, 2, 0, 0, 0, 2, 0, -2, 0, 0, 0, -2, 0])
      })
    },
    currentAngle: 0,
    previousAngle: 0
  };
}

// Simulate frames of animation
function simulateFrames(mockLayer, frameCount, useTemporal) {
  // Set which system to use (should still run both if parallel detection is enabled)
  setTemporalTriggersEnabled(useTemporal);
  
  let time = 0;
  const timeStep = 1/60; // 60 FPS
  
  for (let i = 0; i < frameCount; i++) {
    // Update layer angle (simulate rotation)
    mockLayer.previousAngle = mockLayer.currentAngle;
    mockLayer.currentAngle = (mockLayer.currentAngle + 0.05) % (2 * Math.PI);
    
    // Detect triggers
    detectLayerTriggers(mockLayer, time, audioCallback);
    
    // Increment time
    time += timeStep;
  }
}

// Print statistics
function printStats(manager) {
  console.log('----- TRIGGER STATISTICS -----');
  
  // Get stats
  const stats = manager.getTriggerStats();
  const perf = manager.getPerformanceMetrics();
  
  // Print trigger stats
  console.log(`Original Triggers: ${stats.originalTriggerCount}`);
  console.log(`Temporal Triggers: ${stats.temporalTriggerCount}`);
  console.log(`Matched Triggers: ${stats.matchedTriggers} (${stats.summary.matchPercentage})`);
  console.log(`Unmatched Original: ${stats.unmatchedOriginal} (${stats.summary.unmatchedOriginalPercentage})`);
  console.log(`Unmatched Temporal: ${stats.unmatchedTemporal} (${stats.summary.unmatchedTemporalPercentage})`);
  console.log(`Avg Timing Difference: ${stats.summary.averageTimingDifference}`);
  
  // Print performance stats
  console.log('----- PERFORMANCE STATISTICS -----');
  console.log(`Original System Avg: ${perf.original.avgTime.toFixed(3)}ms`);
  console.log(`Temporal System Avg: ${perf.temporal.avgTime.toFixed(3)}ms`);
  console.log(`Difference: ${perf.summary.difference.toFixed(3)}ms (${perf.summary.percentageDifference})`);
  
  // Get some recent logs
  const recentLogs = manager.getRecentComparisonLogs(3);
  if (recentLogs.length > 0) {
    console.log('----- RECENT COMPARISON LOGS -----');
    recentLogs.forEach((log, i) => {
      if (log.type === 'match') {
        console.log(`Match ${i+1}: Time diff ${log.timeDiff.toFixed(5)}s, Distance ${log.distance.toFixed(2)}`);
      } else if (log.type === 'unmatched_original') {
        console.log(`Unmatched Original ${i+1}: At time ${log.trigger.time.toFixed(3)}s`);
      } else if (log.type === 'unmatched_temporal') {
        console.log(`Unmatched Temporal ${i+1}: At time ${log.trigger.time.toFixed(3)}s`);
      }
    });
  }
}

// Run the tests when this file is executed
export function runTriggerManagerTests() {
  console.log('===== TRIGGER MANAGER TEST SUITE =====');
  
  // Run basic test
  runBasicTest();
  
  // Run A/B testing demo
  runABTestingDemo();
  
  console.log('===== TEST SUITE COMPLETE =====');
}

// Run tests if this is the main module
if (typeof window !== 'undefined' && window.runTriggerManagerTests) {
  runTriggerManagerTests();
} 