import * as THREE from 'three';

export function createRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth * 0.8, window.innerHeight);
  document.getElementById('canvas').appendChild(renderer.domElement);
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  return scene;
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(75, (window.innerWidth * 0.8) / window.innerHeight, 0.1, 10000);
  cam.position.set(0, 0, 2000);
  cam.lookAt(0, 0, 0);
  return cam;
}

export function createAxis() {
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 2048, 0),
  ]);
  return new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0xffffff }));
}
