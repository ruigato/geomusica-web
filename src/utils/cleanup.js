// src/utils/cleanup.js - Three.js resource cleanup utilities

/**
 * Safely dispose of a Three.js geometry
 * @param {THREE.BufferGeometry} geometry - The geometry to dispose
 */
export function disposeGeometry(geometry) {
  if (!geometry) return;
  
  try {
    // Dispose of the geometry
    if (typeof geometry.dispose === 'function') {
      geometry.dispose();
    }
    
    // Clear any attributes
    if (geometry.attributes) {
      Object.keys(geometry.attributes).forEach(key => {
        const attribute = geometry.attributes[key];
        if (attribute && typeof attribute.dispose === 'function') {
          attribute.dispose();
        }
      });
    }
    
    // Clear index if present
    if (geometry.index && typeof geometry.index.dispose === 'function') {
      geometry.index.dispose();
    }
    
    // Clear any userData references
    if (geometry.userData) {
      geometry.userData = {};
    }
    
  } catch (error) {
    console.warn('[CLEANUP] Error disposing geometry:', error);
  }
}

/**
 * Safely dispose of a Three.js material
 * @param {THREE.Material|THREE.Material[]} material - The material(s) to dispose
 */
export function disposeMaterial(material) {
  if (!material) return;
  
  try {
    if (Array.isArray(material)) {
      material.forEach(mat => disposeSingleMaterial(mat));
    } else {
      disposeSingleMaterial(material);
    }
  } catch (error) {
    console.warn('[CLEANUP] Error disposing material:', error);
  }
}

/**
 * Dispose of a single material
 * @param {THREE.Material} material - The material to dispose
 */
function disposeSingleMaterial(material) {
  if (!material || typeof material.dispose !== 'function') return;
  
  // Dispose of textures if present
  if (material.map && typeof material.map.dispose === 'function') {
    material.map.dispose();
  }
  if (material.normalMap && typeof material.normalMap.dispose === 'function') {
    material.normalMap.dispose();
  }
  if (material.envMap && typeof material.envMap.dispose === 'function') {
    material.envMap.dispose();
  }
  
  // Dispose of the material itself
  material.dispose();
}

/**
 * Safely dispose of a Three.js Object3D and all its children
 * @param {THREE.Object3D} object - The object to dispose
 * @param {boolean} disposeTextures - Whether to dispose textures (default: true)
 */
export function disposeObject3D(object, disposeTextures = true) {
  if (!object) return;
  
  try {
    // Traverse and dispose of all children first
    object.traverse((child) => {
      // Dispose geometry
      if (child.geometry) {
        disposeGeometry(child.geometry);
      }
      
      // Dispose material
      if (child.material) {
        if (disposeTextures) {
          disposeMaterial(child.material);
        } else {
          // Just dispose the material, not textures
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => {
              if (mat && typeof mat.dispose === 'function') {
                mat.dispose();
              }
            });
          } else if (typeof child.material.dispose === 'function') {
            child.material.dispose();
          }
        }
      }
    });
    
    // Clear children array
    object.children.length = 0;
    
    // Remove from parent if it has one
    if (object.parent) {
      object.parent.remove(object);
    }
    
    // Clear userData
    if (object.userData) {
      object.userData = {};
    }
    
  } catch (error) {
    console.warn('[CLEANUP] Error disposing Object3D:', error);
  }
}

/**
 * Clean up arrays of disposable resources
 * @param {Array} disposables - Array of materials, geometries, or objects to dispose
 */
export function disposeArray(disposables) {
  if (!Array.isArray(disposables)) return;
  
  disposables.forEach(item => {
    try {
      if (item && typeof item.dispose === 'function') {
        item.dispose();
      } else if (item && item.geometry) {
        // Assume it's an Object3D
        disposeObject3D(item);
      }
    } catch (error) {
      console.warn('[CLEANUP] Error disposing array item:', error);
    }
  });
  
  // Clear the array
  disposables.length = 0;
} 