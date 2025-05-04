; GeoMusica.orc - Csound Orchestra for GeoMusica
; Modular Csound orchestra file for geometric music application

; Global settings
sr = 44100
ksmps = 64
nchnls = 2
0dbfs = 1

;==================================================================
; GLOBAL VARIABLES AND CHANNELS
;==================================================================

; Timing channel for synchronization with JavaScript
gkCurrentTime chnexport "currentTime", 1

; Global variables for envelope controls - exposed as channels
gkAttack chnexport "attack", 1
gkDecay chnexport "decay", 1
gkSustain chnexport "sustain", 1
gkRelease chnexport "release", 1
; Default envelope values
gkAttack init 0.01
gkDecay init 0.1
gkSustain init 0.7
gkRelease init 0.5

; Parameter channels for real-time frequency modulation
gkFreq chnexport "frequency", 1
giAmp chnexport "amplitude", 1
gkGate chnexport "gate", 1

;==================================================================
; FUNCTION TABLES
;==================================================================

; Define function tables for waveforms
giSine     ftgen 1, 0, 16384, 10, 1                           ; Sine wave
giTriangle ftgen 2, 0, 16384, 10, 1, 0, 0.333, 0, 0.2, 0, 0.143, 0, 0.111  ; Triangle
giSquare   ftgen 3, 0, 16384, 10, 1, 0.5, 0.333, 0.25, 0.2, 0.167, 0.143, 0.125, 0.111  ; Square-ish
giSawtooth ftgen 4, 0, 16384, 10, 1, 0.5, 0.333, 0.25, 0.2, 0.167, 0.143, 0.125, 0.111, 0.1, 0.091  ; Sawtooth-ish

;==================================================================
; INSTRUMENTS
;==================================================================

; Single-trigger synth with automatic envelope (instrument 5)
; This version doesn't require explicit note-off events
instr 5
  ; p4 = frequency
  ; p5 = amplitude
  ; p6 = note duration
  ; p7 = pan position (-1 to 1)
  
  ; Get parameters
  ifreq = p4
  iamp = p5
  idur = p6
  ipan = p7
  
  ; Read the envelope parameters from channels
  iatt = i(gkAttack)
  idec = i(gkDecay)
  isus = i(gkSustain)
  irel = i(gkRelease)
  
  ; Create ADSR envelope with absolute duration
  ; This type of envelope automatically schedules its release phase
  kenv linsegr 0, iatt, iamp, idec, iamp*isus, idur, 0
  
  ; Create oscillator with envelope
  asig poscil kenv, ifreq, giSine
  
  ; Normalize pan position to 0-1 range
  ipan = (ipan + 1) * 0.5
  
  ; Apply panning
  aleft = asig * sqrt(1 - ipan)
  aright = asig * sqrt(ipan)
  
  ; Output stereo signal
  outs aleft, aright
endin

; FM Synthesis instrument (instrument 6)
instr 6
  ; p4 = carrier frequency
  ; p5 = amplitude
  ; p6 = note duration
  ; p7 = pan position (-1 to 1)
  ; p8 = modulator ratio (optional, defaults to 2)
  ; p9 = modulation index (optional, defaults to 3)
  
  ; Get parameters
  ifreq = p4
  iamp = p5
  idur = p6
  ipan = p7
  
  ; Optional parameters with defaults
  imodratio = (p8 == 0 ? 2 : p8)
  imodindex = (p9 == 0 ? 3 : p9)
  
  ; Calculate modulator frequency based on ratio
  imodfreq = ifreq * imodratio
  
  ; Read the envelope parameters from channels
  iatt = i(gkAttack)
  idec = i(gkDecay)
  isus = i(gkSustain)
  irel = i(gkRelease)
  
  ; Create ADSR envelope
  kenv linsegr 0, iatt, iamp, idec, iamp*isus, idur, 0
  
  ; Create a separate envelope for modulation index
  kmodenv linsegr 0, iatt*0.5, imodindex, idur, imodindex*0.3, irel*0.5, 0
  
  ; FM synthesis
  amod poscil kmodenv * ifreq, imodfreq, giSine
  acar poscil kenv, ifreq + amod, giSine
  
  ; Normalize pan position to 0-1 range
  ipan = (ipan + 1) * 0.5
  
  ; Apply panning
  aleft = acar * sqrt(1 - ipan)
  aright = acar * sqrt(ipan)
  
  ; Output stereo signal
  outs aleft, aright
