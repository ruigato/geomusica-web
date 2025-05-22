; GeoMusica.orc - Csound Orchestra for GeoMusica
; Optimized FM bell instrument with anti-distortion measures

; Global settings
sr = 44100
ksmps = 128
nchnls = 2
0dbfs = 1

; Global compressor/limiter to prevent distortion
gaLeftOut init 0
gaRightOut init 0

;==================================================================
; GLOBAL VARIABLES AND CHANNELS
;==================================================================

; Global variables for envelope controls - exposed as channels
gkAttack chnexport "attack", 1
gkDecay chnexport "decay", 1
gkSustain chnexport "sustain", 1
gkRelease chnexport "release", 1
gkBrightness chnexport "brightness", 1
gkMasterVolume chnexport "masterVolume", 1

; Default envelope values
gkAttack init 0.01
gkDecay init 0.3
gkSustain init 0.5
gkRelease init 1.0
gkBrightness init 1.0
gkMasterVolume init 0.8

;==================================================================
; FUNCTION TABLES
;==================================================================

; Define function tables for waveforms
giSine     ftgen 1, 0, 16384, 10, 1                           ; Pure sine wave
giGlass    ftgen 2, 0, 16384, 10, 1, 0.4, 0.2, 0.1, 0.1, 0.05 ; Glass-like harmonics
giAttack   ftgen 3, 0, 1024, 8, 0, 256, 1, 768, 0.3          ; Custom attack shape with gen08
giDecay    ftgen 4, 0, 1024, 8, 1, 400, 0.5, 624, 0          ; Custom decay shape with gen08
giSaw      ftgen 5, 0, 16384, 10, 1, 0.5, 0.33, 0.25, 0.2, 0.167, 0.142, 0.125  ; Saw-like
giSquare   ftgen 6, 0, 16384, 10, 1, 0, 0.33, 0, 0.2, 0, 0.142, 0, 0.111        ; Square-like
giTriangle ftgen 7, 0, 16384, 10, 1, 0, 0.11, 0, 0.04, 0, 0.02                  ; Triangle-like

;==================================================================
; INSTRUMENTS
;==================================================================

; FM Bell instrument (instrument 1) - Used for Layer 0
instr 1
  ; p4 = frequency
  ; p5 = amplitude
  ; p6 = note duration
  ; p7 = pan position (-1 to 1)

  ifreq = p4

  iampscale = (ifreq > 1000) ? 0.4 : ((ifreq > 500) ? 0.6 : ((ifreq > 200) ? 0.8 : 1.0))
  iamp = p5 * i(gkMasterVolume) * iampscale

  idur = p6
  ipan = p7

  iatt = i(gkAttack)
  idec = i(gkDecay)
  isus = i(gkSustain)
  irel = i(gkRelease)
  ibrightness = i(gkBrightness)
  ibrightness = ibrightness * (1.0 - (ifreq/10000))

  icmratio = (ifreq < 200) ? 1.4 : ((ifreq < 500) ? 1.31 : 1.22)
  imodfreq = ifreq * icmratio

  imodindex_base = (ifreq < 300) ? 3 : ((ifreq < 800) ? 2 : 1)
  imodindex = imodindex_base * ibrightness

  idetune1 = 1.0007
  idetune2 = 0.9993

  kampenv linsegr 0, iatt+0.005, iamp, idec, iamp*isus, idur-(iatt+idec), iamp*isus, irel, 0
  kmodenv linsegr 0, iatt*0.7, imodindex, idec*0.8, imodindex*0.3, idur, imodindex*0.2, irel*0.6, 0
  kbright linsegr 0.7, iatt, 1.0, idec*0.6, 0.8, idur, 0.6, irel*0.7, 0.4

  amod poscil kmodenv * ifreq, imodfreq, giSine
  acar1 poscil kampenv * 0.6, (ifreq * idetune1) + amod, giSine
  acar2 poscil kampenv * 0.2, (ifreq * idetune2) + amod, giGlass
  acar = (acar1 + acar2) * 0.7

  acarfilt tone acar, 2000 + (ifreq * kbright * 0.5)
  aattack poscil kampenv * 0.06 * (1 - kbright), ifreq * 2.6, giGlass

  amix = (acarfilt + aattack) * 0.8
  arev reverb amix, 1.2
  amix = amix + (arev * 0.1)
  amix limit amix, -0.9, 0.9

  ipan = (ipan + 1) * 0.5
  aleft = amix * sqrt(1 - ipan)
  aright = amix * sqrt(ipan)

  gaLeftOut = gaLeftOut + aleft
  gaRightOut = gaRightOut + aright
endin

; Plucked String instrument (instrument 2) - Used for Layer 1
instr 2
  ; p4 = frequency
  ; p5 = amplitude
  ; p6 = note duration
  ; p7 = pan position (-1 to 1)

  ifreq = p4
  iampscale = (ifreq > 1000) ? 0.5 : ((ifreq > 500) ? 0.7 : ((ifreq > 200) ? 0.9 : 1.0))
  iamp = p5 * i(gkMasterVolume) * iampscale
  idur = p6
  ipan = p7

  iatt = i(gkAttack) * 0.5 ; Faster attack for plucked sound
  idec = i(gkDecay) * 0.7  ; Shorter decay
  isus = i(gkSustain) * 0.6 ; Lower sustain level
  irel = i(gkRelease) * 0.8 ; Shorter release
  ibrightness = i(gkBrightness)

  ; Karplus-Strong like algorithm
  anoise rand iamp
  afilt butterlp anoise, ifreq * 4 * ibrightness
  acomb comb afilt, idur + irel, 1/ifreq

  kampenv linsegr 0, iatt, iamp, idec, iamp*isus, idur-(iatt+idec), iamp*isus, irel, 0
  asig = acomb * kampenv

  ; Add some brightness for higher frequencies
  aexcite poscil kampenv * 0.1 * (1 - (ifreq/2000)), ifreq * 2, giSaw
  aexcite butterhp aexcite, ifreq * 1.5

  amix = (asig + aexcite) * 0.8
  arev reverb amix, 0.8
  amix = amix + (arev * 0.15)
  amix limit amix, -0.9, 0.9

  ipan = (ipan + 1) * 0.5
  aleft = amix * sqrt(1 - ipan)
  aright = amix * sqrt(ipan)

  gaLeftOut = gaLeftOut + aleft
  gaRightOut = gaRightOut + aright
