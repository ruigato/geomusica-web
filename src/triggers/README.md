# Trigger Detection System

This directory contains the trigger detection systems for the GeoMusica web application. There are two main systems:

1. **Original Frame-based System** - The original trigger detection system that processes triggers on a per-frame basis
2. **Temporal Trigger System** - A new frame-rate independent system that uses high-precision time slicing

## TriggerManager

The `TriggerManager` class provides a unified interface for working with both trigger detection systems. It allows for:

- Switching between systems using a feature flag
- Running both systems in parallel for comparison
- Collecting performance metrics
- Logging and analyzing trigger differences
- Safely transitioning from one system to the other

### Basic Usage

```javascript
import { configureTriggerManager, detectLayerTriggers } from './triggers/triggerManager.js';

// Configure which system to use
configureTriggerManager({
  useTemporalTriggers: false // Use original system by default
});

// Use the active system for trigger detection
function animationLoop(time) {
  // ... other animation code
  
  // Detect triggers using the active system
  detectLayerTriggers(layer, time, audioCallback);
  
  // ... more animation code
  requestAnimationFrame(animationLoop);
}

// Start animation
requestAnimationFrame(animationLoop);
```

### A/B Testing

To run both systems in parallel and compare results:

```javascript
import { configureTriggerManager, getTriggerManager } from './triggers/triggerManager.js';

// Configure for A/B testing
configureTriggerManager({
  useTemporalTriggers: false, // Which system should actually trigger audio
  enableParallelDetection: true, // Run both systems
  enableLogging: true, // Log trigger comparisons
  enablePerformanceMonitoring: true // Track performance
});

// Later, get statistics
const manager = getTriggerManager();
const stats = manager.getTriggerStats();
const perfMetrics = manager.getPerformanceMetrics();

console.log(`Original triggers: ${stats.originalTriggerCount}`);
console.log(`Temporal triggers: ${stats.temporalTriggerCount}`);
console.log(`Match percentage: ${stats.summary.matchPercentage}`);
console.log(`Original system avg time: ${perfMetrics.original.avgTime.toFixed(3)}ms`);
console.log(`Temporal system avg time: ${perfMetrics.temporal.avgTime.toFixed(3)}ms`);
```

### Comparison Demo

The project includes a demonstration page at `src/demos/triggerComparison.html` that visualizes both systems side-by-side, showing:

- Trigger detection in real-time
- Performance comparisons
- Trigger matching statistics
- Timing differences between systems

Use this demo to understand how the two systems behave differently, especially:

1. At different frame rates
2. With different rotation speeds
3. With different cooldown times

## API Reference

### TriggerManager Class

```javascript
import { TriggerManager } from './triggers/triggerManager.js';

// Create an instance (normally you'd use getTriggerManager())
const manager = new TriggerManager({
  useTemporalTriggers: false,
  enableParallelDetection: false,
  enableLogging: false,
  enablePerformanceMonitoring: false
});

// Methods
manager.setTemporalTriggersEnabled(true); // Switch to temporal system
manager.setParallelDetectionEnabled(true); // Enable running both systems
manager.setLoggingEnabled(true); // Enable trigger comparison logging
manager.setPerformanceMonitoringEnabled(true); // Enable performance tracking

// Get data
const stats = manager.getTriggerStats(); // Get trigger statistics
const metrics = manager.getPerformanceMetrics(); // Get performance metrics
const logs = manager.getRecentComparisonLogs(10); // Get 10 most recent logs
const exportedLogs = manager.exportComparisonLogs(); // Export all logs as JSON
```

### Global Functions

```javascript
import {
  getTriggerManager,
  configureTriggerManager,
  detectLayerTriggers,
  resetTriggerSystem,
  setTemporalTriggersEnabled,
  isTemporalTriggersEnabled
} from './triggers/triggerManager.js';

// Get the singleton instance
const manager = getTriggerManager();

// Configure with options
configureTriggerManager({
  useTemporalTriggers: true,
  enableParallelDetection: true,
  enableLogging: true,
  enablePerformanceMonitoring: true
});

// Detect triggers (main function used in animation loop)
detectLayerTriggers(layer, timeNow, audioCallback);

// Reset trigger state
resetTriggerSystem();

// Toggle temporal system
setTemporalTriggersEnabled(true);

// Check which system is active
const usingTemporal = isTemporalTriggersEnabled();
```

## Migration Plan

When transitioning from the original system to the temporal system, follow these steps:

1. Enable parallel detection and logging
2. Run both systems in parallel for several test sessions
3. Analyze the trigger statistics and performance metrics
4. Check for any areas where the systems behave differently
5. Adjust temporal system parameters if needed
6. When satisfied with the match rate and performance, switch to temporal system

## Technical Details

### Original System Limitations

The original frame-based system has several limitations:

- Misses triggers when frame rate drops
- Frame-based cooldown instead of time-based
- Lacks proper position interpolation between frames
- No continuous path checking for fast-moving objects

### Temporal System Improvements

The temporal system addresses these issues with:

- High-precision time slicing (1000Hz resolution)
- Proper position interpolation between frames
- Bresenham-inspired continuous path detection
- Time-based cooldowns instead of frame-based ones
- More accurate trigger timing information 