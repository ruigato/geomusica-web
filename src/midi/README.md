# GeoMusica MIDI Output Module

A comprehensive MIDI output system for GeoMusica that provides multi-channel output, microtonal support, and seamless integration with the existing layer system.

## Features

### Core MIDI Output (`midiOut.js`)
- **Multi-channel output**: Each layer (0-14) maps to MIDI channels 1-15, LayerLink uses channel 16
- **Note duration tracking**: Automatic note-off scheduling with precise timing
- **Velocity control**: Full 0-127 velocity range mapping from geomusica's 0-1 range
- **Polyphonic aftertouch**: Microtonal expression through aftertouch messages
- **Pitch bend**: High-precision microtonal accuracy using 14-bit pitch bend
- **Real-time parameter control**: MIDI CC messages for dynamic control
- **Device management**: Automatic device enumeration and connection handling

### Microtonal Support
- **Pitch bend compensation**: Configurable ±1 to ±12 semitone range
- **Polyphonic aftertouch**: Expresses microtonal deviations for compatible synths
- **Equal temperament detection**: Automatically adjusts for temperament mode
- **High precision**: 14-bit pitch bend for accurate microtonal intervals

### Layer Integration
- **Automatic channel mapping**: Layer 0 → Channel 1, Layer 1 → Channel 2, etc.
- **LayerLink support**: Special channel 16 reserved for layer link triggers
- **Independent control**: Each layer can have different MIDI settings
- **Real-time switching**: Dynamic layer changes update MIDI routing

### User Interface (`midiUI.js`)
- **Device selection**: Dropdown list of available MIDI devices
- **Microtonal controls**: Enable/disable microtonal mode and pitch bend range
- **Channel monitoring**: Real-time display of active channels and statistics
- **Debug tools**: MIDI message logging and emergency stop functions
- **Status display**: Connection status and performance metrics

## Usage

### Basic Setup

```javascript
// Quick setup for basic MIDI output
import { quickMidiSetup } from './midi/index.js';

const success = await quickMidiSetup(); // Auto-selects first device
if (success) {
  console.log('MIDI ready!');
}
```

### Complete Integration

```javascript
// Full system integration (done automatically in main.js)
import { initializeCompleteMidiSystem } from './midi/index.js';

const result = await initializeCompleteMidiSystem({
  uiContainer: document.body,
  layerManager: window._layers,
  globalState: window._globalState,
  autoEnable: false
});
```

### Manual Note Triggering

```javascript
import { playMidiNote } from './midi/index.js';

// Play a note on layer 0 (MIDI channel 1)
const note = {
  frequency: 440,    // Hz
  velocity: 0.7,     // 0-1 range
  duration: 1.0,     // seconds
  pan: 0.0          // -1 to 1
};

playMidiNote(note, 0, false); // layerId=0, isLayerLink=false
```

### LayerLink Notes

```javascript
// LayerLink notes automatically use channel 16
const layerLinkNote = {
  frequency: 523.25, // C5
  velocity: 0.8,
  duration: 0.5
};

playMidiNote(layerLinkNote, 0, true); // isLayerLink=true → channel 16
```

## Channel Mapping

| Layer ID | MIDI Channel | Purpose |
|----------|--------------|---------|
| 0        | 1           | Layer 0 output |
| 1        | 2           | Layer 1 output |
| ...      | ...         | ... |
| 14       | 15          | Layer 14 output |
| N/A      | 16          | LayerLink output |

## Microtonal Features

### Pitch Bend Range
- Default: ±2 semitones (±200 cents)
- Configurable: 1-12 semitones
- 14-bit precision: ~0.006 cent resolution

### Aftertouch Expression
- Polyphonic aftertouch based on frequency deviation
- Enhances microtonal expression on compatible synthesizers
- Automatic calculation from equal temperament reference

### Example: Microtonal Note
```javascript
// A note 50 cents sharp of A4
const microtonalNote = {
  frequency: 452.89, // A4 + 50 cents
  velocity: 0.7,
  duration: 1.0
};

// Will automatically:
// 1. Calculate nearest MIDI note (A4 = 69)
// 2. Apply pitch bend for +50 cents
// 3. Send polyphonic aftertouch for expression
playMidiNote(microtonalNote, 0);
```

## Configuration

### Pitch Bend Range
```javascript
import { setMidiPitchBendRange } from './midi/index.js';

setMidiPitchBendRange(4); // ±4 semitones for wider microtonal range
```

