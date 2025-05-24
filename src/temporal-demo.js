// src/temporal-demo.js - Visual demonstration of temporal trigger engine - STANDALONE VERSION

// Import only what we need
import { TemporalTriggerEngine, TemporalCrossingResult } from './triggers/temporalTriggers.js';

// Simple mock for setTemporalTriggersEnabled 
let _temporalTriggersEnabled = false;
function setTemporalTriggersEnabled(enabled) {
  
  _temporalTriggersEnabled = enabled;
}

function isTemporalTriggersEnabled() {
  return _temporalTriggersEnabled;
}

// Demo canvas setup
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
let width, height, centerX, centerY;

// Engine instance
const engine = new TemporalTriggerEngine({
  resolution: 1000, // 1000Hz = 1ms resolution
  maxMemory: 100
});

// Demo state
let animationFrame;
let running = false;
let lastFrameTime = 0;
let startTime = 0;
let currentAngle = 0;
let triggerCount = 0;
let lastTriggerTime = 0;
let missedTriggerCount = 0;
let pointRadius = 5;
let cooldownTime = 0;
let targetRotationSpeed = 1; // Rotations per second
let rotationSpeedMultiplier = 1;
let frameRateLimit = 60; // FPS
let actualFrameRate = 60;
let frameTimes = [];
let crossings = [];
let showTrails = true;
let lastPositionTime = 0;
let timeSinceLastFrame = 0;

// Test point data
const testPoints = [
  { id: 'point-1', radius: 100, angle: 0, color: '#f44336' },
  { id: 'point-2', radius: 150, angle: Math.PI / 4, color: '#2196f3' },
  { id: 'point-3', radius: 200, angle: Math.PI / 2, color: '#4caf50' }
];

// Initialize the demo
function initializeDemo() {
  // Get the demo container
  const demoContainer = document.getElementById('demo-container');
  
  // Log for debugging
  
  
  // Clear any existing content
  demoContainer.innerHTML = '';
  
  // Set up canvas
  demoContainer.appendChild(canvas);
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // Add placeholder text on canvas in case animation fails
  ctx.fillStyle = '#333';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Initializing demo...', centerX, centerY);
  
  // Initialize engine
  engine.initialize();
  
  
  // Enable temporal triggers
  
  setTemporalTriggersEnabled(true);
  
  
  // Set up UI controls
  setupControls(demoContainer);
  
  // Draw initial state
  try {
    draw();
    
  } catch (e) {
    console.error('Error during initial draw:', e);
    ctx.fillStyle = 'red';
    ctx.fillText('Error: ' + e.message, centerX, centerY + 30);
  }
  
  // Start the animation
  try {
    startAnimation();
    
  } catch (e) {
    console.error('Error starting animation:', e);
    ctx.fillStyle = 'red';
    ctx.fillText('Animation error: ' + e.message, centerX, centerY + 60);
  }
}

// Resize canvas to fit window
function resizeCanvas() {
  width = Math.min(800, window.innerWidth - 40);
  height = Math.min(600, window.innerHeight - 200);
  centerX = width / 2;
  centerY = height / 2;
  canvas.width = width;
  canvas.height = height;
  
  // Redraw if not running
  if (!running) {
    draw();
  }
}

// Main animation loop
function animate(timestamp) {
  if (!running) return;
  
  // Convert to seconds
  const now = timestamp / 1000;
  
  if (!startTime) {
    startTime = now;
    lastFrameTime = now;
  }
  
  // Calculate elapsed time
  const deltaTime = now - lastFrameTime;
  timeSinceLastFrame = deltaTime;
  
  // Track frame rate
  trackFrameRate(deltaTime);
  
  // Apply frame rate limiting if enabled
  if (frameRateLimit > 0 && 1 / deltaTime > frameRateLimit + 5) {
    // Skip this frame for rate limiting
    animationFrame = requestAnimationFrame(animate);
    return;
  }
  
  // Update rotation based on speed
  const rotationSpeed = targetRotationSpeed * rotationSpeedMultiplier; // rotations per second
  const deltaAngle = rotationSpeed * 2 * Math.PI * deltaTime;
  currentAngle = (currentAngle + deltaAngle) % (2 * Math.PI);
  
  // Record positions and check for triggers
  if (now - lastPositionTime >= 1 / 120) { // Record at max 120Hz for efficiency
    recordPositions(now);
    checkTriggers();
    lastPositionTime = now;
  }
  
  // Draw the scene
  draw();
  
  // Update time for next frame
  lastFrameTime = now;
  
  // Continue animation
  animationFrame = requestAnimationFrame(animate);
}

