// src/tests/subframePrecisionTest.js
import { TemporalTriggerEngine, createNoteFromCrossing } from '../triggers/temporalTriggers.js';
import { getTriggerManager, configureTriggerManager } from '../triggers/triggerManager.js';

/**
 * Test subframe precision triggering
 */
class SubframePrecisionTest {
  /**
   * Initialize the test
   */
  constructor() {
    this.engine = new TemporalTriggerEngine({
      resolution: 1000,      // 1ms resolution
      microSteps: 20,        // Higher micro-steps for testing
      useHighPrecision: true,
      trackVelocity: true,
      debugMode: true
    });
    
    this.baseTimestamp = performance.now() / 1000;
    this.vertexId = 'test-vertex';
    this.results = [];
    this.detectionCount = 0;
    
    console.log('[SubframePrecisionTest] Initialized test at t=', this.baseTimestamp);
  }
  
  /**
   * Run a test simulating a vertex crossing the Y-axis with different frame rates
   * @param {number} fps - Target frame rate in frames per second
   * @param {number} duration - Test duration in seconds
   * @param {number} rotationSpeed - Rotation speed in radians per second
   */
  runFrameRateTest(fps, duration, rotationSpeed) {
    console.log(`[SubframePrecisionTest] Running test at ${fps}fps for ${duration}s with rotation speed ${rotationSpeed}rad/s`);
    
    // Reset engine for this test
    this.engine = new TemporalTriggerEngine({
      resolution: 1000,
      microSteps: 20,
      useHighPrecision: true,
      trackVelocity: true,
      debugMode: true
    });
    
    this.results = [];
    this.detectionCount = 0;
    const frameTime = 1 / fps;
    const totalFrames = Math.ceil(duration * fps);
    const startTime = performance.now() / 1000;
    
    // Run the test frames
    for (let i = 0; i < totalFrames; i++) {
      const frameTimestamp = startTime + (i * frameTime);
      const angle = rotationSpeed * (frameTimestamp - startTime);
      
      // Create a rotating vertex at radius 1
      const position = {
        x: Math.cos(angle),
        y: Math.sin(angle),
        z: 0
      };
      
      // Record the position
      this.engine.recordVertexPosition(this.vertexId, position, frameTimestamp);
      
      // Detect crossings
      const crossing = this.engine.detectCrossing(this.vertexId);
      
      if (crossing.hasCrossed) {
        this.detectionCount++;
        this.results.push({
          frame: i,
          fps,
          frameTimestamp,
          crossingTime: crossing.exactTime,
          position: crossing.position,
          subframePrecision: (crossing.exactTime - frameTimestamp) * 1000, // ms
          isInterpolated: crossing.isInterpolated,
          additionalInfo: crossing.additionalInfo
        });
        
        console.log(`[SubframePrecisionTest] Detected crossing at t=${crossing.exactTime.toFixed(6)}s (frame ${i}), subframe precision: ${((crossing.exactTime - frameTimestamp) * 1000).toFixed(3)}ms`);
      }
    }
    
    // Print summary
    const endTime = performance.now() / 1000;
    const actualDuration = endTime - startTime;
    
    console.log(`[SubframePrecisionTest] Test completed in ${actualDuration.toFixed(3)}s`);
    console.log(`[SubframePrecisionTest] Detected ${this.detectionCount} crossings`);
    
    const expectedCrossings = Math.floor((duration * rotationSpeed) / Math.PI);
    console.log(`[SubframePrecisionTest] Expected approximately ${expectedCrossings} crossings (${duration * rotationSpeed / Math.PI} theoretical)`);
    
    // Calculate timing precision statistics
    if (this.results.length > 0) {
      const totalPrecision = this.results.reduce((sum, r) => sum + Math.abs(r.subframePrecision), 0);
      const avgPrecision = totalPrecision / this.results.length;
      console.log(`[SubframePrecisionTest] Average subframe precision: ${avgPrecision.toFixed(3)}ms`);
    }
    
    return this.results;
  }
  
