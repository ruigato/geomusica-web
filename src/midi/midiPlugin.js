// src/midi/midiPlugin.js - MIDI Plugin for Trigger Dispatcher
// This plugin registers with the trigger dispatcher independently

// MIDI plugin state
let midiPlugin = null;
let isInitialized = false;

/**
 * MIDI Plugin Class
 */
class MidiPlugin {
  constructor() {
    this.isEnabled = false;
    this.midiInitialized = false;
    this.layerManager = null;
    this.stats = {
      totalNotes: 0,
      layerNotes: 0,
      layerLinkNotes: 0,
      errors: 0
    };
  }

  /**
   * Initialize the MIDI plugin
   */
  async initialize(options = {}) {
    try {
      const { layerManager = null, autoEnable = false } = options;
      
      console.log('[MIDI PLUGIN] Initializing...');
      
      this.layerManager = layerManager;
      
      // Initialize MIDI output using the exported functions
      const { initializeMidiOut } = await import('./midiOut.js');
      this.midiInitialized = await initializeMidiOut();
      
      if (!this.midiInitialized) {
        console.warn('[MIDI PLUGIN] MIDI output initialization failed');
        return false;
      }
      
      // Register as trigger handler
      const { registerTriggerHandler } = await import('../triggers/triggerDispatcher.js');
      registerTriggerHandler('midi', this.handleTrigger.bind(this), {
        enabled: autoEnable,
        priority: 5 // Lower priority than audio
      });
      
      this.isEnabled = autoEnable;
      console.log('[MIDI PLUGIN] Initialized successfully');
      
      return true;
    } catch (error) {
      console.error('[MIDI PLUGIN] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Handle trigger from trigger dispatcher
   * @param {Object} note - Note data from trigger system
   */
  handleTrigger(note) {
    if (!this.isEnabled || !this.midiInitialized) {
      return;
    }

    try {
      // Determine if this is a layer link trigger
      const isLayerLink = this.isLayerLinkNote(note);
      
      // Get layer ID for channel mapping
      let layerId = this.getLayerIdFromNote(note);
      
      // Route to MIDI using the exported function
      import('./midiOut.js').then(module => {
        module.playMidiNote(note, layerId, isLayerLink);
      });
      
      // Update statistics
      this.stats.totalNotes++;
      if (isLayerLink) {
        this.stats.layerLinkNotes++;
      } else {
        this.stats.layerNotes++;
      }
      
    } catch (error) {
      this.stats.errors++;
      console.warn('[MIDI PLUGIN] Error handling trigger:', error);
    }
  }

  /**
   * Enable the MIDI plugin
   */
  async enable() {
    try {
      const { setTriggerHandlerEnabled } = await import('../triggers/triggerDispatcher.js');
      setTriggerHandlerEnabled('midi', true);
      this.isEnabled = true;
      console.log('[MIDI PLUGIN] Enabled');
    } catch (error) {
      console.error('[MIDI PLUGIN] Error enabling:', error);
    }
  }

  /**
   * Disable the MIDI plugin
   */
  async disable() {
    try {
      const { setTriggerHandlerEnabled } = await import('../triggers/triggerDispatcher.js');
      setTriggerHandlerEnabled('midi', false);
      this.isEnabled = false;
      console.log('[MIDI PLUGIN] Disabled');
    } catch (error) {
      console.error('[MIDI PLUGIN] Error disabling:', error);
    }
  }

  /**
   * Check if a note is from a layer link
   */
  isLayerLinkNote(note) {
    return note && (
      note.isLinkTrigger === true ||
      note.linkIndex !== undefined ||
      (note.copyIndex === -1 && note.vertexIndex >= 0)
    );
  }

  /**
   * Extract layer ID from note
   */
  getLayerIdFromNote(note) {
    if (note.layerId !== undefined) {
      return note.layerId;
    }
    
    // Try to get from layer manager if available
    if (this.layerManager && this.layerManager.activeLayerId) {
      return this.layerManager.activeLayerId;
    }
    
    return 0; // Default layer
  }

  /**
   * Setup UI for MIDI plugin
   */
  async setupUI(container) {
    try {
      const { setupMidiUI } = await import('./midiUI.js');
      await setupMidiUI(container);
      console.log('[MIDI PLUGIN] UI setup complete');
    } catch (error) {
      console.warn('[MIDI PLUGIN] UI setup failed:', error);
    }
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Get MIDI status
   */
  async getStatus() {
    try {
      const { getMidiStatus } = await import('./midiOut.js');
      return {
        initialized: this.midiInitialized,
        enabled: this.isEnabled,
        midiStatus: getMidiStatus(),
        stats: this.getStats()
      };
    } catch (error) {
      return {
        initialized: false,
        enabled: false,
        error: error.message
      };
    }
  }

  /**
   * Cleanup the plugin
   */
  async cleanup() {
    try {
      // Unregister from trigger dispatcher
      const { unregisterTriggerHandler } = await import('../triggers/triggerDispatcher.js');
      unregisterTriggerHandler('midi');
      
      // Cleanup MIDI output
      if (this.midiInitialized) {
        const { disconnectMidi } = await import('./midiOut.js');
        disconnectMidi();
      }
      
      this.isEnabled = false;
      this.midiInitialized = false;
      console.log('[MIDI PLUGIN] Cleaned up');
    } catch (error) {
      console.error('[MIDI PLUGIN] Cleanup error:', error);
    }
  }
}

/**
 * Initialize MIDI plugin
 * @param {Object} options - Plugin options
 * @returns {MidiPlugin|null} Plugin instance or null if failed
 */
export async function initializeMidiPlugin(options = {}) {
  if (isInitialized && midiPlugin) {
    console.log('[MIDI PLUGIN] Already initialized');
    return midiPlugin;
  }

  try {
    midiPlugin = new MidiPlugin();
    const success = await midiPlugin.initialize(options);
    
    if (success) {
      isInitialized = true;
      return midiPlugin;
    } else {
      midiPlugin = null;
      return null;
    }
  } catch (error) {
    console.error('[MIDI PLUGIN] Failed to initialize:', error);
    midiPlugin = null;
    return null;
  }
}

/**
 * Unload MIDI plugin
 */
export async function unloadMidiPlugin() {
  if (midiPlugin) {
    await midiPlugin.cleanup();
    midiPlugin = null;
    isInitialized = false;
    console.log('[MIDI PLUGIN] Unloaded');
  }
}

/**
 * Get current MIDI plugin instance
 * @returns {MidiPlugin|null} Current plugin instance
 */
export function getMidiPlugin() {
  return midiPlugin;
}

// Export the plugin class for advanced usage
export { MidiPlugin }; 