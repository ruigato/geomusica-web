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
 * Setup MIDI UI controls and integrate with existing UI system
 * @param {HTMLElement} parentContainer - Container to add MIDI controls to
 * @returns {Object} References to UI elements
 */
export function setupMidiUI(parentContainer) {
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
  title.textContent = 'MIDI Output';
  section.appendChild(title);
  
  // Enable/Disable toggle
  const enableContainer = document.createElement('div');
  enableContainer.className = 'control';
  
  const enableLabel = document.createElement('label');
  enableLabel.textContent = 'Enable MIDI Output:';
  enableLabel.setAttribute('for', 'midiEnableCheckbox');
  enableContainer.appendChild(enableLabel);
  
  const enableCheckbox = document.createElement('input');
  enableCheckbox.type = 'checkbox';
  enableCheckbox.id = 'midiEnableCheckbox';
  enableCheckbox.addEventListener('change', handleMidiEnableChange);
  enableContainer.appendChild(enableCheckbox);
  
  // MIDI Integration toggle
  const integrationContainer = document.createElement('div');
  integrationContainer.className = 'control';
  
  const integrationLabel = document.createElement('label');
  integrationLabel.textContent = 'Enable MIDI Integration:';
  integrationLabel.setAttribute('for', 'midiIntegrationCheckbox');
  integrationContainer.appendChild(integrationLabel);
  
  const integrationCheckbox = document.createElement('input');
  integrationCheckbox.type = 'checkbox';
  integrationCheckbox.id = 'midiIntegrationCheckbox';
  integrationCheckbox.checked = true; // Default enabled
  integrationCheckbox.addEventListener('change', handleMidiIntegrationChange);
  integrationContainer.appendChild(integrationCheckbox);
  
  const integrationHelp = document.createElement('div');
  integrationHelp.className = 'help-text';
  integrationHelp.textContent = 'Routes triggered notes to MIDI output in addition to audio';
  integrationContainer.appendChild(integrationHelp);
  
  section.appendChild(enableContainer);
  section.appendChild(integrationContainer);
  
  // Status display
  const statusContainer = document.createElement('div');
  statusContainer.className = 'control';
  
  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'Status:';
  statusContainer.appendChild(statusLabel);
  
  const statusDisplay = document.createElement('div');
  statusDisplay.id = 'midiStatusDisplay';
  statusDisplay.className = 'status-display';
  statusDisplay.textContent = 'Initializing...';
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
 * Handle MIDI enable/disable change
 */
function handleMidiEnableChange(event) {
  const enabled = event.target.checked;
  
  if (enabled) {
    // Try to select first available device
    const devices = getMidiDevices();
    if (devices.length > 0) {
      selectMidiDevice();
    }
  } else {
    disconnectMidi();
  }
  
  updateMidiStatus();
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
  
  updateMidiStatus();
}

/**
 * Handle microtonal mode change
 */
function handleMicrotonalModeChange(event) {
  const enabled = event.target.checked;
  setMidiMicrotonalMode(enabled);
}

/**
 * Handle endless notes mode change
 */
function handleEndlessNotesModeChange(event) {
  const enabled = event.target.checked;
  setMidiEndlessNotesMode(enabled);
}

/**
 * Handle MTS mode change
 */
function handleMTSModeChange(event) {
  const enabled = event.target.checked;
  setMidiMTSMode(enabled);
}

/**
 * Handle debug mode change
 */
function handleDebugModeChange(event) {
  const enabled = event.target.checked;
  setMidiDebugMode(enabled);
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
    
    // Select the currently connected device or saved device
    if (status.isEnabled && status.deviceName === device.name) {
      option.selected = true;
    }
    
    deviceSelect.appendChild(option);
  });
}

/**
 * Update MIDI status display and restore saved settings
 */
function updateMidiStatus() {
  const status = getMidiStatus();
  
  // Update status display
  const statusDisplay = document.getElementById('midiStatusDisplay');
  if (statusDisplay) {
    if (status.isEnabled && status.deviceName) {
      statusDisplay.textContent = `Connected to ${status.deviceName}`;
      statusDisplay.style.color = '#4CAF50'; // Green
    } else if (status.isInitialized) {
      statusDisplay.textContent = 'MIDI ready - no device selected';
      statusDisplay.style.color = '#FF9800'; // Orange
    } else {
      statusDisplay.textContent = 'MIDI not available';
      statusDisplay.style.color = '#F44336'; // Red
    }
  }
  
  // Update enable checkbox
  const enableCheckbox = document.getElementById('midiEnableCheckbox');
  if (enableCheckbox) {
    enableCheckbox.checked = status.isEnabled;
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
    
    // Update help text to show SysEx status
    const mtsHelp = mtsCheckbox.parentElement.querySelector('.help-text');
    if (mtsHelp) {
      if (status.mtsSysExSupported) {
        mtsHelp.textContent = 'Uses MTS Real-time Single Note Tuning SysEx for precise frequency control (requires MTS-compatible hardware/software like Pianoteq, Kontakt, etc.)';
        mtsHelp.style.color = '#888';
      } else {
        mtsHelp.textContent = 'SysEx not supported by browser/device - MTS mode unavailable (will use pitch bend fallback)';
        mtsHelp.style.color = '#F44336';
      }
    }
  }
  
  // Update debug checkbox (restore saved setting)
  const debugCheckbox = document.getElementById('midiDebugCheckbox');
  if (debugCheckbox) {
    debugCheckbox.checked = status.debug || false;
  }
  
  // Update integration checkbox
  const integrationCheckbox = document.getElementById('midiIntegrationCheckbox');
  if (integrationCheckbox) {
    // Check integration status
    try {
      if (typeof window.getMidiIntegrationStats === 'function') {
        const integrationStats = window.getMidiIntegrationStats();
        integrationCheckbox.checked = integrationStats.isEnabled;
      }
    } catch (error) {
      // Integration not available
      integrationCheckbox.checked = false;
    }
  }
  
  // Update audio mode checkbox and status
  const audioCheckbox = document.getElementById('audioCheckbox');
  if (audioCheckbox) {
    // Only update checkbox if user hasn't explicitly set it
    if (!window._userSetAudioMode) {
      // Check if audio is currently enabled using the simplified audio module
      try {
        import('../audio/audio.js').then(audioModule => {
          const isAudioEnabled = audioModule.isAudioEnabled();
          audioCheckbox.checked = isAudioEnabled;
          updateAudioModeStatus(isAudioEnabled);
        });
      } catch (error) {
        // Fallback to enabled
        audioCheckbox.checked = true;
        updateAudioModeStatus(true);
      }
    } else {
      // User has explicitly set the mode, just update the status display
      updateAudioModeStatus(audioCheckbox.checked);
    }
  }
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