// Track frame rate
function trackFrameRate(deltaTime) {
  if (deltaTime > 0) {
    frameTimes.push(deltaTime);
    if (frameTimes.length > 30) {
      frameTimes.shift();
    }
    
    // Calculate average frame rate
    const totalTime = frameTimes.reduce((sum, time) => sum + time, 0);
    actualFrameRate = Math.round(frameTimes.length / totalTime);
  }
}

// Record current positions of test points
function recordPositions(timestamp) {
  testPoints.forEach(point => {
    // Calculate rotated position
    const pointAngle = point.angle + currentAngle;
    const x = Math.cos(pointAngle) * point.radius;
    const y = Math.sin(pointAngle) * point.radius;
    
    // Record in engine
    engine.recordVertexPosition(
      point.id,
      { x, y, z: 0 },
      timestamp
    );
  });
}

// Check for triggers (axis crossings)
function checkTriggers() {
  testPoints.forEach(point => {
    const result = engine.detectCrossing(point.id, cooldownTime);
    
    if (result.hasCrossed) {
      triggerCount++;
      lastTriggerTime = result.exactTime;
      
      // Store crossing for visualization
      crossings.push({
        pointId: point.id,
        x: result.position.x,
        y: result.position.y,
        time: result.exactTime,
        color: point.color,
        alpha: 1.0,
        radius: 8
      });
      
      // Keep only last 50 crossings
      if (crossings.length > 50) {
        crossings.shift();
      }
    }
  });
}

// Draw the scene
function draw() {
  // Clear canvas
  ctx.clearRect(0, 0, width, height);
  
  // Draw coordinate axes
  drawAxes();
  
  // Draw trails if enabled
  if (showTrails) {
    drawTrails();
  }
  
  // Draw test points
  drawPoints();
  
  // Draw trigger crossings
  drawCrossings();
  
  // Draw UI info
  drawUI();
}

// Draw coordinate axes
function drawAxes() {
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  
  // Draw X axis
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.stroke();
  
  // Draw Y axis
  ctx.beginPath();
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, height);
  ctx.stroke();
  
  // Draw center circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
  ctx.fillStyle = '#888';
  ctx.fill();
}

