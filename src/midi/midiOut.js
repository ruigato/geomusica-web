// src/midi/midiOut.js - Comprehensive MIDI Output Module for GeoMusica
// Handles note duration, velocity, polyphonic aftertouch, and multi-channel output
// Each layer outputs to a different MIDI channel; channel 16 reserved for layerlink output

/**
 * MIDI Output Manager for GeoMusica
 * Features:
 * - Multi-channel output (layers 0-14 map to MIDI channels 1-15, layerlink uses channel 16)
 * - Note duration tracking with automatic note-off
 * - Velocity control
 * - Polyphonic aftertouch for microtonal compensation
 * - Pitch bend for microtonal accuracy
 * - Real-time parameter control via MIDI CC
 */
class MidiOutManager {
  constructor() {
    this.midiAccess = null;
    this.outputDevice = null;
    this.isEnabled = false;
    this.isInitialized = false;
    
    // Channel mapping: layers 0-14 → channels 1-15, layerlink → channel 16
    this.LAYERLINK_CHANNEL = 16;
    this.MAX_LAYER_CHANNELS = 15;
    
    // Active notes tracking for note-off management
    this.activeNotes = new Map(); // key: "channel-note", value: {timeoutId, velocity, startTime}
    
    // Microtonal settings
    this.pitchBendRange = 2; // semitones (±2 semitones = ±200 cents)
    this.microtonalMode = true; // Enable microtonal compensation
    
    // MIDI device settings
    this.deviceName = null;
    this.availableDevices = [];
    
    // Performance tracking
    this.stats = {
      notesPlayed: 0,
      notesStopped: 0,
      channelsUsed: new Set(),
      lastNoteTime: 0,
      errors: 0
    };
    
    // Debugging
    this.debug = false;
    
    console.log('[MIDI OUT] MidiOutManager initialized');
  }
  
  /**
   * Initialize MIDI access and enumerate devices
   * @returns {Promise<boolean>} Success status
   */
  async initialize() {
    try {
      if (!navigator.requestMIDIAccess) {
        console.warn('[MIDI OUT] Web MIDI API not supported in this browser');
        return false;
      }
      
      this.midiAccess = await navigator.requestMIDIAccess();
      
      // Enumerate available output devices
      this.updateAvailableDevices();
      
      // Listen for device changes
      this.midiAccess.onstatechange = (event) => {
        console.log('[MIDI OUT] MIDI device state changed:', event.port.name, event.port.state);
        this.updateAvailableDevices();
        
        // If our current device was disconnected, clear it
        if (event.port === this.outputDevice && event.port.state === 'disconnected') {
          this.outputDevice = null;
          this.isEnabled = false;
          console.log('[MIDI OUT] Current output device disconnected');
        }
      };
      
      this.isInitialized = true;
      console.log('[MIDI OUT] MIDI system initialized successfully');
      console.log('[MIDI OUT] Available devices:', this.availableDevices.map(d => d.name));
      
      return true;
    } catch (error) {
      console.error('[MIDI OUT] Failed to initialize MIDI:', error);
      this.stats.errors++;
      return false;
    }
  }
  
  /**
   * Update list of available MIDI output devices
   */
  updateAvailableDevices() {
    if (!this.midiAccess) return;
    
    this.availableDevices = [];
    for (const output of this.midiAccess.outputs.values()) {
      this.availableDevices.push({
        id: output.id,
        name: output.name,
        manufacturer: output.manufacturer,
        state: output.state,
        connection: output.connection
      });
    }
  }
  
  /**
   * Select and connect to a MIDI output device
   * @param {string} deviceId - MIDI device ID, or null for first available
   * @returns {boolean} Success status
   */
  selectDevice(deviceId = null) {
    if (!this.midiAccess) {
      console.error('[MIDI OUT] MIDI not initialized');
      return false;
    }
    
    let targetDevice = null;
    
    if (deviceId) {
      // Select specific device by ID
      targetDevice = this.midiAccess.outputs.get(deviceId);
    } else {
      // Select first available device
      for (const output of this.midiAccess.outputs.values()) {
        if (output.state === 'connected') {
          targetDevice = output;
          break;
        }
      }
    }
    
    if (!targetDevice) {
      console.warn('[MIDI OUT] No MIDI output device available');
      return false;
    }
    
    this.outputDevice = targetDevice;
    this.deviceName = targetDevice.name;
    this.isEnabled = true;
    
    console.log(`[MIDI OUT] Connected to device: ${this.deviceName}`);
    
    // Initialize all channels with default settings
    this.initializeChannels();
    
    return true;
  }
  
