import * as THREE from 'three';
import * as Tone from 'tone';

// === Controlo de UI ===
const speedSlider = document.getElementById('speed');
const speedValue  = document.getElementById('speedValue');
// Valor inicial de speed
let speed = parseFloat(speedSlider.value);
speedSlider.oninput = (e) => {
  speed = parseFloat(e.target.value);
  speedValue.textContent = speed.toFixed(3);
  // Atualiza o BPM do transporte (0.01–0.333 → 24–80 BPM)
  transport.bpm.value = speed * 240;
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
const material = new THREE.MeshBasicMaterial({
  color: 0x00ffcc,
  wireframe: true
});
const circle = new THREE.Mesh(geometry, material);
// Coloca ligeiramente à frente para não tapar o eixo
circle.position.z = 0.01;
scene.add(circle);

// === Eixo vertical (linha branca) ===
const eixoMat  = new THREE.LineBasicMaterial({ color: 0xffffff });
const linePts  = [
  new THREE.Vector3(0, 0, 0),  // centro
  new THREE.Vector3(0, 5, 0)   // topo
];
const eixoGeo  = new THREE.BufferGeometry().setFromPoints(linePts);
scene.add(new THREE.Line(eixoGeo, eixoMat));

// Ajusta a câmara
camera.position.z = 5;

// === Setup Tone.js ===
// PolySynth para múltiplas vozes sem conflito de agendamento
const synth     = new Tone.PolySynth(Tone.Synth, 5).toDestination();
// Pega na instância de Transport via getTransport()
const transport = Tone.getTransport();
// Define a resolução e o BPM inicial
transport.PPQ       = 480;            // 480 pulses per quarter note
transport.bpm.value = speed * 240;    // inicial mapeado do slider

// Desbloquear áudio e arrancar o Transport ao clique
document.body.addEventListener('click', async () => {
  await Tone.start();
  transport.start();
  console.log('AudioContext e Transport iniciados');
});

// === Dados para triggers ===
const vertices       = geometry.attributes.position.array;
const vertexCount    = geometry.attributes.position.count;
let lastTriggered    = new Set();

// === Loop de renderização visual ===
function render() {
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}
render();

// === Loop de triggers agendado por tick ("1i") ===
transport.scheduleRepeat((time) => {
  const ticks     = transport.ticks;
  const prevTicks = ticks - 1;

  // ângulo atual e anterior (480 ticks = 1 rotação completa)
  const angle     = (ticks     % 480) / 480 * Math.PI * 2;
  const prevAngle = (prevTicks % 480) / 480 * Math.PI * 2;

  // Aplica rotação visual
  circle.rotation.z = angle;

  const triggeredNow = new Set();
  for (let i = 0; i < vertexCount; i++) {
    const x = vertices[i*3];
    const y = vertices[i*3+1];

    // calcula posições antes e depois
    const prevX = x * Math.cos(prevAngle) - y * Math.sin(prevAngle);
    const currX = x * Math.cos(angle)     - y * Math.sin(angle);
    const currY = x * Math.sin(angle)     + y * Math.cos(angle);

    // zero-crossing na metade superior
    if (prevX * currX < 0 && currY > 0) {
      triggeredNow.add(i);
    }
  }

  // dispara todas as notas simultâneas como acorde
  if (triggeredNow.size > 0) {
    const freqs = Array.from(triggeredNow)
      .map(i => Tone.Midi(60 + (i % 12)).toFrequency());
    synth.triggerAttackRelease(freqs, '16n', time);
  }

  lastTriggered = triggeredNow;
}, '1i');
