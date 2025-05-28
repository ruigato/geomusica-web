// src/midi/midiUI.js - MIDI UI Controls for GeoMusica
// Provides user interface for MIDI output configuration and monitoring

import { 
  initializeMidiOut, 
  getMidiDevices, 
  selectMidiDevice, 
  getMidiStatus,
  setMidiMicrotonalMode,
  setMidiPitchBendRange,
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
  console.log('[MIDI UI] Setting up MIDI UI...');
  
  // Create MIDI tab container
  const midiTab = document.createElement('div');
  midiTab.id = 'midi-tab';
  midiTab.className = 'tab-content';
  midiTab.style.display = 'none';
  
  console.log('[MIDI UI] Created MIDI tab element:', midiTab);
  
  // MIDI Enable/Disable Section
  const enableSection = createMidiEnableSection();
  midiTab.appendChild(enableSection);
  
  // Device Selection Section
  const deviceSection = createDeviceSelectionSection();
  midiTab.appendChild(deviceSection);
  
  // Microtonal Settings Section
  const microtonalSection = createMicrotonalSection();
  midiTab.appendChild(microtonalSection);
  
  // Channel Monitoring Section
  const monitoringSection = createChannelMonitoringSection();
  midiTab.appendChild(monitoringSection);
  
  // Debug and Status Section
  const debugSection = createDebugSection();
  midiTab.appendChild(debugSection);
  
  // Add to the header-tabs container where other tabs are located
  const headerTabsContainer = document.getElementById('header-tabs');
  if (headerTabsContainer) {
    console.log('[MIDI UI] Found header-tabs container, adding MIDI tab');
    headerTabsContainer.appendChild(midiTab);
  } else {
    // Fallback to parent container if header-tabs not found
    console.warn('[MIDI UI] header-tabs container not found, using fallback');
    parentContainer.appendChild(midiTab);
  }
  
  // Add MIDI tab button to existing tab system
  console.log('[MIDI UI] Adding MIDI tab button...');
  addMidiTabButton();
  
  // Initialize MIDI system
  initializeMidiSystem();
  
  // Setup periodic status updates
  setupStatusUpdates();
  
  console.log('[MIDI UI] MIDI UI setup complete');
  
  return {
    midiTab,
    enableSection,
    deviceSection,
    microtonalSection,
    monitoringSection,
    debugSection
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
  modeHelp.textContent = 'Uses pitch bend and aftertouch for microtonal accuracy';
  modeContainer.appendChild(modeHelp);
  
  section.appendChild(modeContainer);
  
  // Pitch bend range
  const bendContainer = document.createElement('div');
  bendContainer.className = 'control';
  
  const bendLabel = document.createElement('label');
  bendLabel.textContent = 'Pitch Bend Range:';
  bendLabel.setAttribute('for', 'midiPitchBendRange');
  bendContainer.appendChild(bendLabel);
  
  const bendRange = document.createElement('input');
  bendRange.type = 'range';
  bendRange.id = 'midiPitchBendRange';
  bendRange.min = '1';
  bendRange.max = '12';
  bendRange.value = '2';
  bendRange.addEventListener('input', handlePitchBendRangeChange);
  bendContainer.appendChild(bendRange);
  
  const bendValue = document.createElement('span');
  bendValue.id = 'midiPitchBendValue';
  bendValue.textContent = '±2 semitones';
  bendContainer.appendChild(bendValue);
  
  const bendHelp = document.createElement('div');
  bendHelp.className = 'help-text';
  bendHelp.textContent = 'Range for pitch bend microtonal compensation';
  bendContainer.appendChild(bendHelp);
  
  section.appendChild(bendContainer);
  
  return section;
}

/**
 * Create channel monitoring section
 */
function createChannelMonitoringSection() {
  const section = document.createElement('div');
  section.className = 'control-section';
  
  const title = document.createElement('h3');
  title.textContent = 'Channel Monitoring';
  section.appendChild(title);
  
  // Channel mapping info
  const mappingInfo = document.createElement('div');
  mappingInfo.className = 'control';
  mappingInfo.innerHTML = `
    <div class="help-text">
      <strong>Channel Mapping:</strong><br>
      • Layers 0-14 → MIDI Channels 1-15<br>
      • LayerLink → MIDI Channel 16<br>
      • Each layer outputs to its own channel for independent control
    </div>
  `;
  section.appendChild(mappingInfo);
  
  // Active channels display
  const channelsContainer = document.createElement('div');
  channelsContainer.className = 'control';
  
  const channelsLabel = document.createElement('label');
  channelsLabel.textContent = 'Active Channels:';
  channelsContainer.appendChild(channelsLabel);
  
  const channelsDisplay = document.createElement('div');
  channelsDisplay.id = 'midiActiveChannels';
  channelsDisplay.className = 'channels-display';
  channelsContainer.appendChild(channelsDisplay);
  
  section.appendChild(channelsContainer);
  
  // Statistics display
  const statsContainer = document.createElement('div');
  statsContainer.className = 'control';
  
  const statsLabel = document.createElement('label');
  statsLabel.textContent = 'Statistics:';
  statsContainer.appendChild(statsLabel);
  
  const statsDisplay = document.createElement('div');
  statsDisplay.id = 'midiStatsDisplay';
  statsDisplay.className = 'stats-display';
  statsContainer.appendChild(statsDisplay);
  
  section.appendChild(statsContainer);
  
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
    console.log('[MIDI UI] All notes stopped');
  });
  buttonsContainer.appendChild(stopAllButton);
  
  const disconnectButton = document.createElement('button');
  disconnectButton.textContent = 'Disconnect';
  disconnectButton.addEventListener('click', () => {
    disconnectMidi();
    updateMidiStatus();
    console.log('[MIDI UI] MIDI disconnected');
  });
  buttonsContainer.appendChild(disconnectButton);
  
  section.appendChild(buttonsContainer);
  
  return section;
}

