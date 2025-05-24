// src/triggers/temporalTriggers.test.js - Unit tests for temporal trigger engine
import { TemporalTriggerEngine, TemporalCrossingResult, createNoteFromCrossing } from './temporalTriggers.js';

// Mock performance API if running in Node environment
if (typeof performance === 'undefined') {
  global.performance = {
    now: () => Date.now()
  };
}

/**
 * Utility function to create a simulated rotational motion
 * @param {number} radius - Radius of the circle
 * @param {number} angleStart - Starting angle in radians
 * @param {number} angleEnd - Ending angle in radians
 * @param {number} timeStart - Starting time in seconds
 * @param {number} timeEnd - Ending time in seconds
 * @param {number} steps - Number of steps to generate
 * @returns {Array} Array of position points with timestamps
 */
function simulateRotationalMotion(radius, angleStart, angleEnd, timeStart, timeEnd, steps) {
  const positions = [];
  const timeStep = (timeEnd - timeStart) / (steps - 1);
  
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const angle = angleStart + (angleEnd - angleStart) * t;
    const timestamp = timeStart + i * timeStep;
    
    // Calculate position based on angle and radius
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    
    positions.push({
      position: { x, y, z: 0 },
      timestamp
    });
  }
  
  return positions;
}

// Helper to check if two numbers are approximately equal
function approxEqual(a, b, epsilon = 0.0001) {
  return Math.abs(a - b) < epsilon;
}

// Basic tests for engine creation and initialization
describe('TemporalTriggerEngine - Basic Functionality', () => {
  test('Engine initializes with default resolution', () => {
    const engine = new TemporalTriggerEngine();
    expect(engine.resolution).toBe(1000); // Default 1000Hz
  });
  
  test('Engine allows custom resolution', () => {
    const engine = new TemporalTriggerEngine({ resolution: 2000 });
    expect(engine.resolution).toBe(2000);
    expect(engine.timeSlice).toBe(1/2000);
  });
  
  test('TemporalCrossingResult.createEmpty() returns non-crossed result', () => {
    const result = TemporalCrossingResult.createEmpty();
    expect(result.hasCrossed).toBe(false);
  });
  
  test('Engine generates correct vertex and intersection IDs', () => {
    const vertexId = TemporalTriggerEngine.createVertexId('layer1', 2, 3);
    const intersectionId = TemporalTriggerEngine.createIntersectionId('layer1', 2, 3);
    
    expect(vertexId).toBe('layer1-2-3');
    expect(intersectionId).toBe('layer1-intersection-2-3');
  });
});

// Tests for position recording and interpolation
describe('TemporalTriggerEngine - Position Tracking', () => {
  test('Engine correctly records vertex positions', () => {
    const engine = new TemporalTriggerEngine();
    const vertexId = 'test-vertex-1';
    
    engine.recordVertexPosition(vertexId, { x: 10, y: 20, z: 0 }, 1.0);
    engine.recordVertexPosition(vertexId, { x: 20, y: 30, z: 0 }, 2.0);
    
    const states = engine.vertexStates.get(vertexId);
    expect(states.length).toBe(2);
    expect(states[0].position.x).toBe(10);
    expect(states[1].timestamp).toBe(2.0);
  });
  
  test('Engine limits memory usage according to maxMemory', () => {
    const engine = new TemporalTriggerEngine({ maxMemory: 3 });
    const vertexId = 'test-vertex-1';
    
    // Add 5 positions, but maxMemory is 3
    for (let i = 0; i < 5; i++) {
      engine.recordVertexPosition(vertexId, { x: i * 10, y: 0, z: 0 }, i);
    }
    
    const states = engine.vertexStates.get(vertexId);
    expect(states.length).toBe(3);
    // Should only have the 3 most recent positions (2, 3, 4)
    expect(states[0].position.x).toBe(20);
    expect(states[1].position.x).toBe(30);
    expect(states[2].position.x).toBe(40);
  });
  
  test('Linear interpolation calculates correct intermediate positions', () => {
    const engine = new TemporalTriggerEngine();
    
    const state1 = { position: { x: 0, y: 0, z: 0 }, timestamp: 0 };
    const state2 = { position: { x: 100, y: 200, z: 300 }, timestamp: 1 };
    
    // Test interpolation at 25%, 50%, and 75%
    const pos25 = engine.interpolatePosition(state1, state2, 0.25);
    const pos50 = engine.interpolatePosition(state1, state2, 0.5);
    const pos75 = engine.interpolatePosition(state1, state2, 0.75);
    
    expect(pos25.x).toBe(25);
    expect(pos25.y).toBe(50);
    expect(pos25.z).toBe(75);
    
    expect(pos50.x).toBe(50);
    expect(pos50.y).toBe(100);
    expect(pos50.z).toBe(150);
    
    expect(pos75.x).toBe(75);
    expect(pos75.y).toBe(150);
    expect(pos75.z).toBe(225);
  });
});

