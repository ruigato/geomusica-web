# GeoMusica OSC Integration

This document describes the OSC (Open Sound Control) integration for GeoMusica, which allows real-time parameter automation and control via OSC messages.

## Overview

The OSC integration provides:
- **OSC IN**: Receive parameter automation from external applications
- **OSC OUT**: Send parameter changes when manually adjusting controls
- **Smart interaction**: OSC IN is automatically disabled while touching a parameter (mousedown period)
- **Layer-aware**: Parameters can be controlled per layer or globally

## Architecture

The OSC system consists of three main components:

1. **OSC Manager** (`src/osc/oscManager.js`): Handles OSC message parsing and parameter application
2. **OSC UI Integration** (`src/osc/oscUIIntegration.js`): Patches UI controls for mousedown/mouseup detection
3. **OSC Bridge Server** (`osc-bridge/server.js`): Node.js WebSocket-to-OSC bridge

## Setup

### 1. Install Bridge Server Dependencies

```bash
cd osc-bridge
npm install
```

### 2. Start the Bridge Server

```bash
cd osc-bridge
npm start
```

The bridge server will start with the following configuration:
- **WebSocket OSC IN**: `localhost:8080` (browser receives OSC here)
- **WebSocket OSC OUT**: `localhost:8081` (browser sends OSC here)
- **OSC IN UDP**: `localhost:13245` (external apps send OSC here)
- **OSC OUT UDP**: `localhost:53421` (external apps receive OSC here)

### 3. Configure Your OSC Application

Configure your OSC application (TouchOSC, OSCPilot, Max/MSP, etc.) to:
- **Send OSC to**: `localhost:13245`
- **Receive OSC from**: `localhost:53421`

## OSC Address Format

### Layer Parameters

Format: `/G{layerId}/{parameterName} {value}`

Examples:
- `/G01/Radius 200` - Set layer 1 radius to 200
- `/G02/Copies 5` - Set layer 2 copies to 5
- `/G03/UseFractal true` - Enable fractal on layer 3

### Global Parameters

Format: `/Global/{parameterName} {value}`

Examples:
- `/Global/BPM 140` - Set global BPM to 140
- `/Global/Volume 0.8` - Set global volume to 0.8
- `/Global/Attack 0.05` - Set attack time to 0.05 seconds

## Supported Parameters

### Layer Parameters (per layer)

#### Shape Parameters
- `Radius` (20-2048)
- `Copies` (0-32)
- `Segments` (2-32) - This is the "Number" parameter in the UI
- `StepScale` (0.01-10)
- `Angle` (-180-180)
- `StartingAngle` (0-360)
- `LerpTime` (0.1-5.0)

#### Modulation Parameters
- `AltScale` (0.1-10)
- `AltStepN` (1-32)
- `UseAltScale` (true/false)
- `FractalValue` (1-9)
- `UseFractal` (true/false)
- `EuclidValue` (1-12)
- `UseEuclid` (true/false)
- `UseStars` (true/false)
- `UseCuts` (true/false)
- `UseTesselation` (true/false)

#### Note Parameters
- `MinDuration` (0.01-1.0)
- `MaxDuration` (0.01-2.0)
- `DurationPhase` (0-1)
- `MinVelocity` (0.1-0.9)
- `MaxVelocity` (0.2-1.0)
- `VelocityPhase` (0-1)
- `DurationMode` ("modulo"/"random"/"interpolation")
- `VelocityMode` ("modulo"/"random"/"interpolation")

#### Other Parameters
- `UseDelete` (true/false)
- `DeleteMin` (1-32)
- `DeleteMax` (1-32)
- `DeleteSeed` (0-999)
- `DeleteMode` ("pattern"/"random")
- `DeleteTarget` ("points"/"primitives")
- `UseLerp` (true/false)
- `UseQuantization` (true/false)
- `UsePlainIntersections` (true/false)
- `ShowAxisFreqLabels` (true/false)
- `ShowPointsFreqLabels` (true/false)

### Global Parameters

#### Timing
- `BPM` (20-300)

#### Synthesis
- `Attack` (0.001-2.0)
- `Decay` (0.01-3.0)
- `Sustain` (0.0-1.0)
- `Release` (0.01-10.0)
- `Brightness` (0.0-2.0)
- `Volume` (0.0-1.0)

#### Tuning
- `UseEqualTemperament` (true/false)
- `ReferenceFreq` (220-880)

## Usage Examples

