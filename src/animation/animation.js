// src/animation/animation.js - VSync-optimized rendering with maintained audio trigger stability
import * as THREE from 'three';
import { getCurrentTime } from '../time/time.js';
import { processPendingTriggers, clearLayerMarkers, detectLayerTriggers, resetTriggerSystem } from '../triggers/triggers.js';
import { ANIMATION_STATES, MAX_VELOCITY } from '../config/constants.js';
// DEPRECATED: Removed import from intersections.js - functionality deprecated
// import { detectIntersections, applyVelocityToMarkers } from '../geometry/intersections.js';
import { updateLabelPositions, updateAxisLabels, updateAllLayersRotatingLabels } from '../ui/domLabels.js';

// Frame counter and timing stats
let frameCount = 0;
let lastAudioTime = 0;
let fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };

// VSync-optimized timing controls - now using monitor refresh rate
const MAX_FRAME_TIME = 1 / 30; // 30 FPS minimum (33.33ms max frame time)
const MIN_FRAME_TIME = 1 / 240; // 240 FPS maximum (4.17ms min frame time)

// Animation state management
let animationId = null;
let animationProps = null;
let isAnimating = false;

// Background detection for fallback timing
let useVSync = true;
let backgroundFallbackWorker = null;

/**
 * Initialize background fallback worker for when tab is not visible
 * Only used when document.hidden === true
 */
function initializeBackgroundFallback() {
  if (backgroundFallbackWorker) {
    backgroundFallbackWorker.terminate();
  }
  
  const workerCode = `
    let intervalId = null;
    const BACKGROUND_FPS = 30; // Lower FPS when backgrounded to save resources
    const frameTime = 1000 / BACKGROUND_FPS;
    
    function startBackgroundTiming() {
      if (intervalId) {
        clearInterval(intervalId);
      }
      
      intervalId = setInterval(() => {
        self.postMessage({
          type: 'backgroundFrame',
          timestamp: performance.now()
        });
      }, frameTime);
    }
    
    function stopBackgroundTiming() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
    
    self.onmessage = function(e) {
      switch(e.data.type) {
        case 'start':
          startBackgroundTiming();
          break;
        case 'stop':
          stopBackgroundTiming();
          break;
      }
    };
  `;
  
  try {
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    backgroundFallbackWorker = new Worker(URL.createObjectURL(blob));
    
    backgroundFallbackWorker.onmessage = (e) => {
      if (e.data.type === 'backgroundFrame' && animationProps && !useVSync) {
        animateFrame(animationProps);
      }
    };
    
    backgroundFallbackWorker.onerror = (error) => {
      console.error('[ANIMATION BACKGROUND] Worker error:', error);
      backgroundFallbackWorker = null;
    };
    
    console.log('[ANIMATION] Background fallback worker initialized');
    return true;
  } catch (error) {
    console.error('[ANIMATION BACKGROUND] Failed to create worker:', error);
    return false;
  }
}

/**
 * Handle visibility change to switch between VSync and background timing
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Tab became hidden - switch to background worker
    useVSync = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    
    if (backgroundFallbackWorker) {
      backgroundFallbackWorker.postMessage({ type: 'start' });
      console.log('[ANIMATION] Switched to background timing (30 FPS)');
    }
  } else {
    // Tab became visible - switch back to VSync
    useVSync = true;
    if (backgroundFallbackWorker) {
      backgroundFallbackWorker.postMessage({ type: 'stop' });
    }
    
    if (animationProps && isAnimating) {
      startVSyncLoop();
      console.log('[ANIMATION] Switched back to VSync timing');
    }
  }
}

/**
 * Start the VSync-based animation loop
 */
function startVSyncLoop() {
  if (animationId) {
    cancelAnimationFrame(animationId);
  }
  
  function vsyncFrame() {
    if (animationProps && isAnimating && useVSync) {
      animateFrame(animationProps);
      animationId = requestAnimationFrame(vsyncFrame);
    }
  }
  
  animationId = requestAnimationFrame(vsyncFrame);
}

/**
 * Get current time safely, falling back to performance timing if audio timing isn't ready
 * @returns {number} Current time in seconds
 */
function getSafeTime() {
  try {
    return getCurrentTime();
  } catch (e) {
    return performance.now() / 1000;
  }
}

/**
 * Main animation function with VSync optimization for smooth rendering
 * Audio triggers remain highest priority and unaffected
 * @param {Object} props Animation properties and dependencies
 */
export function animate(props) {
  // Store props for the animation loop
  animationProps = props;
  isAnimating = true;
  
  // Initialize background fallback worker
  initializeBackgroundFallback();
  
  // Set up visibility change handler for background/foreground switching
  document.addEventListener('visibilitychange', handleVisibilityChange);
  
  // Initialize trigger system (unchanged - maintains audio priority)
  resetTriggerSystem();
  lastAudioTime = getSafeTime();
  
  // Start with VSync if tab is visible, otherwise use background timing
  if (document.hidden) {
    useVSync = false;
    if (backgroundFallbackWorker) {
      backgroundFallbackWorker.postMessage({ type: 'start' });
    }
  } else {
    useVSync = true;
    startVSyncLoop();
  }
  
  console.log('[ANIMATION] VSync-optimized animation system started');
  console.log('[ANIMATION] Using', useVSync ? 'VSync (requestAnimationFrame)' : 'Background timing (30 FPS)');
}