  /**
   * Initialize all MIDI channels with default settings
   */
  initializeChannels() {
    if (!this.outputDevice) return;
    
    for (let channel = 1; channel <= 16; channel++) {
      // Set pitch bend range to ±2 semitones for microtonal support
      this.sendRPN(channel, 0, 0, this.pitchBendRange); // RPN 0,0 = pitch bend range
      
      // Reset pitch bend to center
      this.sendPitchBend(channel, 0);
      
      // Set default volume (CC 7)
      this.sendControlChange(channel, 7, 100);
      
      // Set default expression (CC 11)
      this.sendControlChange(channel, 11, 127);
      
      // Reset all controllers (CC 121)
      this.sendControlChange(channel, 121, 0);
    }
    
    console.log('[MIDI OUT] All channels initialized');
  }
  
  /**
   * Get MIDI channel for a layer ID
   * @param {number} layerId - Layer ID (0-based)
   * @param {boolean} isLayerLink - Whether this is a layerlink trigger
   * @returns {number} MIDI channel (1-16)
   */
  getChannelForLayer(layerId, isLayerLink = false) {
    if (isLayerLink) {
      return this.LAYERLINK_CHANNEL;
    }
    
    // Map layer 0-14 to channels 1-15
    const channel = (layerId % this.MAX_LAYER_CHANNELS) + 1;
    return Math.max(1, Math.min(15, channel));
  }
  
  /**
   * Play a note with full microtonal and duration support
   * @param {Object} note - Note object from geomusica
   * @param {number} layerId - Layer ID for channel mapping
   * @param {boolean} isLayerLink - Whether this is a layerlink trigger
   */
  playNote(note, layerId = 0, isLayerLink = false) {
    if (!this.isEnabled || !this.outputDevice) {
      if (this.debug) console.log('[MIDI OUT] MIDI not enabled or no device');
      return;
    }
    
    try {
      const channel = this.getChannelForLayer(layerId, isLayerLink);
      const frequency = note.frequency || 440;
      const velocity = Math.round((note.velocity || 0.7) * 127);
      const duration = (note.duration || 0.5) * 1000; // Convert to milliseconds
      
      // Calculate MIDI note and pitch bend for microtonal accuracy
      const midiData = this.frequencyToMidiWithBend(frequency);
      const midiNote = midiData.note;
      const pitchBend = midiData.bend;
      
      // Set pitch bend for microtonal accuracy
      if (this.microtonalMode && Math.abs(pitchBend) > 10) {
        this.sendPitchBend(channel, pitchBend);
      }
      
      // Send note on
      this.sendNoteOn(channel, midiNote, velocity);
      
      // Track active note
      const noteKey = `${channel}-${midiNote}`;
      
      // Stop any existing note on this channel/note combination
      if (this.activeNotes.has(noteKey)) {
        clearTimeout(this.activeNotes.get(noteKey).timeoutId);
        this.sendNoteOff(channel, midiNote, 0);
      }
      
      // Schedule note off
      const timeoutId = setTimeout(() => {
        this.sendNoteOff(channel, midiNote, velocity);
        this.activeNotes.delete(noteKey);
        this.stats.notesStopped++;
        
        // Reset pitch bend after note ends (if it was bent)
        if (this.microtonalMode && Math.abs(pitchBend) > 10) {
          setTimeout(() => this.sendPitchBend(channel, 0), 10);
        }
      }, duration);
      
      // Store note info
      this.activeNotes.set(noteKey, {
        timeoutId,
        velocity,
        startTime: performance.now(),
        frequency,
        layerId,
        isLayerLink
      });
      
      // Send polyphonic aftertouch for microtonal expression
      if (this.microtonalMode) {
        const aftertouch = this.calculateAftertouch(frequency, note);
        if (aftertouch > 0) {
          setTimeout(() => {
            this.sendPolyphonicAftertouch(channel, midiNote, aftertouch);
          }, 50); // Slight delay for expression
        }
      }
      
      // Update stats
      this.stats.notesPlayed++;
      this.stats.channelsUsed.add(channel);
      this.stats.lastNoteTime = performance.now();
      
      if (this.debug) {
        console.log(`[MIDI OUT] Note: ${frequency.toFixed(2)}Hz → Ch${channel} Note${midiNote} Bend${pitchBend} Vel${velocity} Dur${duration}ms`);
      }
      
    } catch (error) {
      console.error('[MIDI OUT] Error playing note:', error);
      this.stats.errors++;
    }
  }
  
