// src/midi/midiUI.js - MIDI UI Controls for GeoMusica
// Provides user interface for MIDI output configuration and monitoring

import { 
  initializeMidiOut, 
  getMidiDevices, 
  selectMidiDevice, 
  getMidiStatus,
  setMidiMicrotonalMode,
  setMidiEndlessNotesMode,
  setMidiMTSMode,
  setMidiDebugMode,
  stopAllMidiNotes,
  disconnectMidi
} from './midiOut.js';

/**
 * UI-specific settings storage key
 */
const MIDI_UI_SETTINGS_KEY = 'geomusica-midi-ui-settings';

/**
 * Load UI-specific MIDI settings from localStorage
 */
function loadUISettings() {
  try {
    const savedSettings = localStorage.getItem(MIDI_UI_SETTINGS_KEY);
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      return {
        pluginAutoLoad: settings.pluginAutoLoad !== undefined ? settings.pluginAutoLoad : false,
        pluginAutoEnable: settings.pluginAutoEnable !== undefined ? settings.pluginAutoEnable : false,
        audioEnabled: settings.audioEnabled !== undefined ? settings.audioEnabled : true,
        selectedDeviceId: settings.selectedDeviceId || null, // UI-level device selection
        ...settings
      };
    }
  } catch (error) {
    console.warn('[MIDI UI] Error loading UI settings:', error);
  }
  
  // Return defaults if no saved settings
  return {
    pluginAutoLoad: false,
    pluginAutoEnable: false,
    audioEnabled: true,
    selectedDeviceId: null
  };
}

/**
 * Save UI-specific MIDI settings to localStorage
 */
function saveUISettings(settings) {
  try {
    const currentSettings = loadUISettings();
    const updatedSettings = { ...currentSettings, ...settings };
    localStorage.setItem(MIDI_UI_SETTINGS_KEY, JSON.stringify(updatedSettings));
  } catch (error) {
    console.warn('[MIDI UI] Error saving UI settings:', error);
  }
}

/**
 * Setup MIDI UI controls and integrate with existing UI system
 * @param {HTMLElement} parentContainer - Container to add MIDI controls to
 * @returns {Object} References to UI elements
 */
export function setupMidiUI(parentContainer) {
  // Load saved UI settings
  const savedUISettings = loadUISettings();
  
  // Create MIDI tab container
  const midiTab = document.createElement('div');
  midiTab.id = 'midi-tab';
  midiTab.className = 'tab-content';
  midiTab.style.display = 'none';
  
  // MIDI Enable/Disable Section
  const enableSection = createMidiEnableSection();
  midiTab.appendChild(enableSection);
  
  // Device Selection Section
  const deviceSection = createDeviceSelectionSection();
  midiTab.appendChild(deviceSection);
  
  // Microtonal Settings Section
  const microtonalSection = createMicrotonalSection();
  midiTab.appendChild(microtonalSection);
  
  // Debug and Status Section
  const debugSection = createDebugSection();
  midiTab.appendChild(debugSection);
  
  // Audio Control Section
  const audioSection = createAudioControlSection();
  midiTab.appendChild(audioSection);
  
  // Add to the header-tabs container where other tabs are located
  const headerTabsContainer = document.getElementById('header-tabs');
  if (headerTabsContainer) {
    headerTabsContainer.appendChild(midiTab);
  } else {
    // Fallback to parent container if header-tabs not found
    parentContainer.appendChild(midiTab);
  }
  
  // Add MIDI tab button to existing tab system
  addMidiTabButton();
  
  // Initialize MIDI system
  initializeMidiSystem();
  
  // Setup periodic status updates
  setupStatusUpdates();
  
  // Restore UI settings after elements are created
  setTimeout(() => {
    restoreUISettings(savedUISettings);
  }, 100);
  
  return {
    midiTab,
    enableSection,
    deviceSection,
    microtonalSection,
    debugSection,
    audioSection
  };
}

/**
 * Create MIDI enable/disable section
 */
