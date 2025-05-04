// src/utils/fontUtils.js
import * as THREE from 'three';

// Font cache to avoid regenerating the texture
const FONT_CACHE = {};

// Function to create a texture atlas from a TTF font
export function createFontTextureAtlas(fontName = 'Perfect DOS VGA 437 Win', fontSize = 32) {
  // Check if we've already created this atlas
  const cacheKey = `${fontName}-${fontSize}`;
  if (FONT_CACHE[cacheKey]) {
    return FONT_CACHE[cacheKey];
  }
  
  // Create a canvas for rendering the characters
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 64;
  
  const ctx = canvas.getContext('2d');
  ctx.font = `${fontSize}px "${fontName}"`;
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Characters we'll need for frequency values (digits, decimal point)
  const chars = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.'];
  const charWidth = 32; // Fixed width for each character in the atlas
  const charInfo = {};
  
  // Draw each character to the atlas and store its position
  chars.forEach((char, i) => {
    const x = i * charWidth + 10;
    ctx.fillText(char, x, 32);
    
    // Store character info for UV mapping
    charInfo[char] = {
      x: x - 5, // Add some padding
      y: 0,
      width: charWidth,
      height: 64
    };
  });
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // Cache the atlas
  FONT_CACHE[cacheKey] = {
    texture,
    charInfo,
    canvas
  };
  
  return FONT_CACHE[cacheKey];
}

// Function to preload the font
export function preloadFont(fontFamily, fontUrl) {
  return new Promise((resolve, reject) => {
    // Create a style element
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: "${fontFamily}";
        src: url("${fontUrl}") format("truetype");
        font-weight: normal;
        font-style: normal;
      }
    `;
    document.head.appendChild(style);
    
    // Create a div to trigger font loading
    const div = document.createElement('div');
    div.style.fontFamily = fontFamily;
    div.style.opacity = '0';
    div.textContent = 'Font Loader';
    document.body.appendChild(div);
    
    // Use FontFaceObserver to detect when the font is loaded
    const checkFont = () => {
      // Simple way to check if font is loaded
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.font = `10px ${fontFamily}, monospace`;
      const width1 = ctx.measureText('Test').width;
      
      ctx.font = '10px monospace';
      const width2 = ctx.measureText('Test').width;
      
      if (width1 !== width2) {
        // Font is loaded
        document.body.removeChild(div);
        resolve();
      } else {
        // Keep trying
        setTimeout(checkFont, 50);
      }
    };
    
    checkFont();
    
    // Set a timeout to prevent infinite checking
    setTimeout(() => {
      document.body.removeChild(div);
      console.warn(`Font ${fontFamily} loading timed out after 3 seconds`);
      resolve(); // Resolve anyway so app doesn't hang
    }, 3000);
  });
}