  /**
   * Convert frequency to MIDI note number with pitch bend
   * @param {number} frequency - Frequency in Hz
   * @returns {Object} {note: midiNote, bend: pitchBendValue}
   */
  frequencyToMidiWithBend(frequency) {
    // Convert frequency to MIDI note number (floating point)
    const midiFloat = 69 + 12 * Math.log2(frequency / 440);
    
    // Get base MIDI note (integer)
    const midiNote = Math.round(midiFloat);
    
    // Calculate cents deviation from base note
    const cents = (midiFloat - midiNote) * 100;
    
    // Convert cents to pitch bend value
    // Pitch bend range is ±pitchBendRange semitones = ±(pitchBendRange * 100) cents
    // MIDI pitch bend range is ±8192 (14-bit)
    const maxCents = this.pitchBendRange * 100;
    const pitchBend = Math.round((cents / maxCents) * 8192);
    
    // Clamp pitch bend to valid range
    const clampedBend = Math.max(-8192, Math.min(8191, pitchBend));
    
    return {
      note: Math.max(0, Math.min(127, midiNote)),
      bend: clampedBend
    };
  }
  
  /**
   * Calculate polyphonic aftertouch value for microtonal expression
   * @param {number} frequency - Note frequency
   * @param {Object} note - Full note object
   * @returns {number} Aftertouch value (0-127)
   */
  calculateAftertouch(frequency, note) {
    // Use frequency deviation from equal temperament to calculate expression
    const equalTempFreq = 440 * Math.pow(2, Math.round(12 * Math.log2(frequency / 440)) / 12);
    const deviation = Math.abs(frequency - equalTempFreq) / equalTempFreq;
    
    // Scale deviation to aftertouch range (0-127)
    const aftertouch = Math.round(deviation * 1000); // Amplify small deviations
    
    return Math.max(0, Math.min(127, aftertouch));
  }
  
  /**
   * Send MIDI Note On message
   * @param {number} channel - MIDI channel (1-16)
   * @param {number} note - MIDI note number (0-127)
   * @param {number} velocity - Velocity (0-127)
   */
  sendNoteOn(channel, note, velocity) {
    if (!this.outputDevice) return;
    
    const status = 0x90 + (channel - 1); // Note On + channel
    this.outputDevice.send([status, note, velocity]);
  }
  
  /**
   * Send MIDI Note Off message
   * @param {number} channel - MIDI channel (1-16)
   * @param {number} note - MIDI note number (0-127)
   * @param {number} velocity - Release velocity (0-127)
   */
  sendNoteOff(channel, note, velocity) {
    if (!this.outputDevice) return;
    
    const status = 0x80 + (channel - 1); // Note Off + channel
    this.outputDevice.send([status, note, velocity]);
  }
  
  /**
   * Send MIDI Pitch Bend message
   * @param {number} channel - MIDI channel (1-16)
   * @param {number} bend - Pitch bend value (-8192 to +8191)
   */
  sendPitchBend(channel, bend) {
    if (!this.outputDevice) return;
    
    // Convert signed bend to 14-bit unsigned value
    const bendValue = bend + 8192;
    const lsb = bendValue & 0x7F;
    const msb = (bendValue >> 7) & 0x7F;
    
    const status = 0xE0 + (channel - 1); // Pitch Bend + channel
    this.outputDevice.send([status, lsb, msb]);
  }
  
  /**
   * Send MIDI Control Change message
   * @param {number} channel - MIDI channel (1-16)
   * @param {number} controller - Controller number (0-127)
   * @param {number} value - Controller value (0-127)
   */
  sendControlChange(channel, controller, value) {
    if (!this.outputDevice) return;
    
    const status = 0xB0 + (channel - 1); // Control Change + channel
    this.outputDevice.send([status, controller, value]);
  }
  
  /**
   * Send MIDI Polyphonic Aftertouch message
   * @param {number} channel - MIDI channel (1-16)
   * @param {number} note - MIDI note number (0-127)
   * @param {number} pressure - Aftertouch pressure (0-127)
   */
  sendPolyphonicAftertouch(channel, note, pressure) {
    if (!this.outputDevice) return;
    
    const status = 0xA0 + (channel - 1); // Polyphonic Aftertouch + channel
    this.outputDevice.send([status, note, pressure]);
  }
  
  /**
   * Send Registered Parameter Number (RPN) message
   * @param {number} channel - MIDI channel (1-16)
   * @param {number} paramMSB - Parameter MSB
   * @param {number} paramLSB - Parameter LSB
   * @param {number} value - Parameter value
   */
  sendRPN(channel, paramMSB, paramLSB, value) {
    if (!this.outputDevice) return;
    
    // Send RPN parameter selection
    this.sendControlChange(channel, 101, paramMSB); // RPN MSB
    this.sendControlChange(channel, 100, paramLSB); // RPN LSB
    
    // Send value
    this.sendControlChange(channel, 6, value); // Data Entry MSB
    
    // Null RPN to prevent accidental changes
    this.sendControlChange(channel, 101, 127);
    this.sendControlChange(channel, 100, 127);
  }
  
