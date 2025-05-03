// src/geometry/geometry.js
import * as THREE from 'three';
import { 
  OVERLAP_THRESHOLD, 
  VERTEX_CIRCLE_SIZE, 
  VERTEX_CIRCLE_OPACITY, 
  VERTEX_CIRCLE_COLOR 
} from '../config/constants.js';

// Function to create a regular polygon outline
export function createPolygonGeometry(radius, segments) {
  // Create a BufferGeometry to hold our vertices
  const geometry = new THREE.BufferGeometry();
  
  // Generate vertices for the outline only - no central vertex
  const vertices = [];
  const step = (Math.PI * 2) / segments;
  
  // Create vertices in a circular pattern
  for (let i = 0; i < segments; i++) {
    const angle = i * step;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    vertices.push(x, y, 0);
  }
  
  // Create indices for line segments
  const indices = [];
  for (let i = 0; i < segments; i++) {
    indices.push(i, (i + 1) % segments); // Connect each vertex to the next, looping back to start
  }
  
  // Set attributes
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  
  return geometry;
}

// Function to create the vertical axis
export function createAxis(scene) {
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 2048, 0),
  ]);
  scene.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0xffffff })));
}

// Create a circle geometry for vertices
function createVertexCircleGeometry() {
  // Use a circle geometry for vertices
  return new THREE.CircleGeometry(VERTEX_CIRCLE_SIZE, 16);
}

// Function to update the group of copies
export function updateGroup(group, copies, stepScale, baseGeo, mat, segments, angle = 0, state = null) {
  group.clear();
  
  // Cache the base radius once to use for all modulus calculations
  const baseRadius = state ? state.radius : 0;
  
  // Create vertex circle geometry (reuse for all vertices)
  const vertexCircleGeometry = createVertexCircleGeometry();
  
  // Create vertex circle material (reuse for all vertices)
  const vertexCircleMaterial = new THREE.MeshBasicMaterial({ 
    color: VERTEX_CIRCLE_COLOR,
    transparent: true,
    opacity: VERTEX_CIRCLE_OPACITY,
    depthTest: false
  });
  
  for (let i = 0; i < copies; i++) {
    let modulusScale = 1.0;
    let stepScaleFactor = Math.pow(stepScale, i);
    
    // Determine scale based on modulus or standard step scale
    if (state && state.useModulus) {
      // Get the sequence value (increasing from 1/modulus to 1.0)
      modulusScale = state.getScaleFactorForCopy(i);
    }
    
    // Apply both modulus scale and step scale if modulus is enabled
    // Otherwise just use step scale
    const finalScale = state && state.useModulus 
      ? modulusScale * stepScaleFactor 
      : stepScaleFactor;
    
    // Each copy gets a cumulative angle (i * angle) in degrees
    const cumulativeAngleDegrees = i * angle;
    
    // Convert to radians only when setting the actual Three.js rotation
    const cumulativeAngleRadians = (cumulativeAngleDegrees * Math.PI) / 180;
    
    // Create a group for this copy to hold both the lines and vertex circles
    const copyGroup = new THREE.Group();
    
    // Create line for the polygon outline
    const lines = new THREE.LineLoop(baseGeo, mat);
    lines.scale.set(finalScale, finalScale, 1);
    copyGroup.add(lines);
    
    // Apply rotation to the copy group
    copyGroup.rotation.z = cumulativeAngleRadians;
    
    // Get the positions from the geometry
    const positions = baseGeo.getAttribute('position').array;
    const count = baseGeo.getAttribute('position').count;
    
    // Add circles at each vertex
    for (let v = 0; v < count; v++) {
      const x = positions[v * 3] * finalScale;
      const y = positions[v * 3 + 1] * finalScale;
      
      // Create a circle at this vertex
      const vertexCircle = new THREE.Mesh(vertexCircleGeometry, vertexCircleMaterial.clone());
      
      // Position the circle at the vertex
      vertexCircle.position.set(x, y, 0);
      
      // Add to the copy group
      copyGroup.add(vertexCircle);
    }
    
    // Add the whole copy group to the main group
    group.add(copyGroup);
  }
}