endin

; Additive synthesis instrument (instrument 7)
instr 7
  ; p4 = fundamental frequency
  ; p5 = amplitude
  ; p6 = note duration
  ; p7 = pan position (-1 to 1)
  ; p8 = brightness (optional, defaults to 1.0)
  
  ; Get parameters
  ifreq = p4
  iamp = p5
  idur = p6
  ipan = p7
  
  ; Optional parameters with defaults
  ibrightness = (p8 == 0 ? 1.0 : p8)
  
  ; Read the envelope parameters from channels
  iatt = i(gkAttack)
  idec = i(gkDecay)
  isus = i(gkSustain)
  irel = i(gkRelease)
  
  ; Create ADSR envelope
  kenv linsegr 0, iatt, iamp, idec, iamp*isus, idur, 0
  
  ; Create 5 partials with different harmonics and waveforms
  a1 poscil kenv * 0.4, ifreq, giSine
  a2 poscil kenv * 0.3 * ibrightness, ifreq * 2, giSine
  a3 poscil kenv * 0.2 * ibrightness, ifreq * 3, giTriangle
  a4 poscil kenv * 0.1 * ibrightness, ifreq * 4, giTriangle
  a5 poscil kenv * 0.05 * ibrightness, ifreq * 5.02, giSquare ; Slight detuning for beating
  
  ; Mix all partials
  amix = a1 + a2 + a3 + a4 + a5
  
  ; Apply simple low-pass filter based on frequency
  icut = 2000 + (ifreq * ibrightness)
  afilt tone amix, icut
  
  ; Normalize pan position to 0-1 range
  ipan = (ipan + 1) * 0.5
  
  ; Apply panning
  aleft = afilt * sqrt(1 - ipan)
  aright = afilt * sqrt(ipan)
  
  ; Output stereo signal
  outs aleft, aright
endin

; Plucked string model (instrument 8)
instr 8
  ; p4 = frequency
  ; p5 = amplitude
  ; p6 = note duration
  ; p7 = pan position (-1 to 1)
  
  ; Get parameters
  ifreq = p4
  iamp = p5
  idur = p6
  ipan = p7
  
  ; Read the envelope parameters from channels
  iatt = i(gkAttack) * 0.5  ; Shorter attack for plucked string
  idec = i(gkDecay)
  isus = i(gkSustain) * 0.7 ; Lower sustain for plucked string
  irel = i(gkRelease)
  
  ; Create ADSR envelope
  kenv linsegr 0, iatt, iamp, idec, iamp*isus, idur, 0
  
  ; Create excitation with noise
  aexc rand iamp
  aenvexc linseg 1, 0.01, 0, p3-0.01, 0
  aexc = aexc * aenvexc
  
  ; Filter with resonator
  ares reson aexc, ifreq, ifreq/15
  
  ; Apply final envelope
  asig = ares * kenv
  
  ; Normalize pan position to 0-1 range
  ipan = (ipan + 1) * 0.5
  
  ; Apply panning
  aleft = asig * sqrt(1 - ipan)
  aright = asig * sqrt(ipan)
  
  ; Output stereo signal
  outs aleft, aright
endin

; Timer instrument for synchronization with JavaScript
instr 100
  ktime times
  chnset ktime, "currentTime"
endin

;==================================================================
; INSTRUMENT SCHEDULING
;==================================================================

; Start the timer instrument automatically
schedule 100, 0, 100000