### Microtonal Mode
```javascript
import { setMidiMicrotonalMode } from './midi/index.js';

setMidiMicrotonalMode(false); // Disable microtonal features
```

### Debug Mode
```javascript
import { setMidiDebugMode } from './midi/index.js';

setMidiDebugMode(true); // Enable detailed MIDI logging
```

## Integration with GeoMusica

### Automatic Integration
The MIDI system automatically integrates with GeoMusica's trigger system:

1. **Trigger Detection**: Existing trigger system detects note events
2. **Audio Processing**: Notes are processed by the audio system (Csound)
3. **MIDI Routing**: Enhanced trigger callback routes notes to appropriate MIDI channels
4. **Layer Awareness**: Layer ID determines MIDI channel automatically

### Enhanced Audio Callback
```javascript
// The system creates an enhanced callback that handles both audio and MIDI
const enhancedCallback = createEnhancedTriggerAudio(originalAudioCallback);

// This callback:
// 1. Calls original audio system (Csound)
// 2. Routes to appropriate MIDI channel based on layer
// 3. Applies microtonal compensation
// 4. Tracks statistics
```

## API Reference

### Core Functions

#### `initializeCompleteMidiSystem(options)`
Complete MIDI system initialization.

**Parameters:**
- `options.uiContainer` - Container for MIDI UI (default: document.body)
- `options.layerManager` - Layer manager instance
- `options.globalState` - Global state object
- `options.originalAudioCallback` - Original audio callback function
- `options.autoEnable` - Auto-enable MIDI output (default: false)

**Returns:** Promise<Object> - Initialization result

#### `playMidiNote(note, layerId, isLayerLink)`
Play a MIDI note with full microtonal support.

**Parameters:**
- `note` - Note object with frequency, velocity, duration, pan
- `layerId` - Layer ID (0-14) for channel mapping
- `isLayerLink` - Boolean, true for LayerLink (channel 16)

#### `getMidiStatus()`
Get comprehensive MIDI system status.

**Returns:** Object with device info, statistics, and settings

### Utility Functions

#### `testMidiOutput(channel, frequency, duration)`
Test MIDI output on specific channel.

#### `emergencyMidiStop()`
Stop all MIDI notes and disconnect.

#### `getCompleteMidiStatus()`
Get full system status including integration statistics.

## Debugging

### Global Functions
The MIDI system exposes several global functions for debugging:

```javascript
// Test MIDI output
window.testMidi(440, 1); // 440Hz for 1 second on channel 1

// Get system status
window.MIDI.getStatus();

// Emergency stop
window.MIDI.emergencyStop();

// Access managers directly
window.midiOutManager;
window.midiIntegrationManager;
```

### Console Commands
```javascript
// Enable debug logging
setMidiDebugMode(true);

// Check integration statistics
getMidiIntegrationStats();

// Monitor active notes
getMidiStatus().activeNotes;
```

## Troubleshooting

### Common Issues

1. **No MIDI devices found**
   - Check browser MIDI support (Chrome/Edge recommended)
   - Ensure MIDI device is connected and powered on
   - Try refreshing device list

2. **Notes not playing**
   - Verify MIDI device is selected and connected
   - Check if microtonal mode is causing issues with your synth
   - Ensure layer is active and generating triggers

3. **Microtonal accuracy issues**
   - Increase pitch bend range if needed
   - Verify your synthesizer supports pitch bend
   - Check if equal temperament mode is enabled

4. **Performance issues**
   - Reduce number of active layers
   - Disable debug mode
   - Check for MIDI device latency

### Browser Compatibility
- **Chrome/Chromium**: Full support
- **Edge**: Full support  
- **Firefox**: Limited support (requires flag)
- **Safari**: No support

## Technical Details

### MIDI Message Types Used
- **Note On/Off** (0x90/0x80): Basic note triggering
- **Pitch Bend** (0xE0): Microtonal accuracy
- **Polyphonic Aftertouch** (0xA0): Microtonal expression
- **Control Change** (0xB0): Parameter control and setup
- **RPN** (Registered Parameter Numbers): Pitch bend range setup

### Timing Precision
- Uses Web Audio timing for sub-millisecond accuracy
- Automatic compensation for MIDI device latency
- Subframe trigger detection for high BPM accuracy

### Memory Management
- Automatic cleanup of expired notes
- LRU cache for device management
- Efficient note tracking with Map structures 