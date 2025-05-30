// src/midi/midiOut.js - Comprehensive MIDI Output Module for GeoMusica
// Handles note duration, velocity, polyphonic aftertouch, and multi-channel output
// Each layer outputs to a different MIDI channel; channel 16 reserved for layerlink output

/**
 * MIDI Output Manager for GeoMusica
 * Features:
 * - Multi-channel output (layers 0-14 map to MIDI channels 1-15, layerlink uses channel 16)
 * - Note duration tracking with automatic note-off
 * - Velocity control
 * - Polyphonic aftertouch for microtonal compensation (no pitch bend in microtonal mode)
 * - Pitch bend for microtonal accuracy (only in non-microtonal mode)
 * - Real-time parameter control via MIDI CC
 * - Endless notes mode to prevent automatic note-off
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
    this.microtonalMode = true; // Enable microtonal compensation (polyphonic aftertouch only)
    this.endlessNotesMode = false; // Enable endless notes (no automatic note-off)
    this.mtsMode = false; // Enable MTS (MIDI Tuning Standard) mode
    this.mtsSysExSupported = false; // Track if SysEx is supported
    
    // MIDI device settings
    this.deviceName = null;
    this.availableDevices = [];
    this.selectedDeviceId = null; // Store device ID for persistence
    
    // Debugging
    this.debug = false;
    
    // Load saved settings
    this.loadSettings();
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
      
      // Request MIDI access with SysEx support
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
      
      // Check if SysEx is actually supported
      this.mtsSysExSupported = this.midiAccess.sysexEnabled;
      
      // Enumerate available output devices
      this.updateAvailableDevices();
      
      // Listen for device changes
      this.midiAccess.onstatechange = (event) => {
        this.updateAvailableDevices();
        
        // If our current device was disconnected, clear it
        if (event.port === this.outputDevice && event.port.state === 'disconnected') {
          this.outputDevice = null;
          this.isEnabled = false;
        }
      };
      
      this.isInitialized = true;
      
      // Auto-restore previously selected device
      setTimeout(() => this.autoRestoreDevice(), 100);
      
      return true;
    } catch (error) {
      console.error('[MIDI OUT] Failed to initialize MIDI:', error);
      
      // Try again without SysEx if the first attempt failed
      try {
        this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
        this.mtsSysExSupported = false;
        
        this.updateAvailableDevices();
        this.midiAccess.onstatechange = (event) => {
          this.updateAvailableDevices();
          
          if (event.port === this.outputDevice && event.port.state === 'disconnected') {
            this.outputDevice = null;
            this.isEnabled = false;
          }
        };
        
        this.isInitialized = true;
        
        // Auto-restore previously selected device
        setTimeout(() => this.autoRestoreDevice(), 100);
        
        return true;
      } catch (fallbackError) {
        return false;
      }
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
    this.selectedDeviceId = targetDevice.id;
    this.isEnabled = true;
    
    // Initialize all channels with default settings
    this.initializeChannels();
    
    // Save settings
    this.saveSettings();
    
    return true;
  }
  
  /**
   * Auto-restore previously selected device
   */
  autoRestoreDevice() {
    if (this.selectedDeviceId) {
      const success = this.selectDevice(this.selectedDeviceId);
      if (!success) {
        this.selectedDeviceId = null;
        this.saveSettings();
      }
    }
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
      
      // Choose microtonal method: MTS, pitch bend (non-microtonal), or polyphonic aftertouch (microtonal)
      if (this.mtsMode) {
        // Try to use MTS SysEx for precise frequency control
        const mtsSuccess = this.sendMTSSysEx(midiNote, frequency);
        
        if (!mtsSuccess) {
          // Fall back to polyphonic aftertouch if MTS failed and in microtonal mode
          if (this.microtonalMode) {
            // In microtonal mode, we only use polyphonic aftertouch, no pitch bend
            // Pitch bend will be sent after note on
          } else {
            // In non-microtonal mode, use pitch bend as fallback only if MTS was attempted
            if (Math.abs(pitchBend) > 10) {
              this.sendPitchBend(channel, pitchBend);
            }
          }
        }
      } else if (this.microtonalMode) {
        // In microtonal mode without MTS, we don't send pitch bend at all
        // Only polyphonic aftertouch will be used for microtonal expression
      }
      // Note: When both microtonalMode and mtsMode are false, no pitch bend is sent (plain MIDI)
      
      // Send note on
      this.sendNoteOn(channel, midiNote, velocity);
      
      // Track active note
      const noteKey = `${channel}-${midiNote}`;
      
      // Schedule note off (only if not in endless notes mode)
      let timeoutId = null;
      if (!this.endlessNotesMode) {
        // Stop any existing note on this channel/note combination (only in timed mode)
        if (this.activeNotes.has(noteKey)) {
          const existingNote = this.activeNotes.get(noteKey);
          clearTimeout(existingNote.timeoutId);
          this.sendNoteOff(channel, midiNote, 0);
        }
        
        timeoutId = setTimeout(() => {
          this.sendNoteOff(channel, midiNote, velocity);
          this.activeNotes.delete(noteKey);
        }, duration);
      }
      
      // Store note info
      this.activeNotes.set(noteKey, {
        timeoutId,
        velocity,
        startTime: performance.now(),
        frequency,
        layerId,
        isLayerLink,
        isEndless: this.endlessNotesMode
      });
      
      // Send polyphonic aftertouch for microtonal expression (only in microtonal mode)
      if (this.microtonalMode) {
        const aftertouch = this.calculateAftertouch(frequency, note);
        if (aftertouch > 0) {
          setTimeout(() => {
            this.sendPolyphonicAftertouch(channel, midiNote, aftertouch);
          }, 50); // Slight delay for expression
        }
      }
    } catch (error) {
      // Silent error handling
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
   * Send MTS (MIDI Tuning Standard) SysEx message for single note tuning
   * Real-time Single Note Tuning Format: F0 7F [device ID] 08 02 [tuning program] 01 [MIDI note] [xx] [yy] [zz] F7
   * 
   * Frequency Encoding:
   * - xx = semitone (MIDI note number to retune to, unit is 100 cents)
   * - yy = MSB of fractional part (1/128 semitone = 0.78125 cent units)
   * - zz = LSB of fractional part (1/16384 semitone = 0.006103515625 cent units)
   * 
   * Example: 535 Hz → 72.384 semitones → xx=72, yy=49, zz=26
   * 
   * @param {number} midiNote - MIDI note number (0-127) to retune
   * @param {number} frequency - Target frequency in Hz
   * @param {number} deviceId - MIDI device ID (default: 0x00 for device 0)
   * @param {number} tuningProgram - Tuning program number (default: 0)
   * @returns {boolean} True if SysEx was sent successfully, false if fallback needed
   */
  sendMTSSysEx(midiNote, frequency, deviceId = 0x00, tuningProgram = 0) {
    if (!this.outputDevice) return false;
    
    // Check if SysEx is supported
    if (!this.mtsSysExSupported) {
      return false;
    }
    
    try {
      // Calculate target semitone from frequency
      // Formula: semitone = 69 + 12 * log2(frequency / 440)
      const targetSemitone = 69 + 12 * Math.log2(frequency / 440);
      
      // Split into integer and fractional parts
      const xx = Math.floor(targetSemitone); // Semitone part (MIDI note number to retune to)
      const fractionalSemitones = targetSemitone - xx; // Fractional part in semitones
      
      // Convert fractional part to cents (1 semitone = 100 cents)
      const fractionalCents = fractionalSemitones * 100;
      
      // Calculate yy and zz values according to MTS specification
      // yy = MSB of fractional part (1/128 semitone = 0.78125 cent units)
      // zz = LSB of fractional part (1/16384 semitone = 0.006103515625 cent units)
      const yy = Math.floor(fractionalCents / 0.78125);
      const remainingCents = fractionalCents - (yy * 0.78125);
      const zz = Math.floor(remainingCents / 0.006103515625); // 1/16384 semitone
      
      // Clamp values to valid 7-bit range
      const xxClamped = Math.max(0, Math.min(127, xx));
      const yyClamped = Math.max(0, Math.min(127, yy));
      const zzClamped = Math.max(0, Math.min(127, zz));
      
      // Construct MTS Real-time Single Note Tuning SysEx message
      const sysExMessage = [
        0xF0,           // SysEx start
        0x7F,           // Universal Real-Time (not 0x7E!)
        deviceId,       // Device ID
        0x08,           // MIDI Tuning Standard
        0x02,           // Real-time Single Note Tuning Change
        tuningProgram,  // Tuning program number
        0x01,           // Number of notes being changed (1 for single note)
        midiNote,       // MIDI note number to retune
        xxClamped,      // Semitone (MIDI note number to retune to)
        yyClamped,      // MSB of fractional part
        zzClamped,      // LSB of fractional part
        0xF7            // SysEx end
      ];
      
      // Send the SysEx message
      this.outputDevice.send(sysExMessage);
      
      return true;
      
    } catch (error) {
      // Disable MTS mode to prevent further errors
      this.mtsMode = false;
      this.mtsSysExSupported = false;
      
      return false;
    }
  }
  
  /**
   * Stop all notes on all channels
   */
  stopAllNotes() {
    if (!this.outputDevice) return;
    
    // Clear all scheduled note-offs and send note-off for all active notes
    for (const [noteKey, noteInfo] of this.activeNotes) {
      // Clear timeout if it exists (for non-endless notes)
      if (noteInfo.timeoutId) {
        clearTimeout(noteInfo.timeoutId);
      }
      
      const [channel, note] = noteKey.split('-').map(Number);
      this.sendNoteOff(channel, note, 0);
    }
    
    this.activeNotes.clear();
    
    // Send All Notes Off on all channels
    for (let channel = 1; channel <= 16; channel++) {
      this.sendControlChange(channel, 123, 0); // All Notes Off
    }
  }
  
  /**
   * Set microtonal mode
   * @param {boolean} enabled - Enable microtonal compensation (polyphonic aftertouch only, no pitch bend)
   */
  setMicrotonalMode(enabled) {
    this.microtonalMode = enabled;
    
    if (enabled) {
      // Reset all pitch bends to center when enabling microtonal mode
      for (let channel = 1; channel <= 16; channel++) {
        this.sendPitchBend(channel, 0);
      }
    }
    
    // Save settings
    this.saveSettings();
  }
  
  /**
   * Set endless notes mode
   * @param {boolean} enabled - Enable endless notes (no automatic note-off)
   */
  setEndlessNotesMode(enabled) {
    this.endlessNotesMode = enabled;
    
    // Save settings
    this.saveSettings();
  }
  
  /**
   * Set MTS (MIDI Tuning Standard) mode
   * @param {boolean} enabled - Enable MTS mode for precise frequency control
   */
  setMTSMode(enabled) {
    if (enabled && !this.mtsSysExSupported) {
      this.mtsMode = false;
      this.saveSettings();
      return;
    }
    
    this.mtsMode = enabled;
    
    if (enabled) {
      // Reset all pitch bends to center when switching back to pitch bend mode
      for (let channel = 1; channel <= 16; channel++) {
        this.sendPitchBend(channel, 0);
      }
    }
    
    // Save settings
    this.saveSettings();
  }
  
  /**
   * Set pitch bend range for microtonal accuracy
   * @param {number} semitones - Pitch bend range in semitones (1-12)
   */
  setPitchBendRange(semitones) {
    this.pitchBendRange = Math.max(1, Math.min(12, semitones));
    
    // Update all channels
    if (this.outputDevice) {
      for (let channel = 1; channel <= 16; channel++) {
        this.sendRPN(channel, 0, 0, this.pitchBendRange);
      }
    }
    
    // Save settings
    this.saveSettings();
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
      endlessNotesMode: this.endlessNotesMode,
      mtsMode: this.mtsMode,
      mtsSysExSupported: this.mtsSysExSupported,
      pitchBendRange: this.pitchBendRange,
    };
  }
  
  /**
   * Enable debug logging
   * @param {boolean} enabled - Enable debug mode
   */
  setDebugMode(enabled) {
    this.debug = enabled;
    
    // Save settings
    this.saveSettings();
  }
  
  /**
   * Disconnect and cleanup
   */
  disconnect() {
    this.stopAllNotes();
    this.outputDevice = null;
    this.isEnabled = false;
    this.deviceName = null;
    this.selectedDeviceId = null;
    
    // Save settings (clears selected device)
    this.saveSettings();
  }
  
  /**
   * Load saved MIDI settings from localStorage
   */
  loadSettings() {
    try {
      const savedSettings = localStorage.getItem('geomusica-midi-settings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        
        // Restore settings with defaults
        this.microtonalMode = settings.microtonalMode !== undefined ? settings.microtonalMode : true;
        this.endlessNotesMode = settings.endlessNotesMode !== undefined ? settings.endlessNotesMode : false;
        this.mtsMode = settings.mtsMode !== undefined ? settings.mtsMode : false;
        this.pitchBendRange = settings.pitchBendRange || 2;
        this.selectedDeviceId = settings.selectedDeviceId || null;
        this.debug = settings.debug !== undefined ? settings.debug : false;
      }
    } catch (error) {
      // Silent error handling
    }
  }
  
  /**
   * Save current MIDI settings to localStorage
   */
  saveSettings() {
    try {
      const settings = {
        microtonalMode: this.microtonalMode,
        endlessNotesMode: this.endlessNotesMode,
        mtsMode: this.mtsMode,
        pitchBendRange: this.pitchBendRange,
        selectedDeviceId: this.selectedDeviceId,
        debug: this.debug
      };
      
      localStorage.setItem('geomusica-midi-settings', JSON.stringify(settings));
    } catch (error) {
      // Silent error handling
    }
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

export function setMidiEndlessNotesMode(enabled) {
  midiOutManager.setEndlessNotesMode(enabled);
}

export function setMidiMTSMode(enabled) {
  midiOutManager.setMTSMode(enabled);
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
  window.setMidiEndlessNotesMode = setMidiEndlessNotesMode;
  window.setMidiMTSMode = setMidiMTSMode;
  window.setMidiPitchBendRange = setMidiPitchBendRange;
  window.setMidiDebugMode = setMidiDebugMode;
}

export default midiOutManager; 