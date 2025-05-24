// src/test-runner.js - Browser-based test runner for temporalTriggers tests
import { TemporalTriggerEngine, TemporalCrossingResult, createNoteFromCrossing } from './triggers/temporalTriggers.js';

// Simple browser-based test runner
class BrowserTestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      total: 0
    };
    this.outputElement = null;
  }

  // Add a test to the queue
  test(description, testFn) {
    this.tests.push({ description, testFn, type: 'test' });
    return this;
  }

  // Create a test group
  describe(groupName, groupFn) {
    this.tests.push({ description: groupName, type: 'group-start' });
    groupFn();
    this.tests.push({ type: 'group-end' });
    return this;
  }

  // Set up DOM output element
  setupOutput() {
    this.outputElement = document.createElement('div');
    this.outputElement.id = 'test-output';
    this.outputElement.style.fontFamily = 'monospace';
    this.outputElement.style.padding = '20px';
    this.outputElement.style.maxWidth = '800px';
    this.outputElement.style.margin = '0 auto';
    document.body.appendChild(this.outputElement);

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .test-group { margin-bottom: 10px; border-left: 2px solid #ccc; padding-left: 10px; }
      .test-pass { color: green; }
      .test-fail { color: red; }
      .test-error { color: red; font-weight: bold; }
      .test-summary { margin-top: 20px; font-weight: bold; }
      .test-group-header { font-weight: bold; margin-top: 10px; }
    `;
    document.head.appendChild(style);
  }

  // Log to DOM output
  log(message, className) {
    const line = document.createElement('div');
    line.className = className || '';
    line.innerHTML = message;
    this.outputElement.appendChild(line);
  }

  // Run all queued tests
  async runTests() {
    if (!this.outputElement) {
      this.setupOutput();
    }

    this.log('<h2>Running TemporalTrigger Tests</h2>');
    
    let currentGroupElement = null;
    let groupStack = [];

    for (const test of this.tests) {
      if (test.type === 'group-start') {
        const groupEl = document.createElement('div');
        groupEl.className = 'test-group';
        groupEl.innerHTML = `<div class="test-group-header">${test.description}</div>`;
        
        if (currentGroupElement) {
          groupStack.push(currentGroupElement);
          currentGroupElement.appendChild(groupEl);
        } else {
          this.outputElement.appendChild(groupEl);
        }
        
        currentGroupElement = groupEl;
        continue;
      }
      
      if (test.type === 'group-end') {
        if (groupStack.length > 0) {
          currentGroupElement = groupStack.pop();
        } else {
          currentGroupElement = null;
        }
        continue;
      }

      try {
        // Create the expect function for this test
        const expect = (actual) => {
          return {
            toBe: (expected) => {
              if (actual !== expected) {
                throw new Error(`Expected ${expected} but got ${actual}`);
              }
              return true;
            },
            toBeCloseTo: (expected, precision = 2) => {
              const factor = Math.pow(10, precision);
              const actualRounded = Math.round(actual * factor) / factor;
              const expectedRounded = Math.round(expected * factor) / factor;
              
              if (actualRounded !== expectedRounded) {
                throw new Error(`Expected ${expected} to be close to ${actual} with precision ${precision}`);
              }
              return true;
            },
            toBeTruthy: () => {
              if (!actual) {
                throw new Error(`Expected value to be truthy but got ${actual}`);
              }
              return true;
            },
            toBeFalsy: () => {
              if (actual) {
                throw new Error(`Expected value to be falsy but got ${actual}`);
              }
              return true;
            },
            toBeNull: () => {
              if (actual !== null) {
                throw new Error(`Expected null but got ${actual}`);
              }
              return true;
            }
          };
        };

        this.results.total++;
        
        // Run the test
        await test.testFn(expect);
        
        // If we get here, test passed
        this.results.passed++;
        const message = `✓ ${test.description}`;
        
        if (currentGroupElement) {
          const testLine = document.createElement('div');
          testLine.className = 'test-pass';
          testLine.textContent = message;
          currentGroupElement.appendChild(testLine);
        } else {
          this.log(message, 'test-pass');
        }
      } catch (error) {
        this.results.failed++;
        const message = `✗ ${test.description} - ${error.message}`;
        
        if (currentGroupElement) {
          const testLine = document.createElement('div');
          testLine.className = 'test-fail';
          testLine.textContent = message;
          currentGroupElement.appendChild(testLine);
        } else {
          this.log(message, 'test-fail');
        }
        
        console.error(error);
      }
    }

    // Display summary
    const summary = `Tests completed: ${this.results.passed} passed, ${this.results.failed} failed, ${this.results.total} total`;
    this.log(summary, 'test-summary');
  }
}

// Create test runner instance
const runner = new BrowserTestRunner();

// Helper functions from the original test file
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

function approxEqual(a, b, epsilon = 0.0001) {
  return Math.abs(a - b) < epsilon;
}

// Port the tests from temporalTriggers.test.js
runner.describe('TemporalTriggerEngine - Basic Functionality', () => {
  runner.test('Engine initializes with default resolution', (expect) => {
    const engine = new TemporalTriggerEngine();
    expect(engine.resolution).toBe(1000); // Default 1000Hz
  });
  
  runner.test('Engine allows custom resolution', (expect) => {
    const engine = new TemporalTriggerEngine({ resolution: 2000 });
    expect(engine.resolution).toBe(2000);
    expect(engine.timeSlice).toBe(1/2000);
  });
  
  runner.test('TemporalCrossingResult.createEmpty() returns non-crossed result', (expect) => {
    const result = TemporalCrossingResult.createEmpty();
    expect(result.hasCrossed).toBe(false);
  });
  
  runner.test('Engine generates correct vertex and intersection IDs', (expect) => {
    const vertexId = TemporalTriggerEngine.createVertexId('layer1', 2, 3);
    const intersectionId = TemporalTriggerEngine.createIntersectionId('layer1', 2, 3);
    
    expect(vertexId).toBe('layer1-2-3');
    expect(intersectionId).toBe('layer1-intersection-2-3');
  });
});

runner.describe('TemporalTriggerEngine - Position Tracking', () => {
  runner.test('Engine correctly records vertex positions', (expect) => {
    const engine = new TemporalTriggerEngine();
    const vertexId = 'test-vertex-1';
    
    engine.recordVertexPosition(vertexId, { x: 10, y: 20, z: 0 }, 1.0);
    engine.recordVertexPosition(vertexId, { x: 20, y: 30, z: 0 }, 2.0);
    
    const states = engine.vertexStates.get(vertexId);
    expect(states.length).toBe(2);
    expect(states[0].position.x).toBe(10);
    expect(states[1].timestamp).toBe(2.0);
  });
  
  runner.test('Engine limits memory usage according to maxMemory', (expect) => {
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
  
  runner.test('Linear interpolation calculates correct intermediate positions', (expect) => {
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

runner.describe('TemporalTriggerEngine - Axis Crossing Detection', () => {
  runner.test('Detects simple axis crossing', (expect) => {
    const engine = new TemporalTriggerEngine();
    
    const crossing = engine.checkAxisCrossing(
      { x: 10, y: 20, z: 0 },
      { x: -10, y: 20, z: 0 }
    );
    
    expect(crossing.hasCrossed).toBe(true);
    expect(crossing.crossingFactor).toBeCloseTo(0.5, 2);
  });
  
  runner.test('Does not detect crossing when both points are on same side', (expect) => {
    const engine = new TemporalTriggerEngine();
    
    const crossing = engine.checkAxisCrossing(
      { x: 10, y: 20, z: 0 },
      { x: 5, y: 20, z: 0 }
    );
    
    expect(crossing.hasCrossed).toBe(false);
  });
  
  runner.test('Does not detect crossing when y is negative', (expect) => {
    const engine = new TemporalTriggerEngine();
    
    const crossing = engine.checkAxisCrossing(
      { x: 10, y: -20, z: 0 },
      { x: -10, y: -20, z: 0 }
    );
    
    expect(crossing.hasCrossed).toBe(false);
  });
});

runner.describe('TemporalTriggerEngine - Temporal Interpolation', () => {
  runner.test('Samples positions correctly along a path', (expect) => {
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
    
    // Should generate samples
    const samples = engine.samplePositionsAlongPath(state1, state2);
    
    expect(samples.length).toBeCloseTo(6, 0);
    expect(samples[0].position.x).toBe(10); // Start
    expect(samples[samples.length-1].position.x).toBe(-10); // End
  });
  
  runner.test('Detects crossing with temporal interpolation', (expect) => {
    const engine = new TemporalTriggerEngine();
    const vertexId = 'test-vertex-1';
    
    // Record a motion that crosses the Y axis
    engine.recordVertexPosition(vertexId, { x: 10, y: 10, z: 0 }, 1.0);
    engine.recordVertexPosition(vertexId, { x: -10, y: 10, z: 0 }, 1.1);
    
    // Detect crossing
    const result = engine.detectCrossing(vertexId);
    
    expect(result.hasCrossed).toBe(true);
    expect(result.exactTime).toBeCloseTo(1.05, 2); // Should cross at t=1.05
    expect(result.position.x).toBeCloseTo(0, 1); // Should cross at x=0
    expect(result.position.y).toBeCloseTo(10, 1); // Y should remain at 10
  });
});

runner.describe('TemporalTriggerEngine - Rotational Motion', () => {
  runner.test('Accurately detects crossing during continuous rotation', (expect) => {
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
    expect(result.exactTime).toBeCloseTo(expectedTime, 1);
  });
});

// Run the tests
document.addEventListener('DOMContentLoaded', () => {
  runner.runTests();
});

export default runner; 