function createMidiEnableSection() {
  const section = document.createElement('div');
  section.className = 'control-section';
  
  const title = document.createElement('h3');
  title.textContent = 'MIDI Plugin Control';
  section.appendChild(title);
  
  // Plugin Load/Unload controls
  const pluginContainer = document.createElement('div');
  pluginContainer.className = 'control';
  
  const pluginLabel = document.createElement('label');
  pluginLabel.textContent = 'MIDI Plugin:';
  pluginContainer.appendChild(pluginLabel);
  
  const pluginStatus = document.createElement('div');
  pluginStatus.id = 'midiPluginStatus';
  pluginStatus.className = 'status-display';
  pluginStatus.textContent = 'Not loaded';
  pluginContainer.appendChild(pluginStatus);
  
  const pluginButtonContainer = document.createElement('div');
  pluginButtonContainer.style.cssText = 'margin-top: 8px; display: flex; gap: 8px;';
  
  const loadPluginButton = document.createElement('button');
  loadPluginButton.id = 'loadMidiPlugin';
  loadPluginButton.textContent = 'Load MIDI Plugin';
  loadPluginButton.addEventListener('click', handleLoadMidiPlugin);
  pluginButtonContainer.appendChild(loadPluginButton);
  
  const unloadPluginButton = document.createElement('button');
  unloadPluginButton.id = 'unloadMidiPlugin';
  unloadPluginButton.textContent = 'Unload Plugin';
  unloadPluginButton.style.display = 'none';
  unloadPluginButton.addEventListener('click', handleUnloadMidiPlugin);
  pluginButtonContainer.appendChild(unloadPluginButton);
  
  pluginContainer.appendChild(pluginButtonContainer);
  section.appendChild(pluginContainer);
  
  // Enable/Disable toggle (only works when plugin is loaded)
  const enableContainer = document.createElement('div');
  enableContainer.className = 'control';
  
  const enableLabel = document.createElement('label');
  enableLabel.textContent = 'Enable MIDI Output:';
  enableLabel.setAttribute('for', 'midiEnableCheckbox');
  enableContainer.appendChild(enableLabel);
  
  const enableCheckbox = document.createElement('input');
  enableCheckbox.type = 'checkbox';
  enableCheckbox.id = 'midiEnableCheckbox';
  enableCheckbox.disabled = true; // Disabled until plugin is loaded
  enableCheckbox.addEventListener('change', handleMidiEnableChange);
  enableContainer.appendChild(enableCheckbox);
  
  const enableHelp = document.createElement('div');
  enableHelp.className = 'help-text';
  enableHelp.textContent = 'Load the MIDI plugin first to enable MIDI output';
  enableContainer.appendChild(enableHelp);
  
  section.appendChild(enableContainer);
  
  // Status display
  const statusContainer = document.createElement('div');
  statusContainer.className = 'control';
  
  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'MIDI Status:';
  statusContainer.appendChild(statusLabel);
  
  const statusDisplay = document.createElement('div');
  statusDisplay.id = 'midiStatusDisplay';
  statusDisplay.className = 'status-display';
  statusDisplay.textContent = 'MIDI system ready - load plugin to use';
  statusContainer.appendChild(statusDisplay);
  
  section.appendChild(statusContainer);
  
  return section;
}

/**
 * Create device selection section
 */
function createDeviceSelectionSection() {
  const section = document.createElement('div');
  section.className = 'control-section';
  
  const title = document.createElement('h3');
  title.textContent = 'Device Selection';
  section.appendChild(title);
  
  // Device selector
  const deviceContainer = document.createElement('div');
  deviceContainer.className = 'control';
  
  const deviceLabel = document.createElement('label');
  deviceLabel.textContent = 'MIDI Device:';
  deviceLabel.setAttribute('for', 'midiDeviceSelect');
  deviceContainer.appendChild(deviceLabel);
  
  const deviceSelect = document.createElement('select');
  deviceSelect.id = 'midiDeviceSelect';
  deviceSelect.addEventListener('change', handleDeviceSelection);
  deviceContainer.appendChild(deviceSelect);
  
  // Refresh button
  const refreshButton = document.createElement('button');
  refreshButton.textContent = 'Refresh Devices';
  refreshButton.addEventListener('click', refreshMidiDevices);
  deviceContainer.appendChild(refreshButton);
  
  section.appendChild(deviceContainer);
  
  return section;
}

