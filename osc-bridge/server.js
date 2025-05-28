// osc-bridge/server.js - WebSocket to OSC bridge server
// Handles OSC IN/OUT communication for GeoMusica web application

const WebSocket = require('ws');
const osc = require('osc');

// Configuration
const CONFIG = {
  // WebSocket ports (for browser communication)
  WS_OSC_IN_PORT: 8080,    // Browser connects here to receive OSC
  WS_OSC_OUT_PORT: 8081,   // Browser connects here to send OSC
  
  // OSC ports (for external OSC applications)
  OSC_IN_PORT: 13245,      // Receive OSC from external apps
  OSC_OUT_PORT: 53421,     // Send OSC to external apps
  OSC_HOST: 'localhost'
};

console.log('[OSC BRIDGE] Starting OSC WebSocket Bridge Server...');
console.log('[OSC BRIDGE] Configuration:', CONFIG);

// Create OSC UDP port for receiving OSC messages
const oscUDPPort = new osc.UDPPort({
  localAddress: CONFIG.OSC_HOST,
  localPort: CONFIG.OSC_IN_PORT,
  metadata: true
});

// Create WebSocket servers
const wsOscInServer = new WebSocket.Server({ port: CONFIG.WS_OSC_IN_PORT });
const wsOscOutServer = new WebSocket.Server({ port: CONFIG.WS_OSC_OUT_PORT });

// Track connected clients
const oscInClients = new Set();
const oscOutClients = new Set();

// Statistics
const stats = {
  oscMessagesReceived: 0,
  oscMessagesSent: 0,
  wsMessagesReceived: 0,
  wsMessagesSent: 0,
  connectedClients: 0,
  startTime: Date.now()
};

// OSC IN WebSocket Server (sends OSC messages to browser)
wsOscInServer.on('connection', (ws) => {
  console.log('[OSC IN WS] Browser connected for OSC IN');
  oscInClients.add(ws);
  updateClientCount();
  
  ws.on('close', () => {
    console.log('[OSC IN WS] Browser disconnected from OSC IN');
    oscInClients.delete(ws);
    updateClientCount();
  });
  
  ws.on('error', (error) => {
    console.error('[OSC IN WS] WebSocket error:', error);
    oscInClients.delete(ws);
    updateClientCount();
  });
});

// OSC OUT WebSocket Server (receives OSC messages from browser)
wsOscOutServer.on('connection', (ws) => {
  console.log('[OSC OUT WS] Browser connected for OSC OUT');
  oscOutClients.add(ws);
  updateClientCount();
  
  ws.on('message', (message) => {
    try {
      const messageStr = message.toString();
      console.log('[OSC OUT WS] Received from browser:', messageStr);
      
      // Parse and forward to OSC
      forwardToOSC(messageStr);
      stats.wsMessagesReceived++;
      
    } catch (error) {
      console.error('[OSC OUT WS] Error processing message:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('[OSC OUT WS] Browser disconnected from OSC OUT');
    oscOutClients.delete(ws);
    updateClientCount();
  });
  
  ws.on('error', (error) => {
    console.error('[OSC OUT WS] WebSocket error:', error);
    oscOutClients.delete(ws);
    updateClientCount();
  });
});

// OSC UDP Port event handlers
oscUDPPort.on('ready', () => {
  console.log('[OSC UDP] OSC UDP port ready on', CONFIG.OSC_HOST + ':' + CONFIG.OSC_IN_PORT);
});

oscUDPPort.on('message', (oscMessage, timeTag, info) => {
  try {
    console.log('[OSC UDP] Received OSC message:', oscMessage);
    
    // Convert OSC message to string format for WebSocket
    const messageStr = formatOSCMessage(oscMessage);
    
    // Forward to all connected browser clients
    forwardToBrowser(messageStr);
    stats.oscMessagesReceived++;
    
  } catch (error) {
    console.error('[OSC UDP] Error processing OSC message:', error);
  }
});

oscUDPPort.on('error', (error) => {
  console.error('[OSC UDP] OSC UDP port error:', error);
});

// Start OSC UDP port
oscUDPPort.open();

/**
 * Format OSC message for WebSocket transmission
 * @param {Object} oscMessage - OSC message object
 * @returns {string} Formatted message string
 */
function formatOSCMessage(oscMessage) {
  const address = oscMessage.address;
  const args = oscMessage.args || [];
  
  // Convert arguments to string values
  const values = args.map(arg => {
    if (typeof arg === 'object' && arg.value !== undefined) {
      return arg.value;
    }
    return arg;
  });
  
  // Format as "address value1 value2 ..."
  return `${address} ${values.join(' ')}`;
}

/**
 * Forward message to browser clients
 * @param {string} message - Message to forward
 */
function forwardToBrowser(message) {
  oscInClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
        stats.wsMessagesSent++;
      } catch (error) {
        console.error('[OSC BRIDGE] Error sending to browser:', error);
        oscInClients.delete(client);
      }
    }
  });
  
  console.log(`[OSC BRIDGE] Forwarded to ${oscInClients.size} browser clients: ${message}`);
}

