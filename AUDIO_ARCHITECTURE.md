# GeoMusica Audio Architecture

## Overview

The GeoMusica audio system uses a **trigger dispatcher architecture** that cleanly separates trigger detection from trigger handling. This allows for modular, independent audio and MIDI systems.

## Architecture Flow

```
Trigger Detection → Trigger Dispatcher → Multiple Handlers
     (triggers.js)    (triggerDispatcher.js)   (audio, MIDI, etc.)
```

## Core Components

### 1. Trigger Detection System (`src/triggers/triggers.js`)
- **Purpose**: Detects when geometric elements cross axes
- **Output**: Calls `dispatchTrigger(note)` with trigger data
- **Features**: Subframe precision, quantization, layer links

### 2. Trigger Dispatcher (`src/triggers/triggerDispatcher.js`)
- **Purpose**: Routes triggers to multiple independent handlers
- **Features**: 
  - Handler registration/unregistration
  - Priority-based dispatch
  - Enable/disable individual handlers
  - Error isolation between handlers

### 3. Audio Handler (`src/audio/audioCore.js`)
- **Purpose**: Plays audio using Csound
- **Registration**: Registers as 'audio' handler with priority 10
- **Independence**: Works completely independently of MIDI

### 4. MIDI Handler (`src/midi/midiPlugin.js`)
- **Purpose**: Sends MIDI output
- **Registration**: Registers as 'midi' handler with priority 5
- **Independence**: Works completely independently of audio

## Key Functions

### Trigger Dispatcher
```javascript
// Register a handler
registerTriggerHandler('audio', handleAudioTrigger, { 
  enabled: true, 
  priority: 10 
});

// Dispatch to all enabled handlers
dispatchTrigger(note);

// Enable/disable specific handlers
setTriggerHandlerEnabled('audio', false);
setTriggerHandlerEnabled('midi', true);
```

### Audio System
```javascript
// Setup audio (registers as trigger handler)
setupAudio(options);

// Enable/disable audio processing
setAudioEnabled(false); // MIDI still works!
```

### MIDI System
```javascript
// Initialize MIDI plugin (registers as trigger handler)
initializeMidiPlugin({ autoEnable: true });

// Enable/disable MIDI independently
midiPlugin.enable();
midiPlugin.disable();
```

## Benefits of New Architecture

### 1. **True Independence**
- Audio can be disabled while MIDI continues working
- MIDI can be disabled while audio continues working
- Each system has its own enable/disable state

### 2. **Clean Separation**
- No coupling between audio and MIDI systems
- Easy to add new trigger handlers (OSC, WebSocket, etc.)
- Clear data flow: triggers → dispatcher → handlers

### 3. **Modular Loading**
- MIDI is completely optional
- Audio system works without MIDI dependencies
- Plugins can be loaded/unloaded dynamically

### 4. **Error Isolation**
- If one handler fails, others continue working
- Each handler has its own error handling
- System remains stable if plugins crash

## Usage Examples

### Audio-Only Mode
```javascript
// Only audio system active
setTriggerHandlerEnabled('audio', true);
setTriggerHandlerEnabled('midi', false);
```

### MIDI-Only Mode
```javascript
// Only MIDI system active
setTriggerHandlerEnabled('audio', false);
setTriggerHandlerEnabled('midi', true);
```

### Both Systems Active
```javascript
// Both systems working independently
setTriggerHandlerEnabled('audio', true);
setTriggerHandlerEnabled('midi', true);
```

### Adding Custom Handlers
```javascript
// Register custom trigger handler
registerTriggerHandler('osc', (note) => {
  // Send OSC message
  sendOSC('/trigger', note.frequency, note.velocity);
}, { priority: 1 });
```

## Migration Notes

- **Old**: `triggerAudio(note)` → audio system → MIDI plugin
- **New**: `dispatchTrigger(note)` → multiple independent handlers
- **Backward Compatibility**: `triggerAudio()` still works as legacy wrapper
- **MIDI Independence**: MIDI no longer depends on audio system state

## Implementation Details

### File Structure
```
src/
├── triggers/
│   ├── triggers.js           # Trigger detection
│   └── triggerDispatcher.js  # Central dispatcher
├── audio/
│   ├── audioCore.js          # Audio handler
│   └── audio.js              # Backward compatibility
└── midi/
    └── midiPlugin.js         # MIDI handler
```

### Initialization Order
1. Audio system initializes and registers 'audio' handler
2. MIDI plugin (if requested) initializes and registers 'midi' handler  
3. Trigger detection system calls `dispatchTrigger()` for each trigger
4. Dispatcher routes to all enabled handlers independently

## Future Extensions

The trigger dispatcher can support additional handlers:
- OSC output handler
- WebSocket handler  
- Audio recording handler
- Custom synthesis handlers

Each handler registers independently and receives triggers automatically. 