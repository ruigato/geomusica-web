; GeoMusica.orc - Csound Orchestra for GeoMusica
; This orchestra file contains the instruments used for GeoMusica
; to be loaded via Csound WebAudio integration

sr = 44100
ksmps = 128
nchnls = 2
0dbfs = 1

; Global variables for real-time control
gkFreq chnexport "frequency", 1
giAmp chnexport "amplitude", 1

; Global parameters
giFadeTime = 0.05    ; Fade in/out time in seconds
giBasePitch = 440    ; Base pitch for A4
giDecayMin = 0.2     ; Minimum decay time
giDecayMax = 1.5     ; Maximum decay time

; Function tables for waveforms
; Table 1: Sine wave
giSine     ftgen 1, 0, 8192, 10, 1  
; Table 2: Triangle wave
giTriangle ftgen 2, 0, 8192, 10, 1, 0, 0.333, 0, 0.2, 0, 0.143, 0, 0.111
; Table 3: Square wave with rounded corners
giSquare   ftgen 3, 0, 8192, 10, 1, 0.5, 0.333, 0.25, 0.2, 0.167, 0.143, 0.125, 0.111
; Table 4: Sawtooth wave
giSawtooth ftgen 4, 0, 8192, 10, 1, 0.5, 0.333, 0.25, 0.2, 0.167, 0.143, 0.125, 0.111, 0.1, 0.091

; Function tables for envelopes
; Table 10: Basic ADSR envelope
giEnv1     ftgen 10, 0, 1024, 7, 0, 102, 1, 409, 0.7, 409, 0.5, 102, 0
; Table 11: Percussive envelope
giEnv2     ftgen 11, 0, 1024, 7, 0, 10, 1, 300, 0.6, 713, 0

; ================================================================
; Instrument 1: Simple Oscillator
; A basic sine oscillator with envelope
; p4 = frequency
; p5 = amplitude
; ================================================================
instr 1
  ; Get parameters from score
  ifreq = p4
  iamp = p5
  
  ; Calculate a decay time based on frequency (lower frequencies decay slower)
  idecay = limit(3 / (ifreq / 100), giDecayMin, giDecayMax)
  
  ; Create amplitude envelope
  aenv linseg 0, giFadeTime, iamp, idecay, 0
  
  ; Create oscillator
  a1 oscil aenv, ifreq, giSine
  
  ; Equal power panning based on frequency
  ipan = 0.5 + 0.2 * sin(ifreq/1000)
  ipan = limit(ipan, 0.1, 0.9)  ; Limit the panning range
  
  ; Apply panning
  aL = a1 * sqrt(1 - ipan)
  aR = a1 * sqrt(ipan)
  
  ; Output
  outs aL, aR
endin

; ================================================================
; Instrument 2: FM Oscillator with Modulation
; A frequency modulation instrument
; p4 = carrier frequency
; p5 = amplitude
; p6 = modulation index (defaults to 5 if not specified)
; p7 = modulator ratio (defaults to 2 if not specified)
; ================================================================
instr 2
  ; Get parameters from score
  ifreq = p4
  iamp = p5
  ; Default values
  imindex = (p6 == 0 ? 5 : p6)
  imodratio = (p7 == 0 ? 2 : p7)
  
  ; Calculate modulator frequency
  imodfreq = ifreq * imodratio
  
  ; Envelope for carrier
  aenv linseg 0, giFadeTime, iamp, p3 - (2 * giFadeTime), iamp, giFadeTime, 0
  
  ; Envelope for modulation index
  amodenv linseg 0, p3 * 0.3, imindex, p3 * 0.7, imindex * 0.3
  
  ; FM synthesis
  amod oscili amodenv * ifreq, imodfreq, giSine
  acar oscili aenv, ifreq + amod, giSine
  
  ; Apply slight stereo width
  ipan = 0.5 + 0.1 * sin(ifreq/800)
  aL = acar * sqrt(1 - ipan)
  aR = acar * sqrt(ipan)
  
  ; Output
  outs aL, aR
endin

; ================================================================
; Instrument 3: Additive Synthesis Instrument
; Creates a rich harmonic sound using multiple oscillators
; p4 = fundamental frequency
; p5 = amplitude
; ================================================================
instr 3
  ; Get parameters from score
  ifreq = p4
  iamp = p5
  
  ; Base envelope
  aenv linseg 0, 0.02, iamp, p3 - 0.12, iamp * 0.6, 0.1, 0
  
  ; Create 5 partials with different harmonics and waveforms
  a1 oscili aenv * 0.4, ifreq, giSine
  a2 oscili aenv * 0.3, ifreq * 2, giSine
  a3 oscili aenv * 0.2, ifreq * 3, giTriangle
  a4 oscili aenv * 0.1, ifreq * 4, giTriangle
  a5 oscili aenv * 0.05, ifreq * 5.02, giSawtooth ; Slight detuning for beating
  
  ; Mix all partials
  amix = a1 + a2 + a3 + a4 + a5
  
  ; Apply simple low-pass filter based on frequency
  ; Lower frequencies get more filtering
  icut = limit(2000 + ifreq * 2, 2000, 12000)
  afilt tone amix, icut
  
  ; Apply very short stereo delays for width
  ; Using different opcodes to avoid syntax issues
  aL = afilt
  aR = afilt
  
  ; Output
  outs aL, aR
endin

; ================================================================
; Instrument 4: Plucked String (simplified)
; Simplified plucked string sound
; p4 = frequency
; p5 = amplitude
; ================================================================
instr 4
  ; Get parameters from score
  ifreq = p4
  iamp = p5
  
  ; Noise excitation with envelope
  aenv linseg 1, 0.01, 0, p3-0.01, 0
  aexc rand iamp * aenv
  
  ; Simple resonator using reson filter
  ares reson aexc, ifreq, ifreq/8, 2
  
  ; Apply envelope
  aenv2 linseg 0, 0.01, iamp, p3-0.11, iamp*0.7, 0.1, 0
  asig = ares * aenv2
  
  ; Simple stereo spread
  aL = asig * 0.9
  aR = asig * 1.1
  
  ; Output
  outs aL, aR
endin

; ================================================================
; Instrument 5: Percussion with Noise and Resonance
; Creates a percussive sound with noise filtered through resonators
; p4 = center frequency
; p5 = amplitude
; ================================================================
instr 5
  ; Get parameters from score
  ifreq = p4
  iamp = p5
  
  ; Short percussive envelope
  aenv linseg 0, 0.005, iamp, 0.1, iamp * 0.2, p3 - 0.105, 0
  
  ; Noise source
  anoise rand 1
  
  ; Three resonant filters at harmonic frequencies
  ares1 reson anoise, ifreq, ifreq/20
  ares2 reson anoise, ifreq * 1.5, ifreq/25
  ares3 reson anoise, ifreq * 2.01, ifreq/30 ; Slight detuning
  
  ; Mix the resonant outputs with different weights
  amix = (ares1 * 0.6 + ares2 * 0.3 + ares3 * 0.1) * aenv
  
  ; Apply stereo effects 
  ; Using a simpler approach to avoid syntax issues
  aL = amix * 0.95
  aR = amix * 1.05
  
  ; Output
  outs aL, aR
endin