/**
 * Core animation frame logic - now optimized for VSync while maintaining audio trigger priority
 * @param {Object} props Animation properties and dependencies
 */
function animateFrame(props) {
  const { 
    scene, 
    cam, 
    renderer, 
    state, 
    triggerAudioCallback, 
    globalState,
    stats 
  } = props;
  
  // IMPORTANT: Set camera and renderer in scene userData at the very beginning
  // This ensures they're available throughout the entire frame
  if (scene && cam && renderer) {
    scene.userData.camera = cam;
    scene.userData.renderer = renderer;
    
    // Also ensure each layer has access to camera and renderer
    if (scene._layerManager && scene._layerManager.layers) {
      scene._layerManager.layers.forEach(layer => {
        // Make sure the layer's group has references to camera and renderer
        if (layer && layer.group) {
          layer.group.userData.camera = cam;
          layer.group.userData.renderer = renderer;
        }
      });
    }
  }
  
  // CRITICAL: Increment frameCount BEFORE any early returns
  frameCount++;
  
  // Get current time from audio-synchronized timing system (unchanged)
  const currentAudioTime = getSafeTime();
  
  // Calculate time delta using audio time
  let timeDelta = currentAudioTime - lastAudioTime;
  
  // Clamp delta time for stability and precision - now with VSync-appropriate limits
  timeDelta = Math.max(MIN_FRAME_TIME, Math.min(timeDelta, MAX_FRAME_TIME));
  
  // Skip frame if delta is too small (prevents unnecessary processing)
  // But allow first few frames to pass through to get animation started
  if (timeDelta < MIN_FRAME_TIME * 0.8 && frameCount > 5) {
    return;
  }
  
  // Update lastTime for next frame using audio time
  lastAudioTime = currentAudioTime;
  if (timeDelta > 0) {
    const fps = 1 / timeDelta;
    fpsStats.frames++;
    fpsStats.total += fps;
    fpsStats.avg = fpsStats.total / fpsStats.frames;
    fpsStats.min = Math.min(fpsStats.min, fps);
    fpsStats.max = Math.max(fpsStats.max, fps);
    
    // Track VSync performance using audio timing
    if (frameCount % 600 === 0) { // Log every 10 seconds at 60fps
      const performanceInfo = {
        currentFPS: fps.toFixed(1),
        avgFPS: fpsStats.avg.toFixed(1),
        minFPS: fpsStats.min.toFixed(1),
        maxFPS: fpsStats.max.toFixed(1),
        timeDelta: (timeDelta * 1000).toFixed(2) + 'ms',
        timingMode: useVSync ? 'VSync' : 'Background',
        audioTime: currentAudioTime.toFixed(3)
      };
      
      // Reset stats periodically to avoid skew
      if (frameCount % 6000 === 0) {
        fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };
      }
    }
  }
  
  // Update stats if available
  if (stats) {
    stats.begin();
  }
  
  // Update state.lastTime which is used for angle calculation
  if (state && typeof state.lastTime !== 'undefined') {
    state.lastTime = currentAudioTime;
  }
  
  // CRITICAL: Process any pending quantized triggers with audio-synchronized timing
  // This maintains the highest priority for audio triggers (unchanged)
  processPendingTriggers(currentAudioTime, scene);
  
  // Log timing info with enhanced frequency for debugging high BPM issues
  if (frameCount % 300 === 0) {
    const currentFPS = 1 / timeDelta;
    const bpm = globalState?.bpm || 120;
    const rotationHz = bpm / 960; // Rotations per second
  }
  
  // Get the active layer from the scene if available
  const activeLayer = scene?._layerManager?.getActiveLayer();
  
  // Enhanced layer status logging for debugging trigger issues
  if (frameCount % 1200 === 0 && activeLayer) { // Every 20 seconds at 60fps
    const bpm = globalState?.bpm || 120;
    const currentFPS = 1 / timeDelta;
    const rotationSpeed = bpm / 960; // rotations per second
    const degreesPerFrame = (rotationSpeed * 360) / currentFPS;
  }
  
  // Handle active layer if available (prefer it over passed-in group)
  if (activeLayer) {
    // Force visibility in case it was toggled off
    if (!activeLayer.visible) {
      activeLayer.visible = true;
      if (activeLayer.group) {
        activeLayer.group.visible = true;
      }
    }
    
    // Update markers (dots) based on intersections
    // DEPRECATED: needsIntersectionUpdate functionality removed
    
    // Ensure camera and renderer are set in the layer's group before updating
    if (activeLayer.group && cam && renderer) {
      if (!activeLayer.group.userData) activeLayer.group.userData = {};
      activeLayer.group.userData.camera = cam;
      activeLayer.group.userData.renderer = renderer;
      
      // Also ensure the scene has them
      if (scene) {
        scene.userData = scene.userData || {};
        scene.userData.camera = cam;
        scene.userData.renderer = renderer;
      }
    }
    
    // Call the update method on the active layer with audio-synchronized timing
    if (typeof activeLayer.update === 'function') {
      activeLayer.update(currentAudioTime, timeDelta);
    }
    
    // Also update the global angle in GlobalStateManager with audio-synchronized timing
    if (globalState && typeof globalState.updateAngle === 'function') {
      globalState.updateAngle(currentAudioTime * 1000); // Convert to ms for compatibility
    }
    
    // KEPT SYNCHRONOUS: Update DOM label positions (as requested)
    if (typeof updateLabelPositions === 'function') {
      updateLabelPositions(activeLayer, cam, renderer);
    }
    
    // KEPT SYNCHRONOUS: Update and fade out axis labels (as requested)
    if (typeof updateAxisLabels === 'function') {
      updateAxisLabels();
    }
    
    // KEPT SYNCHRONOUS: Update point frequency labels for all layers (as requested)
    if (typeof updateAllLayersRotatingLabels === 'function') {
      updateAllLayersRotatingLabels(cam, renderer);
    }
  }
  
  // CRITICAL: Detect triggers on ALL visible layers with audio-synchronized timing
  // This maintains audio trigger priority (unchanged)
  if (scene._layerManager && scene._layerManager.layers) {
    for (const layer of scene._layerManager.layers) {
      if (layer && layer.visible && layer.state && layer.state.copies > 0) {
        detectLayerTriggers(layer, currentAudioTime);
      }
    }
  }
  
  // Enhanced layer manager update with audio-synchronized timing
  if (scene._layerManager && typeof scene._layerManager.updateLayers === 'function') {
    const animationParams = {
      scene,
      tNow: currentAudioTime * 1000, // Convert to ms for backward compatibility
      dt: timeDelta * 1000,     // Convert to ms for backward compatibility
      angle: globalState?.lastAngle || 0,
      lastAngle: globalState?.previousAngle || 0,
      previousAngle: globalState?.previousAngle || 0,
      triggerAudioCallback,
      activeLayerId: scene._layerManager.activeLayerId,
      camera: cam,
      renderer: renderer,
      frameTime: timeDelta,
      currentFPS: 1 / timeDelta,
      audioTime: currentAudioTime,
      vsyncEnabled: useVSync
    };
    
    scene._layerManager.updateLayers(animationParams);
    
    if (scene._layerManager.layers) {
      for (const layer of scene._layerManager.layers) {
        if (layer && typeof clearLayerMarkers === 'function') {
          clearLayerMarkers(layer);
        }
      }
    }
  }
  
  // Update layer links if available
  if (scene._layerManager) {
    // Import and update layer link manager
    import('../geometry/layerLink.js').then(module => {
      // Set renderer reference for GPU trace initialization
      if (!module.layerLinkManager.renderer) {
        module.layerLinkManager.setRenderer(renderer);
      }
      
      module.layerLinkManager.update(scene._layerManager);
    }).catch(error => {
      // Silently ignore if layer link module is not available
    });
  }
  
  // Render the scene
  renderer.render(scene, cam);
  
  // End stats tracking
  if (stats) {
    stats.end();
  }
}

