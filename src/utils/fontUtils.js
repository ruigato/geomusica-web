// src/utils/fontUtils.js - Optimized version

/**
 * Preload a font by name and URL
 * @param {string} fontFamily Font family name
 * @param {string} url URL to the font file
 * @returns {Promise} Promise that resolves when the font is loaded
 */
export function preloadFont(fontFamily, url) {
  // Skip if FontFace API is not supported
  if (!('FontFace' in window)) {
    console.warn('FontFace API not supported in this browser');
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    try {
      // Create a new FontFace object
      const font = new FontFace(fontFamily, `url(${url})`);
      
      // Load the font
      font.load()
        .then(loadedFont => {
          // Add the font to the document fonts
          document.fonts.add(loadedFont);
          resolve(loadedFont);
        })
        .catch(error => {
          console.error(`Failed to load font ${fontFamily}:`, error);
          reject(error);
        });
    } catch (error) {
      console.error(`Error creating FontFace for ${fontFamily}:`, error);
      reject(error);
    }
  });
}

/**
 * Check if a font is available/loaded
 * @param {string} fontFamily Font family name to check
 * @returns {boolean} True if font is available
 */
export function isFontAvailable(fontFamily) {
  if (!('fonts' in document)) {
    return false;
  }
  
  return document.fonts.check(`1em ${fontFamily}`);
}

/**
 * Wait for all fonts to be loaded
 * @returns {Promise} Promise that resolves when all fonts are loaded
 */
export function waitForFonts() {
  if (!('fonts' in document)) {
    return Promise.resolve();
  }
  
  return document.fonts.ready;
}