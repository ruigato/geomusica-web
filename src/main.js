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
  // Atualiza o BPM do transport (0.01–0.333 → 24–80 BPM, por exemplo)
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

// === Geometria do círculo (5 vértices) ===
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

// Ajusta câmara
camera.position.z = 5;

// === Setup Tone.js ===
const synth     = new Tone.Synth().toDestination();
// Obter instância de transport
const transport = Tone.getTransport();
// Definir resolução e BPM inicial
transport.PPQ         = 480;              // 480 ticks por semínima
transport.bpm.value   = speed * 240;      // mapeamento slider → BPM

// Desbloquear áudio ao clique
document.body.addEventListener('click', async () => {
  await Tone.start();
  transport.start();
  console.log('AudioContext e Transport iniciados');
});

// === Dados para triggers ===
const vertices          = geometry.attributes.position.array;
const vertexCount       = geometry.attributes.position.count;
let lastTriggeredIndices = new Set();

// === Render loop (visual) ===
function render() {
  requestAnimationFrame(render);
  renderer.render(scene, camera);
}
render();

// === Loop de triggers agendado por tick ===
transport.scheduleRepeat((time) => {
  const ticks     = transport.ticks;
  const prevTicks = ticks - 1;

  // Ângulo atual e anterior (480 ticks = 1 rotação)
  const angle     = (ticks % 480)     / 480 * Math.PI * 2;
  const prevAngle = (prevTicks % 480) / 480 * Math.PI * 2;

  // Atualiza rotação do círculo
  circle.rotation.z = angle;

  const triggeredNow = new Set();
  for (let i = 0; i < vertexCount; i++) {
    const x = vertices[i*3], y = vertices[i*3+1];
    const prevX = x * Math.cos(prevAngle) - y * Math.sin(prevAngle);
    const currX = x * Math.cos(angle)     - y * Math.sin(angle);
    const currY = x * Math.sin(angle)     + y * Math.cos(angle);

    // Zero-crossing só na metade superior
    if (prevX * currX < 0 && currY > 0 && !lastTriggeredIndices.has(i)) {
      const note = 60 + (i % 12);
      synth.triggerAttackRelease(Tone.Midi(note).toFrequency(), '16n', time);
      triggeredNow.add(i);
    }
  }
  lastTriggeredIndices = triggeredNow;
}, '1i');