/**
 * Create microtonal settings section
 */
function createMicrotonalSection() {
  const section = document.createElement('div');
  section.className = 'control-section';
  
  const title = document.createElement('h3');
  title.textContent = 'Microtonal Settings';
  section.appendChild(title);
  
  // Microtonal mode toggle
  const modeContainer = document.createElement('div');
  modeContainer.className = 'control';
  
  const modeLabel = document.createElement('label');
  modeLabel.textContent = 'Microtonal Mode:';
  modeLabel.setAttribute('for', 'midiMicrotonalCheckbox');
  modeContainer.appendChild(modeLabel);
  
  const modeCheckbox = document.createElement('input');
  modeCheckbox.type = 'checkbox';
  modeCheckbox.id = 'midiMicrotonalCheckbox';
  modeCheckbox.checked = true; // Default enabled
  modeCheckbox.addEventListener('change', handleMicrotonalModeChange);
  modeContainer.appendChild(modeCheckbox);
  
  const modeHelp = document.createElement('div');
  modeHelp.className = 'help-text';
  modeHelp.textContent = 'Uses polyphonic aftertouch for microtonal accuracy. When disabled, sends plain MIDI without pitch bend.';
  modeContainer.appendChild(modeHelp);
  
  section.appendChild(modeContainer);
  
  // Endless notes mode toggle
  const endlessContainer = document.createElement('div');
  endlessContainer.className = 'control';
  
  const endlessLabel = document.createElement('label');
  endlessLabel.textContent = 'Endless Notes Mode:';
  endlessLabel.setAttribute('for', 'midiEndlessNotesCheckbox');
  endlessContainer.appendChild(endlessLabel);
  
  const endlessCheckbox = document.createElement('input');
  endlessCheckbox.type = 'checkbox';
  endlessCheckbox.id = 'midiEndlessNotesCheckbox';
  endlessCheckbox.checked = false; // Default disabled
  endlessCheckbox.addEventListener('change', handleEndlessNotesModeChange);
  endlessContainer.appendChild(endlessCheckbox);
  
  const endlessHelp = document.createElement('div');
  endlessHelp.className = 'help-text';
  endlessHelp.textContent = 'Notes play indefinitely until manually stopped (prevents pitch reset on note end)';
  endlessContainer.appendChild(endlessHelp);
  
  section.appendChild(endlessContainer);
  
  // MTS mode toggle
  const mtsContainer = document.createElement('div');
  mtsContainer.className = 'control';
  
  const mtsLabel = document.createElement('label');
  mtsLabel.textContent = 'MTS Mode (MIDI Tuning Standard):';
  mtsLabel.setAttribute('for', 'midiMTSCheckbox');
  mtsContainer.appendChild(mtsLabel);
  
  const mtsCheckbox = document.createElement('input');
  mtsCheckbox.type = 'checkbox';
  mtsCheckbox.id = 'midiMTSCheckbox';
  mtsCheckbox.checked = false; // Default disabled
  mtsCheckbox.addEventListener('change', handleMTSModeChange);
  mtsContainer.appendChild(mtsCheckbox);
  
  const mtsHelp = document.createElement('div');
  mtsHelp.className = 'help-text';
  mtsHelp.textContent = 'Uses MTS Real-time Single Note Tuning SysEx for precise frequency control (requires MTS-compatible hardware/software like Pianoteq, Kontakt, etc.)';
  mtsContainer.appendChild(mtsHelp);
  
  section.appendChild(mtsContainer);
  
  return section;
}

/**
 * Create debug and control section
 */
