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

;==================================================================
; INSTRUMENTS
;==================================================================

; FM Bell instrument (instrument 1)
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

  ; === Delay tipo Roland Echo ===
  ; idelay = 0.2        ; tempo de delay em segundos
  ; ifeedback = 0.8     ; feedback (quanto do sinal volta a entrar)
  ; icutoff = 2000      ; corte do filtro (Hz)

  ; adelay = delay(amix, idelay)
  ; afilt  = butlp(adelay, icutoff)
  ;amix = amix + (afilt * ifeedback)
  ; ==============================

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