import * as THREE from 'three';
import * as Tone from 'tone';

// === Controlo de UI (BPM) ===
const bpmSlider = document.getElementById('bpm');
const bpmValue  = document.getElementById('bpmValue');
let bpm = parseInt(bpmSlider.value, 10);
bpmSlider.oninput = (e) => {
  bpm = parseInt(e.target.value, 10);
  bpmValue.textContent = bpm;
  transport.bpm.value = bpm;
};

// === Setup Three.js ===
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(
  75,
  (window.innerWidth * 0.8) / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth * 0.8, window.innerHeight);
document.getElementById('canvas').appendChild(renderer.domElement);

// === Geometria do “círculo” (pentágono) ===
const geometry = new THREE.CircleGeometry(1, 5);
const material = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true });
const circle   = new THREE.Mesh(geometry, material);
circle.position.z = 0.01;
scene.add(circle);

// === Eixo vertical (linha branca) ===
const eixoMat  = new THREE.LineBasicMaterial({ color: 0xffffff });
const linePts  = [ new THREE.Vector3(0,0,0), new THREE.Vector3(0,5,0) ];
const eixoGeo  = new THREE.BufferGeometry().setFromPoints(linePts);
scene.add(new THREE.Line(eixoGeo, eixoMat));

camera.position.z = 5;

// === Setup Tone.js ===
const synth     = new Tone.PolySynth(Tone.Synth, 8).toDestination();
const transport = Tone.getTransport();
transport.PPQ       = 480; // 480 ticks por semínima (beat)
transport.bpm.value = bpm;

// Desbloquear áudio e arrancar o Transport
document.body.addEventListener('click', async () => {
  await Tone.start();
  transport.start();
  console.log('AudioContext e Transport iniciados com', bpm, 'BPM');
});

// === Dados para deteção de triggers ===
const vertices           = geometry.attributes.position.array;
const vertexCount        = geometry.attributes.position.count;
let lastAngle            = 0;
let lastTriggeredIndices = new Set();

// === Parâmetros de tempo para rotação por compasso ===
const beatsPerBar = 4;
const ticksPerBar = transport.PPQ * beatsPerBar; // 480 * 4 = 1920

// === Loop de triggers e desenho sincronizado ===
transport.scheduleRepeat((time) => {
  const ticks     = transport.ticks;
  const prevTicks = ticks - 1;
  
  // cálculo preciso do ângulo antes e depois do tick
  const angle     = (ticks     % ticksPerBar) / ticksPerBar * Math.PI * 2;
  const prevAngle = (prevTicks % ticksPerBar) / ticksPerBar * Math.PI * 2;
  
  circle.rotation.z = angle; // já podemos girar aqui, se não quisermos usar Tone.Draw
  
  const triggeredNow = new Set();
  
  for (let i = 0; i < vertexCount; i++) {
    const x = vertices[i*3], y = vertices[i*3+1];
  
    // usa prevAngle em vez de lastAngle
    const rotX_prev = x * Math.cos(prevAngle) - y * Math.sin(prevAngle);
    const rotY_prev = x * Math.sin(prevAngle) + y * Math.cos(prevAngle);
  
    const rotX = x * Math.cos(angle) - y * Math.sin(angle);
    const rotY = x * Math.sin(angle) + y * Math.cos(angle);
  
    // cruzamento do eixo na metade superior
    if (rotX_prev < 0 && rotX >= 0 && rotY > 0) {
      triggeredNow.add(i);

    }
  }

  // dispara notas para todos os vértices que cruzaram
  if (triggeredNow.size > 0) {
    const freqs = Array.from(triggeredNow)
      .map(i => Tone.Midi(60 + (i % 12)).toFrequency());
    synth.triggerAttackRelease(freqs, '8n', time);
  }

  // actualiza estado para o próximo tick
  lastTriggeredIndices = triggeredNow;


  // desenho sincronizado ao áudio
  Tone.Draw.schedule(() => {
    circle.rotation.z = angle;
    renderer.render(scene, camera);
  }, time);

}, '1i');