function createDebugSection() {
  const section = document.createElement('div');
  section.className = 'control-section';
  
  const title = document.createElement('h3');
  title.textContent = 'Debug & Control';
  section.appendChild(title);
  
  // Debug mode toggle
  const debugContainer = document.createElement('div');
  debugContainer.className = 'control';
  
  const debugLabel = document.createElement('label');
  debugLabel.textContent = 'Debug Mode:';
  debugLabel.setAttribute('for', 'midiDebugCheckbox');
  debugContainer.appendChild(debugLabel);
  
  const debugCheckbox = document.createElement('input');
  debugCheckbox.type = 'checkbox';
  debugCheckbox.id = 'midiDebugCheckbox';
  debugCheckbox.addEventListener('change', handleDebugModeChange);
  debugContainer.appendChild(debugCheckbox);
  
  section.appendChild(debugContainer);
  
  // Control buttons
  const buttonsContainer = document.createElement('div');
  buttonsContainer.className = 'control';
  
  const stopAllButton = document.createElement('button');
  stopAllButton.textContent = 'Stop All Notes';
  stopAllButton.addEventListener('click', () => {
    stopAllMidiNotes();
  });
  buttonsContainer.appendChild(stopAllButton);
  
  const disconnectButton = document.createElement('button');
  disconnectButton.textContent = 'Disconnect';
  disconnectButton.addEventListener('click', () => {
    disconnectMidi();
    updateMidiStatus();
  });
  buttonsContainer.appendChild(disconnectButton);
  
  section.appendChild(buttonsContainer);
  
  return section;
}

/**
 * Create audio control section
 */
function createAudioControlSection() {
  const section = document.createElement('div');
  section.className = 'control-section';
  
  const title = document.createElement('h3');
  title.textContent = 'Audio Control';
  section.appendChild(title);
  
  // Audio control toggle
  const audioContainer = document.createElement('div');
  audioContainer.className = 'control';
  
  const audioLabel = document.createElement('label');
  audioLabel.textContent = 'Enable Internal Audio Processing:';
  audioLabel.setAttribute('for', 'audioCheckbox');
  audioContainer.appendChild(audioLabel);
  
  const audioCheckbox = document.createElement('input');
  audioCheckbox.type = 'checkbox';
  audioCheckbox.id = 'audioCheckbox';
  audioCheckbox.checked = true; // Default enabled
  audioCheckbox.addEventListener('change', handleAudioModeChange);
  audioContainer.appendChild(audioCheckbox);
  
  const audioHelp = document.createElement('div');
  audioHelp.className = 'help-text';
  audioHelp.textContent = 'Disables internal Csound audio synthesis. When unchecked, only MIDI output is used (no internal sounds).';
  audioContainer.appendChild(audioHelp);
  
  // Audio mode status display
  const audioStatusContainer = document.createElement('div');
  audioStatusContainer.className = 'control';
  
  const audioStatusLabel = document.createElement('label');
  audioStatusLabel.textContent = 'Audio Mode:';
  audioStatusContainer.appendChild(audioStatusLabel);
  
  const audioStatusDisplay = document.createElement('div');
  audioStatusDisplay.id = 'audioModeStatus';
  audioStatusDisplay.className = 'status-display';
  audioStatusDisplay.textContent = 'Audio + MIDI';
  audioStatusContainer.appendChild(audioStatusDisplay);
  
  section.appendChild(audioContainer);
  section.appendChild(audioStatusContainer);
  
  return section;
}

/**
 * Add MIDI tab button to existing tab system
 */
function addMidiTabButton() {
  // Check if MIDI tab already exists to prevent duplicates
  const existingMidiTab = document.querySelector('.tab-button[data-tab="midi"]');
  if (existingMidiTab) {
    console.log('[MIDI UI] MIDI tab already exists, skipping creation');
    return;
  }
  
  const tabContainer = document.querySelector('.tab-buttons-container');
  if (!tabContainer) {
    return;
  }
  
  const midiTabButton = document.createElement('button');
  midiTabButton.className = 'tab-button';
  midiTabButton.setAttribute('data-tab', 'midi');
  midiTabButton.textContent = 'MIDI';
  
  tabContainer.appendChild(midiTabButton);
  
  // Re-initialize the tab system to include the new MIDI tab
  // This ensures the existing tab system handles the MIDI tab properly
  try {
    // Import and call setupHeaderTabs to re-attach event listeners
    import('../ui/headerTabs.js').then(module => {
      if (module.setupHeaderTabs) {
        module.setupHeaderTabs();
      }
    }).catch(error => {
      // Silent error handling
    });
  } catch (error) {
    // Silent error handling
  }
}

/**
 * Initialize MIDI system
 */
