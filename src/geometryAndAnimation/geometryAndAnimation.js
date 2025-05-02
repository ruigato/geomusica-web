// src/geometryAndAnimation/geometryAndAnimation.js
import * as THREE from 'three';
import { triggerAudio } from '../audio/audio.js';

// Função para criar a geometria do círculo
export function createCircleGeometry(radius, segments) {
  return new THREE.CircleGeometry(radius, segments);
}

// Função para criar o eixo vertical
export function createAxis(scene) {
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 2048, 0),
  ]);
  scene.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0xffffff })));
}

// Função para atualizar o grupo de cópias
export function updateGroup(group, copies, stepScale, baseGeo, mat, segments) {
  group.clear();
  for (let i = 0; i < copies; i++) {
    const scale = Math.pow(stepScale, i); // Aplica o stepScale para cada cópia
    const rotOff = i * Math.PI / 180; // Exemplo: offset de rotação
    const mesh = new THREE.Mesh(baseGeo, mat);
    mesh.scale.set(scale, scale, 1);
    mesh.rotation.z = rotOff;
    group.add(mesh);
  }
}

// Função para detectar crossings e acionar o áudio
export function detectCrossings(baseGeo, lastAngle, angle, copies, group, lastTrig, tNow, playSound) {
  const triggeredNow = new Set();
  const verts = baseGeo.attributes.position.array;
  const count = baseGeo.attributes.position.count;
  for (let ci = 0; ci < copies; ci++) {
    const mesh = group.children[ci];
    const worldRot = angle + mesh.rotation.z;
    const worldScale = mesh.scale.x;
    for (let vi = 0; vi < count; vi++) {
      const x0 = verts[3 * vi], y0 = verts[3 * vi + 1];
      const x1 = x0 * worldScale, y1 = y0 * worldScale;
      const prevX = x1 * Math.cos(lastAngle + mesh.rotation.z) - y1 * Math.sin(lastAngle + mesh.rotation.z);
      const currX = x1 * Math.cos(worldRot) - y1 * Math.sin(worldRot);
      const currY = x1 * Math.sin(worldRot) + y1 * Math.cos(worldRot);
      const key = `${ci}-${vi}`;
      if (prevX > 0 && currX <= 0 && currY > 0 && !lastTrig.has(key)) {
        playSound(Math.hypot(x1, y1), tNow); // Chama a função de áudio
        triggeredNow.add(key);
      }
    }
  }
  return triggeredNow;
}

// Função para animar e atualizar a rotação do grupo
export function animate({ scene, group, baseGeo, mat, stats, synth, renderer, cam, bpm, lastTime, lastAngle, lastTrig, markers, radius, copies, segments, stepScale }) {
  requestAnimationFrame(() => animate({
    scene,
    group,
    baseGeo,
    mat,
    stats,
    synth, // Passando o sintetizador
    renderer,
    cam,
    bpm,
    lastTime,
    lastAngle,
    lastTrig,
    markers,
    radius,
    copies,
    segments,
    stepScale,
  }));

  // Rebuild geometry if radius or segments change
  if (baseGeo.parameters.radius !== radius || baseGeo.parameters.segments !== segments) {
    baseGeo.dispose();
    baseGeo = new THREE.CircleGeometry(radius, segments);
  }

  updateGroup(group, copies, stepScale, baseGeo, mat, segments);

  // Calcular o tempo e o ângulo usando Tone.now()
  const tNow = Tone.now(); // Aqui o Tone.now() é usado para controle de tempo
  const dt = tNow - lastTime;
  lastTime = tNow;
  const dAng = (bpm / 60) * 2 * Math.PI * dt;
  const ang = lastAngle + dAng;
  group.rotation.z = ang;

  // Detecção de crossings dos vértices e cálculos de áudio
  const triggeredNow = detectCrossings(baseGeo, lastAngle, ang, copies, group, lastTrig, tNow, triggerAudio);

  // Fade e remoção de marcadores
  for (let j = markers.length - 1; j >= 0; j--) {
    const o = markers[j];
    o.life--;
    o.mesh.material.opacity = o.life / MARK_LIFE;
    if (o.life <= 0) {
      scene.remove(o.mesh);
      markers.splice(j, 1);
    }
  }

  lastTrig = triggeredNow;
  lastAngle = ang;
  stats.begin();
  renderer.render(scene, cam);
  stats.end();
}