  /**
   * Run a comparison test between different frame rates
   */
  runComparisonTest() {
    const testDuration = 5; // seconds
    const rotationSpeed = 2 * Math.PI; // 1 rotation per second
    
    console.log('[SubframePrecisionTest] Running comparison test between different frame rates');
    
    // Test at different frame rates
    const frameRates = [60, 30, 15];
    const allResults = {};
    
    for (const fps of frameRates) {
      console.log(`[SubframePrecisionTest] Testing at ${fps}fps`);
      const results = this.runFrameRateTest(fps, testDuration, rotationSpeed);
      allResults[fps] = results;
    }
    
    // Compare results
    console.log('[SubframePrecisionTest] Comparison results:');
    
    // Count total crossings at each frame rate
    for (const fps of frameRates) {
      console.log(`- ${fps}fps: ${allResults[fps].length} crossings detected`);
    }
    
    // Compare timing precision
    for (const fps of frameRates) {
      const results = allResults[fps];
      if (results.length > 0) {
        const totalPrecision = results.reduce((sum, r) => sum + Math.abs(r.subframePrecision), 0);
        const avgPrecision = totalPrecision / results.length;
        console.log(`- ${fps}fps: Average subframe precision = ${avgPrecision.toFixed(3)}ms`);
      }
    }
    
    return allResults;
  }
  
  /**
   * Test handling of frame drops
   */
  runFrameDropTest() {
    console.log('[SubframePrecisionTest] Running frame drop test');
    
    // Reset engine
    this.engine = new TemporalTriggerEngine({
      resolution: 1000,
      microSteps: 20,
      useHighPrecision: true,
      trackVelocity: true,
      debugMode: true
    });
    
    this.results = [];
    this.detectionCount = 0;
    
    const baseFrameRate = 60;
    const frameTime = 1 / baseFrameRate;
    const rotationSpeed = 2 * Math.PI; // 1 rotation per second
    const duration = 5; // seconds
    const totalFrames = Math.ceil(duration * baseFrameRate);
    const startTime = performance.now() / 1000;
    
    // Define frame drop pattern (every 10th frame is dropped)
    const dropPattern = [false, false, false, false, false, false, false, false, false, true];
    
    // Run frames with drops
    let actualFrameCount = 0;
    for (let i = 0; i < totalFrames; i++) {
      // Check if this frame should be dropped
      if (dropPattern[i % dropPattern.length]) {
        continue; // Skip this frame
      }
      
      actualFrameCount++;
      const frameTimestamp = startTime + (i * frameTime);
      const angle = rotationSpeed * (frameTimestamp - startTime);
      
      // Create a rotating vertex
      const position = {
        x: Math.cos(angle),
        y: Math.sin(angle),
        z: 0
      };
      
      // Record position
      this.engine.recordVertexPosition(this.vertexId, position, frameTimestamp);
      
      // Detect crossings
      const crossing = this.engine.detectCrossing(this.vertexId);
      
      if (crossing.hasCrossed) {
        this.detectionCount++;
        this.results.push({
          frame: i,
          frameTimestamp,
          crossingTime: crossing.exactTime,
          position: crossing.position,
          subframePrecision: (crossing.exactTime - frameTimestamp) * 1000,
          isInterpolated: crossing.isInterpolated
        });
        
        console.log(`[SubframePrecisionTest] Frame drop test: Detected crossing at t=${crossing.exactTime.toFixed(6)}s (frame ${i})`);
      }
    }
    
    // Print summary
    console.log(`[SubframePrecisionTest] Frame drop test: Ran ${actualFrameCount} of ${totalFrames} frames (${(actualFrameCount/totalFrames*100).toFixed(1)}%)`);
    console.log(`[SubframePrecisionTest] Frame drop test: Detected ${this.detectionCount} crossings`);
    
    const expectedCrossings = Math.floor((duration * rotationSpeed) / Math.PI);
    console.log(`[SubframePrecisionTest] Frame drop test: Expected approximately ${expectedCrossings} crossings`);
    
    return this.results;
  }
  