async function initializeMidiSystem() {
  const statusDisplay = document.getElementById('midiStatusDisplay');
  
  try {
    statusDisplay.textContent = 'Initializing MIDI...';
    
    const success = await initializeMidiOut();
    
    if (success) {
      statusDisplay.textContent = 'MIDI initialized successfully';
      refreshMidiDevices();
    } else {
      statusDisplay.textContent = 'MIDI initialization failed';
    }
  } catch (error) {
    console.error('[MIDI UI] Initialization error:', error);
    statusDisplay.textContent = 'MIDI initialization error';
  }
}

/**
 * Restore UI settings from saved state
 */
function restoreUISettings(savedUISettings) {
  try {
    // Restore audio mode setting
    const audioCheckbox = document.getElementById('audioCheckbox');
    if (audioCheckbox) {
      audioCheckbox.checked = savedUISettings.audioEnabled;
      updateAudioModeStatus(savedUISettings.audioEnabled);
      
      // Apply the audio setting to the audio engine
      if (typeof window.setAudioEnabled === 'function') {
        window.setAudioEnabled(savedUISettings.audioEnabled);
      } else {
        // Try to import and set audio mode
        import('../audio/audio.js').then(audioModule => {
          if (audioModule.setAudioEnabled) {
            audioModule.setAudioEnabled(savedUISettings.audioEnabled);
          }
        }).catch(error => {
          console.warn('[MIDI UI] Could not restore audio setting:', error);
        });
      }
    }
    
    // Auto-load plugin if enabled
    if (savedUISettings.pluginAutoLoad) {
      const loadButton = document.getElementById('loadMidiPlugin');
      if (loadButton && loadButton.style.display !== 'none') {
        console.log('[MIDI UI] Auto-loading MIDI plugin from saved settings');
        setTimeout(() => {
          handleLoadMidiPlugin().then(() => {
            // Auto-enable if saved setting says so
            if (savedUISettings.pluginAutoEnable) {
              setTimeout(() => {
                const enableCheckbox = document.getElementById('midiEnableCheckbox');
                if (enableCheckbox && !enableCheckbox.disabled) {
                  enableCheckbox.checked = true;
                  const event = { target: { checked: true } };
                  handleMidiEnableChange(event);
                }
              }, 500);
            }
          }).catch(error => {
            console.warn('[MIDI UI] Auto-load failed:', error);
          });
        }, 200);
      }
    }
    
    // The MIDI hardware settings (microtonal mode, debug mode, etc.) 
    // are already handled by the existing updateMidiStatus function
    // which reads from the midiOut module's saved settings
    
    console.log('[MIDI UI] UI settings restored:', savedUISettings);
  } catch (error) {
    console.error('[MIDI UI] Error restoring UI settings:', error);
  }
}

/**
 * Handle MIDI plugin loading
 */
async function handleLoadMidiPlugin() {
  const loadButton = document.getElementById('loadMidiPlugin');
  const unloadButton = document.getElementById('unloadMidiPlugin');
  const pluginStatus = document.getElementById('midiPluginStatus');
  const enableCheckbox = document.getElementById('midiEnableCheckbox');
  const enableHelp = enableCheckbox.parentNode.querySelector('.help-text');
  
  try {
    loadButton.disabled = true;
    loadButton.textContent = 'Loading...';
    pluginStatus.textContent = 'Loading MIDI plugin...';
    pluginStatus.style.color = '#FF9800';
    
    // Load the MIDI plugin
    const { initializeMidiPlugin } = await import('./midiPlugin.js');
    const midiPlugin = await initializeMidiPlugin({
      layerManager: window._layers,
      autoEnable: false
    });
    
    if (midiPlugin) {
      // Plugin loaded successfully
      pluginStatus.textContent = 'Plugin loaded';
      pluginStatus.style.color = '#4CAF50';
      
      // Update UI
      loadButton.style.display = 'none';
      unloadButton.style.display = 'inline-block';
      enableCheckbox.disabled = false;
      enableHelp.textContent = 'Enable/disable MIDI output from triggers';
      
      // Store globally for access
      window.midiPlugin = midiPlugin;
      
      // Save that plugin should auto-load
      saveUISettings({ pluginAutoLoad: true });
      
      // Update status
      updateMidiStatus();
      
      console.log('[MIDI UI] Plugin loaded successfully');
    } else {
      throw new Error('Plugin initialization failed');
    }
    
  } catch (error) {
    // Plugin loading failed
    pluginStatus.textContent = 'Plugin load failed';
    pluginStatus.style.color = '#f44336';
    loadButton.disabled = false;
    loadButton.textContent = 'Load MIDI Plugin';
    
    // Clear auto-load setting on failure
    saveUISettings({ pluginAutoLoad: false });
    
    console.error('[MIDI UI] Plugin load error:', error);
  }
}