// Calculate the distance between two points in 2D space
function distanceBetweenPoints(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Check if a point at (x, y) is too close to any existing active points
function isPointOverlapping(x, y, activePoints) {
  if (!activePoints || activePoints.length === 0) {
    return false;
  }
  
  for (const point of activePoints) {
    const distance = distanceBetweenPoints(x, y, point.x, point.y);
    if (distance < OVERLAP_THRESHOLD) {
      return true; // Point is too close to an existing active point
    }
  }
  
  return false; // No overlap detected
}

// Function to detect crossings and trigger audio
export function detectCrossings(baseGeo, lastAngle, angle, copies, group, lastTrig, tNow, audioCallback) {
  const triggeredNow = new Set();
  const triggeredPoints = []; // Store positions of triggered points
  
  // Get vertices from buffer geometry
  const positions = baseGeo.getAttribute('position').array;
  const count = baseGeo.getAttribute('position').count;
  
  for (let ci = 0; ci < copies; ci++) {
    // Each copy is a Group containing the LineLoop and vertex circles
    const copyGroup = group.children[ci];
    
    // The first child is the LineLoop
    const mesh = copyGroup.children[0];
    
    const worldRot = angle + copyGroup.rotation.z;
    const worldScale = mesh.scale.x;
    
    for (let vi = 0; vi < count; vi++) {
      const x0 = positions[vi * 3];
      const y0 = positions[vi * 3 + 1];
      
      const x1 = x0 * worldScale;
      const y1 = y0 * worldScale;
      
      const prevX = x1 * Math.cos(lastAngle + copyGroup.rotation.z) - y1 * Math.sin(lastAngle + copyGroup.rotation.z);
      const currX = x1 * Math.cos(worldRot) - y1 * Math.sin(worldRot);
      const currY = x1 * Math.sin(worldRot) + y1 * Math.cos(worldRot);
      
      // Calculate the world position of the vertex
      const worldX = x1 * Math.cos(worldRot) - y1 * Math.sin(worldRot);
      const worldY = x1 * Math.sin(worldRot) + y1 * Math.cos(worldRot);
      
      const key = `${ci}-${vi}`;
      
      if (prevX > 0 && currX <= 0 && currY > 0 && !lastTrig.has(key)) {
        // Check if this point overlaps with any previously triggered points
        if (!isPointOverlapping(worldX, worldY, triggeredPoints)) {
          // No overlap, trigger audio and create marker
          audioCallback(x1, y1, lastAngle, angle, tNow);
          triggeredNow.add(key);
          
          // Add this point to the list of triggered points
          triggeredPoints.push({ x: worldX, y: worldY });
          
          // Create a marker at the current vertex position (in world space)
          createMarker(worldRot, x1, y1, group.parent);
        } else {
          // Point is overlapping, still add to triggered set but don't trigger audio
          triggeredNow.add(key);
          
          // Still create visual marker to maintain visual consistency
          createMarker(worldRot, x1, y1, group.parent);
        }
      }
    }
  }
  
  return triggeredNow;
}

// Function to create a marker at the given coordinates
function createMarker(worldRot, x, y, scene) {
  // Check if the scene's userData contains our markers array
  if (!scene.userData.markers) {
    scene.userData.markers = [];
  }
  
  // Create the marker
  const markerGeom = new THREE.SphereGeometry(8, 8, 8);
  
  // Create a semi-transparent material for the marker
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    transparent: true,
    opacity: 1.0,
    depthTest: false
  });
  
  // Create the mesh
  const markerMesh = new THREE.Mesh(markerGeom, markerMat);
  
  // Position in world space - rotate the point
  const worldX = x * Math.cos(worldRot) - y * Math.sin(worldRot);
  const worldY = x * Math.sin(worldRot) + y * Math.cos(worldRot);
  
  markerMesh.position.set(worldX, worldY, 5); // Slightly in front
  
  scene.add(markerMesh);
  
  // Add to our markers array with life value
  const marker = {
    mesh: markerMesh,
    life: 30 // MARK_LIFE value
  };
  
  if (scene.userData.state && scene.userData.state.markers) {
    scene.userData.state.markers.push(marker);
  } else {
    // Fall back to scene's userData if state is not available
    scene.userData.markers.push(marker);
  }
  
  return marker;
}