// Draw trails showing the path of points
function drawTrails() {
  testPoints.forEach(point => {
    const states = engine.vertexStates.get(point.id);
    if (!states || states.length < 2) return;
    
    ctx.beginPath();
    ctx.strokeStyle = point.color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.3;
    
    let started = false;
    for (const state of states) {
      const x = centerX + state.position.x;
      const y = centerY - state.position.y;
      
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  });
}

// Draw test points
function drawPoints() {
  testPoints.forEach(point => {
    // Calculate rotated position
    const pointAngle = point.angle + currentAngle;
    const x = centerX + Math.cos(pointAngle) * point.radius;
    const y = centerY - Math.sin(pointAngle) * point.radius;
    
    // Draw point
    ctx.beginPath();
    ctx.arc(x, y, pointRadius, 0, 2 * Math.PI);
    ctx.fillStyle = point.color;
    ctx.fill();
    
    // Draw label
    ctx.fillStyle = '#333';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(point.id, x, y - pointRadius - 2);
  });
}

// Draw trigger crossings
function drawCrossings() {
  for (let i = 0; i < crossings.length; i++) {
    const crossing = crossings[i];
    
    // Fade out over time
    crossing.alpha -= 0.005;
    if (crossing.alpha <= 0) {
      crossings.splice(i, 1);
      i--;
      continue;
    }
    
    // Draw crossing marker
    ctx.beginPath();
    ctx.arc(
      centerX + crossing.x,
      centerY - crossing.y,
      crossing.radius,
      0, 2 * Math.PI
    );
    ctx.strokeStyle = crossing.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = crossing.alpha;
    ctx.stroke();
    
    // Draw X marker
    ctx.beginPath();
    const r = crossing.radius / 2;
    ctx.moveTo(centerX + crossing.x - r, centerY - crossing.y - r);
    ctx.lineTo(centerX + crossing.x + r, centerY - crossing.y + r);
    ctx.moveTo(centerX + crossing.x + r, centerY - crossing.y - r);
    ctx.lineTo(centerX + crossing.x - r, centerY - crossing.y + r);
    ctx.stroke();
    
    ctx.globalAlpha = 1.0;
  }
}

// Draw UI info
function drawUI() {
  ctx.fillStyle = '#000';
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  const info = [
    `Rotation: ${(currentAngle * 180 / Math.PI).toFixed(1)}°`,
    `Speed: ${(targetRotationSpeed * rotationSpeedMultiplier).toFixed(2)} rotations/s`,
    `Frame rate: ${actualFrameRate} FPS (limit: ${frameRateLimit > 0 ? frameRateLimit : 'none'})`,
    `Frame time: ${(timeSinceLastFrame * 1000).toFixed(1)}ms`,
    `Trigger count: ${triggerCount}`,
    `Last trigger: ${lastTriggerTime > 0 ? lastTriggerTime.toFixed(4) + 's' : 'none'}`
  ];
  
  info.forEach((text, i) => {
    ctx.fillText(text, 10, 10 + i * 20);
  });
}

// Set up UI controls
function setupControls(container) {
  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'controls';
  controlsContainer.style.marginTop = '20px';
  controlsContainer.style.padding = '10px';
  controlsContainer.style.backgroundColor = '#f5f5f5';
  controlsContainer.style.borderRadius = '5px';
  controlsContainer.style.maxWidth = `${width}px`;
  container.appendChild(controlsContainer);
  
  // Speed controls
  addControl(controlsContainer, 'Rotation Speed', 'range', 0.1, 5, 0.1, targetRotationSpeed, value => {
    targetRotationSpeed = parseFloat(value);
  });
  
  // Frame rate limit
  addControl(controlsContainer, 'Frame Rate Limit', 'range', 0, 120, 1, frameRateLimit, value => {
    frameRateLimit = parseInt(value);
  });
  
  // Cooldown time
  addControl(controlsContainer, 'Cooldown Time (ms)', 'range', 0, 500, 10, cooldownTime * 1000, value => {
    cooldownTime = parseInt(value) / 1000;
  });
  
  // Show trails toggle
  addControl(controlsContainer, 'Show Trails', 'checkbox', null, null, null, showTrails, value => {
    showTrails = value;
  });
  
  // Reset button
  const resetButton = document.createElement('button');
  resetButton.textContent = 'Reset Counters';
  resetButton.style.marginLeft = '10px';
  resetButton.addEventListener('click', () => {
    triggerCount = 0;
    lastTriggerTime = 0;
    missedTriggerCount = 0;
    crossings = [];
  });
  controlsContainer.appendChild(resetButton);
  
  // Start/stop button
  const toggleButton = document.createElement('button');
  toggleButton.textContent = running ? 'Stop' : 'Start';
  toggleButton.style.marginLeft = '10px';
  toggleButton.addEventListener('click', () => {
    if (running) {
      stopAnimation();
    } else {
      startAnimation();
    }
    toggleButton.textContent = running ? 'Stop' : 'Start';
  });
  controlsContainer.appendChild(toggleButton);
}

// Helper to add controls
function addControl(container, label, type, min, max, step, value, onChange) {
  const controlDiv = document.createElement('div');
  controlDiv.style.margin = '10px 0';
  
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  labelEl.style.marginRight = '10px';
  controlDiv.appendChild(labelEl);
  
  const control = document.createElement(type === 'range' || type === 'checkbox' ? 'input' : type);
  control.type = type;
  
  if (type === 'range') {
    control.min = min;
    control.max = max;
    control.step = step;
    control.value = value;
    
    const valueDisplay = document.createElement('span');
    valueDisplay.textContent = value;
    valueDisplay.style.marginLeft = '10px';
    
    control.addEventListener('input', () => {
      onChange(control.value);
      valueDisplay.textContent = control.value;
    });
    
    controlDiv.appendChild(control);
    controlDiv.appendChild(valueDisplay);
  } else if (type === 'checkbox') {
    control.checked = value;
    
    control.addEventListener('change', () => {
      onChange(control.checked);
    });
    
    controlDiv.appendChild(control);
  }
  
  container.appendChild(controlDiv);
}

// Start animation
function startAnimation() {
  if (!running) {
    running = true;
    startTime = 0;
    lastFrameTime = 0;
    animationFrame = requestAnimationFrame(animate);
  }
}

// Stop animation
function stopAnimation() {
  if (running) {
    running = false;
    cancelAnimationFrame(animationFrame);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeDemo);

export { engine, initializeDemo }; 