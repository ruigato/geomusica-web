// src/triggers/GeometricSequencer.js - Geometric point-based music sequencer with sample-accurate timing

import { getCurrentTime } from '../time/time.js';

/**
 * A music sequencer that calculates exact crossing times for geometric points
 * and schedules musical events with sample-accurate AudioContext timing.
 */
export class GeometricSequencer {
  constructor() {
    // Priority queue for upcoming trigger events
    this.eventQueue = [];
    
    // Look-ahead scheduling buffer (50ms)
    this.lookAheadTime = 0.05;
    
    // Current rotation speed in rotations per second
    this.rotationSpeed = 0;
    
    // BPM value for musical timing
    this.bpm = 120;
    
    // Current rotation offset (in radians)
    this.rotationOffset = 0;
    
    // Scheduled events for cleanup
    this.scheduledEvents = new Set();
    
    // Callback for when events should trigger
    this.onTriggerEvent = null;
  }

  /**
   * Calculate the angle of a point from the center
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {number} Angle in radians
   */
  calculatePointAngle(x, y) {
    return Math.atan2(y, x);
  }

  /**
   * Calculate the time until a point crosses the Y-axis (x = 0)
   * @param {number} angle - Current angle of the point (radians)
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @param {number} rotationOffset - Current rotation offset (radians)
   * @returns {number} Time in seconds until Y-axis crossing
   */
  calculateCrossingTime(angle, rotationSpeed, rotationOffset = 0) {
    if (rotationSpeed === 0) {
      return Infinity; // No rotation, no crossing
    }

    // Adjust angle for current rotation offset
    const adjustedAngle = angle - rotationOffset;
    
    // Normalize angle to [0, 2π]
    const normalizedAngle = ((adjustedAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    
    // Calculate time to reach Y-axis (angle = π/2 or 3π/2)
    // For simplicity, we'll trigger on positive Y-axis crossing (π/2)
    const targetAngle = Math.PI / 2;
    
    let timeToTarget;
    if (normalizedAngle <= targetAngle) {
      // Point hasn't reached target yet in this rotation
      timeToTarget = (targetAngle - normalizedAngle) / (2 * Math.PI * rotationSpeed);
    } else {
      // Point has passed target, calculate time for next rotation
      timeToTarget = (2 * Math.PI - normalizedAngle + targetAngle) / (2 * Math.PI * rotationSpeed);
    }
    
    return timeToTarget;
  }

  /**
   * Schedule geometry points for triggering
   * @param {Array} points - Array of point objects with x, y coordinates
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @param {number} startTime - Start time for scheduling (AudioContext time)
   */
  scheduleGeometry(points, rotationSpeed, startTime = null) {
    if (!points || points.length === 0) {
      return;
    }

    const currentTime = startTime || getCurrentTime();
    this.rotationSpeed = rotationSpeed;
    
    // Clear existing events
    this.clear();
    
    // Calculate crossing times for all points
    points.forEach((point, index) => {
      const angle = this.calculatePointAngle(point.x, point.y);
      const crossingTime = this.calculateCrossingTime(angle, rotationSpeed, this.rotationOffset);
      
      if (crossingTime !== Infinity) {
        const triggerTime = currentTime + crossingTime;
        
        // Create event object
        const event = {
          id: `point_${index}_${Date.now()}`,
          triggerTime,
          point: { ...point },
          angle,
          crossingTime,
          scheduled: false
        };
        
        // Add to priority queue
        this.addEventToQueue(event);
      }
    });
    
    // Sort queue by trigger time
    this.sortEventQueue();
  }

  /**
   * Add an event to the priority queue
   * @param {Object} event - Event object to add
   */
  addEventToQueue(event) {
    this.eventQueue.push(event);
  }

  /**
   * Sort the event queue by trigger time (earliest first)
   */
  sortEventQueue() {
    this.eventQueue.sort((a, b) => a.triggerTime - b.triggerTime);
  }

  /**
   * Process events that should trigger now (with look-ahead)
   * @param {number} currentTime - Current AudioContext time
   */
  update(currentTime = null) {
    const now = currentTime || getCurrentTime();
    const lookAheadTime = now + this.lookAheadTime;
    
    // Process all events that should trigger within the look-ahead window
    while (this.eventQueue.length > 0 && this.eventQueue[0].triggerTime <= lookAheadTime) {
      const event = this.eventQueue.shift();
      
      if (!event.scheduled) {
        this.scheduleEvent(event, now);
        event.scheduled = true;
      }
    }
    
    // Schedule recurring events for continuous rotation
    this.scheduleRecurringEvents(now);
  }

  /**
   * Schedule a single event for precise timing
   * @param {Object} event - Event to schedule
   * @param {number} currentTime - Current time for scheduling reference
   */
  scheduleEvent(event, currentTime) {
    const delay = Math.max(0, event.triggerTime - currentTime);
    
    // Use setTimeout for scheduling with millisecond precision
    const timeoutId = setTimeout(() => {
      this.triggerEvent(event);
      this.scheduledEvents.delete(timeoutId);
    }, delay * 1000); // Convert to milliseconds
    
    this.scheduledEvents.add(timeoutId);
  }

  /**
   * Schedule recurring events for points that will cross the Y-axis multiple times
   * @param {number} currentTime - Current time
   */
  scheduleRecurringEvents(currentTime) {
    if (this.rotationSpeed === 0) return;
    
    // Calculate the period of one full rotation
    const rotationPeriod = 1 / this.rotationSpeed;
    
    // For each point that was originally scheduled, schedule its next crossing
    const recurringEvents = [];
    
    // Look for events that need to be rescheduled for next rotation
    this.eventQueue.forEach(event => {
      if (event.triggerTime < currentTime - rotationPeriod) {
        // This event is from a previous rotation, schedule it for the next one
        const nextTriggerTime = event.triggerTime + rotationPeriod;
        
        if (nextTriggerTime > currentTime) {
          const newEvent = {
            ...event,
            id: `${event.id}_next_${Date.now()}`,
            triggerTime: nextTriggerTime,
            scheduled: false
          };
          recurringEvents.push(newEvent);
        }
      }
    });
    
    // Add recurring events to queue
    recurringEvents.forEach(event => this.addEventToQueue(event));
    
    if (recurringEvents.length > 0) {
      this.sortEventQueue();
    }
  }

  /**
   * Trigger a musical event
   * @param {Object} event - Event to trigger
   */
  triggerEvent(event) {
    if (this.onTriggerEvent && typeof this.onTriggerEvent === 'function') {
      // Pass event data to callback
      this.onTriggerEvent({
        point: event.point,
        angle: event.angle,
        triggerTime: event.triggerTime,
        id: event.id
      });
    }
  }

  /**
   * Clear all scheduled events
   */
  clear() {
    // Clear the event queue
    this.eventQueue = [];
    
    // Cancel all scheduled timeouts
    this.scheduledEvents.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    this.scheduledEvents.clear();
  }

  /**
   * Update rotation speed and recalculate timing
   * @param {number} bpm - Beats per minute
   */
  setRotationSpeed(bpm) {
    this.bpm = bpm;
    
    // Convert BPM to rotations per second
    // Assuming each beat corresponds to a fraction of a rotation
    // This can be adjusted based on musical requirements
    this.rotationSpeed = bpm / 60; // 1 rotation per second at 60 BPM
    
    // Recalculate all pending events with new timing
    this.recalculateEventTiming();
  }

  /**
   * Set rotation offset for phase adjustment
   * @param {number} offset - Rotation offset in radians
   */
  setRotationOffset(offset) {
    this.rotationOffset = offset;
    this.recalculateEventTiming();
  }

  /**
   * Recalculate timing for all events after parameter changes
   */
  recalculateEventTiming() {
    if (this.eventQueue.length === 0) return;
    
    const currentTime = getCurrentTime();
    
    // Recalculate crossing times for all events
    this.eventQueue.forEach(event => {
      if (!event.scheduled) {
        const newCrossingTime = this.calculateCrossingTime(
          event.angle, 
          this.rotationSpeed, 
          this.rotationOffset
        );
        
        if (newCrossingTime !== Infinity) {
          event.triggerTime = currentTime + newCrossingTime;
          event.crossingTime = newCrossingTime;
        }
      }
    });
    
    // Re-sort the queue
    this.sortEventQueue();
  }

  /**
   * Set the callback function for trigger events
   * @param {Function} callback - Function to call when events trigger
   */
  setTriggerCallback(callback) {
    this.onTriggerEvent = callback;
  }

  /**
   * Get current sequencer status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      eventQueueLength: this.eventQueue.length,
      scheduledEventsCount: this.scheduledEvents.size,
      rotationSpeed: this.rotationSpeed,
      bpm: this.bpm,
      rotationOffset: this.rotationOffset,
      lookAheadTime: this.lookAheadTime,
      nextEventTime: this.eventQueue.length > 0 ? this.eventQueue[0].triggerTime : null
    };
  }

  /**
   * Clean up all scheduled events and reset the sequencer
   */
  dispose() {
    this.clear();
    this.onTriggerEvent = null;
    this.eventQueue = [];
    this.rotationSpeed = 0;
  }

  // ==================================================================================
  // NEW: Utility functions for precise crossing calculations
  // ==================================================================================

  /**
   * Calculate the exact time when a point will cross the Y-axis
   * @param {Object} point - Point object with x, y coordinates
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @param {number} currentAngle - Current rotation angle in radians
   * @param {number} startTime - Start time for calculation (AudioContext time)
   * @returns {number|null} Time when point crosses Y-axis, or null if no crossing
   */
  static calculateCrossingTime(point, rotationSpeed, currentAngle = 0, startTime = null) {
    if (!point || rotationSpeed === 0) {
      return null;
    }

    const currentTime = startTime || getCurrentTime();
    
    // Calculate point's current angle relative to center
    const pointAngle = Math.atan2(point.y, point.x);
    
    // Adjust for current rotation angle
    const adjustedAngle = pointAngle + currentAngle;
    
    // Normalize to [0, 2π] range
    const normalizedAngle = ((adjustedAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    
    // Target angle for Y-axis crossing (positive Y = π/2, negative Y = 3π/2)
    // We'll use positive Y-axis crossing for consistency
    const targetAngle = Math.PI / 2;
    
    // Handle edge case: point exactly on Y-axis
    if (Math.abs(point.x) < 1e-10) {
      // Point is on Y-axis, check if it's rotating through crossing
      if (point.y > 0) {
        // Already at positive Y-axis
        return currentTime;
      } else {
        // On negative Y-axis, will cross in half rotation
        return currentTime + (Math.PI / (2 * Math.PI * rotationSpeed));
      }
    }
    
    // Handle edge case: point never crosses Y-axis (below X-axis with no rotation)
    if (Math.abs(point.y) < 1e-10 && point.x < 0) {
      // Point on negative X-axis, will cross Y-axis in quarter rotation
      return currentTime + (Math.PI / 2) / (2 * Math.PI * rotationSpeed);
    }
    
    // Calculate angular difference to target
    let angleDifference;
    if (normalizedAngle <= targetAngle) {
      // Point hasn't reached target yet in current rotation
      angleDifference = targetAngle - normalizedAngle;
    } else {
      // Point has passed target, calculate for next rotation
      angleDifference = (2 * Math.PI) - normalizedAngle + targetAngle;
    }
    
    // Convert angular difference to time
    const timeToTarget = this.angleToTime(angleDifference, rotationSpeed);
    
    return currentTime + timeToTarget;
  }

  /**
   * Find all Y-axis crossings within the look-ahead time window
   * @param {Object} point - Point object with x, y coordinates
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @param {number} lookAheadTime - Time window to look ahead (seconds)
   * @param {number} currentAngle - Current rotation angle in radians
   * @returns {Array} Array of crossing times within the look-ahead window
   */
  static getNextCrossings(point, rotationSpeed, lookAheadTime, currentAngle = 0) {
    if (!point || rotationSpeed === 0 || lookAheadTime <= 0) {
      return [];
    }

    const crossings = [];
    const currentTime = getCurrentTime();
    const endTime = currentTime + lookAheadTime;
    
    // Calculate rotation period (time for one full rotation)
    const rotationPeriod = 1 / rotationSpeed;
    
    // Get first crossing time
    const firstCrossing = this.calculateCrossingTime(point, rotationSpeed, currentAngle, currentTime);
    
    if (firstCrossing === null) {
      return [];
    }
    
    // Add all crossings within the look-ahead window
    let nextCrossingTime = firstCrossing;
    let crossingCount = 0;
    const maxCrossings = Math.ceil(lookAheadTime / (rotationPeriod / 2)) + 1; // Safety limit
    
    while (nextCrossingTime <= endTime && crossingCount < maxCrossings) {
      if (nextCrossingTime >= currentTime) {
        crossings.push({
          time: nextCrossingTime,
          angle: Math.PI / 2, // Y-axis crossing angle
          crossingIndex: crossingCount,
          point: { ...point }
        });
      }
      
      // Calculate next crossing (occurs every half rotation for Y-axis crossings)
      nextCrossingTime += rotationPeriod / 2;
      crossingCount++;
    }
    
    return crossings;
  }

  /**
   * Convert angular difference to time duration
   * @param {number} angleDifference - Angular difference in radians
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @returns {number} Time duration in seconds
   */
  static angleToTime(angleDifference, rotationSpeed) {
    if (rotationSpeed === 0) {
      return Infinity;
    }
    
    // Normalize angle difference to positive value
    const normalizedAngle = ((angleDifference % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    
    // Convert radians per second to time
    const angularVelocity = 2 * Math.PI * rotationSpeed;
    
    return normalizedAngle / angularVelocity;
  }

  /**
   * Check if a point will cross the Y-axis during rotation
   * @param {Object} point - Point object with x, y coordinates
   * @returns {boolean} True if point will cross Y-axis
   */
  static willCrossYAxis(point) {
    if (!point) return false;
    
    // Points exactly on Y-axis are considered crossing
    if (Math.abs(point.x) < 1e-10) {
      return true;
    }
    
    // All points that are not at the origin will cross Y-axis during full rotation
    const distance = Math.sqrt(point.x * point.x + point.y * point.y);
    return distance > 1e-10;
  }

  /**
   * Calculate the angle between two points relative to center
   * @param {Object} point1 - First point
   * @param {Object} point2 - Second point
   * @returns {number} Angular difference in radians
   */
  static calculateAngleBetweenPoints(point1, point2) {
    if (!point1 || !point2) return 0;
    
    const angle1 = Math.atan2(point1.y, point1.x);
    const angle2 = Math.atan2(point2.y, point2.x);
    
    let difference = angle2 - angle1;
    
    // Normalize to [-π, π] range
    while (difference > Math.PI) difference -= 2 * Math.PI;
    while (difference < -Math.PI) difference += 2 * Math.PI;
    
    return difference;
  }

  /**
   * Get the next multiple crossings for a point (positive and negative Y-axis)
   * @param {Object} point - Point object with x, y coordinates
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @param {number} lookAheadTime - Time window to look ahead (seconds)
   * @param {number} currentAngle - Current rotation angle in radians
   * @returns {Array} Array of all Y-axis crossings (both positive and negative)
   */
  static getAllYAxisCrossings(point, rotationSpeed, lookAheadTime, currentAngle = 0) {
    if (!point || rotationSpeed === 0 || lookAheadTime <= 0) {
      return [];
    }

    const crossings = [];
    const currentTime = getCurrentTime();
    const endTime = currentTime + lookAheadTime;
    
    // Calculate point's current angle
    const pointAngle = Math.atan2(point.y, point.x);
    const adjustedAngle = pointAngle + currentAngle;
    const normalizedAngle = ((adjustedAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    
    // Calculate rotation period
    const rotationPeriod = 1 / rotationSpeed;
    
    // Target angles for Y-axis crossings
    const targets = [
      { angle: Math.PI / 2, name: 'positive_y' },     // +Y axis
      { angle: 3 * Math.PI / 2, name: 'negative_y' }  // -Y axis
    ];
    
    // Find all crossings within time window
    for (const target of targets) {
      let angleDifference;
      if (normalizedAngle <= target.angle) {
        angleDifference = target.angle - normalizedAngle;
      } else {
        angleDifference = (2 * Math.PI) - normalizedAngle + target.angle;
      }
      
      let crossingTime = currentTime + this.angleToTime(angleDifference, rotationSpeed);
      let crossingIndex = 0;
      
      // Add all occurrences within look-ahead window
      while (crossingTime <= endTime) {
        if (crossingTime >= currentTime) {
          crossings.push({
            time: crossingTime,
            angle: target.angle,
            type: target.name,
            crossingIndex: crossingIndex,
            point: { ...point }
          });
        }
        
        crossingTime += rotationPeriod;
        crossingIndex++;
      }
    }
    
    // Sort by time
    return crossings.sort((a, b) => a.time - b.time);
  }

}

// Export a singleton instance for convenience
export const geometricSequencer = new GeometricSequencer();

// Default export
export default GeometricSequencer; 