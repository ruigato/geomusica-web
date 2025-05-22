// src/utils/fontUtils.js - Optimized version

/**
 * Preload a font for use in the application
 * @param {Object|string} options Font options or font family name
 * @param {string} [options.font] Font family name
 * @param {string} [options.text] Text to preload with the font
 * @param {number} [options.fontSize] Font size in pixels
 * @param {string} [options.fontWeight] Font weight
 * @param {Function} [options.onFontLoaded] Callback when font is loaded
 * @param {string} [url] URL to the font file (for legacy support)
 * @returns {Promise} Promise that resolves when the font is loaded
 */
export function preloadFont(options, url) {
  // Handle both new object-based and legacy string-based parameters
  let fontFamily, fontUrl, onFontLoaded;
  
  if (typeof options === 'object') {
    // New object-based format
    fontFamily = options.font;
    fontUrl = options.url;
    onFontLoaded = options.onFontLoaded;
    
    // If no URL is provided, we'll use system fonts
    if (!fontUrl) {
      console.log(`Loading system font: ${fontFamily}`);
      // For system fonts, we can just check if they're available
      if (isFontAvailable(fontFamily)) {
        console.log(`Font ${fontFamily} already available`);
        if (onFontLoaded && typeof onFontLoaded === 'function') {
          setTimeout(onFontLoaded, 0);
        }
        return Promise.resolve();
      }
      
      // If the font isn't in the system, we'll use a fallback
      console.warn(`Font ${fontFamily} not available, using fallback`);
      if (onFontLoaded && typeof onFontLoaded === 'function') {
        setTimeout(onFontLoaded, 0);
      }
      return Promise.resolve();
    }
  } else {
    // Legacy string-based format
    fontFamily = options;
    fontUrl = url;
  }
  
  // Skip if FontFace API is not supported
  if (!('FontFace' in window)) {
    console.warn('FontFace API not supported in this browser');
    if (onFontLoaded && typeof onFontLoaded === 'function') {
      setTimeout(onFontLoaded, 0);
    }
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    try {
      // If we have a URL, load the font
      if (fontUrl) {
        // Create a new FontFace object
        const font = new FontFace(fontFamily, `url(${fontUrl})`);
        
        // Load the font
        font.load()
          .then(loadedFont => {
            // Add the font to the document fonts
            document.fonts.add(loadedFont);
            console.log(`Font ${fontFamily} loaded successfully`);
            
            if (onFontLoaded && typeof onFontLoaded === 'function') {
              onFontLoaded();
            }
            
            resolve(loadedFont);
          })
          .catch(error => {
            console.error(`Failed to load font ${fontFamily}:`, error);
            
            // Call the callback anyway to avoid blocking the app
            if (onFontLoaded && typeof onFontLoaded === 'function') {
              onFontLoaded();
            }
            
            reject(error);
          });
      } else {
        // No URL provided, assume system font
        console.log(`Using system font: ${fontFamily}`);
        
        if (onFontLoaded && typeof onFontLoaded === 'function') {
          setTimeout(onFontLoaded, 0);
        }
        
        resolve();
      }
    } catch (error) {
      console.error(`Error creating FontFace for ${fontFamily}:`, error);
      
      // Call the callback anyway to avoid blocking the app
      if (onFontLoaded && typeof onFontLoaded === 'function') {
        setTimeout(onFontLoaded, 0);
      }
      
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