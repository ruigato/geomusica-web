// src/ui/midiToggle.js - Simple MIDI Plugin Status Display

/**
 * Create a simple MIDI status display
 */
export function createMidiToggle() {
  const container = document.createElement('div');
  container.className = 'midi-status-container';
  container.style.cssText = `
    position: fixed;
    top: 60px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    padding: 10px;
    border-radius: 5px;
    color: white;
    font-family: monospace;
    font-size: 12px;
    z-index: 1000;
    border: 1px solid #333;
    min-width: 120px;
  `;

  const title = document.createElement('div');
  title.textContent = 'MIDI Status';
  title.style.cssText = `
    font-weight: bold;
    margin-bottom: 5px;
    color: #fff;
  `;

  const subtitle = document.createElement('div');
  subtitle.textContent = '(Use MIDI tab to control)';
  subtitle.style.cssText = `
    font-size: 10px;
    margin-bottom: 8px;
    color: #aaa;
    font-style: italic;
  `;

  const status = document.createElement('div');
  status.className = 'midi-status';
  status.textContent = 'Not loaded';
  status.style.cssText = `
    color: #888;
    padding: 3px 0;
  `;

  const handlerStatus = document.createElement('div');
  handlerStatus.className = 'midi-handler-status';
  handlerStatus.textContent = 'Handler: Inactive';
  handlerStatus.style.cssText = `
    color: #888;
    font-size: 11px;
    padding: 2px 0;
  `;

  container.appendChild(title);
  container.appendChild(subtitle);
  container.appendChild(status);
  container.appendChild(handlerStatus);

  // Update status periodically
  const updateStatus = async () => {
    try {
      // Check if MIDI plugin is loaded
      if (window.midiPlugin) {
        const pluginStatus = await window.midiPlugin.getStatus();
        
        if (pluginStatus.initialized) {
          status.textContent = 'Plugin loaded';
          status.style.color = '#4CAF50';
          
          if (pluginStatus.enabled) {
            handlerStatus.textContent = 'Handler: Active';
            handlerStatus.style.color = '#4CAF50';
          } else {
            handlerStatus.textContent = 'Handler: Disabled';
            handlerStatus.style.color = '#FF9800';
          }
        } else {
          status.textContent = 'Plugin error';
          status.style.color = '#f44336';
          handlerStatus.textContent = 'Handler: Error';
          handlerStatus.style.color = '#f44336';
        }
      } else {
        status.textContent = 'Not loaded';
        status.style.color = '#888';
        handlerStatus.textContent = 'Handler: Inactive';
        handlerStatus.style.color = '#888';
      }
      
      // Check trigger dispatcher status
      try {
        const { isTriggerHandlerEnabled } = await import('../triggers/triggerDispatcher.js');
        const midiHandlerEnabled = isTriggerHandlerEnabled('midi');
        
        if (midiHandlerEnabled) {
          handlerStatus.textContent = 'Handler: Active';
          handlerStatus.style.color = '#4CAF50';
        } else if (window.midiPlugin) {
          handlerStatus.textContent = 'Handler: Disabled';
          handlerStatus.style.color = '#FF9800';
        }
      } catch (error) {
        // Dispatcher not available
      }
      
    } catch (error) {
      status.textContent = 'Status error';
      status.style.color = '#f44336';
    }
  };

  // Update immediately and then every 2 seconds
  updateStatus();
  const statusInterval = setInterval(updateStatus, 2000);

  return {
    container,
    updateStatus,
    destroy: () => {
      clearInterval(statusInterval);
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    }
  };
}

/**
 * Initialize MIDI status display
 */
export function initializeMidiToggleUI() {
  const statusDisplay = createMidiToggle();
  document.body.appendChild(statusDisplay.container);
  
  console.log('[MIDI STATUS] Status display initialized');
  
  return statusDisplay;
} 