/**
 * Stop the animation system and clean up resources
 */
export function stopAnimation() {
  isAnimating = false;
  
  // Cancel VSync animation frame
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  // Stop background worker
  if (backgroundFallbackWorker) {
    backgroundFallbackWorker.postMessage({ type: 'stop' });
    backgroundFallbackWorker.terminate();
    backgroundFallbackWorker = null;
  }
  
  // Remove event listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  
  animationProps = null;
  useVSync = true;
  console.log('[ANIMATION] VSync animation system stopped');
}

/**
 * Set animation to use VSync or background mode (for testing purposes)
 * @param {boolean} enableVSync Whether to use VSync timing
 */
export function setVSyncEnabled(enableVSync) {
  if (enableVSync && !useVSync && !document.hidden) {
    useVSync = true;
    if (backgroundFallbackWorker) {
      backgroundFallbackWorker.postMessage({ type: 'stop' });
    }
    if (animationProps && isAnimating) {
      startVSyncLoop();
    }
    console.log('[ANIMATION] VSync enabled');
  } else if (!enableVSync && useVSync) {
    useVSync = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (backgroundFallbackWorker && animationProps && isAnimating) {
      backgroundFallbackWorker.postMessage({ type: 'start' });
    }
    console.log('[ANIMATION] VSync disabled, using background timing');
  }
}

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  window.stopAnimation = stopAnimation;
  window.setVSyncEnabled = setVSyncEnabled;
  window.getAnimationStats = () => ({
    frameCount,
    fpsStats,
    vsyncActive: useVSync,
    isAnimating,
    lastAudioTime,
    backgroundWorkerActive: !!backgroundFallbackWorker
  });
}