// src/audio/audio.js
import * as Tone from 'tone';

export function setupAudio() {
  const synth = new Tone.Synth({
    oscillator: { type: "sine" },
    envelope: { attack: 0.01, decay: 0.5, sustain: 1.0, release: 1.2 }
  }).toDestination();

  document.body.addEventListener('click', async () => {
    await Tone.start();
    Tone.getTransport().start();
  }, { once: true });

  return synth;
}

export function triggerAudio(synth, x, y, lastAngle, angle, tNow) {
  const freq = Math.hypot(x, y);
  synth.triggerAttackRelease(freq, '64n', tNow);
}

// Exporting Tone for use in other modules
export { Tone };