endin

; Soft Pad instrument (instrument 3) - Used for Layer 2
instr 3
  ; p4 = frequency
  ; p5 = amplitude
  ; p6 = note duration
  ; p7 = pan position (-1 to 1)

  ifreq = p4
  iampscale = (ifreq > 1000) ? 0.4 : ((ifreq > 500) ? 0.6 : ((ifreq > 200) ? 0.8 : 1.0))
  iamp = p5 * i(gkMasterVolume) * iampscale * 0.7 ; Slightly quieter
  idur = p6
  ipan = p7

  iatt = i(gkAttack) * 2.0 ; Slower attack
  idec = i(gkDecay) * 1.5  ; Longer decay
  isus = i(gkSustain) * 0.8 ; Higher sustain
  irel = i(gkRelease) * 1.5 ; Longer release
  ibrightness = i(gkBrightness) * 0.8 ; Less bright

  ; Slight detuning for chorus effect
  idetune1 = 1.003
  idetune2 = 0.997

  kampenv linsegr 0, iatt, iamp, idec, iamp*isus, idur-(iatt+idec), iamp*isus, irel, 0
  
  ; Main oscillators
  aosc1 poscil kampenv * 0.4, ifreq * idetune1, giTriangle
  aosc2 poscil kampenv * 0.4, ifreq * idetune2, giTriangle
  aosc3 poscil kampenv * 0.2, ifreq * 0.5, giSine ; Sub-oscillator
  
  ; Mix and filter
  amix = aosc1 + aosc2 + aosc3
  afilt butterlp amix, 800 + (ifreq * ibrightness * 0.3)
  
  ; Add reverb
  arev reverb afilt, 2.0
  amix = afilt + (arev * 0.3)
  amix limit amix, -0.9, 0.9

  ipan = (ipan + 1) * 0.5
  aleft = amix * sqrt(1 - ipan)
  aright = amix * sqrt(ipan)

  gaLeftOut = gaLeftOut + aleft
  gaRightOut = gaRightOut + aright
endin

; Percussive instrument (instrument 4) - Used for Layer 3
instr 4
  ; p4 = frequency
  ; p5 = amplitude
  ; p6 = note duration
  ; p7 = pan position (-1 to 1)

  ifreq = p4
  iampscale = (ifreq > 1000) ? 0.6 : ((ifreq > 500) ? 0.8 : 1.0)
  iamp = p5 * i(gkMasterVolume) * iampscale
  idur = p6
  ipan = p7

  iatt = i(gkAttack) * 0.2 ; Very fast attack
  idec = i(gkDecay) * 0.5  ; Shorter decay
  isus = i(gkSustain) * 0.3 ; Lower sustain
  irel = i(gkRelease) * 0.6 ; Shorter release
  ibrightness = i(gkBrightness) * 1.2 ; Brighter

  ; Main envelope - percussive
  kampenv linsegr 0, iatt, iamp, idec, iamp*isus, idur-(iatt+idec), iamp*isus, irel, 0
  
  ; Noise component for attack
  anoise rand iamp * 0.4
  anoisefilt butterbp anoise, ifreq * 2, ifreq * 0.5
  anoiseenv linseg 1, iatt+idec*0.3, 0
  anoisefinal = anoisefilt * anoiseenv * kampenv
  
  ; Tone component
  atone poscil kampenv, ifreq, giSquare
  atonefilt butterlp atone, ifreq * 4 * ibrightness
  
  ; Mix components
  amix = (atonefilt * 0.7) + (anoisefinal * 0.3)
  arev reverb amix, 0.6
  amix = amix + (arev * 0.1)
  amix limit amix, -0.9, 0.9

  ipan = (ipan + 1) * 0.5
  aleft = amix * sqrt(1 - ipan)
  aright = amix * sqrt(ipan)

  gaLeftOut = gaLeftOut + aleft
  gaRightOut = gaRightOut + aright
endin

; Output processor instrument with limiter
instr 99
  ; Apply master limiter and DC offset removal
  aLeftLim limit gaLeftOut, -0.9, 0.9
  aRightLim limit gaRightOut, -0.9, 0.9
  
  ; Apply final soft-clipping to prevent distortion
  aLeftClip = tanh(aLeftLim)
  aRightClip = tanh(aRightLim)
  
  ; Remove any DC offset
  aLeftFinal dcblock aLeftClip
  aRightFinal dcblock aRightClip
  
  ; Send to output
  outs aLeftFinal, aRightFinal
  
  ; Clear the global audio buses
  clear gaLeftOut, gaRightOut
endin

;==================================================================
; INSTRUMENT SCHEDULING
;==================================================================

; Start the output processor instrument automatically
schedule 99, 0, 100000