  /**
   * Stop all notes on all channels
   */
  stopAllNotes() {
    if (!this.outputDevice) return;
    
    // Clear all scheduled note-offs
    for (const [noteKey, noteInfo] of this.activeNotes) {
      clearTimeout(noteInfo.timeoutId);
      
      const [channel, note] = noteKey.split('-').map(Number);
      this.sendNoteOff(channel, note, 0);
    }
    
    this.activeNotes.clear();
    
    // Send All Notes Off on all channels
    for (let channel = 1; channel <= 16; channel++) {
      this.sendControlChange(channel, 123, 0); // All Notes Off
    }
    
    console.log('[MIDI OUT] All notes stopped');
  }
  
  /**
   * Set microtonal mode
   * @param {boolean} enabled - Enable microtonal compensation
   */
  setMicrotonalMode(enabled) {
    this.microtonalMode = enabled;
    console.log(`[MIDI OUT] Microtonal mode ${enabled ? 'enabled' : 'disabled'}`);
    
    if (!enabled) {
      // Reset all pitch bends to center
      for (let channel = 1; channel <= 16; channel++) {
        this.sendPitchBend(channel, 0);
      }
    }
  }
  
  /**
   * Set pitch bend range for microtonal accuracy
   * @param {number} semitones - Pitch bend range in semitones (1-12)
   */
  setPitchBendRange(semitones) {
    this.pitchBendRange = Math.max(1, Math.min(12, semitones));
    console.log(`[MIDI OUT] Pitch bend range set to ±${this.pitchBendRange} semitones`);
    
    // Update all channels
    if (this.outputDevice) {
      for (let channel = 1; channel <= 16; channel++) {
        this.sendRPN(channel, 0, 0, this.pitchBendRange);
      }
    }
  }
  
  /**
   * Get current status and statistics
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isEnabled: this.isEnabled,
      deviceName: this.deviceName,
      availableDevices: this.availableDevices,
      activeNotes: this.activeNotes.size,
      microtonalMode: this.microtonalMode,
      pitchBendRange: this.pitchBendRange,
      stats: {
        ...this.stats,
        channelsUsed: Array.from(this.stats.channelsUsed)
      }
    };
  }
  
  /**
   * Enable debug logging
   * @param {boolean} enabled - Enable debug mode
   */
  setDebugMode(enabled) {
    this.debug = enabled;
    console.log(`[MIDI OUT] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Disconnect and cleanup
   */
  disconnect() {
    this.stopAllNotes();
    this.outputDevice = null;
    this.isEnabled = false;
    this.deviceName = null;
    
    console.log('[MIDI OUT] Disconnected');
  }
}

// Create singleton instance
const midiOutManager = new MidiOutManager();

// Export functions for integration with geomusica
export async function initializeMidiOut() {
  return await midiOutManager.initialize();
}

export function getMidiDevices() {
  return midiOutManager.availableDevices;
}

export function selectMidiDevice(deviceId = null) {
  return midiOutManager.selectDevice(deviceId);
}

export function playMidiNote(note, layerId = 0, isLayerLink = false) {
  midiOutManager.playNote(note, layerId, isLayerLink);
}

export function stopAllMidiNotes() {
  midiOutManager.stopAllNotes();
}

export function setMidiMicrotonalMode(enabled) {
  midiOutManager.setMicrotonalMode(enabled);
}

export function setMidiPitchBendRange(semitones) {
  midiOutManager.setPitchBendRange(semitones);
}

export function getMidiStatus() {
  return midiOutManager.getStatus();
}

export function setMidiDebugMode(enabled) {
  midiOutManager.setDebugMode(enabled);
}

export function disconnectMidi() {
  midiOutManager.disconnect();
}

// Make available globally for debugging
if (typeof window !== 'undefined') {
  window.midiOutManager = midiOutManager;
  window.getMidiStatus = getMidiStatus;
  window.playMidiNote = playMidiNote;
  window.stopAllMidiNotes = stopAllMidiNotes;
  window.setMidiMicrotonalMode = setMidiMicrotonalMode;
  window.setMidiPitchBendRange = setMidiPitchBendRange;
  window.setMidiDebugMode = setMidiDebugMode;
}

export default midiOutManager; 