/**
 * Handle MIDI plugin unloading
 */
async function handleUnloadMidiPlugin() {
  const loadButton = document.getElementById('loadMidiPlugin');
  const unloadButton = document.getElementById('unloadMidiPlugin');
  const pluginStatus = document.getElementById('midiPluginStatus');
  const enableCheckbox = document.getElementById('midiEnableCheckbox');
  const enableHelp = enableCheckbox.parentNode.querySelector('.help-text');
  
  try {
    // Unload the MIDI plugin
    const { unloadMidiPlugin } = await import('./midiPlugin.js');
    await unloadMidiPlugin();
    
    // Update UI
    pluginStatus.textContent = 'Plugin unloaded';
    pluginStatus.style.color = '#888';
    loadButton.style.display = 'inline-block';
    unloadButton.style.display = 'none';
    enableCheckbox.disabled = true;
    enableCheckbox.checked = false;
    enableHelp.textContent = 'Load the MIDI plugin first to enable MIDI output';
    
    // Clear global reference
    delete window.midiPlugin;
    
    // Save that plugin should not auto-load
    saveUISettings({ pluginAutoLoad: false, pluginAutoEnable: false });
    
    // Update status
    updateMidiStatus();
    
    console.log('[MIDI UI] Plugin unloaded successfully');
    
  } catch (error) {
    console.error('[MIDI UI] Plugin unload error:', error);
  }
}

/**
 * Handle MIDI enable/disable change
 */
async function handleMidiEnableChange(event) {
  const enabled = event.target.checked;
  
  if (window.midiPlugin) {
    if (enabled) {
      await window.midiPlugin.enable();
    } else {
      await window.midiPlugin.disable();
    }
    
    // Save the plugin enabled state
    saveUISettings({ pluginAutoEnable: enabled });
    
    updateMidiStatus();
  } else {
    // Plugin not loaded, reset checkbox
    event.target.checked = false;
  }
}

/**
 * Handle MIDI integration enable/disable change
 */
async function handleMidiIntegrationChange(event) {
  const enabled = event.target.checked;
  
  try {
    if (enabled) {
      const { enableMidiIntegration } = await import('./index.js');
      await enableMidiIntegration();
    } else {
      const { disableMidiIntegration } = await import('./index.js');
      await disableMidiIntegration();
    }
  } catch (error) {
    // Revert checkbox state on error
    event.target.checked = !enabled;
  }
}

/**
 * Handle device selection change
 */
function handleDeviceSelection(event) {
  const deviceId = event.target.value;
  
  if (deviceId === '') {
    disconnectMidi();
  } else {
    selectMidiDevice(deviceId);
  }
  
  // Save the selected device ID to UI settings
  saveUISettings({ selectedDeviceId: deviceId });
  
  updateMidiStatus();
}

/**
 * Handle microtonal mode change
 */
function handleMicrotonalModeChange(event) {
  const enabled = event.target.checked;
  setMidiMicrotonalMode(enabled);
  // Note: This setting is automatically saved by the midiOut module
}

/**
 * Handle endless notes mode change
 */
function handleEndlessNotesModeChange(event) {
  const enabled = event.target.checked;
  setMidiEndlessNotesMode(enabled);
  // Note: This setting is automatically saved by the midiOut module
}

/**
 * Handle MTS mode change
 */
function handleMTSModeChange(event) {
  const enabled = event.target.checked;
  setMidiMTSMode(enabled);
  // Note: This setting is automatically saved by the midiOut module
}

/**
 * Handle debug mode change
 */
function handleDebugModeChange(event) {
  const enabled = event.target.checked;
  setMidiDebugMode(enabled);
  // Note: This setting is automatically saved by the midiOut module
}

