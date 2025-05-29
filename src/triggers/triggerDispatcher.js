// src/triggers/triggerDispatcher.js - Central Trigger Dispatch System
// Handles routing triggers to multiple handlers (audio, MIDI, etc.)

// Registered trigger handlers
const triggerHandlers = new Map();

/**
 * Register a trigger handler
 * @param {string} name - Handler name (e.g., 'audio', 'midi')
 * @param {Function} handler - Function to handle triggers: (note) => void
 * @param {Object} options - Handler options
 */
export function registerTriggerHandler(name, handler, options = {}) {
  triggerHandlers.set(name, {
    handler,
    enabled: options.enabled !== false,
    priority: options.priority || 0
  });
  console.log(`[TRIGGER DISPATCHER] Handler registered: ${name}`);
}

/**
 * Unregister a trigger handler
 * @param {string} name - Handler name to remove
 */
export function unregisterTriggerHandler(name) {
  triggerHandlers.delete(name);
  console.log(`[TRIGGER DISPATCHER] Handler unregistered: ${name}`);
}

/**
 * Enable/disable a specific trigger handler
 * @param {string} name - Handler name
 * @param {boolean} enabled - Whether to enable the handler
 */
export function setTriggerHandlerEnabled(name, enabled) {
  const handler = triggerHandlers.get(name);
  if (handler) {
    handler.enabled = enabled;
    console.log(`[TRIGGER DISPATCHER] Handler ${name} ${enabled ? 'enabled' : 'disabled'}`);
  }
}

/**
 * Check if a trigger handler is enabled
 * @param {string} name - Handler name
 * @returns {boolean} True if handler exists and is enabled
 */
export function isTriggerHandlerEnabled(name) {
  const handler = triggerHandlers.get(name);
  return handler ? handler.enabled : false;
}

/**
 * Get list of registered handler names
 * @returns {Array<string>} Array of handler names
 */
export function getRegisteredHandlers() {
  return Array.from(triggerHandlers.keys());
}

/**
 * Main trigger dispatch function
 * This is what gets called by the trigger detection system
 * @param {Object} note - The note/trigger data
 */
export function dispatchTrigger(note) {
  // Get handlers sorted by priority (higher priority first)
  const sortedHandlers = Array.from(triggerHandlers.entries())
    .filter(([name, handler]) => handler.enabled)
    .sort(([, a], [, b]) => b.priority - a.priority);

  // Dispatch to all enabled handlers
  for (const [name, handlerData] of sortedHandlers) {
    try {
      handlerData.handler(note);
    } catch (error) {
      console.warn(`[TRIGGER DISPATCHER] Handler ${name} error:`, error);
    }
  }
}

/**
 * Get dispatcher statistics
 * @returns {Object} Statistics about registered handlers
 */
export function getDispatcherStats() {
  const stats = {
    totalHandlers: triggerHandlers.size,
    enabledHandlers: 0,
    handlers: {}
  };

  for (const [name, handler] of triggerHandlers) {
    if (handler.enabled) stats.enabledHandlers++;
    stats.handlers[name] = {
      enabled: handler.enabled,
      priority: handler.priority
    };
  }

  return stats;
} 