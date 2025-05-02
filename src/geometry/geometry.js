// src/geometry/geometry.js
import * as THREE from 'three';

// Function to create the circle geometry
export function createCircleGeometry(radius, segments) {
  return new THREE.CircleGeometry(radius, segments);
}

// Function to create the vertical axis
export function createAxis(scene) {
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 2048, 0),
  ]);
  scene.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0xffffff })));
}

// Function to update the group of copies
export function updateGroup(group, copies, stepScale, baseGeo, mat, segments, angle = 0) {
  group.clear();
  for (let i = 0; i < copies; i++) {
    const scale = Math.pow(stepScale, i); // Apply stepScale for each copy
    
    // Each copy gets a cumulative angle (i * angle) in degrees
    const cumulativeAngleDegrees = i * angle;
    
    // Convert to radians only when setting the actual Three.js rotation
    const cumulativeAngleRadians = (cumulativeAngleDegrees * Math.PI) / 180;
    
    const mesh = new THREE.Mesh(baseGeo, mat);
    mesh.scale.set(scale, scale, 1);
    mesh.rotation.z = cumulativeAngleRadians;
    group.add(mesh);
  }
}

// Function to detect crossings and trigger audio
export function detectCrossings(baseGeo, lastAngle, angle, copies, group, lastTrig, tNow, audioCallback) {
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
        audioCallback(x1, y1, lastAngle, angle, tNow);
        triggeredNow.add(key);
      }
    }
  }
  
  return triggeredNow;
}