/**
 * Forward message from browser to OSC
 * @param {string} message - Message from browser
 */
function forwardToOSC(message) {
  try {
    // Parse message format: "/address value1 value2 ..."
    const parts = message.trim().split(' ');
    if (parts.length < 1) {
      console.warn('[OSC BRIDGE] Invalid message format:', message);
      return;
    }
    
    const address = parts[0];
    const args = parts.slice(1);
    
    // Convert arguments to appropriate types with explicit OSC type information
    const oscArgs = args.map(arg => {
      // Try to parse as number first
      const num = parseFloat(arg);
      if (!isNaN(num)) {
        // Check if it's an integer or float
        if (Number.isInteger(num)) {
          return { type: 'i', value: Math.floor(num) }; // Integer
        } else {
          return { type: 'f', value: num }; // Float
        }
      }
      
      // Check for boolean values
      if (arg === 'true') {
        return { type: 'T', value: true }; // True
      }
      if (arg === 'false') {
        return { type: 'F', value: false }; // False
      }
      
      // Return as string
      return { type: 's', value: arg }; // String
    });
    
    // Create OSC message with proper structure
    const oscMessage = {
      address: address,
      args: oscArgs
    };
    
    // Send via UDP to external OSC applications
    oscUDPPort.send(oscMessage, CONFIG.OSC_HOST, CONFIG.OSC_OUT_PORT);
    
    console.log(`[OSC BRIDGE] Sent OSC message to ${CONFIG.OSC_HOST}:${CONFIG.OSC_OUT_PORT}:`, oscMessage);
    stats.oscMessagesSent++;
    
  } catch (error) {
    console.error('[OSC BRIDGE] Error forwarding to OSC:', error);
  }
}

/**
 * Update connected client count
 */
function updateClientCount() {
  stats.connectedClients = oscInClients.size + oscOutClients.size;
  console.log(`[OSC BRIDGE] Connected clients: ${oscInClients.size} OSC IN, ${oscOutClients.size} OSC OUT`);
}

/**
 * Print statistics
 */
function printStats() {
  const uptime = Math.floor((Date.now() - stats.startTime) / 1000);
  console.log('\n[OSC BRIDGE] === STATISTICS ===');
  console.log(`[OSC BRIDGE] Uptime: ${uptime} seconds`);
  console.log(`[OSC BRIDGE] Connected clients: ${stats.connectedClients}`);
  console.log(`[OSC BRIDGE] OSC messages received: ${stats.oscMessagesReceived}`);
  console.log(`[OSC BRIDGE] OSC messages sent: ${stats.oscMessagesSent}`);
  console.log(`[OSC BRIDGE] WebSocket messages received: ${stats.wsMessagesReceived}`);
  console.log(`[OSC BRIDGE] WebSocket messages sent: ${stats.wsMessagesSent}`);
  console.log('[OSC BRIDGE] ==================\n');
}

// Print stats every 30 seconds
setInterval(printStats, 30000);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n[OSC BRIDGE] Shutting down gracefully...');
  
  // Close WebSocket servers
  wsOscInServer.close();
  wsOscOutServer.close();
  
  // Close OSC port
  oscUDPPort.close();
  
  // Print final stats
  printStats();
  
  process.exit(0);
});

console.log('[OSC BRIDGE] OSC WebSocket Bridge Server started successfully!');
console.log('[OSC BRIDGE] WebSocket OSC IN port:', CONFIG.WS_OSC_IN_PORT);
console.log('[OSC BRIDGE] WebSocket OSC OUT port:', CONFIG.WS_OSC_OUT_PORT);
console.log('[OSC BRIDGE] OSC IN UDP port:', CONFIG.OSC_IN_PORT);
console.log('[OSC BRIDGE] OSC OUT UDP port:', CONFIG.OSC_OUT_PORT);
console.log('[OSC BRIDGE] Ready to bridge OSC and WebSocket communications!'); 