### TouchOSC Configuration

Create controls in TouchOSC with these addresses:

```
/G01/Radius        - Fader (20-2048)
/G01/Copies        - Fader (0-32)
/G01/Segments      - Fader (2-32)
/G01/UseFractal    - Toggle (0/1)
/G02/Radius        - Fader (20-2048)
/Global/BPM        - Fader (20-300)
/Global/Volume     - Fader (0-1)
```

### Max/MSP Example

```max
[slider] -> [scale 20 2048] -> [prepend /G01/Radius] -> [udpsend localhost 13245]
[toggle] -> [prepend /G01/UseFractal] -> [udpsend localhost 13245]
[number] -> [prepend /Global/BPM] -> [udpsend localhost 13245]
```

### Pure Data Example

```pd
[hslider] -> [* 2028] -> [+ 20] -> [prepend /G01/Radius] -> [netsend -u -b localhost 13245]
[tgl] -> [prepend /G01/UseFractal] -> [netsend -u -b localhost 13245]
```

## Behavior

### OSC IN (Automation)
- Parameters are updated in real-time from OSC messages
- UI controls reflect the changes automatically
- OSC IN is **disabled** for a parameter while it's being touched (mousedown to mouseup)
- Invalid values are ignored with warnings in the console

### OSC OUT (Feedback)
- Parameter changes are sent via OSC OUT when manually adjusting controls
- Only sent during active interaction (mousedown to mouseup)
- Duplicate values are filtered to avoid spam
- Layer-specific parameters include the layer ID in the address

### Layer Management
- Layer IDs in OSC addresses are 1-based (G01, G02, G03...)
- Internal layer IDs are 0-based (converted automatically)
- Parameters apply to the specified layer regardless of which layer is currently active
- Global parameters affect all layers

## Debugging

### Browser Console

Check OSC status:
```javascript
debugOSC()           // Show OSC connection status
debugOSCUI()         // Show UI integration status
getOSCStatus()       // Get detailed status
```

Test OSC messages:
```javascript
testOSC('/G01/Radius 300')        // Test a layer parameter
testOSC('/Global/BPM 150')        // Test a global parameter
```

### Bridge Server Console

The bridge server logs all OSC traffic:
- Incoming OSC messages from external applications
- Outgoing OSC messages to external applications
- WebSocket connections from browser
- Message forwarding statistics

### Common Issues

1. **"OSC connections failed"**: Bridge server is not running
   - Solution: Start the bridge server with `npm start` in the `osc-bridge` directory

2. **Parameters not updating**: Check OSC address format
   - Layer parameters: `/G01/Radius 200` (not `/G1/Radius 200`)
   - Global parameters: `/Global/BPM 140` (not `/global/BPM 140`)

3. **OSC OUT not working**: Check if parameter is recognized
   - Use `debugOSCUI()` to see which UI elements are patched
   - Check browser console for parameter mapping warnings

4. **Values out of range**: Parameters have specific ranges
   - Check the parameter ranges in the "Supported Parameters" section
   - Invalid values are ignored with console warnings

## Advanced Configuration

### Custom Ports

Edit `osc-bridge/server.js` to change ports:

```javascript
const CONFIG = {
  WS_OSC_IN_PORT: 8080,    // Browser WebSocket IN
  WS_OSC_OUT_PORT: 8081,   // Browser WebSocket OUT
  OSC_IN_PORT: 13245,      // External OSC IN
  OSC_OUT_PORT: 53421,     // External OSC OUT
  OSC_HOST: 'localhost'
};
```

### Network Configuration

To use OSC over network:
1. Change `OSC_HOST` in the bridge server configuration
2. Update firewall settings to allow UDP traffic on OSC ports
3. Configure your OSC application to use the correct IP address

## Integration with Other Systems

### MIDI + OSC
The OSC system works alongside the existing MIDI integration. You can use both simultaneously for maximum control flexibility.

### Automation Recording
Consider using OSC recording software to capture and replay automation sequences:
- **OSCSeq** (macOS/Windows)
- **OSC/PILOT** (iOS/Android)
- **TouchOSC Bridge** with recording features

### DAW Integration
Many DAWs support OSC:
- **Reaper**: Built-in OSC support
- **Logic Pro**: Via OSC plugins
- **Ableton Live**: Via Max for Live devices
- **Bitwig Studio**: Built-in OSC support

This allows you to automate GeoMusica parameters directly from your DAW timeline. 