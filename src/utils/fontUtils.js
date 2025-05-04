// src/utils/fontUtils.js - Updated version for TrueType fonts

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
          // Resolve anyway since we're using system fonts as fallback
          resolve(null);
        });
    } catch (error) {
      console.error(`Error creating FontFace for ${fontFamily}:`, error);
      // Resolve anyway since we're using system fonts as fallback
      resolve(null);
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

/**
 * Check if Roboto Mono is available, if not, load it from Google Fonts
 * @returns {Promise} Promise that resolves when Roboto Mono is available
 */
export function ensureRobotoMono() {
  // First check if Roboto Mono is already available
  if (isFontAvailable('Roboto Mono')) {
    return Promise.resolve();
  }
  
  // If not available, try to load it from Google Fonts
  return new Promise((resolve) => {
    // Create a link element for Google Fonts
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap';
    
    // Add load event listener
    link.onload = () => {
      // Wait a moment for the font to be applied
      setTimeout(resolve, 100);
    };
    
    // In case of error, resolve anyway (we'll use system fonts)
    link.onerror = () => {
      console.warn('Failed to load Roboto Mono from Google Fonts, falling back to system fonts');
      resolve();
    };
    
    // Add to document head
    document.head.appendChild(link);
    
    // Set a timeout just in case
    setTimeout(resolve, 1000);
  });
}