/**
 * Add MIDI tab button to existing tab system
 */
function addMidiTabButton() {
  console.log('[MIDI UI] Looking for tab buttons container...');
  const tabContainer = document.querySelector('.tab-buttons-container');
  if (!tabContainer) {
    console.warn('[MIDI UI] Tab buttons container not found');
    return;
  }
  
  console.log('[MIDI UI] Found tab buttons container:', tabContainer);
  
  const midiTabButton = document.createElement('button');
  midiTabButton.className = 'tab-button';
  midiTabButton.setAttribute('data-tab', 'midi');
  midiTabButton.textContent = 'MIDI';
  
  console.log('[MIDI UI] Created MIDI tab button:', midiTabButton);
  
  tabContainer.appendChild(midiTabButton);
  console.log('[MIDI UI] MIDI tab button added to container');
  
  // Re-initialize the tab system to include the new MIDI tab
  // This ensures the existing tab system handles the MIDI tab properly
  try {
    // Import and call setupHeaderTabs to re-attach event listeners
    import('../ui/headerTabs.js').then(module => {
      if (module.setupHeaderTabs) {
        module.setupHeaderTabs();
        console.log('[MIDI UI] Tab system re-initialized to include MIDI tab');
      }
    }).catch(error => {
      console.warn('[MIDI UI] Could not re-initialize tab system:', error);
    });
  } catch (error) {
    console.warn('[MIDI UI] Error re-initializing tab system:', error);
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
      console.log('[MIDI UI] MIDI integration enabled');
    } else {
      const { disableMidiIntegration } = await import('./index.js');
      await disableMidiIntegration();
      console.log('[MIDI UI] MIDI integration disabled');
    }
  } catch (error) {
    console.error('[MIDI UI] Error toggling MIDI integration:', error);
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
 * Handle pitch bend range change
 */
function handlePitchBendRangeChange(event) {
  const range = parseInt(event.target.value);
  setMidiPitchBendRange(range);
  
  const valueDisplay = document.getElementById('midiPitchBendValue');
  if (valueDisplay) {
    valueDisplay.textContent = `±${range} semitones`;
  }
}

/**
 * Handle debug mode change
 */
function handleDebugModeChange(event) {
  const enabled = event.target.checked;
  setMidiDebugMode(enabled);
}

/**
 * Refresh MIDI devices list
 */
function refreshMidiDevices() {
  const deviceSelect = document.getElementById('midiDeviceSelect');
  if (!deviceSelect) return;
  
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
    deviceSelect.appendChild(option);
  });
  
  console.log(`[MIDI UI] Found ${devices.length} MIDI devices`);
}

/**
 * Update MIDI status display
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
  
  // Update active channels display
  const channelsDisplay = document.getElementById('midiActiveChannels');
  if (channelsDisplay) {
    if (status.stats.channelsUsed.length > 0) {
      channelsDisplay.textContent = `Channels: ${status.stats.channelsUsed.join(', ')}`;
    } else {
      channelsDisplay.textContent = 'No active channels';
    }
  }
  
  // Update statistics display
  const statsDisplay = document.getElementById('midiStatsDisplay');
  if (statsDisplay) {
    statsDisplay.innerHTML = `
      Notes Played: ${status.stats.notesPlayed}<br>
      Notes Stopped: ${status.stats.notesStopped}<br>
      Active Notes: ${status.activeNotes}<br>
      Errors: ${status.stats.errors}
    `;
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
    
    .channels-display {
      font-family: monospace;
      background: #333333;
      padding: 8px;
      border-radius: 4px;
      margin-top: 4px;
      border: 1px solid #555;
    }
    
    .stats-display {
      font-family: monospace;
      background: #333333;
      padding: 8px;
      border-radius: 4px;
      margin-top: 4px;
      font-size: 12px;
      border: 1px solid #555;
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