  /**
   * Test integration with TriggerManager
   */
  testTriggerManagerIntegration() {
    console.log('[SubframePrecisionTest] Testing TriggerManager integration');
    
    // Configure TriggerManager to use temporal system
    configureTriggerManager({
      useTemporalTriggers: true,
      enableParallelDetection: false,
      enableLogging: true,
      temporalConfig: {
        resolution: 1000,
        microSteps: 20,
        useHighPrecision: true,
        trackVelocity: true,
        debugMode: true
      }
    });
    
    const triggerManager = getTriggerManager();
    
    // Create a mock layer
    const mockLayer = this._createMockLayer();
    
    // Simulate triggers over time
    const duration = 3; // seconds
    const fps = 60;
    const frameTime = 1 / fps;
    const totalFrames = Math.ceil(duration * fps);
    const startTime = performance.now() / 1000;
    
    const detectedNotes = [];
    const mockCallback = (note) => {
      detectedNotes.push(note);
      console.log(`[SubframePrecisionTest] TriggerManager detected note: freq=${note.frequency.toFixed(1)}Hz at t=${note.time.toFixed(6)}s`);
    };
    
    // Run frames
    for (let i = 0; i < totalFrames; i++) {
      const frameTimestamp = startTime + (i * frameTime);
      
      // Update mock layer rotation
      mockLayer.group.rotation.z = 2 * Math.PI * (frameTimestamp - startTime);
      
      // Detect triggers
      triggerManager.detectLayerTriggers(mockLayer, frameTimestamp, mockCallback);
    }
    
    // Print summary
    console.log(`[SubframePrecisionTest] TriggerManager integration test: detected ${detectedNotes.length} notes`);
    
    if (detectedNotes.length > 0) {
      // Calculate timing precision
      const precisions = [];
      for (let i = 1; i < detectedNotes.length; i++) {
        const timeDiff = detectedNotes[i].time - detectedNotes[i-1].time;
        precisions.push(timeDiff);
      }
      
      if (precisions.length > 0) {
        const avgTimeDiff = precisions.reduce((sum, diff) => sum + diff, 0) / precisions.length;
        console.log(`[SubframePrecisionTest] Average time between notes: ${avgTimeDiff.toFixed(6)}s`);
      }
    }
    
    // Get engine metrics
    const metrics = triggerManager.getTemporalEngineMetrics();
    console.log('[SubframePrecisionTest] Temporal engine metrics:', metrics);
    
    return detectedNotes;
  }
  
  /**
   * Test integration with the refactored trigger detection system
   */
  testRefactoredTriggerSystem() {
    console.log('[SubframePrecisionTest] Testing refactored trigger system integration');
    
    // Configure TriggerManager to use both original and temporal system for comparison
    configureTriggerManager({
      useTemporalTriggers: false,
      enableParallelDetection: true,
      enableLogging: true,
      temporalConfig: {
        resolution: 1000,
        microSteps: 20,
        useHighPrecision: true,
        trackVelocity: true,
        debugMode: true
      }
    });
    
    const triggerManager = getTriggerManager();
    
    // Create a mock layer
    const mockLayer = this._createMockLayer();
    
    // Simulate triggers over time with varying framerates
    const duration = 5; // seconds
    const originalNotes = [];
    const temporalNotes = [];
    
    const mockCallback = (note) => {
      if (note.system === 'original') {
        originalNotes.push(note);
        console.log(`[SubframePrecisionTest] Original system detected note: freq=${note.frequency.toFixed(1)}Hz at t=${note.time.toFixed(6)}s`);
      } else if (note.system === 'temporal') {
        temporalNotes.push(note);
        console.log(`[SubframePrecisionTest] Temporal system detected note: freq=${note.frequency.toFixed(1)}Hz at t=${note.time.toFixed(6)}s`);
      }
    };
    
    // Test with varying framerates
    const frameRates = [60, 30, 15, 7.5]; // Test including very low framerates
    const framerateResults = {};
    
    for (const fps of frameRates) {
      console.log(`[SubframePrecisionTest] Testing with framerate: ${fps}fps`);
      
      // Reset arrays
      originalNotes.length = 0;
      temporalNotes.length = 0;
      
      // Reset trigger system
      triggerManager.reset();
      
      const frameTime = 1 / fps;
      const totalFrames = Math.ceil(duration * fps);
      const startTime = performance.now() / 1000;
      
      // Run frames
      for (let i = 0; i < totalFrames; i++) {
        const frameTimestamp = startTime + (i * frameTime);
        
        // Update mock layer rotation - full rotation every 2 seconds
        mockLayer.group.rotation.z = Math.PI * (frameTimestamp - startTime);
        
        // Detect triggers
        triggerManager.detectLayerTriggers(mockLayer, frameTimestamp, mockCallback);
      }
      
      // Store results for this framerate
      framerateResults[fps] = {
        originalCount: originalNotes.length,
        temporalCount: temporalNotes.length,
        originalNotes: [...originalNotes],
        temporalNotes: [...temporalNotes]
      };
      
      console.log(`[SubframePrecisionTest] Results at ${fps}fps: ${originalNotes.length} original triggers, ${temporalNotes.length} temporal triggers`);
    }
    
    // Analyze consistency across framerates
    console.log('[SubframePrecisionTest] Analyzing frame-rate independence:');
    const counts = Object.entries(framerateResults).map(([fps, result]) => ({
      fps: Number(fps),
      originalCount: result.originalCount,
      temporalCount: result.temporalCount
    }));
    
    // Calculate statistics
    const originalCounts = counts.map(c => c.originalCount);
    const temporalCounts = counts.map(c => c.temporalCount);
    
    const originalStdDev = this._calculateStdDev(originalCounts);
    const temporalStdDev = this._calculateStdDev(temporalCounts);
    
    console.log(`[SubframePrecisionTest] Original system trigger count standard deviation: ${originalStdDev.toFixed(2)}`);
    console.log(`[SubframePrecisionTest] Temporal system trigger count standard deviation: ${temporalStdDev.toFixed(2)}`);
    console.log(`[SubframePrecisionTest] Lower standard deviation indicates better frame-rate independence`);
    
    // Get timing statistics from TriggerManager
    const stats = triggerManager.getTriggerStats();
    console.log('[SubframePrecisionTest] Trigger stats:', stats);
    
    return {
      framerateResults,
      stats,
      originalStdDev,
      temporalStdDev
    };
  }
  