/**
 * Handle audio mode change - SIMPLIFIED
 */
async function handleAudioModeChange(event) {
  const enabled = event.target.checked;
  
  // Mark that user has explicitly set the audio mode
  window._userSetAudioMode = true;
  
  try {
    // Import the simplified audio module
    const audioModule = await import('../audio/audio.js');
    
    // Simply enable/disable audio using the new function
    audioModule.setAudioEnabled(enabled);
    
    // Save the audio mode setting
    saveUISettings({ audioEnabled: enabled });
    
    updateAudioModeStatus(enabled);
    
  } catch (error) {
    console.error('[MIDI UI] Error changing audio mode:', error);
  }
}

/**
 * Update audio mode status display
 */
function updateAudioModeStatus(enabled) {
  const statusDisplay = document.getElementById('audioModeStatus');
  if (statusDisplay) {
    if (enabled) {
      statusDisplay.textContent = 'Audio + MIDI';
      statusDisplay.style.color = '#4CAF50'; // Green
    } else {
      statusDisplay.textContent = 'MIDI Only';
      statusDisplay.style.color = '#FF9800'; // Orange
    }
  }
}

/**
 * Refresh MIDI devices list
 */
function refreshMidiDevices() {
  const deviceSelect = document.getElementById('midiDeviceSelect');
  if (!deviceSelect) return;
  
  // Get current status to check for saved device
  const status = getMidiStatus();
  const savedUISettings = loadUISettings();
  
  // Clear existing options
  deviceSelect.innerHTML = '';
  
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'Select MIDI Device...';
  deviceSelect.appendChild(defaultOption);
  
  // Add available devices
  const devices = getMidiDevices();
  devices.forEach(device => {
    const option = document.createElement('option');
    option.value = device.id;
    option.textContent = `${device.name} (${device.manufacturer || 'Unknown'})`;
    
    // Select the currently connected device, saved device from midiOut, or saved device from UI
    if (status.isEnabled && status.deviceName === device.name) {
      option.selected = true;
    } else if (savedUISettings.selectedDeviceId === device.id) {
      option.selected = true;
      // Also try to reconnect to the saved device if not already connected
      if (!status.isEnabled || status.deviceName !== device.name) {
        setTimeout(() => {
          selectMidiDevice(device.id);
        }, 100);
      }
    }
    
    deviceSelect.appendChild(option);
  });
}

/**
 * Update MIDI status display and restore saved settings
 */