// Tests for axis crossing detection
describe('TemporalTriggerEngine - Axis Crossing Detection', () => {
  test('Detects simple axis crossing', () => {
    const engine = new TemporalTriggerEngine();
    
    const crossing = engine.checkAxisCrossing(
      { x: 10, y: 20, z: 0 },
      { x: -10, y: 20, z: 0 }
    );
    
    expect(crossing.hasCrossed).toBe(true);
    expect(crossing.crossingFactor).toBeCloseTo(0.5, 5);
  });
  
  test('Does not detect crossing when both points are on same side', () => {
    const engine = new TemporalTriggerEngine();
    
    const crossing = engine.checkAxisCrossing(
      { x: 10, y: 20, z: 0 },
      { x: 5, y: 20, z: 0 }
    );
    
    expect(crossing.hasCrossed).toBe(false);
  });
  
  test('Does not detect crossing when y is negative', () => {
    const engine = new TemporalTriggerEngine();
    
    const crossing = engine.checkAxisCrossing(
      { x: 10, y: -20, z: 0 },
      { x: -10, y: -20, z: 0 }
    );
    
    expect(crossing.hasCrossed).toBe(false);
  });
  
  test('Handles angle-based crossing detection', () => {
    const engine = new TemporalTriggerEngine();
    
    // Points moving in a circle that crosses the Y axis
    const crossing = engine.checkAxisCrossing(
      { x: 5, y: 5, z: 0 },  // First quadrant
      { x: -5, y: 5, z: 0 }  // Second quadrant
    );
    
    expect(crossing.hasCrossed).toBe(true);
  });
});

// Tests for temporal accuracy and interpolation
describe('TemporalTriggerEngine - Temporal Interpolation', () => {
  test('Samples positions correctly along a path', () => {
    const engine = new TemporalTriggerEngine({ resolution: 100 }); // 100Hz = 10ms resolution
    
    const state1 = { 
      position: { x: 10, y: 0, z: 0 }, 
      timestamp: 1.0,
      id: 'test'
    };
    
    const state2 = { 
      position: { x: -10, y: 0, z: 0 }, 
      timestamp: 1.05, // 50ms later
      id: 'test'
    };
    
    // Should generate 6 samples (0%, 20%, 40%, 60%, 80%, 100%)
    const samples = engine.samplePositionsAlongPath(state1, state2);
    
    expect(samples.length).toBe(6);
    expect(samples[0].position.x).toBe(10); // Start
    expect(samples[samples.length-1].position.x).toBe(-10); // End
    
    // Check middle samples
    expect(samples[2].position.x).toBeCloseTo(2, 5); // 40% = 10 - 20*0.4 = 2
    expect(samples[3].position.x).toBeCloseTo(-2, 5); // 60% = 10 - 20*0.6 = -2
  });
  
  test('Detects crossing with temporal interpolation', () => {
    const engine = new TemporalTriggerEngine();
    const vertexId = 'test-vertex-1';
    
    // Record a motion that crosses the Y axis
    engine.recordVertexPosition(vertexId, { x: 10, y: 10, z: 0 }, 1.0);
    engine.recordVertexPosition(vertexId, { x: -10, y: 10, z: 0 }, 1.1);
    
    // Detect crossing
    const result = engine.detectCrossing(vertexId);
    
    expect(result.hasCrossed).toBe(true);
    expect(result.exactTime).toBeCloseTo(1.05, 5); // Should cross at t=1.05
    expect(result.crossingFactor).toBeCloseTo(0.5, 5); // Should cross at 50% between points
    expect(result.position.x).toBeCloseTo(0, 5); // Should cross at x=0
    expect(result.position.y).toBeCloseTo(10, 5); // Y should remain at 10
  });
  
  test('Respects cooldown time', () => {
    const engine = new TemporalTriggerEngine();
    const vertexId = 'test-vertex-1';
    
    // First crossing
    engine.recordVertexPosition(vertexId, { x: 10, y: 10, z: 0 }, 1.0);
    engine.recordVertexPosition(vertexId, { x: -10, y: 10, z: 0 }, 1.1);
    
    // Detect first crossing
    const result1 = engine.detectCrossing(vertexId);
    expect(result1.hasCrossed).toBe(true);
    
    // Second crossing within cooldown period
    engine.recordVertexPosition(vertexId, { x: 10, y: 10, z: 0 }, 1.2);
    engine.recordVertexPosition(vertexId, { x: -10, y: 10, z: 0 }, 1.3);
    
    // Should not detect due to cooldown
    const result2 = engine.detectCrossing(vertexId, 0.3); // 0.3s cooldown
    expect(result2.hasCrossed).toBe(false);
    
    // Third crossing after cooldown period
    engine.recordVertexPosition(vertexId, { x: 10, y: 10, z: 0 }, 1.5);
    engine.recordVertexPosition(vertexId, { x: -10, y: 10, z: 0 }, 1.6);
    
    // Should detect this one
    const result3 = engine.detectCrossing(vertexId, 0.3);
    expect(result3.hasCrossed).toBe(true);
  });
});