  /**
   * Calculate standard deviation of an array of numbers
   * @param {Array<number>} values - Array of values
   * @returns {number} Standard deviation
   * @private
   */
  _calculateStdDev(values) {
    const n = values.length;
    if (n === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    return Math.sqrt(variance);
  }
  
  /**
   * Create a mock layer for testing
   * @returns {Object} Mock layer
   * @private
   */
  _createMockLayer() {
    // Create a position attribute with a square shape
    const positions = new Float32Array([
      1, 1, 0,   // top right
      1, -1, 0,  // bottom right
      -1, -1, 0, // bottom left
      -1, 1, 0   // top left
    ]);
    
    // Create a position attribute object that mimics THREE.BufferAttribute
    const positionAttribute = {
      count: 4,
      array: positions,
      itemSize: 3,
      fromBufferAttribute: (_, index) => {
        return {
          x: positions[index * 3],
          y: positions[index * 3 + 1],
          z: positions[index * 3 + 2],
          applyMatrix4: function(matrix) {
            // Simple matrix multiplication for testing
            const x = this.x;
            const y = this.y;
            const z = this.z;
            
            // Apply rotation around Z axis only for simplicity
            const angle = matrix.elements[0]; // Use first element as rotation angle
            this.x = x * Math.cos(angle) - y * Math.sin(angle);
            this.y = x * Math.sin(angle) + y * Math.cos(angle);
            
            return this;
          }
        };
      }
    };
    
    // Create geometry object
    const geometry = {
      getAttribute: (name) => {
        if (name === 'position') {
          return positionAttribute;
        }
        return null;
      }
    };
    
    // Create a LineLoop object
    const lineLoop = {
      type: 'LineLoop',
      geometry: geometry,
      matrixWorld: {
        elements: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      },
      updateMatrixWorld: function() {
        // Update matrix world based on parent rotation
        this.matrixWorld.elements[0] = this.parent.parent.rotation.z;
      }
    };
    
    // Create a parent for the LineLoop
    const copyGroup = {
      type: 'Group',
      children: [lineLoop]
    };
    
    lineLoop.parent = copyGroup;
    
    // Create the mock layer
    const mockLayer = {
      id: 'test-layer',
      group: {
        children: [{ type: 'Mesh' }, copyGroup], // First child is dummy, second is copy group
        visible: true,
        rotation: { z: 0 }
      },
      state: {
        segments: 4,
        copies: 1,
        useEqualTemperament: true,
        referenceFrequency: 440
      }
    };
    
    copyGroup.parent = mockLayer.group;
    
    return mockLayer;
  }
}

// Export for use in browser or module
export { SubframePrecisionTest };

// Run the tests if this is the main module
if (typeof window !== 'undefined') {
  window.runSubframePrecisionTests = function() {
    const test = new SubframePrecisionTest();
    console.log('Running subframe precision tests...');
    
    // Basic test at 60fps
    test.runFrameRateTest(60, 3, Math.PI);
    
    // Comparison test
    test.runComparisonTest();
    
    // Frame drop test
    test.runFrameDropTest();
    
    // Integration test
    test.testTriggerManagerIntegration();
    
    // Test refactored trigger system
    test.testRefactoredTriggerSystem();
    
    return test;
  };
} 