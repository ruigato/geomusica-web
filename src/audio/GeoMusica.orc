; GeoMusica.orc - Csound Orchestra for GeoMusica
; Optimized FM bell instrument with anti-distortion measures

; Global settings
sr = 44100
ksmps = 32
nchnls = 2
0dbfs = 1

; Global compressor/limiter to prevent distortion
gaLeftOut init 0
gaRightOut init 0

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

;==================================================================
; INSTRUMENTS
;==================================================================

; FM Bell instrument (instrument 1)
instr 1
  ; p4 = frequency
  ; p5 = amplitude
  ; p6 = note duration
  ; p7 = pan position (-1 to 1)
  
  ; Get parameters
  ifreq = p4
  
  ; Scale amplitude based on frequency to prevent distortion
  ; High frequencies need less amplitude to avoid harshness
  iampscale = (ifreq > 1000) ? 0.4 : ((ifreq > 500) ? 0.6 : ((ifreq > 200) ? 0.8 : 1.0))
  iamp = p5 * i(gkMasterVolume) * iampscale
  
  idur = p6
  ipan = p7
  
  ; Read the envelope parameters from channels
  iatt = i(gkAttack)
  idec = i(gkDecay)
  isus = i(gkSustain)
  irel = i(gkRelease)
  ibrightness = i(gkBrightness)
  
  ; Adjust brightness based on frequency to prevent harshness
  ibrightness = ibrightness * (1.0 - (ifreq/10000))
  
  ; Determine carrier-to-modulator ratio based on frequency
  ; Lower frequencies get higher C:M ratios for more bell-like character
  icmratio = (ifreq < 200) ? 1.4 : ((ifreq < 500) ? 1.31 : 1.22)
  
  ; Calculate modulator frequency
  imodfreq = ifreq * icmratio
  
  ; Reduce modulation index for higher frequencies to prevent distortion
  imodindex_base = (ifreq < 300) ? 3 : ((ifreq < 800) ? 2 : 1)
  imodindex = imodindex_base * ibrightness
  
  ; Smaller detuning to reduce beating that can cause distortion
  idetune1 = 1.0007
  idetune2 = 0.9993
  
  ; Create ADSR amplitude envelope with slower attack to reduce clicks
  kampenv linsegr 0, iatt+0.005, iamp, idec, iamp*isus, idur-(iatt+idec), iamp*isus, irel, 0
  
  ; More gentle modulation envelope
  kmodenv linsegr 0, iatt*0.7, imodindex, idec*0.8, imodindex*0.3, idur, imodindex*0.2, irel*0.6, 0
  
  ; Gentler brightness envelope
  kbright linsegr 0.7, iatt, 1.0, idec*0.6, 0.8, idur, 0.6, irel*0.7, 0.4
  
  ; FM synthesis
  amod poscil kmodenv * ifreq, imodfreq, giSine
  acar1 poscil kampenv * 0.6, (ifreq * idetune1) + amod, giSine
  acar2 poscil kampenv * 0.2, (ifreq * idetune2) + amod, giGlass
  
  ; Mix carriers with reduced volume
  acar = (acar1 + acar2) * 0.7
  
  ; Apply more gentle brightness filter 
  acarfilt tone acar, 2000 + (ifreq * kbright * 0.5)
  
  ; Add less "glass" harmonics
  aattack poscil kampenv * 0.06 * (1 - kbright), ifreq * 2.6, giGlass
  
  ; Create final mix with reduced volume
  amix = (acarfilt + aattack) * 0.8
  
  ; Use gentler reverb
  arev reverb amix, 1.2
  amix = amix + (arev * 0.1)
  
  ; Apply soft-knee limiter to prevent clipping
  amix limit amix, -0.9, 0.9
  
  ; Normalize pan position to 0-1 range
  ipan = (ipan + 1) * 0.5
  
  ; Apply panning
  aleft = amix * sqrt(1 - ipan)
  aright = amix * sqrt(ipan)
  
  ; Send output to global audio bus for final limiting
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

; Timer instrument for synchronization with JavaScript
instr 100
  ktime times
  chnset ktime, "currentTime"
endin

;==================================================================
; INSTRUMENT SCHEDULING
;==================================================================

; Start the output processor and timer instruments automatically
schedule 99, 0, 100000
schedule 100, 0, 100000