// Tests with simulated rotational motion
describe('TemporalTriggerEngine - Rotational Motion', () => {
  test('Accurately detects crossing during continuous rotation', () => {
    const engine = new TemporalTriggerEngine();
    const vertexId = 'rotating-vertex';
    
    // Simulate 1/4 rotation from 3π/4 to π/4 (crossing Y axis once)
    const radius = 100;
    const motion = simulateRotationalMotion(
      radius,              // radius
      3 * Math.PI / 4,     // start at 135° (above x-axis, left side)
      Math.PI / 4,         // end at 45° (above x-axis, right side)
      1.0,                 // start time
      2.0,                 // end time
      10                   // 10 samples
    );
    
    // Record all positions
    motion.forEach(point => {
      engine.recordVertexPosition(
        vertexId, 
        point.position, 
        point.timestamp
      );
    });
    
    // Detect crossing
    const result = engine.detectCrossing(vertexId);
    
    // Should detect crossing
    expect(result.hasCrossed).toBe(true);
    
    // Should cross at π/2 (90°) which is halfway through the rotation
    const expectedTime = 1.5; // Halfway between 1.0 and 2.0
    expect(result.exactTime).toBeCloseTo(expectedTime, 2);
    
    // At crossing point, x should be 0 and y should be radius
    expect(result.position.x).toBeCloseTo(0, 2);
    expect(result.position.y).toBeCloseTo(radius, 2);
  });
  
  test('Detects multiple crossings in continuous motion', () => {
    const engine = new TemporalTriggerEngine();
    const vertexId = 'rotating-vertex';
    
    // Simulate full rotation (2π) - should cross axis twice
    const motion = simulateRotationalMotion(
      100,           // radius
      0,             // start at 0° 
      2 * Math.PI,   // full rotation
      1.0,           // start time
      3.0,           // end time
      20             // 20 samples
    );
    
    // Record all positions
    motion.forEach(point => {
      engine.recordVertexPosition(
        vertexId, 
        point.position, 
        point.timestamp
      );
    });
    
    // First crossing detection (π/2 to 3π/2)
    const result1 = engine.detectCrossing(vertexId);
    expect(result1.hasCrossed).toBe(true);
    
    // Update last crossing time in the engine to allow detection of second crossing
    engine.recentCrossings.set(vertexId, result1.exactTime);
    
    // Second crossing detection (3π/2 to 2π)
    const result2 = engine.detectCrossing(vertexId);
    expect(result2.hasCrossed).toBe(true);
    
    // Times should be approximately 1.5 and 2.5
    expect(result1.exactTime).toBeCloseTo(1.5, 1);
    expect(result2.exactTime).toBeCloseTo(2.5, 1);
  });
});

// Tests for note generation from crossings
describe('TemporalTriggerEngine - Note Generation', () => {
  test('Creates note with correct timing from crossing result', () => {
    const crossing = new TemporalCrossingResult(
      true,
      1.234, // Exact time
      0.5,   // Crossing factor
      { x: 0, y: 100, z: 0 },
      true   // Is interpolated
    );
    
    const baseNote = {
      frequency: 440,
      velocity: 0.8,
      duration: 0.5,
      layerId: 'test-layer',
      copyIndex: 1,
      vertexIndex: 2
    };
    
    const note = createNoteFromCrossing(crossing, baseNote, {});
    
    expect(note.time).toBe(1.234);
    expect(note.crossingFactor).toBe(0.5);
    expect(note.isInterpolated).toBe(true);
    expect(note.x).toBe(0);
    expect(note.y).toBe(100);
    expect(note.frequency).toBe(440);
    expect(note.layerId).toBe('test-layer');
  });
  
  test('Returns null for non-crossed results', () => {
    const crossing = TemporalCrossingResult.createEmpty();
    const baseNote = { frequency: 440 };
    
    const note = createNoteFromCrossing(crossing, baseNote, {});
    expect(note).toBeNull();
  });
}); 