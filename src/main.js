import * as THREE from 'three';
import * as Tone from 'tone';

// === Controlo de UI (BPM) ===
const bpmSlider = document.getElementById('bpm');
const bpmValue  = document.getElementById('bpmValue');
let bpm = parseInt(bpmSlider.value, 10);
bpmSlider.oninput = e => {
  bpm = parseInt(e.target.value, 10);
  bpmValue.textContent = bpm;
};

// === Setup Three.js ===
const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(
  75,
  (window.innerWidth * 0.8) / window.innerHeight,
  0.1,
  10000
);
camera.position.set(0, 0, 2000);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth * 0.8, window.innerHeight);
document.getElementById('canvas').appendChild(renderer.domElement);

// === Geometria do “círculo” (quadrado com raio 432) ===
const radius   = 432;
const segments = 4;
const geometry = new THREE.CircleGeometry(radius, segments);
const material = new THREE.MeshBasicMaterial({
  color: 0x00ffcc,
  wireframe: true
});
const circle = new THREE.Mesh(geometry, material);
circle.position.z = 0.01;
scene.add(circle);

// === Eixo vertical de 2048 de altura ===
const eixoMat = new THREE.LineBasicMaterial({ color: 0xffffff });
const eixoPts = [
  new THREE.Vector3(0, 0, 0),
  new THREE.Vector3(0, 2048, 0)
];
const eixoGeo = new THREE.BufferGeometry().setFromPoints(eixoPts);
scene.add(new THREE.Line(eixoGeo, eixoMat));

// === Marcadores de trigger com fade out e blend aditivo ===
const markers        = [];
const markerLifetime = 30; // frames
const markerGeom     = new THREE.SphereGeometry(8, 8, 8);
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
let lastAudioTime        = Tone.now();
const SCHEDULE_AHEAD     = 0.1; // 30ms buffer

// === Função de animação com correção de lag e markers ajustados ===
function animate() {
  requestAnimationFrame(animate);

  // 1) ler tempo do AudioContext
  const tNow     = Tone.now();
  const dt       = tNow - lastAudioTime;
  const tPrev    = lastAudioTime;
  lastAudioTime  = tNow;

  // 2) calcular a rotação (1 volta por beat)
  const beatsPerSec = bpm / 60;
  const revsPerSec  = beatsPerSec;
  const deltaAngle  = revsPerSec * 2 * Math.PI * dt;
  const angle       = lastAngle + deltaAngle;

  // aplicar rotação ao visual
  circle.rotation.z = angle;

  // 3) detecção de crossings com interpolação de tempo e agendamento correto
  const triggeredNow = new Set();
  for (let i = 0; i < vertexCount; i++) {
    const x = vertices[i * 3], y = vertices[i * 3 + 1];

    // calcular X antes e depois do crossing
    const prevX = x * Math.cos(lastAngle) - y * Math.sin(lastAngle);
    const prevY = x * Math.sin(lastAngle) + y * Math.cos(lastAngle);
    const currX = x * Math.cos(angle)     - y * Math.sin(angle);
    const currY = x * Math.sin(angle)     + y * Math.cos(angle);

    // se cruzou de X>0 para X≤0 e está acima
    if (prevX > 0 && currX <= 0 && currY > 0 && !lastTriggeredIndices.has(i)) {
      // interpolar instante exato do crossing
      const denom  = prevX - currX;
      const frac   = denom !== 0 ? prevX / denom : 0;
      const tCross = tPrev + frac * dt;

      // garantir scheduling no futuro
      let tSched = tCross + SCHEDULE_AHEAD;
      tSched     = Math.max(tSched, Tone.now() + 0.025);

      // frequência = distância do vértice ao centro (raio em Hz)
      const dist = Math.sqrt(x * x + y * y);
      const freq = dist; 

      // disparar som no instante ajustado
      synth.triggerAttackRelease(freq, '16n', tSched);

      // agendar marcador ajustado ao lag
      Tone.Draw.schedule(() => {
        const markerMat = baseMarkerMat.clone();
        const marker    = new THREE.Mesh(markerGeom, markerMat);
        // calcular posição exata usando frac
        const crossAngle = lastAngle + frac * (angle - lastAngle);
        const cx         = x * Math.cos(crossAngle) - y * Math.sin(crossAngle);
        const cy         = x * Math.sin(crossAngle) + y * Math.cos(crossAngle);
        marker.position.set(cx, cy, circle.position.z + 2);
        scene.add(marker);
        markers.push({ mesh: marker, life: markerLifetime });
      }, tSched);

      triggeredNow.add(i);
    }
  }

  // 4) fade out e remoção de markers
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

  // 6) renderizar
  renderer.render(scene, camera);
}

animate();