function updateMidiStatus() {
  // Update plugin status
  const pluginStatus = document.getElementById('midiPluginStatus');
  const enableCheckbox = document.getElementById('midiEnableCheckbox');
  const loadButton = document.getElementById('loadMidiPlugin');
  const unloadButton = document.getElementById('unloadMidiPlugin');
  
  if (window.midiPlugin) {
    // Plugin is loaded
    if (pluginStatus) {
      pluginStatus.textContent = 'Plugin loaded';
      pluginStatus.style.color = '#4CAF50';
    }
    
    if (loadButton) loadButton.style.display = 'none';
    if (unloadButton) unloadButton.style.display = 'inline-block';
    if (enableCheckbox) {
      enableCheckbox.disabled = false;
      enableCheckbox.checked = window.midiPlugin.isEnabled;
    }
  } else {
    // Plugin is not loaded
    if (pluginStatus) {
      pluginStatus.textContent = 'Not loaded';
      pluginStatus.style.color = '#888';
    }
    
    if (loadButton) loadButton.style.display = 'inline-block';
    if (unloadButton) unloadButton.style.display = 'none';
    if (enableCheckbox) {
      enableCheckbox.disabled = true;
      enableCheckbox.checked = false;
    }
  }
  
  // Update MIDI hardware status
  const status = getMidiStatus();
  const statusDisplay = document.getElementById('midiStatusDisplay');
  
  if (statusDisplay) {
    if (window.midiPlugin && window.midiPlugin.isEnabled) {
      if (status.isEnabled && status.deviceName) {
        statusDisplay.textContent = `Active - Connected to ${status.deviceName}`;
        statusDisplay.style.color = '#4CAF50'; // Green
      } else if (status.isInitialized) {
        statusDisplay.textContent = 'Plugin enabled - no MIDI device selected';
        statusDisplay.style.color = '#FF9800'; // Orange
      } else {
        statusDisplay.textContent = 'Plugin enabled - MIDI not available';
        statusDisplay.style.color = '#F44336'; // Red
      }
    } else if (window.midiPlugin) {
      statusDisplay.textContent = 'Plugin loaded but disabled';
      statusDisplay.style.color = '#888'; // Gray
    } else {
      statusDisplay.textContent = 'MIDI system ready - load plugin to use';
      statusDisplay.style.color = '#888'; // Gray
    }
  }
  
  // Update microtonal mode checkbox (restore saved setting)
  const microtonalCheckbox = document.getElementById('midiMicrotonalCheckbox');
  if (microtonalCheckbox) {
    microtonalCheckbox.checked = status.microtonalMode;
  }
  
  // Update endless notes mode checkbox (restore saved setting)
  const endlessCheckbox = document.getElementById('midiEndlessNotesCheckbox');
  if (endlessCheckbox) {
    endlessCheckbox.checked = status.endlessNotesMode;
  }
  
  // Update MTS checkbox and disable if SysEx not supported (restore saved setting)
  const mtsCheckbox = document.getElementById('midiMTSCheckbox');
  if (mtsCheckbox) {
    mtsCheckbox.checked = status.mtsMode;
    mtsCheckbox.disabled = !status.mtsSysExSupported;
    
    // Update help text if SysEx not supported
    const mtsHelp = mtsCheckbox.parentNode.querySelector('.help-text');
    if (mtsHelp && !status.mtsSysExSupported) {
      mtsHelp.textContent = 'MTS mode requires SysEx support (not available in this browser/device)';
      mtsHelp.style.color = '#F44336';
    }
  }
  
  // Update debug mode checkbox (restore saved setting)
  const debugCheckbox = document.getElementById('midiDebugCheckbox');
  if (debugCheckbox) {
    debugCheckbox.checked = status.debug;
  }
  
  // Note: Device selection persistence is handled by refreshMidiDevices function
  // which reads from both midiOut saved settings and UI saved settings
}

/**
 * Setup periodic status updates
 */
function setupStatusUpdates() {
  // Update status every 2 seconds
  setInterval(updateMidiStatus, 2000);
  
  // Initial update
  setTimeout(updateMidiStatus, 1000);
}

/**
 * Add CSS styles for MIDI UI
 */
function addMidiUIStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* MIDI tab content styling */
    #midi-tab {
      padding: 20px;
      background: #1a1a1a;
      color: #ffffff;
    }
    
    #midi-tab .control-section {
      background: #2a2a2a;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    
    #midi-tab .control-section h3 {
      margin: 0 0 15px 0;
      color: #ffffff;
      font-size: 16px;
      font-weight: bold;
      border-bottom: 1px solid #444;
      padding-bottom: 8px;
    }
    
    #midi-tab .control {
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    #midi-tab .control label {
      color: #cccccc;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    #midi-tab .help-text {
      font-size: 12px;
      color: #888;
      font-style: italic;
      margin-top: 5px;
    }
    
    .status-display {
      font-weight: bold;
      padding: 8px;
      border-radius: 4px;
      background: #333333;
      margin-top: 4px;
      border: 1px solid #555;
    }
    
    #midi-tab button {
      margin: 4px;
      padding: 8px 16px;
      background: #4CAF50;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    #midi-tab button:hover {
      background: #45a049;
    }
    
    #midi-tab select {
      min-width: 200px;
      margin: 4px;
      padding: 6px;
      background: #333333;
      color: #ffffff;
      border: 1px solid #555;
      border-radius: 4px;
    }
    
    #midi-tab input[type="checkbox"] {
      margin-right: 8px;
    }
    
    #midi-tab input[type="range"] {
      width: 100%;
      margin: 5px 0;
    }
    
    #midi-tab input[type="range"] + span {
      color: #4CAF50;
      font-weight: bold;
      margin-left: 10px;
    }
  `;
  
  document.head.appendChild(style);
}

// Initialize styles when module loads
addMidiUIStyles();

// Export setup function
export default setupMidiUI; 