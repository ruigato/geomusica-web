import * as THREE from 'three';
import * as Tone from 'tone';

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

// Desbloquear áudio ao clicar
document.body.addEventListener('click', async () => {
  await Tone.start();
});

// === Dados para deteção de triggers ===
const vertices           = geometry.attributes.position.array;
const vertexCount        = geometry.attributes.position.count;
let lastAngle            = 0;
let lastTriggeredIndices = new Set();

// Usa o AudioContext como relógio
let lastTime = Tone.now();

// === Função de animação ===
function animate() {
  requestAnimationFrame(animate);

  // calcula dt a partir do AudioContext
  const now = Tone.now();
  const dt  = now - lastTime;
  lastTime  = now;

  // converter BPM em rotações por segundo
  const beatsPerSec = bpm / 60;
  const revsPerSec  = beatsPerSec;            // 1 rotação por beat
  const deltaAngle  = revsPerSec * 2 * Math.PI * dt;
  const angle       = lastAngle + deltaAngle;

  // aplicar rotação
  circle.rotation.z = angle;

  // detectar crossings e criar marcadores
  const triggeredNow = new Set();
  for (let i = 0; i < vertexCount; i++) {
    const x = vertices[i * 3];
    const y = vertices[i * 3 + 1];

    // posição no frame anterior
    const prevX = x * Math.cos(lastAngle) - y * Math.sin(lastAngle);
    const prevY = x * Math.sin(lastAngle) + y * Math.cos(lastAngle);

    // posição no frame atual
    const currX = x * Math.cos(angle) - y * Math.sin(angle);
    const currY = x * Math.sin(angle) + y * Math.cos(angle);

    // trigger quando passa de X>0 para X≤0 na metade superior
    if (prevX > 0 && currX <= 0 && currY > 0 && !lastTriggeredIndices.has(i)) {
      // tocar nota
      const freq = Tone.Midi(60 + (i % 12)).toFrequency();
      synth.triggerAttackRelease(freq, '16n');

      // criar marcador no vértice
      const markerMat = baseMarkerMat.clone();
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.set(currX, currY, circle.position.z + 0.02);
      scene.add(marker);
      markers.push({ mesh: marker, life: markerLifetime });

      triggeredNow.add(i);
    }
  }

  // limpar e fazer fade out dos marcadores
  for (let j = markers.length - 1; j >= 0; j--) {
    const m = markers[j];
    m.life--;
    m.mesh.material.opacity = m.life / markerLifetime;
    if (m.life <= 0) {
      scene.remove(m.mesh);
      markers.splice(j, 1);
    }
  }

  // atualizar estado
  lastTriggeredIndices = triggeredNow;
  lastAngle            = angle;

  // renderizar cena
  renderer.render(scene, camera);
}

animate();
