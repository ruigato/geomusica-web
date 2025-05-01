import * as THREE from 'three';
import * as Tone from 'tone';

const SCHEDULE_AHEAD = 0.03;  // 30ms de buffer

// === Controlo de UI (BPM) ===
const bpmSlider = document.getElementById('bpm');
const bpmValue  = document.getElementById('bpmValue');
let bpm = parseInt(bpmSlider.value, 10);
bpmSlider.oninput = (e) => {
  bpm = parseInt(e.target.value, 10);
  bpmValue.textContent = bpm;
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

// === Geometria do “círculo” (quadrado) ===
const geometry = new THREE.CircleGeometry(1, 4);
const material = new THREE.MeshBasicMaterial({
  color: 0x00ffcc,
  wireframe: true
});
const circle = new THREE.Mesh(geometry, material);
circle.position.z = 0.01;
scene.add(circle);

// === Eixo vertical (linha branca) ===
const eixoMat = new THREE.LineBasicMaterial({ color: 0xffffff });
const linePts = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 5, 0)
];
const eixoGeo = new THREE.BufferGeometry().setFromPoints(linePts);
scene.add(new THREE.Line(eixoGeo, eixoMat));

camera.position.z = 5;

// === Marcadores de trigger com fade out e blending aditivo ===
const markers        = [];
const markerLifetime = 30; // frames
const markerGeom     = new THREE.SphereGeometry(0.05, 8, 8);
const baseMarkerMat  = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 1,
  depthTest: false,
  blending: THREE.AdditiveBlending
});

// === Setup Tone.js ===
const synth = new Tone.Synth().toDestination();

// Desbloquear áudio ao clicar no ecrã
document.body.addEventListener('click', async () => {
  await Tone.start();
});

// === Dados para deteção de triggers ===
const vertices           = geometry.attributes.position.array;
const vertexCount        = geometry.attributes.position.count;
let lastAngle            = 0;
let lastTriggeredIndices = new Set();

// Usa o AudioContext como relógio
let lastAudioTime = Tone.now();

// === Função de animação com interpolação do crossing ===
function animate() {
  requestAnimationFrame(animate);

  // 1) tempos de áudio
  const tNow     = Tone.now();

  const dt       = tNow - lastAudioTime;

  const tPrev    = lastAudioTime;
  lastAudioTime  = tNow;

  // 2) calcular ângulo com base no BPM
  const beatsPerSec = bpm / 60;         // 1 beat = 1 volta
  const revsPerSec  = beatsPerSec;
  const deltaAngle  = revsPerSec * 2 * Math.PI * dt;
  const angle       = lastAngle + deltaAngle;

  // aplicar rotação ao círculo (para render)
  circle.rotation.z = angle;

  // 3) detecção de crossings com interpolação de tempo
  const triggeredNow = new Set();
  for (let i = 0; i < vertexCount; i++) {
    const x = vertices[i * 3];
    const y = vertices[i * 3 + 1];

    // posições antes e depois
    const rotX_prev = x * Math.cos(lastAngle) - y * Math.sin(lastAngle);
    const rotY_prev = x * Math.sin(lastAngle) + y * Math.cos(lastAngle);

    const rotX = x * Math.cos(angle) - y * Math.sin(angle);
    const rotY = x * Math.sin(angle) + y * Math.cos(angle);

   // dentro de animate(), após calcular rotX_prev, rotX, rotY…
if (rotX_prev > 0 && rotX <= 0 && rotY > 0 && !lastTriggeredIndices.has(i)) {
  // interpolar instante exacto do crossing
  const denom   = rotX_prev - rotX;
  const frac    = denom !== 0 ? rotX_prev / denom : 0;
  console.log(frac);
  const tCross  = tPrev + frac * dt;

  // calcular tempo de scheduling no futuro
  let tSchedule = tCross + SCHEDULE_AHEAD;
  tSchedule     = Math.max(tSchedule, Tone.now() + 0.005);

  // tocar nota no instante agendado
  const freq = Tone.Midi(60 + (i % 12)).toFrequency();
  synth.triggerAttackRelease(freq, '16n', tSchedule);

  // agendar marcador visual também
  Tone.Draw.schedule(() => {
    const markerMat = baseMarkerMat.clone();
    const marker    = new THREE.Mesh(markerGeom, markerMat);
    const cx        = x * Math.cos(angle) - y * Math.sin(angle);
    const cy        = x * Math.sin(angle) + y * Math.cos(angle);
    marker.position.set(cx, cy, circle.position.z + 0.02);
    scene.add(marker);
    markers.push({ mesh: marker, life: markerLifetime });
  }, tSchedule);

  triggeredNow.add(i);
    }
  }

  // 4) limpar e fazer fade out dos marcadores
  for (let j = markers.length - 1; j >= 0; j--) {
    const m = markers[j];
    m.life--;
    m.mesh.material.opacity = m.life / markerLifetime;
    if (m.life <= 0) {
      scene.remove(m.mesh);
      markers.splice(j, 1);
    }
  }

  // 5) atualizar estado
  lastTriggeredIndices = triggeredNow;
  lastAngle            = angle;

  // 6) renderizar cena
  renderer.render(scene, camera);
}

animate();
